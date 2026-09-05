import {
  OrthodonticViewDefinition,
  ViewCaptureSpec,
} from '../types';
import { FaceAnalysisResult } from './FaceAnalyzer';
import { ProfileStateResult } from './ProfileFallbackEngine';
import { CaptureMode, getCaptureModeConfig } from './CaptureConfig';

export interface ClinicalAlignmentCorrection {
  direction:
    | 'LEFT'
    | 'RIGHT'
    | 'UP'
    | 'DOWN'
    | 'ROTATE_LEFT'
    | 'ROTATE_RIGHT'
    | 'MOVE_CLOSER'
    | 'MOVE_BACK'
    | 'HOLD_STILL'
    | 'READY';
  magnitude: number;
  message: string;
}

export interface AlignmentScoreBreakdown {
  centerScore: number;
  yawScore: number;
  pitchScore: number;
  rollScore: number;
  distanceScore: number;
  landmarkScore: number;
  stabilityScore: number;
  expressionScore: number;
}

export interface ClinicalAlignmentResult {
  detected: boolean;
  alignmentScore: number; // Continuous 0 to 100

  centerErrorX: number;
  centerErrorY: number;

  yawErrorDeg: number;
  pitchErrorDeg: number;
  rollErrorDeg: number;

  distanceError: number;

  landmarksValid: boolean;
  poseValid: boolean;
  expressionValid: boolean;

  ready: boolean;

  correction: ClinicalAlignmentCorrection;
  breakdown: AlignmentScoreBreakdown;
  reasons: string[];
  rejectionReason?: string;
  blockingFactors?: string[];
}

export interface ClinicalAlignmentInput {
  faceResult?: FaceAnalysisResult | null;
  currentView: OrthodonticViewDefinition;
  frameWidth?: number;
  frameHeight?: number;
  sensitivity?: 'high' | 'medium' | 'relaxed';
  captureMode?: CaptureMode;
  profileState?: ProfileStateResult | null;
  motionScore?: number;
  isStable?: boolean;
  rawLuminance?: number;
  rawSharpness?: number;
}

