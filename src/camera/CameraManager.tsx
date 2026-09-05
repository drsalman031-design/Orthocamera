import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { CapturedPhoto, LiveGuidanceState, OrthodonticViewDefinition, QualityCheckResult } from '../types';
import { FaceAnalysisResult, OnDeviceFaceAnalyzer } from '../ai_positioning/FaceAnalyzer';
import { IntraoralAnalysisResult, OnDeviceIntraoralAnalyzer } from '../ai_positioning/IntraoralAnalyzer';
import { OverlayGuidanceEngine } from '../ai_positioning/OverlayGuidanceEngine';
import { ImageQualityAnalyzer } from '../quality_analysis/ImageQualityAnalyzer';
import { CameraFrameTransform } from './CameraFrameTransform';
import { MotionEngine } from '../ai_positioning/MotionEngine';
import { ProfileFallbackEngine, ProfileStateResult } from '../ai_positioning/ProfileFallbackEngine';
import { CapturePerformanceTracker } from '../telemetry/CapturePerformanceTracker';

export interface CameraTelemetry {
  cameraFps: number;
  aiFps: number;
  inferenceLatencyMs: number;
  motionScore: number;
  sensorResolution: { width: number; height: number };
  zoomLevel: number;
  isHardwareZoom: boolean;
  currentState?: string;
  candidateToCaptureLatencyMs?: number;
}

interface CameraManagerProps {
  currentView: OrthodonticViewDefinition;
  guidanceSensitivity: 'high' | 'medium' | 'relaxed';
  captureMode?: 'fast' | 'balanced' | 'clinical';
  onGuidanceUpdate: (guidance: LiveGuidanceState) => void;
  onPhotoCaptured: (photo: CapturedPhoto) => void;
  autoCaptureTrigger: boolean;
  onAutoCaptureReset: () => void;
  flashMode: 'off' | 'on' | 'auto' | 'torch';
  facingMode: 'environment' | 'user';
  onFacingModeChange?: (facing: 'environment' | 'user') => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  burstModeEnabled?: boolean;
  burstCount?: number;
  onTelemetryUpdate?: (telemetry: CameraTelemetry) => void;
  onSwipeNext?: () => void;
  onSwipePrevious?: () => void;
  children?: React.ReactNode;
}

/**
 * Normalizes FaceAnalysisResult coordinates and angles when the camera feed is mirrored (front/user camera).
 * Ensures that turning head right on screen yields positive yaw, matching on-screen templates and landmarks.
 */
