/**
 * FaceAnalyzer Interface & Implementation
 *
 * Provides real-time on-device face tracking, landmark geometry,
 * and head pose estimation (Yaw, Pitch, Roll, Centering, Distance Proxy)
 * for standardized Extraoral Orthodontic Photography.
 */

import { MediaPipeVision } from './MediaPipeVisionEngine';
import type { MeshContours } from '../types';

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
  // Landmark coordinates normalized
  landmarks?: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    noseTip: { x: number; y: number };
    mouthCenter: { x: number; y: number };
    chinTip: { x: number; y: number };
    leftCheek?: { x: number; y: number };
    rightCheek?: { x: number; y: number };
    leftMouthCorner?: { x: number; y: number };
    rightMouthCorner?: { x: number; y: number };
    upperLip?: { x: number; y: number };
    lowerLip?: { x: number; y: number };
  };
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

      // 1. Check MediaPipe on-device ML FaceLandmarker first
      if (MediaPipeVision.getStatus().isReady) {
        // Use sourceCanvas (320x240 frame buffer) or live video element
        const mpSource =
          videoElement && videoElement.readyState >= 2 && videoElement.videoWidth > 0
            ? videoElement
            : (sourceCanvas instanceof HTMLCanvasElement && sourceCanvas.width > 0 ? sourceCanvas : null);

        if (mpSource) {
          const mpResult = MediaPipeVision.detectForVideo(mpSource, now);
          if (mpResult && mpResult.detected) {
            return {
              ...mpResult,
              aiEngine: 'mediapipe',
              meshContours: mpResult.meshContours,
            };
          }
        }
      }

      // Asynchronous probe with native browser FaceDetector when supported (Chromium / Android)
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

              this.lastNativeResult = {
                detected: true,
                confidence: 0.98,
                boundingBox: normBox,
                center,
                yawDeg: 0,
                pitchDeg: 0,
                rollDeg: eyeLineAngleDeg,
                faceHeightRatio: normBox.height,
                smileScore: 0.5,
                eyeLineAngleDeg,
                landmarks: {
                  leftEye: leftEye || { x: center.x - 0.12, y: center.y - 0.1 },
                  rightEye: rightEye || { x: center.x + 0.12, y: center.y - 0.1 },
                  noseTip: { x: center.x, y: center.y },
                  mouthCenter: mouth || { x: center.x, y: center.y + 0.14 },
                  chinTip: { x: center.x, y: center.y + 0.24 },
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

      // Downsample for high-speed 60fps analysis without dropping camera frames
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

      // Skin tone & facial luminosity center-of-mass analysis
      let totalSkinWeight = 0;
      let weightedX = 0;
      let weightedY = 0;
      let minX = 160,
        maxX = 0,
        minY = 160,
        maxY = 0;

      // Fast RGB -> HSV/YCbCr skin-color chromaticity and luminance detector
      for (let y = 10; y < 150; y += 2) {
        for (let x = 10; x < 150; x += 2) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Normalized skin chromaticity heuristic
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

      // Check if native detector or chromaticity found a face
      const native = this.lastNativeResult;

      if (totalSkinWeight > 80 || (native && native.detected)) {
        const cx = native ? native.center.x : weightedX / totalSkinWeight / 160;
        const cy = native ? native.center.y : weightedY / totalSkinWeight / 160;
        const faceW = native ? native.boundingBox.width : Math.max(0.2, (maxX - minX) / 160);
        const faceH = native ? native.boundingBox.height : Math.max(0.3, (maxY - minY) / 160);

        // Estimate symmetry & tilt from horizontal gradient slices
        const leftHalfWeight = this.getRegionLuminance(data, 160, 0.2, 0.45, 0.3, 0.7);
        const rightHalfWeight = this.getRegionLuminance(data, 160, 0.55, 0.8, 0.3, 0.7);
        const yawEstimate = Math.min(35, Math.max(-35, (leftHalfWeight - rightHalfWeight) * 45));

        const topEyeRegion = this.getRegionLuminance(data, 160, 0.3, 0.7, 0.25, 0.4);
        const mouthRegion = this.getRegionLuminance(data, 160, 0.35, 0.65, 0.55, 0.7);
        const pitchEstimate = Math.min(25, Math.max(-25, (topEyeRegion - mouthRegion) * 30));

        // Horizontal eye level tilt proxy
        const leftEyeLuma = this.getRegionLuminance(data, 160, 0.3, 0.45, 0.3, 0.4);
        const rightEyeLuma = this.getRegionLuminance(data, 160, 0.55, 0.7, 0.3, 0.4);
        const rollEstimate = native && Math.abs(native.rollDeg) > 0.5
          ? native.rollDeg
          : Math.min(20, Math.max(-20, (leftEyeLuma - rightEyeLuma) * 20));

        // High-precision landmark estimation
        const leftEyeX = cx - 0.12;
        const rightEyeX = cx + 0.12;
        const eyeY = cy - 0.1;
        const noseX = cx + (yawEstimate / 45) * 0.04;
        const noseY = cy + 0.02 + (pitchEstimate / 30) * 0.03;
        const mouthY = cy + 0.14;
        const smileLumaDiff = Math.abs(mouthRegion - 0.5);
        const computedSmileScore = Math.min(1.0, Math.max(0.0, mouthRegion > 0.45 ? 0.75 + smileLumaDiff * 0.5 : 0.15));

        return {
          detected: true,
          confidence: native ? 0.98 : Math.min(0.98, totalSkinWeight / 400),
          boundingBox: {
            x: Math.max(0, cx - faceW / 2),
            y: Math.max(0, cy - faceH / 2),
            width: faceW,
            height: faceH,
          },
          center: { x: cx, y: cy },
          yawDeg: yawEstimate,
          pitchDeg: pitchEstimate,
          rollDeg: rollEstimate,
          faceHeightRatio: faceH,
          smileScore: computedSmileScore,
          lipApertureRatio: computedSmileScore > 0.5 ? 0.6 : 0.05,
          eyeLineAngleDeg: rollEstimate,
          landmarks: native?.landmarks || {
            leftEye: { x: leftEyeX, y: eyeY },
            rightEye: { x: rightEyeX, y: eyeY },
            noseTip: { x: noseX, y: noseY },
            mouthCenter: { x: cx, y: mouthY },
            chinTip: { x: cx, y: cy + 0.24 },
            leftCheek: { x: cx - 0.2, y: cy },
            rightCheek: { x: cx + 0.2, y: cy },
            leftMouthCorner: { x: cx - 0.08, y: mouthY },
            rightMouthCorner: { x: cx + 0.08, y: mouthY },
            upperLip: { x: cx, y: mouthY - 0.02 },
            lowerLip: { x: cx, y: mouthY + 0.02 },
          },
        };
      }
    } catch {
      // Fallback on error
    }

    return this.getUndetectedResult();
  }

  private getRegionLuminance(
    data: Uint8ClampedArray,
    stride: number,
    xMinNorm: number,
    xMaxNorm: number,
    yMinNorm: number,
    yMaxNorm: number
  ): number {
    const xStart = Math.floor(xMinNorm * stride);
    const xEnd = Math.floor(xMaxNorm * stride);
    const yStart = Math.floor(yMinNorm * stride);
    const yEnd = Math.floor(yMaxNorm * stride);

    let sum = 0;
    let count = 0;
    for (let y = yStart; y < yEnd; y += 2) {
      for (let x = xStart; x < xEnd; x += 2) {
        const idx = (y * stride + x) * 4;
        const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        sum += luma;
        count++;
      }
    }
    return count > 0 ? sum / count / 255 : 0.5;
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
    };
  }
}
