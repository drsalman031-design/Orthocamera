import React from 'react';
import { Activity, Cpu, Eye, Gauge, Move, ShieldCheck, X } from 'lucide-react';
import { LiveGuidanceState, OrthodonticViewDefinition } from '../types';

interface DiagnosticsHUDProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: OrthodonticViewDefinition;
  guidance: LiveGuidanceState;
  cameraFps: number;
  aiFps: number;
  inferenceLatencyMs: number;
  motionScore: number;
  sensorResolution: { width: number; height: number };
  zoomLevel: number;
  isHardwareZoom: boolean;
}

export const DiagnosticsHUD: React.FC<DiagnosticsHUDProps> = ({
  isOpen,
  onClose,
  currentView,
  guidance,
  cameraFps,
  aiFps,
  inferenceLatencyMs,
  motionScore,
  sensorResolution,
  zoomLevel,
  isHardwareZoom,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-16 left-4 right-4 z-50 bg-black/90 backdrop-blur-2xl border border-emerald-500/40 rounded-2xl p-4 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs uppercase tracking-wider font-bold text-emerald-300">
            Real-Time Clinical Telemetry & Diagnostics
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 font-mono text-xs">
        {/* Camera FPS & Resolution */}
        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
          <div className="text-white/40 text-[10px] flex items-center gap-1">
            <Gauge className="w-3 h-3 text-cyan-400" /> CAMERA SENSOR
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {cameraFps} FPS
          </div>
          <div className="text-[10px] text-white/60">
            {sensorResolution.width}×{sensorResolution.height}
          </div>
        </div>

        {/* AI Inference & Engine */}
        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
          <div className="text-white/40 text-[10px] flex items-center gap-1">
            <Cpu className="w-3 h-3 text-purple-400" /> AI INFERENCE
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {aiFps} FPS ({inferenceLatencyMs}ms)
          </div>
          <div className="text-[10px] text-purple-300">
            {guidance.aiEngine?.toUpperCase() || 'MEDIAPIPE'}
          </div>
        </div>

        {/* Motion & Stability */}
        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
          <div className="text-white/40 text-[10px] flex items-center gap-1">
            <Move className="w-3 h-3 text-amber-400" /> MOTION JITTER
          </div>
          <div className="text-sm font-bold mt-1 text-white">
            Score: {motionScore}/100
          </div>
          <div className="text-[10px]">
            {motionScore < 15 ? (
              <span className="text-emerald-400">STABLE ✓</span>
            ) : motionScore < 30 ? (
              <span className="text-amber-400">MODERATE MOTION</span>
            ) : (
              <span className="text-rose-400 font-bold">HIGH SHAKE</span>
            )}
          </div>
        </div>

        {/* Zoom Mode */}
        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
          <div className="text-white/40 text-[10px]">ZOOM SYNC</div>
          <div className="text-sm font-bold text-white mt-1">
            {zoomLevel.toFixed(1)}x
          </div>
          <div className="text-[10px] text-cyan-400">
            {isHardwareZoom ? 'HARDWARE SENSOR' : 'DIGITAL CROP SYNC'}
          </div>
        </div>

        {/* Head Pose / Occlusal Angle */}
        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
          <div className="text-white/40 text-[10px] flex items-center gap-1">
            <Eye className="w-3 h-3 text-emerald-400" /> HEAD POSE
          </div>
          <div className="text-xs font-bold text-white mt-1">
            {currentView.category === 'extraoral' ? (
              guidance.pose && guidance.pose.yawDeg !== null ? (
                <>
                  Yaw: {guidance.headYawDeg > 0 ? '+' : ''}{guidance.headYawDeg.toFixed(1)}°
                </>
              ) : (
                'Yaw: —'
              )
            ) : (
              `Tilt: ${guidance.headRollDeg.toFixed(1)}°`
            )}
          </div>
          <div className="text-[10px] text-white/60">
            {currentView.category === 'extraoral' ? (
              guidance.pose && guidance.pose.rollDeg !== null ? (
                <>Roll: {guidance.headRollDeg.toFixed(1)}° | Pitch: {guidance.headPitchDeg.toFixed(1)}°</>
              ) : (
                'Roll: — | Pitch: —'
              )
            ) : (
              `Midline: ${(guidance.centeringDeltaX * 100).toFixed(0)}%`
            )}
          </div>
        </div>

        {/* Quality Score & Status */}
        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
          <div className="text-white/40 text-[10px] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> READINESS
          </div>
          <div className="text-xs font-bold mt-1">
            {guidance.isReady ? (
              <span className="text-emerald-400">READY ({guidance.readyScore}%)</span>
            ) : (
              <span className="text-amber-300">ALIGNING ({guidance.readyScore}%)</span>
            )}
          </div>
          <div className="text-[10px] text-white/60 truncate">
            {guidance.dominantReason || currentView.shortCode}
          </div>
        </div>
      </div>
    </div>
  );
};
