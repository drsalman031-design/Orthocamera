import {
  OrthodonticViewDefinition,
  ViewCaptureSpec,
} from '../types';
import { FaceAnalysisResult } from './FaceAnalyzer';
import { ProfileStateResult } from './ProfileFallbackEngine';

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
}

export interface ClinicalAlignmentInput {
  faceResult?: FaceAnalysisResult | null;
  currentView: OrthodonticViewDefinition;
  frameWidth?: number;
  frameHeight?: number;
  sensitivity?: 'high' | 'medium' | 'relaxed';
  profileState?: ProfileStateResult | null;
  motionScore?: number;
  isStable?: boolean;
  rawLuminance?: number;
  rawSharpness?: number;
}

export class ClinicalAlignmentEngine {
  /**
   * Evaluates extraoral face landmark geometry strictly using MediaPipe as the single source of truth.
   * Returns continuous alignment scoring, exact geometric deviations, and prioritized clinical guidance.
   */
  public static evaluate(input: ClinicalAlignmentInput): ClinicalAlignmentResult {
    const {
      faceResult,
      currentView,
      sensitivity = 'medium',
      profileState,
      motionScore = 0,
      isStable = false,
      rawLuminance = 130,
      rawSharpness = 85,
    } = input;

    // View-specific target specifications
    const spec: ViewCaptureSpec = currentView.captureSpec || {
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
      };
    }

    // 1. Strict MediaPipe Engine Gating
    const isMediaPipe = faceResult.aiEngine === 'mediapipe';
    const isProfileView = currentView.id === 'RIGHT_PROFILE' || currentView.id === 'LEFT_PROFILE';

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
    const landmarksValid =
      isMediaPipe &&
      !!lq &&
      lq.available &&
      (isProfileView || lq.requiredLandmarksPresent) &&
      hasRequiredPoints &&
      lq.confidence >= (isProfileView ? 0.35 : spec.minLandmarkConfidence);

    // 3. Head Pose Extraction Validation
    const pose = faceResult.pose;
    const isPoseAvailable =
      !!pose &&
      pose.source !== 'unavailable' &&
      pose.yawDeg !== null &&
      pose.pitchDeg !== null &&
      pose.rollDeg !== null;

