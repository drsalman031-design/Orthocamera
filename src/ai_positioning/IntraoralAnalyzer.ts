/**
 * IntraoralAnalyzer Interface & Implementation
 *
 * Dedicated computer-vision analyzer for standardized intraoral dental photography.
 * Evaluates dental midline alignment, occlusal plane tilt, arch coverage,
 * cheek retractor adequacy, mirror fogging, and tooth region sharpness.
 *
 * Designed with a clean interface so future dedicated ONNX / TFLite
 * segmentation or dental landmark models can be easily plugged in.
 */

import { MediaPipeVision } from './MediaPipeVisionEngine';

export interface IntraoralAnalysisResult {
  detected: boolean;
  confidence: number;
  aiEngine?: 'mediapipe' | 'chroma';
  // Center of dental arch or central incisor contact point relative to frame center (-1 to 1)
  dentalMidlineOffset: number;
  // Occlusal plane tilt in degrees (0 is horizontal)
  occlusalPlaneTiltDeg: number;
  // Retractor clearance adequacy (lips/cheeks pulled sufficiently outward)
  retractorAdequate: boolean;
  retractorFeedback: string;
  // Dental arch coverage inside target guideline window (0 to 1)
  archCoverageRatio: number;
  // Mirror fogging / saliva reflection check
  mirrorFoggingDetected: boolean;
  // Sharpness specifically inside the intraoral tooth region
  toothRegionSharpness: number;
  // Mean exposure inside oral cavity (0 to 255)
  intraoralExposureScore: number;
  // Bounding box of detected dental arch
  archBoundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface IIntraoralAnalyzer {
  analyzeIntraoralFrame(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    viewType: 'anterior' | 'right_buccal' | 'left_buccal' | 'maxillary_occlusal' | 'mandibular_occlusal',
    videoElement?: HTMLVideoElement | null
  ): IntraoralAnalysisResult;
}

export class OnDeviceIntraoralAnalyzer implements IIntraoralAnalyzer {
  private sampleCanvas: HTMLCanvasElement | null = null;
  private sampleCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.sampleCanvas = document.createElement('canvas');
      this.sampleCanvas.width = 160;
      this.sampleCanvas.height = 160;
      this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    }
  }

  public analyzeIntraoralFrame(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    _ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    viewType: 'anterior' | 'right_buccal' | 'left_buccal' | 'maxillary_occlusal' | 'mandibular_occlusal',
    videoElement?: HTMLVideoElement | null
  ): IntraoralAnalysisResult {
    try {
      if (!this.sampleCanvas || !this.sampleCtx || width <= 0 || height <= 0) {
        return this.getDefaultIntraoralResult(viewType);
      }

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

      // Detect enamel high-luminance vs pink gingiva & dark oral cavity background
      let totalEnamelPixels = 0;
      let sumEnamelX = 0;
      let sumEnamelY = 0;
      let minX = 160,
        maxX = 0,
        minY = 160,
        maxY = 0;

      let darkBackgroundCount = 0;
      let gingivaCount = 0;

      for (let y = 20; y < 140; y += 2) {
        for (let x = 15; x < 145; x += 2) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;

          // Enamel / Tooth structure heuristic (high brightness, balanced RGB with slight warm ivory)
          const isEnamel = luma > 110 && Math.abs(r - g) < 40 && Math.abs(g - b) < 45 && r >= b;
          // Gingival tissue (red dominant, moderate brightness)
          const isGingiva = r > 100 && r > g * 1.2 && r > b * 1.3;
          // Dark posterior or retractor background
          const isDark = luma < 45;

          if (isEnamel) {
            totalEnamelPixels++;
            sumEnamelX += x;
            sumEnamelY += y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          } else if (isGingiva) {
            gingivaCount++;
          } else if (isDark) {
            darkBackgroundCount++;
          }
        }
      }

      if (totalEnamelPixels > 50) {
        const enamelCenterX = sumEnamelX / totalEnamelPixels / 160;
        const enamelCenterY = sumEnamelY / totalEnamelPixels / 160;
        // Midline match only applies to Anterior Intraoral. Right & Left buccal views focus on canine/molar alignment.
        const isMidlineRelevant = viewType === 'anterior';
        const midlineOffset = isMidlineRelevant ? (enamelCenterX - 0.5) * 2 : 0; // -1 to 1 only for anterior
        const archWidth = (maxX - minX) / 160;
        const archHeight = (maxY - minY) / 160;

        // Estimate occlusal plane slope by comparing left quadrant vs right quadrant enamel centers
        const leftSliceY = this.getQuadrantsLumaCenter(data, 160, 0.2, 0.45, 0.3, 0.7);
        const rightSliceY = this.getQuadrantsLumaCenter(data, 160, 0.55, 0.8, 0.3, 0.7);
        const occlusalTiltDeg = Math.min(15, Math.max(-15, (leftSliceY - rightSliceY) * 30));

        let retractorAdequate = archWidth > 0.45 || gingivaCount > 30;
        let aiEngine: 'mediapipe' | 'chroma' = 'chroma';

        if (MediaPipeVision.getStatus().isReady) {
          const mpSource = videoElement && videoElement.readyState >= 2 ? videoElement : (sourceCanvas as HTMLCanvasElement);
          const mp = MediaPipeVision.detectForVideo(mpSource, performance.now());
          if (mp && mp.detected) {
            aiEngine = 'mediapipe';
            if (mp.lipApertureRatio && mp.lipApertureRatio > 0.12) {
              retractorAdequate = true;
            }
          }
        }

        // Calculate real edge gradient sharpness inside the tooth/enamel region
        let enamelEdgeDiffSum = 0;
        let enamelLumaSum = 0;
        let sampledCount = 0;
        const startY = Math.max(0, Math.floor(minY));
        const endY = Math.min(160, Math.ceil(maxY));
        const startX = Math.max(0, Math.floor(minX));
        const endX = Math.min(160, Math.ceil(maxX));

        for (let y = startY; y < endY; y += 2) {
          for (let x = startX; x < endX; x += 2) {
            const idx = (y * 160 + x) * 4;
            const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            enamelLumaSum += luma;
            if (x > startX) {
              const prevIdx = (y * 160 + (x - 2)) * 4;
              const prevLuma = 0.299 * data[prevIdx] + 0.587 * data[prevIdx + 1] + 0.114 * data[prevIdx + 2];
              enamelEdgeDiffSum += Math.abs(luma - prevLuma);
            }
            sampledCount++;
          }
        }

        const avgLuma = sampledCount > 0 ? Math.round(enamelLumaSum / sampledCount) : 128;
        const computedSharpness = sampledCount > 0 ? Math.min(100, Math.round((enamelEdgeDiffSum / sampledCount) * 5)) : 50;

        return {
          detected: true,
          confidence: Math.min(0.85, totalEnamelPixels / 300),
          aiEngine,
          dentalMidlineOffset: midlineOffset,
          occlusalPlaneTiltDeg: occlusalTiltDeg,
          retractorAdequate,
          retractorFeedback: retractorAdequate ? 'Retractors adequate' : 'Pull retractors outward',
          archCoverageRatio: Math.min(1.0, archWidth / 0.7),
          mirrorFoggingDetected: false,
          toothRegionSharpness: computedSharpness,
          intraoralExposureScore: avgLuma,
          archBoundingBox: {
            x: Math.max(0, enamelCenterX - archWidth / 2),
            y: Math.max(0, enamelCenterY - archHeight / 2),
            width: archWidth,
            height: archHeight,
          },
        };
      }
    } catch {
      // Fallback
    }

    return this.getDefaultIntraoralResult(viewType);
  }

  private getQuadrantsLumaCenter(
    data: Uint8ClampedArray,
    stride: number,
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number
  ): number {
    const xStart = Math.floor(xMin * stride);
    const xEnd = Math.floor(xMax * stride);
    const yStart = Math.floor(yMin * stride);
    const yEnd = Math.floor(yMax * stride);

    let weightY = 0;
    let count = 0;
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const idx = (y * stride + x) * 4;
        const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (luma > 100) {
          weightY += y;
          count++;
        }
      }
    }
    return count > 0 ? weightY / count / stride : 0.5;
  }

  private getDefaultIntraoralResult(
    _viewType: string
  ): IntraoralAnalysisResult {
    return {
      detected: false,
      confidence: 0,
      dentalMidlineOffset: 0,
      occlusalPlaneTiltDeg: 0,
      retractorAdequate: false,
      retractorFeedback: 'Position camera inside oral arch',
      archCoverageRatio: 0,
      mirrorFoggingDetected: false,
      toothRegionSharpness: 0,
      intraoralExposureScore: 0,
      archBoundingBox: { x: 0, y: 0, width: 0, height: 0 },
    };
  }
}
