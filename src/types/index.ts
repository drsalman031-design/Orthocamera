export type ViewCategory = 'extraoral' | 'intraoral';

export type ViewId =
  | 'FRONTAL_REST'
  | 'FRONTAL_SMILE'
  | 'RIGHT_PROFILE'
  | 'LEFT_PROFILE'
  | 'RIGHT_OBLIQUE'
  | 'LEFT_OBLIQUE'
  | 'ANTERIOR_INTRAORAL'
  | 'RIGHT_BUCCAL'
  | 'LEFT_BUCCAL'
  | 'MAXILLARY_OCCLUSAL'
  | 'MANDIBULAR_OCCLUSAL';

export interface OrthodonticViewDefinition {
  id: ViewId;
  index: number; // 1 to 11
  name: string;
  category: ViewCategory;
  shortCode: string;
  subtitle: string;
  clinicalPurpose: string;
  landmarks: string[];
  tips: string[];
  preferredFacing: 'environment' | 'user';
  defaultZoom?: number; // Automated digital zoom preset (e.g., 1.5x extraoral, 2.0x intraoral)
  overlayType:
    | 'frontal_rest'
    | 'frontal_smile'
    | 'right_profile'
    | 'left_profile'
    | 'right_oblique'
    | 'left_oblique'
    | 'anterior'
    | 'right_buccal'
    | 'left_buccal'
    | 'maxillary_occlusal'
    | 'mandibular_occlusal';
}

export interface QualityMetric {
  passed: boolean;
  score: number; // 0 - 100
  label: string;
  feedback: string;
}

export interface QualityCheckResult {
  overallPassed: boolean;
  overallScore: number; // 0 - 100
  position: QualityMetric;
  orientation: QualityMetric;
  sharpness: QualityMetric;
  exposure: QualityMetric;
  framing: QualityMetric;
  reasons: string[];
  recommendation: 'ACCEPT' | 'RETAKE';
}

export interface MeshContours {
  faceOval: Array<{ x: number; y: number }>;
  lips: Array<{ x: number; y: number }>;
  leftEye: Array<{ x: number; y: number }>;
  rightEye: Array<{ x: number; y: number }>;
  noseBridge: Array<{ x: number; y: number }>;
  leftPupil?: { x: number; y: number };
  rightPupil?: { x: number; y: number };
}

export interface LiveGuidanceState {
  isReady: boolean;
  readyScore: number; // 0 to 100
  primaryMessage: string;
  statusType: 'ready' | 'adjust' | 'searching';
  
  // Specific checks
  positionValid: boolean;
  positionMessage: string;
  
  angleValid: boolean;
  angleMessage: string;
  
  distanceValid: boolean;
  distanceMessage: string;
  
  sharpnessValid: boolean;
  exposureValid: boolean;
  
  // Raw measurements
  headRollDeg: number;
  headYawDeg: number;
  headPitchDeg: number;
  centeringDeltaX: number; // -1 (left) to 1 (right)
  centeringDeltaY: number; // -1 (top) to 1 (bottom)
  coverageRatio: number; // 0 to 1
  brightnessScore: number; // 0 to 255
  sharpnessScore: number; // Variance of Laplacian
  motionScore?: number; // 0 to 100
  isStable?: boolean;
  smileIntensity?: number; // 0 to 1
  isExtraoralDetected?: boolean;
  isIntraoralDetected?: boolean;
  aiEngine?: 'mediapipe' | 'native' | 'chroma';
  meshContours?: MeshContours;
  detectedFaceLandmarks?: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    noseTip: { x: number; y: number };
    mouthCenter: { x: number; y: number };
    chinTip: { x: number; y: number };
    leftCheek?: { x: number; y: number };
    rightCheek?: { x: number; y: number };
    leftMouthCorner?: { x: number; y: number };
    rightMouthCorner?: { x: number; y: number };
    upperLip?: { x: number; y: number };
    lowerLip?: { x: number; y: number };
  };
}

export interface CapturedPhoto {
  id: string;
  viewId: ViewId;
  dataUrl: string;
  timestamp: number;
  quality: QualityCheckResult;
  width: number;
  height: number;
}

export interface ClinicalCase {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  operator: string;
  clinicName: string;
  caseType: 'INITIAL' | 'PROGRESS' | 'FINAL' | 'RETENTION';
  notes: string;
  photos: Partial<Record<ViewId, CapturedPhoto>>;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  autoCaptureEnabled: boolean;
  autoCaptureDelaySec: number; // e.g. 2 or 3 seconds
  showClinicalGrid: boolean;
  showReferenceLabels: boolean;
  showFaceMesh: boolean; // Real-time 3D landmark mesh visualization // Lightweight toggle to hide/show textual overlay micro-labels
  overlayOpacity: number; // 0.2 to 1.0
  overlayColor: 'emerald' | 'cyan' | 'amber' | 'white';
  soundEffects: boolean;
  hapticFeedback: boolean;
  highResolution: boolean;
  guidanceSensitivity: 'high' | 'medium' | 'relaxed';
  autoSaveToGallery: boolean; // Automatically save every accepted photo to phone gallery/storage
  handsFreeAutoAdvance: boolean; // Auto-advance without touching screen after auto-capture
  diagnosticsOverlay: boolean; // Show real-time camera FPS, AI latency & motion diagnostics
  ghostOverlayEnabled: boolean; // Longitudinal ghost alignment
  ghostOverlayOpacity: number; // 0.1 to 0.4
}
