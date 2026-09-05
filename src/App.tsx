import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppSettings,
  CapturedPhoto,
  ClinicalCase,
  LiveGuidanceState,
  ViewId,
  CaptureMode,
} from './types';
import { ORTHODONTIC_VIEWS, getViewByIndex } from './photo_workflow/workflowData';
import { CaseStorage } from './storage/caseStorage';
import { GalleryStorage } from './storage/galleryStorage';
import { CameraManager, CameraTelemetry } from './camera/CameraManager';
import { OrthodonticOverlayCanvas } from './overlay/OrthodonticOverlayCanvas';
import { WorkflowHeader } from './photo_workflow/WorkflowHeader';
import { CameraControls } from './photo_workflow/CameraControls';
import { LiveGuidanceHUD } from './photo_workflow/LiveGuidanceHUD';
import { QuickReviewOverlay } from './photo_workflow/QuickReviewOverlay';
import { ProgressDrawer } from './photo_workflow/ProgressDrawer';
import { PhotoLightboxModal } from './photo_workflow/PhotoLightboxModal';
import { PatientInfoModal } from './case_management/PatientInfoModal';
import { SettingsModal } from './settings/SettingsModal';
import { AndroidGuideModal } from './components/AndroidGuideModal';
import { GhostOverlayManager } from './overlay/GhostOverlayManager';
import { DiagnosticsHUD } from './components/DiagnosticsHUD';
import { HysteresisController } from './ai_positioning/HysteresisController';
import { VoiceGuidance } from './ai_positioning/VoiceGuidanceEngine';
import { MediaPipeVision, MediaPipeModelStatus } from './ai_positioning/MediaPipeVisionEngine';
import { CapturePerformanceTracker } from './telemetry/CapturePerformanceTracker';
import { Check, AlertCircle, Camera } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  autoCaptureEnabled: true,
  captureMode: 'balanced',
  voiceGuidanceEnabled: false,
  autoCaptureDelaySec: 0,
  burstModeEnabled: false,
  burstCount: 3,
  stabilityConfirmationMs: 180,
  showClinicalGrid: false,
  showFaceMesh: true,
  showReferenceLabels: true,
  overlayOpacity: 0.85,
  overlayColor: 'cyan',
  soundEffects: true,
  hapticFeedback: true,
  highResolution: true,
  guidanceSensitivity: 'medium',
  autoSaveToGallery: true,
  handsFreeAutoAdvance: true, // Seamless clinical hands-free capture
  diagnosticsOverlay: false,
  ghostOverlayEnabled: false,
  ghostOverlayOpacity: 0.2,
  allowManualCaptureOverride: true,
};

