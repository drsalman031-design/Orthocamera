/**
 * ProfileFallbackEngine.ts
 *
 * Robust state machine for 90° Lateral Profiles (Right & Left Profile views).
 *
 * MediaPipe 468-point 3D facial mesh drops landmark confidence when the face rotates
 * past 70-75° yaw because the contralateral eye and cheek are fully occluded.
 *
 * This engine tracks:
 * - State: TRACKING | TEMPORARILY_LOST | INVALID_POSITION
 * - Retains last known stable head orientation and lateral silhouette contour for up to 1200ms
 * - Distinguishes temporary occlusion from actual patient movement.
 */

import { FaceAnalysisResult } from './FaceAnalyzer';

export type ProfileTrackingState = 'TRACKING' | 'TEMPORARILY_LOST' | 'INVALID_POSITION';

export interface ProfileStateResult {
  state: ProfileTrackingState;
  estimatedYaw: number;
  estimatedRoll: number;
  confidence: number;
  isProfileAligned: boolean;
  isFresh: boolean;
  isCaptureEligible: boolean;
  guidanceMessage: string;
}

export class ProfileFallbackEngine {
  private lastStableResult: FaceAnalysisResult | null = null;
  private lastStableTimestamp: number = 0;
  private readonly persistenceWindowMs = 1000; // 1.0s UI smoothing window
  private currentState: ProfileTrackingState = 'INVALID_POSITION';

  public evaluateProfile(
    isRightProfile: boolean,
    currentResult: FaceAnalysisResult | null,
    timestamp: number = Date.now(),
    captureMode: 'fast' | 'balanced' | 'clinical' = 'balanced'
  ): ProfileStateResult {
    // Fast mode allows 68°-110° yaw with 12° roll; Balanced/Clinical strictly enforces 75°-105° with 8° roll
    const minProfileYaw = captureMode === 'fast' ? 68 : 75;
    const maxProfileYaw = captureMode === 'fast' ? 110 : 105;
    const maxRoll = captureMode === 'fast' ? 12 : 8;

    if (currentResult && currentResult.detected && currentResult.confidence >= 0.35) {
      const currentYaw = currentResult.yawDeg;
      const currentRoll = currentResult.rollDeg;
      const matchesDirection = isRightProfile ? currentYaw > 25 : currentYaw < -25;

      if (matchesDirection) {
        // Active fresh tracking
        this.lastStableResult = currentResult;
        this.lastStableTimestamp = timestamp;
        this.currentState = 'TRACKING';

        const isFullyTurned = isRightProfile
          ? currentYaw >= minProfileYaw && currentYaw <= maxProfileYaw
          : currentYaw <= -minProfileYaw && currentYaw >= -maxProfileYaw;

        const isOverTurned = isRightProfile
          ? currentYaw > maxProfileYaw
          : currentYaw < -maxProfileYaw;

        const isRollLevel = Math.abs(currentRoll) <= maxRoll;
        const isAligned = isFullyTurned && isRollLevel;

        let guidanceMessage = 'Profile Aligned ✓';
        if (!isFullyTurned) {
          if (isOverTurned) {
            guidanceMessage = 'Turn slightly back toward center';
          } else {
            guidanceMessage = isRightProfile
              ? 'Turn patient further right (target ~90° profile)'
              : 'Turn patient further left (target ~90° profile)';
          }
        } else if (!isRollLevel) {
          guidanceMessage = 'Level patient head';
        }

        return {
          state: 'TRACKING',
          estimatedYaw: currentYaw,
          estimatedRoll: currentRoll,
          confidence: currentResult.confidence,
          isProfileAligned: isAligned,
          isFresh: true,
          isCaptureEligible: isAligned,
          guidanceMessage,
        };
      }
    }

    // MediaPipe dropped tracking (common at lateral profile)
    // Retain pose for UI overlay smoothing ONLY, but mark capture ineligible (fail-closed)
    if (this.lastStableResult && timestamp - this.lastStableTimestamp <= this.persistenceWindowMs) {
      this.currentState = 'TEMPORARILY_LOST';
      const decayRatio = (timestamp - this.lastStableTimestamp) / this.persistenceWindowMs;
      const decayedConfidence = Math.max(0.1, (this.lastStableResult.confidence || 0.6) * (1 - decayRatio));

      return {
        state: 'TEMPORARILY_LOST',
        estimatedYaw: this.lastStableResult.yawDeg,
        estimatedRoll: this.lastStableResult.rollDeg,
        confidence: decayedConfidence,
        isProfileAligned: false,
        isFresh: false,
        isCaptureEligible: false, // Strict: stale data CANNOT trigger capture
        guidanceMessage: 'Hold steady — re-acquiring profile...',
      };
    }

    // Completely lost or invalid
    this.currentState = 'INVALID_POSITION';
    return {
      state: 'INVALID_POSITION',
      estimatedYaw: currentResult?.yawDeg ?? 0,
      estimatedRoll: currentResult?.rollDeg ?? 0,
      confidence: 0,
      isProfileAligned: false,
      isFresh: false,
      isCaptureEligible: false,
      guidanceMessage: `Turn patient to 90° ${isRightProfile ? 'right' : 'left'} profile`,
    };
  }

  public getLastStableResult(): FaceAnalysisResult | null {
    return this.lastStableResult;
  }

  public reset(): void {
    this.lastStableResult = null;
    this.lastStableTimestamp = 0;
    this.currentState = 'INVALID_POSITION';
  }
}

