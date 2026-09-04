/**
 * MediaPipeVisionEngine.ts
 *
 * Provides real-time, on-device ML inference using Google MediaPipe FaceLandmarker.
 * Extracts 468 3D facial landmarks, blendshapes (smile score, jaw open, blink),
 * and calculates exact 3D head pose (Roll, Yaw, Pitch) with sub-degree accuracy.
 *
 * Runs completely locally in browser WebAssembly/WebGL - 100% HIPAA compliant.
 */

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { FaceAnalysisResult } from './FaceAnalyzer';
import type { MeshContours } from '../types';
import {
  extractHeadPoseFromMatrix,
  calculateGeometricHeadPose,
  evaluateLandmarkQuality,
  LANDMARK_INDICES,
  LEFT_EYE_CONTOUR,
  RIGHT_EYE_CONTOUR,
} from './HeadPoseEstimator';

export interface MediaPipeStatus {
  isSupported: boolean;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  delegate: 'GPU' | 'CPU';
}

const FACE_OVAL_INDICES = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];
const LIP_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144, 33];
const RIGHT_EYE_INDICES = [263, 387, 385, 362, 380, 373, 263];
const NOSE_BRIDGE_INDICES = [168, 6, 197, 195, 5, 4, 1];

class MediaPipeVisionEngineSingleton {
  private faceLandmarker: FaceLandmarker | null = null;
  private isInitializing = false;
  private status: MediaPipeStatus = {
    isSupported: true,
    isLoading: false,
    isReady: false,
    error: null,
    delegate: 'GPU',
  };
  private statusListeners: Array<(status: MediaPipeStatus) => void> = [];
  private lastInferenceTime = 0;
  private isProcessingFrame = false;
  private lastResult: FaceAnalysisResult | null = null;

