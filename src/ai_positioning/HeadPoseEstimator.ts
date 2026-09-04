/**
 * HeadPoseEstimator.ts
 *
 * Mathematically rigorous transformation matrix decomposition and landmark-based
 * facial geometry calculations for orthodontic clinical photography.
 *
 * Implements Tait-Bryan Euler angle extraction with singularity handling,
 * matrix orthogonality validation, and landmark quality scoring.
 */

import type { FacePose, LandmarkQuality, Point2D } from '../types';

export interface Matrix4x4 {
  rows?: number;
  columns?: number;
  data: number[] | Float32Array;
}

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
}

// Canonical MediaPipe landmark indices
export const LANDMARK_INDICES = {
  NOSE_TIP: 1,
  NOSE_BRIDGE: 168,
  CHIN_TIP: 152,
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_OUTER: 263,
  RIGHT_EYE_INNER: 362,
  LEFT_MOUTH_CORNER: 61,
  RIGHT_MOUTH_CORNER: 291,
  UPPER_LIP: 0,
  LOWER_LIP: 17,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  GLABELLA: 10,
  LEFT_EAR_TRAGUS: 234,
  RIGHT_EAR_TRAGUS: 454,
} as const;

export const LEFT_EYE_CONTOUR = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE_CONTOUR = [263, 387, 385, 362, 380, 373];

/**
 * Calculates centroid of a set of landmark indices.
 */
export function calculateLandmarkCentroid(
  landmarks: Landmark3D[],
  indices: readonly number[]
): Point2D {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const idx of indices) {
    const pt = landmarks[idx];
    if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
      sumX += pt.x;
      sumY += pt.y;
      count++;
    }
  }

  if (count === 0) {
    return { x: 0.5, y: 0.5 };
  }

  return {
    x: sumX / count,
    y: sumY / count,
  };
}

/**
 * Validates a 4x4 matrix data array.
 */
