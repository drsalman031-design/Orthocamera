import React, { useState } from 'react';
import { X, Check, ArrowRight, Circle, Camera, Trash2 } from 'lucide-react';
import { CapturedPhoto, OrthodonticViewDefinition, ViewId } from '../types';
import { ORTHODONTIC_VIEWS } from './workflowData';

interface ProgressDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentIndex: number;
  onSelectViewIndex: (index: number) => void;
  capturedPhotos: Partial<Record<ViewId, CapturedPhoto>>;
  onDeletePhoto?: (viewId: ViewId) => void;
}

export const ProgressDrawer: React.FC<ProgressDrawerProps> = ({
  isOpen,
  onClose,
  currentIndex,
  onSelectViewIndex,
  capturedPhotos,
  onDeletePhoto,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<ViewId | null>(null);

  if (!isOpen) return null;

  const capturedCount = Object.keys(capturedPhotos).length;
  const totalCount = ORTHODONTIC_VIEWS.length;

  const extraoralViews = ORTHODONTIC_VIEWS.filter((v) => v.category === 'extraoral');
  const intraoralViews = ORTHODONTIC_VIEWS.filter((v) => v.category === 'intraoral');

  const renderViewItem = (v: OrthodonticViewDefinition, idx: number) => {
    const isCurrent = idx === currentIndex;
    const isCaptured = Boolean(capturedPhotos[v.id]);

    return (
      <button
        key={v.id}
        onClick={() => {
          onSelectViewIndex(idx);
          onClose();
        }}
        className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 text-left ${
          isCurrent
            ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900/80 border-cyan-500/80 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.25)] scale-[1.01]'
            : isCaptured
            ? 'bg-slate-900/70 border-emerald-800/50 text-slate-200 hover:bg-slate-800/80 hover:border-emerald-700/60'
            : 'bg-slate-950/50 border-slate-800/80 text-slate-400 hover:bg-slate-900/60 hover:text-slate-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono text-xs font-bold transition-all ${
              isCaptured
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : isCurrent
                ? 'bg-gradient-to-tr from-cyan-500 to-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                : 'bg-slate-800/80 border border-slate-700/50 text-slate-400'
            }`}
          >
            {isCaptured ? <Check className="w-4 h-4 stroke-[3]" /> : v.index}
          </div>

          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              <span className={isCurrent ? 'text-white' : 'text-slate-200'}>{v.name}</span>
              {isCurrent && (
                <span className="text-[9px] bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 px-2 py-0.5 rounded-full font-mono font-bold tracking-wider">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-1">{v.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {capturedPhotos[v.id] && (
            <>
              <img
                src={capturedPhotos[v.id]!.dataUrl}
                alt={v.name}
                className="w-8 h-8 rounded-lg object-cover border border-slate-700/80 shadow-md"
              />
              {onDeletePhoto && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(v.id);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition-colors active:scale-95"
                  title="Delete captured photo"
                  aria-label={`Delete ${v.name} photo`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
          {isCurrent ? (
            <ArrowRight className="w-4 h-4 text-cyan-400 animate-pulse stroke-[2.5]" />
          ) : isCaptured ? (
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">Captured</span>
          ) : (
            <Circle className="w-4 h-4 text-slate-700" />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
      <div
        className="bg-slate-950 border-t border-slate-800/90 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              Orthodontic Workflow
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Standardized 11-View Set</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="font-mono text-sm font-bold text-emerald-400">
                {capturedCount} / {totalCount}
              </span>
              <p className="text-[10px] font-mono text-slate-400">Completed</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-slate-900/90 border border-slate-700/70 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Progress bar */}
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-full h-2.5 p-0.5 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-cyan-500 via-emerald-400 to-emerald-300 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
              style={{ width: `${(capturedCount / totalCount) * 100}%` }}
            />
          </div>

          {/* Extraoral Section */}
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400 mb-2.5 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Extraoral Views (1 — 6)
            </h3>
            <div className="space-y-2">
              {extraoralViews.map((v) => renderViewItem(v, v.index - 1))}
            </div>
          </div>

          {/* Intraoral Section */}
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Intraoral Views (7 — 11)
            </h3>
            <div className="space-y-2">
              {intraoralViews.map((v) => renderViewItem(v, v.index - 1))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xs w-full p-4 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-600/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-rose-400" />
              </div>
              <h4 className="text-sm font-bold text-white">Delete Photo?</h4>
            </div>
            <p className="text-xs text-slate-300">
              Delete the captured photo for {ORTHODONTIC_VIEWS.find((v) => v.id === confirmDeleteId)?.name}?
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDeleteId && onDeletePhoto) {
                    onDeletePhoto(confirmDeleteId);
                  }
                  setConfirmDeleteId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-rose-950/50 active:scale-95 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
