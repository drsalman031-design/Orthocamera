/**
 * CapturePerformanceTracker
 *
 * Lightweight internal performance instrumentation using performance.now()
 * to accurately measure the end-to-end auto-capture latency pipeline.
 *
 * Primary Metric: alignmentToActualCaptureMs
 * (The actual time between clinical alignment becoming valid and capturePhoto() / real shutter execution)
 */

export interface CaptureTimestamps {
  alignmentValidAt: number | null;
  candidateReadyAt: number | null;
  countdownStartedAt: number | null;
  captureTriggeredAt: number | null;
  sensorCaptureStartedAt: number | null;
  sensorCaptureCompletedAt: number | null;
  captureFeedbackAt: number | null;
  processingCompletedAt: number | null;
  gallerySaveCompletedAt: number | null;
}

export interface CaptureLatencyMetrics {
  alignmentToCandidateMs: number | null;
  candidateToCountdownMs: number | null;
  alignmentToCountdownMs: number | null;
  countdownToActualCaptureMs: number | null;
  alignmentToActualCaptureMs: number | null;
  actualCaptureToFeedbackMs: number | null;
  actualCaptureToProcessingMs: number | null;
  actualCaptureToSaveMs: number | null;
}

type PerformanceListener = (metrics: CaptureLatencyMetrics, timestamps: CaptureTimestamps) => void;

class CapturePerformanceTrackerClass {
  private timestamps: CaptureTimestamps = {
    alignmentValidAt: null,
    candidateReadyAt: null,
    countdownStartedAt: null,
    captureTriggeredAt: null,
    sensorCaptureStartedAt: null,
    sensorCaptureCompletedAt: null,
    captureFeedbackAt: null,
    processingCompletedAt: null,
    gallerySaveCompletedAt: null,
  };

  private latestMetrics: CaptureLatencyMetrics = {
    alignmentToCandidateMs: null,
    candidateToCountdownMs: null,
    alignmentToCountdownMs: null,
    countdownToActualCaptureMs: null,
    alignmentToActualCaptureMs: null,
    actualCaptureToFeedbackMs: null,
    actualCaptureToProcessingMs: null,
    actualCaptureToSaveMs: null,
  };

  private listeners: Set<PerformanceListener> = new Set();

  /**
   * Reset timestamps for a new capture cycle
   */
  public resetCycle(): void {
    this.timestamps = {
      alignmentValidAt: null,
      candidateReadyAt: null,
      countdownStartedAt: null,
      captureTriggeredAt: null,
      sensorCaptureStartedAt: null,
      sensorCaptureCompletedAt: null,
      captureFeedbackAt: null,
      processingCompletedAt: null,
      gallerySaveCompletedAt: null,
    };
  }

  /**
   * 1. Clinical alignment becomes valid
   */
  public recordAlignmentValid(time: number = performance.now()): void {
    if (this.timestamps.alignmentValidAt === null) {
      this.timestamps.alignmentValidAt = time;
    }
  }

  /**
   * Clears alignmentValidAt if patient breaks alignment before candidate persistence
   */
  public resetAlignmentValid(): void {
    this.timestamps.alignmentValidAt = null;
    this.timestamps.candidateReadyAt = null;
    this.timestamps.countdownStartedAt = null;
    this.timestamps.captureTriggeredAt = null;
  }

  /**
   * 2. Candidate persistence stability period met -> Ready
   */
  public recordCandidateReady(time: number = performance.now()): void {
    if (this.timestamps.candidateReadyAt === null) {
      this.timestamps.candidateReadyAt = time;
      if (this.timestamps.alignmentValidAt === null) {
        // Fallback baseline if alignment became valid right at candidate check
        this.timestamps.alignmentValidAt = time;
      }
      this.recalculate();
    }
  }

  /**
   * 3. Countdown timer begins
   */
  public recordCountdownStarted(time: number = performance.now()): void {
    if (this.timestamps.countdownStartedAt === null) {
      this.timestamps.countdownStartedAt = time;
      this.recalculate();
    }
  }

  /**
   * 4. HysteresisController fires auto-capture trigger
   */
  public recordCaptureTriggered(time: number = performance.now()): void {
    this.timestamps.captureTriggeredAt = time;
    this.recalculate();
  }

  /**
   * 5. capturePhoto() begins real shutter execution
   */
  public recordSensorCaptureStarted(time: number = performance.now()): void {
    this.timestamps.sensorCaptureStartedAt = time;
    this.recalculate();
  }

  /**
   * 6. Video frame / raw sensor image frame acquired
   */
  public recordSensorCaptureCompleted(time: number = performance.now()): void {
    this.timestamps.sensorCaptureCompletedAt = time;
    this.recalculate();
  }

  /**
   * 7. Shutter click sound / visual flash feedback shown to clinician
   */
  public recordCaptureFeedback(time: number = performance.now()): void {
    this.timestamps.captureFeedbackAt = time;
    this.recalculate();
  }

  /**
   * 8. Async image cropping & quality analysis completed
   */
  public recordProcessingCompleted(time: number = performance.now()): void {
    this.timestamps.processingCompletedAt = time;
    this.recalculate();
  }

  /**
   * 9. Android MediaStore / IndexedDB storage save completed
   */
  public recordGallerySaveCompleted(time: number = performance.now()): void {
    this.timestamps.gallerySaveCompletedAt = time;
    this.recalculate();
  }

  private diff(a: number | null, b: number | null): number | null {
    if (a !== null && b !== null && b >= a) {
      return Math.round(b - a);
    }
    return null;
  }

  private recalculate(): void {
    const ts = this.timestamps;
    this.latestMetrics = {
      alignmentToCandidateMs: this.diff(ts.alignmentValidAt, ts.candidateReadyAt),
      candidateToCountdownMs: this.diff(ts.candidateReadyAt, ts.countdownStartedAt),
      alignmentToCountdownMs: this.diff(ts.alignmentValidAt, ts.countdownStartedAt),
      countdownToActualCaptureMs: this.diff(ts.countdownStartedAt, ts.sensorCaptureStartedAt),
      alignmentToActualCaptureMs: this.diff(ts.alignmentValidAt, ts.sensorCaptureStartedAt),
      actualCaptureToFeedbackMs: this.diff(ts.sensorCaptureStartedAt, ts.captureFeedbackAt),
      actualCaptureToProcessingMs: this.diff(ts.sensorCaptureStartedAt, ts.processingCompletedAt),
      actualCaptureToSaveMs: this.diff(ts.sensorCaptureStartedAt, ts.gallerySaveCompletedAt),
    };

    this.listeners.forEach((listener) => {
      try {
        listener(this.latestMetrics, this.timestamps);
      } catch {
        // Safe dispatch
      }
    });
  }

  public getMetrics(): CaptureLatencyMetrics {
    return { ...this.latestMetrics };
  }

  public getTimestamps(): CaptureTimestamps {
    return { ...this.timestamps };
  }

  public subscribe(listener: PerformanceListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    listener(this.latestMetrics, this.timestamps);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const CapturePerformanceTracker = new CapturePerformanceTrackerClass();