export default function App() {
  // --- STATE ---
  const [activeCase, setActiveCase] = useState<ClinicalCase>(() => {
    return CaseStorage.createDefaultCase();
  });

  const [currentViewIndex, setCurrentViewIndex] = useState<number>(0);
  const currentView = getViewByIndex(currentViewIndex + 1);

  // Live AI Guidance State
  const [guidance, setGuidance] = useState<LiveGuidanceState>({
    isReady: false,
    readyScore: 0,
    primaryMessage: 'Align patient in transparent guide',
    statusType: 'searching',
    positionValid: false,
    positionMessage: 'Position',
    angleValid: false,
    angleMessage: 'Angle',
    distanceValid: false,
    distanceMessage: 'Distance',
    sharpnessValid: true,
    exposureValid: true,
    headRollDeg: 0,
    headYawDeg: 0,
    headPitchDeg: 0,
    centeringDeltaX: 0,
    centeringDeltaY: 0,
    coverageRatio: 0.65,
    brightnessScore: 135,
    sharpnessScore: 88,
  });

  // Camera Settings
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto' | 'torch'>('off');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(() => {
    if (typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      return 'user';
    }
    return 'environment';
  });
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Settings & Preferences
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Post-Capture Quick Review
  const [capturedPhotoForReview, setCapturedPhotoForReview] = useState<CapturedPhoto | null>(null);

  // Modals & Drawers
  const [isStepDrawerOpen, setIsStepDrawerOpen] = useState<boolean>(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAndroidDocsOpen, setIsAndroidDocsOpen] = useState<boolean>(false);
  const [photoForLightbox, setPhotoForLightbox] = useState<CapturedPhoto | null>(null);

  // Track last saved native gallery URI
  const [latestGalleryUri, setLatestGalleryUri] = useState<string | null>(null);

  // Toast notification for phone gallery saving
  const [galleryToast, setGalleryToast] = useState<{ message: string; filename: string; fileUrl?: string } | null>(null);

  // Launch & Initialization Splash
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [initStage, setInitStage] = useState<string>('Ready');

  // Auto-Capture Countdown State & Hysteresis
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
  const [autoCaptureTrigger, setAutoCaptureTrigger] = useState<boolean>(false);
  const hysteresisRef = useRef<HysteresisController>(new HysteresisController());

  // Hands-Free Confirmation Flash (800ms)
  const [flashGreenConfirmation, setFlashGreenConfirmation] = useState<boolean>(false);

  // Telemetry Metrics for Diagnostics HUD
  const [telemetry, setTelemetry] = useState<CameraTelemetry>({
    cameraFps: 60,
    aiFps: 30,
    inferenceLatencyMs: 18,
    motionScore: 0,
    sensorResolution: { width: 1920, height: 1080 },
    zoomLevel: 1.0,
    isHardwareZoom: false,
  });

  // MediaPipe AI Model Status Listener
  const [aiModelStatus, setAiModelStatus] = useState<MediaPipeModelStatus>(() =>
    MediaPipeVision.getStatus()
  );

  useEffect(() => {
    return MediaPipeVision.subscribe((status) => {
      setAiModelStatus(status);
    });
  }, []);

  // Load persistent storage in background without blocking UI
  useEffect(() => {
    CaseStorage.init().then(() => {
      CaseStorage.loadLatestCase().then((saved) => {
        if (saved) setActiveCase(saved);
      });
    });
  }, []);

  // Update Hysteresis Controller stability confirmation duration and capture mode when settings change
  useEffect(() => {
    hysteresisRef.current.setStabilityConfirmationDuration(settings.stabilityConfirmationMs || 180);
    hysteresisRef.current.setCaptureMode(settings.captureMode || 'balanced');
  }, [settings.stabilityConfirmationMs, settings.captureMode]);

  // Audio Chime Synthesizer
  const playCaptureChime = useCallback(() => {
    if (!settings.soundEffects) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // Audio context restricted or muted
    }
  }, [settings.soundEffects]);

  // Handle Guidance Updates from Camera Manager & Drive Hysteresis Controller
  const handleGuidanceUpdate = useCallback(
    (newGuidance: LiveGuidanceState) => {
      if (capturedPhotoForReview !== null) {
        setAutoCaptureCountdown(null);
        setGuidance(newGuidance);
        return;
      }

      // Sync settings to hysteresis and voice guidance
      hysteresisRef.current.setCaptureMode(settings.captureMode || 'balanced');
      VoiceGuidance.setEnabled(Boolean(settings.voiceGuidanceEnabled));

      // Drive state machine with hysteresis: SEARCHING -> ALIGNING -> READY_CANDIDATE -> STABILITY_CONFIRMATION -> CAPTURE
      const isMotionStatic = (newGuidance.motionScore ?? 0) < 20;
      const update = hysteresisRef.current.update(
        newGuidance.readiness || newGuidance.readyScore,
        newGuidance.positionValid,
        newGuidance.angleValid,
        isMotionStatic,
        settings.autoCaptureEnabled
      );

      const enhancedGuidance: LiveGuidanceState = {
        ...newGuidance,
        captureMode: settings.captureMode || 'balanced',
        guidanceStage: update.guidanceStage,
        timeToCaptureMs: update.timeToCaptureMs,
        isReady: update.guidanceStage === 'READY_CANDIDATE' || update.guidanceStage === 'STABILITY_CONFIRMATION',
      };
      setGuidance(enhancedGuidance);

      // Auditory clinical voice guidance
      VoiceGuidance.update(enhancedGuidance);

      setAutoCaptureCountdown(update.countdownSeconds);

      if (update.shouldTriggerCapture) {
        setAutoCaptureTrigger(true);
      }
    },
    [capturedPhotoForReview, settings.autoCaptureEnabled, settings.captureMode, settings.voiceGuidanceEnabled]
  );

  // Capture Mode cycling handler (Fast -> Balanced -> Clinical -> Fast)
  const handleCycleCaptureMode = useCallback(() => {
    const modes: CaptureMode[] = ['fast', 'balanced', 'clinical'];
    const nextIdx = (modes.indexOf(settings.captureMode || 'balanced') + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setSettings((prev) => ({ ...prev, captureMode: nextMode }));
    hysteresisRef.current.setCaptureMode(nextMode);
  }, [settings.captureMode]);

  // Voice Guidance toggle handler
  const handleToggleVoiceGuidance = useCallback(() => {
    setSettings((prev) => {
      const next = !prev.voiceGuidanceEnabled;
      VoiceGuidance.setEnabled(next);
      if (next) {
        VoiceGuidance.speakImmediate('Voice guidance active');
      }
      return { ...prev, voiceGuidanceEnabled: next };
    });
  }, []);

  // Flash cycling handler
  const handleCycleFlash = () => {
    const modes: ('off' | 'on' | 'auto' | 'torch')[] = ['off', 'on', 'auto', 'torch'];
    const nextIdx = (modes.indexOf(flashMode) + 1) % modes.length;
    setFlashMode(modes[nextIdx]);
  };

  // Flip Front/Rear camera
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Keyboard Hardware Shutter Trigger (Spacebar, Enter, Hardware Volume keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (
        e.code === 'Space' ||
        e.code === 'Enter' ||
        e.key === 'AudioVolumeUp' ||
        e.key === 'AudioVolumeDown' ||
        e.key === 'MediaPlayPause'
      ) {
        e.preventDefault();
        triggerManualCapture();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Trigger Manual Shutter (Never blocked: clinician manual capture always triggers immediately)
  const triggerManualCapture = () => {
    setAutoCaptureTrigger(true);
  };

  // When Photo is Captured: Direct Save to Phone Storage / Gallery / IndexedDB
  // When Photo is Captured: Direct Save to Phone Storage / Gallery (with Rapid Burst Support)
  const handlePhotoCaptured = useCallback(
    (photo: CapturedPhoto) => {
      const isBurst = typeof photo.burstIndex === 'number' && typeof photo.burstTotal === 'number';
      const isFinalInBurst = !isBurst || photo.burstIndex === photo.burstTotal;
      const burstSuffix = isBurst ? String(photo.burstIndex) : undefined;

      // 1. Immediately persist photo to active case in state and IndexedDB storage
      const updatedPhotos = {
        ...activeCase.photos,
        [photo.viewId]: photo,
      };
      const updatedCase: ClinicalCase = {
        ...activeCase,
        photos: updatedPhotos,
        updatedAt: Date.now(),
      };
      setActiveCase(updatedCase);
      CaseStorage.saveCase(updatedCase);

      // 2. Immediate audio & haptic confirmation feedback per shot
      playCaptureChime();
      CapturePerformanceTracker.recordCaptureFeedback();

      // Spoken voice feedback
      if (settings.voiceGuidanceEnabled) {
        VoiceGuidance.speakImmediate('Photo captured');
      }

      if (settings.hapticFeedback && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 40, 30]);
      }

      // 3. Trigger 200ms crisp shutter flash pulse
      setFlashGreenConfirmation(true);
      setTimeout(() => setFlashGreenConfirmation(false), 200);

      // 4. Directly save photo to phone gallery with burst suffix (_1, _2, _3)
      GalleryStorage.savePhotoToGallery(photo, activeCase, currentView, {
        suffix: burstSuffix,
      }).then((saveRes) => {
        CapturePerformanceTracker.recordGallerySaveCompleted();
        if (saveRes.uri) {
          setLatestGalleryUri(saveRes.uri);
        }
        if (saveRes.success && saveRes.method === 'gallery') {
          setGalleryToast({
            message: isBurst
              ? `Burst ${photo.burstIndex}/${photo.burstTotal} Saved`
              : 'Saved directly to Gallery',
            filename: `${saveRes.filename} (Pictures/Orthocamera)`,
          });
        } else if (saveRes.success && saveRes.method === 'downloads') {
          setGalleryToast({
            message: isBurst
              ? `Burst ${photo.burstIndex}/${photo.burstTotal} Saved`
              : 'Saved directly to Downloads',
            filename: saveRes.filename,
          });
        } else {
          setGalleryToast({
            message: 'Gallery Save Failed',
            filename: saveRes.error || saveRes.filename,
          });
        }
        setTimeout(() => setGalleryToast(null), 3000);
      });

      // 5. Hands-Free Auto Advance Workflow (advances ONLY after the final burst shot)
      if (isFinalInBurst) {
        if (settings.handsFreeAutoAdvance) {
          const totalViews = ORTHODONTIC_VIEWS.length;
          if (currentViewIndex < totalViews - 1) {
            setCurrentViewIndex(currentViewIndex + 1);
          } else {
            // All 11 photos complete
            setGalleryToast({
              message: 'All 11 Positions Captured!',
              filename: 'Complete 3-photo burst sets in Pictures/Orthocamera',
            });
            setTimeout(() => setGalleryToast(null), 5000);
          }
        } else {
          setCapturedPhotoForReview(photo);
        }
      }
    },
    [
      activeCase,
      currentView,
      currentViewIndex,
      playCaptureChime,
      settings.autoSaveToGallery,
      settings.handsFreeAutoAdvance,
      settings.hapticFeedback,
      settings.voiceGuidanceEnabled,
    ]
  );

  // Accept Photo & Advance to Next View (Manual Review Modal)
  const handleAcceptPhoto = async () => {
    if (!capturedPhotoForReview) return;
    setCapturedPhotoForReview(null);

    const totalViews = ORTHODONTIC_VIEWS.length;
    if (currentViewIndex < totalViews - 1) {
      setCurrentViewIndex(currentViewIndex + 1);
    } else {
      setGalleryToast({
        message: 'All 11 Photos Saved to Phone Gallery!',
        filename: 'Complete set in your device Photos/Gallery',
      });
      setTimeout(() => setGalleryToast(null), 4500);
    }
  };

  const photoList = Object.values(activeCase.photos).filter(
    (p): p is CapturedPhoto => Boolean(p)
  );
  const latestPhoto = photoList.sort((a, b) => b.timestamp - a.timestamp)[0];

  // Open phone's native gallery (Google Photos / Samsung Gallery) or device photo gallery
  const handleOpenGallery = useCallback(async () => {
    if (GalleryStorage.isNativeAndroid()) {
      setGalleryToast({
        message: 'Opening Mobile Gallery',
        filename: 'Pictures/Orthocamera',
      });
      setTimeout(() => setGalleryToast(null), 2500);

      const res = await GalleryStorage.openGallery(latestGalleryUri || undefined);
      if (!res.success && res.error) {
        setGalleryToast({
          message: 'Gallery Notice',
          filename: res.error,
        });
        setTimeout(() => setGalleryToast(null), 3000);
      }
    } else {
      // In web / mobile browser:
      // If clinician has captured a photo, preview it in high-res lightbox.
      // Otherwise, directly launch the device's native mobile gallery (never show workflow drawer).
      if (latestPhoto) {
        setPhotoForLightbox(latestPhoto);
      } else {
        setGalleryToast({
          message: 'Opening Mobile Gallery',
          filename: 'Pictures/Orthocamera',
        });
        setTimeout(() => setGalleryToast(null), 2500);

        const res = await GalleryStorage.openGallery(undefined, (dataUrl) => {
          setPhotoForLightbox({
            viewId: currentView.id,
            dataUrl,
            timestamp: Date.now(),
            metadata: {
              motionScore: 0,
              sharpnessScore: 100,
              framingValid: true,
              angleValid: true,
              lightingValid: true,
            },
          });
        });

        if (!res.success && res.error) {
          setGalleryToast({
            message: 'Gallery Notice',
            filename: res.error,
          });
          setTimeout(() => setGalleryToast(null), 3000);
        }
      }
    }
  }, [latestGalleryUri, latestPhoto, currentView.id]);

  // Delete a captured photo from the active clinical case
  const handleDeletePhoto = (viewId: ViewId) => {
    const viewDef = ORTHODONTIC_VIEWS.find((v) => v.id === viewId);
    const viewName = viewDef?.name || 'Photo';

    // Persist removal in storage
    const updatedCase = CaseStorage.deletePhotoFromCase(activeCase.id, viewId);
    if (updatedCase) {
      setActiveCase(updatedCase);
    } else {
      const updatedPhotos = { ...activeCase.photos };
      delete updatedPhotos[viewId];
      const newActive: ClinicalCase = {
        ...activeCase,
        photos: updatedPhotos,
        updatedAt: Date.now(),
      };
      setActiveCase(newActive);
      CaseStorage.saveCase(newActive);
    }

    // Dismiss review overlay if deleting current review photo
    if (capturedPhotoForReview?.viewId === viewId) {
      setCapturedPhotoForReview(null);
    }

    setGalleryToast({
      message: `${viewName} deleted`,
      filename: 'Removed from patient case records',
    });
    setTimeout(() => setGalleryToast(null), 3000);
  };

  // Retake Photo
  const handleRetakePhoto = () => {
    if (capturedPhotoForReview) {
      // Discard from case if it was pre-saved
      handleDeletePhoto(capturedPhotoForReview.viewId);
    }
    setCapturedPhotoForReview(null);
  };

  // Retake a specific view from the gallery / final review
  const handleRetakeSpecificView = (viewId: ViewId) => {
    const targetIdx = ORTHODONTIC_VIEWS.findIndex((v) => v.id === viewId);
    if (targetIdx >= 0) {
      setCurrentViewIndex(targetIdx);
      setIsStepDrawerOpen(false);
    }
  };

  // Create New Patient Case
  const handleNewCase = () => {
    const newCase = CaseStorage.createDefaultCase();
    setActiveCase(newCase);
    CaseStorage.saveCase(newCase);
    setCurrentViewIndex(0);
  };

  const capturedCount = Object.keys(activeCase.photos).length;
  const nextView =
    currentViewIndex < ORTHODONTIC_VIEWS.length - 1
      ? ORTHODONTIC_VIEWS[currentViewIndex + 1]
      : undefined;

  // Longitudinal Ghost Reference Image
  const existingViewPhoto = activeCase.photos[currentView.id]?.dataUrl || null;

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans text-white select-none">
      <main className="relative w-full h-full md:max-w-md md:max-h-[920px] md:h-[94vh] md:rounded-[40px] md:border md:border-slate-800/80 md:shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col bg-black overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. PRIMARY LAYER: FULL-SCREEN EDGE-TO-EDGE CAMERA PREVIEW               */}
      {/* ========================================================================= */}
      <CameraManager
        currentView={currentView}
        guidanceSensitivity={settings.guidanceSensitivity}
        captureMode={settings.captureMode}
        onGuidanceUpdate={handleGuidanceUpdate}
        onPhotoCaptured={handlePhotoCaptured}
        autoCaptureTrigger={autoCaptureTrigger}
        onAutoCaptureReset={() => setAutoCaptureTrigger(false)}
        flashMode={flashMode}
        facingMode={facingMode}
        onFacingModeChange={setFacingMode}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        burstModeEnabled={settings.burstModeEnabled}
        burstCount={settings.burstCount}
        onTelemetryUpdate={setTelemetry}
        onSwipeNext={() => setCurrentViewIndex((prev) => Math.min(ORTHODONTIC_VIEWS.length - 1, prev + 1))}
        onSwipePrevious={() => setCurrentViewIndex((prev) => Math.max(0, prev - 1))}
      >
        {/* Single Smart Alignment HUD: Score, Rejection Reasons, and AI Status */}
        <LiveGuidanceHUD
          guidance={guidance}
          currentView={currentView}
          captureMode={settings.captureMode}
          aiModelStatus={aiModelStatus}
        />

        {/* ======================================================================= */}
        {/* 2. GHOST OVERLAY LAYER: LONGITUDINAL STANDARDIZATION (Live Only)         */}
        {/* ======================================================================= */}
        <GhostOverlayManager
          ghostImageUrl={existingViewPhoto}
          isEnabled={settings.ghostOverlayEnabled}
          opacity={settings.ghostOverlayOpacity}
          onToggle={(enabled) =>
            setSettings((prev) => ({ ...prev, ghostOverlayEnabled: enabled }))
          }
          onChangeOpacity={(opacity) =>
            setSettings((prev) => ({ ...prev, ghostOverlayOpacity: opacity }))
          }
        />

        {/* ======================================================================= */}
        {/* 3. OVERLAY LAYER: TRANSPARENT ORTHODONTIC GUIDELINES                    */}
        {/* ======================================================================= */}
        <OrthodonticOverlayCanvas
          view={currentView}
          guidance={guidance}
          showFaceMesh={settings.showFaceMesh}
          onToggleFaceMesh={() => setSettings(prev => ({ ...prev, showFaceMesh: !prev.showFaceMesh }))}
          showGrid={settings.showClinicalGrid}
          showLabels={settings.showReferenceLabels}
          showMesh={settings.showFaceMesh}
          opacity={settings.overlayOpacity}
          colorTheme={settings.overlayColor}
        />

        {/* ======================================================================= */}
        {/* 4. HUD LAYER: SLEEK TOP BAR (Mobile Camera Style)                       */}
        {/* ======================================================================= */}
        <WorkflowHeader
          currentView={currentView}
          currentIndex={currentViewIndex}
          totalViews={ORTHODONTIC_VIEWS.length}
          activeCase={activeCase}
          guidance={guidance}
          onOpenStepDrawer={() => setIsStepDrawerOpen(true)}
          onOpenPatientModal={() => setIsPatientModalOpen(true)}
          onDeleteCurrentPhoto={() => handleDeletePhoto(currentView.id)}
          flashMode={flashMode}
          onCycleFlash={handleCycleFlash}
          voiceGuidanceEnabled={settings.voiceGuidanceEnabled}
          onToggleVoiceGuidance={handleToggleVoiceGuidance}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Real-time Diagnostics HUD (Toggled via Settings) */}
        <DiagnosticsHUD
          isOpen={settings.diagnosticsOverlay}
          onClose={() => setSettings((prev) => ({ ...prev, diagnosticsOverlay: false }))}
          currentView={currentView}
          guidance={guidance}
          cameraFps={telemetry.cameraFps}
          aiFps={telemetry.aiFps}
          inferenceLatencyMs={telemetry.inferenceLatencyMs}
          motionScore={telemetry.motionScore}
          sensorResolution={telemetry.sensorResolution}
          zoomLevel={telemetry.zoomLevel}
          isHardwareZoom={telemetry.isHardwareZoom}
        />

        {/* ======================================================================= */}
        {/* 5. CONTROLS LAYER: BOTTOM SHUTTER & VIEW SELECTOR (Mobile Camera Style) */}
        {/* ======================================================================= */}
        <CameraControls
          guidance={guidance}
          currentView={currentView}
          currentIndex={currentViewIndex}
          totalViews={ORTHODONTIC_VIEWS.length}
          onPrevious={() => setCurrentViewIndex((prev) => Math.max(0, prev - 1))}
          onNext={() =>
            setCurrentViewIndex((prev) => Math.min(ORTHODONTIC_VIEWS.length - 1, prev + 1))
          }
          onOpenStepDrawer={() => setIsStepDrawerOpen(true)}
          onCapture={triggerManualCapture}
          onForceCapture={triggerManualCapture}
          onSwitchCamera={handleSwitchCamera}
          zoomLevel={zoomLevel}
          onSetZoom={setZoomLevel}
          autoCaptureCountdown={autoCaptureCountdown}
          capturedCount={capturedCount}
          latestPhotoThumbnail={latestPhoto?.dataUrl}
          autoCaptureEnabled={settings.autoCaptureEnabled}
          onToggleAutoCapture={() =>
            setSettings((prev) => ({
              ...prev,
              autoCaptureEnabled: !prev.autoCaptureEnabled,
            }))
          }
          captureMode={settings.captureMode}
          onCycleCaptureMode={handleCycleCaptureMode}
          onOpenGallery={handleOpenGallery}
        />
      </CameraManager>

      {/* 800ms Green Confirmation Flash Border for Hands-Free Capture */}
      {flashGreenConfirmation && (
        <div className="absolute inset-0 z-70 pointer-events-none border-8 border-emerald-400 md:rounded-[40px] transition-opacity duration-300 animate-pulse" />
      )}

      {/* ========================================================================= */}
      {/* 6. MODALS & OVERLAYS                                                      */}
      {/* ========================================================================= */}

      {/* Toast Notification: Phone Storage / Gallery Save Confirmation */}
      {galleryToast && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-80 animate-in fade-in slide-in-from-top duration-300 pointer-events-none w-max max-w-[90%]">
          <div
            className={`border px-4 py-2 rounded-full shadow-[0_0_25px_rgba(16,185,129,0.5)] backdrop-blur-xl flex items-center gap-2.5 text-xs font-medium ${
              galleryToast.message === 'Save Failed'
                ? 'bg-rose-950/95 border-rose-500/70 text-rose-200'
                : 'bg-emerald-950/95 border-emerald-500/70 text-emerald-200'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                galleryToast.message === 'Save Failed'
                  ? 'bg-rose-500/30 text-rose-400'
                  : 'bg-emerald-500/30 text-emerald-400'
              }`}
            >
              {galleryToast.message === 'Save Failed' ? (
                <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              )}
            </div>
            <div className="text-left">
              <span className="font-bold text-white block">{galleryToast.message}</span>
              <span
                className={`font-mono text-[10px] ${
                  galleryToast.message === 'Save Failed' ? 'text-rose-300/90' : 'text-emerald-300/90'
                }`}
              >
                {galleryToast.filename}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Post-Capture Review Overlay (Shown when hands-free is disabled) */}
      {capturedPhotoForReview && (
        <QuickReviewOverlay
          photo={capturedPhotoForReview}
          currentView={currentView}
          nextViewName={nextView?.name}
          onAccept={handleAcceptPhoto}
          onRetake={handleRetakePhoto}
          onDiscard={() => {
            if (capturedPhotoForReview) {
              handleDeletePhoto(capturedPhotoForReview.viewId);
            }
            setCapturedPhotoForReview(null);
          }}
          onSaveToGallery={() => {
            GalleryStorage.savePhotoToGallery(capturedPhotoForReview, activeCase, currentView).then((saveRes) => {
              if (saveRes.success && saveRes.method === 'gallery') {
                setGalleryToast({
                  message: 'Saved to Gallery',
                  filename: `${saveRes.filename} (Pictures/Orthocamera)`,
                });
              } else if (saveRes.success && saveRes.method === 'downloads') {
                setGalleryToast({
                  message: 'Saved to Downloads',
                  filename: saveRes.filename,
                });
              } else {
                setGalleryToast({
                  message: 'Save Failed',
                  filename: saveRes.error || saveRes.filename,
                });
              }
              setTimeout(() => setGalleryToast(null), 3500);
            });
          }}
        />
      )}

      {/* Standardized 11-View Step Progress Drawer */}
      <ProgressDrawer
        isOpen={isStepDrawerOpen}
        onClose={() => setIsStepDrawerOpen(false)}
        currentIndex={currentViewIndex}
        onSelectViewIndex={(idx) => setCurrentViewIndex(idx)}
        capturedPhotos={activeCase.photos}
        onDeletePhoto={handleDeletePhoto}
      />

      {/* Patient & Case Information Modal */}
      <PatientInfoModal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        activeCase={activeCase}
        onSaveCaseInfo={(updated) => {
          setActiveCase(updated);
          CaseStorage.saveCase(updated);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onOpenAndroidDocs={() => setIsAndroidDocsOpen(true)}
      />

      {/* Android & Future AI Architecture Documentation Modal */}
      <AndroidGuideModal
        isOpen={isAndroidDocsOpen}
        onClose={() => setIsAndroidDocsOpen(false)}
      />

      {/* High-Resolution Captured Photo Lightbox Modal */}
      {photoForLightbox && (
        <PhotoLightboxModal
          photo={photoForLightbox}
          onClose={() => setPhotoForLightbox(null)}
          onOpenMobileGallery={handleOpenGallery}
          patientName={activeCase.patientName || activeCase.patientId}
        />
      )}

      {/* Professional Clinical Launch Splash */}
      {isInitializing && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 pointer-events-auto">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-6 shadow-[0_0_35px_rgba(6,182,212,0.25)]">
            <Camera className="w-8 h-8 text-cyan-400 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-white mb-1.5 font-sans">
            ORTHOCAMERA
          </h1>
          <p className="text-xs text-slate-400 font-medium tracking-wider uppercase mb-8">
            Orthodontic Clinical Photography System
          </p>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono text-cyan-300 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{initStage}</span>
          </div>
        </div>
      )}
    </main>
    </div>
  );
}
