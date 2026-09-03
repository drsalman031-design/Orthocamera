import React from 'react';
import {
  ChevronLeft,
  Scan,
  ChevronRight,
  Layers,
  User,
  Eye,
  EyeOff,
  Grid,
  Check,
  AlertCircle,
  Images,
  Trash2,
} from 'lucide-react';
import { ClinicalCase, LiveGuidanceState, OrthodonticViewDefinition } from '../types';
import { ORTHODONTIC_VIEWS } from './workflowData';
import { MediaPipeVision, MediaPipeStatus } from '../ai_positioning/MediaPipeVisionEngine';

interface WorkflowHeaderProps {
  currentView: OrthodonticViewDefinition;
  currentIndex: number;
  totalViews: number;
  activeCase: ClinicalCase;
  guidance: LiveGuidanceState;
  onPrevious: () => void;
  onNext: () => void;
  onOpenStepDrawer: () => void;
  onOpenPatientModal: () => void;
  onOpenGallery?: () => void;
  onDeleteCurrentPhoto?: () => void;
  onSelectViewIndex?: (index: number) => void;
  showReferenceLabels: boolean;
  onToggleReferenceLabels: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showFaceMesh?: boolean;
  onToggleFaceMesh?: () => void;
}

const WorkflowHeaderComponent: React.FC<WorkflowHeaderProps> = ({
  currentView,
  currentIndex,
  totalViews,
  activeCase,
  guidance,
  onPrevious,
  onNext,
  onOpenStepDrawer,
  onOpenPatientModal,
  onOpenGallery,
  onDeleteCurrentPhoto,
  onSelectViewIndex,
  showReferenceLabels,
  onToggleReferenceLabels,
  showGrid,
  onToggleGrid,
  showFaceMesh = true,
  onToggleFaceMesh,
}) => {
  const isReady = guidance.isReady;
  const [mpStatus, setMpStatus] = React.useState<MediaPipeStatus>(() => MediaPipeVision.getStatus());

  React.useEffect(() => {
    return MediaPipeVision.subscribeStatus((st) => setMpStatus(st));
  }, []);
  const capturedPhotosCount = Object.keys(activeCase.photos).length;
  const isCurrentCaptured = Boolean(activeCase.photos[currentView.id]);

  return (
    <header className="absolute top-0 left-0 right-0 z-30 pt-safe flex flex-col pointer-events-auto select-none bg-gradient-to-b from-black via-black/80 to-transparent pb-3">
      {/* 1. TOP BAR: Patient Profile Pill + Controls + Gallery */}
      <div className="px-3.5 pt-1 flex items-center justify-between gap-2">
        {/* Patient Capsule */}
        <button
          onClick={onOpenPatientModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 border border-slate-700/70 backdrop-blur-xl shadow-lg active:scale-95 hover:border-cyan-500/60 transition-all text-left"
          aria-label="Patient details"
        >
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
          <User className="w-3.5 h-3.5 text-cyan-400" />
          <div className="flex flex-col">
            <span className="font-sans font-bold text-xs text-white leading-none truncate max-w-[110px]">
              {activeCase.patientName || 'Jane Doe'}
            </span>
            <span className="font-mono text-[9px] text-cyan-300/80 leading-tight uppercase font-semibold">
              {activeCase.caseType || 'INITIAL'}
            </span>
          </div>
        </button>

        {/* Center: Real-Time MediaPipe ML Engine Status Indicator */}
        <div className="flex items-center">
          {mpStatus.isReady ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 backdrop-blur-xl shadow-[0_0_12px_rgba(16,185,129,0.3)] text-[10px] font-mono text-emerald-300 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              <span>MEDIAPIPE 3D</span>
            </div>
          ) : mpStatus.isLoading ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/50 backdrop-blur-xl shadow-[0_0_12px_rgba(6,182,212,0.3)] text-[10px] font-mono text-cyan-300 font-bold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>MEDIAPIPE LOADING...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-[10px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span>CHROMA AI</span>
            </div>
          )}
        </div>

        {/* Right Tools Group: Grid, Labels, Step Count, Gallery */}
        <div className="flex items-center gap-1.5">
                    {/* Live 3D Mesh Toggle */}
          {onToggleFaceMesh && (
            <button
              onClick={onToggleFaceMesh}
              className={`p-1.5 rounded-full backdrop-blur-xl border transition-all active:scale-95 ${
                showFaceMesh
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                  : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-white'
              }`}
              title="Toggle Live MediaPipe 3D Mesh"
            >
              <Scan className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Grid Toggle */}
          <button
            onClick={onToggleGrid}
            className={`p-1.5 rounded-full backdrop-blur-xl border transition-all active:scale-95 ${
              showGrid
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-white'
            }`}
            title="Toggle Clinical Grid"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Reference Labels Toggle */}
          <button
            onClick={onToggleReferenceLabels}
            className={`p-1.5 rounded-full backdrop-blur-xl border transition-all active:scale-95 ${
              showReferenceLabels
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-white'
            }`}
            title="Toggle Reference Labels"
          >
            {showReferenceLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Step Drawer Counter */}
          <button
            onClick={onOpenStepDrawer}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-900/85 border border-slate-700/70 backdrop-blur-xl shadow-lg active:scale-95 hover:border-emerald-500/60 transition-all font-mono"
            title="View 11-Step Workflow"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300">
              {currentIndex + 1}
            </span>
            <span className="text-[10px] text-slate-500">/</span>
            <span className="text-[10px] font-semibold text-slate-400">{totalViews}</span>
          </button>

          {/* Gallery Button */}
          {onOpenGallery && (
            <button
              onClick={onOpenGallery}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-900/85 border border-slate-700/70 backdrop-blur-xl shadow-lg active:scale-95 hover:border-cyan-500/60 transition-all text-slate-200 font-mono"
              title="Open In-App Gallery"
            >
              <Images className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold text-cyan-300">{capturedPhotosCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. HERO VIEW NAVIGATION: Chevrons + Title + Readiness Badge */}
      <div className="px-3 pt-2 flex items-center justify-between gap-2">
        {/* Prev Arrow */}
        <button
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl transition-all shrink-0 ${
            currentIndex === 0
              ? 'text-slate-700 bg-slate-950/40 border border-transparent cursor-not-allowed opacity-30'
              : 'text-white bg-slate-900/90 border border-slate-700/80 active:scale-90 hover:bg-slate-800 shadow-md shadow-black/50'
          }`}
          aria-label="Previous view"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Center: Hero View Card */}
        <div
          onClick={onOpenStepDrawer}
          className="flex-1 px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center cursor-pointer active:scale-[0.99] transition-all group"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`text-[8px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full font-extrabold ${
                currentView.category === 'extraoral'
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-400/40'
                  : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
              }`}
            >
              {currentView.shortCode} • {currentView.category.toUpperCase()}
            </span>

            {/* Photo Saved Badge */}
            {isCurrentCaptured && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/60 text-[9px] font-mono text-emerald-300 font-bold"
              >
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                <span>SAVED</span>
                {onDeleteCurrentPhoto && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCurrentPhoto();
                    }}
                    className="ml-0.5 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white uppercase text-center font-sans">
            {currentView.name}
          </h1>

          {/* Readiness Pill */}
          <div className="mt-1 flex items-center gap-1.5">
            <div
              className={`px-3 py-0.5 rounded-full border text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all duration-300 ${
                isReady
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.7)] scale-105'
                  : 'bg-slate-900/90 border-slate-700/80 text-slate-300'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isReady
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                    : 'bg-cyan-400 animate-ping'
                }`}
              />
              <span className="tracking-wide">{isReady ? 'READY TO CAPTURE' : 'ALIGNING PATIENT'}</span>
            </div>
          </div>
        </div>

        {/* Next Arrow */}
        <button
          onClick={onNext}
          disabled={currentIndex === totalViews - 1}
          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl transition-all shrink-0 ${
            currentIndex === totalViews - 1
              ? 'text-slate-700 bg-slate-950/40 border border-transparent cursor-not-allowed opacity-30'
              : 'text-white bg-slate-900/90 border border-slate-700/80 active:scale-90 hover:bg-slate-800 shadow-md shadow-black/50'
          }`}
          aria-label="Next view"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* 3. INTERACTIVE 11-VIEW MINI STEP RAIL */}
      <div className="px-4 pt-2 flex items-center justify-center gap-1.5">
        {ORTHODONTIC_VIEWS.map((v, idx) => {
          const isCurrent = idx === currentIndex;
          const isCaptured = Boolean(activeCase.photos[v.id]);

          return (
            <button
              key={v.id}
              onClick={() => onSelectViewIndex && onSelectViewIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isCurrent
                  ? 'w-6 bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                  : isCaptured
                  ? 'w-2 bg-emerald-400 shadow-[0_0_6px_#34d399]'
                  : 'w-1.5 bg-slate-700/80 hover:bg-slate-500'
              }`}
              title={`${idx + 1}. ${v.name}`}
            />
          );
        })}
      </div>

      {/* 4. ALIGNMENT MICRO-HUD CHECKLIST */}
      <div className="mt-1.5 flex items-center justify-center px-4">
        <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-black/75 border border-white/10 backdrop-blur-xl shadow-lg text-[10px] font-mono">
          {/* Position */}
          <span
            className={`flex items-center gap-1 font-bold ${
              guidance.positionValid ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {guidance.positionValid ? (
              <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
            ) : (
              <AlertCircle className="w-3 h-3 text-amber-400" />
            )}
            POS
          </span>

          <span className="text-slate-600 text-[8px] font-bold">•</span>

          {/* Angle */}
          <span
            className={`flex items-center gap-1 font-bold ${
              guidance.angleValid ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {guidance.angleValid ? (
              <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
            ) : (
              <AlertCircle className="w-3 h-3 text-amber-400" />
            )}
            ANG
          </span>

          <span className="text-slate-600 text-[8px] font-bold">•</span>

          {/* Distance */}
          <span
            className={`flex items-center gap-1 font-bold ${
              guidance.distanceValid ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {guidance.distanceValid ? (
              <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
            ) : (
              <AlertCircle className="w-3 h-3 text-amber-400" />
            )}
            DIST
          </span>

          {!isReady && guidance.primaryMessage && (
            <>
              <span className="text-slate-600 text-[8px] font-bold">•</span>
              <span className="text-cyan-300 font-medium truncate max-w-[150px]">
                {guidance.primaryMessage}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export const WorkflowHeader = React.memo(WorkflowHeaderComponent);
