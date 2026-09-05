/**
 * FaceAnalyzer Interface & Implementation
 *
 * Provides real-time on-device face tracking, landmark geometry,
 * and head pose estimation (Yaw, Pitch, Roll, Centering, Distance Proxy)
 * for standardized Extraoral Orthodontic Photography.
 */

import { MediaPipeVision } from './MediaPipeVisionEngine';
import type { FacePose, LandmarkQuality, MeshContours } from '../types';

export interface FaceAnalysisResult {
  detected: boolean;
  confidence: number;
  aiEngine?: 'mediapipe' | 'native' | 'chroma';
  // Bounding box in normalized coordinates (0 to 1)
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Facial center in normalized coordinates (0 to 1)
  center: { x: number; y: number };
  // Estimated head pose angles in degrees
  yawDeg: number; // Head turn left (-ve) / right (+ve)
  pitchDeg: number; // Head tilt up (+ve) / down (-ve)
  rollDeg: number; // Head roll/cant left (-ve) / right (+ve)
  // Distance proxy (fraction of screen height occupied by face oval)
  faceHeightRatio: number;
  // Smile detection score (0 to 1)
  smileScore: number;
  // Interpupillary line tilt in degrees
  eyeLineAngleDeg: number;
  // Lip aperture / strain ratio (0: tight/touching, 1: wide open)
  lipApertureRatio?: number;
  meshContours?: MeshContours;
  // Landmark coordinates normalized (only present if truly detected by ML/vision)
  landmarks?: {
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
    noseTip?: { x: number; y: number };
    mouthCenter?: { x: number; y: number };
    chinTip?: { x: number; y: number };
    leftCheek?: { x: number; y: number };
    rightCheek?: { x: number; y: number };
    leftMouthCorner?: { x: number; y: number };
    rightMouthCorner?: { x: number; y: number };
    upperLip?: { x: number; y: number };
    lowerLip?: { x: number; y: number };
    subnasale?: { x: number; y: number };
    menton?: { x: number; y: number };
    leftTragus?: { x: number; y: number };
    rightTragus?: { x: number; y: number };
    leftGonion?: { x: number; y: number };
    rightGonion?: { x: number; y: number };
  };
  pose?: FacePose;
  landmarkQuality?: LandmarkQuality;
}

export interface IFaceAnalyzer {
  analyzeFrame(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    videoElement?: HTMLVideoElement | null
  ): FaceAnalysisResult;
}

export class OnDeviceFaceAnalyzer implements IFaceAnalyzer {
  private sampleCanvas: HTMLCanvasElement | null = null;
  private sampleCtx: CanvasRenderingContext2D | null = null;
  private nativeDetector: any = null;
  private lastNativeResult: FaceAnalysisResult | null = null;
  private isNativeDetecting = false;
  private lastNativeTimestamp = 0;

