import { describe, it, expect, beforeEach } from 'vitest';
import { CapturePerformanceTracker } from '../CapturePerformanceTracker';

describe('CapturePerformanceTracker', () => {
  beforeEach(() => {
    CapturePerformanceTracker.resetCycle();
  });

  it('accurately records timestamps and calculates alignmentToActualCaptureMs <= 1000ms', () => {
    const t0 = 1000;
    CapturePerformanceTracker.recordAlignmentValid(t0);

    const t1 = t0 + 250; // 250ms candidate stability
    CapturePerformanceTracker.recordCandidateReady(t1);

    const t2 = t1; // Immediate countdown start
    CapturePerformanceTracker.recordCountdownStarted(t2);

    const t3 = t0 + 1000; // 750ms countdown -> 1000ms total
    CapturePerformanceTracker.recordCaptureTriggered(t3);

    const t4 = t3 + 5; // Real shutter sensor grab begins
    CapturePerformanceTracker.recordSensorCaptureStarted(t4);

    const t5 = t4 + 10; // Sensor frame acquired
    CapturePerformanceTracker.recordSensorCaptureCompleted(t5);

    const t6 = t4 + 12; // Instant feedback chime & border flash
    CapturePerformanceTracker.recordCaptureFeedback(t6);

    const t7 = t4 + 80; // Async image crop/quality processing
    CapturePerformanceTracker.recordProcessingCompleted(t7);

    const t8 = t4 + 120; // Save to storage/gallery
    CapturePerformanceTracker.recordGallerySaveCompleted(t8);

    const metrics = CapturePerformanceTracker.getMetrics();

    expect(metrics.alignmentToCandidateMs).toBe(250);
    expect(metrics.candidateToCountdownMs).toBe(0);
    expect(metrics.alignmentToCountdownMs).toBe(250);
    expect(metrics.countdownToActualCaptureMs).toBe(755);
    expect(metrics.alignmentToActualCaptureMs).toBe(1005);
    expect(metrics.actualCaptureToFeedbackMs).toBe(12);
    expect(metrics.actualCaptureToProcessingMs).toBe(80);
    expect(metrics.actualCaptureToSaveMs).toBe(120);
  });

  it('resets alignment timing if alignment is broken before candidate persistence', () => {
    CapturePerformanceTracker.recordAlignmentValid(500);
    CapturePerformanceTracker.resetAlignmentValid();

    const timestamps = CapturePerformanceTracker.getTimestamps();
    expect(timestamps.alignmentValidAt).toBeNull();
  });
});
