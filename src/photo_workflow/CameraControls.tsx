import React from 'react';
import { Zap, ZapOff, RefreshCw, Sliders, Image as ImageIcon, Sparkles } from 'lucide-react';
import { LiveGuidanceState } from '../types';

interface CameraControlsProps {
  guidance: LiveGuidanceState;
  onCapture: () => void;
  flashMode: 'off' | 'on' | 'auto' | 'torch';
  onCycleFlash: () => void;
  onSwitchCamera: () => void;
  onOpenReview?: () => void;
  onOpenSettings: () => void;
  zoomLevel: number;
  onSetZoom: (zoom: number) => void;
  autoCaptureCountdown: number | null;
  capturedCount: number;
  latestPhotoThumbnail?: string;
  autoCaptureEnabled?: boolean;
  onToggleAutoCapture?: () => void;
}

const CameraControlsComponent: React.FC<CameraControlsProps> = ({
  guidance,
  onCapture,
  flashMode,
  onCycleFlash,
  onSwitchCamera,
  onOpenReview,
  onOpenSettings,
  zoomLevel,
  onSetZoom,
  autoCaptureCountdown,
  capturedCount,
  latestPhotoThumbnail,
  autoCaptureEnabled = true,
  onToggleAutoCapture,
}) => {
  const isReady = guidance.isReady;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-60 pb-safe pb-4 pt-3 flex flex-col items-center pointer-events-auto bg-gradient-to-t from-black via-black/85 to-transparent select-none">
      {/* 1. Zoom Segmented Bar & Auto-Capture Toggle */}
      <div className="flex items-center gap-2 mb-3">
        {/* Zoom Selector */}
        <div className="flex items-center gap-1 bg-black/80 backdrop-blur-2xl border border-white/15 p-1 rounded-full shadow-2xl">
          {[1.0, 1.5, 2.0, 3.0].map((z) => (
            <button
              key={z}
              id={`zoom-btn-${z.toString().replace('.', '_')}x`}
              onClick={() => onSetZoom(z)}
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all duration-200 active:scale-95 ${
                Math.abs(zoomLevel - z) < 0.1
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.6)] scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {z}x
            </button>
          ))}
        </div>

        {/* Auto Capture AI Toggle */}
        {onToggleAutoCapture && (
          <button
            id="quick-toggle-auto-capture-btn"
            onClick={onToggleAutoCapture}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold border backdrop-blur-2xl transition-all shadow-xl active:scale-95 ${
              autoCaptureEnabled
                ? 'bg-emerald-500/25 border-emerald-400/90 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                : 'bg-black/80 border-white/15 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Auto Photo Capture when aligned"
          >
            <Sparkles className={`w-3.5 h-3.5 ${autoCaptureEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span>AUTO {autoCaptureEnabled ? 'ON' : 'OFF'}</span>
          </button>
        )}
      </div>

      {/* 2. Main Shutter Deck */}
      <div className="w-full max-w-sm px-6 flex items-center justify-between">
        {/* Flash Toggle */}
        <button
          onClick={onCycleFlash}
          className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-2xl text-slate-200 active:scale-90 hover:border-slate-500 transition-all flex flex-col items-center justify-center shadow-lg shadow-black/50"
          aria-label="Flash mode"
        >
          {flashMode === 'off' ? (
            <ZapOff className="w-5 h-5 text-slate-400" />
          ) : (
            <Zap className={`w-5 h-5 ${flashMode === 'torch' ? 'text-amber-300 fill-amber-300' : 'text-yellow-400'}`} />
          )}
          <span className="text-[8px] font-mono uppercase mt-0.5 text-slate-400 font-bold">
            {flashMode}
          </span>
        </button>

        {/* Recent Capture Thumbnail Display */}
        <div
          className="relative w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-2xl text-slate-200 overflow-hidden flex items-center justify-center shadow-lg shadow-black/50"
          title={`${capturedCount} photos captured directly to phone gallery`}
        >
          {latestPhotoThumbnail ? (
            <img
              src={latestPhotoThumbnail}
              alt="Latest"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-5 h-5 text-slate-300" />
          )}
          {capturedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-mono font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.6)]">
              {capturedCount}
            </span>
          )}
        </div>

        {/* Shutter Button Container */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing halo wave when ready */}
          {isReady && (
            <div className="absolute -inset-3 rounded-full border-2 border-emerald-400/80 animate-ping pointer-events-none" />
          )}

          {/* Shutter Button */}
          <button
            id="shutter-capture-btn"
            onClick={onCapture}
            className={`relative w-20 h-20 rounded-full border-4 p-1.5 flex items-center justify-center transition-all duration-300 active:scale-90 ${
              isReady
                ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_35px_rgba(16,185,129,0.65)]'
                : 'border-white/80 bg-white/10 shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:border-white'
            }`}
            aria-label="Capture photo"
          >
            {/* Inner Shutter Core */}
            <div
              className={`w-full h-full rounded-full transition-all duration-200 ${
                isReady
                  ? 'bg-gradient-to-tr from-emerald-400 to-emerald-300 shadow-[0_0_16px_#34d399]'
                  : 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]'
              }`}
            />

            {/* Countdown Overlay */}
            {autoCaptureCountdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/85 backdrop-blur-sm">
                <span className="font-mono font-extrabold text-2xl text-emerald-300 animate-ping">
                  {autoCaptureCountdown}
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Flip Front/Rear Camera */}
        <button
          onClick={onSwitchCamera}
          className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-2xl text-slate-200 active:scale-90 hover:border-slate-500 transition-all flex flex-col items-center justify-center shadow-lg shadow-black/50"
          aria-label="Switch camera"
        >
          <RefreshCw className="w-5 h-5 text-slate-300" />
          <span className="text-[8px] font-mono uppercase mt-0.5 text-slate-400 font-bold">Flip</span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-2xl text-slate-200 active:scale-90 hover:border-slate-500 transition-all flex flex-col items-center justify-center shadow-lg shadow-black/50"
          aria-label="Settings"
        >
          <Sliders className="w-5 h-5 text-slate-300" />
          <span className="text-[8px] font-mono uppercase mt-0.5 text-slate-400 font-bold">Tools</span>
        </button>
      </div>
    </div>
  );
};

export const CameraControls = React.memo(CameraControlsComponent);
