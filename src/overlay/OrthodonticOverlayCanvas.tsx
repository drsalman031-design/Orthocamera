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
      {/* 1. Z-20: ORTHODONTIC CLINICAL OVERLAY GUIDELINES (Transparent)    */}
      {/* ================================================================= */}
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
        {/* 1. FRONTAL — REST (Extraoral Facial Symmetry & Lip Repose)               */}
        {/* ========================================================================= */}
        {view.id === 'FRONTAL_REST' && (
          <g>
            {/* Outer Facial Oval Envelope */}
            <ellipse
              cx="500"
              cy="740"
              rx="280"
              ry="380"
              fill="none"
              stroke={baseColor}
              strokeWidth="2.5"
              strokeDasharray="10,6"
            />

            {/* Vertical Facial Midline (Trichion - Glabella - Subnasale - Gnathion) */}
            <line
              x1="500"
              y1="340"
              x2="500"
              y2="1180"
              stroke={baseColor}
              strokeWidth="2"
              strokeDasharray="6,4"
            />
            <LabelPill
              x={500}
              y={370}
              text="FACIAL MIDLINE"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Interpupillary / Eye-Level Horizontal Plane */}
            <line x1="220" y1="650" x2="780" y2="650" stroke={baseColor} strokeWidth="2" />
            <circle cx="370" cy="650" r="18" fill="none" stroke={baseColor} strokeWidth="1.5" />
            <circle cx="630" cy="650" r="18" fill="none" stroke={baseColor} strokeWidth="1.5" />
            <LabelPill
              x={780}
              y={656}
              text="INTERPUPILLARY PLANE"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Subnasale Horizontal Plane (Vertical Thirds) */}
            <line
              x1="360"
              y1="800"
              x2="640"
              y2="800"
              stroke={baseColor}
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <LabelPill
              x={645}
              y={806}
              text="SUBNASALE"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Resting Lip Stomion Reference (Lips in Repose, 2-3mm Incisal Show) */}
            <path d="M 410 880 Q 500 885 590 880" fill="none" stroke={baseColor} strokeWidth="2.5" />
            <LabelPill
              x={500}
              y={920}
              text="LIP REPOSE"
              subtext="2-3mm Incisal Show"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Chin / Soft Tissue Gnathion */}
            <path d="M 450 1100 Q 500 1130 550 1100" fill="none" stroke={baseColor} strokeWidth="2" />
          </g>
        )}

        {/* ========================================================================= */}
        {/* 2. FRONTAL — SMILE (Smile Arc, Buccal Corridors, Gingival Display)       */}
        {/* ========================================================================= */}
        {view.id === 'FRONTAL_SMILE' && (
          <g>
            {/* Facial Oval Outline */}
            <ellipse
              cx="500"
              cy="740"
              rx="280"
              ry="380"
              fill="none"
              stroke={baseColor}
              strokeWidth="2"
              strokeDasharray="8,6"
              opacity="0.8"
            />

            {/* Vertical Facial Midline */}
            <line
              x1="500"
              y1="340"
              x2="500"
              y2="1180"
              stroke={baseColor}
              strokeWidth="2"
              strokeDasharray="5,4"
            />

            {/* Eye Level Line */}
            <line x1="240" y1="650" x2="760" y2="650" stroke={baseColor} strokeWidth="1.5" />
            <circle cx="370" cy="650" r="16" fill="none" stroke={baseColor} strokeWidth="1.5" />
            <circle cx="630" cy="650" r="16" fill="none" stroke={baseColor} strokeWidth="1.5" />

            {/* Smile Region Guide Box */}
            <rect
              x="320"
              y="820"
              width="360"
              height="160"
              rx="24"
              fill="url(#smileGlow)"
              stroke={baseColor}
              strokeWidth="2"
              strokeDasharray="6,4"
            />

            {/* Smile Arc Curve (Incisal curve consonant with lower lip) */}
            <path d="M 350 880 Q 500 950 650 880" fill="none" stroke={baseColor} strokeWidth="3.5" />
            {/* Upper Lip Contour */}
            <path
              d="M 370 860 Q 450 840 500 852 Q 550 840 630 860"
              fill="none"
              stroke={baseColor}
              strokeWidth="1.8"
            />

            {/* Bilateral Buccal Corridor Markers */}
            <line x1="350" y1="855" x2="350" y2="905" stroke={baseColor} strokeWidth="2.5" />
            <line x1="650" y1="855" x2="650" y2="905" stroke={baseColor} strokeWidth="2.5" />

            <LabelPill
              x={500}
              y={1020}
              text="SMILE ARC & BUCCAL CORRIDORS"
              subtext="0-2mm Gingival Display"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />
          </g>
        )}

        {/* ========================================================================= */}
        {/* 3. RIGHT PROFILE (Frankfort Plane, True Vertical Line, E-Line, Sagittal) */}
        {/* ========================================================================= */}
        {view.id === 'RIGHT_PROFILE' && (
          <g>
            {/* Anatomical Soft Tissue Profile Silhouette (Facing Right) */}
            <path
              d="M 380 380 
                 C 440 380, 510 440, 520 520 
                 C 520 550, 535 600, 580 670 
                 C 592 688, 600 705, 592 720 
                 C 578 735, 558 740, 552 765 
                 C 548 785, 578 810, 572 835 
                 C 566 850, 552 865, 558 880 
                 C 568 900, 588 920, 578 950 
                 C 562 985, 498 1020, 440 1020 
                 C 380 1020, 360 1110, 360 1180"
              fill="none"
              stroke={baseColor}
              strokeWidth="2.8"
              strokeDasharray="8,5"
            />

            {/* 1. Frankfort Horizontal (FH) Plane (Porion/Tragus to Orbitale) */}
            <line x1="240" y1="670" x2="800" y2="670" stroke={baseColor} strokeWidth="2.5" />
            <LabelPill
              x={620}
              y={655}
              text="FRANKFORT PLANE (FH)"
              subtext="Porion — Orbitale (Strict Horizontal)"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* 2. True Vertical Line (TVL / Plumb line passing through Subnasale) */}
            <line
              x1="552"
              y1="340"
              x2="552"
              y2="1220"
              stroke={baseColor}
              strokeWidth="2"
              strokeDasharray="6,4"
              opacity="0.85"
            />
            <LabelPill
              x={552}
              y={380}
              text="TRUE VERTICAL (TVL)"
              subtext="Natural Head Position (NHP)"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* 3. Ricketts E-Line (Pronasale/Nose Tip to Soft Tissue Pogonion/Chin) */}
            <line
              x1="592"
              y1="705"
              x2="578"
              y2="950"
              stroke={baseColor}
              strokeWidth="2"
              strokeDasharray="4,4"
            />
            {/* Ricketts E-Line */}
            <LabelPill
              x={610}
              y={830}
              text="E-LINE"
              subtext="Upper -4mm | Lower -2mm"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Tragus / External Auditory Meatus (Porion Landmark) */}
            <circle cx="340" cy="670" r="18" fill="none" stroke={baseColor} strokeWidth="1.5" />
            <LabelPill
              x={250}
              y={676}
              text="PORION (TRAGUS)"
              align="end"
              baseColor={baseColor}
              showLabels={showLabels}
            />
          </g>
        )}

        {/* ========================================================================= */}
        {/* 4. LEFT PROFILE (Frankfort Plane, True Vertical Plumb Line, E-Line)      */}
        {/* ========================================================================= */}
        {view.id === 'LEFT_PROFILE' && (
          <g>
            {/* Anatomical Left Profile Contour (Facing Left) */}
            <path
              d="M 620 380 
                 C 560 380, 490 440, 480 520 
                 C 480 550, 465 600, 420 670 
                 C 408 688, 400 705, 408 720 
                 C 422 735, 442 740, 448 765 
                 C 452 785, 422 810, 428 835 
                 C 434 850, 448 865, 442 880 
                 C 432 900, 412 920, 422 950 
                 C 438 985, 502 1020, 560 1020 
                 C 620 1020, 640 1110, 640 1180"
              fill="none"
              stroke={baseColor}
              strokeWidth="2.8"
              strokeDasharray="8,5"
            />

            {/* 1. Frankfort Horizontal Plane */}
            <line x1="200" y1="670" x2="760" y2="670" stroke={baseColor} strokeWidth="2.5" />
            <LabelPill
              x={380}
              y={655}
              text="FRANKFORT PLANE (FH)"
              subtext="Porion — Orbitale (Horizontal)"
              align="end"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* 2. True Vertical Line (TVL / Plumb Line through Subnasale) */}
            <line
              x1="448"
              y1="340"
              x2="448"
              y2="1220"
              stroke={baseColor}
              strokeWidth="2"
              strokeDasharray="6,4"
              opacity="0.85"
            />
            <LabelPill
              x={448}
              y={380}
              text="TRUE VERTICAL (TVL)"
              subtext="Natural Head Position (NHP)"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* 3. Ricketts E-Line (Tip of Nose to Pogonion) */}
            <line
              x1="408"
              y1="705"
              x2="422"
              y2="950"
              stroke={baseColor}
              strokeWidth="2"
              strokeDasharray="4,4"
            />
            {/* Ricketts E-Line */}
            <LabelPill
              x={390}
              y={830}
              text="E-LINE"
              subtext="Upper -4mm | Lower -2mm"
              align="end"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Tragus / Porion */}
            <circle cx="660" cy="670" r="18" fill="none" stroke={baseColor} strokeWidth="1.5" />
            <LabelPill
              x={750}
              y={676}
              text="PORION (TRAGUS)"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />
          </g>
        )}

        {/* ========================================================================= */}
        {/* 5. RIGHT OBLIQUE (Dynamic Malar Contour & Sensor-Linked 45° Leveler)     */}
        {/* ========================================================================= */}
        {view.id === 'RIGHT_OBLIQUE' && (
          <g>
            {/* Dynamic Malar (Zygomatic) Prominence Contour & Smile Tangency */}
            <path
              d="M 440 370 
                 C 530 370, 610 450, 630 560 
                 C 640 620, 648 690, 620 760 
                 C 600 810, 570 890, 520 980 
                 C 460 1030, 370 1010, 340 930 
                 C 310 850, 330 640, 350 520 Z"
              fill="none"
              stroke={baseColor}
              strokeWidth="2.2"
              strokeDasharray="8,6"
              opacity="0.75"
            />

            {/* Ipsilateral Malar Apex Highlight Curve */}
            <path
              d="M 590 600 Q 625 670 605 740"
              fill="none"
              stroke={baseColor}
              strokeWidth="3.5"
            />
            <LabelPill
              x={635}
              y={670}
              text="MALAR PROMINENCE"
              subtext="Nose Tangent to Cheek"
              align="start"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* 45° 3/4 Smile Arc */}
            <path d="M 390 860 Q 490 910 570 840" fill="none" stroke={baseColor} strokeWidth="3" />
            <LabelPill
              x={500}
              y={945}
              text="45° OBLIQUE SMILE ARC"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Interactive 45° Angle Sensor Gauge */}
            <g transform="translate(500, 1160)">
              <rect
                x="-120"
                y="-18"
                width="240"
                height="36"
                rx="18"
                fill="#080c14"
                fillOpacity={0.92}
                stroke={isYawAligned ? '#10b981' : '#06b6d4'}
                strokeWidth={1.5}
              />
              <circle
                cx={-85}
                cy={0}
                r={6}
                fill={isYawAligned ? '#10b981' : '#f59e0b'}
                className={isYawAligned ? 'animate-pulse' : ''}
              />
              <text
                x={-68}
                y={5}
                fill={isYawAligned ? '#10b981' : '#e2e8f0'}
                fontSize="12"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {isYawAligned ? '45° ANGLE ALIGNED' : `ROTATION: ${(currentYaw || 43).toFixed(1)}° / 45°`}
              </text>
            </g>
          </g>
        )}

        {/* ========================================================================= */}
        {/* 6. LEFT OBLIQUE (Dynamic Malar Contour & Sensor-Linked 45° Leveler)      */}
        {/* ========================================================================= */}
        {view.id === 'LEFT_OBLIQUE' && (
          <g>
            {/* Dynamic Left Malar Head Contour */}
            <path
              d="M 560 370 
                 C 470 370, 390 450, 370 560 
                 C 360 620, 352 690, 380 760 
                 C 400 810, 430 890, 480 980 
                 C 540 1030, 630 1010, 660 930 
                 C 690 850, 670 640, 650 520 Z"
              fill="none"
              stroke={baseColor}
              strokeWidth="2.2"
              strokeDasharray="8,6"
              opacity="0.75"
            />

            {/* Left Malar Apex Highlight Curve */}
            <path
              d="M 410 600 Q 375 670 395 740"
              fill="none"
              stroke={baseColor}
              strokeWidth="3.5"
            />
            <LabelPill
              x={365}
              y={670}
              text="LEFT MALAR PROMINENCE"
              subtext="Nose Tangent to Cheek"
              align="end"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* 45° 3/4 Left Smile Arc */}
            <path d="M 610 860 Q 510 910 430 840" fill="none" stroke={baseColor} strokeWidth="3" />
            <LabelPill
              x={500}
              y={945}
              text="45° OBLIQUE SMILE ARC"
              align="middle"
              baseColor={baseColor}
              showLabels={showLabels}
            />

            {/* Interactive 45° Angle Sensor Gauge */}
            <g transform="translate(500, 1160)">
              <rect
                x="-120"
                y="-18"
                width="240"
                height="36"
                rx="18"
                fill="#080c14"
                fillOpacity={0.92}
                stroke={isYawAligned ? '#10b981' : '#06b6d4'}
                strokeWidth={1.5}
              />
              <circle
                cx={-85}
                cy={0}
                r={6}
                fill={isYawAligned ? '#10b981' : '#f59e0b'}
                className={isYawAligned ? 'animate-pulse' : ''}
              />
              <text
                x={-68}
                y={5}
                fill={isYawAligned ? '#10b981' : '#e2e8f0'}
                fontSize="12"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {isYawAligned ? '45° ANGLE ALIGNED' : `ROTATION: ${(Math.abs(currentYaw) || 44).toFixed(1)}° / 45°`}
              </text>
            </g>
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

            {/* Dynamic Ricketts E-Line for Profile Views */}
            {view.id.includes('PROFILE') && guidance.detectedFaceLandmarks?.noseTip && guidance.detectedFaceLandmarks?.chinTip && (
              <g>
                <line
                  x1={(guidance.detectedFaceLandmarks.noseTip.x * W).toFixed(1)}
                  y1={(guidance.detectedFaceLandmarks.noseTip.y * H).toFixed(1)}
                  x2={(guidance.detectedFaceLandmarks.chinTip.x * W).toFixed(1)}
                  y2={(guidance.detectedFaceLandmarks.chinTip.y * H).toFixed(1)}
                  stroke={isReady ? '#10b981' : '#f59e0b'}
                  strokeWidth="2.5"
                  strokeDasharray={isReady ? 'none' : '5,4'}
                />
                <circle
                  cx={(guidance.detectedFaceLandmarks.noseTip.x * W).toFixed(1)}
                  cy={(guidance.detectedFaceLandmarks.noseTip.y * H).toFixed(1)}
                  r="5"
                  fill={isReady ? '#10b981' : '#f59e0b'}
                />
                <circle
                  cx={(guidance.detectedFaceLandmarks.chinTip.x * W).toFixed(1)}
                  cy={(guidance.detectedFaceLandmarks.chinTip.y * H).toFixed(1)}
                  r="5"
                  fill={isReady ? '#10b981' : '#f59e0b'}
                />
              </g>
            )}

            {/* Non-intrusive bottom spirit level gauge */}
            {!isIntraoral && (
              <g transform={`translate(${(0.5 * W).toFixed(1)}, ${(H - 120).toFixed(1)})`}>
                <rect
                  x="-50"
                  y="-8"
                  width="100"
                  height="16"
                  rx="8"
                  fill="#080c14"
                  fillOpacity={0.85}
                  stroke={Math.abs(rollAngle) <= 3.5 ? '#10b981' : '#f59e0b'}
                  strokeWidth={1.2}
                />
                <line x1="-8" y1="-8" x2="-8" y2="8" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <line x1="8" y1="-8" x2="8" y2="8" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <circle
                  cx={Math.max(-40, Math.min(40, -rollAngle * 6))}
                  cy="0"
                  r="5.5"
                  fill={Math.abs(rollAngle) <= 3.5 ? '#10b981' : '#f59e0b'}
                  style={{ transition: 'cx 80ms ease-out' }}
                />
                <text
                  x="0"
                  y="20"
                  fill="#94a3b8"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {Math.abs(rollAngle) <= 3.5 ? 'LEVEL' : `${rollAngle > 0 ? '+' : ''}${rollAngle.toFixed(1)}°`}
                </text>
              </g>
            )}
          </svg>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. Z-40: ALIGNMENT & CORRECTION DIRECTIVE HUD PILL                */}
      {/* ================================================================= */}
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center gap-1.5 transition-all duration-200">
        {isReady ? (
          <div className="flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500/90 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 backdrop-blur-md animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>READY — HOLD STILL</span>
          </div>
        ) : guidance.primaryMessage ? (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/85 border border-amber-500/40 text-amber-300 font-bold text-xs uppercase tracking-wide shadow-lg backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>{guidance.primaryMessage}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const OrthodonticOverlayCanvas = React.memo(OrthodonticOverlayCanvasComponent);
