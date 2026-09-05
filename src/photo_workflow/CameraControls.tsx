import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
  Zap,
} from 'lucide-react';
import { LiveGuidanceState, OrthodonticViewDefinition } from '../types';

interface CameraControlsProps {
  guidance: LiveGuidanceState;
  currentView?: OrthodonticViewDefinition;
  currentIndex?: number;
  totalViews?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenStepDrawer?: () => void;
  onCapture: () => void;
  onForceCapture?: () => void;
  onSwitchCamera: () => void;
  zoomLevel: number;
  onSetZoom: (zoom: number) => void;
  autoCaptureCountdown: number | null;
  capturedCount: number;
  latestPhotoThumbnail?: string;
  autoCaptureEnabled?: boolean;
  onToggleAutoCapture?: () => void;
  onOpenGallery?: () => void;
  captureMode?: 'fast' | 'balanced' | 'clinical';
  onCycleCaptureMode?: () => void;
  // Retained for backward compatibility
  flashMode?: 'off' | 'on' | 'auto' | 'torch';
  onCycleFlash?: () => void;
  onOpenSettings?: () => void;
  voiceGuidanceEnabled?: boolean;
  onToggleVoiceGuidance?: () => void;
}

const CameraControlsComponent: React.FC<CameraControlsProps> = ({
  guidance,
  currentView,
  currentIndex = 0,
  totalViews = 11,
  onPrevious,
  onNext,
  onOpenStepDrawer,
  onCapture,
  onForceCapture,
  onSwitchCamera,
  zoomLevel,
  onSetZoom,
  autoCaptureCountdown,
  capturedCount,
  latestPhotoThumbnail,
  autoCaptureEnabled = true,
  onToggleAutoCapture,
  onOpenGallery,
  captureMode = 'balanced',
  onCycleCaptureMode,
}) => {
  const isReady = guidance.isReady;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 pb-safe pb-3 pt-4 flex flex-col items-center pointer-events-auto bg-gradient-to-t from-black via-black/80 to-transparent select-none">
      {/* 1. VIEW / MODE SELECTOR (Mimics iOS/Android Camera Mode Carousel) */}
      {currentView && (
        <div className="flex items-center justify-center gap-3 mb-2 px-6 w-full max-w-sm">
          {onPrevious && (
            <button
              onClick={onPrevious}
              disabled={currentIndex === 0}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                currentIndex === 0
                  ? 'text-white/20 cursor-not-allowed'
                  : 'text-white/70 hover:text-white active:scale-90 cursor-pointer'
              }`}
              aria-label="Previous position"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          <button
            onClick={onOpenStepDrawer}
            className="flex-1 text-center font-sans text-xs sm:text-sm font-extrabold uppercase tracking-wider text-amber-300 drop-shadow hover:text-amber-200 transition-colors cursor-pointer truncate"
            title="Tap to view all 11 views"
          >
            {currentView.name}
          </button>

          {onNext && (
            <button
              onClick={onNext}
              disabled={currentIndex === totalViews - 1}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                currentIndex === totalViews - 1
                  ? 'text-white/20 cursor-not-allowed'
                  : 'text-white/70 hover:text-white active:scale-90 cursor-pointer'
              }`}
              aria-label="Next position"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}
        </div>
      )}

      {/* 2. ZOOM DIAL & CAPTURE SETTINGS ROW */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap justify-center px-4">
        {/* Compact Zoom Selector (Standard iOS style) */}
        <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur-2xl border border-white/15 p-0.5 rounded-full shadow-lg">
          {[1.0, 1.5, 2.0, 3.0].map((z) => (
            <button
              key={z}
              id={`zoom-btn-${z.toString().replace('.', '_')}x`}
              onClick={() => onSetZoom(z)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition-all duration-150 active:scale-95 ${
                Math.abs(zoomLevel - z) < 0.1
                  ? 'bg-white text-slate-950 font-black shadow-md scale-105'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {z}x
            </button>
          ))}
        </div>

        {/* Capture Mode Pill */}
        {onCycleCaptureMode && (
          <button
            id="quick-cycle-mode-btn"
            onClick={onCycleCaptureMode}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border backdrop-blur-xl transition-all shadow-md active:scale-95 ${
              captureMode === 'fast'
                ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                : captureMode === 'clinical'
                ? 'bg-purple-500/25 border-purple-400 text-purple-300'
                : 'bg-cyan-500/25 border-cyan-400 text-cyan-300'
            }`}
            title="Tap to cycle Capture Mode (Fast / Balanced / Clinical)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span className="uppercase">{captureMode}</span>
          </button>
        )}

        {/* Auto Capture AI Toggle */}
        {onToggleAutoCapture && (
          <button
            id="quick-toggle-auto-capture-btn"
            onClick={onToggleAutoCapture}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border backdrop-blur-xl transition-all shadow-md active:scale-95 ${
              autoCaptureEnabled
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                : 'bg-black/60 border-white/15 text-slate-400 hover:text-white'
            }`}
            title="Toggle Auto Capture"
          >
            <Sparkles className={`w-3 h-3 ${autoCaptureEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span>AUTO</span>
          </button>
        )}
      </div>

      {/* 3. DEDICATED FORCE CAPTURE PILL (Spaced safely above the shutter, never overlapping) */}
      {!isReady && onForceCapture && (
        <button
          id="force-capture-pill-btn"
          onClick={onForceCapture}
          className="mb-2 px-3 py-1 rounded-full bg-amber-500/90 hover:bg-amber-400 active:scale-95 text-slate-950 font-mono text-[10px] font-extrabold uppercase tracking-wider shadow-lg shadow-amber-500/30 border border-amber-300 flex items-center gap-1 transition-all cursor-pointer"
          title="Manual override: take photo immediately without waiting for alignment"
        >
          <Zap className="w-3 h-3 fill-current" />
          <span>FORCE CAPTURE</span>
        </button>
      )}

      {/* 4. MAIN SHUTTER DECK (Standard Mobile Camera: Gallery | Shutter | Flip) */}
      <div className="w-full max-w-xs px-4 flex items-center justify-between">
        {/* Left: Gallery Thumbnail */}
        <button
          type="button"
          id="gallery-thumbnail-btn"
          onClick={onOpenGallery}
          className="relative w-13 h-13 rounded-full bg-black/60 border-2 border-white/40 backdrop-blur-xl text-white overflow-hidden flex items-center justify-center shadow-lg active:scale-90 hover:border-white transition-all cursor-pointer"
          title="Open Device Gallery"
          aria-label="Open gallery"
        >
          {latestPhotoThumbnail ? (
            <img
              src={latestPhotoThumbnail}
              alt="Latest Photo"
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-white/70 pointer-events-none" />
          )}

          {capturedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-mono font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-md pointer-events-none">
              {capturedCount}
            </span>
          )}
        </button>

        {/* Center: Mobile Shutter Button */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing ring when aligned */}
          {isReady && (
            <div className="absolute -inset-2.5 rounded-full border-2 border-emerald-400 animate-ping pointer-events-none" />
          )}

          <button
            id="shutter-capture-btn"
            onClick={onCapture}
            className={`relative w-18 h-18 rounded-full border-4 p-1 flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
              isReady
                ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.7)]'
                : 'border-white bg-white/10 shadow-[0_0_20px_rgba(0,0,0,0.6)] hover:scale-102'
            }`}
            aria-label="Take photo"
            title="Press shutter to capture immediately"
          >
            {/* White inner core disc */}
            <div
              className={`w-full h-full rounded-full transition-all duration-150 ${
                isReady
                  ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]'
                  : 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]'
              }`}
            />

            {/* Countdown overlay if countdown active */}
            {autoCaptureCountdown !== null && autoCaptureCountdown > 0 && (
              <span className="absolute font-mono font-black text-xl text-slate-950 pointer-events-none">
                {autoCaptureCountdown}
              </span>
            )}
          </button>
        </div>

        {/* Right: Camera Flip Button */}
        <button
          onClick={onSwitchCamera}
          className="w-13 h-13 rounded-full bg-black/60 border-2 border-white/40 backdrop-blur-xl text-white active:scale-90 hover:border-white transition-all flex items-center justify-center shadow-lg cursor-pointer"
          aria-label="Switch camera"
          title="Switch front / rear camera"
        >
          <RefreshCw className="w-6 h-6 text-white/80" />
        </button>
      </div>
    </div>
  );
};

export const CameraControls = React.memo(CameraControlsComponent);