export class ClinicalAlignmentEngine {
  /**
   * Evaluates extraoral face landmark geometry using MediaPipe or qualified fallbacks.
   * Returns continuous alignment scoring, exact geometric deviations, prioritized clinical guidance,
   * and explicit rejection reasons based on active CaptureMode (Fast, Balanced, Clinical).
   */
  public static evaluate(input: ClinicalAlignmentInput): ClinicalAlignmentResult {
    const {
      faceResult,
      currentView,
      sensitivity = 'medium',
      captureMode = 'balanced',
      profileState,
      motionScore = 0,
      isStable = false,
      rawLuminance = 130,
      rawSharpness = 85,
    } = input;

    const modeConfig = getCaptureModeConfig(captureMode);

    // View-specific target specifications with mode tolerance multipliers
    const baseSpec: ViewCaptureSpec = currentView.captureSpec || {
      targetYawDeg: 0,
      yawToleranceDeg: sensitivity === 'high' ? 5 : sensitivity === 'relaxed' ? 10 : 7,
      targetPitchDeg: 0,
      pitchToleranceDeg: sensitivity === 'high' ? 5 : sensitivity === 'relaxed' ? 10 : 7,
      targetRollDeg: 0,
      rollToleranceDeg: sensitivity === 'high' ? 3 : sensitivity === 'relaxed' ? 7 : 5,
      minFaceHeightRatio: sensitivity === 'relaxed' ? 0.18 : sensitivity === 'high' ? 0.28 : 0.22,
      maxFaceHeightRatio: sensitivity === 'relaxed' ? 0.88 : sensitivity === 'high' ? 0.72 : 0.82,
      centerToleranceX: sensitivity === 'high' ? 0.12 : sensitivity === 'relaxed' ? 0.22 : 0.18,
      centerToleranceY: sensitivity === 'high' ? 0.12 : sensitivity === 'relaxed' ? 0.22 : 0.18,
      minLandmarkConfidence: 0.45,
      minPoseConfidence: 0.45,
      stableDurationMs: 600,
      requiresSmile:
        currentView.id === 'FRONTAL_SMILE' ||
        currentView.id === 'RIGHT_OBLIQUE' ||
        currentView.id === 'LEFT_OBLIQUE',
      minSmileScore: 0.25,
      requiresFaceLandmarks: true,
    };

    const spec: ViewCaptureSpec = {
      ...baseSpec,
      centerToleranceX: baseSpec.centerToleranceX * modeConfig.centerToleranceMultiplier,
      centerToleranceY: baseSpec.centerToleranceY * modeConfig.centerToleranceMultiplier,
      yawToleranceDeg: baseSpec.yawToleranceDeg * modeConfig.angleToleranceMultiplier,
      pitchToleranceDeg: baseSpec.pitchToleranceDeg * modeConfig.angleToleranceMultiplier,
      rollToleranceDeg: baseSpec.rollToleranceDeg * modeConfig.angleToleranceMultiplier,
      minSmileScore: Math.min(baseSpec.minSmileScore ?? 0.25, modeConfig.minSmileScore),
    };

    // Fail-closed baseline when face is not detected
    if (!faceResult || !faceResult.detected || faceResult.confidence < 0.25) {
      return {
        detected: false,
        alignmentScore: 0,
        centerErrorX: 0,
        centerErrorY: 0,
        yawErrorDeg: spec.targetYawDeg,
        pitchErrorDeg: spec.targetPitchDeg,
        rollErrorDeg: spec.targetRollDeg,
        distanceError: 1,
        landmarksValid: false,
        poseValid: false,
        expressionValid: false,
        ready: false,
        correction: {
          direction: 'HOLD_STILL',
          magnitude: 1,
          message: 'Align patient face in guide',
        },
        breakdown: {
          centerScore: 0,
          yawScore: 0,
          pitchScore: 0,
          rollScore: 0,
          distanceScore: 0,
          landmarkScore: 0,
          stabilityScore: 0,
          expressionScore: 0,
        },
        reasons: ['FACE_NOT_DETECTED'],
        rejectionReason: 'Face not detected in guide',
        blockingFactors: ['FACE_NOT_DETECTED'],
      };
    }

    // 1. Engine & Fallback Check
    const isMediaPipe = faceResult.aiEngine === 'mediapipe';
    const isProfileView = currentView.id === 'RIGHT_PROFILE' || currentView.id === 'LEFT_PROFILE';

    const isFallbackAcceptable =
      !isMediaPipe &&
      modeConfig.allowFallbackDetectorCapture &&
      faceResult.confidence >= modeConfig.minFallbackConfidence;

    // 2. Anatomical Landmark Check (profile views naturally occlude contralateral eye)
    const hasRequiredPoints = isProfileView
      ? !!(
          faceResult.landmarks &&
          (faceResult.landmarks.leftEye || faceResult.landmarks.rightEye) &&
          faceResult.landmarks.noseTip &&
          faceResult.landmarks.chinTip
        )
      : !!(
          faceResult.landmarks &&
          faceResult.landmarks.leftEye &&
          faceResult.landmarks.rightEye &&
          faceResult.landmarks.noseTip &&
          faceResult.landmarks.mouthCenter &&
          faceResult.landmarks.chinTip
        );

    const lq = faceResult.landmarkQuality;
    const landmarksValid = isMediaPipe
      ? !!lq &&
        lq.available &&
        (isProfileView || lq.requiredLandmarksPresent) &&
        hasRequiredPoints &&
        lq.confidence >= (isProfileView ? 0.35 : spec.minLandmarkConfidence)
      : false;

    // 3. Head Pose Extraction Validation
    const pose = faceResult.pose;
    const isPoseAvailable =
      !!pose &&
      pose.source !== 'unavailable' &&
      pose.yawDeg !== null &&
      pose.pitchDeg !== null &&
      pose.rollDeg !== null;

    const poseValid = isMediaPipe
      ? isPoseAvailable && (pose?.confidence ?? 0) >= spec.minPoseConfidence
      : false;

    // 4. Centering Geometry
    const targetCenterX = 0.5;
    const targetCenterY = 0.45;
    const centerErrorX = faceResult.center.x - targetCenterX;
    const centerErrorY = faceResult.center.y - targetCenterY;
    const positionValid =
      Math.abs(centerErrorX) <= spec.centerToleranceX &&
      Math.abs(centerErrorY) <= spec.centerToleranceY + 0.05;

    // 5. Distance / Face Coverage Geometry
    const faceRatio = faceResult.faceHeightRatio;
    const minFaceRatio = Math.max(0.12, spec.minFaceHeightRatio / modeConfig.distanceToleranceMultiplier);
    const maxFaceRatio = Math.min(0.95, spec.maxFaceHeightRatio * modeConfig.distanceToleranceMultiplier);
    const targetRatio = (minFaceRatio + maxFaceRatio) / 2;
    const distanceError =
      faceRatio < minFaceRatio
        ? minFaceRatio - faceRatio
        : faceRatio > maxFaceRatio
        ? faceRatio - maxFaceRatio
        : 0;
    const distanceValid = faceRatio >= minFaceRatio && faceRatio <= maxFaceRatio;

    // 6. Angular Errors
    const yaw = faceResult.yawDeg;
    const pitch = faceResult.pitchDeg;
    const roll = faceResult.rollDeg;

    const yawErrorDeg = Math.abs(yaw - spec.targetYawDeg);
    const pitchErrorDeg = Math.abs(pitch - spec.targetPitchDeg);
    const rollErrorDeg = Math.abs(roll - spec.targetRollDeg);

    let angleValid =
      yawErrorDeg <= spec.yawToleranceDeg &&
      pitchErrorDeg <= spec.pitchToleranceDeg &&
      rollErrorDeg <= spec.rollToleranceDeg;

    // Lateral Profile View Specific Enforcements
    if (isProfileView) {
      if (profileState) {
        angleValid = profileState.isProfileAligned || (captureMode === 'fast' && profileState.state === 'TRACKING');
      } else {
        const minProfileAngle = captureMode === 'fast' ? 65 : captureMode === 'balanced' ? 70 : 75;
        const maxProfileAngle = captureMode === 'fast' ? 105 : 100;
        const maxProfileRoll = captureMode === 'fast' ? 12 : 8;

        if (currentView.id === 'RIGHT_PROFILE') {
          if (yaw < minProfileAngle || yaw > maxProfileAngle) {
            angleValid = false;
          }
        } else {
          if (yaw > -minProfileAngle || yaw < -maxProfileAngle) {
            angleValid = false;
          }
        }
        if (Math.abs(roll) > maxProfileRoll) {
          angleValid = false;
        }
      }
    }

    // 7. Expression Validation (Smile condition)
    let expressionValid = true;
    if (spec.requiresSmile) {
      const minSmile = spec.minSmileScore ?? 0.25;
      if (faceResult.smileScore < minSmile) {
        expressionValid = false;
      }
    }

    // 8. Quality & Stability
    const exposureValid = rawLuminance >= modeConfig.minLuminance && rawLuminance <= modeConfig.maxLuminance;
    const sharpnessValid = rawSharpness >= modeConfig.minSharpness;
    const stabilityValid = isStable && motionScore < modeConfig.maxMotionScore;

    // --- CONTINUOUS ALIGNMENT SCORE CALCULATION (0 - 100) ---
    const centerNorm = Math.hypot(centerErrorX, centerErrorY) / spec.centerToleranceX;
    const centerScore = Math.max(0, Math.min(20, (1 - Math.min(1, centerNorm)) * 20));

    const yawNorm = yawErrorDeg / (spec.yawToleranceDeg * 1.5);
    const yawScore = Math.max(0, Math.min(20, (1 - Math.min(1, yawNorm)) * 20));

    const pitchNorm = pitchErrorDeg / (spec.pitchToleranceDeg * 1.5);
    const pitchScore = Math.max(0, Math.min(15, (1 - Math.min(1, pitchNorm)) * 15));

    const rollNorm = rollErrorDeg / (spec.rollToleranceDeg * 1.5);
    const rollScore = Math.max(0, Math.min(15, (1 - Math.min(1, rollNorm)) * 15));

    const distSpan = maxFaceRatio - minFaceRatio;
    const distNorm = Math.abs(faceRatio - targetRatio) / (distSpan / 2);
    const distanceScore = Math.max(0, Math.min(10, (1 - Math.min(1, distNorm)) * 10));

    const landmarkScore = isMediaPipe && lq ? Math.round(lq.confidence * 10) : (isFallbackAcceptable ? 8 : 0);
    const stabilityScore = stabilityValid ? 5 : 0;
    const expressionScore = expressionValid ? 5 : 0;

    let rawTotalScore =
      centerScore +
      yawScore +
      pitchScore +
      rollScore +
      distanceScore +
      landmarkScore +
      stabilityScore +
      expressionScore;

    // Cap score if unsupported non-MediaPipe fallback or missing critical data
    const engineEligible = isMediaPipe || isFallbackAcceptable;
    if (!engineEligible || (!isFallbackAcceptable && (!landmarksValid || !poseValid))) {
      rawTotalScore = Math.min(25, rawTotalScore);
    }

    const alignmentScore = Math.max(0, Math.min(100, Math.round(rawTotalScore)));

    // --- CAPTURE GATE (Mode-adaptive threshold) ---
    const allCriteriaMet =
      engineEligible &&
      (isMediaPipe ? (landmarksValid && poseValid) : isFallbackAcceptable) &&
      positionValid &&
      distanceValid &&
      angleValid &&
      expressionValid &&
      sharpnessValid &&
      exposureValid &&
      stabilityValid &&
      alignmentScore >= modeConfig.enterReadyScore;

    // --- SINGLE HIGHEST-PRIORITY CORRECTION & REJECTION REASON DETERMINATION ---
    const reasons: string[] = [];
    const blockingFactors: string[] = [];
    let correction: ClinicalAlignmentCorrection;
    let rejectionReason: string | undefined = undefined;

    if (!engineEligible || (!isFallbackAcceptable && !landmarksValid)) {
      reasons.push('LANDMARKS_UNRELIABLE');
      blockingFactors.push('LANDMARKS_UNRELIABLE');
      rejectionReason = 'Clarify face in guide / adjust lighting';
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.8,
        message: 'Clarify facial landmarks / Adjust lighting',
      };
    } else if (!isFallbackAcceptable && !poseValid) {
      reasons.push('POSE_UNRELIABLE');
      blockingFactors.push('POSE_UNRELIABLE');
      rejectionReason = 'Face camera directly';
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.8,
        message: 'Head pose uncertain / Face camera',
      };
    } else if (!positionValid) {
      blockingFactors.push('OFF_CENTER');
      if (Math.abs(centerErrorX) > spec.centerToleranceX) {
        const pct = Math.max(1, Math.round(Math.abs(centerErrorX) * 100));
        if (centerErrorX < 0) {
          reasons.push('ALIGN_FACE_RIGHT');
          rejectionReason = `Move face right ${pct}%`;
          correction = {
            direction: 'RIGHT',
            magnitude: Math.abs(centerErrorX),
            message: `MOVE RIGHT ${pct}%`,
          };
        } else {
          reasons.push('ALIGN_FACE_LEFT');
          rejectionReason = `Move face left ${pct}%`;
          correction = {
            direction: 'LEFT',
            magnitude: Math.abs(centerErrorX),
            message: `MOVE LEFT ${pct}%`,
          };
        }
      } else {
        const pct = Math.max(1, Math.round(Math.abs(centerErrorY) * 100));
        if (centerErrorY < 0) {
          reasons.push('ALIGN_FACE_DOWN');
          rejectionReason = `Move face down ${pct}%`;
          correction = {
            direction: 'DOWN',
            magnitude: Math.abs(centerErrorY),
            message: `MOVE DOWN ${pct}%`,
          };
        } else {
          reasons.push('ALIGN_FACE_UP');
          rejectionReason = `Move face up ${pct}%`;
          correction = {
            direction: 'UP',
            magnitude: Math.abs(centerErrorY),
            message: `MOVE UP ${pct}%`,
          };
        }
      }
    } else if (!distanceValid) {
      blockingFactors.push('DISTANCE_MISMATCH');
      if (faceRatio < minFaceRatio) {
        reasons.push('MOVE_CLOSER');
        rejectionReason = 'Move camera closer';
        correction = {
          direction: 'MOVE_CLOSER',
          magnitude: minFaceRatio - faceRatio,
          message: 'MOVE CLOSER',
        };
      } else {
        reasons.push('MOVE_BACK');
        rejectionReason = 'Move camera back';
        correction = {
          direction: 'MOVE_BACK',
          magnitude: faceRatio - maxFaceRatio,
          message: 'MOVE BACK',
        };
      }
    } else if (rollErrorDeg > spec.rollToleranceDeg) {
      const rollDeg = Math.max(1, Math.round(rollErrorDeg));
      reasons.push('LEVEL_HEAD');
      blockingFactors.push('HEAD_TILTED');
      rejectionReason = `Level head ${rollDeg}°`;
      correction = {
        direction: roll > spec.targetRollDeg ? 'ROTATE_LEFT' : 'ROTATE_RIGHT',
        magnitude: rollErrorDeg,
        message: `LEVEL HEAD ${rollDeg}°`,
      };
    } else if (yawErrorDeg > spec.yawToleranceDeg || (isProfileView && !angleValid)) {
      blockingFactors.push('ANGLE_MISMATCH');
      if (isProfileView) {
        if (currentView.id === 'RIGHT_PROFILE') {
          if (yaw < 82) {
            const deg = Math.max(1, Math.round(90 - yaw));
            reasons.push('TURN_PATIENT_RIGHT');
            rejectionReason = `Turn patient right ${deg}° (target 90°)`;
            correction = {
              direction: 'RIGHT',
              magnitude: 90 - yaw,
              message: `TURN RIGHT ${deg}°`,
            };
          } else {
            const deg = Math.max(1, Math.round(yaw - 90));
            reasons.push('TURN_PATIENT_LEFT');
            rejectionReason = `Turn patient left ${deg}° (target 90°)`;
            correction = {
              direction: 'LEFT',
              magnitude: yaw - 90,
              message: `TURN LEFT ${deg}°`,
            };
          }
        } else {
          // Left profile
          if (yaw > -82) {
            const deg = Math.max(1, Math.round(yaw + 90));
            reasons.push('TURN_PATIENT_LEFT');
            rejectionReason = `Turn patient left ${deg}° (target 90°)`;
            correction = {
              direction: 'LEFT',
              magnitude: yaw + 90,
              message: `TURN LEFT ${deg}°`,
            };
          } else {
            const deg = Math.max(1, Math.round(-90 - yaw));
            reasons.push('TURN_PATIENT_RIGHT');
            rejectionReason = `Turn patient right ${deg}° (target 90°)`;
            correction = {
              direction: 'RIGHT',
              magnitude: -90 - yaw,
              message: `TURN RIGHT ${deg}°`,
            };
          }
        }
      } else {
        const yawDeg = Math.max(1, Math.round(yawErrorDeg));
        if (yaw > spec.targetYawDeg) {
          reasons.push('TURN_HEAD_LEFT');
          rejectionReason = `Turn head left ${yawDeg}°`;
          correction = {
            direction: 'LEFT',
            magnitude: yawErrorDeg,
            message: `TURN LEFT ${yawDeg}°`,
          };
        } else {
          reasons.push('TURN_HEAD_RIGHT');
          rejectionReason = `Turn head right ${yawDeg}°`;
          correction = {
            direction: 'RIGHT',
            magnitude: yawErrorDeg,
            message: `TURN RIGHT ${yawDeg}°`,
          };
        }
      }
    } else if (pitchErrorDeg > spec.pitchToleranceDeg) {
      const pitchDeg = Math.max(1, Math.round(pitchErrorDeg));
      blockingFactors.push('CHIN_TILTED');
      if (pitch > spec.targetPitchDeg) {
        reasons.push('LOWER_CHIN');
        rejectionReason = `Lower chin ${pitchDeg}°`;
        correction = {
          direction: 'DOWN',
          magnitude: pitchErrorDeg,
          message: `LOWER CHIN ${pitchDeg}°`,
        };
      } else {
        reasons.push('RAISE_CHIN');
        rejectionReason = `Raise chin ${pitchDeg}°`;
        correction = {
          direction: 'UP',
          magnitude: pitchErrorDeg,
          message: `RAISE CHIN ${pitchDeg}°`,
        };
      }
    } else if (!expressionValid && spec.requiresSmile) {
      reasons.push('SMILE_REQUIRED');
      blockingFactors.push('SMILE_REQUIRED');
      rejectionReason = 'Smile naturally';
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.5,
        message: 'Smile naturally',
      };
    } else if (!sharpnessValid) {
      reasons.push('IMAGE_BLURRY');
      blockingFactors.push('IMAGE_BLURRY');
      rejectionReason = 'Hold steady to focus';
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.5,
        message: 'Hold steady to focus',
      };
    } else if (!exposureValid) {
      reasons.push('ADJUST_LIGHTING');
      blockingFactors.push('ADJUST_LIGHTING');
      rejectionReason = rawLuminance < modeConfig.minLuminance ? 'Too dark — add light' : 'Too bright';
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.5,
        message: 'Adjust lighting',
      };
    } else if (!stabilityValid) {
      reasons.push('HOLD_STILL');
      blockingFactors.push('MOTION_DETECTED');
      rejectionReason = 'Device motion — hold still';
      correction = {
        direction: 'HOLD_STILL',
        magnitude: motionScore / 100,
        message: 'HOLD STILL',
      };
    } else if (alignmentScore < modeConfig.enterReadyScore) {
      reasons.push('SCORE_TOO_LOW');
      blockingFactors.push('SCORE_TOO_LOW');
      rejectionReason = `Align closer to guide (${alignmentScore}/${modeConfig.enterReadyScore})`;
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.2,
        message: 'Fine-tune alignment',
      };
    } else {
      rejectionReason = undefined;
      correction = {
        direction: 'READY',
        magnitude: 0,
        message: 'HOLD STILL',
      };
    }

    return {
      detected: true,
      alignmentScore,
      centerErrorX,
      centerErrorY,
      yawErrorDeg,
      pitchErrorDeg,
      rollErrorDeg,
      distanceError,
      landmarksValid,
      poseValid,
      expressionValid,
      ready: allCriteriaMet,
      correction,
      breakdown: {
        centerScore,
        yawScore,
        pitchScore,
        rollScore,
        distanceScore,
        landmarkScore,
        stabilityScore,
        expressionScore,
      },
      reasons,
      rejectionReason,
      blockingFactors,
    };
  }
}
