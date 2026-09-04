import { describe, it, expect } from 'vitest';
import {
  extractHeadPoseFromMatrix,
  calculateGeometricHeadPose,
  evaluateLandmarkQuality,
  isValidMatrix4x4,
} from '../HeadPoseEstimator';

describe('HeadPoseEstimator - Matrix Decomposition', () => {
  it('correctly decomposes identity matrix to 0,0,0 Euler angles', () => {
    // 4x4 Identity Matrix (column-major)
    const identity = {
      data: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    };

    expect(isValidMatrix4x4(identity)).toBe(true);

    const pose = extractHeadPoseFromMatrix(identity);
    expect(pose.source).toBe('mediapipe-matrix');
    expect(pose.yawDeg).toBeCloseTo(0, 1);
    expect(pose.pitchDeg).toBeCloseTo(0, 1);
    expect(pose.rollDeg).toBeCloseTo(0, 1);
    expect(pose.confidence).toBeGreaterThan(0.5);
  });

  it('correctly extracts ~45 degree Yaw rotation', () => {
    // 4x4 rotation around Y-axis by +45 degrees (cos(45)=0.7071, sin(45)=0.7071)
    const c = Math.cos(Math.PI / 4);
    const s = Math.sin(Math.PI / 4);

    // Column-major Y-rotation matrix:
    // [ c, 0, -s, 0 ]
    // [ 0, 1,  0, 0 ]
    // [ s, 0,  c, 0 ]
    // [ 0, 0,  0, 1 ]
    // Col 0: [c, 0, s, 0], Col 1: [0, 1, 0, 0], Col 2: [-s, 0, c, 0], Col 3: [0, 0, 0, 1]
    const yRot45 = {
      data: [
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1,
      ],
    };

    const pose = extractHeadPoseFromMatrix(yRot45);
    expect(pose.source).toBe('mediapipe-matrix');
    expect(Math.abs(pose.yawDeg!)).toBeCloseTo(45, 1);
  });

  it('fails closed on null, undefined, or corrupt matrix', () => {
    const invalid1 = extractHeadPoseFromMatrix(null);
    expect(invalid1.source).toBe('unavailable');
    expect(invalid1.yawDeg).toBeNull();

    const invalid2 = extractHeadPoseFromMatrix({ data: [NaN, 0, 0, 0] });
    expect(invalid2.source).toBe('unavailable');
    expect(invalid2.yawDeg).toBeNull();
  });
});

describe('HeadPoseEstimator - Landmark Quality', () => {
  it('returns unavailable when landmark count is too low', () => {
    const quality = evaluateLandmarkQuality([]);
    expect(quality.available).toBe(false);
    expect(quality.requiredLandmarksPresent).toBe(false);
    expect(quality.confidence).toBe(0);
  });

  it('validates anatomical landmarks when 468 points are present', () => {
    const landmarks = Array.from({ length: 468 }, (_, i) => ({
      x: 0.5 + Math.sin(i) * 0.1,
      y: 0.5 + Math.cos(i) * 0.1,
      z: 0,
    }));

    const quality = evaluateLandmarkQuality(landmarks, 0.95);
    expect(quality.available).toBe(true);
    expect(quality.landmarkCount).toBe(468);
    expect(quality.confidence).toBeGreaterThan(0.5);
  });
});
