import React from 'react';
import { LiveGuidanceState, OrthodonticViewDefinition } from '../types';
import { MediaPipeModelStatus } from '../ai_positioning/MediaPipeVisionEngine';
import { CheckCircle2 } from 'lucide-react';

interface LiveGuidanceHUDProps {
  guidance: LiveGuidanceState;
  currentView?: OrthodonticViewDefinition;
  captureMode?: 'fast' | 'balanced' | 'clinical';
  onForceCapture?: () => void;
  aiModelStatus?: MediaPipeModelStatus;
}

const LiveGuidanceHUDComponent: React.FC<LiveGuidanceHUDProps> = ({
  guidance,
  currentView,
  captureMode = 'balanced',
  aiModelStatus,
}) => {
  // 1. If AI model is currently loading, show single loading pill
  if (aiModelStatus?.isLoading) {
    return (
      <div className="absolute top-14 left-0 right-0 z-40 flex justify-center pointer-events-none px-4 select-none animate-in fade-in duration-200">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/50 backdrop-blur-2xl shadow-xl">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <span className="text-[11px] font-mono text-cyan-200 font-medium">
            {aiModelStatus.progressMessage || 'Loading AI vision pipeline...'}
          </span>
        </div>
      </div>
    );
  }

  const isReady = guidance.isReady;
  const score = Math.round(guidance.alignmentScore ?? guidance.readyScore ?? 0);

  const scoreBadgeColor =
    score >= 70
      ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40'
      : score >= 50
      ? 'text-amber-400 bg-amber-500/20 border-amber-500/40'
      : 'text-rose-400 bg-rose-500/20 border-rose-500/40';

  const message =
    guidance.rejectionReason ||
    guidance.highestPriorityCorrection ||
    guidance.primaryMessage ||
    'Align face in guide';

  // 2. Normal Alignment Guidance (Single smart pill floating cleanly below top bar)
  return (
    <div className="absolute top-14 left-0 right-0 z-40 flex justify-center pointer-events-none px-4 select-none animate-in fade-in duration-200">
      {isReady ? (
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/95 text-white text-xs font-bold tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.55)] backdrop-blur-xl animate-pulse">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>HOLD STILL — READY</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/75 border border-white/15 backdrop-blur-2xl shadow-xl max-w-[92%]">
          <span
            className={`font-mono text-xs font-black px-1.5 py-0.5 rounded-md border ${scoreBadgeColor} shrink-0`}
            title={`Score: ${score}/100`}
          >
            {score}
          </span>

          <span className="w-1 h-1 rounded-full bg-white/30 shrink-0" />

          <span className="text-white font-semibold text-xs truncate drop-shadow">
            {message}
          </span>
        </div>
      )}
    </div>
  );
};

export const LiveGuidanceHUD = React.memo(LiveGuidanceHUDComponent);
