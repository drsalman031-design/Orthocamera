import { QualityCheckResult, ViewCategory } from '../types';

export class ImageQualityAnalyzer {
  /**
   * Evaluates image sharpness, luminance, orientation, and framing quality.
   * Never silently passes a corrupted or failed image.
   */
  public static analyzeImage(
    imageDataUrl: string,
    category: ViewCategory,
    tiltDeg: number = 0,
    coverageRatio: number = 0.7,
    motionScore: number = 0
  ): Promise<QualityCheckResult> {
    return new Promise((resolve) => {
      if (!imageDataUrl || imageDataUrl.length < 50) {
        resolve(this.getFailureResult(['INVALID_IMAGE_BUFFER', 'EMPTY_DATA_PAYLOAD']));
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const targetW = 320;
          const targetH = Math.round((img.height / img.width) * 320) || 240;
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d', { alpha: false });

          if (!ctx) {
            resolve(this.getFailureResult(['CANVAS_CONTEXT_UNAVAILABLE']));
            return;
          }

          ctx.drawImage(img, 0, 0, targetW, targetH);
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const data = imgData.data;

          // 1. Exposure analysis (mean luminance & histogram extremes)
          let totalLuma = 0;
          let underexposedPixels = 0;
          let blownPixels = 0;
          const totalPixels = targetW * targetH;

          for (let i = 0; i < data.length; i += 4) {
            const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            totalLuma += luma;
            if (luma < 25) underexposedPixels++;
            if (luma > 240) blownPixels++;
          }

          const meanLuminance = totalLuma / totalPixels;
          const underexposedRatio = underexposedPixels / totalPixels;
          const blownRatio = blownPixels / totalPixels;

          let exposurePassed = true;
          let exposureScore = 95;
          let exposureFeedback = 'Lighting balanced';

          if (meanLuminance < 65 || underexposedRatio > 0.35) {
            exposurePassed = false;
            exposureScore = Math.max(30, Math.round(meanLuminance * 1.1));
            exposureFeedback = 'Underexposed (Too dark). Increase clinical lighting.';
          } else if (meanLuminance > 215 || blownRatio > 0.25) {
            exposurePassed = false;
            exposureScore = Math.max(30, Math.round((255 - meanLuminance) * 1.5));
            exposureFeedback = 'Overexposed (Glare/Blown highlights). Adjust light angle.';
          }

          // 2. Sharpness & Motion Blur Analysis (Laplacian edge energy)
          let laplacianSum = 0;
          let laplacianCount = 0;
          const startX = Math.round(targetW * 0.2);
          const endX = Math.round(targetW * 0.8);
          const startY = Math.round(targetH * 0.2);
          const endY = Math.round(targetH * 0.8);

          for (let y = startY + 1; y < endY - 1; y += 2) {
            for (let x = startX + 1; x < endX - 1; x += 2) {
              const getLuma = (px: number, py: number) => {
                const idx = (py * targetW + px) * 4;
                return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              };

              const center = getLuma(x, y);
              const top = getLuma(x, y - 1);
              const bottom = getLuma(x, y + 1);
              const left = getLuma(x - 1, y);
              const right = getLuma(x + 1, y);

              const lap = Math.abs(top + bottom + left + right - 4 * center);
              laplacianSum += lap;
              laplacianCount++;
            }
          }

          const avgLaplacian = laplacianCount > 0 ? laplacianSum / laplacianCount : 15;
          let sharpnessPassed = true;
          let sharpnessScore = Math.min(100, Math.round(avgLaplacian * 4.5 + 40));
          let sharpnessFeedback = 'Sharp & in focus';

          if (avgLaplacian < 7.5 || motionScore > 25) {
            sharpnessPassed = false;
            sharpnessScore = Math.min(50, Math.round(avgLaplacian * 5));
            sharpnessFeedback = motionScore > 25
              ? 'Motion blur detected. Hold camera steady during capture.'
              : 'Image is out of focus. Tap screen to refocus.';
          }

          // 3. Orientation analysis
          const absTilt = Math.abs(tiltDeg);
          let orientationPassed = absTilt <= 6.5;
          let orientationScore = Math.max(35, Math.min(100, Math.round(100 - absTilt * 7)));
          let orientationFeedback = orientationPassed
            ? 'Horizontal plane level'
            : `Camera tilted by ${absTilt.toFixed(1)}°. Level camera with horizon.`;

          // 4. Position & Distance
          const minCoverage = category === 'extraoral' ? 0.45 : 0.55;
          const maxCoverage = category === 'extraoral' ? 0.90 : 1.15;
          let positionPassed = coverageRatio >= minCoverage && coverageRatio <= maxCoverage;
          let positionScore = positionPassed ? 92 : 55;
          let positionFeedback = 'Positioning aligned';

          if (coverageRatio < minCoverage) {
            positionPassed = false;
            positionScore = 48;
            positionFeedback = 'Subject too far. Move closer to fill template.';
          } else if (coverageRatio > maxCoverage) {
            positionPassed = false;
            positionScore = 52;
            positionFeedback = 'Subject too close. Step back slightly.';
          }

          // 5. Framing check
          let framingPassed = positionPassed && orientationPassed;
          let framingScore = Math.round((positionScore + orientationScore) / 2);
          let framingFeedback = framingPassed
            ? 'Framing within clinical guidelines'
            : 'Center subject within guidelines.';

          // Compile summary & reasons
          const reasons: string[] = [];
          if (!sharpnessPassed) reasons.push(sharpnessFeedback);
          if (!exposurePassed) reasons.push(exposureFeedback);
          if (!orientationPassed) reasons.push(orientationFeedback);
          if (!positionPassed) reasons.push(positionFeedback);

          const overallPassed =
            sharpnessPassed && exposurePassed && orientationPassed && positionPassed;

          const overallScore = Math.round(
            sharpnessScore * 0.35 +
            exposureScore * 0.25 +
            orientationScore * 0.15 +
            positionScore * 0.15 +
            framingScore * 0.1
          );

          resolve({
            overallPassed,
            overallScore: overallPassed ? Math.max(70, overallScore) : Math.min(65, overallScore),
            position: {
              passed: positionPassed,
              score: positionScore,
              label: 'Distance & Position',
              feedback: positionFeedback,
            },
            orientation: {
              passed: orientationPassed,
              score: orientationScore,
              label: 'Orientation & Tilt',
              feedback: orientationFeedback,
            },
            sharpness: {
              passed: sharpnessPassed,
              score: sharpnessScore,
              label: 'Sharpness & Motion',
              feedback: sharpnessFeedback,
            },
            exposure: {
              passed: exposurePassed,
              score: exposureScore,
              label: 'Clinical Exposure',
              feedback: exposureFeedback,
            },
            framing: {
              passed: framingPassed,
              score: framingScore,
              label: 'Orthodontic Framing',
              feedback: framingFeedback,
            },
            reasons,
            recommendation: overallPassed ? 'ACCEPT' : 'RETAKE',
          });
        } catch {
          resolve(this.getFailureResult(['ANALYSIS_EXCEPTION', 'UNPARSEABLE_FRAME_DATA']));
        }
      };

      img.onerror = () => {
        resolve(this.getFailureResult(['IMAGE_LOAD_FAILED', 'CORRUPT_BASE64_STREAM']));
      };

      img.src = imageDataUrl;
    });
  }

  /**
   * Explicit fail-safe response. Never returns ACCEPT on failure.
   */
  private static getFailureResult(diagnosticErrors: string[]): QualityCheckResult {
    return {
      overallPassed: false,
      overallScore: 0,
      position: { passed: false, score: 0, label: 'Distance & Position', feedback: 'Analysis failed' },
      orientation: { passed: false, score: 0, label: 'Orientation & Tilt', feedback: 'Analysis failed' },
      sharpness: { passed: false, score: 0, label: 'Sharpness & Motion', feedback: 'Cannot evaluate sharpness' },
      exposure: { passed: false, score: 0, label: 'Clinical Exposure', feedback: 'Cannot evaluate exposure' },
      framing: { passed: false, score: 0, label: 'Orthodontic Framing', feedback: 'Framing undetermined' },
      reasons: diagnosticErrors,
      recommendation: 'RETAKE',
    };
  }
}
