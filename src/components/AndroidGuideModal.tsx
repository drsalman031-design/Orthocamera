import React from 'react';
import { X, Code2, Cpu, CheckCircle2, Copy, BookOpen } from 'lucide-react';

interface AndroidGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidGuideModal: React.FC<AndroidGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-950/95 border border-slate-700/60 rounded-3xl overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.85)] max-h-[85vh] flex flex-col backdrop-blur-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Android Native & AI Model Architecture
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                Kotlin • Jetpack Compose • CameraX • MediaPipe • ONNX / TFLite
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-900 border border-slate-700/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Technical Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
          {/* Section 1: Android Gradle & CameraX Setup */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold uppercase text-xs">
              <Code2 className="w-4 h-4" /> 1. Android CameraX & Dependencies (build.gradle.kts)
            </div>
            <p className="text-slate-400 text-[11px]">
              CameraX provides edge-to-edge PreviewView with asynchronous ImageAnalysis analyzer without blocking UI rendering.
            </p>
            <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800/90 font-mono text-[11px] text-slate-300 overflow-x-auto shadow-inner">
              <pre>{`// CameraX Core & Lifecycle
implementation("androidx.camera:camera-core:1.4.0")
implementation("androidx.camera:camera-camera2:1.4.0")
implementation("androidx.camera:camera-lifecycle:1.4.0")
implementation("androidx.camera:camera-view:1.4.0")

// Google MediaPipe Face Landmarker (On-Device)
implementation("com.google.mediapipe:tasks-vision:0.10.14")

// Jetpack Compose & Material 3
implementation("androidx.compose.material3:material3:1.3.0")
implementation("androidx.compose.ui:ui-tooling-preview:1.7.0")`}</pre>
            </div>
          </div>

          {/* Section 2: Full-Screen Edge-to-Edge Compose Camera Layout */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold uppercase text-xs">
              <CheckCircle2 className="w-4 h-4" /> 2. Full-Screen Edge-to-Edge Camera Preview in Compose
            </div>
            <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800/90 font-mono text-[11px] text-slate-300 overflow-x-auto shadow-inner">
              <pre>{`@Composable
fun OrthoCameraScreen(
    currentView: OrthodonticViewDefinition,
    onPhotoCaptured: (Bitmap) -> Unit
) {
    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        // 1. Full-Screen CameraX Edge-to-Edge Preview
        AndroidView(
            factory = { context ->
                PreviewView(context).apply {
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // 2. Orthodontic Overlay Rendered Directly on Compose Canvas
        OrthodonticOverlayCanvas(
            view = currentView,
            guidance = guidanceState,
            modifier = Modifier.fillMaxSize()
        )

        // 3. Translucent Clinical Controls
        ClinicalHUDAndShutterControls(modifier = Modifier.fillMaxSize())
    }
}`}</pre>
            </div>
          </div>

          {/* Section 3: AI Model Architecture & Future Model Pluggability */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-bold uppercase text-xs">
              <Cpu className="w-4 h-4" /> 3. Pluggable Intraoral AI Architecture (ONNX / TFLite)
            </div>
            <p className="text-slate-400 text-[11px]">
              Clean separation allows swapping the default heuristic geometric engine for specialized tooth/arch segmentation models (e.g. YOLOv8-Dental, MobileNet-V3 Intraoral Segmenter).
            </p>
            <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800/90 font-mono text-[11px] text-slate-300 overflow-x-auto shadow-inner">
              <pre>{`interface IntraoralAnalyzer {
    fun analyzeFrame(
        imageProxy: ImageProxy,
        viewType: IntraoralViewType
    ): IntraoralAnalysisResult
}

// Future ONNX/TFLite Implementation Example:
class TFLiteDentalArchAnalyzer(context: Context) : IntraoralAnalyzer {
    private val interpreter = Interpreter(loadModelFile(context, "dental_arch_seg.tflite"))
    
    override fun analyzeFrame(imageProxy: ImageProxy, viewType: IntraoralViewType): IntraoralAnalysisResult {
        // 1. Run inference on central crop
        // 2. Extract dental midline offset & occlusal plane slope
        // 3. Verify cheek retractor clearance boundaries
        return IntraoralAnalysisResult(...)
    }
}`}</pre>
            </div>
          </div>

          {/* Section 4: Clinical Disclaimer */}
          <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Clinical Photography Assistant:</strong> This application enforces standardized orthodontic photographic positions and quality thresholds for clinical records. It does not perform autonomous orthodontic diagnosis.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-white rounded-xl font-semibold text-xs transition-colors shadow-md"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
