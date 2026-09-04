import { describe, it, expect } from 'vitest';
import { HysteresisController } from '../HysteresisController';
import { CaptureReadiness } from '../../types';

describe('HysteresisController - Stability & Persistence', () => {
  const readySpec: CaptureReadiness = {
    ready: true,
    score: 95,
    positionValid: true,
    angleValid: true,
    distanceValid: true,
    expressionValid: true,
    sharpnessValid: true,
    exposureValid: true,
    faceDetectionValid: true,
    landmarkQualityValid: true,
    poseQualityValid: true,
    temporalStabilityValid: true,
    reasons: [],
    confidence: 0.9,
  };

  const unreadySpec: CaptureReadiness = {
    ready: false,
    score: 40,
    positionValid: false,
    angleValid: false,
    distanceValid: true,
    expressionValid: true,
    sharpnessValid: true,
    exposureValid: true,
    faceDetectionValid: true,
    landmarkQualityValid: true,
    poseQualityValid: false,
    temporalStabilityValid: false,
    reasons: ['POSE_UNRELIABLE'],
    confidence: 0.4,
  };

  it('requires 600ms continuous persistence before entering READY / COUNTDOWN', () => {
    const controller = new HysteresisController({ candidatePersistenceMs: 600 });
    let t = 1000;

    // First ready frame -> CANDIDATE_READY
    let update = controller.update(readySpec, true, true, true, true, t);
    expect(update.stage).toBe('CANDIDATE_READY');
    expect(update.shouldTriggerCapture).toBe(false);

    // After 300ms (not yet 600ms) -> Still CANDIDATE_READY
    t += 300;
    update = controller.update(readySpec, true, true, true, true, t);
    expect(update.stage).toBe('CANDIDATE_READY');
    expect(update.shouldTriggerCapture).toBe(false);

    // After 600ms total -> COUNTDOWN (since autoCaptureEnabled = true)
    t += 350;
    update = controller.update(readySpec, true, true, true, true, t);
    expect(update.stage).toBe('COUNTDOWN');
    expect(update.countdownSeconds).toBeGreaterThan(0);
  });

  it('immediately drops out of COUNTDOWN if critical alignment is lost', () => {
    const controller = new HysteresisController({ candidatePersistenceMs: 600, temporaryLossGraceMs: 100 });
    let t = 1000;

    // Reach COUNTDOWN
    controller.update(readySpec, true, true, true, true, t);
    t += 650;
    controller.update(readySpec, true, true, true, true, t);

    // Subject turns away / breaks alignment
    t += 200;
    const dropUpdate = controller.update(unreadySpec, false, false, false, true, t);
    expect(dropUpdate.stage).toBe('ALIGNING');
    expect(dropUpdate.shouldTriggerCapture).toBe(false);
  });
});
