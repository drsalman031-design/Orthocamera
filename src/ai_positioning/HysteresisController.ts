import { CaptureReadiness } from '../types';
import { CapturePerformanceTracker } from '../telemetry/CapturePerformanceTracker';
import { CaptureMode, getCaptureModeConfig } from './CaptureConfig';

export type GuidanceStateStage =
  | 'SEARCHING'
  | 'ALIGNING'
  | 'READY_CANDIDATE'
  | 'STABILITY_CONFIRMATION'
  | 'READY'
  | 'CAPTURED'
  | 'COOLDOWN';

export interface HysteresisConfig {
  enterReadyScore: number; // 60 (Fast), 70 (Balanced), 80 (Clinical)
  exitReadyScore: number; // 50 (Fast), 60 (Balanced), 70 (Clinical)
  stabilityConfirmationMs: number; // 120ms - 250ms
  jitterDebounceGraceMs: number; // 50ms - 90ms buffer to absorb single-frame sensor noise
  cooldownPeriodMs: number; // 400ms post-capture shutter lockout
}

export interface ControllerStateUpdate {
  stage: GuidanceStateStage;
  guidanceStage: GuidanceStateStage; // Alias for stage
  timeToCaptureMs: number;
  countdownSeconds: number | null; // Kept for backward compatibility
  isReady: boolean;
  shouldTriggerCapture: boolean;
  statusMessage: string;
  candidateToCaptureLatencyMs: number;
}

export class HysteresisController {
  private config: HysteresisConfig;
  private currentStage: GuidanceStateStage = 'SEARCHING';
  private candidateStartTime: number | null = null;
  private stabilityStartTime: number | null = null;
  private lastValidTime: number = 0;
  private lastCaptureTime: number = 0;
  private candidateToCaptureLatencyMs: number = 0;

  constructor(customConfig?: Partial<HysteresisConfig>) {
    this.config = {
      enterReadyScore: 70,
      exitReadyScore: 60,
      stabilityConfirmationMs: 180, // Default Balanced target
      jitterDebounceGraceMs: 70, // Debounce single-frame drop
      cooldownPeriodMs: 400,
      ...customConfig,
    };
  }

  public setCaptureMode(mode: CaptureMode): void {
    const modeConfig = getCaptureModeConfig(mode);
    this.config.enterReadyScore = modeConfig.enterReadyScore;
    this.config.exitReadyScore = modeConfig.exitReadyScore;
    this.config.stabilityConfirmationMs = modeConfig.stabilityConfirmationMs;
    this.config.jitterDebounceGraceMs = modeConfig.jitterDebounceGraceMs;
  }

  public setStabilityDurationMs(ms: number): void {
    this.config.stabilityConfirmationMs = Math.max(80, Math.min(600, ms));
  }

  public setStabilityConfirmationDuration(ms: number): void {
    this.setStabilityDurationMs(ms);
  }

  public setCountdownDuration(seconds: number): void {
    // Adapter for legacy settings call
    this.config.stabilityConfirmationMs = Math.max(100, Math.min(450, Math.round(seconds * 300)));
  }

  public getStage(): GuidanceStateStage {
    return this.currentStage;
  }

  public getCandidateToCaptureLatencyMs(): number {
    return this.candidateToCaptureLatencyMs;
  }

  private makeResult(
    stage: GuidanceStateStage,
    isReady: boolean,
    shouldTriggerCapture: boolean,
    statusMessage: string,
    latencyMs: number,
    timeToCaptureMs: number = 0
  ): ControllerStateUpdate {
    return {
      stage,
      guidanceStage: stage,
      timeToCaptureMs,
      countdownSeconds: null,
      isReady,
      shouldTriggerCapture,
      statusMessage,
      candidateToCaptureLatencyMs: latencyMs,
    };
  }

  public update(
    inputOrScore: CaptureReadiness | number,
    isPositionValid?: boolean,
    isAngleValid?: boolean,
    isMotionStable?: boolean,
    autoCaptureEnabled: boolean = true,
    now?: number
  ): ControllerStateUpdate {
    const timestamp = now !== undefined ? now : Date.now();

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

    // 1. Shutter Cooldown Lockout
    if (this.lastCaptureTime > 0 && timestamp - this.lastCaptureTime < this.config.cooldownPeriodMs) {
      this.currentStage = 'COOLDOWN';
      return this.makeResult('COOLDOWN', false, false, 'CAPTURED ✓', 0, 0);
    }

    const passesEntry = isFullyReady && posValid && angValid && motionStable;
    const passesExit = (isFullyReady || rawScore >= this.config.exitReadyScore) && posValid && angValid && motionStable;

    if (passesEntry || (this.stabilityStartTime !== null && passesExit)) {
      this.lastValidTime = timestamp;

      if (!this.candidateStartTime) {
        this.candidateStartTime = timestamp;
        this.stabilityStartTime = timestamp;
        this.currentStage = 'READY_CANDIDATE';
        CapturePerformanceTracker.recordCandidateReady(timestamp);
      } else {
        this.currentStage = 'STABILITY_CONFIRMATION';
      }

      const elapsedMs = timestamp - (this.stabilityStartTime ?? timestamp);
      this.candidateToCaptureLatencyMs = timestamp - this.candidateStartTime;
      const remainingMs = Math.max(0, this.config.stabilityConfirmationMs - elapsedMs);

      // Stability Confirmation complete!
      if (elapsedMs >= this.config.stabilityConfirmationMs) {
        this.currentStage = 'CAPTURED';
        this.lastCaptureTime = timestamp;
        const totalLatency = this.candidateToCaptureLatencyMs;

        this.candidateStartTime = null;
        this.stabilityStartTime = null;
        CapturePerformanceTracker.recordCaptureTriggered(timestamp);

        return this.makeResult('CAPTURED', true, autoCaptureEnabled, 'READY ✓', totalLatency, 0);
      }

      return this.makeResult(
        this.currentStage,
        true,
        false,
        'READY',
        this.candidateToCaptureLatencyMs,
        remainingMs
      );
    }

    // Alignment temporarily invalid or jittered: apply debounce grace
    if (this.stabilityStartTime !== null) {
      const timeSinceValid = timestamp - this.lastValidTime;
      if (timeSinceValid <= this.config.jitterDebounceGraceMs) {
        // Absorbing single-frame sensor noise: hold stability progress
        return this.makeResult(
          this.currentStage,
          true,
          false,
          'READY',
          timestamp - (this.candidateStartTime ?? timestamp),
          Math.max(0, this.config.stabilityConfirmationMs - (timestamp - this.stabilityStartTime))
        );
      }
    }

    // Exceeded debounce grace: return to ALIGNING or SEARCHING
    this.candidateStartTime = null;
    this.stabilityStartTime = null;

    if (rawScore > Math.min(35, this.config.enterReadyScore * 0.5)) {
      this.currentStage = 'ALIGNING';
      CapturePerformanceTracker.resetAlignmentValid();
    } else {
      this.currentStage = 'SEARCHING';
      CapturePerformanceTracker.resetAlignmentValid();
    }

    return this.makeResult(
      this.currentStage,
      false,
      false,
      this.currentStage === 'ALIGNING' ? 'ALIGNING' : 'SEARCHING',
      0,
      0
    );
  }

  public reset(): void {
    this.currentStage = 'SEARCHING';
    this.candidateStartTime = null;
    this.stabilityStartTime = null;
    this.lastValidTime = 0;
    this.candidateToCaptureLatencyMs = 0;
  }
}
