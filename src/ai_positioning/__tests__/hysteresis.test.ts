import { describe, it, expect } from 'vitest';
import { HysteresisController } from '../HysteresisController';
import { CaptureReadiness } from '../../types';

describe('HysteresisController - Low Latency Clinical State Machine', () => {
  const readySpec: CaptureReadiness = {
    ready: true,
    score: 95,
    positionValid: true,
    angleValid: true,
    distanceValid: true,
    frameSizeValid: true,
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
    frameSizeValid: true,
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

  it('transitions from ALIGNING to READY_CANDIDATE to STABILITY_CONFIRMATION', () => {
    const controller = new HysteresisController({ stabilityConfirmationMs: 220 });
    let t = 1000;

    // First ready frame -> READY_CANDIDATE
    let update = controller.update(readySpec, true, true, true, true, t);
    expect(update.guidanceStage).toBe('READY_CANDIDATE');
    expect(update.shouldTriggerCapture).toBe(false);

    // After 100ms stable -> STABILITY_CONFIRMATION
    t += 100;
    update = controller.update(readySpec, true, true, true, true, t);
    expect(update.guidanceStage).toBe('STABILITY_CONFIRMATION');
    expect(update.shouldTriggerCapture).toBe(false);

    // After 220ms total confirmation -> CAPTURE triggered
    t += 130;
    update = controller.update(readySpec, true, true, true, true, t);
    expect(update.guidanceStage).toBe('CAPTURED');
    expect(update.shouldTriggerCapture).toBe(true);
  });

  it('drops out of confirmation if critical alignment is lost beyond jitter grace', () => {
    const controller = new HysteresisController({ stabilityConfirmationMs: 220, jitterDebounceGraceMs: 50 });
    let t = 1000;

    // Reach READY_CANDIDATE
    controller.update(readySpec, true, true, true, true, t);

    // Subject breaks alignment
    t += 200;
    const dropUpdate = controller.update(unreadySpec, false, false, false, true, t);
    expect(dropUpdate.guidanceStage).toBe('ALIGNING');
    expect(dropUpdate.shouldTriggerCapture).toBe(false);
  });

  it('tolerates micro-jitter within 50ms grace period without dropping progress', () => {
    const controller = new HysteresisController({ stabilityConfirmationMs: 220, jitterDebounceGraceMs: 50 });
    let t = 1000;

    // t=0: Candidate ready
    controller.update(readySpec, true, true, true, true, t);

    // t=50: Stability confirmation
    t += 50;
    controller.update(readySpec, true, true, true, true, t);

    // t=70: Single frame micro-jitter (20ms, well within 50ms grace)
    t += 20;
    const jitterUpdate = controller.update(unreadySpec, false, false, false, true, t);
    expect(jitterUpdate.shouldTriggerCapture).toBe(false);

    // t=100: Recovered alignment immediately
    t += 30;
    const recovered = controller.update(readySpec, true, true, true, true, t);
    expect(recovered.guidanceStage).toBe('STABILITY_CONFIRMATION');
  });
});
