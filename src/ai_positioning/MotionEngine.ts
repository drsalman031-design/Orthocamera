/**
 * MotionEngine.ts
 *
 * Real-time frame-to-frame optical motion stability detector.
 * Prevents camera shutter activation during hand tremors, device jitter, or patient movement.
 *
 * Evaluates Sum of Absolute Differences (SAD) across downsampled grayscale frame buffers.
 * Pauses auto-capture countdown when motion exceeds clinical threshold.
 */

export interface MotionAnalysisResult {
  analysisAvailable: boolean;
  confidence: number;
  motionScore: number; // 0 (completely static) to 100 (rapid motion)
  isStable: boolean; // True if motion is below threshold and at least 2 frames compared
  motionDetected: boolean;
  status: 'STATIC' | 'LOW_MOTION' | 'HIGH_MOTION' | 'UNAVAILABLE';
  measuredLuminance: number; // Mean luminance 0-255
  measuredSharpness: number; // Edge sharpness score 0-100
}

export class MotionEngine {
  private prevLumaBuffer: Uint8Array | null = null;
  private currentLumaBuffer: Uint8Array = new Uint8Array(80 * 60);
  private readonly bufferWidth = 80;
  private readonly bufferHeight = 60;
  private readonly staticThreshold = 14; // Below 14 is clinically stable for capture
  private readonly highMotionThreshold = 28;

  private recentScores: number[] = [];
  private readonly historySize = 5;

  /**
   * Evaluates motion between the current frame and the previous frame
   * using a downsampled 80x60 luminance grid. Also computes luminance and sharpness
   * in a single pass to eliminate redundant getImageData reads.
   */
  public evaluateFrameMotion(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ): MotionAnalysisResult {
    try {
      if (!ctx || canvasWidth <= 0 || canvasHeight <= 0) {
        return this.getUnavailableResult();
      }

      // Sample a downscaled 80x60 grid from the center 70% of the canvas
      const cropX = Math.round(canvasWidth * 0.15);
      const cropY = Math.round(canvasHeight * 0.15);
      const cropW = Math.round(canvasWidth * 0.7);
      const cropH = Math.round(canvasHeight * 0.7);

      if (cropW <= 0 || cropH <= 0) {
        return this.getUnavailableResult();
      }

      const frameData = ctx.getImageData(cropX, cropY, cropW, cropH);
      const data = frameData.data;

      const currentLuma = this.currentLumaBuffer;
      const stepX = cropW / this.bufferWidth;
      const stepY = cropH / this.bufferHeight;

      let idx = 0;
      let sumLuma = 0;
      let edgeSum = 0;

      for (let y = 0; y < this.bufferHeight; y++) {
        const srcY = Math.floor(y * stepY);
        for (let x = 0; x < this.bufferWidth; x++) {
          const srcX = Math.floor(x * stepX);
          const pixelIdx = (srcY * cropW + srcX) * 4;
          // Standard ITU-R BT.601 luma calculation
          const luma = Math.round(
            0.299 * data[pixelIdx] + 0.587 * data[pixelIdx + 1] + 0.114 * data[pixelIdx + 2]
          );
          currentLuma[idx++] = luma;
          sumLuma += luma;

          // Compute horizontal edge gradient for sharpness
          if (x > 0) {
            edgeSum += Math.abs(luma - currentLuma[idx - 2]);
          }
        }
      }

      const totalPixels = currentLuma.length;
      const measuredLuminance = Math.round(sumLuma / totalPixels);
      const measuredSharpness = Math.min(100, Math.round((edgeSum / totalPixels) * 5));

      // If no previous frame, initialize buffer and return isStable = false (needs 2 frames to measure motion)
      if (!this.prevLumaBuffer || this.prevLumaBuffer.length !== currentLuma.length) {
        this.prevLumaBuffer = new Uint8Array(this.bufferWidth * this.bufferHeight);
        this.prevLumaBuffer.set(currentLuma);
        return {
          analysisAvailable: true,
          confidence: 0.5,
          motionScore: 0,
          isStable: false, // Must not claim stable on 1st frame before delta is verified
          motionDetected: false,
          status: 'LOW_MOTION',
          measuredLuminance,
          measuredSharpness,
        };
      }

      // Compute Sum of Absolute Differences (SAD)
      let diffSum = 0;
      for (let i = 0; i < totalPixels; i++) {
        diffSum += Math.abs(currentLuma[i] - this.prevLumaBuffer[i]);
      }

      // Update buffer
      this.prevLumaBuffer.set(currentLuma);

      // Normalize diff to a 0-100 scale
      const meanDiff = diffSum / totalPixels;
      const rawScore = Math.min(100, Math.round(meanDiff * 4));

      // Rolling average smoothing to prevent single-frame noise spikes
      this.recentScores.push(rawScore);
      if (this.recentScores.length > this.historySize) {
        this.recentScores.shift();
      }

      const smoothedScore = Math.round(
        this.recentScores.reduce((a, b) => a + b, 0) / this.recentScores.length
      );

      const isStable = smoothedScore < this.staticThreshold && this.recentScores.length >= 2;
      const isHighMotion = smoothedScore >= this.highMotionThreshold;

      return {
        analysisAvailable: true,
        confidence: Math.min(1.0, 0.4 + this.recentScores.length * 0.15),
        motionScore: smoothedScore,
        isStable,
        motionDetected: !isStable,
        status: isHighMotion ? 'HIGH_MOTION' : isStable ? 'STATIC' : 'LOW_MOTION',
        measuredLuminance,
        measuredSharpness,
      };
    } catch {
      return this.getUnavailableResult();
    }
  }

  public getUnavailableResult(): MotionAnalysisResult {
    return {
      analysisAvailable: false,
      confidence: 0,
      motionScore: 100,
      isStable: false,
      motionDetected: true,
      status: 'UNAVAILABLE',
      measuredLuminance: 0,
      measuredSharpness: 0,
    };
  }

  public reset(): void {
    this.prevLumaBuffer = null;
    this.recentScores = [];
  }
}

