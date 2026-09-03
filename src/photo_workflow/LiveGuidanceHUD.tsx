import React from 'react';
import { LiveGuidanceState, OrthodonticViewDefinition } from '../types';
import { Smile, Sparkles, Activity } from 'lucide-react';

interface LiveGuidanceHUDProps {
  guidance: LiveGuidanceState;
  currentView?: OrthodonticViewDefinition;
}

const LiveGuidanceHUDComponent: React.FC<LiveGuidanceHUDProps> = ({ guidance, currentView }) => {
  const isReady = guidance.isReady;
  const isCategoryExtraoral = currentView?.category === 'extraoral';
  const roll = Math.round(guidance.headRollDeg || 0);
  const yaw = Math.round(guidance.headYawDeg || 0);
  const smileScore = guidance.smileIntensity ?? 0;
  const isMediaPipe = guidance.aiEngine === 'mediapipe';

  return (
    <div className="absolute top-[164px] left-0 right-0 z-20 flex flex-col items-center pointer-events-none px-4 gap-1.5">
      {/* Ready Alert Banner */}
      {isReady && (
        <div className="px-4 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-bold tracking-wide shadow-[0_0_25px_rgba(16,185,129,0.55)] backdrop-blur-xl animate-in zoom-in-95 duration-200 flex items-center gap-2 pointer-events-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
          <span>PERFECT ALIGNMENT — HOLD STILL</span>
        </div>
      )}

      {/* Extraoral Telemetry Floating Chip */}
      {isCategoryExtraoral && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/80 border border-white/15 backdrop-blur-2xl shadow-xl text-[10px] font-mono text-slate-200">
          <span className="flex items-center gap-1 text-cyan-400 font-extrabold">
            <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
            {isMediaPipe ? 'MEDIAPIPE 468 MESH' : 'AI TRACKING'}
          </span>
          <span className="text-slate-600 font-bold">•</span>
          <span className={Math.abs(roll) <= 3 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-semibold'}>
            Roll: {roll > 0 ? `+${roll}°` : `${roll}°`}
          </span>
          <span className="text-slate-600 font-bold">•</span>
          <span className={Math.abs(yaw) <= 5 ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
            Yaw: {yaw > 0 ? `+${yaw}°` : `${yaw}°`}
          </span>
          {smileScore > 0.25 && (
            <>
              <span className="text-slate-600 font-bold">•</span>
              <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                <Smile className="w-3 h-3" />
                {Math.round(smileScore * 100)}%
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const LiveGuidanceHUD = React.memo(LiveGuidanceHUDComponent);
