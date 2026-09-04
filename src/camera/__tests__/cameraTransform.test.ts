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
});