    const poseValid = isMediaPipe && isPoseAvailable && (pose?.confidence ?? 0) >= spec.minPoseConfidence;

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
    const targetRatio = (spec.minFaceHeightRatio + spec.maxFaceHeightRatio) / 2;
    const distanceError =
      faceRatio < spec.minFaceHeightRatio
        ? spec.minFaceHeightRatio - faceRatio
        : faceRatio > spec.maxFaceHeightRatio
        ? faceRatio - spec.maxFaceHeightRatio
        : 0;
    const distanceValid = faceRatio >= spec.minFaceHeightRatio && faceRatio <= spec.maxFaceHeightRatio;

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
        angleValid = profileState.isProfileAligned;
      } else {
        if (currentView.id === 'RIGHT_PROFILE') {
          if (yaw < 68 || yaw > 100) {
            angleValid = false;
          }
        } else {
          if (yaw > -68 || yaw < -100) {
            angleValid = false;
          }
        }
        if (Math.abs(roll) > 8) {
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
    const exposureValid = rawLuminance >= 35 && rawLuminance <= 240;
    const sharpnessValid = rawSharpness >= 18;
    const stabilityValid = isStable && motionScore < 22;

    // --- CONTINUOUS ALIGNMENT SCORE CALCULATION (0 - 100) ---
    const centerNorm = Math.hypot(centerErrorX, centerErrorY) / spec.centerToleranceX;
    const centerScore = Math.max(0, Math.min(20, (1 - Math.min(1, centerNorm)) * 20));

    const yawNorm = yawErrorDeg / (spec.yawToleranceDeg * 1.5);
    const yawScore = Math.max(0, Math.min(20, (1 - Math.min(1, yawNorm)) * 20));

    const pitchNorm = pitchErrorDeg / (spec.pitchToleranceDeg * 1.5);
    const pitchScore = Math.max(0, Math.min(15, (1 - Math.min(1, pitchNorm)) * 15));

    const rollNorm = rollErrorDeg / (spec.rollToleranceDeg * 1.5);
    const rollScore = Math.max(0, Math.min(15, (1 - Math.min(1, rollNorm)) * 15));

    const distSpan = spec.maxFaceHeightRatio - spec.minFaceHeightRatio;
    const distNorm = Math.abs(faceRatio - targetRatio) / (distSpan / 2);
    const distanceScore = Math.max(0, Math.min(10, (1 - Math.min(1, distNorm)) * 10));

    const landmarkScore = isMediaPipe && lq ? Math.round(lq.confidence * 10) : 0;
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

    // Cap score if non-MediaPipe fallback or missing critical data
    if (!isMediaPipe || !landmarksValid || !poseValid) {
      rawTotalScore = Math.min(25, rawTotalScore);
    }

    const alignmentScore = Math.max(0, Math.min(100, Math.round(rawTotalScore)));

    // --- STRICT CAPTURE GATE ---
    const allCriteriaMet =
      isMediaPipe &&
      landmarksValid &&
      poseValid &&
      positionValid &&
      distanceValid &&
      angleValid &&
      expressionValid &&
      sharpnessValid &&
      exposureValid &&
      stabilityValid &&
      alignmentScore >= 80;

    // --- SINGLE HIGHEST-PRIORITY CORRECTION DETERMINATION ---
    const reasons: string[] = [];
    let correction: ClinicalAlignmentCorrection;

    if (!isMediaPipe || !landmarksValid) {
      reasons.push('LANDMARKS_UNRELIABLE');
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.8,
        message: 'Clarify facial landmarks / Adjust lighting',
      };
    } else if (!poseValid) {
      reasons.push('POSE_UNRELIABLE');
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.8,
        message: 'Head pose uncertain / Face camera',
      };
    } else if (!positionValid) {
      if (Math.abs(centerErrorX) > spec.centerToleranceX) {
        if (centerErrorX < 0) {
          reasons.push('ALIGN_FACE_RIGHT');
          correction = {
            direction: 'RIGHT',
            magnitude: Math.abs(centerErrorX),
            message: 'MOVE RIGHT',
          };
        } else {
          reasons.push('ALIGN_FACE_LEFT');
          correction = {
            direction: 'LEFT',
            magnitude: Math.abs(centerErrorX),
            message: 'MOVE LEFT',
          };
        }
      } else {
        if (centerErrorY < 0) {
          reasons.push('ALIGN_FACE_DOWN');
          correction = {
            direction: 'DOWN',
            magnitude: Math.abs(centerErrorY),
            message: 'MOVE DOWN',
          };
        } else {
          reasons.push('ALIGN_FACE_UP');
          correction = {
            direction: 'UP',
            magnitude: Math.abs(centerErrorY),
            message: 'MOVE UP',
          };
        }
      }
    } else if (!distanceValid) {
      if (faceRatio < spec.minFaceHeightRatio) {
        reasons.push('MOVE_CLOSER');
        correction = {
          direction: 'MOVE_CLOSER',
          magnitude: spec.minFaceHeightRatio - faceRatio,
          message: 'MOVE CLOSER',
        };
      } else {
        reasons.push('MOVE_BACK');
        correction = {
          direction: 'MOVE_BACK',
          magnitude: faceRatio - spec.maxFaceHeightRatio,
          message: 'MOVE BACK',
        };
      }
    } else if (rollErrorDeg > spec.rollToleranceDeg) {
      if (roll > spec.targetRollDeg) {
        reasons.push('ROTATE_LEFT');
        correction = {
          direction: 'ROTATE_LEFT',
          magnitude: rollErrorDeg,
          message: 'ROTATE LEFT',
        };
      } else {
        reasons.push('ROTATE_RIGHT');
        correction = {
          direction: 'ROTATE_RIGHT',
          magnitude: rollErrorDeg,
          message: 'ROTATE RIGHT',
        };
      }
    } else if (yawErrorDeg > spec.yawToleranceDeg || (isProfileView && !angleValid)) {
      if (isProfileView) {
        if (currentView.id === 'RIGHT_PROFILE') {
          if (yaw < 82) {
            reasons.push('TURN_PATIENT_RIGHT');
            correction = {
              direction: 'RIGHT',
              magnitude: 90 - yaw,
              message: 'TURN RIGHT (90° Profile)',
            };
          } else {
            reasons.push('TURN_PATIENT_LEFT');
            correction = {
              direction: 'LEFT',
              magnitude: yaw - 90,
              message: 'TURN LEFT (90° Profile)',
            };
          }
        } else {
          // Left profile
          if (yaw > -82) {
            reasons.push('TURN_PATIENT_LEFT');
            correction = {
              direction: 'LEFT',
              magnitude: yaw + 90,
              message: 'TURN LEFT (90° Profile)',
            };
          } else {
            reasons.push('TURN_PATIENT_RIGHT');
            correction = {
              direction: 'RIGHT',
              magnitude: -90 - yaw,
              message: 'TURN RIGHT (90° Profile)',
            };
          }
        }
      } else {
        if (yaw > spec.targetYawDeg) {
          reasons.push('TURN_HEAD_LEFT');
          correction = {
            direction: 'LEFT',
            magnitude: yawErrorDeg,
            message: 'ROTATE LEFT',
          };
        } else {
          reasons.push('TURN_HEAD_RIGHT');
          correction = {
            direction: 'RIGHT',
            magnitude: yawErrorDeg,
            message: 'ROTATE RIGHT',
          };
        }
      }
    } else if (pitchErrorDeg > spec.pitchToleranceDeg) {
      if (pitch > spec.targetPitchDeg) {
        reasons.push('LOWER_CHIN');
        correction = {
          direction: 'DOWN',
          magnitude: pitchErrorDeg,
          message: 'LOWER CHIN',
        };
      } else {
        reasons.push('RAISE_CHIN');
        correction = {
          direction: 'UP',
          magnitude: pitchErrorDeg,
          message: 'RAISE CHIN',
        };
      }
    } else if (!expressionValid && spec.requiresSmile) {
      reasons.push('SMILE_REQUIRED');
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.5,
        message: 'Instruct patient to smile naturally',
      };
    } else if (!sharpnessValid) {
      reasons.push('IMAGE_BLURRY');
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.5,
        message: 'Hold steady to focus',
      };
    } else if (!exposureValid) {
      reasons.push('ADJUST_LIGHTING');
      correction = {
        direction: 'HOLD_STILL',
        magnitude: 0.5,
        message: 'Adjust lighting',
      };
    } else if (!stabilityValid) {
      reasons.push('HOLD_STEADY');
      correction = {
        direction: 'HOLD_STILL',
        magnitude: motionScore / 100,
        message: 'Hold steady (device motion)',
      };
    } else {
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
    };
  }
}
