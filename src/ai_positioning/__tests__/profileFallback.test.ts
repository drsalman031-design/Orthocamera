import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileFallbackEngine } from '../ProfileFallbackEngine';
import { FaceAnalysisResult } from '../FaceAnalyzer';

describe('ProfileFallbackEngine - Strict 90° Lateral Profile Validation', () => {
  let engine: ProfileFallbackEngine;

  const createFaceResult = (yawDeg: number, rollDeg: number = 0, confidence: number = 0.9): FaceAnalysisResult => ({
    detected: true,
    confidence,
    aiEngine: 'mediapipe',
    boundingBox: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 },
    center: { x: 0.5, y: 0.45 },
    yawDeg,
    pitchDeg: 0,
    rollDeg,
    faceHeightRatio: 0.5,
    smileScore: 0,
    eyeLineAngleDeg: rollDeg,
    pose: {
      yawDeg,
      pitchDeg: 0,
      rollDeg,
      confidence,
      source: 'mediapipe-matrix',
    },
    landmarkQuality: {
      available: true,
      landmarkCount: 468,
      requiredLandmarksPresent: true,
      symmetryScore: 0.8,
      geometryScore: 0.8,
      confidence,
    },
  });

  beforeEach(() => {
    engine = new ProfileFallbackEngine();
  });

  it('marks 0° frontal face as invalid for RIGHT_PROFILE', () => {
    const res = engine.evaluateProfile(true, createFaceResult(0));
    expect(res.state).toBe('INVALID_POSITION');
    expect(res.isProfileAligned).toBe(false);
    expect(res.isCaptureEligible).toBe(false);
  });

  it('marks wrong-side yaw as invalid (e.g. turned left for RIGHT_PROFILE)', () => {
    const res = engine.evaluateProfile(true, createFaceResult(-90));
    expect(res.state).toBe('INVALID_POSITION');
    expect(res.isProfileAligned).toBe(false);
    expect(res.isCaptureEligible).toBe(false);
  });

  it('marks 45° oblique yaw as not ready for profile capture', () => {
    const res = engine.evaluateProfile(true, createFaceResult(45));
    expect(res.state).toBe('TRACKING');
    expect(res.isFresh).toBe(true);
    expect(res.isProfileAligned).toBe(false);
    expect(res.isCaptureEligible).toBe(false);
    expect(res.guidanceMessage).toContain('Turn patient further right');
  });

  it('strictly rejects ~70° oblique yaw from being accepted as 90° profile', () => {
    const res = engine.evaluateProfile(true, createFaceResult(70));
    expect(res.state).toBe('TRACKING');
    expect(res.isProfileAligned).toBe(false);
    expect(res.isCaptureEligible).toBe(false);
    expect(res.guidanceMessage).toContain('Turn patient further right');
  });

  it('accepts ~90° correct yaw within narrow tolerance for RIGHT_PROFILE', () => {
    const res = engine.evaluateProfile(true, createFaceResult(90, 1));
    expect(res.state).toBe('TRACKING');
    expect(res.isFresh).toBe(true);
    expect(res.isProfileAligned).toBe(true);
    expect(res.isCaptureEligible).toBe(true);
    expect(res.guidanceMessage).toBe('Profile Aligned ✓');
  });

  it('accepts ~-90° correct yaw within narrow tolerance for LEFT_PROFILE', () => {
    const res = engine.evaluateProfile(false, createFaceResult(-90, -1));
    expect(res.state).toBe('TRACKING');
    expect(res.isFresh).toBe(true);
    expect(res.isProfileAligned).toBe(true);
    expect(res.isCaptureEligible).toBe(true);
    expect(res.guidanceMessage).toBe('Profile Aligned ✓');
  });

  it('rejects profile with excessive head roll (>6°)', () => {
    const res = engine.evaluateProfile(true, createFaceResult(90, 12));
    expect(res.state).toBe('TRACKING');
    expect(res.isProfileAligned).toBe(false);
    expect(res.isCaptureEligible).toBe(false);
    expect(res.guidanceMessage).toBe('Level patient head');
  });

  it('immediately invalidates capture eligibility when tracking is lost', () => {
    // 1. Establish valid 90° tracking
    const t0 = 1000;
    const initial = engine.evaluateProfile(true, createFaceResult(90, 0), t0);
    expect(initial.isCaptureEligible).toBe(true);

    // 2. Tracking lost at profile
    const lost = engine.evaluateProfile(true, null, t0 + 100);
    expect(lost.state).toBe('TEMPORARILY_LOST');
    expect(lost.isFresh).toBe(false);
    expect(lost.isProfileAligned).toBe(false);
    expect(lost.isCaptureEligible).toBe(false); // Fail-closed
    expect(lost.guidanceMessage).toContain('re-acquiring');
  });

  it('ensures stale cached results beyond persistence window are completely invalid', () => {
    const t0 = 1000;
    engine.evaluateProfile(true, createFaceResult(90, 0), t0);

    // After 1500ms (beyond 1000ms window)
    const expired = engine.evaluateProfile(true, null, t0 + 1500);
    expect(expired.state).toBe('INVALID_POSITION');
    expect(expired.isFresh).toBe(false);
    expect(expired.isCaptureEligible).toBe(false);
    expect(expired.confidence).toBe(0);
  });
});
