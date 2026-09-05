import React from 'react';
import { LiveGuidanceState, OrthodonticViewDefinition } from '../types';

interface OrthodonticOverlayProps {
  view: OrthodonticViewDefinition;
  guidance: LiveGuidanceState;
  showGrid?: boolean;
  showLabels?: boolean;
  showMesh?: boolean;
  opacity?: number;
  colorTheme?: 'emerald' | 'cyan' | 'amber' | 'white';
}

// Helper: Semi-transparent dark pill background for clinical micro-labels
interface LabelPillProps {
  x: number;
  y: number;
  text: string;
  subtext?: string;
  align?: 'start' | 'middle' | 'end';
  baseColor: string;
  showLabels?: boolean;
  fontSize?: number;
}

const LabelPill: React.FC<LabelPillProps> = ({
  x,
  y,
  text,
  subtext,
  align = 'start',
  baseColor,
  showLabels = true,
  fontSize = 13,
}) => {
  if (!showLabels) return null;

  const charLen = Math.max(text.length, subtext ? subtext.length : 0);
  const pillWidth = Math.max(charLen * (fontSize * 0.62) + 20, 48);
  const pillHeight = subtext ? fontSize * 2 + 14 : fontSize + 12;

  let rectX = x;
  if (align === 'middle') {
    rectX = x - pillWidth / 2;
  } else if (align === 'end') {
    rectX = x - pillWidth;
  }

  const textX = align === 'middle' ? x : align === 'end' ? x - 10 : x + 10;

  return (
    <g className="transition-opacity duration-200 pointer-events-none">
      <rect
        x={rectX}
        y={y - fontSize - 3}
        width={pillWidth}
        height={pillHeight}
        rx={5}
        fill="#080c14"
        fillOpacity={0.88}
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth={0.85}
      />
      <text
        x={textX}
        y={y}
        fill={baseColor}
        fontSize={fontSize}
        fontWeight="700"
        textAnchor={align}
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.8px"
      >
        {text}
      </text>
      {subtext && (
        <text
          x={textX}
          y={y + fontSize + 3}
          fill="#cbd5e1"
          fontSize={fontSize * 0.85}
          fontWeight="500"
          textAnchor={align}
          fontFamily="JetBrains Mono, monospace"
        >
          {subtext}
        </text>
      )}
    </g>
  );
};

