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
import { ClinicalAlignmentEngine } from './ClinicalAlignmentEngine';

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
      minFaceHeightRatio: sensitivity === 'relaxed' ? 0.18 : sensitivity === 'high' ? 0.28 : 0.22,
      maxFaceHeightRatio: sensitivity === 'relaxed' ? 0.88 : sensitivity === 'high' ? 0.72 : 0.82,
      centerToleranceX: sensitivity === 'high' ? 0.12 : sensitivity === 'relaxed' ? 0.22 : 0.18,
      centerToleranceY: sensitivity === 'high' ? 0.12 : sensitivity === 'relaxed' ? 0.22 : 0.18,
      minLandmarkConfidence: 0.45,
      minPoseConfidence: 0.45,
      stableDurationMs: 600,
      requiresSmile: view.id === 'FRONTAL_SMILE' || view.id === 'RIGHT_OBLIQUE' || view.id === 'LEFT_OBLIQUE',
      minSmileScore: 0.25,
      requiresFaceLandmarks: view.category === 'extraoral',
    };

    const exposureValid = rawLuminance >= 35 && rawLuminance <= 240;
    const sharpnessValid = rawSharpness >= 18;
    const temporalStabilityValid = isStable && motionScore < 22;

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
      const alignRes = ClinicalAlignmentEngine.evaluate({
        faceResult,
        currentView: view,
        sensitivity,
        profileState: input.profileState,
        motionScore,
        isStable,
        rawLuminance,
        rawSharpness,
      });

      if (!faceResult || !faceResult.detected || faceResult.confidence < 0.3) {
        const readiness: CaptureReadiness = {
          ready: false,
          score: 0,
          positionValid: false,
          angleValid: false,
          distanceValid: false,
          frameSizeValid: false,
          stabilityValid: false,
          expressionValid: false,
          sharpnessValid,
          exposureValid,
          faceDetectionValid: false,
          landmarkQualityValid: false,
          poseQualityValid: false,
          temporalStabilityValid,
          highestPriorityCorrection: alignRes.correction.message,
          reasons: ['FACE_NOT_DETECTED'],
          confidence: 0,
        };

        return {
          isReady: false,
          readyScore: 0,
          alignmentScore: 0,
          alignmentCorrection: alignRes.correction,
          primaryMessage: alignRes.correction.message,
          highestPriorityCorrection: alignRes.correction.message,
          statusType: 'searching',
          positionValid: false,
          positionMessage: 'Face not detected',
          angleValid: false,
          angleMessage: 'Keep head upright',
          distanceValid: false,
          distanceMessage: 'Position patient',
          frameSizeValid: false,
          frameSizeMessage: 'Position patient',
          stabilityValid: false,
          stabilityMessage: 'Hold still',
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
          dominantReason: 'FACE_NOT_DETECTED',
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

      const positionValid =
        Math.abs(alignRes.centerErrorX) <= spec.centerToleranceX &&
        Math.abs(alignRes.centerErrorY) <= spec.centerToleranceY + 0.05;
      const frameSizeValid = alignRes.distanceError === 0;
      const distanceValid = frameSizeValid;
      const angleValid =
        alignRes.yawErrorDeg <= spec.yawToleranceDeg &&
        alignRes.pitchErrorDeg <= spec.pitchToleranceDeg &&
        alignRes.rollErrorDeg <= spec.rollToleranceDeg &&
        (!(view.id === 'RIGHT_PROFILE' || view.id === 'LEFT_PROFILE') ||
          (input.profileState?.isCaptureEligible === true && input.profileState?.isProfileAligned === true));
      const stabilityValid = temporalStabilityValid;

      const positionMessage = positionValid ? 'POSITION ✓' : alignRes.correction.message;
      const angleMessage = angleValid ? 'ANGLE ✓' : alignRes.correction.message;
      const frameSizeMessage = frameSizeValid ? 'FRAME SIZE ✓' : alignRes.correction.message;
      const stabilityMessage = stabilityValid ? 'STABILITY ✓' : 'HOLD STILL';

      const readiness: CaptureReadiness = {
        ready: alignRes.ready,
        score: alignRes.alignmentScore,
        positionValid,
        angleValid,
        distanceValid,
        frameSizeValid,
        stabilityValid,
        expressionValid: alignRes.expressionValid,
        sharpnessValid,
        exposureValid,
        faceDetectionValid: alignRes.detected && faceResult.confidence >= 0.35,
        landmarkQualityValid: alignRes.landmarksValid,
        poseQualityValid: alignRes.poseValid,
        temporalStabilityValid,
        highestPriorityCorrection: alignRes.correction.message,
        reasons: alignRes.reasons,
        confidence: (pose.confidence + landmarkQuality.confidence) / 2,
      };

      return {
        isReady: alignRes.ready,
        readyScore: alignRes.alignmentScore,
        alignmentScore: alignRes.alignmentScore,
        alignmentCorrection: alignRes.correction,
        primaryMessage: alignRes.ready ? 'READY — HOLD STILL' : alignRes.correction.message,
        highestPriorityCorrection: alignRes.correction.message,
        statusType: alignRes.ready ? 'ready' : 'adjust',
        positionValid,
        positionMessage,
        angleValid,
        angleMessage,
        distanceValid: frameSizeValid,
        distanceMessage: frameSizeMessage,
        frameSizeValid,
        frameSizeMessage,
        stabilityValid,
        stabilityMessage,
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
        dominantReason: alignRes.reasons[0] || 'READY',
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
        frameSizeValid: false,
        stabilityValid: false,
        expressionValid: false,
        sharpnessValid,
        exposureValid,
        faceDetectionValid: false,
        landmarkQualityValid: true,
        poseQualityValid: true,
        temporalStabilityValid,
        highestPriorityCorrection: 'ALIGN DENTAL ARCH',
        reasons: ['TEETH_NOT_DETECTED'],
        confidence: 0,
      };

      return {
        isReady: false,
        readyScore: 10,
        primaryMessage: 'Align dental arch in guide',
        highestPriorityCorrection: 'ALIGN DENTAL ARCH',
        statusType: 'searching',
        positionValid: false,
        positionMessage: 'Teeth not detected',
        angleValid: false,
        angleMessage: 'Position arch',
        distanceValid: false,
        distanceMessage: 'Adjust frame size',
        frameSizeValid: false,
        frameSizeMessage: 'Adjust frame size',
        stabilityValid: false,
        stabilityMessage: 'Hold still',
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
    const frameSizeValid = intra.archCoverageRatio >= 0.55 && intra.archCoverageRatio <= 1.2;
    const distanceValid = frameSizeValid;
    const angleValid = Math.abs(intra.occlusalPlaneTiltDeg) <= 8;
    const retractorValid = intra.retractorAdequate;
    const stabilityValid = temporalStabilityValid;

    const reasons: string[] = [];
    if (!midlineValid) reasons.push('CENTER_DENTAL_MIDLINE');
    if (!frameSizeValid) reasons.push(intra.archCoverageRatio < 0.55 ? 'MOVE_CLOSER' : 'MOVE_BACK');
    if (!angleValid) reasons.push('LEVEL_OCCLUSAL_PLANE');
    if (!retractorValid) reasons.push('PULL_RETRACTORS_OUTWARD');
    if (!sharpnessValid) reasons.push('IMAGE_BLURRY');
    if (!exposureValid) reasons.push('ADJUST_LIGHTING');
    if (!stabilityValid) reasons.push('HOLD_STILL');

    const allValid =
      midlineValid &&
      frameSizeValid &&
      angleValid &&
      retractorValid &&
      sharpnessValid &&
      exposureValid &&
      stabilityValid;

    const score = Math.round(
      (midlineValid ? 25 : 5) +
      (frameSizeValid ? 25 : 5) +
      (angleValid ? 20 : 5) +
      (retractorValid ? 15 : 0) +
      (stabilityValid ? 15 : 0)
    );

    let primaryMessage = 'Adjust Intraoral Alignment';
    let highestPriorityCorrection = 'ADJUST ALIGNMENT';

    if (allValid) {
      primaryMessage = 'READY — HOLD STILL';
      highestPriorityCorrection = 'READY — HOLD STILL';
    } else if (!stabilityValid) {
      primaryMessage = 'Hold steady (device motion detected)';
      highestPriorityCorrection = 'HOLD STILL';
    } else if (!retractorValid) {
      primaryMessage = 'Pull cheek retractors outward';
      highestPriorityCorrection = 'PULL RETRACTORS OUTWARD';
    } else if (!midlineValid) {
      primaryMessage = 'Center dental midline';
      highestPriorityCorrection = 'CENTER MIDLINE';
    } else if (!frameSizeValid) {
      primaryMessage = intra.archCoverageRatio < 0.55 ? 'Move closer' : 'Move back';
      highestPriorityCorrection = intra.archCoverageRatio < 0.55 ? 'MOVE CLOSER' : 'MOVE BACK';
    } else if (!angleValid) {
      primaryMessage = 'Level occlusal plane horizontally';
      highestPriorityCorrection = 'LEVEL OCCLUSAL PLANE';
    }

    const positionMessage = midlineValid ? 'POSITION ✓' : 'CENTER MIDLINE';
    const angleMessage = angleValid ? 'ANGLE ✓' : 'LEVEL PLANE';
    const frameSizeMessage = frameSizeValid ? 'FRAME SIZE ✓' : (intra.archCoverageRatio < 0.55 ? 'MOVE CLOSER' : 'MOVE BACK');
    const stabilityMessage = stabilityValid ? 'STABILITY ✓' : 'HOLD STILL';

    const readiness: CaptureReadiness = {
      ready: allValid,
      score,
      positionValid: midlineValid,
      angleValid,
      distanceValid,
      frameSizeValid,
      stabilityValid,
      expressionValid: retractorValid,
      sharpnessValid,
      exposureValid,
      faceDetectionValid: true,
      landmarkQualityValid: true,
      poseQualityValid: true,
      temporalStabilityValid,
      highestPriorityCorrection,
      reasons,
      confidence: intra.confidence,
    };

    return {
      isReady: allValid,
      readyScore: score,
      primaryMessage,
      highestPriorityCorrection,
      statusType: allValid ? 'ready' : 'adjust',
      positionValid: midlineValid,
      positionMessage,
      angleValid,
      angleMessage,
      distanceValid: frameSizeValid,
      distanceMessage: frameSizeMessage,
      frameSizeValid,
      frameSizeMessage,
      stabilityValid,
      stabilityMessage,
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