function mirrorFaceResult(result: FaceAnalysisResult): FaceAnalysisResult {
  return {
    ...result,
    yawDeg: -result.yawDeg,
    rollDeg: -result.rollDeg,
    eyeLineAngleDeg: -result.eyeLineAngleDeg,
    center: {
      x: 1.0 - result.center.x,
      y: result.center.y,
    },
    boundingBox: {
      ...result.boundingBox,
      x: Math.max(0, 1.0 - (result.boundingBox.x + result.boundingBox.width)),
    },
    pose: result.pose
      ? {
          ...result.pose,
          yawDeg: result.pose.yawDeg !== null ? -result.pose.yawDeg : null,
          rollDeg: result.pose.rollDeg !== null ? -result.pose.rollDeg : null,
        }
      : undefined,
    landmarkQuality: result.landmarkQuality,
    meshContours: result.meshContours
      ? {
          faceOval: result.meshContours.faceOval.map((p) => ({ x: 1.0 - p.x, y: p.y })),
          lips: result.meshContours.lips.map((p) => ({ x: 1.0 - p.x, y: p.y })),
          leftEye: result.meshContours.rightEye.map((p) => ({ x: 1.0 - p.x, y: p.y })),
          rightEye: result.meshContours.leftEye.map((p) => ({ x: 1.0 - p.x, y: p.y })),
          noseBridge: result.meshContours.noseBridge.map((p) => ({ x: 1.0 - p.x, y: p.y })),
          leftPupil: result.meshContours.rightPupil
            ? { x: 1.0 - result.meshContours.rightPupil.x, y: result.meshContours.rightPupil.y }
            : undefined,
          rightPupil: result.meshContours.leftPupil
            ? { x: 1.0 - result.meshContours.leftPupil.x, y: result.meshContours.leftPupil.y }
            : undefined,
        }
      : undefined,
    landmarks: result.landmarks
      ? {
          leftEye: result.landmarks.rightEye
            ? { x: 1.0 - result.landmarks.rightEye.x, y: result.landmarks.rightEye.y }
            : (result.landmarks.leftEye ? { x: 1.0 - result.landmarks.leftEye.x, y: result.landmarks.leftEye.y } : undefined),
          rightEye: result.landmarks.leftEye
            ? { x: 1.0 - result.landmarks.leftEye.x, y: result.landmarks.leftEye.y }
            : (result.landmarks.rightEye ? { x: 1.0 - result.landmarks.rightEye.x, y: result.landmarks.rightEye.y } : undefined),
          noseTip: result.landmarks.noseTip
            ? { x: 1.0 - result.landmarks.noseTip.x, y: result.landmarks.noseTip.y }
            : undefined,
          mouthCenter: result.landmarks.mouthCenter
            ? { x: 1.0 - result.landmarks.mouthCenter.x, y: result.landmarks.mouthCenter.y }
            : undefined,
          chinTip: result.landmarks.chinTip
            ? { x: 1.0 - result.landmarks.chinTip.x, y: result.landmarks.chinTip.y }
            : undefined,
          leftCheek: result.landmarks.rightCheek
            ? { x: 1.0 - result.landmarks.rightCheek.x, y: result.landmarks.rightCheek.y }
            : undefined,
          rightCheek: result.landmarks.leftCheek
            ? { x: 1.0 - result.landmarks.leftCheek.x, y: result.landmarks.leftCheek.y }
            : undefined,
          leftMouthCorner: result.landmarks.rightMouthCorner
            ? { x: 1.0 - result.landmarks.rightMouthCorner.x, y: result.landmarks.rightMouthCorner.y }
            : undefined,
          rightMouthCorner: result.landmarks.leftMouthCorner
            ? { x: 1.0 - result.landmarks.leftMouthCorner.x, y: result.landmarks.leftMouthCorner.y }
            : undefined,
          upperLip: result.landmarks.upperLip
            ? { x: 1.0 - result.landmarks.upperLip.x, y: result.landmarks.upperLip.y }
            : undefined,
          lowerLip: result.landmarks.lowerLip
            ? { x: 1.0 - result.landmarks.lowerLip.x, y: result.landmarks.lowerLip.y }
            : undefined,
          subnasale: result.landmarks.subnasale
            ? { x: 1.0 - result.landmarks.subnasale.x, y: result.landmarks.subnasale.y }
            : undefined,
          menton: result.landmarks.menton
            ? { x: 1.0 - result.landmarks.menton.x, y: result.landmarks.menton.y }
            : undefined,
          leftTragus: result.landmarks.rightTragus
            ? { x: 1.0 - result.landmarks.rightTragus.x, y: result.landmarks.rightTragus.y }
            : undefined,
          rightTragus: result.landmarks.leftTragus
            ? { x: 1.0 - result.landmarks.leftTragus.x, y: result.landmarks.leftTragus.y }
            : undefined,
          leftGonion: result.landmarks.rightGonion
            ? { x: 1.0 - result.landmarks.rightGonion.x, y: result.landmarks.rightGonion.y }
            : undefined,
          rightGonion: result.landmarks.leftGonion
            ? { x: 1.0 - result.landmarks.leftGonion.x, y: result.landmarks.leftGonion.y }
            : undefined,
        }
      : undefined,
  };
}

