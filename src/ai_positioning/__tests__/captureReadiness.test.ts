import { describe, it, expect } from 'vitest';
import { OverlayGuidanceEngine } from '../OverlayGuidanceEngine';
import { getViewById } from '../../photo_workflow/workflowData';
import { FaceAnalysisResult } from '../FaceAnalyzer';

describe('CaptureReadiness & Fail-Closed Gating', () => {
  const frontalRestView = getViewById('FRONTAL_REST');
  const frontalSmileView = getViewById('FRONTAL_SMILE');
  const rightProfileView = getViewById('RIGHT_PROFILE');

  it('fails closed when face is not detected', () => {
    const guidance = OverlayGuidanceEngine.evaluate({
      view: frontalRestView,
      faceResult: null,
      isStable: true,
      motionScore: 0,
    });

    expect(guidance.isReady).toBe(false);
    expect(guidance.readiness?.ready).toBe(false);
    expect(guidance.readiness?.faceDetectionValid).toBe(false);
    expect(guidance.readiness?.reasons).toContain('FACE_NOT_DETECTED');
  });

  it('fails closed when landmarks or pose are missing in extraoral views', () => {
    const chromaFallbackResult: FaceAnalysisResult = {
      detected: true,
      confidence: 0.3,
      aiEngine: 'chroma',
      boundingBox: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 },
      center: { x: 0.5, y: 0.45 },
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      faceHeightRatio: 0.5,
      smileScore: 0,
      eyeLineAngleDeg: 0,
      landmarks: undefined,
      pose: {
        yawDeg: null,
        pitchDeg: null,
        rollDeg: null,
        confidence: 0,
        source: 'unavailable',
      },
      landmarkQuality: {
        available: false,
        landmarkCount: 0,
        requiredLandmarksPresent: false,
        symmetryScore: 0,
        geometryScore: 0,
        confidence: 0,
      },
    };

    const guidance = OverlayGuidanceEngine.evaluate({
      view: frontalRestView,
      faceResult: chromaFallbackResult,
      isStable: true,
      motionScore: 0,
    });

    expect(guidance.isReady).toBe(false);
    expect(guidance.readiness?.ready).toBe(false);
    expect(guidance.readiness?.landmarkQualityValid).toBe(false);
  });

  it('requires natural smile for FRONTAL_SMILE view', () => {
    const unsmilingFace: FaceAnalysisResult = {
      detected: true,
      confidence: 0.9,
      aiEngine: 'mediapipe',
      boundingBox: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 },
      center: { x: 0.5, y: 0.45 },
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      faceHeightRatio: 0.5,
      smileScore: 0.05, // Not smiling
      eyeLineAngleDeg: 0,
      landmarks: {
        leftEye: { x: 0.4, y: 0.35 },
        rightEye: { x: 0.6, y: 0.35 },
        noseTip: { x: 0.5, y: 0.45 },
        mouthCenter: { x: 0.5, y: 0.55 },
        chinTip: { x: 0.5, y: 0.68 },
      },
      pose: {
        yawDeg: 0,
        pitchDeg: 0,
        rollDeg: 0,
        confidence: 0.9,
        source: 'mediapipe-matrix',
      },
      landmarkQuality: {
        available: true,
        landmarkCount: 468,
        requiredLandmarksPresent: true,
        symmetryScore: 0.9,
        geometryScore: 0.9,
        confidence: 0.9,
      },
    };

    const guidance = OverlayGuidanceEngine.evaluate({
      view: frontalSmileView,
      faceResult: unsmilingFace,
      isStable: true,
      motionScore: 0,
    });

    expect(guidance.isReady).toBe(false);
    expect(guidance.readiness?.expressionValid).toBe(false);
    expect(guidance.readiness?.reasons).toContain('SMILE_REQUIRED');
  });

  it('passes when all clinical specifications are satisfied', () => {
    const compliantFace: FaceAnalysisResult = {
      detected: true,
      confidence: 0.9,
      aiEngine: 'mediapipe',
      boundingBox: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 },
      center: { x: 0.5, y: 0.45 },
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      faceHeightRatio: 0.5,
      smileScore: 0.1,
      eyeLineAngleDeg: 0,
      landmarks: {
        leftEye: { x: 0.4, y: 0.35 },
        rightEye: { x: 0.6, y: 0.35 },
        noseTip: { x: 0.5, y: 0.45 },
        mouthCenter: { x: 0.5, y: 0.55 },
        chinTip: { x: 0.5, y: 0.68 },
      },
      pose: {
        yawDeg: 0,
        pitchDeg: 0,
        rollDeg: 0,
        confidence: 0.9,
        source: 'mediapipe-matrix',
      },
      landmarkQuality: {
        available: true,
        landmarkCount: 468,
        requiredLandmarksPresent: true,
        symmetryScore: 0.9,
        geometryScore: 0.9,
        confidence: 0.9,
      },
    };

    const guidance = OverlayGuidanceEngine.evaluate({
      view: frontalRestView,
      faceResult: compliantFace,
      isStable: true,
      motionScore: 5,
      rawLuminance: 130,
      rawSharpness: 80,
    });

    expect(guidance.isReady).toBe(true);
    expect(guidance.readiness?.ready).toBe(true);
    expect(guidance.readiness?.reasons.length).toBe(0);
  });
});
