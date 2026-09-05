import React from 'react';
import {
  User,
  Check,
  Layers,
  Zap,
  ZapOff,
  Volume2,
  VolumeX,
  Sliders,
  Trash2,
} from 'lucide-react';
import { ClinicalCase, LiveGuidanceState, OrthodonticViewDefinition } from '../types';

interface WorkflowHeaderProps {
  currentView: OrthodonticViewDefinition;
  currentIndex: number;
  totalViews: number;
  activeCase: ClinicalCase;
  guidance: LiveGuidanceState;
  onOpenStepDrawer: () => void;
  onOpenPatientModal: () => void;
  onDeleteCurrentPhoto?: () => void;
  flashMode?: 'off' | 'on' | 'auto' | 'torch';
  onCycleFlash?: () => void;
  voiceGuidanceEnabled?: boolean;
  onToggleVoiceGuidance?: () => void;
  onOpenSettings?: () => void;
  // Retained for backward compatibility
  onPrevious?: () => void;
  onNext?: () => void;
  onSelectViewIndex?: (index: number) => void;
}

const WorkflowHeaderComponent: React.FC<WorkflowHeaderProps> = ({
  currentView,
  currentIndex,
  totalViews,
  activeCase,
  onOpenStepDrawer,
  onOpenPatientModal,
  onDeleteCurrentPhoto,
  flashMode = 'off',
  onCycleFlash,
  voiceGuidanceEnabled = false,
  onToggleVoiceGuidance,
  onOpenSettings,
}) => {
  const isCurrentCaptured = Boolean(activeCase.photos[currentView.id]);

  return (
    <header className="absolute top-0 left-0 right-0 z-50 pt-safe flex items-center justify-between px-3.5 py-2 pointer-events-auto select-none bg-gradient-to-b from-black/85 via-black/40 to-transparent">
      {/* 1. Left: Flash toggle + Patient Chip */}
      <div className="flex items-center gap-1.5">
        {onCycleFlash && (
          <button
            id="top-flash-btn"
            onClick={onCycleFlash}
            className="w-9 h-9 rounded-full bg-black/60 border border-white/15 backdrop-blur-xl flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer hover:bg-white/10"
            title={`Flash: ${flashMode.toUpperCase()} (tap to cycle)`}
            aria-label="Toggle flash mode"
          >
            {flashMode === 'off' ? (
              <ZapOff className="w-4 h-4 text-slate-400" />
            ) : (
              <Zap
                className={`w-4 h-4 ${
                  flashMode === 'torch'
                    ? 'text-amber-300 fill-amber-300'
                    : 'text-yellow-400 fill-yellow-400'
                }`}
              />
            )}
          </button>
        )}

        {/* Patient / Case Capsule */}
        <button
          onClick={onOpenPatientModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-xl shadow-md active:scale-95 hover:border-cyan-500/50 transition-all text-left cursor-pointer max-w-[130px]"
          title="Patient & Case Info"
        >
          <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-sans font-bold text-xs text-white truncate">
            {activeCase.patientName || activeCase.patientId || 'Patient'}
          </span>
        </button>
      </div>

      {/* 2. Center: Step Progress Pill (1 / 11) with Saved status */}
      <button
        onClick={onOpenStepDrawer}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-xl shadow-md active:scale-95 transition-all font-mono text-xs cursor-pointer ${
          isCurrentCaptured
            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
            : 'bg-black/60 border-white/15 text-white hover:border-white/30'
        }`}
        title="Open 11-View Workflow Drawer"
      >
        <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="font-bold">{currentIndex + 1}</span>
        <span className="text-slate-500 text-[10px]">/</span>
        <span className="text-slate-400 text-[10px]">{totalViews}</span>

        {isCurrentCaptured && (
          <span className="flex items-center gap-0.5 ml-1 text-[9px] font-bold text-emerald-400 uppercase tracking-tight">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
            SAVED
          </span>
        )}
      </button>

      {/* 3. Right: Delete Photo (if saved) + Voice toggle + Settings */}
      <div className="flex items-center gap-1.5">
        {isCurrentCaptured && onDeleteCurrentPhoto && (
          <button
            onClick={onDeleteCurrentPhoto}
            className="w-9 h-9 rounded-full bg-black/60 border border-white/15 backdrop-blur-xl flex items-center justify-center text-slate-400 hover:text-rose-400 active:scale-95 transition-all cursor-pointer"
            title="Retake / delete this photo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {onToggleVoiceGuidance && (
          <button
            id="top-voice-btn"
            onClick={onToggleVoiceGuidance}
            className={`w-9 h-9 rounded-full border backdrop-blur-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              voiceGuidanceEnabled
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-black/60 border-white/15 text-slate-400 hover:text-white'
            }`}
            title={voiceGuidanceEnabled ? 'Voice Guidance Active' : 'Voice Guidance Muted'}
            aria-label="Toggle voice guidance"
          >
            {voiceGuidanceEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
        )}

        {onOpenSettings && (
          <button
            id="top-settings-btn"
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-full bg-black/60 border border-white/15 backdrop-blur-xl flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all cursor-pointer hover:bg-white/10"
            title="Settings & Tools"
            aria-label="Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};

export const WorkflowHeader = React.memo(WorkflowHeaderComponent);
