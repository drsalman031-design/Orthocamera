import { CaptureReadiness } from '../types';
import { CapturePerformanceTracker } from '../telemetry/CapturePerformanceTracker';

export type GuidanceStateStage =
  | 'SEARCHING'
  | 'ALIGNING'
  | 'CANDIDATE_READY'
  | 'READY'
  | 'COUNTDOWN'
  | 'PAUSED_MOTION'
  | 'CAPTURED'
  | 'COOLDOWN';

export interface HysteresisConfig {
  enterReadyScore: number; // 85
  exitReadyScore: number; // 70
  candidatePersistenceMs: number; // 250-350ms stable in CANDIDATE_READY before READY
  temporaryLossGraceMs: number; // 200ms grace period before dropping from READY
  cooldownPeriodMs: number; // 700ms lockout after capture
}

export interface ControllerStateUpdate {
  stage: GuidanceStateStage;
  countdownSeconds: number | null;
  shouldTriggerCapture: boolean;
  statusMessage: string;
}

export class HysteresisController {
  private config: HysteresisConfig;
  private currentStage: GuidanceStateStage = 'SEARCHING';
  private candidateStartTime: number | null = null;
  private lastValidReadyTime: number = 0;
  private lastCaptureTime: number = 0;
  private countdownValue: number | null = null;
  private countdownStartTime: number | null = null;
  private countdownDurationSec: number = 0.75;

  constructor(customConfig?: Partial<HysteresisConfig>) {
    this.config = {
      enterReadyScore: 85,
      exitReadyScore: 70,
      candidatePersistenceMs: 250,
      temporaryLossGraceMs: 200,
      cooldownPeriodMs: 700,
      ...customConfig,
    };
  }

  public setCountdownDuration(seconds: number) {
    this.countdownDurationSec = Math.max(0.5, Math.min(5, seconds));
  }

