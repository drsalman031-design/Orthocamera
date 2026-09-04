import { describe, it, expect } from 'vitest';
import { CameraFrameTransform } from '../CameraFrameTransform';

describe('CameraFrameTransform - Preview / Viewport Crop Synchronization', () => {
  it('correctly calculates object-cover crop for 16:9 sensor in 9:16 portrait viewport', () => {
    // Sensor: 1920x1080 (Aspect = 1.777)
    // Viewport: 360x640 (Aspect = 0.5625)
    const crop = CameraFrameTransform.calculateVisibleCrop(1920, 1080, 360, 640, 1.0, false);

    // Height fits (1080), Width is cropped to 1080 * (360/640) = 607.5 => 608
    expect(crop.height).toBe(1080);
    expect(crop.width).toBeCloseTo(608, -1);
    expect(crop.x).toBeCloseTo((1920 - 608) / 2, -1);
    expect(crop.y).toBe(0);
  });

  it('transforms sensor coordinates to viewport coordinates accurately and supports round-trip', () => {
    const sensorW = 1920;
    const sensorH = 1080;
    const viewportW = 360;
    const viewportH = 640;
    const crop = CameraFrameTransform.calculateVisibleCrop(sensorW, sensorH, viewportW, viewportH, 1.0, false);

    // Center point in sensor space (0.5, 0.5)
    const sensorCenter = { x: 0.5, y: 0.5 };
    const vpCenter = CameraFrameTransform.sensorToViewportNorm(sensorCenter, crop, sensorW, sensorH);
    expect(vpCenter.x).toBeCloseTo(0.5, 2);
    expect(vpCenter.y).toBeCloseTo(0.5, 2);

    // Round-trip back to sensor space
    const roundTrip = CameraFrameTransform.viewportToSensorNorm(vpCenter, crop, sensorW, sensorH);
    expect(roundTrip.x).toBeCloseTo(0.5, 2);
    expect(roundTrip.y).toBeCloseTo(0.5, 2);
  });

  it('transforms FaceAnalysisResult to viewport normalized space with correct aspect cropping', () => {
    const sensorW = 1920;
    const sensorH = 1080;
    const viewportW = 390;
    const viewportH = 844;
    const crop = CameraFrameTransform.calculateVisibleCrop(sensorW, sensorH, viewportW, viewportH, 1.0, false);

    const mockFace = {
      detected: true,
      confidence: 0.95,
      aiEngine: 'mediapipe' as const,
      boundingBox: { x: 0.45, y: 0.2, width: 0.1, height: 0.4 },
      center: { x: 0.5, y: 0.4 },
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      faceHeightRatio: 0.4,
      smileScore: 0.2,
      eyeLineAngleDeg: 0,
      landmarks: {
        noseTip: { x: 0.5, y: 0.4 },
        chinTip: { x: 0.5, y: 0.6 },
      },
      meshContours: {
        faceOval: [{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.6 }],
        lips: [{ x: 0.5, y: 0.5 }],
        leftEye: [{ x: 0.48, y: 0.35 }],
        rightEye: [{ x: 0.52, y: 0.35 }],
        noseBridge: [{ x: 0.5, y: 0.38 }],
      },
    };

    const vpFace = CameraFrameTransform.transformFaceResultToViewport(mockFace, crop, sensorW, sensorH);

    // Center x should remain 0.5 (as it is horizontally centered)
    expect(vpFace.center.x).toBeCloseTo(0.5, 2);
    expect(vpFace.center.y).toBeCloseTo(0.4, 2);
    expect(vpFace.landmarks?.noseTip?.x).toBeCloseTo(0.5, 2);
    expect(vpFace.landmarks?.chinTip?.x).toBeCloseTo(0.5, 2);
    expect(vpFace.meshContours?.faceOval[0].x).toBeCloseTo(0.5, 2);
  });
});
