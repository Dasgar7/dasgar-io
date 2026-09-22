// Rank / Level Color Calculation and Transition Utilities

export interface StarStyleInfo {
  fill: string;
  stroke: string;
  text: string;
  shadowColor: string;
  isOutlineOnly: boolean;
  rgb: [number, number, number];
  gradientCss: string;
}

interface ColorStop {
  level: number;
  rgb: [number, number, number];
}

// Color stops matching exact level requirements
const COLOR_STOPS: ColorStop[] = [
  { level: 1, rgb: [244, 114, 182] },    // Pink (#f472b6)
  { level: 7, rgb: [136, 19, 55] },     // Dark Red (#881337)
  { level: 15, rgb: [234, 179, 8] },    // Yellow (#eab308)
  { level: 23, rgb: [147, 51, 234] },   // Purple (#9333ea)
  { level: 27, rgb: [37, 99, 235] },    // Blue (#2563eb)
  { level: 35, rgb: [249, 115, 22] },   // Orange (#f97316)
  { level: 41, rgb: [6, 182, 212] },    // Teal/Cyan (#06b6d4)
  { level: 48, rgb: [34, 197, 94] },    // Neon Green (#22c55e)
  { level: 55, rgb: [128, 0, 32] },     // Maroon (#800020)
  { level: 62, rgb: [250, 128, 114] },  // Salmon (#fa8072)
  { level: 67, rgb: [238, 220, 130] },  // Flax (#eedc82)
  { level: 73, rgb: [97, 64, 81] },     // Eggplant (#614051)
  { level: 79, rgb: [210, 180, 140] },  // Tan (#d2b48c)
  { level: 84, rgb: [128, 128, 128] },  // Gray (#808080)
  { level: 90, rgb: [64, 64, 64] },     // Darker Gray (#404040)
  { level: 100, rgb: [15, 15, 15] }     // Black (#0f0f0f)
];

function interpolateRgb(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

export function getStarStyleForLevel(level: number): StarStyleInfo {
  // Level 0: blank/empty star outline only (no fill color)
  if (level <= 0) {
    return {
      fill: 'transparent',
      stroke: '#94a3b8', // slate-400 clean outline
      text: '#94a3b8',
      shadowColor: 'rgba(148, 163, 184, 0.2)',
      isOutlineOnly: true,
      rgb: [148, 163, 184],
      gradientCss: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
    };
  }

  // Exact clamp at max level
  if (level >= 100) {
    return {
      fill: 'rgb(15, 15, 15)',
      stroke: '#000000',
      text: '#ffffff',
      shadowColor: 'rgba(0, 0, 0, 0.7)',
      isOutlineOnly: false,
      rgb: [15, 15, 15],
      gradientCss: 'linear-gradient(135deg, #262626, #0a0a0a)'
    };
  }

  // Find surrounding color stops
  let startStop = COLOR_STOPS[0];
  let endStop = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (level >= COLOR_STOPS[i].level && level <= COLOR_STOPS[i + 1].level) {
      startStop = COLOR_STOPS[i];
      endStop = COLOR_STOPS[i + 1];
      break;
    }
  }

  const range = endStop.level - startStop.level;
  const t = range > 0 ? Math.max(0, Math.min(1, (level - startStop.level) / range)) : 0;
  const rgb = interpolateRgb(startStop.rgb, endStop.rgb, t);

  const fill = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  
  // Calculate darker stroke for high contrast crisp outline
  const strokeR = Math.max(0, Math.round(rgb[0] * 0.7));
  const strokeG = Math.max(0, Math.round(rgb[1] * 0.7));
  const strokeB = Math.max(0, Math.round(rgb[2] * 0.7));
  const stroke = `rgb(${strokeR}, ${strokeG}, ${strokeB})`;

  // Calculate brighter highlight for gradient
  const brightR = Math.min(255, Math.round(rgb[0] * 1.25 + 20));
  const brightG = Math.min(255, Math.round(rgb[1] * 1.25 + 20));
  const brightB = Math.min(255, Math.round(rgb[2] * 1.25 + 20));

  const gradientCss = `linear-gradient(135deg, rgb(${brightR}, ${brightG}, ${brightB}), rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}))`;
  const shadowColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.45)`;

  // High contrast text determination
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  const text = luminance > 0.65 ? '#1e293b' : '#ffffff';

  return {
    fill,
    stroke,
    text,
    shadowColor,
    isOutlineOnly: false,
    rgb,
    gradientCss
  };
}
