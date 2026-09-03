import React from 'react';
import { Layers } from 'lucide-react';

interface GhostOverlayManagerProps {
  ghostImageUrl: string | null;
  isEnabled: boolean;
  opacity: number; // 0.1, 0.2, 0.3, 0.4
  onToggle: (enabled: boolean) => void;
  onChangeOpacity: (opacity: number) => void;
}

export const GhostOverlayManager: React.FC<GhostOverlayManagerProps> = ({
  ghostImageUrl,
  isEnabled,
  opacity,
  onToggle,
  onChangeOpacity,
}) => {
  if (!ghostImageUrl) return null;

  return (
    <>
      {/* 1. Live Viewport Ghost Rendering (Never rendered to canvas/saved photo) */}
      {isEnabled && (
        <div
          className="absolute inset-0 pointer-events-none z-10 overflow-hidden flex items-center justify-center transition-opacity duration-200"
          style={{ opacity }}
        >
          <img
            src={ghostImageUrl}
            alt="Longitudinal Alignment Reference"
            className="w-full h-full object-cover filter contrast-125 saturate-50"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* 2. Floating Quick Ghost Control Pill (Bottom Right above zoom) */}
      <div className="absolute right-4 bottom-28 z-30 flex flex-col items-end gap-1.5 pointer-events-auto">
        <button
          onClick={() => onToggle(!isEnabled)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-xl border transition-all ${
            isEnabled
              ? 'bg-amber-500/30 border-amber-400/80 text-amber-200 shadow-lg shadow-amber-950/40'
              : 'bg-black/50 border-white/20 text-white/70 hover:bg-black/70'
          }`}
          title="Toggle longitudinal reference photo overlay"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>GHOST {isEnabled ? `${Math.round(opacity * 100)}%` : 'OFF'}</span>
        </button>

        {isEnabled && (
          <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md px-2 py-1 rounded-full border border-white/20">
            {[0.1, 0.2, 0.3, 0.4].map((val) => (
              <button
                key={val}
                onClick={() => onChangeOpacity(val)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all ${
                  Math.abs(opacity - val) < 0.05
                    ? 'bg-amber-400 text-black font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {Math.round(val * 100)}%
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
