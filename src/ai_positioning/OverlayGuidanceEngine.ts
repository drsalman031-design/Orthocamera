import { LiveGuidanceState, OrthodonticViewDefinition } from '../types';
import { FaceAnalysisResult } from './FaceAnalyzer';
import { IntraoralAnalysisResult } from './IntraoralAnalyzer';

export interface GuidanceEvaluationInput {
  view: OrthodonticViewDefinition;
  faceResult?: FaceAnalysisResult | null;
  intraoralResult?: IntraoralAnalysisResult | null;
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
      isStable = true,
      sensitivity = 'medium',
    } = input;

    const res = this.evaluateInternal({
      view,
      faceResult,
      intraoralResult,
      rawLuminance,
      rawSharpness,
      motionScore,
      isStable,
      sensitivity,
    });
    res.motionScore = motionScore;
    res.isStable = isStable;
    return res;
  }

  private static evaluateInternal(input: GuidanceEvaluationInput): LiveGuidanceState {
    const {
      view,
      faceResult,
      intraoralResult,
      rawLuminance = 130,
      rawSharpness = 85,
      sensitivity = 'medium',
    } = input;

    // Threshold tolerances depending on sensitivity mode
    const posTolerance = sensitivity === 'high' ? 0.08 : sensitivity === 'relaxed' ? 0.18 : 0.12;
    const angleTolerance = sensitivity === 'high' ? 3.5 : sensitivity === 'relaxed' ? 8.0 : 5.5;
    // Adjusted for clinical portrait distance (arm length / 1-1.5 meters)
    const distanceMinRatio = sensitivity === 'relaxed' ? 0.24 : sensitivity === 'high' ? 0.34 : 0.28;
    const distanceMaxRatio = sensitivity === 'relaxed' ? 0.82 : sensitivity === 'high' ? 0.70 : 0.76;

    // Default exposure & sharpness validity
    const exposureValid = rawLuminance >= 60 && rawLuminance <= 220;
    const sharpnessValid = rawSharpness >= 50;

    // --- 1. EXTRAORAL PHOTOGRAPHS GUIDANCE ---
    if (view.category === 'extraoral' && faceResult) {
      if (!faceResult.detected) {
        return {
          isReady: false,
          readyScore: 15,
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
        };
      }

      const deltaX = faceResult.center.x - 0.5;
      const deltaY = faceResult.center.y - 0.45;
      const roll = faceResult.rollDeg;
      const yaw = faceResult.yawDeg;
      const pitch = faceResult.pitchDeg;
      const faceRatio = faceResult.faceHeightRatio;

      let positionValid = true;
      let positionMessage = 'Position ✓';
      let angleValid = true;
      let angleMessage = 'Angle ✓';
      let distanceValid = true;
      let distanceMessage = 'Distance ✓';
      let primaryMessage = 'Hold steady';

      // Distance check
      if (faceRatio < distanceMinRatio) {
        distanceValid = false;
        distanceMessage = 'Move closer';
        primaryMessage = 'Move closer to patient';
      } else if (faceRatio > distanceMaxRatio) {
        distanceValid = false;
        distanceMessage = 'Move back';
        primaryMessage = 'Step back slightly';
      }

      // Centering check
      if (Math.abs(deltaX) > posTolerance) {
        positionValid = false;
        if (deltaX > 0) {
          positionMessage = 'Move camera right / Center face';
          primaryMessage = 'Center face in frame';
        } else {
          positionMessage = 'Move camera left / Center face';
          primaryMessage = 'Center face in frame';
        }
      } else if (Math.abs(deltaY) > posTolerance + 0.05) {
        positionValid = false;
        positionMessage = deltaY > 0 ? 'Move camera up' : 'Move camera down';
        primaryMessage = deltaY > 0 ? 'Raise camera slightly' : 'Lower camera slightly';
      }

      // Specific angular rules based on exact extraoral view
      switch (view.id) {
        case 'FRONTAL_REST':
        case 'FRONTAL_SMILE': {
          // Head roll (tilt) check
          if (Math.abs(roll) > angleTolerance) {
            angleValid = false;
            angleMessage = roll > 0 ? 'Level head (tilt left)' : 'Level head (tilt right)';
            primaryMessage = 'Level head with horizontal plane';
          }
          // Head yaw (rotation) check
          else if (Math.abs(yaw) > angleTolerance + 3) {
            angleValid = false;
            angleMessage = yaw > 0 ? 'Turn slightly left' : 'Turn slightly right';
            primaryMessage = yaw > 0 ? 'Patient turn slightly left' : 'Patient turn slightly right';
          }
          // Head pitch (chin up/down)
          else if (Math.abs(pitch) > angleTolerance + 4) {
            angleValid = false;
            angleMessage = pitch > 0 ? 'Lower chin slightly' : 'Raise chin slightly';
            primaryMessage = pitch > 0 ? 'Lower chin slightly' : 'Raise chin slightly';
          }
          break;
        }

        case 'RIGHT_PROFILE': {
          // Patient should face 90 deg right (yaw ~ 75° - 90°)
          if (yaw < 50) {
            angleValid = false;
            angleMessage = 'Turn head more right (90°)';
            primaryMessage = 'Turn patient 90° right for profile';
          } else if (Math.abs(roll) > angleTolerance + 2) {
            angleValid = false;
            angleMessage = 'Level Frankfort plane';
            primaryMessage = 'Keep Frankfort plane horizontal';
          }
          break;
        }

        case 'LEFT_PROFILE': {
          // Patient should face 90 deg left (yaw ~ -75° to -90°)
          if (yaw > -50) {
            angleValid = false;
            angleMessage = 'Turn head more left (90°)';
            primaryMessage = 'Turn patient 90° left for profile';
          } else if (Math.abs(roll) > angleTolerance + 2) {
            angleValid = false;
            angleMessage = 'Level Frankfort plane';
            primaryMessage = 'Keep Frankfort plane horizontal';
          }
          break;
        }

        case 'RIGHT_OBLIQUE': {
          // 45 degree turn right
          if (yaw < 25 || yaw > 60) {
            angleValid = false;
            angleMessage = yaw < 25 ? 'Turn patient more right' : 'Turn patient slightly back';
            primaryMessage = 'Rotate 45° for right oblique';
          }
          break;
        }

        case 'LEFT_OBLIQUE': {
          // 45 degree turn left
          if (yaw > -25 || yaw < -60) {
            angleValid = false;
            angleMessage = yaw > -25 ? 'Turn patient more left' : 'Turn patient slightly back';
            primaryMessage = 'Rotate 45° for left oblique';
          }
          break;
        }
      }

      // Check smile for Frontal Smile view
      if (view.id === 'FRONTAL_SMILE' && positionValid && angleValid && distanceValid) {
        if (faceResult.smileScore < 0.35) {
          primaryMessage = 'Instruct patient to smile fully';
        }
      }

      const allValid = positionValid && angleValid && distanceValid && sharpnessValid && exposureValid;
      if (allValid) {
        primaryMessage = view.id === 'FRONTAL_SMILE' ? 'FACE CENTERED • READY' : '🟢 READY';
      }

      const readyScore =
        (positionValid ? 25 : 5) +
        (angleValid ? 25 : 5) +
        (distanceValid ? 25 : 5) +
        (sharpnessValid ? 15 : 0) +
        (exposureValid ? 10 : 0);

      return {
        isReady: allValid,
        readyScore,
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
        isExtraoralDetected: true,
        aiEngine: faceResult.aiEngine || 'chroma',
        meshContours: faceResult.meshContours,
        smileIntensity: faceResult.smileScore,
        detectedFaceLandmarks: faceResult.landmarks,
      };
    }

    // --- 2. INTRAORAL PHOTOGRAPHS GUIDANCE ---
    if (view.category === 'intraoral') {
      const intra = intraoralResult;

      if (!intra || !intra.detected) {
        return {
          isReady: false,
          readyScore: 15,
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
        };
      }

      let positionValid = true;
      let positionMessage = 'Position ✓';
      let angleValid = true;
      let angleMessage = 'Angle ✓';
      let distanceValid = true;
      let distanceMessage = 'Distance ✓';
      let primaryMessage = 'Hold steady';

      // Distance / coverage check
      if (intra.archCoverageRatio < 0.6) {
        distanceValid = false;
        distanceMessage = 'Move closer';
        primaryMessage = 'Move closer to dental arch';
      } else if (intra.archCoverageRatio > 1.1) {
        distanceValid = false;
        distanceMessage = 'Increase distance';
        primaryMessage = 'Increase distance slightly';
      }

      // Dental midline / quadrant positioning check
      if (view.id === 'ANTERIOR_INTRAORAL') {
        if (Math.abs(intra.dentalMidlineOffset) > posTolerance * 1.5) {
          positionValid = false;
          positionMessage = intra.dentalMidlineOffset > 0 ? 'Move camera left' : 'Move camera right';
          primaryMessage = 'Center dental midline (#8-#9)';
        }
        if (Math.abs(intra.occlusalPlaneTiltDeg) > angleTolerance) {
          angleValid = false;
          angleMessage = 'Level camera';
          primaryMessage = 'Level occlusal plane horizontally';
        }
        if (!intra.retractorAdequate) {
          primaryMessage = 'Retract cheeks outward & forward';
        }
      } else if (view.id === 'RIGHT_BUCCAL') {
        if (Math.abs(intra.occlusalPlaneTiltDeg) > angleTolerance + 2) {
          angleValid = false;
          angleMessage = 'Level camera';
          primaryMessage = 'Level occlusal plane';
        }
        if (intra.archCoverageRatio < 0.65) {
          positionMessage = 'Show more posterior teeth';
          primaryMessage = 'Show right molars (pull right retractor back)';
        }
      } else if (view.id === 'LEFT_BUCCAL') {
        if (Math.abs(intra.occlusalPlaneTiltDeg) > angleTolerance + 2) {
          angleValid = false;
          angleMessage = 'Level camera';
          primaryMessage = 'Level occlusal plane';
        }
        if (intra.archCoverageRatio < 0.65) {
          positionMessage = 'Show more posterior teeth';
          primaryMessage = 'Show left molars (pull left retractor back)';
        }
      } else if (view.id === 'MAXILLARY_OCCLUSAL') {
        if (intra.mirrorFoggingDetected) {
          primaryMessage = 'Defog mirror with air syringe';
        } else if (intra.archCoverageRatio < 0.7) {
          primaryMessage = 'Capture entire maxillary arch to 2nd molars';
        }
      } else if (view.id === 'MANDIBULAR_OCCLUSAL') {
        if (intra.mirrorFoggingDetected) {
          primaryMessage = 'Defog mirror with air syringe';
        } else if (intra.archCoverageRatio < 0.7) {
          primaryMessage = 'Retract tongue & capture full mandibular arch';
        }
      }

      const allValid = positionValid && angleValid && distanceValid && sharpnessValid && exposureValid;
      if (allValid) {
        primaryMessage = '🟢 READY';
      }

      const readyScore =
        (positionValid ? 25 : 5) +
        (angleValid ? 25 : 5) +
        (distanceValid ? 25 : 5) +
        (sharpnessValid ? 15 : 0) +
        (exposureValid ? 10 : 0);

      return {
        isReady: allValid,
        readyScore,
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
        headRollDeg: intra.occlusalPlaneTiltDeg,
        headYawDeg: 0,
        headPitchDeg: 0,
        // Midline match only applies to anterior intraoral; buccal views center on canine-molar segment
        centeringDeltaX:
          view.id === 'RIGHT_BUCCAL' || view.id === 'LEFT_BUCCAL' || view.id.includes('OCCLUSAL')
            ? 0
            : intra.dentalMidlineOffset,
        centeringDeltaY: 0,
        coverageRatio: intra.archCoverageRatio,
        brightnessScore: intra.intraoralExposureScore,
        sharpnessScore: intra.toothRegionSharpness,
        isIntraoralDetected: true,
        aiEngine: intra.aiEngine || 'chroma',
      };
    }

    // Default
    return {
      isReady: true,
      readyScore: 90,
      primaryMessage: '🟢 READY',
      statusType: 'ready',
      positionValid: true,
      positionMessage: 'Position ✓',
      angleValid: true,
      angleMessage: 'Angle ✓',
      distanceValid: true,
      distanceMessage: 'Distance ✓',
      sharpnessValid: true,
      exposureValid: true,
      headRollDeg: 0,
      headYawDeg: 0,
      headPitchDeg: 0,
      centeringDeltaX: 0,
      centeringDeltaY: 0,
      coverageRatio: 0.7,
      brightnessScore: 130,
      sharpnessScore: 85,
    };
  }
}
