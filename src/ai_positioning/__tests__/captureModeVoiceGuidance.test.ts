import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CAPTURE_MODE_CONFIGS, getCaptureModeConfig } from '../CaptureConfig';
import { VoiceGuidanceEngine } from '../VoiceGuidanceEngine';
import { ClinicalAlignmentEngine } from '../ClinicalAlignmentEngine';
import { FaceAnalysisResult } from '../FaceAnalyzer';
import { OrthodonticViewDefinition } from '../../types';
import { ORTHODONTIC_VIEWS } from '../../photo_workflow/workflowData';

describe('Capture Mode & Dynamic Tolerance Architecture', () => {
  it('retrieves distinct configs for fast, balanced, and clinical modes', () => {
    const fast = getCaptureModeConfig('fast');
    const balanced = getCaptureModeConfig('balanced');
    const clinical = getCaptureModeConfig('clinical');

    expect(fast.enterReadyScore).toBe(60);
    expect(balanced.enterReadyScore).toBe(70);
    expect(clinical.enterReadyScore).toBe(80);

    expect(fast.stabilityConfirmationMs).toBeLessThan(balanced.stabilityConfirmationMs);
    expect(balanced.stabilityConfirmationMs).toBeLessThan(clinical.stabilityConfirmationMs);

    expect(fast.allowFallbackDetectorCapture).toBe(true);
    expect(balanced.allowFallbackDetectorCapture).toBe(false);
    expect(clinical.allowFallbackDetectorCapture).toBe(false);
  });

  it('allows auto-capture at lower readiness score (>= 60) in fast mode', () => {
    const mockFace: FaceAnalysisResult = {
      detected: true,
      confidence: 0.9,
      aiEngine: 'mediapipe',
      boundingBox: { x: 0.35, y: 0.25, width: 0.3, height: 0.4 },
      center: { x: 0.5, y: 0.45 },
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      faceHeightRatio: 0.45,
      smileScore: 0,
      eyeLineAngleDeg: 0,
      pose: {
        yawDeg: 0,
        pitchDeg: 0,
        rollDeg: 0,
        confidence: 0.9,
        source: 'mediapipe-matrix',
      },
      landmarks: {
        leftEye: { x: 0.42, y: 0.4 },
        rightEye: { x: 0.58, y: 0.4 },
        noseTip: { x: 0.5, y: 0.47 },
        mouthCenter: { x: 0.5, y: 0.56 },
        chinTip: { x: 0.5, y: 0.65 },
      },
      landmarkQuality: {
        available: true,
        landmarkCount: 468,
        requiredLandmarksPresent: true,
        symmetryScore: 0.85,
        geometryScore: 0.85,
        confidence: 0.9,
      },
    };

    const mockView = ORTHODONTIC_VIEWS[0];

    // Evaluate in Fast Mode
    const fastResult = ClinicalAlignmentEngine.evaluate({
      faceResult: mockFace,
      currentView: mockView,
      isStable: true,
      motionScore: 5,
      rawLuminance: 120,
      rawSharpness: 80,
      captureMode: 'fast',
    });

    expect(fastResult.ready).toBe(true);
    expect(fastResult.alignmentScore).toBeGreaterThanOrEqual(60);
    expect(fastResult.blockingFactors).toHaveLength(0);
    expect(fastResult.rejectionReason).toBeUndefined();
  });

  it('provides explicit rejection reasons and blocking factors when misaligned', () => {
    const offCenterFace: FaceAnalysisResult = {
      detected: true,
      confidence: 0.9,
      aiEngine: 'mediapipe',
      boundingBox: { x: 0.1, y: 0.25, width: 0.3, height: 0.4 },
      center: { x: 0.2, y: 0.45 }, // Significantly to the left
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      faceHeightRatio: 0.45,
      smileScore: 0,
      eyeLineAngleDeg: 0,
      pose: {
        yawDeg: 0,
        pitchDeg: 0,
        rollDeg: 0,
        confidence: 0.9,
        source: 'mediapipe-matrix',
      },
      landmarks: {
        leftEye: { x: 0.15, y: 0.4 },
        rightEye: { x: 0.25, y: 0.4 },
        noseTip: { x: 0.2, y: 0.47 },
        mouthCenter: { x: 0.2, y: 0.56 },
        chinTip: { x: 0.2, y: 0.65 },
      },
      landmarkQuality: {
        available: true,
        landmarkCount: 468,
        requiredLandmarksPresent: true,
        symmetryScore: 0.85,
        geometryScore: 0.85,
        confidence: 0.9,
      },
    };

    const mockView = ORTHODONTIC_VIEWS[0];

    const result = ClinicalAlignmentEngine.evaluate({
      faceResult: offCenterFace,
      currentView: mockView,
      isStable: true,
      motionScore: 0,
      captureMode: 'balanced',
    });

    expect(result.ready).toBe(false);
    expect(result.blockingFactors).toContain('OFF_CENTER');
    expect(result.rejectionReason).toMatch(/Move face right/i);
    expect(result.correction.direction).toBe('RIGHT');
  });
});

describe('VoiceGuidanceEngine - Auditory Feedback', () => {
  let engine: VoiceGuidanceEngine;

  beforeEach(() => {
    engine = new VoiceGuidanceEngine();
  });

  it('normalizes clinical rejection reasons to concise spoken cues', () => {
    // Access private normalization method via any
    const anyEngine = engine as any;
    expect(anyEngine.normalizeRejectionToSpeech('Move face right 20%')).toBe('Move right');
    expect(anyEngine.normalizeRejectionToSpeech('Move face left 15%')).toBe('Move left');
    expect(anyEngine.normalizeRejectionToSpeech('Step closer (fill guide frame)')).toBe('Move closer');
    expect(anyEngine.normalizeRejectionToSpeech('Level head horizontal')).toBe('Level head');
  });

  it('does not speak when disabled', () => {
    const speakSpy = vi.spyOn(engine as any, 'speak');
    engine.setEnabled(false);

    engine.update({
      isReady: false,
      readyScore: 40,
      primaryMessage: 'MOVE RIGHT 10%',
      statusType: 'adjust',
      positionValid: false,
      positionMessage: 'Position',
      angleValid: true,
      angleMessage: 'Angle',
      distanceValid: true,
      distanceMessage: 'Distance',
      sharpnessValid: true,
      exposureValid: true,
      rejectionReason: 'Move face right 10%',
    } as any);

    expect(speakSpy).not.toHaveBeenCalled();
  });
});
