import React, { useState, useEffect } from 'react';
import { X, Sliders, Shield, BookOpen, Check, Volume2, RefreshCw, Zap, Sparkles } from 'lucide-react';
import { AppSettings } from '../types';
import { MediaPipeVision, MediaPipeStatus } from '../ai_positioning/MediaPipeVisionEngine';
import { CAPTURE_MODE_CONFIGS, CaptureMode } from '../ai_positioning/CaptureConfig';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onOpenAndroidDocs: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenAndroidDocs,
}) => {
  const [aiStatus, setAiStatus] = useState<MediaPipeStatus>(MediaPipeVision.getStatus());
  const [isReloadingAi, setIsReloadingAi] = useState(false);

  useEffect(() => {
    return MediaPipeVision.subscribeStatus(setAiStatus);
  }, []);

  const handleReloadAi = async () => {
    setIsReloadingAi(true);
    try {
      await MediaPipeVision.reload();
    } finally {
      setIsReloadingAi(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-80 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-950/95 border border-slate-700/60 rounded-3xl overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-700/70 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Camera & AI Settings</h2>
              <p className="text-[11px] font-mono text-slate-400">Orthodontic Clinical Config</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-900 border border-slate-700/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* 1. Capture Mode Profile (P0 Requirement) */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100 text-sm block">Auto-Capture Mode</span>
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  Target: {settings.captureMode || 'balanced'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                Controls alignment difficulty and time-to-capture. Fast mode solves long wait times.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {(['fast', 'balanced', 'clinical'] as CaptureMode[]).map((mode) => {
                const conf = CAPTURE_MODE_CONFIGS[mode];
                const isSelected = (settings.captureMode || 'balanced') === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        captureMode: mode,
                        stabilityConfirmationMs: conf.stabilityConfirmationMs,
                      });
                    }}
                    className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                      isSelected
                        ? mode === 'fast'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                          : mode === 'clinical'
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                          : 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                        : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-mono text-xs font-bold uppercase">{mode}</span>
                    <span className="text-[9px] text-slate-400 mt-0.5 font-mono">
                      Score &ge;{conf.enterReadyScore}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] font-mono text-slate-400 bg-black/40 p-2 rounded-xl border border-white/5">
              {CAPTURE_MODE_CONFIGS[settings.captureMode || 'balanced'].description}
            </p>
          </div>

          {/* 2. Auto Capture & Stability Settings */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-100 text-sm block">Auto-Capture Trigger</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Automatically fires shutter when face satisfies alignment score and stability window.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={settings.autoCaptureEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, autoCaptureEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
              </label>
            </div>

            {settings.autoCaptureEnabled && (
              <>
                {/* Single Shot vs Burst Mode */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-slate-200 font-medium text-xs block">Shutter Mode</span>
                    <span className="text-slate-400 text-[10px]">Single shot for low latency & thermal efficiency</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        onUpdateSettings({ ...settings, burstModeEnabled: false })
                      }
                      className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                        !settings.burstModeEnabled
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Single
                    </button>
                    <button
                      onClick={() =>
                        onUpdateSettings({ ...settings, burstModeEnabled: true, burstCount: 3 })
                      }
                      className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                        settings.burstModeEnabled
                          ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      3-Burst
                    </button>
                  </div>
                </div>

                {/* Extended Stability Confirmation Duration */}
                <div className="pt-2.5 border-t border-slate-800/60 flex items-center justify-between">
                  <div>
                    <span className="text-slate-200 font-medium text-xs block">Stability Window</span>
                    <span className="text-slate-400 text-[10px]">Continuous hold-still duration</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[100, 150, 180, 220, 300].map((ms) => (
                      <button
                        key={ms}
                        onClick={() =>
                          onUpdateSettings({ ...settings, stabilityConfirmationMs: ms })
                        }
                        className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                          (settings.stabilityConfirmationMs || 180) === ms
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                            : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ms}ms
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. Spoken Voice Guidance (P1 Requirement) */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-100 text-sm block">Voice Guidance</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Spoken directional cues (&quot;Move closer&quot;, &quot;Turn right&quot;, &quot;Hold still&quot;) so you can focus on the patient.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={!!settings.voiceGuidanceEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, voiceGuidanceEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
              </label>
            </div>
          </div>

          {/* 4. AI Vision Engine Status & Reload */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-100 text-sm block">AI Vision Engine Status</span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                  aiStatus.isReady
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    : aiStatus.isLoading
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                }`}
              >
                {aiStatus.isReady ? `Active (${aiStatus.delegate})` : aiStatus.isLoading ? 'Loading...' : 'Fallback'}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {aiStatus.progressMessage || (aiStatus.isReady ? 'MediaPipe FaceLandmarker running on GPU' : 'Model not ready')}
            </p>
            <button
              onClick={handleReloadAi}
              disabled={isReloadingAi}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-mono text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReloadingAi ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isReloadingAi ? 'Reloading Vision Model...' : 'Reload Vision Models'}</span>
            </button>
          </div>

          {/* Hands-Free Auto Advance */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-100 text-sm block">Hands-Free Auto-Advance</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Upon auto-capture, saves immediately in background, flashes green confirmation for 800ms, and automatically advances to next view without touching the screen.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={settings.handsFreeAutoAdvance}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, handsFreeAutoAdvance: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
              </label>
            </div>
          </div>

          {/* Real-time Diagnostics HUD Toggle */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-100 text-sm block">Clinical Telemetry & Diagnostics</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Display real-time Camera FPS, AI inference latency, motion stability score, and 3D pose angles.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={settings.diagnosticsOverlay}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, diagnosticsOverlay: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
              </label>
            </div>
          </div>

          {/* 2. Guidance Sensitivity */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-2.5 shadow-md">
            <span className="font-bold text-slate-100 block text-sm">Guidance Tolerance Sensitivity</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Controls how strictly face tilt, yaw angle, and dental arch centering must match the clinical template.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(['relaxed', 'medium', 'high'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdateSettings({ ...settings, guidanceSensitivity: s })}
                  className={`py-2 px-3 rounded-xl border font-mono uppercase text-center font-bold text-[11px] transition-all ${
                    settings.guidanceSensitivity === s
                      ? 'bg-gradient-to-r from-cyan-950/80 to-slate-900 border-cyan-500/80 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Clinical Measurement Grid & Reference Labels */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-100 block text-sm">Clinical Measurement Grid</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Overlays fine metric lines for facial vertical thirds and symmetry assessment.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={settings.showClinicalGrid}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, showClinicalGrid: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-100 block text-sm">Anatomical Landmark Labels</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Show micro-labels (FH Plane, E-Line, Canine, Raphe, Class I Molar key) with dark pills.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={settings.showReferenceLabels}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, showReferenceLabels: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
              </label>
            </div>
          </div>

          {/* 4. Overlay Styling */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-100 text-sm">Overlay Opacity</span>
              <span className="font-mono text-cyan-400 font-bold">{Math.round(settings.overlayOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={settings.overlayOpacity}
              onChange={(e) =>
                onUpdateSettings({ ...settings, overlayOpacity: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-300 font-medium">Overlay Color Theme</span>
              <div className="flex items-center gap-2">
                {(['cyan', 'emerald', 'amber', 'white'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => onUpdateSettings({ ...settings, overlayColor: c })}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                      c === 'cyan'
                        ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                        : c === 'emerald'
                        ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                        : c === 'amber'
                        ? 'bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                        : 'bg-slate-200 border-white shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                    }`}
                  >
                    {settings.overlayColor === c && (
                      <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Auto-Save to Phone Gallery / Device Storage */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-100 text-sm block">Auto-Save to Phone Gallery</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Automatically save every accepted orthodontic photo to device storage with patient ID and view codes.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={settings.autoSaveToGallery}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, autoSaveToGallery: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
              </label>
            </div>
          </div>

          {/* 6. Manual Capture Positioning Gate Override */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-100 text-sm block">Bypass Alignment Gate on Manual Shutter</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  When disabled (recommended), manual capture enforces clinical alignment validation before capturing.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={!!settings.allowManualCaptureOverride}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, allowManualCaptureOverride: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
              </label>
            </div>
          </div>

          {/* 6. Developer & Android Architecture Specs */}
          <button
            onClick={() => {
              onClose();
              onOpenAndroidDocs();
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/80 text-slate-200 font-semibold flex items-center justify-between transition-all shadow-md group"
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Android CameraX & AI Architecture Specs</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400">View Guide →</span>
          </button>

          {/* 6. Medical / Clinical Disclaimer */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-slate-300">Clinical Standardization Assistant:</strong> This
              application guides standardized photographic records for orthodontic documentation. It
              does not provide automated diagnostic conclusions or medical treatment planning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