const OrthodonticOverlayCanvasComponent: React.FC<OrthodonticOverlayProps> = ({
  view,
  guidance,
  showGrid = false,
  showLabels = true,
  showMesh = true,
  opacity = 0.85,
  colorTheme = 'cyan',
}) => {
  const isReady = guidance.isReady;

  // Dynamic stroke color based on guidance state
  const baseColor = isReady
    ? '#10b981' // emerald-500
    : colorTheme === 'cyan'
    ? '#06b6d4' // cyan-500
    : colorTheme === 'amber'
    ? '#f59e0b'
    : colorTheme === 'emerald'
    ? '#10b981'
    : '#e2e8f0';

  const glowFilter = isReady
    ? 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))'
    : 'drop-shadow(0 0 3px rgba(6, 182, 212, 0.4))';

  // Head tilt level calculation
  const rollAngle = guidance.headRollDeg || 0;
  const bubbleOffset = Math.max(-35, Math.min(35, rollAngle * 3.5));

  // Oblique 45 degree yaw angle assessment
  const currentYaw = guidance.headYawDeg || 0;
  const isRightOblique = view.id === 'RIGHT_OBLIQUE';
  const targetYaw = isRightOblique ? 45 : -45;
  const yawDiff = Math.abs(currentYaw - targetYaw);
  const isYawAligned = yawDiff <= 5.0;

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = React.useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1000,
    height: typeof window !== 'undefined' ? window.innerHeight : 1600,
  });

  React.useEffect(() => {
    const measure = () => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setViewportSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
        }
      } else if (typeof window !== 'undefined') {
        setViewportSize({ width: window.innerWidth, height: window.innerHeight });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const W = viewportSize.width;
  const H = viewportSize.height;

  const isIntraoral = view.category === 'intraoral';
  const targetCenterX = 0.5 * W;
  const targetCenterY = (isIntraoral ? 0.50 : 0.45) * H;

  // Scale and translate the 1000x1600 clinical template to fit the screen viewport with comfortable clinical margins
  const maxTmplH = H * (isIntraoral ? 0.70 : 0.62);
  const maxTmplW = W * 0.86;
  const scaleH = maxTmplH / 1100;
  const scaleW = maxTmplW / 750;
  const tmplScale = Math.min(scaleH, scaleW);
  const tmplOriginY = isIntraoral ? 800 : 740;
  const tmplTx = targetCenterX - 500 * tmplScale;
  const tmplTy = targetCenterY - tmplOriginY * tmplScale;

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
    >
      {/* ================================================================= */}
      {/* 1. Z-20: ORTHODONTIC CLINICAL OVERLAY GUIDELINES (Intraoral Only) */}
      {/* ================================================================= */}
      {isIntraoral && (
        <div
          className="absolute inset-0 pointer-events-none z-20 select-none overflow-hidden"
          style={{ opacity }}
        >
          <svg
            className="w-full h-full"
            viewBox={`0 0 ${W} ${H}`}
            style={{ filter: glowFilter }}
          >
            <defs>
              <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={baseColor} stopOpacity="0.04" />
                <stop offset="100%" stopColor={baseColor} stopOpacity="0.02" />
              </linearGradient>
              <radialGradient id="smileGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={baseColor} stopOpacity="0.15" />
                <stop offset="100%" stopColor={baseColor} stopOpacity="0.0" />
              </radialGradient>
            </defs>

            {/* Unified Clinical Template Space [0..1000] x [0..1600] scaled and centered to viewport */}
            <g transform={`translate(${tmplTx.toFixed(2)}, ${tmplTy.toFixed(2)}) scale(${tmplScale.toFixed(4)})`}>

              {/* Optional Clinical Measurement Grid (Rule of Thirds & Symmetry) */}
              {showGrid && (
                <g stroke={baseColor} strokeWidth="0.75" strokeDasharray="3,6" opacity="0.25">
                  {/* Vertical lines */}
                  <line x1="200" y1="0" x2="200" y2="1600" />
                  <line x1="350" y1="0" x2="350" y2="1600" />
                  <line x1="500" y1="0" x2="500" y2="1600" />
                  <line x1="650" y1="0" x2="650" y2="1600" />
                  <line x1="800" y1="0" x2="800" y2="1600" />
                  {/* Horizontal lines */}
                  <line x1="0" y1="300" x2="1000" y2="300" />
                  <line x1="0" y1="500" x2="1000" y2="500" />
                  <line x1="0" y1="700" x2="1000" y2="700" />
                  <line x1="0" y1="900" x2="1000" y2="900" />
                  <line x1="0" y1="1100" x2="1000" y2="1100" />
                  <line x1="0" y1="1300" x2="1000" y2="1300" />
                </g>
              )}

              {/* ========================================================================= */}
              {/* 7. ANTERIOR INTRAORAL (Centric Occlusion, Midline, Zeniths, Retractors)  */}
              {/* ========================================================================= */}
              {view.id === 'ANTERIOR_INTRAORAL' && (
                <g>
                  {/* Bilateral Cheek Retractor Boundaries */}
                  <path
                    d="M 170 540 C 130 680, 130 920, 170 1060"
                    fill="none"
                    stroke={baseColor}
                    strokeWidth="2.5"
                    strokeDasharray="6,6"
                  />
                  <path
                    d="M 830 540 C 870 680, 870 920, 830 1060"
                    fill="none"
                    stroke={baseColor}
                    strokeWidth="2.5"
                    strokeDasharray="6,6"
                  />
            <LabelPill
              x={140}
              y={520}
              text="RETRACTOR"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />
            <LabelPill
              x={860}
              y={520}
              text="RETRACTOR"
              align="end"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Horizontal Occlusal Plane (bisecting upper & lower teeth) */}
            <line x1="180" y1="800" x2="820" y2="800" stroke={baseColor} strokeWidth="3" />
            <LabelPill
              x={820}
              y={805}
              text="OCCLUSAL PLANE"
              subtext="Horizontal Bisector"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Vertical Dental Midline (between Maxillary Central Incisors #8 and #9) */}
            <line x1="500" y1="580" x2="500" y2="1020" stroke={baseColor} strokeWidth="3" />
            <LabelPill
              x={500}
              y={560}
              text="DENTAL MIDLINE (#8-#9)"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Maxillary Anterior Envelope (#6 to #11 Gingival Zeniths) */}
            <path
              d="M 230 780 
                 C 260 670, 360 620, 500 620 
                 C 640 620, 740 670, 770 780"
              fill="none"
              stroke={baseColor}
              strokeWidth="2.5"
            />

            {/* Mandibular Anterior Envelope (#22 to #27) */}
            <path
              d="M 250 820 
                 C 280 920, 380 960, 500 960 
                 C 620 960, 720 920, 750 820"
              fill="none"
              stroke={baseColor}
              strokeWidth="2.5"
            />
          </g>
        )}

        {/* ========================================================================= */}
        {/* 8. RIGHT BUCCAL (ABO Standard: Perpendicular to Premolars, Occlusal Plane) */}
        {/* ========================================================================= */}
        {view.id === 'RIGHT_BUCCAL' && (
          <g>
            {/* Functional Occlusal Plane (Horizontal Bisector across frame) */}
            <line
              x1="80"
              y1="800"
              x2="920"
              y2="800"
              stroke={baseColor}
              strokeWidth="2.5"
              strokeDasharray="12,8"
            />

            {/* Upper and Lower Vestibular Clearance Limits (Equal Gingival Margins) */}
            <line
              x1="120"
              y1="450"
              x2="880"
              y2="450"
              stroke={baseColor}
              strokeWidth="1.2"
              strokeDasharray="6,6"
              opacity="0.45"
            />
            <line
              x1="120"
              y1="1150"
              x2="880"
              y2="1150"
              stroke={baseColor}
              strokeWidth="1.2"
              strokeDasharray="6,6"
              opacity="0.45"
            />

            {/* Anterior Framing Bracket (Contralateral Incisor Limit on Left) */}
            <path
              d="M 160 450 L 190 450 M 160 450 L 160 490 M 160 1150 L 190 1150 M 160 1150 L 160 1110"
              fill="none"
              stroke={baseColor}
              strokeWidth="2"
              opacity="0.6"
            />

            {/* Posterior Framing Bracket (2nd Molar Retractor Clearance on Right) */}
            <path
              d="M 860 450 L 830 450 M 860 450 L 860 490 M 860 1150 L 830 1150 M 860 1150 L 860 1110"
              fill="none"
              stroke={baseColor}
              strokeWidth="2"
              opacity="0.6"
            />

            {/* Canine-Premolar Junction Focal Reticle (Optical Center at 44% width) */}
            <g transform="translate(440, 800)">
              <circle cx="0" cy="0" r="32" fill="none" stroke={baseColor} strokeWidth="2.5" />
              <line x1="-42" y1="0" x2="-22" y2="0" stroke={baseColor} strokeWidth="2" />
              <line x1="22" y1="0" x2="42" y2="0" stroke={baseColor} strokeWidth="2" />
              <line x1="0" y1="-42" x2="0" y2="-22" stroke={baseColor} strokeWidth="2" />
              <line x1="0" y1="22" x2="0" y2="42" stroke={baseColor} strokeWidth="2" />
              <circle cx="0" cy="0" r="4" fill={baseColor} />
            </g>
          </g>
        )}

        {/* ========================================================================= */}
        {/* 9. LEFT BUCCAL (ABO Standard: Mirrored Premolar Optical Reticle & Plane)   */}
        {/* ========================================================================= */}
        {view.id === 'LEFT_BUCCAL' && (
          <g>
            {/* Functional Occlusal Plane (Horizontal Bisector across frame) */}
            <line
              x1="80"
              y1="800"
              x2="920"
              y2="800"
              stroke={baseColor}
              strokeWidth="2.5"
              strokeDasharray="12,8"
            />

            {/* Upper and Lower Vestibular Clearance Limits (Equal Gingival Margins) */}
            <line
              x1="120"
              y1="450"
              x2="880"
              y2="450"
              stroke={baseColor}
              strokeWidth="1.2"
              strokeDasharray="6,6"
              opacity="0.45"
            />
            <line
              x1="120"
              y1="1150"
              x2="880"
              y2="1150"
              stroke={baseColor}
              strokeWidth="1.2"
              strokeDasharray="6,6"
              opacity="0.45"
            />

            {/* Posterior Framing Bracket (2nd Molar Retractor Clearance on Left) */}
            <path
              d="M 140 450 L 170 450 M 140 450 L 140 490 M 140 1150 L 170 1150 M 140 1150 L 140 1110"
              fill="none"
              stroke={baseColor}
              strokeWidth="2"
              opacity="0.6"
            />

            {/* Anterior Framing Bracket (Contralateral Incisor Limit on Right) */}
            <path
              d="M 840 450 L 810 450 M 840 450 L 840 490 M 840 1150 L 810 1150 M 840 1150 L 840 1110"
              fill="none"
              stroke={baseColor}
              strokeWidth="2"
              opacity="0.6"
            />

            {/* Canine-Premolar Junction Focal Reticle (Mirrored Optical Center at 56% width) */}
            <g transform="translate(560, 800)">
              <circle cx="0" cy="0" r="32" fill="none" stroke={baseColor} strokeWidth="2.5" />
              <line x1="-42" y1="0" x2="-22" y2="0" stroke={baseColor} strokeWidth="2" />
              <line x1="22" y1="0" x2="42" y2="0" stroke={baseColor} strokeWidth="2" />
              <line x1="0" y1="-42" x2="0" y2="-22" stroke={baseColor} strokeWidth="2" />
              <line x1="0" y1="22" x2="0" y2="42" stroke={baseColor} strokeWidth="2" />
              <circle cx="0" cy="0" r="4" fill={baseColor} />
            </g>
          </g>
        )}

        {/* ========================================================================= */}
        {/* 10. MAXILLARY OCCLUSAL (Broad Parabolic Catenary Arch & Mirror Boundary) */}
        {/* ========================================================================= */}
        {view.id === 'MAXILLARY_OCCLUSAL' && (
          <g>
            {/* Mid-Palatal Suture Raphe (Vertical Midline) */}
            <line
              x1="500"
              y1="360"
              x2="500"
              y2="1280"
              stroke={baseColor}
              strokeWidth="2.5"
              strokeDasharray="6,4"
            />
            <LabelPill
              x={500}
              y={380}
              text="MID-PALATAL RAPHE"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Broad Parabolic Catenary Upper Arch Form Template (#1 to #16) */}
            <path
              d="M 230 1160 
                 C 220 860, 270 540, 500 480 
                 C 730 480, 780 860, 770 1160"
              fill="none"
              stroke={baseColor}
              strokeWidth="3.5"
            />

            {/* Central Incisors Landing Arc (#8-#9) */}
            <path d="M 390 500 Q 500 460 610 500" fill="none" stroke={baseColor} strokeWidth="3" />
            <LabelPill
              x={500}
              y={440}
              text="CENTRAL INCISORS (#8-#9)"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Palatal Vault Clearance */}
            <ellipse
              cx="500"
              cy="730"
              rx="140"
              ry="110"
              fill="none"
              stroke={baseColor}
              strokeWidth="1.5"
              strokeDasharray="4,4"
              opacity="0.6"
            />

            {/* Terminal 2nd Molar Markers (#2 on Right, #15 on Left) */}
            <line x1="200" y1="1160" x2="280" y2="1160" stroke={baseColor} strokeWidth="3" />
            <line x1="720" y1="1160" x2="800" y2="1160" stroke={baseColor} strokeWidth="3" />
            <LabelPill
              x={210}
              y={1200}
              text="RIGHT 2nd MOLAR (#2)"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />
            <LabelPill
              x={790}
              y={1200}
              text="LEFT 2nd MOLAR (#15)"
              align="end"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Intraoral Mirror Boundary Guideline (Prevents Incisal Cutoff) */}
            <rect
              x="160"
              y="420"
              width="680"
              height="840"
              rx="40"
              fill="none"
              stroke={baseColor}
              strokeWidth="1.5"
              strokeDasharray="10,8"
              opacity="0.5"
            />
            <LabelPill
              x={500}
              y={1280}
              text="INTRAORAL MIRROR BOUNDARY (FOG-FREE)"
              subtext="Prevent Incisal Edge Cutoff"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />
          </g>
        )}

        {/* ========================================================================= */}
        {/* 11. MANDIBULAR OCCLUSAL (Broad Parabolic Catenary Arch & Tongue Guide)    */}
        {/* ========================================================================= */}
        {view.id === 'MANDIBULAR_OCCLUSAL' && (
          <g>
            {/* Mandibular Midline */}
            <line
              x1="500"
              y1="360"
              x2="500"
              y2="1280"
              stroke={baseColor}
              strokeWidth="2.5"
              strokeDasharray="6,4"
            />
            <LabelPill
              x={500}
              y={1280}
              text="MANDIBULAR MIDLINE"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Broad Parabolic Catenary Lower Arch Form Template (#17 to #32) */}
            <path
              d="M 240 460 
                 C 230 760, 270 1080, 500 1140 
                 C 730 1140, 770 760, 760 460"
              fill="none"
              stroke={baseColor}
              strokeWidth="3.5"
            />

            {/* Lower Incisal Arc (#24-#25) */}
            <path d="M 410 1120 Q 500 1160 590 1120" fill="none" stroke={baseColor} strokeWidth="3" />
            <LabelPill
              x={500}
              y={1195}
              text="LOWER INCISORS (#24-#25)"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Tongue Clearance Zone */}
            <ellipse
              cx="500"
              cy="840"
              rx="130"
              ry="120"
              fill="none"
              stroke={baseColor}
              strokeWidth="1.5"
              strokeDasharray="4,4"
              opacity="0.6"
            />
            <LabelPill
              x={500}
              y={845}
              text="TONGUE DEPRESSED BEHIND MIRROR"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Lower Terminal 2nd Molar Markers (#31 on Right, #18 on Left) */}
            <line x1="210" y1="460" x2="290" y2="460" stroke={baseColor} strokeWidth="3" />
            <line x1="710" y1="460" x2="790" y2="460" stroke={baseColor} strokeWidth="3" />
            <LabelPill
              x={220}
              y={425}
              text="RIGHT 2nd MOLAR (#31)"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />
            <LabelPill
              x={780}
              y={425}
              text="LEFT 2nd MOLAR (#18)"
              align="end"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Intraoral Mirror Boundary */}
            <rect
              x="170"
              y="390"
              width="660"
              height="840"
              rx="40"
              fill="none"
              stroke={baseColor}
              strokeWidth="1.5"
              strokeDasharray="10,8"
              opacity="0.5"
            />
          </g>
        )}

          </g>
        </svg>
      </div>
    )}

      {/* ================================================================= */}
      {/* 2. Z-30: MEDIAPIPE LIVE TRACKING & FACIAL MESH                    */}
      {/* ================================================================= */}
      {showMesh && (
        <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden">
          <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`}>
            {/* Facial Mesh Contours */}
            {guidance.meshContours?.faceOval && guidance.meshContours.faceOval.length > 0 && (
              <path
                d={`M ${guidance.meshContours.faceOval.map(p => `${(p.x * W).toFixed(1)},${(p.y * H).toFixed(1)}`).join(' L ')} Z`}
                fill="none"
                stroke={isReady ? 'rgba(16, 185, 129, 0.45)' : 'rgba(56, 189, 248, 0.35)'}
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
            )}

            {guidance.meshContours?.lips && guidance.meshContours.lips.length > 0 && (
              <path
                d={`M ${guidance.meshContours.lips.map(p => `${(p.x * W).toFixed(1)},${(p.y * H).toFixed(1)}`).join(' L ')} Z`}
                fill="none"
                stroke={isReady ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 114, 182, 0.5)'}
                strokeWidth="1.5"
              />
            )}

            {guidance.meshContours?.noseBridge && guidance.meshContours.noseBridge.length > 0 && (
              <path
                d={`M ${guidance.meshContours.noseBridge.map(p => `${(p.x * W).toFixed(1)},${(p.y * H).toFixed(1)}`).join(' L ')}`}
                fill="none"
                stroke={isReady ? 'rgba(16, 185, 129, 0.5)' : 'rgba(56, 189, 248, 0.4)'}
                strokeWidth="1.5"
              />
            )}

            {guidance.meshContours?.leftEye && guidance.meshContours.leftEye.length > 0 && (
              <path
                d={`M ${guidance.meshContours.leftEye.map(p => `${(p.x * W).toFixed(1)},${(p.y * H).toFixed(1)}`).join(' L ')} Z`}
                fill="none"
                stroke={isReady ? 'rgba(16, 185, 129, 0.5)' : 'rgba(56, 189, 248, 0.35)'}
                strokeWidth="1.2"
              />
            )}

            {guidance.meshContours?.rightEye && guidance.meshContours.rightEye.length > 0 && (
              <path
                d={`M ${guidance.meshContours.rightEye.map(p => `${(p.x * W).toFixed(1)},${(p.y * H).toFixed(1)}`).join(' L ')} Z`}
                fill="none"
                stroke={isReady ? 'rgba(16, 185, 129, 0.5)' : 'rgba(56, 189, 248, 0.35)'}
                strokeWidth="1.2"
              />
            )}

            {/* Interpupillary Line & Roll Indicator */}
            {guidance.detectedFaceLandmarks?.leftEye && guidance.detectedFaceLandmarks?.rightEye && (
              <g>
                <line
                  x1={(guidance.detectedFaceLandmarks.leftEye.x * W).toFixed(1)}
                  y1={(guidance.detectedFaceLandmarks.leftEye.y * H).toFixed(1)}
                  x2={(guidance.detectedFaceLandmarks.rightEye.x * W).toFixed(1)}
                  y2={(guidance.detectedFaceLandmarks.rightEye.y * H).toFixed(1)}
                  stroke={isReady ? '#10b981' : '#38bdf8'}
                  strokeWidth="2"
                  strokeDasharray={isReady ? 'none' : '4,4'}
                />
                <circle
                  cx={(guidance.detectedFaceLandmarks.leftEye.x * W).toFixed(1)}
                  cy={(guidance.detectedFaceLandmarks.leftEye.y * H).toFixed(1)}
                  r="4"
                  fill={isReady ? '#10b981' : '#38bdf8'}
                />
                <circle
                  cx={(guidance.detectedFaceLandmarks.rightEye.x * W).toFixed(1)}
                  cy={(guidance.detectedFaceLandmarks.rightEye.y * H).toFixed(1)}
                  r="4"
                  fill={isReady ? '#10b981' : '#38bdf8'}
                />
              </g>
            )}

            {/* Dynamic Facial Midline for Frontal Views */}
            {view.id.startsWith('FRONTAL') && guidance.detectedFaceLandmarks?.noseTip && guidance.detectedFaceLandmarks?.chinTip && (
              <g>
                <line
                  x1={(guidance.detectedFaceLandmarks.noseTip.x * W).toFixed(1)}
                  y1={((guidance.detectedFaceLandmarks.noseTip.y - 0.12) * H).toFixed(1)}
                  x2={(guidance.detectedFaceLandmarks.chinTip.x * W).toFixed(1)}
                  y2={(guidance.detectedFaceLandmarks.chinTip.y * H).toFixed(1)}
                  stroke={isReady ? '#10b981' : '#38bdf8'}
                  strokeWidth="2"
                  strokeDasharray="5,4"
                />
              </g>
            )}

            {/* ========================================================================= */}
            {/* Dynamic Sagittal Profile Analysis: Ricketts E-Line, Mandibular Plane & FMA */}
            {/* ========================================================================= */}
            {view.id.includes('PROFILE') && (() => {
              const isRightProfile = view.id === 'RIGHT_PROFILE';
              const noseTip = guidance.detectedFaceLandmarks?.noseTip;
              const chinTip = guidance.detectedFaceLandmarks?.chinTip;
              const menton = guidance.detectedFaceLandmarks?.menton || chinTip;
              const gonion = isRightProfile
                ? guidance.detectedFaceLandmarks?.rightGonion
                : guidance.detectedFaceLandmarks?.leftGonion;
              const tragus = isRightProfile
                ? guidance.detectedFaceLandmarks?.rightTragus
                : guidance.detectedFaceLandmarks?.leftTragus;
              const anteriorEye = isRightProfile
                ? guidance.detectedFaceLandmarks?.rightEye
                : guidance.detectedFaceLandmarks?.leftEye;
              const subnasale = guidance.detectedFaceLandmarks?.subnasale;

              // Calculate Mandibular Plane angle and FMA (Frankfort-Mandibular Plane Angle)
              let fmaDeg: number | null = null;
              let facialBiotype = '';
              let biotypeColor = '#10b981';

              if (gonion && menton) {
                const mpDx = (menton.x - gonion.x) * W;
                const mpDy = (menton.y - gonion.y) * H;
                const mpAngleDeg = Math.abs(Math.atan2(mpDy, Math.abs(mpDx)) * (180 / Math.PI));

                let fhAngleDeg = 0;
                if (tragus && (anteriorEye || subnasale)) {
                  const antRef = subnasale || anteriorEye!;
                  const fhDx = (antRef.x - tragus.x) * W;
                  const fhDy = (antRef.y - tragus.y) * H;
                  fhAngleDeg = Math.atan2(fhDy, Math.abs(fhDx)) * (180 / Math.PI);
                }

                fmaDeg = Math.round(Math.abs(mpAngleDeg - fhAngleDeg));
                if (fmaDeg < 21) {
                  facialBiotype = 'Hypodivergent (Low Angle)';
                  biotypeColor = '#38bdf8';
                } else if (fmaDeg > 30) {
                  facialBiotype = 'Hyperdivergent (High Angle)';
                  biotypeColor = '#f59e0b';
                } else {
                  facialBiotype = 'Normodivergent (Average)';
                  biotypeColor = '#10b981';
                }
              }

              return (
                <g>
                  {/* 1. Ricketts E-Line (Esthetic Line: Nose Tip to Pogonion/Chin) */}
                  {noseTip && chinTip && (
                    <g>
                      <line
                        x1={(noseTip.x * W).toFixed(1)}
                        y1={(noseTip.y * H).toFixed(1)}
                        x2={(chinTip.x * W).toFixed(1)}
                        y2={(chinTip.y * H).toFixed(1)}
                        stroke={isReady ? '#10b981' : '#f59e0b'}
                        strokeWidth="2.5"
                        strokeDasharray={isReady ? 'none' : '5,4'}
                      />
                      <circle
                        cx={(noseTip.x * W).toFixed(1)}
                        cy={(noseTip.y * H).toFixed(1)}
                        r="4.5"
                        fill={isReady ? '#10b981' : '#f59e0b'}
                      />
                      <circle
                        cx={(chinTip.x * W).toFixed(1)}
                        cy={(chinTip.y * H).toFixed(1)}
                        r="4.5"
                        fill={isReady ? '#10b981' : '#f59e0b'}
                      />
                      {showLabels && (
                        <LabelPill
                          x={isRightProfile ? (noseTip.x * W + 15) : (noseTip.x * W - 15)}
                          y={((noseTip.y + chinTip.y) / 2 * H)}
                          text="RICKETTS E-LINE"
                          subtext="Esthetic Plane (Pn-Pog)"
                          align={isRightProfile ? 'start' : 'end'}
                          baseColor={isReady ? '#10b981' : '#f59e0b'}
                          fontSize={11}
                        />
                      )}
                    </g>
                  )}

                  {/* 2. Frankfort Horizontal (FH) Plane (Tragus/Porion to Orbitale/Subnasale level) */}
                  {tragus && (
                    <g>
                      <line
                        x1={((tragus.x + (isRightProfile ? 0.04 : -0.04)) * W).toFixed(1)}
                        y1={(tragus.y * H).toFixed(1)}
                        x2={((isRightProfile ? 0.95 : 0.05) * W).toFixed(1)}
                        y2={(tragus.y * H).toFixed(1)}
                        stroke="rgba(56, 189, 248, 0.75)"
                        strokeWidth="1.8"
                        strokeDasharray="8,6"
                      />
                      <circle
                        cx={(tragus.x * W).toFixed(1)}
                        cy={(tragus.y * H).toFixed(1)}
                        r="4"
                        fill="#38bdf8"
                      />
                      {showLabels && (
                        <LabelPill
                          x={(tragus.x * W)}
                          y={(tragus.y * H - 8)}
                          text="FH PLANE"
                          subtext="Porion-Orbitale"
                          align={isRightProfile ? 'start' : 'end'}
                          baseColor="#38bdf8"
                          fontSize={11}
                        />
                      )}
                    </g>
                  )}

                  {/* 3. Mandibular Plane (Go-Me: Lower Border of Mandible) */}
                  {gonion && menton && (
                    <g>
                      <line
                        x1={(gonion.x * W).toFixed(1)}
                        y1={(gonion.y * H).toFixed(1)}
                        x2={(menton.x * W).toFixed(1)}
                        y2={(menton.y * H).toFixed(1)}
                        stroke={isReady ? '#10b981' : '#06b6d4'}
                        strokeWidth="3"
                      />
                      {/* Gonion Node */}
                      <circle
                        cx={(gonion.x * W).toFixed(1)}
                        cy={(gonion.y * H).toFixed(1)}
                        r="5"
                        fill={isReady ? '#10b981' : '#06b6d4'}
                      />
                      {/* Menton Node */}
                      <circle
                        cx={(menton.x * W).toFixed(1)}
                        cy={(menton.y * H).toFixed(1)}
                        r="5"
                        fill={isReady ? '#10b981' : '#06b6d4'}
                      />
                      {showLabels && (
                        <LabelPill
                          x={((gonion.x + menton.x) / 2 * W)}
                          y={((gonion.y + menton.y) / 2 * H + 24)}
                          text="MANDIBULAR PLANE"
                          subtext="Gonion (Go) - Menton (Me)"
                          align="middle"
                          baseColor={isReady ? '#10b981' : '#06b6d4'}
                          fontSize={11}
                        />
                      )}
                    </g>
                  )}

                  {/* 4. Real-Time FMA Angle HUD Badge */}
                  {fmaDeg !== null && (
                    <g transform={`translate(${(0.5 * W).toFixed(1)}, ${(0.14 * H).toFixed(1)})`}>
                      <rect
                        x="-135"
                        y="-16"
                        width="270"
                        height="34"
                        rx="17"
                        fill="#080c14"
                        fillOpacity={0.92}
                        stroke={biotypeColor}
                        strokeWidth={1.5}
                      />
                      <circle
                        cx={-112}
                        cy={1}
                        r="5"
                        fill={biotypeColor}
                      />
                      <text
                        x={-96}
                        y={5}
                        fill={biotypeColor}
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {`FMA: ${fmaDeg}° • ${facialBiotype}`}
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Dynamic 45° Angle Alignment Gauge for Oblique Views */}
            {view.id.includes('OBLIQUE') && (
              <g transform={`translate(${(0.5 * W).toFixed(1)}, ${(0.22 * H).toFixed(1)})`}>
                <rect
                  x="-105"
                  y="-16"
                  width="210"
                  height="32"
                  rx="16"
                  fill="#080c14"
                  fillOpacity={0.88}
                  stroke={isYawAligned ? '#10b981' : '#06b6d4'}
                  strokeWidth={1.5}
                />
                <circle
                  cx={-75}
                  cy={0}
                  r={5}
                  fill={isYawAligned ? '#10b981' : '#f59e0b'}
                />
                <text
                  x={-60}
                  y={4}
                  fill={isYawAligned ? '#10b981' : '#e2e8f0'}
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {isYawAligned ? '45° ANGLE ALIGNED ✓' : `ROTATION: ${Math.abs(currentYaw).toFixed(1)}° / 45°`}
                </text>
              </g>
            )}

          </svg>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. Z-40: ALIGNMENT & CORRECTION DIRECTIVE HUD PILL                */}
      {/* ================================================================= */}
      <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center gap-2 transition-all duration-200 w-max max-w-[90%]">
        {/* Compact Spirit Level Indicator */}
        {!isIntraoral && Math.abs(rollAngle) > 0.5 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/85 border border-slate-700/80 backdrop-blur-md shadow-md">
            <div className="w-14 h-2 rounded-full bg-slate-800 relative overflow-hidden border border-slate-700/80">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-slate-500" />
              <div
                className={`absolute top-0 bottom-0 w-2.5 rounded-full transition-all duration-100 ${
                  Math.abs(rollAngle) <= 3.5 ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{
                  left: `calc(50% + ${Math.max(-20, Math.min(20, -rollAngle * 2.8))}px - 5px)`,
                }}
              />
            </div>
            <span className={`text-[10px] font-mono font-bold ${
              Math.abs(rollAngle) <= 3.5 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {Math.abs(rollAngle) <= 3.5 ? '0° LEVEL' : `${rollAngle > 0 ? '+' : ''}${rollAngle.toFixed(1)}°`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const OrthodonticOverlayCanvas = React.memo(OrthodonticOverlayCanvasComponent);
