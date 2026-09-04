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
    timestamp: number = Date.now()
  ): ProfileStateResult {
    const targetYawSign = isRightProfile ? 1 : -1;
    const minProfileYaw = 70; // 70 to 95 degrees yaw required for strict 90° profile

    if (currentResult && currentResult.detected && currentResult.confidence > 0.4) {
      const currentYaw = currentResult.yawDeg;
      const matchesDirection = isRightProfile ? currentYaw > 35 : currentYaw < -35;

      if (matchesDirection) {
        // Active fresh tracking
        this.lastStableResult = currentResult;
        this.lastStableTimestamp = timestamp;
        this.currentState = 'TRACKING';

        const isFullyTurned = Math.abs(currentYaw) >= minProfileYaw;
        const isRollLevel = Math.abs(currentResult.rollDeg) <= 6;
        const isAligned = isFullyTurned && isRollLevel;

        return {
          state: 'TRACKING',
          estimatedYaw: currentYaw,
          estimatedRoll: currentResult.rollDeg,
          confidence: currentResult.confidence,
          isProfileAligned: isAligned,
          isFresh: true,
          isCaptureEligible: isAligned,
          guidanceMessage: !isFullyTurned
            ? `Turn patient further ${isRightProfile ? 'right' : 'left'} (90° profile)`
            : !isRollLevel
            ? 'Level patient head'
            : 'Profile Aligned ✓',
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
      estimatedYaw: targetYawSign * 45,
      estimatedRoll: 0,
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

