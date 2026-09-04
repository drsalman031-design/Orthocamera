import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  User,
  Check,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { ClinicalCase, LiveGuidanceState, OrthodonticViewDefinition } from '../types';
import { ORTHODONTIC_VIEWS } from './workflowData';

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
  onDeleteCurrentPhoto?: () => void;
  onSelectViewIndex?: (index: number) => void;
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
  onDeleteCurrentPhoto,
  onSelectViewIndex,
}) => {
  const isReady = guidance.isReady;
  const isCurrentCaptured = Boolean(activeCase.photos[currentView.id]);

  return (
    <header className="absolute top-0 left-0 right-0 z-30 pt-safe flex flex-col pointer-events-auto select-none bg-gradient-to-b from-black/90 via-black/70 to-transparent pb-3">
      {/* 1. TOP BAR: Patient Profile Capsule + Step Counter */}
      <div className="px-3.5 pt-2 flex items-center justify-between gap-2">
        {/* Patient Capsule */}
        <button
          onClick={onOpenPatientModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl shadow-lg active:scale-95 hover:border-cyan-500/60 transition-all text-left cursor-pointer"
          aria-label="Patient details"
        >
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
          <User className="w-3.5 h-3.5 text-cyan-400" />
          <div className="flex flex-col">
            <span className="font-sans font-bold text-xs text-white leading-none truncate max-w-[140px]">
              {activeCase.patientName || 'Jane Doe'}
            </span>
            <span className="font-mono text-[9px] text-cyan-300/80 leading-tight uppercase font-semibold">
              {activeCase.caseType || 'INITIAL'}
            </span>
          </div>
        </button>

        {/* Step Counter Button */}
        <button
          onClick={onOpenStepDrawer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl shadow-lg active:scale-95 hover:border-emerald-500/60 transition-all font-mono cursor-pointer"
          title="View 11-Step Workflow"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300">
            {currentIndex + 1}
          </span>
          <span className="text-[10px] text-slate-500">/</span>
          <span className="text-[10px] font-semibold text-slate-400">{totalViews}</span>
        </button>
      </div>

      {/* 2. HERO VIEW NAVIGATION: Chevrons + Title Card */}
      <div className="px-3 pt-2.5 flex items-center justify-between gap-2">
        {/* Prev Arrow */}
        <button
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl transition-all shrink-0 ${
            currentIndex === 0
              ? 'text-slate-700 bg-slate-950/40 border border-transparent cursor-not-allowed opacity-30'
              : 'text-white bg-slate-900/90 border border-slate-700/80 active:scale-90 hover:bg-slate-800 shadow-md shadow-black/50 cursor-pointer'
          }`}
          aria-label="Previous view"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Center: Compact Hero View Card */}
        <div
          onClick={onOpenStepDrawer}
          className="flex-1 px-3 py-1.5 rounded-2xl bg-slate-950/85 border border-slate-800/90 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center cursor-pointer active:scale-[0.99] transition-all"
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
                    className="ml-0.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete photo"
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
        </div>

        {/* Next Arrow */}
        <button
          onClick={onNext}
          disabled={currentIndex === totalViews - 1}
          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl transition-all shrink-0 ${
            currentIndex === totalViews - 1
              ? 'text-slate-700 bg-slate-950/40 border border-transparent cursor-not-allowed opacity-30'
              : 'text-white bg-slate-900/90 border border-slate-700/80 active:scale-90 hover:bg-slate-800 shadow-md shadow-black/50 cursor-pointer'
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
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
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

      {/* 4. UNIFIED DYNAMIC GUIDANCE STATUS BAR (NO OVERLAPPING) */}
      <div className="mt-2 flex items-center justify-center px-4">
        {isReady ? (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/95 border border-emerald-400 text-emerald-200 text-xs font-bold tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.5)] backdrop-blur-xl animate-in zoom-in-95 duration-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            <span className="font-mono text-emerald-300">100% ALIGNED</span>
            <span className="text-emerald-500">•</span>
            <span>CAPTURE READY — HOLD STILL</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/85 border border-white/15 backdrop-blur-xl shadow-lg text-[10px] font-mono">
              {/* Continuous Score Pill */}
              <span className="flex items-center gap-1 font-bold text-cyan-300">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    guidance.readyScore >= 70
                      ? 'bg-emerald-400'
                      : guidance.readyScore >= 40
                      ? 'bg-amber-400'
                      : 'bg-slate-500'
                  }`}
                />
                {guidance.readyScore}% ALIGNED
              </span>

              <span className="text-slate-600 text-[8px] font-bold">•</span>

              {/* Position */}
              <span
                className={`flex items-center gap-0.5 font-bold ${
                  guidance.positionValid ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {guidance.positionValid ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                )}
                CENTER
              </span>

              <span className="text-slate-600 text-[8px] font-bold">•</span>

              {/* Angle */}
              <span
                className={`flex items-center gap-0.5 font-bold ${
                  guidance.angleValid ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {guidance.angleValid ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                )}
                ANGLE
              </span>

              <span className="text-slate-600 text-[8px] font-bold">•</span>

              {/* Distance */}
              <span
                className={`flex items-center gap-0.5 font-bold ${
                  guidance.distanceValid ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {guidance.distanceValid ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                )}
                DISTANCE
              </span>

              <span className="text-slate-600 text-[8px] font-bold">•</span>

              {/* Stability */}
              <span
                className={`flex items-center gap-0.5 font-bold ${
                  guidance.isStable ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {guidance.isStable ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                )}
                STABLE
              </span>
            </div>

            {/* Single Highest-Priority Guidance Message */}
            {guidance.primaryMessage && (
              <div className="px-3 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-[11px] font-sans font-semibold text-cyan-300 shadow-md">
                {guidance.primaryMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export const WorkflowHeader = React.memo(WorkflowHeaderComponent);
