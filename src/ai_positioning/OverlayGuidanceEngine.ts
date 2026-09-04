import {
  CaptureReadiness,
  FacePose,
  LandmarkQuality,
  LiveGuidanceState,
  OrthodonticViewDefinition,
  TemporalStability,
  ViewCaptureSpec,
} from '../types';
import { FaceAnalysisResult } from './FaceAnalyzer';
import { IntraoralAnalysisResult } from './IntraoralAnalyzer';
import { ProfileStateResult } from './ProfileFallbackEngine';

export interface GuidanceEvaluationInput {
  view: OrthodonticViewDefinition;
  faceResult?: FaceAnalysisResult | null;
  intraoralResult?: IntraoralAnalysisResult | null;
  profileState?: ProfileStateResult | null;
  rawLuminance?: number;
  rawSharpness?: number;
  motionScore?: number;
  isStable?: boolean;
  sensitivity?: 'high' | 'medium' | 'relaxed';
}

export class OverlayGuidanceEngine {
  public static evaluate(input: GuidanceEvaluationInput): LiveGuidanceState {
    const {
      view,
      faceResult,
      intraoralResult,
      rawLuminance = 130,
      rawSharpness = 85,
      motionScore = 0,
      isStable = false,
      sensitivity = 'medium',
    } = input;

    // Spec defaults if not present
    const spec: ViewCaptureSpec = view.captureSpec || {
      targetYawDeg: 0,
      yawToleranceDeg: sensitivity === 'high' ? 5 : sensitivity === 'relaxed' ? 10 : 7,
      targetPitchDeg: 0,
      pitchToleranceDeg: sensitivity === 'high' ? 5 : sensitivity === 'relaxed' ? 10 : 7,
      targetRollDeg: 0,
      rollToleranceDeg: sensitivity === 'high' ? 3 : sensitivity === 'relaxed' ? 7 : 5,
      minFaceHeightRatio: sensitivity === 'relaxed' ? 0.28 : sensitivity === 'high' ? 0.38 : 0.32,
      maxFaceHeightRatio: sensitivity === 'relaxed' ? 0.80 : sensitivity === 'high' ? 0.68 : 0.75,
      centerToleranceX: sensitivity === 'high' ? 0.10 : sensitivity === 'relaxed' ? 0.20 : 0.15,
      centerToleranceY: sensitivity === 'high' ? 0.10 : sensitivity === 'relaxed' ? 0.20 : 0.15,
      minLandmarkConfidence: 0.5,
      minPoseConfidence: 0.5,
      stableDurationMs: 600,
      requiresSmile: view.id === 'FRONTAL_SMILE' || view.id === 'RIGHT_OBLIQUE' || view.id === 'LEFT_OBLIQUE',
      minSmileScore: 0.28,
      requiresFaceLandmarks: view.category === 'extraoral',
    };

    const exposureValid = rawLuminance >= 60 && rawLuminance <= 220;
    const sharpnessValid = rawSharpness >= 45;
    const temporalStabilityValid = isStable && motionScore < 18;

    const temporalStability: TemporalStability = {
      stable: temporalStabilityValid,
      durationMs: temporalStabilityValid ? 600 : 0,
      positionJitter: motionScore / 100,
      yawJitterDeg: 0,
      pitchJitterDeg: 0,
      rollJitterDeg: 0,
      confidence: temporalStabilityValid ? 0.9 : 0.2,
    };

    // --- 1. EXTRAORAL PHOTOGRAPHS GUIDANCE ---
    if (view.category === 'extraoral') {
      if (!faceResult || !faceResult.detected || faceResult.confidence < 0.3) {
        const readiness: CaptureReadiness = {
          ready: false,
          score: 10,
          positionValid: false,
          angleValid: false,
          distanceValid: false,
          expressionValid: false,
          sharpnessValid,
          exposureValid,
          faceDetectionValid: false,
          landmarkQualityValid: false,
          poseQualityValid: false,
          temporalStabilityValid,
          reasons: ['FACE_NOT_DETECTED'],
          confidence: 0,
        };

        return {
          isReady: false,
          readyScore: 10,
          primaryMessage: 'Align patient face in guide',
          statusType: 'searching',
          positionValid: false,
          positionMessage: 'Face not detected',
          angleValid: false,
          angleMessage: 'Keep head upright',
          distanceValid: false,
          distanceMessage: 'Position patient',
          sharpnessValid,
          exposureValid,
          headRollDeg: 0,
          headYawDeg: 0,
          headPitchDeg: 0,
          centeringDeltaX: 0,
          centeringDeltaY: 0,
          coverageRatio: 0,
          brightnessScore: rawLuminance,
          sharpnessScore: rawSharpness,
          motionScore,
          isStable,
          readiness,
          dominantReason: 'Align patient face in frame',
        };
      }

      const deltaX = faceResult.center.x - 0.5;
      const deltaY = faceResult.center.y - 0.45;
      const roll = faceResult.rollDeg;
      const yaw = faceResult.yawDeg;
      const pitch = faceResult.pitchDeg;
      const faceRatio = faceResult.faceHeightRatio;

      const pose: FacePose = faceResult.pose || {
        yawDeg: null,
        pitchDeg: null,
        rollDeg: null,
        confidence: 0,
        source: 'unavailable',
      };
      const landmarkQuality: LandmarkQuality = faceResult.landmarkQuality || {
        available: false,
        landmarkCount: 0,
        requiredLandmarksPresent: false,
        symmetryScore: 0,
        geometryScore: 0,
        confidence: 0,
      };

      // 1. High-Quality Detector Check: MediaPipe is the strict source for clinical extraoral capture
      const isHighQualityDetector = faceResult.aiEngine === 'mediapipe';

      // 2. Face Detection Validity Check
      const faceDetectionValid = faceResult.detected && faceResult.confidence >= 0.35;

      // 3. Complete Anatomical Landmarks Check
      const hasRequiredPoints = !!(
        faceResult.landmarks &&
        faceResult.landmarks.leftEye &&
        faceResult.landmarks.rightEye &&
        faceResult.landmarks.noseTip &&
        faceResult.landmarks.mouthCenter &&
        faceResult.landmarks.chinTip
      );

      // 4. Landmark Quality Check
      const landmarkQualityValid = spec.requiresFaceLandmarks
        ? isHighQualityDetector &&
          landmarkQuality.available &&
          landmarkQuality.requiredLandmarksPresent &&
          hasRequiredPoints &&
          landmarkQuality.confidence >= spec.minLandmarkConfidence
        : true;

      // 5. Pose Quality Check
      const isPoseAvailable =
        pose.source !== 'unavailable' &&
        pose.yawDeg !== null &&
        pose.pitchDeg !== null &&
        pose.rollDeg !== null;

      const poseQualityValid =
        isHighQualityDetector &&
        isPoseAvailable &&
        pose.confidence >= spec.minPoseConfidence;

      // 6. Position / Centering Check
      const positionValid =
        Math.abs(deltaX) <= spec.centerToleranceX &&
        Math.abs(deltaY) <= spec.centerToleranceY + 0.05;

      let positionMessage = 'Position ✓';
      if (!positionValid) {
        if (Math.abs(deltaX) > spec.centerToleranceX) {
          positionMessage = deltaX > 0 ? 'Move camera right / Center face' : 'Move camera left / Center face';
        } else {
          positionMessage = deltaY > 0 ? 'Move camera up' : 'Move camera down';
        }
      }

      // 7. Distance Check
      const distanceValid = faceRatio >= spec.minFaceHeightRatio && faceRatio <= spec.maxFaceHeightRatio;
      let distanceMessage = 'Distance ✓';
      if (!distanceValid) {
        distanceMessage = faceRatio < spec.minFaceHeightRatio ? 'Move closer' : 'Step back';
      }

      // 8. Angle / Pose Check against View Target
      let angleValid = true;
      let angleMessage = 'Angle ✓';

      const rollError = Math.abs(roll - spec.targetRollDeg);
      const yawError = Math.abs(yaw - spec.targetYawDeg);
      const pitchError = Math.abs(pitch - spec.targetPitchDeg);

      if (rollError > spec.rollToleranceDeg) {
        angleValid = false;
        angleMessage = roll > spec.targetRollDeg ? 'Level head (tilt left)' : 'Level head (tilt right)';
      } else if (yawError > spec.yawToleranceDeg) {
        angleValid = false;
        angleMessage = yaw > spec.targetYawDeg ? 'Turn head slightly left' : 'Turn head slightly right';
      } else if (pitchError > spec.pitchToleranceDeg) {
        angleValid = false;
        angleMessage = pitch > spec.targetPitchDeg ? 'Lower chin slightly' : 'Raise chin slightly';
      }

      // Lateral Profile Validation: When input.profileState is provided, enforce its state and capture eligibility
      if (input.profileState && (view.id === 'RIGHT_PROFILE' || view.id === 'LEFT_PROFILE')) {
        if (!input.profileState.isCaptureEligible || !input.profileState.isProfileAligned) {
          angleValid = false;
          angleMessage = input.profileState.guidanceMessage;
        }
      }

      // 9. Expression Check
      let expressionValid = true;
      if (spec.requiresSmile) {
        const minSmile = spec.minSmileScore ?? 0.28;
        if (faceResult.smileScore < minSmile) {
          expressionValid = false;
        }
      }

      // Aggregate Readiness Reasons (prioritized)
      const reasons: string[] = [];
      if (!faceDetectionValid) reasons.push('FACE_NOT_DETECTED');
      if (!landmarkQualityValid) reasons.push('LANDMARKS_UNRELIABLE');
      if (!poseQualityValid) reasons.push('POSE_UNRELIABLE');
      if (input.profileState && (view.id === 'RIGHT_PROFILE' || view.id === 'LEFT_PROFILE') && input.profileState.state === 'TEMPORARILY_LOST') {
        reasons.push('TRACKING_LOST');
      }
      if (!positionValid) reasons.push(deltaX > 0 ? 'MOVE_CAMERA_RIGHT' : 'MOVE_CAMERA_LEFT');
      if (!distanceValid) reasons.push(faceRatio < spec.minFaceHeightRatio ? 'MOVE_CLOSER' : 'STEP_BACK');
      if (!angleValid) reasons.push(angleMessage.toUpperCase().replace(/\s+/g, '_'));
      if (!expressionValid) reasons.push('SMILE_REQUIRED');
      if (!sharpnessValid) reasons.push('IMAGE_BLURRY');
      if (!exposureValid) reasons.push('ADJUST_LIGHTING');
      if (!temporalStabilityValid) reasons.push('HOLD_STILL');

      const allValid =
        faceDetectionValid &&
        landmarkQualityValid &&
        poseQualityValid &&
        positionValid &&
        distanceValid &&
        angleValid &&
        expressionValid &&
        sharpnessValid &&
        exposureValid &&
        temporalStabilityValid;

      const score = Math.round(
        (faceDetectionValid ? 15 : 0) +
        (landmarkQualityValid ? 15 : 0) +
        (poseQualityValid ? 15 : 0) +
        (positionValid ? 15 : 0) +
        (distanceValid ? 10 : 0) +
        (angleValid ? 15 : 0) +
        (expressionValid ? 10 : 0) +
        (temporalStabilityValid ? 5 : 0)
      );

      const readiness: CaptureReadiness = {
        ready: allValid,
        score,
        positionValid,
        angleValid,
        distanceValid,
        expressionValid,
        sharpnessValid,
        exposureValid,
        faceDetectionValid,
        landmarkQualityValid,
        poseQualityValid,
        temporalStabilityValid,
        reasons,
        confidence: (pose.confidence + landmarkQuality.confidence) / 2,
      };

      // Determine clean primary UI message
      let primaryMessage = 'Adjust Alignment';
      if (allValid) {
        primaryMessage = 'CAPTURE READY — HOLD STILL';
      } else if (input.profileState && (view.id === 'RIGHT_PROFILE' || view.id === 'LEFT_PROFILE') && !input.profileState.isCaptureEligible) {
        primaryMessage = input.profileState.guidanceMessage;
      } else if (!temporalStabilityValid && isStable === false && motionScore > 20) {
        primaryMessage = 'Hold steady (device motion detected)';
      } else if (!expressionValid && spec.requiresSmile) {
        primaryMessage = 'Instruct patient to smile naturally';
      } else if (!positionValid) {
        primaryMessage = positionMessage;
      } else if (!distanceValid) {
        primaryMessage = distanceMessage;
      } else if (!angleValid) {
        primaryMessage = angleMessage;
      }

      return {
        isReady: allValid,
        readyScore: score,
        primaryMessage,
        statusType: allValid ? 'ready' : 'adjust',
        positionValid,
        positionMessage,
        angleValid,
        angleMessage,
        distanceValid,
        distanceMessage,
        sharpnessValid,
        exposureValid,
        headRollDeg: roll,
        headYawDeg: yaw,
        headPitchDeg: pitch,
        centeringDeltaX: deltaX,
        centeringDeltaY: deltaY,
        coverageRatio: faceRatio,
        brightnessScore: rawLuminance,
        sharpnessScore: rawSharpness,
        motionScore,
        isStable,
        isExtraoralDetected: true,
        aiEngine: faceResult.aiEngine || 'chroma',
        meshContours: faceResult.meshContours,
        smileIntensity: faceResult.smileScore,
        detectedFaceLandmarks: faceResult.landmarks,
        readiness,
        pose,
        landmarkQuality,
        temporalStability,
        dominantReason: reasons[0] || 'READY',
      };
    }

    // --- 2. INTRAORAL PHOTOGRAPHS GUIDANCE ---
    const intra = intraoralResult;
    if (!intra || !intra.detected) {
      const readiness: CaptureReadiness = {
        ready: false,
        score: 10,
        positionValid: false,
        angleValid: false,
        distanceValid: false,
        expressionValid: false,
        sharpnessValid,
        exposureValid,
        faceDetectionValid: false,
        landmarkQualityValid: true,
        poseQualityValid: true,
        temporalStabilityValid,
        reasons: ['TEETH_NOT_DETECTED'],
        confidence: 0,
      };

      return {
        isReady: false,
        readyScore: 10,
        primaryMessage: 'Align dental arch in guide',
        statusType: 'searching',
        positionValid: false,
        positionMessage: 'Teeth not detected',
        angleValid: false,
        angleMessage: 'Position arch',
        distanceValid: false,
        distanceMessage: 'Adjust distance',
        sharpnessValid,
        exposureValid,
        headRollDeg: 0,
        headYawDeg: 0,
        headPitchDeg: 0,
        centeringDeltaX: 0,
        centeringDeltaY: 0,
        coverageRatio: 0,
        brightnessScore: rawLuminance,
        sharpnessScore: rawSharpness,
        motionScore,
        isStable,
        readiness,
        dominantReason: 'Align dental arch in frame',
      };
    }

    const midlineValid = view.id !== 'ANTERIOR_INTRAORAL' || Math.abs(intra.dentalMidlineOffset) <= 0.25;
    const distanceValid = intra.archCoverageRatio >= 0.55 && intra.archCoverageRatio <= 1.2;
    const angleValid = Math.abs(intra.occlusalPlaneTiltDeg) <= 8;
    const retractorValid = intra.retractorAdequate;

    const reasons: string[] = [];
    if (!midlineValid) reasons.push('CENTER_DENTAL_MIDLINE');
    if (!distanceValid) reasons.push(intra.archCoverageRatio < 0.55 ? 'MOVE_CLOSER' : 'INCREASE_DISTANCE');
    if (!angleValid) reasons.push('LEVEL_OCCLUSAL_PLANE');
    if (!retractorValid) reasons.push('PULL_RETRACTORS_OUTWARD');
    if (!sharpnessValid) reasons.push('IMAGE_BLURRY');
    if (!exposureValid) reasons.push('ADJUST_LIGHTING');
    if (!temporalStabilityValid) reasons.push('HOLD_STILL');

    const allValid =
      midlineValid &&
      distanceValid &&
      angleValid &&
      retractorValid &&
      sharpnessValid &&
      exposureValid &&
      temporalStabilityValid;

    const score = Math.round(
      (midlineValid ? 25 : 5) +
      (distanceValid ? 25 : 5) +
      (angleValid ? 20 : 5) +
      (retractorValid ? 15 : 0) +
      (temporalStabilityValid ? 15 : 0)
    );

    const readiness: CaptureReadiness = {
      ready: allValid,
      score,
      positionValid: midlineValid,
      angleValid,
      distanceValid,
      expressionValid: retractorValid,
      sharpnessValid,
      exposureValid,
      faceDetectionValid: true,
      landmarkQualityValid: true,
      poseQualityValid: true,
      temporalStabilityValid,
      reasons,
      confidence: intra.confidence,
    };

    let primaryMessage = 'Adjust Intraoral Alignment';
    if (allValid) {
      primaryMessage = 'CAPTURE READY — HOLD STILL';
    } else if (!temporalStabilityValid) {
      primaryMessage = 'Hold steady (device motion detected)';
    } else if (!retractorValid) {
      primaryMessage = 'Pull cheek retractors outward';
    } else if (!midlineValid) {
      primaryMessage = 'Center maxillary dental midline';
    } else if (!distanceValid) {
      primaryMessage = intra.archCoverageRatio < 0.55 ? 'Move camera closer to teeth' : 'Increase distance';
    } else if (!angleValid) {
      primaryMessage = 'Level occlusal plane horizontally';
    }

    return {
      isReady: allValid,
      readyScore: score,
      primaryMessage,
      statusType: allValid ? 'ready' : 'adjust',
      positionValid: midlineValid,
      positionMessage: midlineValid ? 'Position ✓' : 'Center dental midline',
      angleValid,
      angleMessage: angleValid ? 'Angle ✓' : 'Level occlusal plane',
      distanceValid,
      distanceMessage: distanceValid ? 'Distance ✓' : 'Adjust distance',
      sharpnessValid,
      exposureValid,
      headRollDeg: intra.occlusalPlaneTiltDeg,
      headYawDeg: 0,
      headPitchDeg: 0,
      centeringDeltaX: intra.dentalMidlineOffset,
      centeringDeltaY: 0,
      coverageRatio: intra.archCoverageRatio,
      brightnessScore: intra.intraoralExposureScore || rawLuminance,
      sharpnessScore: intra.toothRegionSharpness || rawSharpness,
      motionScore,
      isStable,
      isIntraoralDetected: true,
      aiEngine: intra.aiEngine || 'chroma',
      readiness,
      temporalStability,
      dominantReason: reasons[0] || 'READY',
    };
  }
}
