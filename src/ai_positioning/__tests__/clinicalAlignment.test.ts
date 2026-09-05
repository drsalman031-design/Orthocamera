import { describe, it, expect } from 'vitest';
import { ClinicalAlignmentEngine } from '../ClinicalAlignmentEngine';
import { FaceAnalysisResult } from '../FaceAnalyzer';
import { OrthodonticViewDefinition } from '../../types';

describe('ClinicalAlignmentEngine', () => {
  const frontalRestView: OrthodonticViewDefinition = {
    id: 'FRONTAL_REST',
    index: 1,
    name: 'Frontal at Rest',
    category: 'extraoral',
    shortCode: 'F-REST',
    subtitle: 'Natural Head Position',
    clinicalPurpose: 'Facial symmetry',
    landmarks: ['Midline'],
    tips: ['Lips relaxed'],
    preferredFacing: 'environment',
    overlayType: 'frontal_rest',
    captureSpec: {
      targetYawDeg: 0,
      yawToleranceDeg: 7,
      targetPitchDeg: 0,
      pitchToleranceDeg: 7,
      targetRollDeg: 0,
      rollToleranceDeg: 5,
      minFaceHeightRatio: 0.32,
      maxFaceHeightRatio: 0.75,
      centerToleranceX: 0.15,
      centerToleranceY: 0.15,
      minLandmarkConfidence: 0.5,
      minPoseConfidence: 0.5,
      stableDurationMs: 600,
      requiresSmile: false,
      requiresFaceLandmarks: true,
    },
  };

  const rightProfileView: OrthodonticViewDefinition = {
    id: 'RIGHT_PROFILE',
    index: 3,
    name: 'Right Lateral Profile',
    category: 'extraoral',
    shortCode: 'R-PROF',
    subtitle: 'Frankfort Horizontal',
    clinicalPurpose: 'Sagittal profile',
    landmarks: ['Nose', 'Chin'],
    tips: ['Turn patient 90 degrees right'],
    preferredFacing: 'environment',
    overlayType: 'right_profile',
    captureSpec: {
      targetYawDeg: 90,
      yawToleranceDeg: 8,
      targetPitchDeg: 0,
      pitchToleranceDeg: 8,
      targetRollDeg: 0,
      rollToleranceDeg: 6,
      minFaceHeightRatio: 0.30,
      maxFaceHeightRatio: 0.75,
      centerToleranceX: 0.20,
      centerToleranceY: 0.20,
      minLandmarkConfidence: 0.5,
      minPoseConfidence: 0.5,
      stableDurationMs: 600,
      requiresSmile: false,
      requiresFaceLandmarks: true,
    },
  };

  const leftProfileView: OrthodonticViewDefinition = {
    id: 'LEFT_PROFILE',
    index: 4,
    name: 'Left Lateral Profile',
    category: 'extraoral',
    shortCode: 'L-PROF',
    subtitle: 'Frankfort Horizontal',
    clinicalPurpose: 'Sagittal profile',
    landmarks: ['Nose', 'Chin'],
    tips: ['Turn patient 90 degrees left'],
    preferredFacing: 'environment',
    overlayType: 'left_profile',
    captureSpec: {
      targetYawDeg: -90,
      yawToleranceDeg: 8,
      targetPitchDeg: 0,
      pitchToleranceDeg: 8,
      targetRollDeg: 0,
      rollToleranceDeg: 6,
      minFaceHeightRatio: 0.30,
      maxFaceHeightRatio: 0.75,
      centerToleranceX: 0.20,
      centerToleranceY: 0.20,
      minLandmarkConfidence: 0.5,
      minPoseConfidence: 0.5,
      stableDurationMs: 600,
      requiresSmile: false,
      requiresFaceLandmarks: true,
    },
  };

  const frontalSmileView: OrthodonticViewDefinition = {
    id: 'FRONTAL_SMILE',
    index: 2,
    name: 'Frontal with Smile',
    category: 'extraoral',
    shortCode: 'F-SMILE',
    subtitle: 'Full Smile Arc',
    clinicalPurpose: 'Smile aesthetics',
    landmarks: ['Smile Arc'],
    tips: ['Natural big smile'],
    preferredFacing: 'environment',
    overlayType: 'frontal_smile',
    captureSpec: {
      targetYawDeg: 0,
      yawToleranceDeg: 7,
      targetPitchDeg: 0,
      pitchToleranceDeg: 7,
      targetRollDeg: 0,
      rollToleranceDeg: 5,
      minFaceHeightRatio: 0.32,
      maxFaceHeightRatio: 0.75,
      centerToleranceX: 0.15,
      centerToleranceY: 0.15,
      minLandmarkConfidence: 0.5,
      minPoseConfidence: 0.5,
      stableDurationMs: 600,
      requiresSmile: true,
      minSmileScore: 0.28,
      requiresFaceLandmarks: true,
    },
  };

  const validMediaPipeFace: FaceAnalysisResult = {
    detected: true,
    confidence: 0.92,
    aiEngine: 'mediapipe',
    boundingBox: { x: 0.25, y: 0.2, width: 0.5, height: 0.5 },
    center: { x: 0.5, y: 0.45 },
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    faceHeightRatio: 0.5,
    smileScore: 0.1,
    eyeLineAngleDeg: 0,
    landmarks: {
      leftEye: { x: 0.35, y: 0.38 },
      rightEye: { x: 0.65, y: 0.38 },
      noseTip: { x: 0.5, y: 0.48 },
      mouthCenter: { x: 0.5, y: 0.6 },
      chinTip: { x: 0.5, y: 0.7 },
    },
    pose: {
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      confidence: 0.95,
      source: 'mediapipe-matrix',
    },
    landmarkQuality: {
      available: true,
      landmarkCount: 468,
      requiredLandmarksPresent: true,
      symmetryScore: 0.94,
      geometryScore: 0.92,
      confidence: 0.95,
    },
  };

  it('fails closed when no face is detected', () => {
    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: null,
      currentView: frontalRestView,
    });
    expect(result.ready).toBe(false);
    expect(result.alignmentScore).toBe(0);
    expect(result.detected).toBe(false);
    expect(result.reasons).toContain('FACE_NOT_DETECTED');
    expect(result.correction.direction).toBe('HOLD_STILL');
  });

  it('fails closed when non-MediaPipe fallback detector is used', () => {
    const chromaFace: FaceAnalysisResult = {
      ...validMediaPipeFace,
      aiEngine: 'chroma',
      landmarks: undefined,
      pose: { yawDeg: null, pitchDeg: null, rollDeg: null, confidence: 0, source: 'unavailable' },
      landmarkQuality: {
        available: false,
        landmarkCount: 0,
        requiredLandmarksPresent: false,
        symmetryScore: 0,
        geometryScore: 0,
        confidence: 0,
      },
    };
    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: chromaFace,
      currentView: frontalRestView,
    });
    expect(result.ready).toBe(false);
    expect(result.alignmentScore).toBeLessThanOrEqual(25);
    expect(result.landmarksValid).toBe(false);
  });

  it('fails closed when required landmarks are missing', () => {
    const incompleteFace: FaceAnalysisResult = {
      ...validMediaPipeFace,
      landmarks: {
        ...validMediaPipeFace.landmarks,
        chinTip: undefined, // Missing chin
      },
    };
    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: incompleteFace,
      currentView: frontalRestView,
    });
    expect(result.ready).toBe(false);
    expect(result.landmarksValid).toBe(false);
  });

  it('guides patient with correct direction on centering error (left, right, up, down)', () => {
    // Patient face shifted far right (center.x = 0.85) -> Must instruct MOVE LEFT
    const rightShifted: FaceAnalysisResult = {
      ...validMediaPipeFace,
      center: { x: 0.85, y: 0.45 },
    };
    const resultRight = ClinicalAlignmentEngine.evaluate({
      faceResult: rightShifted,
      currentView: frontalRestView,
      isStable: true,
    });
    expect(resultRight.ready).toBe(false);
    expect(resultRight.correction.direction).toBe('LEFT');
    expect(resultRight.correction.message).toContain('MOVE LEFT');

    // Patient face shifted far left (center.x = 0.15) -> Must instruct MOVE RIGHT (Prompt 16)
    const leftShifted: FaceAnalysisResult = {
      ...validMediaPipeFace,
      center: { x: 0.15, y: 0.45 },
    };
    const resultLeft = ClinicalAlignmentEngine.evaluate({
      faceResult: leftShifted,
      currentView: frontalRestView,
      isStable: true,
    });
    expect(resultLeft.ready).toBe(false);
    expect(resultLeft.correction.direction).toBe('RIGHT');
    expect(resultLeft.correction.message).toContain('MOVE RIGHT');

    // Patient face shifted far up (center.y = 0.15) -> Must instruct MOVE DOWN
    const upShifted: FaceAnalysisResult = {
      ...validMediaPipeFace,
      center: { x: 0.5, y: 0.15 },
    };
    const resultUp = ClinicalAlignmentEngine.evaluate({
      faceResult: upShifted,
      currentView: frontalRestView,
      isStable: true,
    });
    expect(resultUp.ready).toBe(false);
    expect(resultUp.correction.direction).toBe('DOWN');
    expect(resultUp.correction.message).toContain('MOVE DOWN');

    // Patient face shifted far down (center.y = 0.85) -> Must instruct MOVE UP
    const downShifted: FaceAnalysisResult = {
      ...validMediaPipeFace,
      center: { x: 0.5, y: 0.85 },
    };
    const resultDown = ClinicalAlignmentEngine.evaluate({
      faceResult: downShifted,
      currentView: frontalRestView,
      isStable: true,
    });
    expect(resultDown.ready).toBe(false);
    expect(resultDown.correction.direction).toBe('UP');
    expect(resultDown.correction.message).toContain('MOVE UP');
  });

  it('guides patient with correct direction on distance error (closer, back)', () => {
    // Face too small / far away (faceHeightRatio = 0.20)
    const farFace: FaceAnalysisResult = {
      ...validMediaPipeFace,
      faceHeightRatio: 0.2,
    };
    const resultFar = ClinicalAlignmentEngine.evaluate({
      faceResult: farFace,
      currentView: frontalRestView,
      isStable: true,
    });
    expect(resultFar.ready).toBe(false);
    expect(resultFar.correction.direction).toBe('MOVE_CLOSER');
    expect(resultFar.correction.message).toBe('MOVE CLOSER');

    // Face too big / close (faceHeightRatio = 0.90)
    const closeFace: FaceAnalysisResult = {
      ...validMediaPipeFace,
      faceHeightRatio: 0.9,
    };
    const resultClose = ClinicalAlignmentEngine.evaluate({
      faceResult: closeFace,
      currentView: frontalRestView,
      isStable: true,
    });
    expect(resultClose.ready).toBe(false);
    expect(resultClose.correction.direction).toBe('MOVE_BACK');
    expect(resultClose.correction.message).toBe('MOVE BACK');
  });

  it('guides patient with correct direction on roll tilt (rotate left, rotate right)', () => {
    // Head tilted 12 degrees to the right -> Must instruct ROTATE LEFT / LEVEL HEAD
    const tiltedRightFace: FaceAnalysisResult = {
      ...validMediaPipeFace,
      rollDeg: 12,
    };
    const resultRotateLeft = ClinicalAlignmentEngine.evaluate({
      faceResult: tiltedRightFace,
      currentView: frontalRestView,
      isStable: true,
    });
    expect(resultRotateLeft.ready).toBe(false);
    expect(resultRotateLeft.correction.direction).toBe('ROTATE_LEFT');
    expect(resultRotateLeft.correction.message).toContain('LEVEL HEAD');

    // Head tilted -12 degrees to the left -> Must instruct ROTATE RIGHT / LEVEL HEAD
    const tiltedLeftFace: FaceAnalysisResult = {
      ...validMediaPipeFace,
      rollDeg: -12,
    };
    const resultRotateRight = ClinicalAlignmentEngine.evaluate({
      faceResult: tiltedLeftFace,
      currentView: frontalRestView,
      isStable: true,
    });
    expect(resultRotateRight.ready).toBe(false);
    expect(resultRotateRight.correction.direction).toBe('ROTATE_RIGHT');
    expect(resultRotateRight.correction.message).toContain('LEVEL HEAD');
  });

  it('enforces smile condition for FRONTAL_SMILE view', () => {
    const notSmilingFace: FaceAnalysisResult = {
      ...validMediaPipeFace,
      smileScore: 0.05,
    };
    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: notSmilingFace,
      currentView: frontalSmileView,
      isStable: true,
    });
    expect(result.ready).toBe(false);
    expect(result.expressionValid).toBe(false);
    expect(result.correction.message.toLowerCase()).toContain('smile naturally');

    const smilingFace: FaceAnalysisResult = {
      ...validMediaPipeFace,
      smileScore: 0.55,
    };
    const smilingResult = ClinicalAlignmentEngine.evaluate({
      faceResult: smilingFace,
      currentView: frontalSmileView,
      isStable: true,
    });
    expect(smilingResult.expressionValid).toBe(true);
    expect(smilingResult.ready).toBe(true);
  });

  it('rejects frontal face for lateral profile view', () => {
    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: validMediaPipeFace, // yaw = 0
      currentView: rightProfileView,
      isStable: true,
    });
    expect(result.ready).toBe(false);
    expect(result.correction.direction).toBe('RIGHT');
    expect(result.correction.message).toContain('TURN RIGHT');
  });

  it('rejects 45 degree oblique and 70 degree yaw for 90 degree lateral profile', () => {
    const oblique45: FaceAnalysisResult = {
      ...validMediaPipeFace,
      yawDeg: 45,
      pose: { ...validMediaPipeFace.pose!, yawDeg: 45 },
    };
    const result45 = ClinicalAlignmentEngine.evaluate({
      faceResult: oblique45,
      currentView: rightProfileView,
      isStable: true,
    });
    expect(result45.ready).toBe(false);

    const near70: FaceAnalysisResult = {
      ...validMediaPipeFace,
      yawDeg: 70,
      pose: { ...validMediaPipeFace.pose!, yawDeg: 70 },
    };
    const result70 = ClinicalAlignmentEngine.evaluate({
      faceResult: near70,
      currentView: rightProfileView,
      isStable: true,
    });
    expect(result70.ready).toBe(false);
  });

  it('rejects excessive roll (>6 deg) in profile view', () => {
    const tiltedProfile: FaceAnalysisResult = {
      ...validMediaPipeFace,
      yawDeg: 90,
      rollDeg: 10,
      pose: { ...validMediaPipeFace.pose!, yawDeg: 90, rollDeg: 10 },
    };
    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: tiltedProfile,
      currentView: rightProfileView,
      isStable: true,
    });
    expect(result.ready).toBe(false);
  });

  it('accepts true 90 degree right lateral profile with fresh MediaPipe data', () => {
    const trueRightProfile: FaceAnalysisResult = {
      ...validMediaPipeFace,
      yawDeg: 90,
      pitchDeg: 0,
      rollDeg: 0,
      pose: { ...validMediaPipeFace.pose!, yawDeg: 90, rollDeg: 0 },
    };
    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: trueRightProfile,
      currentView: rightProfileView,
      isStable: true,
      profileState: {
        isProfileAligned: true,
        isCaptureEligible: true,
        guidanceMessage: 'Profile Aligned ✓',
        state: 'TRACKING',
        estimatedYaw: 90,
        estimatedRoll: 0,
        confidence: 0.9,
        isFresh: true,
      },
    });
    expect(result.ready).toBe(true);
    expect(result.alignmentScore).toBeGreaterThanOrEqual(80);
    expect(result.correction.direction).toBe('READY');
  });

  it('accepts true -90 degree left lateral profile with fresh MediaPipe data', () => {
    const trueLeftProfile: FaceAnalysisResult = {
      ...validMediaPipeFace,
      yawDeg: -90,
      pitchDeg: 0,
      rollDeg: 0,
      pose: { ...validMediaPipeFace.pose!, yawDeg: -90, rollDeg: 0 },
    };
    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: trueLeftProfile,
      currentView: leftProfileView,
      isStable: true,
      profileState: {
        isProfileAligned: true,
        isCaptureEligible: true,
        guidanceMessage: 'Profile Aligned ✓',
        state: 'TRACKING',
        estimatedYaw: -90,
        estimatedRoll: 0,
        confidence: 0.9,
        isFresh: true,
      },
    });
    expect(result.ready).toBe(true);
    expect(result.alignmentScore).toBeGreaterThanOrEqual(80);
    expect(result.correction.direction).toBe('READY');
  });

  it('fails closed when profile tracking is temporarily lost or ineligible', () => {
    const trueRightProfile: FaceAnalysisResult = {
      ...validMediaPipeFace,
      yawDeg: 90,
      pose: { ...validMediaPipeFace.pose!, yawDeg: 90 },
    };
    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: trueRightProfile,
      currentView: rightProfileView,
      isStable: true,
      profileState: {
        isProfileAligned: false,
        isCaptureEligible: false,
        guidanceMessage: 'Profile tracking lost — turn patient right',
        state: 'TEMPORARILY_LOST',
        estimatedYaw: 90,
        estimatedRoll: 0,
        confidence: 0,
        isFresh: false,
      },
    });
    expect(result.ready).toBe(false);
  });
});