  constructor() {
    if (typeof document !== 'undefined') {
      this.sampleCanvas = document.createElement('canvas');
      this.sampleCanvas.width = 160;
      this.sampleCanvas.height = 160;
      this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    }

    // Initialize Chromium / Android Shape Detection API if available
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        const FaceDetectorCtor = (window as unknown as { FaceDetector: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => any }).FaceDetector;
        this.nativeDetector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        this.nativeDetector = null;
      }
    }
  }

  public analyzeFrame(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    _ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    videoElement?: HTMLVideoElement | null
  ): FaceAnalysisResult {
    try {
      if (!this.sampleCanvas || !this.sampleCtx || width <= 0 || height <= 0) {
        return this.getUndetectedResult();
      }

      const now = performance.now();

      // 1. Check MediaPipe on-device ML FaceLandmarker first (preferred high-quality detector)
      if (MediaPipeVision.getStatus().isReady) {
        // Prioritize downsampled sourceCanvas to eliminate massive 1080p GPU texture uploads and thermal throttle
        const mpSource =
          sourceCanvas instanceof HTMLCanvasElement && sourceCanvas.width > 0
            ? sourceCanvas
            : (videoElement && videoElement.readyState >= 2 && videoElement.videoWidth > 0 ? videoElement : null);

        if (mpSource) {
          const mpResult = MediaPipeVision.detectForVideo(mpSource, now);
          if (mpResult && mpResult.detected) {
            return {
              ...mpResult,
              aiEngine: 'mediapipe',
            };
          }
        }
      }

      // 2. Asynchronous probe with native browser FaceDetector when supported
      if (this.nativeDetector && !this.isNativeDetecting && now - this.lastNativeTimestamp > 120) {
        this.isNativeDetecting = true;
        this.lastNativeTimestamp = now;
        this.nativeDetector
          .detect(sourceCanvas)
          .then((faces: any[]) => {
            this.isNativeDetecting = false;
            if (faces && faces.length > 0) {
              const face = faces[0];
              const box = face.boundingBox;
              const normBox = {
                x: Math.max(0, box.x / width),
                y: Math.max(0, box.y / height),
                width: Math.min(1, box.width / width),
                height: Math.min(1, box.height / height),
              };
              const center = {
                x: normBox.x + normBox.width / 2,
                y: normBox.y + normBox.height / 2,
              };

              let leftEye: { x: number; y: number } | undefined;
              let rightEye: { x: number; y: number } | undefined;
              let mouth: { x: number; y: number } | undefined;
              let eyeLineAngleDeg = 0;

              if (face.landmarks && Array.isArray(face.landmarks)) {
                for (const lm of face.landmarks) {
                  if (lm.type === 'eye' && lm.locations && lm.locations.length > 0) {
                    const pt = { x: lm.locations[0].x / width, y: lm.locations[0].y / height };
                    if (!leftEye) {
                      leftEye = pt;
                    } else if (pt.x < leftEye.x) {
                      rightEye = leftEye;
                      leftEye = pt;
                    } else {
                      rightEye = pt;
                    }
                  } else if (lm.type === 'mouth' && lm.locations && lm.locations.length > 0) {
                    mouth = { x: lm.locations[0].x / width, y: lm.locations[0].y / height };
                  }
                }
                if (leftEye && rightEye) {
                  const dy = rightEye.y - leftEye.y;
                  const dx = rightEye.x - leftEye.x;
                  eyeLineAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                }
              }

              // Only include genuine landmarks returned by native detector.
              // NEVER fabricate missing noseTip, chinTip, or mouthCenter coordinates from bounding box centers or offsets.
              const hasAnyLandmark = !!(leftEye || rightEye || mouth);
              const detectedLandmarks = hasAnyLandmark
                ? {
                    leftEye,
                    rightEye,
                    mouthCenter: mouth,
                    // noseTip, chinTip, etc. are not detected by native FaceDetector and are strictly left undefined
                  }
                : undefined;

              const landmarkCount = (leftEye ? 1 : 0) + (rightEye ? 1 : 0) + (mouth ? 1 : 0);

              this.lastNativeResult = {
                detected: true,
                confidence: 0.5,
                aiEngine: 'native',
                boundingBox: normBox,
                center,
                yawDeg: 0,
                pitchDeg: 0,
                rollDeg: eyeLineAngleDeg,
                faceHeightRatio: normBox.height,
                smileScore: 0.0,
                eyeLineAngleDeg,
                landmarks: detectedLandmarks,
                pose: {
                  yawDeg: null, // Native 2D detector cannot measure 3D yaw/pitch
                  pitchDeg: null,
                  rollDeg: eyeLineAngleDeg,
                  confidence: 0.3,
                  source: 'unavailable',
                },
                landmarkQuality: {
                  available: false, // Incomplete 2D landmarks cannot be marked as available for clinical capture
                  landmarkCount,
                  requiredLandmarksPresent: false, // Incomplete
                  symmetryScore: leftEye && rightEye ? 0.5 : 0.2,
                  geometryScore: 0.2,
                  confidence: 0.2,
                },
              };
            } else {
              this.lastNativeResult = null;
            }
          })
          .catch(() => {
            this.isNativeDetecting = false;
          });
      }

      if (this.lastNativeResult && this.lastNativeResult.detected) {
        return this.lastNativeResult;
      }

      // 3. Fallback: Fast RGB chromaticity locator for rough visual centering only
      this.sampleCtx.drawImage(
        sourceCanvas as CanvasImageSource,
        0,
        0,
        width,
        height,
        0,
        0,
        160,
        160
      );

      const imgData = this.sampleCtx.getImageData(0, 0, 160, 160);
      const data = imgData.data;

      let totalSkinWeight = 0;
      let weightedX = 0;
      let weightedY = 0;
      let minX = 160,
        maxX = 0,
        minY = 160,
        maxY = 0;

      for (let y = 10; y < 150; y += 2) {
        for (let x = 10; x < 150; x += 2) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const sum = r + g + b;
          if (sum > 60 && sum < 700) {
            const nr = r / sum;
            const ng = g / sum;
            const isSkin = nr > 0.35 && nr < 0.6 && ng > 0.25 && ng < 0.4 && r > g && g > b;

            if (isSkin) {
              totalSkinWeight++;
              weightedX += x;
              weightedY += y;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
      }

      if (totalSkinWeight > 80) {
        const cx = weightedX / totalSkinWeight / 160;
        const cy = weightedY / totalSkinWeight / 160;
        const faceW = Math.max(0.15, (maxX - minX) / 160);
        const faceH = Math.max(0.2, (maxY - minY) / 160);

        // Chromaticity detection provides bounding box only, NEVER fabricated landmarks or fake 3D pose
        return {
          detected: true,
          confidence: Math.min(0.4, totalSkinWeight / 800),
          aiEngine: 'chroma',
          boundingBox: {
            x: Math.max(0, cx - faceW / 2),
            y: Math.max(0, cy - faceH / 2),
            width: faceW,
            height: faceH,
          },
          center: { x: cx, y: cy },
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          faceHeightRatio: faceH,
          smileScore: 0,
          eyeLineAngleDeg: 0,
          // Landmarks and detailed pose are explicitly undefined/unavailable to prevent false capture gates
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
      }
    } catch {
      // Fallback on error
    }

    return this.getUndetectedResult();
  }

  private getUndetectedResult(): FaceAnalysisResult {
    return {
      detected: false,
      confidence: 0,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      center: { x: 0.5, y: 0.5 },
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      faceHeightRatio: 0,
      smileScore: 0,
      eyeLineAngleDeg: 0,
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
  }
}

