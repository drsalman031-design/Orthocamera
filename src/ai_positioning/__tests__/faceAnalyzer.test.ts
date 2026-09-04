import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnDeviceFaceAnalyzer } from '../FaceAnalyzer';

describe('FaceAnalyzer - Native Fallback & Landmark Integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    const mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8Array(160 * 160 * 4) }),
    };
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockCtx),
      width: 160,
      height: 160,
    };
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockCanvas),
    };
    (globalThis as any).window = globalThis;
  });

  it('never fabricates noseTip or chinTip from native FaceDetector', async () => {
    class MockFaceDetector {
      async detect() {
        return [
          {
            boundingBox: { x: 40, y: 30, width: 80, height: 100 },
            landmarks: [
              { type: 'eye', locations: [{ x: 60, y: 50 }] },
              { type: 'eye', locations: [{ x: 100, y: 50 }] },
              { type: 'mouth', locations: [{ x: 80, y: 100 }] },
            ],
          },
        ];
      }
    }

    (globalThis as any).FaceDetector = MockFaceDetector;

    const analyzer = new OnDeviceFaceAnalyzer();
    const dummyCanvas = { width: 160, height: 160 } as HTMLCanvasElement;
    const dummyCtx = {} as CanvasRenderingContext2D;

    analyzer.analyzeFrame(dummyCanvas, dummyCtx, 160, 160);
    await new Promise((r) => setTimeout(r, 20));
    const result = analyzer.analyzeFrame(dummyCanvas, dummyCtx, 160, 160);

    expect(result.detected).toBe(true);
    expect(result.aiEngine).toBe('native');
    expect(result.landmarks).toBeDefined();

    // Eyes and mouth are genuinely detected
    expect(result.landmarks?.leftEye).toBeDefined();
    expect(result.landmarks?.rightEye).toBeDefined();
    expect(result.landmarks?.mouthCenter).toBeDefined();

    // Critical: noseTip and chinTip MUST NOT be fabricated
    expect(result.landmarks?.noseTip).toBeUndefined();
    expect(result.landmarks?.chinTip).toBeUndefined();
    expect(result.landmarks?.leftCheek).toBeUndefined();
    expect(result.landmarks?.rightCheek).toBeUndefined();
  });

  it('marks native fallback landmark quality as unavailable and incomplete', async () => {
    class MockFaceDetector {
      async detect() {
        return [
          {
            boundingBox: { x: 40, y: 30, width: 80, height: 100 },
            landmarks: [
              { type: 'eye', locations: [{ x: 60, y: 50 }] },
              { type: 'eye', locations: [{ x: 100, y: 50 }] },
            ],
          },
        ];
      }
    }

    (globalThis as any).FaceDetector = MockFaceDetector;

    const analyzer = new OnDeviceFaceAnalyzer();
    const dummyCanvas = { width: 160, height: 160 } as HTMLCanvasElement;
    const dummyCtx = {} as CanvasRenderingContext2D;

    analyzer.analyzeFrame(dummyCanvas, dummyCtx, 160, 160);
    await new Promise((r) => setTimeout(r, 20));
    const result = analyzer.analyzeFrame(dummyCanvas, dummyCtx, 160, 160);

    expect(result.detected).toBe(true);
    expect(result.aiEngine).toBe('native');
    expect(result.landmarkQuality?.available).toBe(false);
    expect(result.landmarkQuality?.requiredLandmarksPresent).toBe(false);
    expect(result.landmarkQuality?.confidence).toBeLessThan(0.4);
    expect(result.pose?.source).toBe('unavailable');
    expect(result.pose?.yawDeg).toBeNull();
    expect(result.pose?.pitchDeg).toBeNull();
  });
});
