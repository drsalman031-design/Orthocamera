import React, { useState } from 'react';
import { Check, X, AlertTriangle, ArrowRight, RotateCcw, Download, Share2, Trash2 } from 'lucide-react';
import { CapturedPhoto, OrthodonticViewDefinition } from '../types';

interface QuickReviewOverlayProps {
  photo: CapturedPhoto;
  currentView: OrthodonticViewDefinition;
  nextViewName?: string;
  onAccept: () => void;
  onRetake: () => void;
  onDiscard?: () => void;
  onSaveToGallery?: () => void;
}

export const QuickReviewOverlay: React.FC<QuickReviewOverlayProps> = ({
  photo,
  currentView,
  nextViewName,
  onAccept,
  onRetake,
  onDiscard,
  onSaveToGallery,
}) => {
  const [isSavedManual, setIsSavedManual] = useState<boolean>(false);
  const quality = photo.quality;
  const isRecommendedAccept = quality.recommendation === 'ACCEPT';

  const handleManualSave = () => {
    if (onSaveToGallery) {
      onSaveToGallery();
      setIsSavedManual(true);
      setTimeout(() => setIsSavedManual(false), 3000);
    }
  };

  const metrics = [
    { key: 'position', label: 'Position', metric: quality.position },
    { key: 'orientation', label: 'Orientation', metric: quality.orientation },
    { key: 'sharpness', label: 'Sharpness', metric: quality.sharpness },
    { key: 'exposure', label: 'Exposure', metric: quality.exposure },
    { key: 'framing', label: 'Framing', metric: quality.framing },
  ];

  return (
    <div className="absolute inset-0 z-80 bg-black/95 flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* 1. Top Header */}
      <div className="pt-safe pt-4 px-4 pb-3 flex items-center justify-between bg-gradient-to-b from-black via-black/80 to-transparent z-10">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
            Photo Review • {currentView.category}
          </span>
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">{currentView.name}</h2>
        </div>

        {/* Overall Score Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-bold shadow-lg ${
            isRecommendedAccept
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'bg-amber-950/80 border-amber-500/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
          }`}
        >
          {isRecommendedAccept ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
          <span>{quality.overallScore}% Quality</span>
        </div>
      </div>

      {/* 2. Captured Photo Preview (Edge-to-Edge with rounded frame) */}
      <div className="flex-1 relative flex items-center justify-center p-3 min-h-0">
        <div className="relative w-full h-full max-w-md rounded-2xl overflow-hidden border border-slate-700/80 shadow-[0_8px_32px_rgba(0,0,0,0.8)] bg-slate-950">
          <img
            src={photo.dataUrl}
            alt={currentView.name}
            className="w-full h-full object-cover"
          />

          {/* Clinical Watermark & Direct Save Button */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="text-[10px] font-mono text-slate-300 bg-slate-950/80 border border-slate-700/60 px-2.5 py-1 rounded-full backdrop-blur-md shadow-md pointer-events-auto">
              {currentView.shortCode} • {new Date(photo.timestamp).toLocaleTimeString()}
            </div>

            {onSaveToGallery && (
              <button
                onClick={handleManualSave}
                className="px-3 py-1 bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/60 text-cyan-300 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md shadow-lg pointer-events-auto active:scale-95 transition-all"
                title="Save directly to phone gallery"
              >
                {isSavedManual ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Saved to Gallery</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3 text-cyan-400" />
                    <span>Save to Phone</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Photo Quality Checklist & Action Bar */}
      <div className="pb-safe px-4 pt-2 pb-6 bg-gradient-to-t from-black via-slate-950/95 to-transparent z-10">
        {/* Quality Check Results Grid */}
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-3.5 mb-4 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Quality Assessment
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              {isRecommendedAccept ? 'Standard Criteria Met' : 'Adjustment Suggested'}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {metrics.map((m) => (
              <div
                key={m.key}
                className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                  m.metric.passed
                    ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-700/50 text-rose-300'
                }`}
              >
                {m.metric.passed ? (
                  <Check className="w-4 h-4 text-emerald-400 mb-1" />
                ) : (
                  <X className="w-4 h-4 text-rose-400 mb-1" />
                )}
                <span className="text-[10px] font-medium leading-tight">{m.label}</span>
              </div>
            ))}
          </div>

          {/* Feedback message if retake recommended */}
          {quality.reasons.length > 0 && (
            <div className="mt-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-start gap-2 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-rose-300">
                  Retake Recommended
                </p>
                <p className="text-[11px] text-rose-200/90">{quality.reasons.join(' ')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons: DISCARD / RETAKE vs USE PHOTO (or MANUAL OVERRIDE) */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onDiscard || onRetake}
            className="py-3.5 px-3.5 rounded-xl border border-rose-800/60 bg-rose-950/40 hover:bg-rose-900/60 active:scale-98 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0"
            title="Discard and delete photo"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Discard</span>
          </button>

          {isRecommendedAccept ? (
            <>
              <button
                onClick={onRetake}
                className="flex-1 py-3.5 px-3 rounded-xl border border-slate-700/70 bg-slate-900/90 hover:bg-slate-800 active:scale-98 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <span>Retake</span>
              </button>

              <button
                onClick={onAccept}
                className="flex-[1.5] py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 active:scale-98 text-slate-950 font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 transition-all"
              >
                <span>Use Photo</span>
                {nextViewName ? (
                  <span className="flex items-center gap-1 font-semibold text-xs text-slate-950/90">
                    (Next: {nextViewName}) <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </span>
                ) : (
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onAccept}
                className="flex-1 py-3.5 px-3 rounded-xl border border-amber-700/70 bg-amber-950/40 hover:bg-amber-900/60 active:scale-98 text-amber-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <span>Use Anyway (Override)</span>
              </button>

              <button
                onClick={onRetake}
                className="flex-[1.5] py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 active:scale-98 text-slate-950 font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span>Retake Photo</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