  /**
   * Evaluates the current frame against hysteresis rules and returns the updated state.
   */
  public update(
    inputOrScore: CaptureReadiness | number,
    isPositionValid?: boolean,
    isAngleValid?: boolean,
    isMotionStable?: boolean,
    autoCaptureEnabled: boolean = true,
    timestamp: number = Date.now()
  ): ControllerStateUpdate {
    let rawScore: number;
    let posValid: boolean;
    let angValid: boolean;
    let motionStable: boolean;
    let isFullyReady: boolean;

    if (typeof inputOrScore === 'number') {
      rawScore = inputOrScore;
      posValid = !!isPositionValid;
      angValid = !!isAngleValid;
      motionStable = isMotionStable !== undefined ? isMotionStable : true;
      isFullyReady = rawScore >= this.config.enterReadyScore && posValid && angValid && motionStable;
    } else {
      const readiness = inputOrScore;
      rawScore = readiness.score;
      posValid = readiness.positionValid;
      angValid = readiness.angleValid;
      motionStable = readiness.temporalStabilityValid;
      isFullyReady = readiness.ready;
    }
    // 1. Enforce Cooldown period post-capture
    if (this.lastCaptureTime > 0 && timestamp - this.lastCaptureTime < this.config.cooldownPeriodMs) {
      this.currentStage = 'COOLDOWN';
      return {
        stage: 'COOLDOWN',
        countdownSeconds: null,
        shouldTriggerCapture: false,
        statusMessage: 'PHOTO CAPTURED',
      };
    }

    const passesEntry = isFullyReady && posValid && angValid && motionStable;
    const passesExit = (isFullyReady || rawScore >= this.config.exitReadyScore) && posValid && angValid;

    // State machine transitions
    switch (this.currentStage) {
      case 'COOLDOWN':
      case 'CAPTURED':
        this.currentStage = 'SEARCHING';
        this.candidateStartTime = null;
        this.countdownValue = null;
        break;

      case 'SEARCHING':
      case 'ALIGNING':
        if (passesEntry) {
          this.currentStage = 'CANDIDATE_READY';
          this.candidateStartTime = timestamp;
          CapturePerformanceTracker.recordAlignmentValid(timestamp);
        } else if (rawScore > 35) {
          this.currentStage = 'ALIGNING';
          CapturePerformanceTracker.resetAlignmentValid();
        } else {
          this.currentStage = 'SEARCHING';
          CapturePerformanceTracker.resetAlignmentValid();
        }
        break;

      case 'CANDIDATE_READY':
        if (!passesExit) {
          this.currentStage = 'ALIGNING';
          this.candidateStartTime = null;
          CapturePerformanceTracker.resetAlignmentValid();
        } else if (
          this.candidateStartTime &&
          timestamp - this.candidateStartTime >= this.config.candidatePersistenceMs
        ) {
          // Stable long enough -> Enter READY
          this.currentStage = 'READY';
          this.lastValidReadyTime = timestamp;
          CapturePerformanceTracker.recordCandidateReady(timestamp);

          if (autoCaptureEnabled) {
            this.currentStage = 'COUNTDOWN';
            this.countdownStartTime = timestamp;
            this.countdownValue = Math.max(1, Math.ceil(this.countdownDurationSec));
            CapturePerformanceTracker.recordCountdownStarted(timestamp);
          }
        }
        break;

      case 'READY':
        if (passesExit) {
          this.lastValidReadyTime = timestamp;
          if (autoCaptureEnabled) {
            this.currentStage = 'COUNTDOWN';
            this.countdownStartTime = timestamp;
            this.countdownValue = Math.max(1, Math.ceil(this.countdownDurationSec));
            CapturePerformanceTracker.recordCountdownStarted(timestamp);
          }
        } else if (timestamp - this.lastValidReadyTime > this.config.temporaryLossGraceMs) {
          // Grace period expired
          this.currentStage = 'ALIGNING';
          CapturePerformanceTracker.resetAlignmentValid();
        }
        break;

      case 'COUNTDOWN':
        if (!posValid || !angValid) {
          // Critical alignment lost (patient turned away / moved out of frame)
          this.currentStage = 'ALIGNING';
          this.countdownValue = null;
          this.countdownStartTime = null;
          CapturePerformanceTracker.resetAlignmentValid();
          break;
        }

        // Check for hand tremor / sudden device motion: PAUSE countdown rather than cancel!
        if (!motionStable) {
          this.currentStage = 'PAUSED_MOTION';
          break;
        }

        if (passesExit) {
          this.lastValidReadyTime = timestamp;
          if (this.countdownStartTime) {
            const elapsed = (timestamp - this.countdownStartTime) / 1000;
            const remaining = Math.max(0, Math.ceil(this.countdownDurationSec - elapsed));
            this.countdownValue = remaining > 0 ? remaining : 1;

            if (elapsed >= this.countdownDurationSec) {
              // Trigger capture!
              this.currentStage = 'CAPTURED';
              this.lastCaptureTime = timestamp;
              this.countdownValue = null;
              this.countdownStartTime = null;
              CapturePerformanceTracker.recordCaptureTriggered(timestamp);

              return {
                stage: 'CAPTURED',
                countdownSeconds: null,
                shouldTriggerCapture: true,
                statusMessage: 'READY ✓',
              };
            }
          }
        } else if (timestamp - this.lastValidReadyTime > this.config.temporaryLossGraceMs) {
          // Tracking lost longer than grace period -> return to aligning
          this.currentStage = 'ALIGNING';
          this.countdownValue = null;
          this.countdownStartTime = null;
          CapturePerformanceTracker.resetAlignmentValid();
        }
        break;

      case 'PAUSED_MOTION':
        if (isMotionStable && passesExit) {
          // Motion subsided: resume countdown from current remaining time
          this.currentStage = 'COUNTDOWN';
          if (this.countdownValue !== null) {
            this.countdownStartTime = timestamp - (this.countdownDurationSec - this.countdownValue) * 1000;
          }
        } else if (!passesExit && timestamp - this.lastValidReadyTime > this.config.temporaryLossGraceMs) {
          this.currentStage = 'ALIGNING';
          this.countdownValue = null;
          this.countdownStartTime = null;
          CapturePerformanceTracker.resetAlignmentValid();
        }
        break;
    }

    let statusMessage = 'SEARCHING';
    if (this.currentStage === 'COUNTDOWN' || this.currentStage === 'READY') {
      statusMessage = 'READY ✓';
    } else if (this.currentStage === 'PAUSED_MOTION') {
      statusMessage = 'HOLD STEADY...';
    } else if (this.currentStage === 'ALIGNING' || this.currentStage === 'CANDIDATE_READY') {
      statusMessage = 'ALIGN PATIENT';
    }

    return {
      stage: this.currentStage,
      countdownSeconds: this.countdownValue,
      shouldTriggerCapture: false,
      statusMessage,
    };
  }

  public reset(): void {
    this.currentStage = 'SEARCHING';
    this.candidateStartTime = null;
    this.countdownValue = null;
    this.countdownStartTime = null;
  }
}