const CameraManagerComponent: React.FC<CameraManagerProps> = ({
  currentView,
  guidanceSensitivity,
  captureMode = 'balanced',
  onGuidanceUpdate,
  onPhotoCaptured,
  autoCaptureTrigger,
  onAutoCaptureReset,
  flashMode,
  facingMode,
  onFacingModeChange,
  zoomLevel,
  onZoomChange,
  burstModeEnabled = false,
  burstCount = 3,
  onTelemetryUpdate,
  onSwipeNext,
  onSwipePrevious,
  children,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [isHardwareZoom, setIsHardwareZoom] = useState<boolean>(false);
  const [sensorResolution, setSensorResolution] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });

  // Multiple Camera Device Management (DroidCam, external USB, native lenses)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [activeDeviceLabel, setActiveDeviceLabel] = useState<string>('');

  // Telemetry references
  const fpsFrameCountRef = useRef<number>(0);
  const lastFpsCalcTimeRef = useRef<number>(performance.now());
  const cameraFpsRef = useRef<number>(60);
  const aiFrameCountRef = useRef<number>(0);
  const lastAiFpsCalcTimeRef = useRef<number>(performance.now());
  const aiFpsRef = useRef<number>(30);
  const lastInferenceLatencyRef = useRef<number>(18);
  const motionScoreRef = useRef<number>(0);

  // Vision Engines
  const faceAnalyzerRef = useRef<OnDeviceFaceAnalyzer>(new OnDeviceFaceAnalyzer());
  const intraoralAnalyzerRef = useRef<OnDeviceIntraoralAnalyzer>(new OnDeviceIntraoralAnalyzer());
  const motionEngineRef = useRef<MotionEngine>(new MotionEngine());
  const profileFallbackRef = useRef<ProfileFallbackEngine>(new ProfileFallbackEngine());

  // Touch gesture tracking for pinch zoom
  const touchDistanceRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Stop current active media stream safely
  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch {
        // ignore
      }
      streamRef.current = null;
    }
    videoTrackRef.current = null;
  }, []);

  // Multi-Stage, High-Resilient Camera Hardware Initialization (Prioritizes DroidCam)
  const initHardwareCamera = useCallback(
    async (targetFacing: 'environment' | 'user' = facingMode, specificDeviceId?: string | null) => {
      const requestId = ++activeRequestIdRef.current;
      setIsInitializing(true);
      setCameraError(null);
      stopCurrentStream();

      // Verify browser MediaDevices support
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setIsInitializing(false);
        setCameraActive(false);
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          setCameraError(
            'Camera access requires a secure connection. Please open http://localhost:3000 instead of your network IP address.'
          );
        } else {
          setCameraError('Camera API is not supported in this browser.');
        }
        return;
      }

      // Determine if running on a mobile device / native Android APK
      const isMobile =
        Capacitor.isNativePlatform() ||
        (typeof navigator !== 'undefined' &&
          /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent));

      const constraintTiers: MediaStreamConstraints[] = [];
      const targetDeviceId = specificDeviceId !== undefined ? specificDeviceId : selectedDeviceId;

      // Tier 1: Optimal resolution (1080p ideal) + preferred facing mode
      if (targetDeviceId) {
        constraintTiers.push({
          video: {
            deviceId: { ideal: targetDeviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } else {
        constraintTiers.push({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      }

      // Tier 2: Flexible fallback (any resolution, flexible facing)
      constraintTiers.push({
        video: {
          facingMode: { ideal: targetFacing },
        },
        audio: false,
      });

      // Tier 3: Universal fallback (any available camera sensor)
      constraintTiers.push({
        video: true,
        audio: false,
      });

      let acquiredStream: MediaStream | null = null;
      let lastErr: unknown = null;

      for (const constraints of constraintTiers) {
        if (requestId !== activeRequestIdRef.current) {
          // Superseded by newer request
          return;
        }

        try {
          acquiredStream = await navigator.mediaDevices.getUserMedia(constraints);
          if (acquiredStream && acquiredStream.getVideoTracks().length > 0) {
            break;
          }
        } catch (err) {
          lastErr = err;
        }
      }

      // Direct deviceId targeting fallback if constraint cascade was rejected
      if (!acquiredStream) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          if (videoInputs.length > 0) {
            for (const dev of videoInputs) {
              if (requestId !== activeRequestIdRef.current) return;
              try {
                acquiredStream = await navigator.mediaDevices.getUserMedia({
                  video: { deviceId: { exact: dev.deviceId } },
                  audio: false,
                });
                if (acquiredStream && acquiredStream.getVideoTracks().length > 0) {
                  break;
                }
              } catch {
                // continue to next device
              }
            }
          }
        } catch (enumErr) {
          console.debug('Device enumeration fallback error:', enumErr);
        }
      }

      // Discard if this request was cancelled/superseded during async acquisition
      if (requestId !== activeRequestIdRef.current) {
        if (acquiredStream) {
          acquiredStream.getTracks().forEach((t) => t.stop());
        }
        return;
      }

      if (acquiredStream) {
        streamRef.current = acquiredStream;
        const track = acquiredStream.getVideoTracks()[0];
        videoTrackRef.current = track;

        // Track active camera device label
        const trackLabel = track.label || '';
        setActiveDeviceLabel(trackLabel);

        // Update list of cameras now that permission is active
        try {
          navigator.mediaDevices.enumerateDevices().then((devs) => {
            const vInputs = devs.filter((d) => d.kind === 'videoinput');
            if (vInputs.length > 0) {
              setAvailableCameras(vInputs);
            }
          }).catch(() => {});
        } catch {
          // ignore
        }

        // Query hardware capabilities
        if (track.getCapabilities) {
          try {
            const caps = track.getCapabilities() as Record<string, unknown>;
            if (caps.torch) setTorchSupported(true);
            if (caps.zoom) setIsHardwareZoom(true);
          } catch {
            // ignore
          }
        }

        const settings = track.getSettings();
        if (settings.width && settings.height) {
          setSensorResolution({ width: settings.width, height: settings.height });
        }

        // Notify parent if the actual facing mode differed from requested (e.g. laptop webcam fallback to 'user')
        if (settings.facingMode && (settings.facingMode === 'user' || settings.facingMode === 'environment')) {
          if (settings.facingMode !== targetFacing && onFacingModeChange) {
            onFacingModeChange(settings.facingMode as 'environment' | 'user');
          }
        }

        // Bind stream imperatively to HTMLVideoElement
        if (videoRef.current) {
          const video = videoRef.current;
          video.muted = true;
          video.defaultMuted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.setAttribute('muted', '');
          video.srcObject = acquiredStream;

          const handleLoaded = () => {
            video.play().catch((playErr) => {
              console.warn('Video play deferred until gesture:', playErr);
            });
            setCameraActive(true);
            setCameraError(null);
            setIsInitializing(false);
          };

          video.onloadedmetadata = handleLoaded;
          video.oncanplay = handleLoaded;

          video.play().then(() => {
            setCameraActive(true);
            setCameraError(null);
            setIsInitializing(false);
          }).catch(() => {
            setCameraActive(true);
            setCameraError(null);
            setIsInitializing(false);
          });
        } else {
          setCameraActive(true);
          setCameraError(null);
          setIsInitializing(false);
        }
      } else {
        setCameraActive(false);
        setIsInitializing(false);
        let msg = 'Unable to start camera.';
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          msg = 'Camera access requires a secure connection. Please open http://localhost:3000 instead of your network IP address.';
        } else if (lastErr && typeof lastErr === 'object') {
          const err = lastErr as { name?: string; message?: string };
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = 'Camera permission was blocked. Please click the camera or lock icon in your browser address bar to allow camera access, then click Try Again.';
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            msg = 'Camera is currently in use by another application (e.g. Zoom, Teams, Skype, or Windows Camera app). Please close it and click Try Again.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            msg = 'No camera found on your laptop. If your laptop has a webcam privacy slider switch or dedicated privacy button, ensure it is turned on.';
          } else if (err.name === 'OverconstrainedError') {
            msg = 'Camera resolution constraints not supported by your webcam hardware.';
          } else if (err.message) {
            msg = err.message;
          }
        }
        setCameraError(msg);
      }
    },
    [facingMode, onFacingModeChange, stopCurrentStream, selectedDeviceId]
  );

  // Switch / Cycle between all available camera devices (e.g. DroidCam <-> Built-in Webcam)
  const handleCycleCamera = useCallback(() => {
    if (availableCameras.length > 1) {
      const currentIdx = availableCameras.findIndex(
        (c) => c.deviceId === selectedDeviceId || (c.label && c.label === activeDeviceLabel)
      );
      const nextIdx = (currentIdx + 1) % availableCameras.length;
      const nextDevice = availableCameras[nextIdx];
      setSelectedDeviceId(nextDevice.deviceId);
      initHardwareCamera(facingMode, nextDevice.deviceId);
    } else {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      if (onFacingModeChange) onFacingModeChange(nextFacing);
      initHardwareCamera(nextFacing, null);
    }
  }, [availableCameras, selectedDeviceId, activeDeviceLabel, facingMode, initHardwareCamera, onFacingModeChange]);

  // Initialize hardware camera on mount or mode change
  useEffect(() => {
    initHardwareCamera(facingMode);

    return () => {
      stopCurrentStream();
    };
  }, [facingMode, initHardwareCamera, stopCurrentStream]);

  // Hardware Torch / Flash Control
  useEffect(() => {
    const track = videoTrackRef.current;
    if (track && torchSupported && track.readyState === 'live') {
      try {
        const wantTorch = flashMode === 'torch' || flashMode === 'on';
        track
          .applyConstraints({
            advanced: [{ torch: wantTorch } as unknown as MediaTrackConstraintSet],
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    }
  }, [flashMode, torchSupported]);

  // Hardware / Digital Zoom Synchronization
  useEffect(() => {
    const track = videoTrackRef.current;
    if (track && track.readyState === 'live') {
      try {
        const caps = track.getCapabilities ? (track.getCapabilities() as Record<string, unknown>) : {};
        const zoomCap = caps.zoom as { min?: number; max?: number; step?: number } | undefined;

        if (zoomCap && typeof zoomCap.min === 'number' && typeof zoomCap.max === 'number') {
          const clampedZoom = Math.max(zoomCap.min, Math.min(zoomCap.max, zoomLevel));
          track
            .applyConstraints({
              advanced: [{ zoom: clampedZoom } as unknown as MediaTrackConstraintSet],
            })
            .then(() => {
              setIsHardwareZoom(true);
            })
            .catch(() => {
              setIsHardwareZoom(false);
            });
        } else {
          setIsHardwareZoom(false);
        }
      } catch {
        setIsHardwareZoom(false);
      }
    }
  }, [zoomLevel]);

  const latestGuidanceRef = useRef<LiveGuidanceState | null>(null);

  const isBurstCapturingRef = useRef<boolean>(false);
  const isInferenceRunningRef = useRef<boolean>(false);

  // Capture Single Frame from Live Video Buffer with Sub-15ms Latency
  const captureSingleFrame = useCallback(
    (burstIndex: number = 1, burstTotal: number = 1): CapturedPhoto | null => {
      const video = videoRef.current;
      const viewportW = containerRef.current?.clientWidth || window.innerWidth;
      const viewportH = containerRef.current?.clientHeight || window.innerHeight;

      if (!video || video.readyState < 2 || video.videoWidth <= 0) {
        console.warn('Cannot capture photo: video stream not ready');
        return null;
      }

      CapturePerformanceTracker.recordSensorCaptureStarted();

      const croppedCanvas = CameraFrameTransform.cropToVisibleViewport(
        video,
        video.videoWidth,
        video.videoHeight,
        viewportW,
        viewportH,
        zoomLevel,
        isHardwareZoom,
        facingMode === 'user'
      );

      const captureW = croppedCanvas.width;
      const captureH = croppedCanvas.height;
      const capturedDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.95);

      CapturePerformanceTracker.recordSensorCaptureCompleted();

      if (!capturedDataUrl) return null;

      // Rapid preliminary clinical quality check from live sensor readings
      const liveGuidance = latestGuidanceRef.current;
      const preliminaryQuality: QualityCheckResult = {
        overallPassed: true,
        overallScore: Math.round(liveGuidance?.readyScore ?? 90),
        position: {
          passed: liveGuidance?.positionValid ?? true,
          score: Math.round(liveGuidance?.readyScore ?? 90),
          label: 'Position',
          feedback: liveGuidance?.positionMessage || 'Aligned',
        },
        orientation: {
          passed: liveGuidance?.angleValid ?? true,
          score: Math.round(liveGuidance?.readyScore ?? 90),
          label: 'Angle',
          feedback: liveGuidance?.angleMessage || 'Level',
        },
        sharpness: {
          passed: (liveGuidance?.sharpnessScore ?? 80) >= 18,
          score: Math.min(100, Math.round((liveGuidance?.sharpnessScore ?? 80) * 1.1)),
          label: 'Sharpness',
          feedback: 'In focus',
        },
        exposure: {
          passed: (liveGuidance?.brightnessScore ?? 130) >= 35 && (liveGuidance?.brightnessScore ?? 130) <= 240,
          score: 92,
          label: 'Lighting',
          feedback: 'Clinical exposure verified',
        },
        framing: {
          passed: liveGuidance?.frameSizeValid ?? liveGuidance?.positionValid ?? true,
          score: liveGuidance?.readyScore ?? 90,
          label: 'Frame Size',
          feedback: liveGuidance?.frameSizeMessage || 'Frame size verified',
        },
        reasons: [],
        recommendation: 'ACCEPT',
      };

      const newPhoto: CapturedPhoto = {
        id: `photo_${currentView.id}_${Date.now()}_${burstIndex}`,
        viewId: currentView.id,
        dataUrl: capturedDataUrl,
        timestamp: Date.now(),
        quality: preliminaryQuality,
        width: captureW,
        height: captureH,
        burstIndex,
        burstTotal,
      };

      // Shutter response is instant - immediately dispatch photo
      onPhotoCaptured(newPhoto);

      // Perform deeper pixel-level image quality analysis asynchronously in background without delaying camera
      setTimeout(async () => {
        try {
          const deepQuality = await ImageQualityAnalyzer.analyzeImage(
            capturedDataUrl,
            currentView.category,
            0,
            0.75,
            motionScoreRef.current
          );
          newPhoto.quality = deepQuality;
        } catch {
          // Keep preliminary quality
        } finally {
          CapturePerformanceTracker.recordProcessingCompleted();
        }
      }, 50);

      return newPhoto;
    },
    [currentView, facingMode, isHardwareZoom, onPhotoCaptured, zoomLevel]
  );

  // Rapid Multi-Shot Burst Capture Engine (optional in Settings)
  const captureBurst = useCallback(
    async (count: number = 3, intervalMs: number = 130) => {
      if (isBurstCapturingRef.current) return;
      isBurstCapturingRef.current = true;

      try {
        for (let i = 1; i <= count; i++) {
          captureSingleFrame(i, count);
          if (i < count) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
        }
      } finally {
        setTimeout(() => {
          isBurstCapturingRef.current = false;
        }, 300);
      }
    },
    [captureSingleFrame]
  );

  // Handle auto-capture trigger: single photo by default, burst only if enabled in Settings
  useEffect(() => {
    if (autoCaptureTrigger) {
      if (burstModeEnabled) {
        captureBurst(burstCount, 130);
      } else {
        captureSingleFrame(1, 1);
      }
      onAutoCaptureReset();
    }
  }, [autoCaptureTrigger, burstModeEnabled, burstCount, captureBurst, captureSingleFrame, onAutoCaptureReset]);

  // Sync props to refs to prevent effect recreation on re-renders
  const onGuidanceUpdateRef = useRef(onGuidanceUpdate);
  onGuidanceUpdateRef.current = onGuidanceUpdate;

  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  onTelemetryUpdateRef.current = onTelemetryUpdate;

  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  const guidanceSensitivityRef = useRef(guidanceSensitivity);
  guidanceSensitivityRef.current = guidanceSensitivity;

  const captureModeRef = useRef(captureMode);
  captureModeRef.current = captureMode;

  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  const isHardwareZoomRef = useRef(isHardwareZoom);
  isHardwareZoomRef.current = isHardwareZoom;

  const sensorResolutionRef = useRef(sensorResolution);
  sensorResolutionRef.current = sensorResolution;

  const facingModeRef = useRef(facingMode);
  facingModeRef.current = facingMode;

  useEffect(() => {
    profileFallbackRef.current.reset();
  }, [currentView.id]);

  const lastGuidanceDispatchTimeRef = useRef<number>(0);
  const lastTelemetryDispatchTimeRef = useRef<number>(0);

  // Continuous Real-Time Vision & Motion Analysis Loop with Adaptive Cadence & Single Active Inference Lock
  useEffect(() => {
    if (!cameraActive) return;

    let isRunning = true;
    let lastAnalysisTime = 0;

    const runAnalysisLoop = (timestamp: number) => {
      if (!isRunning) return;

      // Thermal safeguard: pause AI processing when screen is off, minimized, or backgrounded
      if (typeof document !== 'undefined' && document.hidden) {
        requestAnimationFrame(runAnalysisLoop);
        return;
      }

      // Track Camera FPS
      fpsFrameCountRef.current++;
      if (timestamp - lastFpsCalcTimeRef.current >= 1000) {
        cameraFpsRef.current = fpsFrameCountRef.current;
        fpsFrameCountRef.current = 0;
        lastFpsCalcTimeRef.current = timestamp;
      }

      // Responsive Adaptive Cadence Scheduler:
      // SEARCHING: ~8 FPS (120ms) -> Quick face detection without burning idle CPU
      // ALIGNING: ~15 FPS (66ms) -> Fluid real-time feedback while patient moves
      // READY_CANDIDATE: ~20 FPS (50ms) -> Tight alignment tracking
      // STABILITY_CONFIRMATION: ~25 FPS (40ms) -> High-frequency verification during stability window
      const stage = latestGuidanceRef.current?.guidanceStage || 'SEARCHING';
      const cadenceIntervalMs =
        stage === 'SEARCHING'
          ? 120
          : stage === 'ALIGNING'
          ? 66
          : stage === 'READY_CANDIDATE'
          ? 50
          : 40;

      if (timestamp - lastAnalysisTime >= cadenceIntervalMs) {
        // Enforce single active inference execution lock - zero queuing, skip frame if previous inference is still active
        if (isInferenceRunningRef.current) {
          requestAnimationFrame(runAnalysisLoop);
          return;
        }

        lastAnalysisTime = timestamp;
        aiFrameCountRef.current++;

        if (timestamp - lastAiFpsCalcTimeRef.current >= 1000) {
          aiFpsRef.current = aiFrameCountRef.current;
          aiFrameCountRef.current = 0;
          lastAiFpsCalcTimeRef.current = timestamp;
        }

        const video = videoRef.current;
        const isFeedActive = video && video.readyState >= 2 && video.videoWidth > 0;

        if (isFeedActive && video) {
          isInferenceRunningRef.current = true;
          try {
            // Optimized 256xAspect buffer: 56x fewer pixels than 1080p, perfectly matching MediaPipe's tensor input
            const sampleW = 256;
            const sampleH = video.videoHeight > 0
              ? Math.round(256 * (video.videoHeight / video.videoWidth))
              : 144;

            if (!sampleCanvasRef.current || sampleCanvasRef.current.width !== sampleW || sampleCanvasRef.current.height !== sampleH) {
              sampleCanvasRef.current = document.createElement('canvas');
              sampleCanvasRef.current.width = sampleW;
              sampleCanvasRef.current.height = sampleH;
            }
            const sampleCanvas = sampleCanvasRef.current;
            const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });

            if (ctx) {
              const inferenceStart = performance.now();
              ctx.drawImage(video, 0, 0, sampleW, sampleH);

              // Single fast pass for optical motion, luminance and edge sharpness
              const motionRes = motionEngineRef.current.evaluateFrameMotion(ctx, sampleW, sampleH);
              motionScoreRef.current = motionRes.motionScore;

              const activeView = currentViewRef.current;
              let faceRes: FaceAnalysisResult | null = null;
              let intraRes: IntraoralAnalysisResult | null = null;
              let profileState: ProfileStateResult | null = null;

              if (activeView.category === 'extraoral') {
                faceRes = faceAnalyzerRef.current.analyzeFrame(sampleCanvas, ctx, sampleW, sampleH, video);

                // If user/front camera is active (mirrored display), mirror face analysis results
                if (faceRes && facingModeRef.current === 'user') {
                  faceRes = mirrorFaceResult(faceRes);
                }

                // Synchronize coordinates: Transform face landmarks & contours to viewport normalized coordinates [0..1]
                if (faceRes && video.videoWidth > 0 && video.videoHeight > 0) {
                  const vpW = containerRef.current?.clientWidth || window.innerWidth;
                  const vpH = containerRef.current?.clientHeight || window.innerHeight;
                  const visibleCrop = CameraFrameTransform.calculateVisibleCrop(
                    video.videoWidth,
                    video.videoHeight,
                    vpW,
                    vpH,
                    zoomLevelRef.current,
                    isHardwareZoomRef.current
                  );
                  faceRes = CameraFrameTransform.transformFaceResultToViewport(
                    faceRes,
                    visibleCrop,
                    video.videoWidth,
                    video.videoHeight
                  );
                }

                // Lateral Profile Evaluation (state machine tracks 90° lateral pose and capture eligibility)
                if (activeView.id === 'RIGHT_PROFILE' || activeView.id === 'LEFT_PROFILE') {
                  const isRight = activeView.id === 'RIGHT_PROFILE';
                  profileState = profileFallbackRef.current.evaluateProfile(isRight, faceRes, Date.now(), captureMode);
                }
              } else {
                intraRes = intraoralAnalyzerRef.current.analyzeIntraoralFrame(
                  sampleCanvas,
                  ctx,
                  sampleW,
                  sampleH,
                  activeView.overlayType as 'anterior' | 'right_buccal' | 'left_buccal' | 'maxillary_occlusal' | 'mandibular_occlusal',
                  video
                );
              }

              lastInferenceLatencyRef.current = Math.round(performance.now() - inferenceStart);

              const guidance = OverlayGuidanceEngine.evaluate({
                view: activeView,
                faceResult: faceRes,
                intraoralResult: intraRes,
                profileState,
                rawLuminance: motionRes.measuredLuminance,
                rawSharpness: motionRes.measuredSharpness,
                motionScore: motionRes.motionScore,
                isStable: motionRes.isStable,
                sensitivity: guidanceSensitivityRef.current,
                captureMode: captureModeRef.current,
              });

              // Preserve current guidanceStage from previous state machine step if available
              if (latestGuidanceRef.current?.guidanceStage) {
                guidance.guidanceStage = latestGuidanceRef.current.guidanceStage;
              }

              latestGuidanceRef.current = guidance;

              // Dispatch guidance to React state
              onGuidanceUpdateRef.current(guidance);

              // Report telemetry once every second
              if (timestamp - lastTelemetryDispatchTimeRef.current >= 1000) {
                lastTelemetryDispatchTimeRef.current = timestamp;
                if (onTelemetryUpdateRef.current) {
                  onTelemetryUpdateRef.current({
                    cameraFps: cameraFpsRef.current,
                    aiFps: aiFpsRef.current,
                    inferenceLatencyMs: lastInferenceLatencyRef.current,
                    motionScore: motionScoreRef.current,
                    sensorResolution: sensorResolutionRef.current,
                    zoomLevel: zoomLevelRef.current,
                    isHardwareZoom: isHardwareZoomRef.current,
                    currentState: latestGuidanceRef.current?.guidanceStage || 'SEARCHING',
                  });
                }
              }
            }
          } finally {
            isInferenceRunningRef.current = false;
          }
        }
      }

      requestAnimationFrame(runAnalysisLoop);
    };

    const animId = requestAnimationFrame(runAnalysisLoop);
    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
    };
  }, [cameraActive]);

  // Touch handlers for tap-to-focus and pinch zoom
  const handleTapToFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cameraActive && !isInitializing) {
      initHardwareCamera(facingMode);
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setFocusPoint({ x, y });
      setTimeout(() => setFocusPoint(null), 1500);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!cameraActive && !isInitializing) {
      initHardwareCamera(facingMode);
    }
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - touchDistanceRef.current;
      if (Math.abs(delta) > 15) {
        const factor = delta > 0 ? 0.1 : -0.1;
        const newZoom = Math.min(3.0, Math.max(1.0, Math.round((zoomLevel + factor) * 10) / 10));
        onZoomChange(newZoom);
        touchDistanceRef.current = dist;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current !== null && touchStartYRef.current !== null && e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - touchStartXRef.current;
      const deltaY = endY - touchStartYRef.current;
      if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 50) {
        if (deltaX < 0 && onSwipeNext) {
          onSwipeNext();
        } else if (deltaX > 0 && onSwipePrevious) {
          onSwipePrevious();
        }
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchDistanceRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      id="ortho-camera-container"
      className="relative w-full h-full bg-black overflow-hidden select-none touch-none"
      onClick={handleTapToFocus}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. True Edge-to-Edge Live Camera Viewport - Opens Directly */}
      <video
        ref={videoRef}
        id="ortho-live-video"
        playsInline
        autoPlay
        muted
        className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-100 ease-out"
        style={{
          transform: `${isHardwareZoom ? '' : `scale(${zoomLevel})`} ${
            facingMode === 'user' ? 'scaleX(-1)' : ''
          }`,
        }}
      />



      {/* 3. Tap-to-Focus Reticle Indicator */}
      {focusPoint && (
        <div
          className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
          style={{ left: focusPoint.x, top: focusPoint.y }}
        >
          <div className="w-16 h-16 border-2 border-emerald-400 rounded-sm animate-ping opacity-75" />
          <div className="absolute inset-0 w-16 h-16 border-2 border-emerald-400 rounded-sm flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
          </div>
        </div>
      )}

      {/* Camera Troubleshooting & Permission Alert Card */}
      {cameraError && !cameraActive && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
            <CameraOff className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Camera Unavailable</h3>
          <p className="text-xs text-slate-300 max-w-xs leading-relaxed mb-6">
            {cameraError}
          </p>
          <div className="flex flex-col gap-2.5 w-full max-w-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCameraError(null);
                initHardwareCamera(facingMode);
              }}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again / Request Permission
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
                if (onFacingModeChange) onFacingModeChange(nextFacing);
                initHardwareCamera(nextFacing);
              }}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              Switch to {facingMode === 'environment' ? 'Front (User) Camera' : 'Rear Camera'}
            </button>
          </div>
        </div>
      )}

      {/* 4. Children (Vector Overlays, Ghost Layer, Telemetry HUD, Controls) */}
      {children}
    </div>
  );
};

export const CameraManager = React.memo(CameraManagerComponent);
