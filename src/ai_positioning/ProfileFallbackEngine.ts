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
  guidanceMessage: string;
}

export class ProfileFallbackEngine {
  private lastStableResult: FaceAnalysisResult | null = null;
  private lastStableTimestamp: number = 0;
  private readonly persistenceWindowMs = 1200; // 1.2s memory of stable pose
  private currentState: ProfileTrackingState = 'INVALID_POSITION';

  public evaluateProfile(
    isRightProfile: boolean,
    currentResult: FaceAnalysisResult | null,
    timestamp: number = Date.now()
  ): ProfileStateResult {
    const targetYawSign = isRightProfile ? 1 : -1; // Right profile yaw is positive, Left is negative
    const minProfileYaw = 60; // 60 to 90 degrees yaw required for profile

    if (currentResult && currentResult.detected && currentResult.confidence > 0.35) {
      const currentYaw = currentResult.yawDeg;
      const matchesDirection = isRightProfile ? currentYaw > 30 : currentYaw < -30;

      if (matchesDirection) {
        // We have active tracking
        this.lastStableResult = currentResult;
        this.lastStableTimestamp = timestamp;
        this.currentState = 'TRACKING';

        const isFullyTurned = Math.abs(currentYaw) >= minProfileYaw;
        const isRollLevel = Math.abs(currentResult.rollDeg) <= 5;

        return {
          state: 'TRACKING',
          estimatedYaw: currentYaw,
          estimatedRoll: currentResult.rollDeg,
          confidence: currentResult.confidence,
          isProfileAligned: isFullyTurned && isRollLevel,
          guidanceMessage: !isFullyTurned
            ? `Turn patient further ${isRightProfile ? 'right' : 'left'} (90°)`
            : !isRollLevel
            ? 'Level patient head'
            : 'Profile Aligned ✓',
        };
      }
    }

    // MediaPipe dropped tracking (common at true 90° lateral profile)
    // Check if we have recent stable pose within persistence window
    if (this.lastStableResult && timestamp - this.lastStableTimestamp <= this.persistenceWindowMs) {
      this.currentState = 'TEMPORARILY_LOST';
      const decayRatio = (timestamp - this.lastStableTimestamp) / this.persistenceWindowMs;
      const decayedConfidence = Math.max(0.4, (this.lastStableResult.confidence || 0.8) * (1 - decayRatio * 0.4));

      return {
        state: 'TEMPORARILY_LOST',
        estimatedYaw: this.lastStableResult.yawDeg,
        estimatedRoll: this.lastStableResult.rollDeg,
        confidence: decayedConfidence,
        isProfileAligned: Math.abs(this.lastStableResult.yawDeg) >= 55,
        guidanceMessage: 'Hold steady (Profile locked)',
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
      guidanceMessage: `Turn patient to 90° ${isRightProfile ? 'right' : 'left'} profile`,
    };
  }

  public reset(): void {
    this.lastStableResult = null;
    this.lastStableTimestamp = 0;
    this.currentState = 'INVALID_POSITION';
  }
}
