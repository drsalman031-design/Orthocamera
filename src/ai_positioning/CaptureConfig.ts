/**
 * CaptureConfig.ts
 *
 * Centralized configuration profiles for OrthoCam positioning and capture gating:
 * - FAST: Rapid clinical capture (~1s), relaxed tolerances, accepts fallback detectors (native/chroma), low latency.
 * - BALANCED: Default operational profile (~1.5-2s), balanced tolerances, smooth guidance.
 * - CLINICAL: High-precision orthodontic publication standard (~2-3s), strict angular and landmark validation.
 */

export type CaptureMode = 'fast' | 'balanced' | 'clinical';

export interface CaptureModeSettings {
  mode: CaptureMode;
  name: string;
  description: string;
  enterReadyScore: number;
  exitReadyScore: number;
  stabilityConfirmationMs: number;
  jitterDebounceGraceMs: number;
  maxMotionScore: number;
  minSharpness: number;
  minLuminance: number;
  maxLuminance: number;
  centerToleranceMultiplier: number;
  angleToleranceMultiplier: number;
  distanceToleranceMultiplier: number;
  minSmileScore: number;
  allowFallbackDetectorCapture: boolean;
  minFallbackConfidence: number;
}

export const CAPTURE_MODE_CONFIGS: Record<CaptureMode, CaptureModeSettings> = {
  fast: {
    mode: 'fast',
    name: 'Fast Capture',
    description: 'Instant ~1s capture with relaxed tolerances. Best for busy clinics & fidgety patients.',
    enterReadyScore: 60,
    exitReadyScore: 50,
    stabilityConfirmationMs: 120,
    jitterDebounceGraceMs: 90,
    maxMotionScore: 30,
    minSharpness: 14,
    minLuminance: 25,
    maxLuminance: 245,
    centerToleranceMultiplier: 1.4,
    angleToleranceMultiplier: 1.5,
    distanceToleranceMultiplier: 1.35,
    minSmileScore: 0.15,
    allowFallbackDetectorCapture: true,
    minFallbackConfidence: 0.35,
  },
  balanced: {
    mode: 'balanced',
    name: 'Balanced (Recommended)',
    description: 'Optimal ~1.5–2s capture balancing high orthodontic quality with responsive auto-capture.',
    enterReadyScore: 70,
    exitReadyScore: 60,
    stabilityConfirmationMs: 180,
    jitterDebounceGraceMs: 70,
    maxMotionScore: 24,
    minSharpness: 16,
    minLuminance: 30,
    maxLuminance: 240,
    centerToleranceMultiplier: 1.15,
    angleToleranceMultiplier: 1.2,
    distanceToleranceMultiplier: 1.15,
    minSmileScore: 0.20,
    allowFallbackDetectorCapture: false,
    minFallbackConfidence: 0.50,
  },
  clinical: {
    mode: 'clinical',
    name: 'Strict Clinical',
    description: 'Gold-standard orthodontic audit profile. Requires strict landmark symmetry & MediaPipe 3D pose.',
    enterReadyScore: 80,
    exitReadyScore: 70,
    stabilityConfirmationMs: 250,
    jitterDebounceGraceMs: 50,
    maxMotionScore: 18,
    minSharpness: 18,
    minLuminance: 35,
    maxLuminance: 240,
    centerToleranceMultiplier: 1.0,
    angleToleranceMultiplier: 1.0,
    distanceToleranceMultiplier: 1.0,
    minSmileScore: 0.25,
    allowFallbackDetectorCapture: false,
    minFallbackConfidence: 0.70,
  },
};

export function getCaptureModeConfig(mode: CaptureMode = 'balanced'): CaptureModeSettings {
  return CAPTURE_MODE_CONFIGS[mode] || CAPTURE_MODE_CONFIGS.balanced;
}