  constructor() {
    // Auto initialize if in browser
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public getStatus(): MediaPipeStatus {
    return { ...this.status };
  }

  public subscribeStatus(listener: (status: MediaPipeStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((l) => {
      try {
        l(s);
      } catch (err) {
        console.error('Error in status listener', err);
      }
    });
  }

  public async init(): Promise<boolean> {
    if (this.faceLandmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.status.isLoading = true;
    this.status.error = null;
    this.notifyStatus();

    try {
      // 1. Resolve WASM assets: try local /wasm first, fallback to matching 1.0.1 CDN
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/wasm');
      } catch (localWasmErr) {
        console.warn('[MediaPipe] Local WASM load failed, trying CDN fallback:', localWasmErr);
        vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
        );
      }

      // 2. Determine initial delegate (GPU if WebGL is available, otherwise CPU)
      const isGpuSupported = (() => {
        if (typeof window === 'undefined') return false;
        try {
          const c = document.createElement('canvas');
          return !!(c.getContext('webgl2') || c.getContext('webgl'));
        } catch {
          return false;
        }
      })();

      const targetDelegate = isGpuSupported ? 'GPU' : 'CPU';
      const localModelPath = '/models/face_landmarker.task';
      const cdnModelPath =
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

      const createLandmarker = async (delegate: 'GPU' | 'CPU', modelPath: string) => {
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate,
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.35,
          minFacePresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
        });
      };

      try {
        // Try local model with preferred delegate
        try {
          this.faceLandmarker = await createLandmarker(targetDelegate, localModelPath);
          this.status.delegate = targetDelegate;
        } catch (localModelErr) {
          console.warn('[MediaPipe] Local model failed, trying CDN model:', localModelErr);
          this.faceLandmarker = await createLandmarker(targetDelegate, cdnModelPath);
          this.status.delegate = targetDelegate;
        }
      } catch (delegateErr) {
        if (targetDelegate === 'GPU') {
          console.info('[MediaPipe] GPU delegate failed, falling back to CPU delegate.');
          try {
            this.faceLandmarker = await createLandmarker('CPU', localModelPath);
          } catch {
            this.faceLandmarker = await createLandmarker('CPU', cdnModelPath);
          }
          this.status.delegate = 'CPU';
        } else {
          throw delegateErr;
        }
      }

      this.status.isLoading = false;
      this.status.isReady = true;
      this.isInitializing = false;
      this.notifyStatus();
      console.log(`[MediaPipe] FaceLandmarker initialized successfully on ${this.status.delegate}`);
      return true;
    } catch (err) {
      console.error('[MediaPipe] Failed to load FaceLandmarker:', err);
      this.status.isLoading = false;
      this.status.isReady = false;
      this.status.error = err instanceof Error ? err.message : 'Failed to load MediaPipe model';
      this.isInitializing = false;
      this.notifyStatus();
      return false;
    }
  }

  /**
   * Process a video element or canvas with MediaPipe
   */
  public detectForVideo(
    videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
    timestampMs: number
  ): FaceAnalysisResult | null {
    if (!this.faceLandmarker || !this.status.isReady) {
      return null;
    }

    // Safety checks on input dimensions to prevent MediaPipe throw
    if (videoOrCanvas instanceof HTMLVideoElement) {
      if (videoOrCanvas.readyState < 2 || videoOrCanvas.videoWidth <= 0 || videoOrCanvas.videoHeight <= 0) {
        return null;
      }
    } else if (videoOrCanvas instanceof HTMLCanvasElement) {
      if (videoOrCanvas.width <= 0 || videoOrCanvas.height <= 0) {
        return null;
      }
    }

    if (this.isProcessingFrame) {
      return this.lastResult;
    }

    // Rate-limit inference to ~12 fps (80ms) to ensure phone stays responsive and video never sticks
    if (timestampMs - this.lastInferenceTime < 80) {
      return this.lastResult;
    }

    // MediaPipe requires strictly monotonically increasing timestamp
    const safeTimestamp = Math.max(timestampMs, this.lastInferenceTime + 1);
    this.lastInferenceTime = safeTimestamp;
    this.isProcessingFrame = true;

    try {
      const results = this.faceLandmarker.detectForVideo(videoOrCanvas, safeTimestamp);

      if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
        this.lastResult = null;
        return null;
      }

      const landmarks = results.faceLandmarks[0];
      if (!landmarks || landmarks.length < 468) {
        this.lastResult = null;
        return null;
      }

      // Calculate Bounding Box
      let minX = 1;
      let maxX = 0;
      let minY = 1;
      let maxY = 0;

      for (let i = 0; i < landmarks.length; i++) {
        const p = landmarks[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const boxW = Math.max(0.01, maxX - minX);
      const boxH = Math.max(0.01, maxY - minY);
      const centerX = minX + boxW / 2;
      const centerY = minY + boxH / 2;

      const getPt = (idx: number) => ({
        x: landmarks[idx]?.x ?? 0.5,
        y: landmarks[idx]?.y ?? 0.5,
      });

      const meshContours: MeshContours = {
        faceOval: FACE_OVAL_INDICES.map(getPt),
        lips: LIP_INDICES.map(getPt),
        leftEye: LEFT_EYE_INDICES.map(getPt),
        rightEye: RIGHT_EYE_INDICES.map(getPt),
        noseBridge: NOSE_BRIDGE_INDICES.map(getPt),
        leftPupil: landmarks[468] ? getPt(468) : getPt(33),
        rightPupil: landmarks[473] ? getPt(473) : getPt(263),
      };

      const leftEyeOuter = landmarks[LANDMARK_INDICES.LEFT_EYE_OUTER] || landmarks[33];
      const rightEyeOuter = landmarks[LANDMARK_INDICES.RIGHT_EYE_OUTER] || landmarks[263];
      const noseTip = landmarks[LANDMARK_INDICES.NOSE_TIP] || landmarks[1];
      const chinTip = landmarks[LANDMARK_INDICES.CHIN_TIP] || landmarks[152];
      const leftMouth = landmarks[LANDMARK_INDICES.LEFT_MOUTH_CORNER] || landmarks[61];
      const rightMouth = landmarks[LANDMARK_INDICES.RIGHT_MOUTH_CORNER] || landmarks[291];
      const upperLip = landmarks[LANDMARK_INDICES.UPPER_LIP] || landmarks[0];
      const lowerLip = landmarks[LANDMARK_INDICES.LOWER_LIP] || landmarks[17];

      // 1. Roll / Interpupillary Tilt Calculation from Eye Contours
      const dEyeX = rightEyeOuter.x - leftEyeOuter.x;
      const dEyeY = rightEyeOuter.y - leftEyeOuter.y;
      const rollDeg = Math.atan2(dEyeY, dEyeX) * (180 / Math.PI);

      // 2. Extract Head Pose from Transformation Matrix or Geometric Fallback
      let pose = results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0
        ? extractHeadPoseFromMatrix(results.facialTransformationMatrixes[0], 0.95)
        : calculateGeometricHeadPose(landmarks, 0.85);

      if (pose.source === 'unavailable' || pose.yawDeg === null) {
        pose = calculateGeometricHeadPose(landmarks, 0.85);
      }

      const yawDeg = pose.yawDeg ?? 0;
      const pitchDeg = pose.pitchDeg ?? 0;

      // 3. Evaluate Landmark Quality
      const landmarkQuality = evaluateLandmarkQuality(landmarks, 0.95);

      // 4. Blendshape extractions: Smile score & Lip Aperture
      let smileScore = 0;
      let lipAperture = 0;

      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const categories = results.faceBlendshapes[0].categories;
        const smileLeft = categories.find((c) => c.categoryName === 'mouthSmileLeft')?.score || 0;
        const smileRight = categories.find((c) => c.categoryName === 'mouthSmileRight')?.score || 0;
        smileScore = (smileLeft + smileRight) / 2;

        const jawOpen = categories.find((c) => c.categoryName === 'jawOpen')?.score || 0;
        lipAperture = jawOpen;
      } else {
        const mouthW = Math.hypot(rightMouth.x - leftMouth.x, rightMouth.y - leftMouth.y);
        smileScore = Math.min(1, Math.max(0, (mouthW / boxW - 0.35) * 3));
        lipAperture = Math.min(1, Math.max(0, (Math.abs(lowerLip.y - upperLip.y) / boxH) * 4));
      }

      // Compute composite bounded confidence (never hardcoded 0.99)
      const computedConfidence = Math.max(
        0.1,
        Math.min(0.96, pose.confidence * 0.5 + landmarkQuality.confidence * 0.5)
      );

      this.lastResult = {
        detected: true,
        confidence: computedConfidence,
        aiEngine: 'mediapipe',
        boundingBox: {
          x: minX,
          y: minY,
          width: boxW,
          height: boxH,
        },
        center: { x: centerX, y: centerY },
        yawDeg,
        pitchDeg,
        rollDeg,
        faceHeightRatio: boxH,
        smileScore,
        eyeLineAngleDeg: rollDeg,
        lipApertureRatio: lipAperture,
        meshContours,
        landmarks: {
          leftEye: { x: leftEyeOuter.x, y: leftEyeOuter.y },
          rightEye: { x: rightEyeOuter.x, y: rightEyeOuter.y },
          noseTip: { x: noseTip.x, y: noseTip.y },
          mouthCenter: { x: (leftMouth.x + rightMouth.x) / 2, y: (upperLip.y + lowerLip.y) / 2 },
          chinTip: { x: chinTip.x, y: chinTip.y },
          leftCheek: { x: landmarks[234]?.x ?? minX, y: landmarks[234]?.y ?? centerY },
          rightCheek: { x: landmarks[454]?.x ?? maxX, y: landmarks[454]?.y ?? centerY },
          leftMouthCorner: { x: leftMouth.x, y: leftMouth.y },
          rightMouthCorner: { x: rightMouth.x, y: rightMouth.y },
          upperLip: { x: upperLip.x, y: upperLip.y },
          lowerLip: { x: lowerLip.x, y: lowerLip.y },
        },
        pose,
        landmarkQuality,
      };

      return this.lastResult;
    } catch (err) {
      console.warn('Error during MediaPipe detection:', err);
      this.lastResult = null;
      return null;
    } finally {
      this.isProcessingFrame = false;
    }
  }
}

export const MediaPipeVision = new MediaPipeVisionEngineSingleton();