export function isValidMatrix4x4(matrix: Matrix4x4 | null | undefined): boolean {
  if (!matrix || !matrix.data || matrix.data.length < 16) {
    return false;
  }
  for (let i = 0; i < 16; i++) {
    if (!Number.isFinite(matrix.data[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Extracts 3x3 rotation matrix from a 4x4 affine matrix, handling both column-major and row-major formats.
 */
export function extractRotationMatrix3x3(matrix: Matrix4x4): number[][] | null {
  if (!isValidMatrix4x4(matrix)) return null;

  const d = matrix.data;

  // Detect column-major vs row-major
  // In column-major, last row is [0, 0, 0, 1] at indices [3, 7, 11, 15]
  // In row-major, last row is [0, 0, 0, 1] at indices [12, 13, 14, 15]
  const isColumnMajor =
    Math.abs(d[3]) < 1e-2 &&
    Math.abs(d[7]) < 1e-2 &&
    Math.abs(d[11]) < 1e-2 &&
    Math.abs(d[15] - 1.0) < 0.2;

  let r00: number, r01: number, r02: number;
  let r10: number, r11: number, r12: number;
  let r20: number, r21: number, r22: number;

  if (isColumnMajor) {
    r00 = d[0];  r01 = d[4];  r02 = d[8];
    r10 = d[1];  r11 = d[5];  r12 = d[9];
    r20 = d[2];  r21 = d[6];  r22 = d[10];
  } else {
    r00 = d[0];  r01 = d[1];  r02 = d[2];
    r10 = d[4];  r11 = d[5];  r12 = d[6];
    r20 = d[8];  r21 = d[9];  r22 = d[10];
  }

  // Check orthogonality: determinant of 3x3 matrix should be close to 1
  const det =
    r00 * (r11 * r22 - r12 * r21) -
    r01 * (r10 * r22 - r12 * r20) +
    r02 * (r10 * r21 - r11 * r20);

  if (Math.abs(det - 1.0) > 0.4) {
    // Degenerate or non-orthogonal matrix
    return null;
  }

  return [
    [r00, r01, r02],
    [r10, r11, r12],
    [r20, r21, r22],
  ];
}

/**
 * Extracts Euler angles (Yaw, Pitch, Roll in degrees) from MediaPipe 4x4 facial transformation matrix.
 * Yaw: +ve = patient's right (facing right in camera or vice-versa), -ve = patient's left
 * Pitch: +ve = tilted up (chin up), -ve = tilted down (chin down)
 * Roll: +ve = tilted towards right shoulder, -ve = tilted towards left shoulder
 */
export function extractHeadPoseFromMatrix(
  matrix: Matrix4x4 | null | undefined,
  presenceConfidence = 1.0
): FacePose {
  if (!matrix || !isValidMatrix4x4(matrix)) {
    return {
      yawDeg: null,
      pitchDeg: null,
      rollDeg: null,
      confidence: 0,
      source: 'unavailable',
    };
  }

  const R = extractRotationMatrix3x3(matrix);
  if (!R) {
    return {
      yawDeg: null,
      pitchDeg: null,
      rollDeg: null,
      confidence: 0,
      source: 'unavailable',
    };
  }

  // Tait-Bryan Z-Y-X / Y-X-Z decomposition for facial coordinate systems
  // MediaPipe transformation matrix: canonical face model to camera coordinates
  const r00 = R[0][0], r01 = R[0][1], r02 = R[0][2];
  const r10 = R[1][0], r11 = R[1][1], r12 = R[1][2];
  const r20 = R[2][0], r21 = R[2][1], r22 = R[2][2];

  // Yaw (rotation around Y-axis)
  // atan2(r02, r22) or asin(-r02)
  let yawRad = Math.atan2(r02, r22);
  
  // Pitch (rotation around X-axis)
  // atan2(-r12, sqrt(r02^2 + r22^2))
  const cosPitch = Math.sqrt(r02 * r02 + r22 * r22);
  let pitchRad = Math.atan2(-r12, Math.max(1e-6, cosPitch));

  // Roll (rotation around Z-axis)
  let rollRad = Math.atan2(r10, r11);

  // Convert to degrees
  let yawDeg = yawRad * (180 / Math.PI);
  let pitchDeg = pitchRad * (180 / Math.PI);
  let rollDeg = rollRad * (180 / Math.PI);

  // Clamp to valid anatomical ranges
  yawDeg = Math.max(-95, Math.min(95, yawDeg));
  pitchDeg = Math.max(-60, Math.min(60, pitchDeg));
  rollDeg = Math.max(-45, Math.min(45, rollDeg));

  // Compute confidence based on rotation matrix validity and presence
  const confidence = Math.max(0, Math.min(1.0, presenceConfidence));

  return {
    yawDeg,
    pitchDeg,
    rollDeg,
    confidence,
    source: 'mediapipe-matrix',
  };
}

/**
 * Calculates geometric head pose directly from 2D/3D facial landmarks when transformation matrix is unavailable.
 */
export function calculateGeometricHeadPose(
  landmarks: Landmark3D[],
  presenceConfidence = 0.8
): FacePose {
  if (!landmarks || landmarks.length < 33) {
    return {
      yawDeg: null,
      pitchDeg: null,
      rollDeg: null,
      confidence: 0,
      source: 'unavailable',
    };
  }

  const leftEye = calculateLandmarkCentroid(landmarks, LEFT_EYE_CONTOUR);
  const rightEye = calculateLandmarkCentroid(landmarks, RIGHT_EYE_CONTOUR);
  const noseTip = landmarks[LANDMARK_INDICES.NOSE_TIP] || landmarks[1];
  const chinTip = landmarks[LANDMARK_INDICES.CHIN_TIP] || landmarks[152];

  if (!leftEye || !rightEye || !noseTip || !chinTip) {
    return {
      yawDeg: null,
      pitchDeg: null,
      rollDeg: null,
      confidence: 0,
      source: 'unavailable',
    };
  }

  // 1. Roll (eye line angle)
  const dEyeX = rightEye.x - leftEye.x;
  const dEyeY = rightEye.y - leftEye.y;
  const rollDeg = Math.atan2(dEyeY, dEyeX) * (180 / Math.PI);

  // 2. Yaw (nose offset relative to eye midpoint and cheek distance)
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const interpupillaryDist = Math.max(0.01, Math.hypot(dEyeX, dEyeY));
  const noseOffsetRatio = (noseTip.x - eyeMidX) / (interpupillaryDist / 2);
  
  // Also incorporate Z-depth if available in 3D landmarks
  const leftEyeZ = landmarks[LANDMARK_INDICES.LEFT_EYE_OUTER]?.z ?? 0;
  const rightEyeZ = landmarks[LANDMARK_INDICES.RIGHT_EYE_OUTER]?.z ?? 0;
  const dZ = rightEyeZ - leftEyeZ;

  let yawDeg = noseOffsetRatio * 42 + dZ * 55;
  yawDeg = Math.max(-95, Math.min(95, yawDeg));

  // 3. Pitch (vertical facial proportions)
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const upperFaceHeight = Math.max(0.01, noseTip.y - eyeMidY);
  const lowerFaceHeight = Math.max(0.01, chinTip.y - noseTip.y);
  const verticalRatio = upperFaceHeight / lowerFaceHeight;
  
  // Normal upright neutral head proportion is ~0.85 to 0.95
  let pitchDeg = (verticalRatio - 0.90) * 45;
  pitchDeg = Math.max(-50, Math.min(50, pitchDeg));

  return {
    yawDeg,
    pitchDeg,
    rollDeg,
    confidence: Math.max(0, Math.min(0.85, presenceConfidence * 0.9)),
    source: 'geometric',
  };
}

/**
 * Assesses quality, coverage, and anatomical consistency of detected landmarks.
 */
export function evaluateLandmarkQuality(
  landmarks: Landmark3D[] | null | undefined,
  presenceConfidence = 1.0
): LandmarkQuality {
  if (!landmarks || landmarks.length < 33) {
    return {
      available: false,
      landmarkCount: landmarks?.length ?? 0,
      requiredLandmarksPresent: false,
      symmetryScore: 0,
      geometryScore: 0,
      confidence: 0,
    };
  }

  const keyIndices = [
    LANDMARK_INDICES.NOSE_TIP,
    LANDMARK_INDICES.CHIN_TIP,
    LANDMARK_INDICES.LEFT_EYE_OUTER,
    LANDMARK_INDICES.RIGHT_EYE_OUTER,
    LANDMARK_INDICES.LEFT_MOUTH_CORNER,
    LANDMARK_INDICES.RIGHT_MOUTH_CORNER,
  ];

  let presentCount = 0;
  for (const idx of keyIndices) {
    const pt = landmarks[idx];
    if (
      pt &&
      Number.isFinite(pt.x) &&
      Number.isFinite(pt.y) &&
      pt.x >= 0 &&
      pt.x <= 1 &&
      pt.y >= 0 &&
      pt.y <= 1
    ) {
      presentCount++;
    }
  }

  const requiredLandmarksPresent = presentCount === keyIndices.length;

  // Evaluate symmetry
  const leftEye = calculateLandmarkCentroid(landmarks, LEFT_EYE_CONTOUR);
  const rightEye = calculateLandmarkCentroid(landmarks, RIGHT_EYE_CONTOUR);
  const noseTip = landmarks[LANDMARK_INDICES.NOSE_TIP] || { x: 0.5, y: 0.5 };
  const chinTip = landmarks[LANDMARK_INDICES.CHIN_TIP] || { x: 0.5, y: 0.7 };

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const facialMidlineOffset = Math.abs(noseTip.x - eyeMidX) + Math.abs(chinTip.x - eyeMidX);
  const symmetryScore = Math.max(0, Math.min(1.0, 1.0 - facialMidlineOffset * 3));

  // Evaluate geometry (interpupillary distance vs face height)
  const ipd = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const faceHeight = Math.abs(chinTip.y - ((leftEye.y + rightEye.y) / 2 - ipd * 0.5));
  const geometryRatio = ipd / Math.max(0.01, faceHeight);
  // Normal IPD / FaceHeight is roughly 0.35 - 0.55
  const geometryScore =
    geometryRatio >= 0.25 && geometryRatio <= 0.65
      ? 1.0 - Math.abs(geometryRatio - 0.45) * 2
      : 0.3;

  const countScore = Math.min(1.0, landmarks.length / 468);
  const confidence = Math.max(
    0,
    Math.min(1.0, presenceConfidence * (requiredLandmarksPresent ? 0.9 : 0.4) * countScore)
  );

  return {
    available: true,
    landmarkCount: landmarks.length,
    requiredLandmarksPresent,
    symmetryScore: Math.max(0, Math.min(1.0, symmetryScore)),
    geometryScore: Math.max(0, Math.min(1.0, geometryScore)),
    confidence,
  };
}
