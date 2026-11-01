import React, { useEffect, useRef, useState } from 'react';
import { Target, Zap, Play, Pause, RotateCcw, Home, HelpCircle, Smile, ListOrdered, Sliders, MessageCircle, Send } from 'lucide-react';
import { TouchSafeButton } from './TouchSafeButton';
import { PRESET_SKINS, SkinItem, BOT_SKIN_ITEMS, BOT_NAME_POOL, BOT_COLOR_POOL } from '../data/skinsData';

interface GameScreenProps {
  onBack: () => void;
  mode?: 'classic' | 'bots' | 'instantMerge';
}

// Game Constants
const MAP_SIZE = 3000;
const INITIAL_RADIUS = 20;
const BASE_PLAYER_SPEED = 1.6;
const SPEED_SCALE = 0.439;
const DEBUG_FORCE_PHONE_ZOOM = false;
const DEBUG_PLAYER_SPAWN_SCORE: number | null = null;
const PLAYER_START_RADIUS = DEBUG_PLAYER_SPAWN_SCORE != null
  ? Math.sqrt(DEBUG_PLAYER_SPAWN_SCORE * 10)
  : INITIAL_RADIUS;
const PLAYER_START_SCORE = DEBUG_PLAYER_SPAWN_SCORE != null
  ? DEBUG_PLAYER_SPAWN_SCORE
  : Math.floor((INITIAL_RADIUS * INITIAL_RADIUS) / 10);
const FOOD_COUNT = 700;
const NORMAL_FOOD_RADIUS = 4.5;
const EJECTED_MASS_RADIUS = 12;
const EJECTED_MASS_VALUE = 32;
const GHOST_TOKEN_TARGET_COUNT = 35;
const GHOST_TOKEN_RADIUS = 10;
const GHOST_TOKEN_MASS = 3.5;
const STORAGE_KEY_GHOST_TOKEN = 'dasgar_ghostTokenCount';
const STORAGE_KEY_GREEN_CANDY = 'dasgar_greenCandyCount';
const BOT_COUNT = 15;
const VIRUS_COUNT = 20;
const VIRUS_RADIUS = 48;

// Shared bot skin preloading cache (shared across all bots)
const sharedBotSkinImages = new Map<string, HTMLImageElement>();
export function getSharedSkinImage(skinId: string, svgUrl: string): HTMLImageElement {
  let img = sharedBotSkinImages.get(skinId);
  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = svgUrl;
    sharedBotSkinImages.set(skinId, img);
  }
  return img;
}

// Color parsing & cached shading for jelly cells (darker border, soft inner radial gradient, thin rim)
const darkerColorCache = new Map<string, string>();
const lighterColorCache = new Map<string, string>();

function parseColorToRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      return [parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)];
    }
  }
  if (color.startsWith('hsl')) {
    const m = color.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
    if (m) {
      const h = parseFloat(m[1]) / 360;
      const s = parseFloat(m[2]) / 100;
      const l = parseFloat(m[3]) / 100;
      if (s === 0) {
        const val = Math.round(l * 255);
        return [val, val, val];
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      return [
        Math.round(hue2rgb(h + 1 / 3) * 255),
        Math.round(hue2rgb(h) * 255),
        Math.round(hue2rgb(h - 1 / 3) * 255)
      ];
    }
  }
  return [40, 140, 240];
}

export function getDarkerColor(color: string, factor: number = 0.35): string {
  const key = `${color}_${factor.toFixed(2)}`;
  let cached = darkerColorCache.get(key);
  if (cached) return cached;
  const [r, g, b] = parseColorToRgb(color);
  const dr = Math.max(0, Math.round(r * (1 - factor)));
  const dg = Math.max(0, Math.round(g * (1 - factor)));
  const db = Math.max(0, Math.round(b * (1 - factor)));
  cached = `rgb(${dr},${dg},${db})`;
  darkerColorCache.set(key, cached);
  return cached;
}

export function getLighterColor(color: string, factor: number = 0.28): string {
  const key = `${color}_${factor.toFixed(2)}`;
  let cached = lighterColorCache.get(key);
  if (cached) return cached;
  const [r, g, b] = parseColorToRgb(color);
  const lr = Math.min(255, Math.round(r + (255 - r) * factor));
  const lg = Math.min(255, Math.round(g + (255 - g) * factor));
  const lb = Math.min(255, Math.round(b + (255 - b) * factor));
  cached = `rgb(${lr},${lg},${lb})`;
  lighterColorCache.set(key, cached);
  return cached;
}

// Bot Personalities
export type BotPersonality = 'aggressive' | 'cautious' | 'farmer';

export interface BotProfile {
  name: string;
  color: string;
  personality: BotPersonality;
  skill: number;
}

// Soft-Body Jelly Physics: 48-point spring-damper membrane vertices with spring pulse
export type SoftBodyJelly = {
  dr: Float32Array; // 48 radial offset deviations from circle
  vr: Float32Array; // 48 radial velocities
  pulse: number;    // spring scale pulse (1 -> 1.05 -> 1 on eat)
  pulseVel: number;
  pulseTarget: number;
  ripplePhase: number;
  rippleAmp: number;
  lastVx: number;   // velocity at previous physics step for acceleration detection
  lastVy: number;
};

export function createCellJelly(): SoftBodyJelly {
  return {
    dr: new Float32Array(48),
    vr: new Float32Array(48),
    pulse: 1.0,
    pulseVel: 0,
    pulseTarget: 1.0,
    ripplePhase: 0,
    rippleAmp: 0,
    lastVx: 0,
    lastVy: 0
  };
}

export function applySplitRecoil(jelly: SoftBodyJelly | undefined, dirX: number, dirY: number) {
  if (!jelly) return;
  const N = 48;
  const step = (Math.PI * 2) / N;
  const recoilAngle = Math.atan2(-dirY, -dirX);
  for (let i = 0; i < N; i++) {
    const angle = i * step;
    const cos = Math.cos(angle - recoilAngle);
    if (cos > 0) {
      jelly.vr[i] += cos * cos * 1.5;
    }
  }
  jelly.pulseTarget = 1.04;
}

export function applySplitLaunch(jelly: SoftBodyJelly | undefined, dirX: number, dirY: number) {
  if (!jelly) return;
  const N = 48;
  const step = (Math.PI * 2) / N;
  const launchAngle = Math.atan2(dirY, dirX);
  for (let i = 0; i < N; i++) {
    const angle = i * step;
    const cos = Math.cos(angle - launchAngle);
    if (cos > 0) {
      jelly.vr[i] += cos * cos * 2.0;
    } else {
      const sin = Math.sin(angle - launchAngle);
      jelly.vr[i] -= sin * sin * 0.8;
    }
  }
  jelly.pulseTarget = 1.04;
}

// Scratch buffers for Catmull-Rom bezier curve computation (zero allocation during render loop)
const scratchCurveX = new Float32Array(48);
const scratchCurveY = new Float32Array(48);

// Pre-allocated Eating Animation pool (prey pulled toward predator center while shrinking and fading)
export interface EatingAnim {
  active: boolean;
  startX: number;
  startY: number;
  predatorCell: { x: number; y: number; renderX?: number; renderY?: number; radius: number } | null;
  radius: number;
  initialRadius: number;
  color: string;
  timeStart: number;
  duration: number;
}
const EATING_POOL_SIZE = 64;

// Pre-allocated Pellet Pop Particle pool
export interface PelletPopAnim {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  timeStart: number;
  duration: number;
}
const POP_POOL_SIZE = 64;

// Spatial Hashing Grid: Pre-allocated typed arrays for zero-allocation pellet queries on mobile
const GRID_CELL_SIZE = 250;
const GRID_COLS = 12; // 3000 / 250
const GRID_ROWS = 12;
const GRID_TOTAL_CELLS = 144;
const foodGridHead = new Int32Array(GRID_TOTAL_CELLS);
const foodGridNext = new Int32Array(1600);
const foodGridCount = new Int32Array(GRID_TOTAL_CELLS);
const foodGridSumX = new Float32Array(GRID_TOTAL_CELLS);
const foodGridSumY = new Float32Array(GRID_TOTAL_CELLS);

// Zero-allocation distance from point (px, py) to line segment (x1, y1)-(x2, y2)
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Types
type Vector2 = { x: number; y: number };
type Circle = { id: string; x: number; y: number; radius: number; color: string };
type PlayerCell = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  moveVx?: number;
  moveVy?: number;
  radius: number;
  splitTime: number;
  renderX?: number;
  renderY?: number;
  renderRadius?: number;
  phaseOffset?: number;
  ignoreParentId?: string;
  ignoreParentUntil?: number;
  jelly?: SoftBodyJelly;
};
export type BotCell = Circle & {
  vx: number;
  vy: number;
  moveVx?: number;
  moveVy?: number;
  splitTime: number;
  renderX?: number;
  renderY?: number;
  renderRadius?: number;
  phaseOffset?: number;
  ignoreParentId?: string;
  ignoreParentUntil?: number;
  name: string;
  skinId?: string;
  skinImg?: HTMLImageElement;
  jelly?: SoftBodyJelly;
};
export type BotPlayer = Circle & {
  botIndex: number;
  name: string;
  color: string;
  skinId?: string;
  skinImg?: HTMLImageElement;
  personality: BotPersonality;
  skill: number;
  targetX: number;
  targetY: number;
  speed: number;
  vx: number;
  vy: number;
  lastDecisionTime: number;
  decisionInterval: number;
  aimErrorAngle: number;
  nextMistakeTime: number;
  mistakeActiveUntil: number;
  lastSplitTime: number;
  lastEjectTime: number;
  fleeing: boolean;
  chasing: boolean;
  cells: BotCell[];
  renderX?: number;
  renderY?: number;
  renderRadius?: number;
  phaseOffset?: number;
};
type GhostToken = {
  id: string;
  x: number;
  y: number;
  radius: number;
  pulsePhase?: number;
  eaten?: boolean;
};
type GreenCandy = GhostToken;
type Food = Circle & {
  vx?: number;
  vy?: number;
  decay?: number;
  mass?: number;
  renderX?: number;
  renderY?: number;
  eaten?: boolean;
  canBeEatenAfter?: number;
  ownerCellId?: string;
};
type Virus = Circle & {
  fedCount?: number;
  vx?: number;
  vy?: number;
};

const generateId = () => Math.random().toString(36).substr(2, 9);
const randomColor = () => `hsl(${Math.random() * 360}, 80%, 60%)`;

// Persistent life-cycle identity drawer avoiding arena duplicates:
// ~40% have a preset animal skin (max 2 of any skin across active bots)
// ~30% have NO name at all ("")
// ~70% have a unique gamer tag from BOT_NAME_POOL
function drawBotIdentity(
  existingBots: BotPlayer[],
  slotIndex: number
): {
  name: string;
  color: string;
  personality: BotPersonality;
  skill: number;
  skinId?: string;
  skinImg?: HTMLImageElement;
} {
  const activeNames = new Set<string>();
  const skinCounts = new Map<string, number>();

  for (let i = 0; i < existingBots.length; i++) {
    const b = existingBots[i];
    if (b && b.cells && b.cells.length > 0) {
      if (b.name) activeNames.add(b.name);
      if (b.skinId) {
        skinCounts.set(b.skinId, (skinCounts.get(b.skinId) || 0) + 1);
      }
    }
  }

  // 1. Name: 30% anonymous (""), 70% unique from pool
  let name = '';
  if (Math.random() >= 0.30) {
    const available = BOT_NAME_POOL.filter(n => !activeNames.has(n));
    if (available.length > 0) {
      name = available[Math.floor(Math.random() * available.length)];
    } else {
      name = BOT_NAME_POOL[(slotIndex + Math.floor(Math.random() * BOT_NAME_POOL.length)) % BOT_NAME_POOL.length];
    }
  }

  // 2. Skin: ~40% preset skin, max 2 of same skin in arena
  let skinId: string | undefined;
  let skinImg: HTMLImageElement | undefined;
  if (Math.random() < 0.40) {
    const eligibleSkins = BOT_SKIN_ITEMS.filter(s => (skinCounts.get(s.id) || 0) < 2);
    if (eligibleSkins.length > 0) {
      const chosen = eligibleSkins[Math.floor(Math.random() * eligibleSkins.length)];
      skinId = chosen.id;
      skinImg = getSharedSkinImage(chosen.id, chosen.svg);
    }
  }

  // 3. Color: from BOT_COLOR_POOL
  const color = BOT_COLOR_POOL[(slotIndex * 3 + Math.floor(Math.random() * BOT_COLOR_POOL.length)) % BOT_COLOR_POOL.length];

  // 4. Personality & skill
  const roll = Math.random();
  const personality: BotPersonality = roll < 0.42 ? 'aggressive' : roll < 0.72 ? 'cautious' : 'farmer';
  const skill = 0.68 + Math.random() * 0.28; // 0.68 - 0.96

  return { name, color, personality, skill, skinId, skinImg };
}

function createBotInstance(botIndex: number, now: number, existingBots: BotPlayer[] = []): BotPlayer {
  const identity = drawBotIdentity(existingBots, botIndex);
  const bx = Math.random() * (MAP_SIZE - 400) + 200;
  const by = Math.random() * (MAP_SIZE - 400) + 200;
  const br = INITIAL_RADIUS + Math.random() * 12;
  const phaseOffset = Math.random() * Math.PI * 2;

  const cell: BotCell = {
    id: generateId(),
    x: bx,
    y: by,
    renderX: bx,
    renderY: by,
    renderRadius: br,
    radius: br,
    vx: 0,
    vy: 0,
    splitTime: now,
    phaseOffset,
    color: identity.color,
    name: identity.name,
    skinId: identity.skinId,
    skinImg: identity.skinImg,
    jelly: createCellJelly()
  };

  return {
    id: generateId(),
    botIndex,
    name: identity.name,
    color: identity.color,
    skinId: identity.skinId,
    skinImg: identity.skinImg,
    personality: identity.personality,
    skill: identity.skill,
    targetX: Math.random() * (MAP_SIZE - 400) + 200,
    targetY: Math.random() * (MAP_SIZE - 400) + 200,
    speed: 1.4,
    vx: 0,
    vy: 0,
    lastDecisionTime: now - Math.random() * 80,
    decisionInterval: Math.round(180 - identity.skill * 100),
    aimErrorAngle: (Math.random() - 0.5) * (1 - identity.skill) * 0.4,
    nextMistakeTime: now + 4000 + Math.random() * 8000,
    mistakeActiveUntil: 0,
    lastSplitTime: now - 3000,
    lastEjectTime: now - 1000,
    fleeing: false,
    chasing: false,
    cells: [cell],
    x: bx,
    y: by,
    radius: br,
    renderX: bx,
    renderY: by,
    renderRadius: br,
    phaseOffset
  };
}


export interface QuickEmojiItem {
  id: string;
  name: string;
  src: string;
}

// Exactly the 3 uploaded custom cell emojis (all others removed)
const QUICK_EMOJIS: QuickEmojiItem[] = [
  { id: 'blue_cool', name: 'Cool Cell', src: '/emojis/blue_cool_cell.png' },
  { id: 'green_happy', name: 'Happy Cell', src: '/emojis/green_happy_cell.png' },
  { id: 'red_angry', name: 'Angry Cell', src: '/emojis/red_angry_cell.png' },
];
const EMOJI_DISPLAY_DURATION = 3500; // ms: ~3.5 seconds

// Action-button metrics for TABLETS and PC (viewport >= 640px)
const TBTN_SIZE = 'clamp(80px, 12vmin, 120px)';
const TBTN_GAP = `calc(${TBTN_SIZE} * 0.16)`;
const TBTN_EDGE_R = `max(22px, calc(env(safe-area-inset-right) + 14px))`;
const TBTN_EDGE_B = `max(22px, calc(env(safe-area-inset-bottom) + 14px))`;

// Action-button metrics for PHONES (viewport < 640px) - compact and non-intrusive for mobile HUD
const PBTN_SIZE = 'clamp(42px, 10vmin, 58px)';
const PBTN_GAP = `calc(${PBTN_SIZE} * 0.14)`;
const PBTN_EDGE_R = `max(10px, env(safe-area-inset-right))`;
const PBTN_EDGE_B = `max(10px, env(safe-area-inset-bottom))`;

const MACRO_FEED_INTERVAL = 85; // ms between feeds when macro is held (default ~12/s)

export function GameScreen({ onBack, mode = 'classic' }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs
  const playerCellsRef = useRef<PlayerCell[]>([
    {
      id: 'main',
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      renderX: MAP_SIZE / 2,
      renderY: MAP_SIZE / 2,
      renderRadius: PLAYER_START_RADIUS,
      vx: 0,
      vy: 0,
      radius: PLAYER_START_RADIUS,
      splitTime: 0,
      phaseOffset: Math.random() * Math.PI * 2,
      jelly: createCellJelly()
    }
  ]);

  const playerNameRef = useRef('You');
  const playerColorRef = useRef('#0284c7');
  const lastAimDirRef = useRef<{ x: number; y: number }>({ x: 0, y: -1 });

  const cameraRef = useRef<{ x: number; y: number }>({
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2
  });

  const playerGroupRef = useRef<{
    centerX: number;
    centerY: number;
    maxRadius: number;
    effectiveRadius: number;
    totalArea: number;
  }>({
    centerX: MAP_SIZE / 2,
    centerY: MAP_SIZE / 2,
    maxRadius: PLAYER_START_RADIUS,
    effectiveRadius: PLAYER_START_RADIUS,
    totalArea: PLAYER_START_RADIUS * PLAYER_START_RADIUS
  });
  
  const checkIsTouchDevice = () => {
    if (typeof window === 'undefined') return false;
    if (DEBUG_FORCE_PHONE_ZOOM) return true;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobileUA) return true;
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isFinePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    // If device has a fine pointer (mouse/trackpad) and is not mobile UA, treat as PC!
    if (isFinePointer) return false;
    return hasTouch;
  };

  const isPhoneRef = useRef<boolean>(checkIsTouchDevice());
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => checkIsTouchDevice());
  const zoomRef = useRef<number>(1.0);
  const physicsAccumulatorRef = useRef<number>(0);

  const autoGatherRef = useRef(false);

  const splitTimersRef = useRef<number[]>([]);
  const macroActiveRef = useRef(false);
  const macroAccumulatorRef = useRef(0);
  const handleEjectRef = useRef<() => void>(() => {});

  const activeEmojiRef = useRef<{ emoji: string; timeLeft: number } | null>(null);
  const emojiImagesRef = useRef<{ [key: string]: HTMLImageElement }>({});
  const leaderboardTimerRef = useRef(0);
  const drawablePoolRef = useRef<{ type: 'player' | 'bot' | 'virus'; entity: any; radius: number }[]>([]);
  
  const foodsRef = useRef<Food[]>([]);
  const ghostTokensRef = useRef<GhostToken[]>([]);
  const ghostTokenImgRef = useRef<HTMLImageElement | null>(null);
  const botsRef = useRef<BotPlayer[]>([]);
  const virusesRef = useRef<Virus[]>([]);
  const scoreRef = useRef(PLAYER_START_SCORE);
  const isGameOverRef = useRef(false);
  const isPausedRef = useRef(false);

  // Soft-Body animation pools and adaptive quality refs
  const eatingPoolRef = useRef<EatingAnim[]>(Array.from({ length: EATING_POOL_SIZE }, () => ({
    active: false,
    startX: 0,
    startY: 0,
    predatorCell: null,
    radius: 0,
    initialRadius: 0,
    color: '#fff',
    timeStart: 0,
    duration: 180
  })));
  const popPoolRef = useRef<PelletPopAnim[]>(Array.from({ length: POP_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 2,
    color: '#fff',
    timeStart: 0,
    duration: 140
  })));
  const qualityRef = useRef<'high' | 'medium' | 'low'>('high');
  const fpsFramesCountRef = useRef(0);
  const fpsWindowStartRef = useRef(performance.now());

  const getInitialGhostTokenCount = (): number => {
    try {
      const val = localStorage.getItem(STORAGE_KEY_GHOST_TOKEN) ?? localStorage.getItem(STORAGE_KEY_GREEN_CANDY);
      if (val !== null) {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
    } catch {
      // localStorage may fail in restricted iframes
    }
    return 0;
  };
  const ghostTokenCountRef = useRef<number>(getInitialGhostTokenCount());
  const [ghostTokenCount, setGhostTokenCount] = useState<number>(() => ghostTokenCountRef.current);

  const inputRef = useRef<{
    active: boolean;
    touchId: number | null;
    startX: number; startY: number;
    curX: number; curY: number;
    dirX: number; dirY: number;
    dragDist: number;
  }>({ active: false, touchId: null, startX: 0, startY: 0, curX: 0, curY: 0, dirX: 0, dirY: 0, dragDist: 0 });

  // PC-ONLY: raw mouse position (in canvas CSS-pixel space), used for continuous
  // mouse-follow movement on desktop. Mobile's drag-joystick (inputRef above) is
  // completely untouched and still drives movement on phones.
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // UI State
  const [score, setScore] = useState(PLAYER_START_SCORE);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausePressed, setIsPausePressed] = useState(false);
  const [isEmojiPressed, setIsEmojiPressed] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; isPlayer: boolean }[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [isSplitPressed, setIsSplitPressed] = useState(false);
  const [isMasterSplitPressed, setIsMasterSplitPressed] = useState(false);
  const [isPulsePressed, setIsPulsePressed] = useState(false);
  const [isMacroPressed, setIsMacroPressed] = useState(false);
  const playerSkinImgRef = useRef<HTMLImageElement | null>(null);

  // CHAT: local UI state and message list
  const [showChat, setShowChat] = useState(false);
  const [isChatPressed, setIsChatPressed] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; isPlayer: boolean }[]>([
    { id: 'm1', sender: 'BlobMaster', text: 'gg everyone! 🌟', isPlayer: false },
    { id: 'm2', sender: 'SpeedyCell', text: 'Watch out for green viruses!', isPlayer: false }
  ]);

  // MOD MENU: player-adjustable zoom / macro speed / feed speed + hold-to-reposition
  const STORAGE_KEY_MOD_POS = 'dasgar_modMenuButtonPos';
  const [showModMenu, setShowModMenu] = useState(false);
  const [isModPressed, setIsModPressed] = useState(false);
  const [modZoom, setModZoom] = useState(1.0);
  const [modMacroInterval, setModMacroInterval] = useState(MACRO_FEED_INTERVAL);
  const [modFeedSpeed, setModFeedSpeed] = useState(11.5);
  const isInstantMergeMode = mode === 'instantMerge';
  const [instantMerge, setInstantMerge] = useState(isInstantMergeMode);
  const modZoomRef = useRef(modZoom);
  const modMacroIntervalRef = useRef(modMacroInterval);
  const modFeedSpeedRef = useRef(modFeedSpeed);
  const instantMergeRef = useRef(isInstantMergeMode);

  const [modBtnPos, setModBtnPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('dasgar_modMenuButtonPos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed;
      }
    } catch {}
    return null;
  });
  const [isModDragging, setIsModDragging] = useState(false);
  const modDragRef = useRef<{
    isDown: boolean;
    downTime: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    hasMoved: boolean;
    isDragging: boolean;
    holdTimer: number | null;
    currentPos: { x: number; y: number } | null;
  }>({
    isDown: false,
    downTime: 0,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    hasMoved: false,
    isDragging: false,
    holdTimer: null,
    currentPos: null
  });

  const handleModPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const state = modDragRef.current;
    state.isDown = true;
    state.downTime = Date.now();
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.offsetX = e.clientX - rect.left;
    state.offsetY = e.clientY - rect.top;
    state.hasMoved = false;
    state.isDragging = false;
    state.currentPos = modBtnPos || { x: rect.left, y: rect.top };

    setIsModPressed(true);

    if (state.holdTimer) window.clearTimeout(state.holdTimer);
    state.holdTimer = window.setTimeout(() => {
      if (state.isDown) {
        state.isDragging = true;
        setIsModDragging(true);
        if (!modBtnPos && state.currentPos) {
          setModBtnPos(state.currentPos);
        }
      }
    }, 400);
  };

  const handleModPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = modDragRef.current;
    if (!state.isDown) return;

    const dist = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
    if (dist > 8) {
      state.hasMoved = true;
    }

    if (state.isDragging) {
      const btnSize = 48;
      const maxX = window.innerWidth - btnSize - 8;
      const maxY = window.innerHeight - btnSize - 8;
      const newX = Math.max(8, Math.min(maxX, e.clientX - state.offsetX));
      const newY = Math.max(8, Math.min(maxY, e.clientY - state.offsetY));
      const newPos = { x: newX, y: newY };
      state.currentPos = newPos;
      setModBtnPos(newPos);
    } else if (dist > 15) {
      if (state.holdTimer) {
        window.clearTimeout(state.holdTimer);
        state.holdTimer = null;
      }
    }
  };

  const handleModPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = modDragRef.current;
    if (!state.isDown) return;
    state.isDown = false;
    setIsModPressed(false);

    if (state.holdTimer) {
      window.clearTimeout(state.holdTimer);
      state.holdTimer = null;
    }

    if (state.isDragging) {
      state.isDragging = false;
      setIsModDragging(false);
      if (state.currentPos) {
        setModBtnPos(state.currentPos);
        try {
          localStorage.setItem(STORAGE_KEY_MOD_POS, JSON.stringify(state.currentPos));
        } catch {}
      }
      return;
    }

    const dt = Date.now() - state.downTime;
    const dist = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
    if (dt <= 300 && dist <= 10) {
      setShowModMenu(prev => !prev);
    }
  };

  const handleModPointerCancel = () => {
    const state = modDragRef.current;
    state.isDown = false;
    state.isDragging = false;
    setIsModDragging(false);
    setIsModPressed(false);
    if (state.holdTimer) {
      window.clearTimeout(state.holdTimer);
      state.holdTimer = null;
    }
  };

  const initEntities = () => {
    foodsRef.current = Array.from({ length: FOOD_COUNT }).map(() => {
      const x = Math.random() * MAP_SIZE;
      const y = Math.random() * MAP_SIZE;
      return {
        id: generateId(),
        x,
        y,
        renderX: x,
        renderY: y,
        radius: NORMAL_FOOD_RADIUS,
        color: randomColor()
      };
    });

    ghostTokensRef.current = Array.from({ length: GHOST_TOKEN_TARGET_COUNT }).map(() => ({
      id: generateId(),
      x: Math.random() * (MAP_SIZE - 100) + 50,
      y: Math.random() * (MAP_SIZE - 100) + 50,
      radius: GHOST_TOKEN_RADIUS,
      pulsePhase: Math.random() * Math.PI * 2
    }));

    const now = performance.now();
    const createdBots: BotPlayer[] = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      createdBots.push(createBotInstance(i, now, createdBots));
    }
    botsRef.current = createdBots;

    virusesRef.current = Array.from({ length: VIRUS_COUNT }).map(() => ({
      id: generateId(),
      x: Math.random() * (MAP_SIZE - 200) + 100,
      y: Math.random() * (MAP_SIZE - 200) + 100,
      radius: VIRUS_RADIUS,
      color: '#33ff33'
    }));
  };

  const clearSplitTimers = () => {
    splitTimersRef.current.forEach(id => window.clearTimeout(id));
    splitTimersRef.current = [];
  };

  const togglePause = () => {
    if (isGameOverRef.current) return;
    const next = !isPausedRef.current;
    isPausedRef.current = next;
    setIsPaused(next);
    if (next) {
      inputRef.current.active = false;
      inputRef.current.touchId = null;
      inputRef.current.dirX = 0;
      inputRef.current.dirY = 0;
      autoGatherRef.current = false;
      macroActiveRef.current = false;
      macroAccumulatorRef.current = 0;
      setIsMacroPressed(false);
      clearSplitTimers();
    } else {
      autoGatherRef.current = true;
    }
  };

  const restartGame = () => {
    playerCellsRef.current = [
      {
        id: generateId(),
        x: MAP_SIZE / 2,
        y: MAP_SIZE / 2,
        renderX: MAP_SIZE / 2,
        renderY: MAP_SIZE / 2,
        renderRadius: PLAYER_START_RADIUS,
        vx: 0,
        vy: 0,
        radius: PLAYER_START_RADIUS,
        splitTime: 0,
        phaseOffset: Math.random() * Math.PI * 2,
        jelly: createCellJelly()
      }
    ];
    lastAimDirRef.current = { x: 0, y: -1 };
    cameraRef.current = {
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2
    };
    zoomRef.current = 1.0;
    scoreRef.current = PLAYER_START_SCORE;
    setScore(scoreRef.current);
    isGameOverRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    autoGatherRef.current = false;
    macroActiveRef.current = false;
    macroAccumulatorRef.current = 0;
    setIsMacroPressed(false);
    clearSplitTimers();
    initEntities();
  };

  const calculateTotalScore = () => {
    let totalScore = 0;
    const cells = playerCellsRef.current;
    for (let i = 0; i < cells.length; i++) {
      totalScore += (cells[i].radius * cells[i].radius) / 10;
    }
    return Math.floor(totalScore);
  };

  const handleSplit = () => {
    if (isGameOverRef.current || isPausedRef.current) return;
    const cells = playerCellsRef.current;
    if (cells.length >= 16) return;

    const inputMag = Math.hypot(inputRef.current.dirX, inputRef.current.dirY);
    const centeredAim = (inputRef.current.active && inputRef.current.dragDist <= 6) || autoGatherRef.current;
    let centerX = 0, centerY = 0;
    if (centeredAim && cells.length > 0) {
      let sumX = 0, sumY = 0;
      for (let i = 0; i < cells.length; i++) {
        sumX += cells[i].x;
        sumY += cells[i].y;
      }
      centerX = sumX / cells.length;
      centerY = sumY / cells.length;
    }

    let defaultAimX = lastAimDirRef.current.x;
    let defaultAimY = lastAimDirRef.current.y;
    if (!isPhoneRef.current && canvasRef.current) {
      const cX = canvasRef.current.clientWidth / 2;
      const cY = canvasRef.current.clientHeight / 2;
      const mDx = mousePosRef.current.x - cX;
      const mDy = mousePosRef.current.y - cY;
      const mDist = Math.hypot(mDx, mDy);
      if (mDist > 4) {
        defaultAimX = mDx / mDist;
        defaultAimY = mDy / mDist;
        lastAimDirRef.current = { x: defaultAimX, y: defaultAimY };
      }
    } else if (inputMag > 0.05) {
      defaultAimX = inputRef.current.dirX / inputMag;
      defaultAimY = inputRef.current.dirY / inputMag;
      lastAimDirRef.current = { x: defaultAimX, y: defaultAimY };
    }

    const now = performance.now();
    const newCells: PlayerCell[] = [];

    cells.forEach(cell => {
      if (cell.radius >= 35 && cells.length + newCells.length < 16) {
        let dirX = defaultAimX;
        let dirY = defaultAimY;
        if (centeredAim && cells.length > 1) {
          const toX = centerX - cell.x;
          const toY = centerY - cell.y;
          const d = Math.hypot(toX, toY);
          if (d > 1) {
            dirX = toX / d;
            dirY = toY / d;
          }
        }

        const newRadius = Math.sqrt((cell.radius * cell.radius) / 2);
        cell.radius = newRadius;
        cell.splitTime = now;

        // Authentic Agar.io / Sarok.io Mobile split launch burst & parent recoil
        const burstSpeed = 17.5;
        const spawnX = Math.max(newRadius, Math.min(MAP_SIZE - newRadius, cell.x + dirX * (cell.radius * 0.85)));
        const spawnY = Math.max(newRadius, Math.min(MAP_SIZE - newRadius, cell.y + dirY * (cell.radius * 0.85)));

        // Parent recoil: smooth physical kickback
        cell.vx = -dirX * 1.6;
        cell.vy = -dirY * 1.6;
        cell.moveVx = 0;
        cell.moveVy = 0;
        applySplitRecoil(cell.jelly, dirX, dirY);

        const childJelly = createCellJelly();
        applySplitLaunch(childJelly, dirX, dirY);

        newCells.push({
          id: generateId(),
          x: spawnX,
          y: spawnY,
          renderX: cell.renderX ?? cell.x,
          renderY: cell.renderY ?? cell.y,
          renderRadius: newRadius,
          vx: dirX * burstSpeed,
          vy: dirY * burstSpeed,
          moveVx: dirX * 2.0,
          moveVy: dirY * 2.0,
          radius: newRadius,
          splitTime: now,
          phaseOffset: Math.random() * Math.PI * 2,
          ignoreParentId: cell.id,
          ignoreParentUntil: now + 140,
          jelly: childJelly
        });
      }
    });

    if (newCells.length > 0) {
      playerCellsRef.current = [...cells, ...newCells];
    }
  };

  // Double split (2 split waves in quick succession, bound to Q on PC)
  const handleDoubleSplit = () => {
    if (isGameOverRef.current || isPausedRef.current) return;
    clearSplitTimers();

    // 1st split wave immediately
    handleSplit();

    // 2nd split wave quickly after (approx 110ms)
    const timerId = window.setTimeout(() => {
      if (isGameOverRef.current || isPausedRef.current) return;
      if (playerCellsRef.current.length >= 16) return;
      const eligible = playerCellsRef.current.some(c => c.radius >= 35);
      if (!eligible) return;
      handleSplit();
    }, 110);
    splitTimersRef.current.push(timerId);
  };

  // Master split / All-in (rapid split waves until 16-cell cap, bound to F on PC)
  const handleMasterSplit = () => {
    if (isGameOverRef.current || isPausedRef.current) return;
    clearSplitTimers();

    // First split wave immediately
    handleSplit();

    // Repeated split waves until reaching 16-cell cap or no more cells can split
    const delays = [130, 260, 390, 520];
    delays.forEach(delay => {
      const timerId = window.setTimeout(() => {
        if (isGameOverRef.current || isPausedRef.current) return;
        if (playerCellsRef.current.length >= 16) return;
        const eligible = playerCellsRef.current.some(c => c.radius >= 35);
        if (!eligible) return;
        handleSplit();
      }, delay);
      splitTimersRef.current.push(timerId);
    });
  };

  const handleEject = () => {
    if (isGameOverRef.current || isPausedRef.current) return;
    const now = performance.now();
    const cells = playerCellsRef.current;

    const inputMag = Math.hypot(inputRef.current.dirX, inputRef.current.dirY);
    const centeredAim = (inputRef.current.active && inputRef.current.dragDist <= 6) || autoGatherRef.current;
    let centerX = 0, centerY = 0;
    if (centeredAim && cells.length > 0) {
      let sumX = 0, sumY = 0;
      for (let i = 0; i < cells.length; i++) {
        sumX += cells[i].x;
        sumY += cells[i].y;
      }
      centerX = sumX / cells.length;
      centerY = sumY / cells.length;
    }

    let defaultAimX = lastAimDirRef.current.x;
    let defaultAimY = lastAimDirRef.current.y;
    if (!isPhoneRef.current && canvasRef.current) {
      const cX = canvasRef.current.clientWidth / 2;
      const cY = canvasRef.current.clientHeight / 2;
      const mDx = mousePosRef.current.x - cX;
      const mDy = mousePosRef.current.y - cY;
      const mDist = Math.hypot(mDx, mDy);
      if (mDist > 4) {
        defaultAimX = mDx / mDist;
        defaultAimY = mDy / mDist;
        lastAimDirRef.current = { x: defaultAimX, y: defaultAimY };
      }
    } else if (inputMag > 0.05) {
      defaultAimX = inputRef.current.dirX / inputMag;
      defaultAimY = inputRef.current.dirY / inputMag;
      lastAimDirRef.current = { x: defaultAimX, y: defaultAimY };
    }

    const ejectedMass = EJECTED_MASS_VALUE;

    cells.forEach(cell => {
      if (cell.radius >= 25) {
        let dirX = defaultAimX;
        let dirY = defaultAimY;
        if (centeredAim && cells.length > 1) {
          const toX = centerX - cell.x;
          const toY = centerY - cell.y;
          const d = Math.hypot(toX, toY);
          if (d > 1) {
            dirX = toX / d;
            dirY = toY / d;
          }
        }

        const currentMass = cell.radius * cell.radius;
        const remainingMass = currentMass - ejectedMass;
        if (remainingMass > INITIAL_RADIUS * INITIAL_RADIUS * 0.8) {
          cell.radius = Math.sqrt(remainingMass);

          // Slight angular spray variance (+- 3.5 deg) for an organic fluid stream rather than rigid mechanical dots
          const spreadAngle = (Math.random() - 0.5) * 0.12;
          const cosA = Math.cos(spreadAngle);
          const sinA = Math.sin(spreadAngle);
          const sprayDirX = dirX * cosA - dirY * sinA;
          const sprayDirY = dirX * sinA + dirY * cosA;

          const spawnDist = cell.radius + EJECTED_MASS_RADIUS + 3;
          const rawSpawnX = cell.x + sprayDirX * spawnDist;
          const rawSpawnY = cell.y + sprayDirY * spawnDist;
          const spawnX = Math.max(EJECTED_MASS_RADIUS, Math.min(MAP_SIZE - EJECTED_MASS_RADIUS, rawSpawnX));
          const spawnY = Math.max(EJECTED_MASS_RADIUS, Math.min(MAP_SIZE - EJECTED_MASS_RADIUS, rawSpawnY));

          // Launch speed variance (+- 6%)
          const feedSpeed = modFeedSpeedRef.current * (0.94 + Math.random() * 0.12);

          foodsRef.current.push({
            id: generateId(),
            x: spawnX,
            y: spawnY,
            renderX: spawnX,
            renderY: spawnY,
            radius: EJECTED_MASS_RADIUS,
            color: playerColorRef.current,
            vx: sprayDirX * feedSpeed,
            vy: sprayDirY * feedSpeed,
            decay: 10,
            mass: EJECTED_MASS_VALUE,
            canBeEatenAfter: now + 350,
            ownerCellId: cell.id
          });
        }
      }
    });
  };

  handleEjectRef.current = handleEject;

  const startMacro = () => {
    if (isGameOverRef.current || isPausedRef.current) return;
    macroActiveRef.current = true;
    setIsMacroPressed(true);
    handleEject();
  };

  const stopMacro = () => {
    macroActiveRef.current = false;
    setIsMacroPressed(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (e.shiftKey) {
          handleMasterSplit();
        } else {
          handleSplit();
        }
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        handleDoubleSplit();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleMasterSplit();
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        handleEject();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (!macroActiveRef.current) {
          startMacro();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') {
        stopMacro();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const skinId = localStorage.getItem('dasgario_equipped_skin');
    let skinUrl: string | null = null;
    if (skinId) {
      for (const cat in PRESET_SKINS) {
        const found = PRESET_SKINS[cat].find((s) => s.id === skinId);
        if (found) {
          skinUrl = found.svg;
          break;
        }
      }
      if (!skinUrl) {
        try {
          const custom = JSON.parse(localStorage.getItem('dasgario_custom_skins') || '[]');
          const found = custom.find((s: SkinItem) => s.id === skinId);
          if (found) {
            skinUrl = found.svg;
          }
        } catch {
          // ignore
        }
      }
    }

    if (skinUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = skinUrl;
      img.onload = () => {
        playerSkinImgRef.current = img;
      };
      img.onerror = () => {
        if (skinId === 'rank-1' && img.src !== window.location.origin + '/skins/rank1-pig.png') {
          img.src = '/skins/rank1-pig.png';
        } else if (skinId === 'rank-7' && img.src !== window.location.origin + '/skins/rank7-spider.png') {
          img.src = '/skins/rank7-spider.png';
        } else if (skinId === 'rank-15' && img.src !== window.location.origin + '/skins/rank15-cat.png') {
          img.src = '/skins/rank15-cat.png';
        } else if (skinId === 'rank-23' && img.src !== window.location.origin + '/skins/rank23-dragon.png') {
          img.src = '/skins/rank23-dragon.png';
        } else if (skinId === 'rank-27' && img.src !== window.location.origin + '/skins/rank27-shark.png') {
          img.src = '/skins/rank27-shark.png';
        } else if (skinId === 'rank-35' && img.src !== window.location.origin + '/skins/rank35-fox.png') {
          img.src = '/skins/rank35-fox.png';
        }
      };
    }

    // Preload Ghost Token image asset
    const ghostImg = new Image();
    ghostImg.src = '/ghost-token.png';
    ghostImg.onload = () => {
      ghostTokenImgRef.current = ghostImg;
    };
    ghostTokenImgRef.current = ghostImg;

    // Preload custom cell emojis (only these 3 in the game)
    const emojiMap: { [key: string]: HTMLImageElement } = {};
    QUICK_EMOJIS.forEach(item => {
      const img = new Image();
      img.src = item.src;
      emojiMap[item.id] = img;
    });
    emojiImagesRef.current = emojiMap;
    
    initEntities();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const touchActive = checkIsTouchDevice();
      isPhoneRef.current = touchActive;
      setIsTouchDevice(touchActive);
      // Default the PC mouse position to screen center so a player who hasn't
      // moved their mouse yet doesn't drift in some random direction.
      mousePosRef.current.x = canvas.clientWidth / 2;
      mousePosRef.current.y = canvas.clientHeight / 2;
    };
    window.addEventListener('resize', resize);
    resize();

    // PC-ONLY continuous mouse tracking for mouse-follow movement.
    // Mobile is completely unaffected: isPhoneRef gates every place this is
    // actually consumed, and this listener only records a position — it never
    // touches inputRef (the mobile joystick's own state).
    const handleMouseMoveTracking = (e: MouseEvent) => {
      if (isPhoneRef.current) return;
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current.x = e.clientX - rect.left;
      mousePosRef.current.y = e.clientY - rect.top;
    };
    window.addEventListener('mousemove', handleMouseMoveTracking);

    const handleWindowTouchStart = () => {
      if (!isPhoneRef.current) {
        isPhoneRef.current = true;
        setIsTouchDevice(true);
      }
    };
    window.addEventListener('touchstart', handleWindowTouchStart, { passive: true });

    const updateCellJelly = (
      cell: { vx?: number; vy?: number; moveVx?: number; moveVy?: number; radius: number; jelly?: SoftBodyJelly },
      dtRatio: number,
      quality: 'high' | 'medium' | 'low' = qualityRef.current || 'high'
    ) => {
      let j = cell.jelly;
      if (!j) {
        j = createCellJelly();
        cell.jelly = j;
      }

      // 1. Critically damped spring pulse for eating / merging / splitting (1.0 -> 1.05 -> 1.0)
      const targetPulse = j.pulseTarget || 1.0;
      const pulseDiff = targetPulse - j.pulse;
      j.pulseVel += (pulseDiff * 0.32 - j.pulseVel * 0.28) * dtRatio;
      j.pulse += j.pulseVel * dtRatio;
      if (j.pulseTarget > 1.0) {
        j.pulseTarget = 1.0;
      }
      if (Math.abs(j.pulse - 1.0) < 0.0005 && Math.abs(j.pulseVel) < 0.0005) {
        j.pulse = 1.0;
        j.pulseVel = 0;
      }

      // 2. Ripple decay
      if (j.rippleAmp > 0.001) {
        j.ripplePhase += 0.26 * dtRatio;
        j.rippleAmp *= Math.pow(0.82, dtRatio);
      } else {
        j.rippleAmp = 0;
      }

      // 3. Acceleration-based soft-body inertia (NO PERMANENT OR CONTINUOUS OVALS!)
      // Steady-state velocity does NOT distort the cell. Only acceleration / bursts produce a temporary subtle trail.
      const currentVx = (cell.moveVx || 0) + (cell.vx || 0);
      const currentVy = (cell.moveVy || 0) + (cell.vy || 0);
      const ax = currentVx - j.lastVx;
      const ay = currentVy - j.lastVy;
      j.lastVx = currentVx;
      j.lastVy = currentVy;

      const accelMag = Math.hypot(ax, ay);
      if (accelMag > 0.04) {
        const accelAngle = Math.atan2(ay, ax);
        const impulse = Math.min(1.8, Math.max(0.2, cell.radius * 0.035), accelMag * 0.5);
        const N = 48;
        const step = (Math.PI * 2) / N;
        for (let i = 0; i < N; i++) {
          const angle = i * step;
          // Points facing opposite to acceleration lag slightly
          const cosDiff = Math.cos(angle - accelAngle);
          j.vr[i] -= cosDiff * impulse * 0.5;
        }
      }

      // 4. Stable spring-damper integration for the 48 membrane vertices
      const N = 48;
      const step = (Math.PI * 2) / N;
      const dr = j.dr;
      const vr = j.vr;

      const kRestore = 0.22;   // Firm restoring spring back to circle
      const kNeighbor = 0.16;  // Surface tension keeping membrane curvature smooth
      const damping = 0.78;    // Critical damping to eliminate fluid sloshing

      const rippleAmp = j.rippleAmp;
      const ripplePhase = j.ripplePhase;

      for (let i = 0; i < N; i++) {
        const prevIdx = (i - 1 + N) % N;
        const nextIdx = (i + 1) % N;
        const neighborAvg = (dr[prevIdx] + dr[nextIdx]) * 0.5;

        const rippleForce = rippleAmp > 0.01 ? Math.sin(ripplePhase + i * step * 2) * rippleAmp * 0.2 : 0;
        const fRestore = -dr[i] * kRestore;
        const fNeighbor = (neighborAvg - dr[i]) * kNeighbor;

        vr[i] = (vr[i] + (fRestore + fNeighbor + rippleForce) * dtRatio) * Math.pow(damping, dtRatio);
        dr[i] += vr[i] * dtRatio;

        // Strictly clamp deformation: max 5px or 7% of radius so large cells never distort
        const maxDef = Math.min(5.0, Math.max(1.2, cell.radius * 0.07));
        if (dr[i] > maxDef) {
          dr[i] = maxDef;
          vr[i] *= 0.3;
        } else if (dr[i] < -maxDef) {
          dr[i] = -maxDef;
          vr[i] *= 0.3;
        }

        // Numerical deadband: settle to absolute mathematical 0
        if (Math.abs(dr[i]) < 0.02 && Math.abs(vr[i]) < 0.02) {
          dr[i] = 0;
          vr[i] = 0;
        }
      }
    };

    const applyCellSquash = (
      cell: { radius: number; jelly?: SoftBodyJelly },
      impactAngle: number,
      force: number
    ) => {
      if (!cell.jelly) return;
      const N = 48;
      const step = (Math.PI * 2) / N;
      // Controlled, subtle impact compression (capped at 2.5px max)
      const clampedForce = Math.min(2.5, cell.radius * 0.04, force * 0.2);
      if (clampedForce < 0.05) return;

      for (let i = 0; i < N; i++) {
        const angle = i * step;
        const cos = Math.cos(angle - impactAngle);
        if (cos > 0) {
          // Smooth bell-curve compression at contact point
          const comp = cos * cos * clampedForce;
          cell.jelly.vr[i] -= comp * 0.7;
          cell.jelly.dr[i] -= comp * 0.35;
        } else {
          // Slight volume-preserving expansion on flanks
          const sin = Math.sin(angle - impactAngle);
          const exp = sin * sin * clampedForce * 0.25;
          cell.jelly.vr[i] += exp * 0.35;
        }
      }
    };

    const traceCatmullRomCell = (
      cx: number,
      cy: number,
      cr: number,
      jelly: SoftBodyJelly | undefined,
      pointCount: number
    ) => {
      // Check if jelly actually has any noticeable deformation
      let hasDeform = false;
      const pulse = jelly ? Math.max(0.97, Math.min(1.08, jelly.pulse)) : 1.0;
      if (Math.abs(pulse - 1.0) > 0.002 || (jelly && jelly.rippleAmp > 0.02)) {
        hasDeform = true;
      } else if (jelly) {
        for (let i = 0; i < 48; i++) {
          if (Math.abs(jelly.dr[i]) > 0.12) {
            hasDeform = true;
            break;
          }
        }
      }

      ctx.beginPath();
      if (!hasDeform) {
        // 100% mathematically exact circular base
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        return;
      }

      const stepIdx = 48 / pointCount;
      const N = 48;
      const nominalR = cr * pulse;

      for (let k = 0; k < pointCount; k++) {
        const i = (k * stepIdx) % N;
        const angle = (i * Math.PI * 2) / N;
        const offset = jelly ? jelly.dr[i] : 0;
        const r = Math.max(3, nominalR + offset);
        scratchCurveX[k] = cx + Math.cos(angle) * r;
        scratchCurveY[k] = cy + Math.sin(angle) * r;
      }

      ctx.moveTo(scratchCurveX[0], scratchCurveY[0]);
      for (let k = 0; k < pointCount; k++) {
        const p0 = (k - 1 + pointCount) % pointCount;
        const p1 = k;
        const p2 = (k + 1) % pointCount;
        const p3 = (k + 2) % pointCount;

        const cp1x = scratchCurveX[p1] + (scratchCurveX[p2] - scratchCurveX[p0]) / 6;
        const cp1y = scratchCurveY[p1] + (scratchCurveY[p2] - scratchCurveY[p0]) / 6;
        const cp2x = scratchCurveX[p2] - (scratchCurveX[p3] - scratchCurveX[p1]) / 6;
        const cp2y = scratchCurveY[p2] - (scratchCurveY[p3] - scratchCurveY[p1]) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, scratchCurveX[p2], scratchCurveY[p2]);
      }
      ctx.closePath();
    };

    const renderSoftBodyCell = (
      cx: number,
      cy: number,
      cr: number,
      color: string,
      skinImg: HTMLImageElement | undefined | null,
      jelly: SoftBodyJelly | undefined,
      quality: 'high' | 'medium' | 'low'
    ) => {
      const points = quality === 'high' ? 48 : quality === 'medium' ? 24 : 16;
      traceCatmullRomCell(cx, cy, cr, jelly, points);

      if (skinImg && skinImg.complete && skinImg.naturalWidth > 0) {
        ctx.save();
        ctx.clip();
        const iw = skinImg.naturalWidth || skinImg.width || 1;
        const ih = skinImg.naturalHeight || skinImg.height || 1;
        const minDim = Math.min(iw, ih);
        const sx = (iw - minDim) / 2;
        const sy = (ih - minDim) / 2;
        ctx.drawImage(skinImg, sx, sy, minDim, minDim, cx - cr, cy - cr, cr * 2, cr * 2);
        ctx.restore();

        // Clean crisp border
        ctx.lineWidth = Math.max(2.5, Math.min(7, cr * 0.04));
        ctx.strokeStyle = getDarkerColor(color, 0.40);
        ctx.stroke();
      } else {
        if (quality === 'low') {
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          // Subtle, premium radial gradient with natural highlight and soft edge depth
          const grad = ctx.createRadialGradient(
            cx - cr * 0.20, cy - cr * 0.20, cr * 0.08,
            cx, cy, cr
          );
          grad.addColorStop(0, getLighterColor(color, 0.16));
          grad.addColorStop(0.75, color);
          grad.addColorStop(1, getDarkerColor(color, 0.18));
          ctx.fillStyle = grad;
          ctx.fill();

          // Subtle inner rim lighting
          ctx.lineWidth = Math.max(1.2, cr * 0.018);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.stroke();
        }

        // Crisp outer border
        ctx.lineWidth = Math.max(2.5, Math.min(7, cr * 0.04));
        ctx.strokeStyle = getDarkerColor(color, 0.38);
        ctx.stroke();
      }
    };

    const drawMetaballBridge = (
      x1: number,
      y1: number,
      r1: number,
      x2: number,
      y2: number,
      r2: number,
      color: string
    ) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy);
      const totalR = r1 + r2;
      if (dist >= totalR || dist < 2) return;

      const overlap = 1.0 - (dist / totalR);
      const angle = Math.atan2(dy, dx);
      const spread = Math.PI * 0.28 * overlap;

      const p1aX = x1 + Math.cos(angle + spread) * r1;
      const p1aY = y1 + Math.sin(angle + spread) * r1;
      const p1bX = x1 + Math.cos(angle - spread) * r1;
      const p1bY = y1 + Math.sin(angle - spread) * r1;

      const p2aX = x2 + Math.cos(angle + Math.PI - spread) * r2;
      const p2aY = y2 + Math.sin(angle + Math.PI - spread) * r2;
      const p2bX = x2 + Math.cos(angle + Math.PI + spread) * r2;
      const p2bY = y2 + Math.sin(angle + Math.PI + spread) * r2;

      const midX = (x1 + x2) * 0.5;
      const midY = (y1 + y2) * 0.5;
      const pinch = (1.0 - overlap) * 0.2 * totalR;

      const cp1X = midX + Math.cos(angle + Math.PI * 0.5) * pinch;
      const cp1Y = midY + Math.sin(angle + Math.PI * 0.5) * pinch;
      const cp2X = midX + Math.cos(angle - Math.PI * 0.5) * pinch;
      const cp2Y = midY + Math.sin(angle - Math.PI * 0.5) * pinch;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p1aX, p1aY);
      ctx.quadraticCurveTo(cp1X, cp1Y, p2aX, p2aY);
      ctx.lineTo(p2bX, p2bY);
      ctx.quadraticCurveTo(cp2X, cp2Y, p1bX, p1bY);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    };

    const triggerEatAnimation = (
      predator: { x: number; y: number; renderX?: number; renderY?: number; radius: number },
      preyX: number,
      preyY: number,
      preyR: number,
      preyColor: string,
      now: number
    ) => {
      const pool = eatingPoolRef.current;
      let slot: EatingAnim | null = null;
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) {
          slot = pool[i];
          break;
        }
      }
      if (!slot) slot = pool[0];
      slot.active = true;
      slot.startX = preyX;
      slot.startY = preyY;
      slot.predatorCell = predator;
      slot.radius = preyR;
      slot.initialRadius = preyR;
      slot.color = preyColor;
      slot.timeStart = now;
      slot.duration = preyR > 14 ? 240 : 180;
    };

    const triggerPelletPop = (x: number, y: number, color: string, now: number) => {
      const pool = popPoolRef.current;
      for (let p = 0; p < 3; p++) {
        let slot: PelletPopAnim | null = null;
        for (let i = 0; i < pool.length; i++) {
          if (!pool[i].active) {
            slot = pool[i];
            break;
          }
        }
        if (!slot) slot = pool[p % pool.length];
        const angle = (p * Math.PI * 2) / 3 + (Math.random() - 0.5) * 0.4;
        const speed = 1.2 + Math.random() * 1.5;
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.vx = Math.cos(angle) * speed;
        slot.vy = Math.sin(angle) * speed;
        slot.radius = 2.2;
        slot.color = color;
        slot.timeStart = now;
        slot.duration = 140;
      }
    };

    const drawGhostToken = (token: GhostToken, time: number) => {
      const cx = token.x;
      const cy = token.y;
      const r = token.radius;

      // Spooky ethereal bobbing & gentle sway
      const pulse = 0.92 + 0.08 * Math.sin(time * 0.0035 + (token.pulsePhase || 0));
      const floatY = Math.sin(time * 0.0028 + (token.pulsePhase || 0)) * 3;
      const floatX = Math.cos(time * 0.0022 + (token.pulsePhase || 0)) * 1.5;
      const drawX = cx + floatX;
      const drawY = cy + floatY;
      const effectiveR = r * pulse;

      ctx.save();
      ctx.beginPath();
      ctx.arc(drawX, drawY, effectiveR + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.26)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(drawX, drawY, effectiveR + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(192, 132, 252, 0.2)';
      ctx.fill();

      if (ghostTokenImgRef.current && ghostTokenImgRef.current.complete && ghostTokenImgRef.current.naturalWidth > 0) {
        const size = (effectiveR + 6) * 2;
        ctx.drawImage(
          ghostTokenImgRef.current,
          drawX - size / 2,
          drawY - size / 2,
          size,
          size
        );
      } else {
        const grad = ctx.createRadialGradient(
          drawX - r * 0.2, drawY - r * 0.2, r * 0.2,
          drawX, drawY, r * 1.2
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#7dd3fc');
        grad.addColorStop(1, '#38bdf8');

        ctx.beginPath();
        ctx.arc(drawX, drawY - 2, effectiveR, Math.PI, 0, false);
        ctx.lineTo(drawX + effectiveR, drawY + effectiveR);
        ctx.lineTo(drawX, drawY + effectiveR * 0.6);
        ctx.lineTo(drawX - effectiveR, drawY + effectiveR);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.restore();
    };

    const drawVirus = (virus: Virus, time: number) => {
      const spikes = 16;
      const breath = Math.sin(time * 0.0032);
      const outerRadius = virus.radius * (1.0 + 0.035 * breath);
      const innerRadius = virus.radius * (0.86 + 0.025 * Math.cos(time * 0.0032));
      ctx.save();
      ctx.beginPath();
      const total = spikes * 2;
      const angleStep = (Math.PI * 2) / total;
      for (let i = 0; i < total; i++) {
        const angle = i * angleStep;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const px = virus.x + Math.cos(angle) * r;
        const py = virus.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#15803d';
      ctx.stroke();
      ctx.restore();
    };


    const drawAimArrow = () => {
      const cells = playerCellsRef.current;
      if (cells.length === 0) return;

      const inputMag = Math.hypot(inputRef.current.dirX, inputRef.current.dirY);
      if (inputMag <= 0.02) return;

      let clusterCenterX = 0, clusterCenterY = 0, totalArea = 0, maxRadius = 0;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const r = c.renderRadius ?? c.radius;
        const area = r * r;
        totalArea += area;
        clusterCenterX += (c.renderX ?? c.x) * area;
        clusterCenterY += (c.renderY ?? c.y) * area;
        if (r > maxRadius) maxRadius = r;
      }
      if (totalArea > 0) {
        clusterCenterX /= totalArea;
        clusterCenterY /= totalArea;
      } else {
        clusterCenterX = cells[0].renderX ?? cells[0].x;
        clusterCenterY = cells[0].renderY ?? cells[0].y;
      }

      const angle = Math.atan2(inputRef.current.dirY, inputRef.current.dirX);
      const gap = 4.5;
      const arrowLength = 10.5;
      const arrowBase = 10.5;

      // Find the leading rim distance along the movement direction so arrow sits cleanly outside
      let leadingDist = 0;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const r = c.renderRadius ?? c.radius;
        const cx = (c.renderX ?? c.x) - clusterCenterX;
        const cy = (c.renderY ?? c.y) - clusterCenterY;
        const distAlongAngle = (cx * Math.cos(angle) + cy * Math.sin(angle)) + r;
        if (distAlongAngle > leadingDist) {
          leadingDist = distAlongAngle;
        }
      }
      const arrowDist = (leadingDist > 0 ? leadingDist : maxRadius) + gap;
      const arrowX = clusterCenterX + Math.cos(angle) * arrowDist;
      const arrowY = clusterCenterY + Math.sin(angle) * arrowDist;

      // Draw authentic Agar.io small solid gray triangle pointer
      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(arrowLength, 0); // Tip pointing outward
      ctx.lineTo(0, -arrowBase / 2); // Base top corner
      ctx.lineTo(0, arrowBase / 2); // Base bottom corner
      ctx.closePath();
      ctx.fillStyle = '#c0c0c0';
      ctx.fill();
      ctx.restore();
    };

    const popPlayerCell = (
      cell: PlayerCell,
      virus: Virus,
      now: number,
      occupiedSlotsBeforeThisCell: number
    ): PlayerCell[] => {
      const originalMass = cell.radius * cell.radius;
      const availableSlots = Math.max(1, 16 - occupiedSlotsBeforeThisCell);

      if (availableSlots <= 1) {
        // At 16-cell cap: absorb the virus's mass like a bonus pellet with zero fragmentation (never shrink!)
        const bonusMass = 100;
        const newRadius = Math.sqrt(originalMass + bonusMass);
        return [{
          ...cell,
          radius: newRadius,
          renderRadius: cell.renderRadius ? Math.sqrt(cell.renderRadius * cell.renderRadius + bonusMass) : newRadius,
          splitTime: now
        }];
      }

      const desiredFragments = Math.min(10, Math.max(3, Math.floor((cell.radius / VIRUS_RADIUS) * 3) + 2));
      const fragmentCount = Math.min(desiredFragments, availableSlots);

      // Mass strictly conserved: sum of fragmentMass equals originalMass
      const fragmentMass = originalMass / fragmentCount;
      const fragmentRadius = Math.sqrt(fragmentMass);

      const baseAngle = Math.atan2(cell.y - virus.y, cell.x - virus.x);
      const fragments: PlayerCell[] = [];

      for (let i = 0; i < fragmentCount; i++) {
        const angle = baseAngle + (i * Math.PI * 2) / fragmentCount + (Math.random() - 0.5) * 0.15;
        const popSpeed = 16 + (i % 2) * 5 + Math.random() * 2.5;

        const spawnDist = fragmentRadius * 0.5;
        let spawnX = cell.x + Math.cos(angle) * spawnDist;
        let spawnY = cell.y + Math.sin(angle) * spawnDist;

        spawnX = Math.max(fragmentRadius, Math.min(MAP_SIZE - fragmentRadius, spawnX));
        spawnY = Math.max(fragmentRadius, Math.min(MAP_SIZE - fragmentRadius, spawnY));

        fragments.push({
          id: generateId(),
          x: spawnX,
          y: spawnY,
          renderX: cell.renderX ?? cell.x,
          renderY: cell.renderY ?? cell.y,
          renderRadius: fragmentRadius * 0.65,
          vx: Math.cos(angle) * popSpeed + cell.vx * 0.25,
          vy: Math.sin(angle) * popSpeed + cell.vy * 0.25,
          moveVx: 0,
          moveVy: 0,
          radius: fragmentRadius,
          splitTime: now,
          phaseOffset: Math.random() * Math.PI * 2,
          jelly: createCellJelly()
        });
      }

      return fragments;
    };

    // Sarok.io / Agar.io dynamic zoom curve centered cleanly on the player
    const getTargetZoom = (effectiveRadius: number, canvasWidth: number, canvasHeight: number): number => {
      const minDimension = Math.min(canvasWidth, canvasHeight);
      const viewportRatio = minDimension / 720;
      
      const sizeRatio = Math.max(1.0, effectiveRadius / 24);
      const baseZoom = 1.05 / Math.pow(sizeRatio, 0.28);
      
      const autoZoom = Math.max(0.24, Math.min(1.15, baseZoom * Math.max(0.75, Math.min(1.2, viewportRatio))));
      return autoZoom * modZoomRef.current;
    };

    const update = (dt: number) => {
      if (isGameOverRef.current || isPausedRef.current) return;
      const now = performance.now();
      const dtRatio = dt / 16.667;

      // Update Macro continuous rapid feed
      if (macroActiveRef.current && !isPausedRef.current && !isGameOverRef.current) {
        macroAccumulatorRef.current += dt;
        const interval = modMacroIntervalRef.current;
        while (macroAccumulatorRef.current >= interval) {
          handleEjectRef.current();
          macroAccumulatorRef.current -= interval;
        }
      } else {
        macroAccumulatorRef.current = 0;
      }

      // 1. Movement input vector:
      //    - PHONE: Agar.io Mobile dynamic floating joystick with smooth analog Hermite response
      //    - PC: continuous mouse-follow (screen center -> mouse cursor)
      let targetDirX = 0;
      let targetDirY = 0;
      let rawDist = 0;

      if (isPhoneRef.current) {
        const maxDragRadius = 60;
        const deadzone = 4;

        if (inputRef.current.active) {
          const rawDx = inputRef.current.curX - inputRef.current.startX;
          const rawDy = inputRef.current.curY - inputRef.current.startY;
          rawDist = Math.hypot(rawDx, rawDy);
          if (rawDist > deadzone) {
            const normX = rawDx / rawDist;
            const normY = rawDy / rawDist;
            targetDirX = normX;
            targetDirY = normY;
            lastAimDirRef.current = { x: normX, y: normY };
          } else {
            // Tapped without dragging: steer toward tap location relative to screen center
            const centerX = canvas.clientWidth / 2;
            const centerY = canvas.clientHeight / 2;
            const fromCenterX = inputRef.current.startX - centerX;
            const fromCenterY = inputRef.current.startY - centerY;
            const centerDist = Math.hypot(fromCenterX, fromCenterY);
            if (centerDist > 10) {
              const normX = fromCenterX / centerDist;
              const normY = fromCenterY / centerDist;
              targetDirX = normX;
              targetDirY = normY;
              lastAimDirRef.current = { x: normX, y: normY };
            }
          }
          inputRef.current.dragDist = rawDist;
        } else {
          // STOP-ON-RELEASE REMOVED: cell automatically continues cruising in the last aimed direction
          targetDirX = lastAimDirRef.current.x;
          targetDirY = lastAimDirRef.current.y;
        }
      } else {
        // --- PC: cell always moves toward the current mouse position, no button held ---
        const deadzone = 8;
        const maxDragRadius = Math.max(220, Math.min(canvas.clientWidth, canvas.clientHeight) * 0.45);
        const centerX = canvas.clientWidth / 2;
        const centerY = canvas.clientHeight / 2;
        const rawDx = mousePosRef.current.x - centerX;
        const rawDy = mousePosRef.current.y - centerY;
        rawDist = Math.hypot(rawDx, rawDy);
        if (rawDist > deadzone) {
          const normX = rawDx / rawDist;
          const normY = rawDy / rawDist;
          targetDirX = normX;
          targetDirY = normY;
          lastAimDirRef.current = { x: normX, y: normY };
        } else {
          targetDirX = lastAimDirRef.current.x;
          targetDirY = lastAimDirRef.current.y;
        }
        inputRef.current.active = false;
        inputRef.current.dragDist = rawDist;
      }

      inputRef.current.dirX = targetDirX;
      inputRef.current.dirY = targetDirY;

      const inputMag = Math.hypot(targetDirX, targetDirY);
      if (inputMag > 0.05) {
        lastAimDirRef.current = {
          x: targetDirX / inputMag,
          y: targetDirY / inputMag
        };
      }

      const gatherMode = (inputRef.current.active && rawDist <= 6) || autoGatherRef.current;

      // 2. Precalculate player group center, total area, and effective radius once per frame (Sections 3, 7, 26)
      const cells = playerCellsRef.current;
      let groupCenterX = 0;
      let groupCenterY = 0;
      let groupTotalArea = 0;
      let groupMaxRadius = 0;

      if (cells.length > 0) {
        let sumX = 0;
        let sumY = 0;
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i];
          const area = c.radius * c.radius;
          groupTotalArea += area;
          sumX += c.x * area;
          sumY += c.y * area;
          if (c.radius > groupMaxRadius) groupMaxRadius = c.radius;
        }
        groupCenterX = groupTotalArea > 0 ? sumX / groupTotalArea : cells[0].x;
        groupCenterY = groupTotalArea > 0 ? sumY / groupTotalArea : cells[0].y;
      }
      const effectiveRadius = Math.sqrt(groupTotalArea);

      playerGroupRef.current = {
        centerX: groupCenterX,
        centerY: groupCenterY,
        maxRadius: groupMaxRadius,
        effectiveRadius,
        totalArea: groupTotalArea
      };

      // 3. Multi-cell physics with authentic Agar.io size-dependent speed and turning curves
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        let targetVx = 0;
        let targetVy = 0;

        // Real Agar.io Mobile speed formula: speed = BASE_SPEED * (radius / 20)^(-0.439)
        const cellSpeed = BASE_PLAYER_SPEED * Math.pow(Math.max(12, cell.radius) / INITIAL_RADIUS, -SPEED_SCALE);

        if (gatherMode) {
          const toX = groupCenterX - cell.x;
          const toY = groupCenterY - cell.y;
          const dCenter = Math.hypot(toX, toY);
          if (dCenter > 2) {
            targetVx = (toX / dCenter) * cellSpeed;
            targetVy = (toY / dCenter) * cellSpeed;
          }
        } else if (inputMag > 0.02) {
          const inDirX = targetDirX / inputMag;
          const inDirY = targetDirY / inputMag;
          const maxSpeed = cellSpeed * inputMag;
          targetVx = inDirX * maxSpeed;
          targetVy = inDirY * maxSpeed;
        }

        // Mass-dependent turning agility & smooth coasting on release
        const massTurnAgility = Math.max(0.65, Math.min(1.0, 48 / (cell.radius + 20)));
        const accelRate = (inputMag > 0.02 || gatherMode) ? 6.5 * massTurnAgility : 3.0;
        const accel = 1 - Math.exp(-accelRate * (dt / 1000));
        cell.moveVx = (cell.moveVx || 0) + (targetVx - (cell.moveVx || 0)) * accel;
        cell.moveVy = (cell.moveVy || 0) + (targetVy - (cell.moveVy || 0)) * accel;

        // Apply movement velocity and burst split velocity
        cell.x += (cell.moveVx + cell.vx) * dtRatio;
        cell.y += (cell.moveVy + cell.vy) * dtRatio;
        updateCellJelly(cell, dtRatio);

        // Smooth Agar.io split launch decay curve
        const burstDecay = Math.pow(0.88, dtRatio);
        cell.vx *= burstDecay;
        cell.vy *= burstDecay;
        if (Math.hypot(cell.vx, cell.vy) < 0.08) {
          cell.vx = 0;
          cell.vy = 0;
        }

        if (inputMag <= 0.02 && !gatherMode && Math.hypot(cell.moveVx || 0, cell.moveVy || 0) < 0.04) {
          cell.moveVx = 0;
          cell.moveVy = 0;
        }

        // Frictionless border sliding
        if (cell.x <= cell.radius) {
          cell.x = cell.radius;
          if (cell.moveVx < 0) cell.moveVx = 0;
          if (cell.vx < 0) cell.vx = 0;
        } else if (cell.x >= MAP_SIZE - cell.radius) {
          cell.x = MAP_SIZE - cell.radius;
          if (cell.moveVx > 0) cell.moveVx = 0;
          if (cell.vx > 0) cell.vx = 0;
        }

        if (cell.y <= cell.radius) {
          cell.y = cell.radius;
          if (cell.moveVy < 0) cell.moveVy = 0;
          if (cell.vy < 0) cell.vy = 0;
        } else if (cell.y >= MAP_SIZE - cell.radius) {
          cell.y = MAP_SIZE - cell.radius;
          if (cell.moveVy > 0) cell.moveVy = 0;
          if (cell.vy > 0) cell.vy = 0;
        }
      }

      // Multi-cell separation & merging: 2 relaxation passes with mass-weighted repulsion
      if (cells.length > 1) {
        const mergedIndices = new Set<number>();

        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < cells.length; i++) {
            if (mergedIndices.has(i)) continue;
            for (let j = i + 1; j < cells.length; j++) {
              if (mergedIndices.has(j)) continue;

              const c1 = cells[i];
              const c2 = cells[j];

              // Skip collision if newly split grace period is active between parent and child
              if (c2.ignoreParentId === c1.id && now < (c2.ignoreParentUntil || 0)) continue;
              if (c1.ignoreParentId === c2.id && now < (c1.ignoreParentUntil || 0)) continue;

              const dx = c2.x - c1.x;
              const dy = c2.y - c1.y;
              const distSq = dx * dx + dy * dy;
              const totalR = c1.radius + c2.radius;

              if (distSq < totalR * totalR) {
                const dist = Math.sqrt(distSq) || 0.001;
                const nx = dx / dist;
                const ny = dy / dist;

                const m1 = c1.radius * c1.radius;
                const m2 = c2.radius * c2.radius;
                const totalM = m1 + m2;
                const w1 = m2 / totalM; // fraction of push applied to c1
                const w2 = m1 / totalM; // fraction of push applied to c2

                const mergeCooldownMs = (isInstantMergeMode || instantMergeRef.current)
                  ? 250
                  : Math.max(20000, 20000 + Math.max(c1.radius, c2.radius) * 12);
                const canMerge = (now - c1.splitTime >= mergeCooldownMs) && (now - c2.splitTime >= mergeCooldownMs);

                if (canMerge) {
                  // Mutual capillary attraction when ready to merge
                  const pull = 0.18 * (totalR - dist) * dtRatio;
                  c1.x += nx * pull * w1;
                  c1.y += ny * pull * w1;
                  c2.x -= nx * pull * w2;
                  c2.y -= ny * pull * w2;

                  if (dist < Math.max(c1.radius, c2.radius) * 0.72 || dist < totalR * 0.48) {
                    c1.radius = Math.sqrt(totalM);
                    c1.renderRadius = c1.radius;
                    c1.x = (c1.x * m1 + c2.x * m2) / totalM;
                    c1.y = (c1.y * m1 + c2.y * m2) / totalM;
                    c1.vx = (c1.vx * m1 + c2.vx * m2) / totalM;
                    c1.vy = (c1.vy * m1 + c2.vy * m2) / totalM;
                    c1.moveVx = ((c1.moveVx || 0) * m1 + (c2.moveVx || 0) * m2) / totalM;
                    c1.moveVy = ((c1.moveVy || 0) * m1 + (c2.moveVy || 0) * m2) / totalM;
                    c1.splitTime = Math.min(c1.splitTime, c2.splitTime);
                    if (c1.jelly) {
                      for (let k = 0; k < 48; k++) {
                        c1.jelly.dr[k] = 0;
                        c1.jelly.vr[k] = 0;
                      }
                      c1.jelly.pulseTarget = 1.05;
                      c1.jelly.rippleAmp = 1.4;
                    }
                    mergedIndices.add(j);
                  }
                } else if (!gatherMode) {
                  // Mass-weighted elastic separation: heavier cells stay firm, smaller cells slide smoothly
                  const overlap = totalR - dist;
                  const stiffness = 0.42 * dtRatio;
                  const push = overlap * stiffness;

                  c1.x -= nx * push * w1;
                  c1.y -= ny * push * w1;
                  c2.x += nx * push * w2;
                  c2.y += ny * push * w2;

                  if (pass === 0) {
                    applyCellSquash(c1, Math.atan2(ny, nx), push * 0.4);
                    applyCellSquash(c2, Math.atan2(-ny, -nx), push * 0.4);
                  }

                  c1.x = Math.max(c1.radius, Math.min(MAP_SIZE - c1.radius, c1.x));
                  c1.y = Math.max(c1.radius, Math.min(MAP_SIZE - c1.radius, c1.y));
                  c2.x = Math.max(c2.radius, Math.min(MAP_SIZE - c2.radius, c2.x));
                  c2.y = Math.max(c2.radius, Math.min(MAP_SIZE - c2.radius, c2.y));
                }
              }
            }
          }
        }

        if (mergedIndices.size > 0) {
          playerCellsRef.current = cells.filter((_, idx) => !mergedIndices.has(idx));
        }
      }

      // 4. Smooth cinematic camera follow & dynamic zoom (Agar.io mobile feel)
      const currentCells = playerCellsRef.current;
      if (currentCells.length > 0) {
        let sumX = 0, sumY = 0, totalMass = 0;
        for (let i = 0; i < currentCells.length; i++) {
          const c = currentCells[i];
          const cr = c.renderRadius ?? c.radius;
          const m = cr * cr;
          totalMass += m;
          sumX += (c.renderX ?? c.x) * m;
          sumY += (c.renderY ?? c.y) * m;
        }
        const visualCenterX = totalMass > 0 ? sumX / totalMass : (currentCells[0].renderX ?? currentCells[0].x);
        const visualCenterY = totalMass > 0 ? sumY / totalMass : (currentCells[0].renderY ?? currentCells[0].y);
        const visualEffectiveRadius = Math.sqrt(totalMass);

        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;

        const targetZoom = getTargetZoom(visualEffectiveRadius, canvasWidth, canvasHeight);

        // Critically damped zoom transition
        const zoomLerp = 1 - Math.exp(-3.2 * (dt / 1000));
        zoomRef.current += (targetZoom - zoomRef.current) * zoomLerp;

        // Sarok.io locked-center camera: cell is 100% fixed at center with zero drift
        cameraRef.current.x = visualCenterX;
        cameraRef.current.y = visualCenterY;
      }
      // Ejected mass physics: smooth viscous fluid decay
      const allFoods = foodsRef.current;
      for (let i = 0; i < allFoods.length; i++) {
        const food = allFoods[i];
        if (food.vx !== undefined && food.vy !== undefined && (food.vx !== 0 || food.vy !== 0)) {
          food.x += food.vx * dtRatio;
          food.y += food.vy * dtRatio;
          const decayFactor = Math.pow(0.88, dtRatio);
          food.vx *= decayFactor;
          food.vy *= decayFactor;
          if (Math.hypot(food.vx, food.vy) < 0.05) {
            food.vx = 0;
            food.vy = 0;
          }
          if (food.x <= food.radius) {
            food.x = food.radius;
            food.vx = 0;
          } else if (food.x >= MAP_SIZE - food.radius) {
            food.x = MAP_SIZE - food.radius;
            food.vx = 0;
          }
          if (food.y <= food.radius) {
            food.y = food.radius;
            food.vy = 0;
          } else if (food.y >= MAP_SIZE - food.radius) {
            food.y = MAP_SIZE - food.radius;
            food.vy = 0;
          }
        }
      }

      // -------------------------------------------------------------------------
      // ZERO-ALLOCATION SPATIAL HASHING FOR FOOD PELLETS (Requirement 7)
      // -------------------------------------------------------------------------
      foodGridHead.fill(-1);
      foodGridCount.fill(0);
      foodGridSumX.fill(0);
      foodGridSumY.fill(0);

      const numAllFoods = allFoods.length;
      for (let i = 0; i < numAllFoods; i++) {
        const f = allFoods[i];
        if (f.eaten) continue;
        let cCol = Math.floor(f.x / GRID_CELL_SIZE);
        let cRow = Math.floor(f.y / GRID_CELL_SIZE);
        if (cCol < 0) cCol = 0; else if (cCol >= GRID_COLS) cCol = GRID_COLS - 1;
        if (cRow < 0) cRow = 0; else if (cRow >= GRID_ROWS) cRow = GRID_ROWS - 1;
        const cIdx = cCol + cRow * GRID_COLS;

        foodGridNext[i] = foodGridHead[cIdx];
        foodGridHead[cIdx] = i;
        foodGridCount[cIdx]++;
        foodGridSumX[cIdx] += f.x;
        foodGridSumY[cIdx] += f.y;
      }

      // -------------------------------------------------------------------------
      // BOT AI HELPERS & DECISION LOGIC (Requirements 1 - 6)
      // -------------------------------------------------------------------------
      const botEjectMass = (bot: BotPlayer, cell: BotCell, aimDirX: number, aimDirY: number) => {
        if (cell.radius < 26) return;
        const currentMass = cell.radius * cell.radius;
        const remainingMass = currentMass - EJECTED_MASS_VALUE;
        if (remainingMass <= INITIAL_RADIUS * INITIAL_RADIUS * 0.8) return;

        cell.radius = Math.sqrt(remainingMass);
        const spawnDist = cell.radius + EJECTED_MASS_RADIUS + 3;
        const spawnX = Math.max(EJECTED_MASS_RADIUS, Math.min(MAP_SIZE - EJECTED_MASS_RADIUS, cell.x + aimDirX * spawnDist));
        const spawnY = Math.max(EJECTED_MASS_RADIUS, Math.min(MAP_SIZE - EJECTED_MASS_RADIUS, cell.y + aimDirY * spawnDist));

        const feedSpeed = 19 * (0.95 + Math.random() * 0.1);
        allFoods.push({
          id: generateId(),
          x: spawnX,
          y: spawnY,
          renderX: spawnX,
          renderY: spawnY,
          radius: EJECTED_MASS_RADIUS,
          color: bot.color,
          vx: aimDirX * feedSpeed,
          vy: aimDirY * feedSpeed,
          decay: 0.93,
          mass: EJECTED_MASS_VALUE,
          canBeEatenAfter: now + 350,
          ownerCellId: cell.id
        });
      };

      const botSplitTowards = (bot: BotPlayer, cell: BotCell, dirX: number, dirY: number) => {
        if (cell.radius < 35 || bot.cells.length >= 8) return;
        const newRadius = Math.sqrt((cell.radius * cell.radius) / 2);
        cell.radius = newRadius;
        cell.splitTime = now;

        const burstSpeed = 17.5;
        const spawnX = Math.max(newRadius, Math.min(MAP_SIZE - newRadius, cell.x + dirX * (cell.radius * 0.85)));
        const spawnY = Math.max(newRadius, Math.min(MAP_SIZE - newRadius, cell.y + dirY * (cell.radius * 0.85)));

        cell.vx = -dirX * 1.6;
        cell.vy = -dirY * 1.6;
        cell.moveVx = 0;
        cell.moveVy = 0;
        applySplitRecoil(cell.jelly, dirX, dirY);

        const bChildJelly = createCellJelly();
        applySplitLaunch(bChildJelly, dirX, dirY);

        const newCell: BotCell = {
          id: generateId(),
          x: spawnX,
          y: spawnY,
          renderX: cell.renderX ?? cell.x,
          renderY: cell.renderY ?? cell.y,
          renderRadius: newRadius,
          vx: dirX * burstSpeed,
          vy: dirY * burstSpeed,
          moveVx: dirX * 2.0,
          moveVy: dirY * 2.0,
          radius: newRadius,
          splitTime: now,
          phaseOffset: Math.random() * Math.PI * 2,
          ignoreParentId: cell.id,
          ignoreParentUntil: now + 140,
          color: bot.color,
          name: bot.name,
          skinId: bot.skinId,
          skinImg: bot.skinImg,
          jelly: bChildJelly
        };
        bot.cells.push(newCell);
        bot.lastSplitTime = now;
      };

      const updateBotAI = (bot: BotPlayer) => {
        // Run AI decision roughly every ~100ms (tailored per bot skill)
        if (now - bot.lastDecisionTime < bot.decisionInterval) return;
        bot.lastDecisionTime = now;

        // Human-like mistake timing: brief distraction or overshoot
        if (now > bot.nextMistakeTime) {
          bot.mistakeActiveUntil = now + 160 + (1 - bot.skill) * 240;
          bot.nextMistakeTime = now + 4000 + bot.skill * 6000;
        }
        const isDistracted = now < bot.mistakeActiveUntil;

        // Aim wobble / drift (lower skill has slightly more variance)
        bot.aimErrorAngle += (Math.random() - 0.5) * 0.07 * (1 - bot.skill);
        const maxJitter = (1 - bot.skill) * 0.32;
        bot.aimErrorAngle = Math.max(-maxJitter, Math.min(maxJitter, bot.aimErrorAngle));

        // Find bot center of mass and largest cell
        let sumX = 0, sumY = 0, totalM = 0, maxR = 0;
        let largestCell = bot.cells[0];
        for (let k = 0; k < bot.cells.length; k++) {
          const c = bot.cells[k];
          const m = c.radius * c.radius;
          sumX += c.x * m;
          sumY += c.y * m;
          totalM += m;
          if (c.radius > maxR) {
            maxR = c.radius;
            largestCell = c;
          }
        }
        if (!largestCell) return;

        const botCenterX = totalM > 0 ? sumX / totalM : bot.x;
        const botCenterY = totalM > 0 ? sumY / totalM : bot.y;

        // Vision radius scales dynamically with bot size
        const visionRadius = Math.max(500, maxR * 7.5 + 320);
        const visionRadiusSq = visionRadius * visionRadius;

        const currentViruses = virusesRef.current;
        const currentPlayers = playerCellsRef.current;
        const allBots = botsRef.current;

        // -------------------------------------------------------------
        // PRIORITY 1: FLEE FROM BIGGER CELLS (>1.15x radius & close)
        // -------------------------------------------------------------
        let threatCount = 0;
        let escapeForceX = 0;
        let escapeForceY = 0;
        let closestThreatDist = Infinity;
        let closestThreatCell: { x: number; y: number; radius: number } | null = null;

        const personalityMargin = bot.personality === 'cautious' ? 360 : bot.personality === 'aggressive' ? 220 : 280;

        const checkThreat = (opp: { x: number; y: number; radius: number }) => {
          if (opp.radius > maxR * 1.15) {
            const dx = opp.x - botCenterX;
            const dy = opp.y - botCenterY;
            const dSq = dx * dx + dy * dy;
            if (dSq > visionRadiusSq) return;
            const d = Math.sqrt(dSq) || 0.001;

            const canSplitKill = opp.radius > maxR * 1.55;
            const dangerDist = maxR + opp.radius + personalityMargin + (canSplitKill ? 140 : 0);

            if (d < dangerDist) {
              threatCount++;
              const urgency = (dangerDist - d) / dangerDist;
              escapeForceX -= (dx / d) * urgency * 2.5;
              escapeForceY -= (dy / d) * urgency * 2.5;
              if (d < closestThreatDist) {
                closestThreatDist = d;
                closestThreatCell = opp;
              }
            }
          }
        };

        for (let p = 0; p < currentPlayers.length; p++) {
          checkThreat(currentPlayers[p]);
        }
        for (let b = 0; b < allBots.length; b++) {
          const other = allBots[b];
          if (other.id === bot.id) continue;
          for (let c = 0; c < other.cells.length; c++) {
            checkThreat(other.cells[c]);
          }
        }

        const isVirusSafe = maxR < VIRUS_RADIUS * 0.90;

        if (threatCount > 0) {
          bot.fleeing = true;
          bot.chasing = false;

          // Smaller bots use viruses as shields: position virus directly between self and chaser
          if (isVirusSafe && closestThreatCell) {
            let bestShieldVirus: Virus | null = null;
            let bestShieldScore = -Infinity;
            for (let v = 0; v < currentViruses.length; v++) {
              const virus = currentViruses[v];
              const vd = Math.hypot(virus.x - botCenterX, virus.y - botCenterY);
              if (vd < visionRadius * 0.85) {
                // Vector from threat to virus
                const tvX = virus.x - closestThreatCell.x;
                const tvY = virus.y - closestThreatCell.y;
                const tvDist = Math.hypot(tvX, tvY) || 1;
                // Safe pocket behind the virus relative to threat
                const pocketX = virus.x + (tvX / tvDist) * (VIRUS_RADIUS + maxR + 24);
                const pocketY = virus.y + (tvY / tvDist) * (VIRUS_RADIUS + maxR + 24);
                const score = 1000 - vd;
                if (score > bestShieldScore) {
                  bestShieldScore = score;
                  bestShieldVirus = virus;
                  escapeForceX = escapeForceX * 0.25 + (pocketX - botCenterX) * 1.8;
                  escapeForceY = escapeForceY * 0.25 + (pocketY - botCenterY) * 1.8;
                }
              }
            }
          } else if (!isVirusSafe) {
            // Big bots avoid virus splits with wide margin
            for (let v = 0; v < currentViruses.length; v++) {
              const virus = currentViruses[v];
              const vdx = botCenterX - virus.x;
              const vdy = botCenterY - virus.y;
              const vd = Math.hypot(vdx, vdy) || 0.001;
              const dangerVDist = maxR + VIRUS_RADIUS + 95;
              if (vd < dangerVDist) {
                const vPush = ((dangerVDist - vd) / dangerVDist) * 2.4;
                escapeForceX += (vdx / vd) * vPush;
                escapeForceY += (vdy / vd) * vPush;
              }
            }
          }

          // Wall and corner repulsion: never get stuck in corners!
          const wallMargin = 280;
          if (botCenterX < wallMargin) escapeForceX += ((wallMargin - botCenterX) / wallMargin) * 2.5;
          if (botCenterX > MAP_SIZE - wallMargin) escapeForceX -= ((botCenterX - (MAP_SIZE - wallMargin)) / wallMargin) * 2.5;
          if (botCenterY < wallMargin) escapeForceY += ((wallMargin - botCenterY) / wallMargin) * 2.5;
          if (botCenterY > MAP_SIZE - wallMargin) escapeForceY -= ((botCenterY - (MAP_SIZE - wallMargin)) / wallMargin) * 2.5;

          const cornerDist = 420;
          const dTL = Math.hypot(botCenterX, botCenterY);
          const dTR = Math.hypot(MAP_SIZE - botCenterX, botCenterY);
          const dBL = Math.hypot(botCenterX, MAP_SIZE - botCenterY);
          const dBR = Math.hypot(MAP_SIZE - botCenterX, MAP_SIZE - botCenterY);
          if (dTL < cornerDist) {
            const p = (cornerDist - dTL) / cornerDist;
            escapeForceX += p * p * 3.5;
            escapeForceY += p * p * 3.5;
          }
          if (dTR < cornerDist) {
            const p = (cornerDist - dTR) / cornerDist;
            escapeForceX -= p * p * 3.5;
            escapeForceY -= p * p * 3.5;
          }
          if (dBL < cornerDist) {
            const p = (cornerDist - dBL) / cornerDist;
            escapeForceX += p * p * 3.5;
            escapeForceY += p * p * 3.5;
          }
          if (dBR < cornerDist) {
            const p = (cornerDist - dBR) / cornerDist;
            escapeForceX -= p * p * 3.5;
            escapeForceY -= p * p * 3.5;
          }

          const escapeMag = Math.hypot(escapeForceX, escapeForceY);
          if (escapeMag > 0.001) {
            let finalDirX = escapeForceX / escapeMag;
            let finalDirY = escapeForceY / escapeMag;

            if (Math.abs(bot.aimErrorAngle) > 0.01) {
              const cos = Math.cos(bot.aimErrorAngle);
              const sin = Math.sin(bot.aimErrorAngle);
              finalDirX = finalDirX * cos - finalDirY * sin;
              finalDirY = (escapeForceX / escapeMag) * sin + finalDirY * cos;
            }

            bot.targetX = Math.max(100, Math.min(MAP_SIZE - 100, botCenterX + finalDirX * 600));
            bot.targetY = Math.max(100, Math.min(MAP_SIZE - 100, botCenterY + finalDirY * 600));

            // Occasionally eject mass to escape threats when cornered
            if (closestThreatDist < maxR + (closestThreatCell?.radius || 50) + 110 && maxR >= 35 && now - bot.lastEjectTime > 320) {
              if (bot.personality === 'cautious' || Math.random() < 0.4) {
                botEjectMass(bot, largestCell, -finalDirX, -finalDirY);
                bot.lastEjectTime = now;
              }
            }
          }
          return;
        }

        bot.fleeing = false;

        // -------------------------------------------------------------
        // VIRUS FEEDING TACTIC
        // If near a virus and an enemy is on the other side, shoot virus at enemy!
        // -------------------------------------------------------------
        if (maxR >= 35 && now - bot.lastEjectTime > 220 && (bot.personality === 'aggressive' || bot.skill > 0.8)) {
          for (let v = 0; v < currentViruses.length; v++) {
            const virus = currentViruses[v];
            const vdx = virus.x - botCenterX;
            const vdy = virus.y - botCenterY;
            const distToVirus = Math.hypot(vdx, vdy);
            if (distToVirus > maxR + VIRUS_RADIUS + 20 && distToVirus < 340) {
              let enemyTarget: { x: number; y: number; radius: number } | null = null;
              for (let p = 0; p < currentPlayers.length; p++) {
                const pl = currentPlayers[p];
                const edx = pl.x - virus.x;
                const edy = pl.y - virus.y;
                const eDist = Math.hypot(edx, edy);
                if (eDist > VIRUS_RADIUS && eDist < 400 && pl.radius > VIRUS_RADIUS * 0.9) {
                  const dot = (vdx * edx + vdy * edy) / (distToVirus * eDist);
                  if (dot > 0.72) {
                    enemyTarget = pl;
                    break;
                  }
                }
              }
              if (enemyTarget) {
                const shootX = vdx / distToVirus;
                const shootY = vdy / distToVirus;
                botEjectMass(bot, largestCell, shootX, shootY);
                bot.lastEjectTime = now;
                bot.targetX = virus.x;
                bot.targetY = virus.y;
                return;
              }
            }
          }
        }

        // -------------------------------------------------------------
        // PRIORITY 2: CHASE REACHABLE PREY (<0.87x radius)
        // With Movement Prediction, Flanking Pincers, and Hunt-Player Bias
        // -------------------------------------------------------------
        let bestPrey: { x: number; y: number; vx?: number; vy?: number; moveVx?: number; moveVy?: number; radius: number; isPlayer?: boolean } | null = null;
        let bestPreyScore = -1;
        let bestPreyDist = Infinity;

        const evaluatePrey = (
          prey: { x: number; y: number; vx?: number; vy?: number; moveVx?: number; moveVy?: number; radius: number },
          isPlayer = false
        ) => {
          if (prey.radius < maxR * 0.87) {
            if (bot.personality === 'farmer' && bot.skill < 0.85) {
              const d = Math.hypot(prey.x - botCenterX, prey.y - botCenterY);
              if (d > 280) return;
            }
            const dx = prey.x - botCenterX;
            const dy = prey.y - botCenterY;
            const dSq = dx * dx + dy * dy;
            if (dSq > visionRadiusSq) return;
            const d = Math.sqrt(dSq) || 0.001;

            if (!isVirusSafe) {
              for (let v = 0; v < currentViruses.length; v++) {
                const virus = currentViruses[v];
                const vDist = distToSegment(virus.x, virus.y, botCenterX, botCenterY, prey.x, prey.y);
                if (vDist < VIRUS_RADIUS + maxR * 0.85) {
                  return;
                }
              }
            }

            let score = (prey.radius * prey.radius) / (d + 80);

            // Hunt-the-player bias scaled gently by player score
            if (isPlayer) {
              const pScore = scoreRef.current;
              let playerBias = 1.0;
              if (pScore < 160) {
                playerBias = 0.65; // fair early game
              } else if (pScore < 750) {
                playerBias = 0.85 + ((pScore - 160) / 590) * 0.40;
              } else {
                playerBias = 1.35; // tense late game
              }
              if (currentPlayers.length > 1) {
                playerBias *= 1.30; // split player is appetizing!
              }
              if (bot.personality === 'aggressive') {
                playerBias *= 1.25;
              }
              score *= playerBias;
            }

            if (score > bestPreyScore) {
              bestPreyScore = score;
              bestPrey = { ...prey, isPlayer };
              bestPreyDist = d;
            }
          }
        };

        for (let p = 0; p < currentPlayers.length; p++) {
          evaluatePrey(currentPlayers[p], true);
        }
        for (let b = 0; b < allBots.length; b++) {
          const other = allBots[b];
          if (other.id === bot.id) continue;
          for (let c = 0; c < other.cells.length; c++) {
            evaluatePrey(other.cells[c], false);
          }
        }

        if (bestPrey && !isDistracted) {
          bot.chasing = true;
          const prey = bestPrey;

          // Split to catch fleeing smaller target when in range
          const splitCooldown = bot.personality === 'aggressive' ? 3200 : bot.personality === 'cautious' ? 6000 : 4500;
          const canSplit = maxR >= 35 && bot.cells.length < 4 && (now - bot.lastSplitTime > splitCooldown);
          const splitRadius = maxR / 1.414;
          const isSplitKillable = splitRadius > prey.radius * 1.12;
          const inSplitRange = bestPreyDist > maxR + 45 && bestPreyDist < maxR + 265;

          if (canSplit && isSplitKillable && inSplitRange && (bot.personality !== 'farmer' || Math.random() < 0.25)) {
            let virusInPath = false;
            for (let v = 0; v < currentViruses.length; v++) {
              const virus = currentViruses[v];
              if (distToSegment(virus.x, virus.y, largestCell.x, largestCell.y, prey.x, prey.y) < VIRUS_RADIUS + splitRadius * 0.8) {
                virusInPath = true;
                break;
              }
            }

            if (!virusInPath) {
              let threatNearby = false;
              if (bot.personality === 'cautious' || bot.skill > 0.82) {
                for (let p = 0; p < currentPlayers.length; p++) {
                  if (currentPlayers[p].radius > splitRadius * 1.15 && Math.hypot(currentPlayers[p].x - botCenterX, currentPlayers[p].y - botCenterY) < 450) {
                    threatNearby = true;
                    break;
                  }
                }
              }

              if (!threatNearby) {
                const sDx = prey.x - largestCell.x;
                const sDy = prey.y - largestCell.y;
                const sMag = Math.hypot(sDx, sDy) || 1;
                botSplitTowards(bot, largestCell, sDx / sMag, sDy / sMag);
                bot.targetX = prey.x;
                bot.targetY = prey.y;
                return;
              }
            }
          }

          // 1. Movement Prediction: aim at target position + velocity * time-to-reach
          const pVx = (prey.moveVx || 0) + (prey.vx || 0);
          const pVy = (prey.moveVy || 0) + (prey.vy || 0);
          const botSpeed = 1.38 / Math.pow(Math.max(12, maxR) / INITIAL_RADIUS, 0.44);
          const timeToReach = bestPreyDist / Math.max(0.6, botSpeed * 60);
          const leadMult = Math.min(1.3, timeToReach * (0.55 + 0.45 * bot.skill));
          let leadX = prey.x + pVx * leadMult;
          let leadY = prey.y + pVy * leadMult;

          // 2. Pincer Tactic: if another aggressive bot is also hunting near the same target, approach from flanking angles
          if (bot.personality === 'aggressive') {
            for (let ob = 0; ob < allBots.length; ob++) {
              const other = allBots[ob];
              if (other.id !== bot.id && other.personality === 'aggressive' && other.chasing) {
                const dToOther = Math.hypot(other.x - botCenterX, other.y - botCenterY);
                if (dToOther < 600) {
                  const dOtherToPrey = Math.hypot(other.targetX - prey.x, other.targetY - prey.y);
                  if (dOtherToPrey < 350) {
                    const flankAngle = bot.id < other.id ? 0.45 : -0.45;
                    const cdx = leadX - botCenterX;
                    const cdy = leadY - botCenterY;
                    const cosF = Math.cos(flankAngle);
                    const sinF = Math.sin(flankAngle);
                    leadX = botCenterX + (cdx * cosF - cdy * sinF);
                    leadY = botCenterY + (cdx * sinF + cdy * cosF);
                    break;
                  }
                }
              }
            }
          }

          // Small human aim wobble
          if (Math.abs(bot.aimErrorAngle) > 0.02) {
            const cdx = leadX - botCenterX;
            const cdy = leadY - botCenterY;
            const cos = Math.cos(bot.aimErrorAngle);
            const sin = Math.sin(bot.aimErrorAngle);
            leadX = botCenterX + (cdx * cos - cdy * sin);
            leadY = botCenterY + (cdx * sin + cdy * cos);
          }

          bot.targetX = Math.max(100, Math.min(MAP_SIZE - 100, leadX));
          bot.targetY = Math.max(100, Math.min(MAP_SIZE - 100, leadY));
          return;
        }

        bot.chasing = false;

        // -------------------------------------------------------------
        // PRIORITY 3: EAT FLOATING EJECTED MASS (Mass 32 each!)
        // -------------------------------------------------------------
        let bestEjectedMass: Food | null = null;
        let bestEjectedDist = Infinity;
        for (let f = 0; f < allFoods.length; f++) {
          const food = allFoods[f];
          if (!food.eaten && (food.mass === EJECTED_MASS_VALUE || food.radius === EJECTED_MASS_RADIUS)) {
            const fdx = food.x - botCenterX;
            const fdy = food.y - botCenterY;
            const fd = Math.hypot(fdx, fdy);
            if (fd < visionRadius && fd < bestEjectedDist) {
              bestEjectedDist = fd;
              bestEjectedMass = food;
            }
          }
        }
        if (bestEjectedMass && bestEjectedDist < 480) {
          bot.targetX = bestEjectedMass.x;
          bot.targetY = bestEjectedMass.y;
          return;
        }

        // -------------------------------------------------------------
        // PRIORITY 4: DENSEST CLUSTER OF PELLETS (Spatial Grid)
        // -------------------------------------------------------------
        const minCol = Math.max(0, Math.floor((botCenterX - visionRadius) / GRID_CELL_SIZE));
        const maxCol = Math.min(GRID_COLS - 1, Math.floor((botCenterX + visionRadius) / GRID_CELL_SIZE));
        const minRow = Math.max(0, Math.floor((botCenterY - visionRadius) / GRID_CELL_SIZE));
        const maxRow = Math.min(GRID_ROWS - 1, Math.floor((botCenterY + visionRadius) / GRID_CELL_SIZE));

        let bestGridCount = 0;
        let bestClusterX = 0;
        let bestClusterY = 0;

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const idx = c + r * GRID_COLS;
            const count = foodGridCount[idx];
            if (count > bestGridCount) {
              bestGridCount = count;
              bestClusterX = foodGridSumX[idx] / count;
              bestClusterY = foodGridSumY[idx] / count;
            }
          }
        }

        const tokens = ghostTokensRef.current;
        let nearestToken: GhostToken | null = null;
        let nearestTokenDist = Infinity;
        for (let t = 0; t < tokens.length; t++) {
          const tk = tokens[t];
          if (tk.eaten) continue;
          const tdx = tk.x - botCenterX;
          const tdy = tk.y - botCenterY;
          const td = Math.hypot(tdx, tdy);
          if (td < visionRadius && td < nearestTokenDist) {
            nearestTokenDist = td;
            nearestToken = tk;
          }
        }

        if (nearestToken && nearestTokenDist < 450) {
          bot.targetX = nearestToken.x;
          bot.targetY = nearestToken.y;
          return;
        }

        if (bestGridCount > 0) {
          bot.targetX = bestClusterX;
          bot.targetY = bestClusterY;
          return;
        }

        // -------------------------------------------------------------
        // PRIORITY 5: WANDER
        // -------------------------------------------------------------
        const distToTarget = Math.hypot(bot.targetX - botCenterX, bot.targetY - botCenterY);
        if (distToTarget < 50 || Math.random() < 0.02) {
          bot.targetX = Math.random() * (MAP_SIZE - 400) + 200;
          bot.targetY = Math.random() * (MAP_SIZE - 400) + 200;
        }
      };

      // -------------------------------------------------------------------------
      // BOT MOVEMENT & MULTI-CELL PHYSICS (Separation & Merging)
      // -------------------------------------------------------------------------
      const currentBots = botsRef.current;
      for (let bIdx = 0; bIdx < currentBots.length; bIdx++) {
        const bot = currentBots[bIdx];
        updateBotAI(bot);

        // Move bot cells
        for (let cIdx = 0; cIdx < bot.cells.length; cIdx++) {
          const cell = bot.cells[cIdx];
          const dx = bot.targetX - cell.x;
          const dy = bot.targetY - cell.y;
          const dist = Math.hypot(dx, dy) || 1;

          const botSpeed = 1.38 / Math.pow(Math.max(12, cell.radius) / INITIAL_RADIUS, 0.44);
          const targetVx = (dx / dist) * botSpeed;
          const targetVy = (dy / dist) * botSpeed;

          const accel = 1 - Math.exp(-4.2 * (dt / 1000));
          cell.moveVx = (cell.moveVx || 0) + (targetVx - (cell.moveVx || 0)) * accel;
          cell.moveVy = (cell.moveVy || 0) + (targetVy - (cell.moveVy || 0)) * accel;

          // Split burst decay
          const burstDecay = Math.pow(0.88, dtRatio);
          cell.vx = (cell.vx || 0) * burstDecay;
          cell.vy = (cell.vy || 0) * burstDecay;
          if (Math.hypot(cell.vx, cell.vy) < 0.05) {
            cell.vx = 0;
            cell.vy = 0;
          }

          cell.x += ((cell.moveVx || 0) + (cell.vx || 0)) * dtRatio;
          cell.y += ((cell.moveVy || 0) + (cell.vy || 0)) * dtRatio;
          updateCellJelly(cell, dtRatio);

          cell.x = Math.max(cell.radius, Math.min(MAP_SIZE - cell.radius, cell.x));
          cell.y = Math.max(cell.radius, Math.min(MAP_SIZE - cell.radius, cell.y));
        }

        // Multi-cell separation & merging
        if (bot.cells.length > 1) {
          const mergedIndices = new Set<number>();
          for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < bot.cells.length; i++) {
              if (mergedIndices.has(i)) continue;
              for (let j = i + 1; j < bot.cells.length; j++) {
                if (mergedIndices.has(j)) continue;

                const c1 = bot.cells[i];
                const c2 = bot.cells[j];

                if (c2.ignoreParentId === c1.id && now < (c2.ignoreParentUntil || 0)) continue;
                if (c1.ignoreParentId === c2.id && now < (c1.ignoreParentUntil || 0)) continue;

                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const distSq = dx * dx + dy * dy;
                const totalR = c1.radius + c2.radius;

                if (distSq < totalR * totalR) {
                  const dist = Math.sqrt(distSq) || 0.001;
                  const nx = dx / dist;
                  const ny = dy / dist;

                  const m1 = c1.radius * c1.radius;
                  const m2 = c2.radius * c2.radius;
                  const totalM = m1 + m2;
                  const w1 = m2 / totalM;
                  const w2 = m1 / totalM;

                  const mergeCooldownMs = (isInstantMergeMode || instantMergeRef.current)
                    ? 250
                    : Math.max(20000, 20000 + Math.max(c1.radius, c2.radius) * 12);
                  const canMerge = (now - c1.splitTime >= mergeCooldownMs) && (now - c2.splitTime >= mergeCooldownMs);

                  if (canMerge) {
                    const pull = 0.18 * (totalR - dist) * dtRatio;
                    c1.x += nx * pull * w1;
                    c1.y += ny * pull * w1;
                    c2.x -= nx * pull * w2;
                    c2.y -= ny * pull * w2;

                    if (dist < Math.max(c1.radius, c2.radius) * 0.72 || dist < totalR * 0.48) {
                      c1.radius = Math.sqrt(totalM);
                      c1.renderRadius = c1.radius;
                      c1.x = (c1.x * m1 + c2.x * m2) / totalM;
                      c1.y = (c1.y * m1 + c2.y * m2) / totalM;
                      c1.vx = (c1.vx * m1 + c2.vx * m2) / totalM;
                      c1.vy = (c1.vy * m1 + c2.vy * m2) / totalM;
                      c1.moveVx = ((c1.moveVx || 0) * m1 + (c2.moveVx || 0) * m2) / totalM;
                      c1.moveVy = ((c1.moveVy || 0) * m1 + (c2.moveVy || 0) * m2) / totalM;
                      c1.splitTime = Math.min(c1.splitTime, c2.splitTime);
                      if (c1.jelly) {
                        for (let k = 0; k < 48; k++) {
                          c1.jelly.dr[k] = 0;
                          c1.jelly.vr[k] = 0;
                        }
                        c1.jelly.pulseTarget = 1.05;
                        c1.jelly.rippleAmp = 1.4;
                      }
                      mergedIndices.add(j);
                    }
                  } else {
                    const overlap = totalR - dist;
                    const stiffness = 0.42 * dtRatio;
                    const push = overlap * stiffness;

                    c1.x -= nx * push * w1;
                    c1.y -= ny * push * w1;
                    c2.x += nx * push * w2;
                    c2.y -= ny * push * w2;

                    if (pass === 0) {
                      applyCellSquash(c1, Math.atan2(ny, nx), push * 0.4);
                      applyCellSquash(c2, Math.atan2(-ny, -nx), push * 0.4);
                    }

                    c1.x = Math.max(c1.radius, Math.min(MAP_SIZE - c1.radius, c1.x));
                    c1.y = Math.max(c1.radius, Math.min(MAP_SIZE - c1.radius, c1.y));
                    c2.x = Math.max(c2.radius, Math.min(MAP_SIZE - c2.radius, c2.x));
                    c2.y = Math.max(c2.radius, Math.min(MAP_SIZE - c2.radius, c2.y));
                  }
                }
              }
            }
          }

          if (mergedIndices.size > 0) {
            bot.cells = bot.cells.filter((_, idx) => !mergedIndices.has(idx));
          }
        }

        // Synchronize bot center of mass & effective radius
        let bSumX = 0, bSumY = 0, bTotalM = 0;
        for (let k = 0; k < bot.cells.length; k++) {
          const c = bot.cells[k];
          const m = c.radius * c.radius;
          bTotalM += m;
          bSumX += c.x * m;
          bSumY += c.y * m;
        }
        if (bTotalM > 0) {
          bot.x = bSumX / bTotalM;
          bot.y = bSumY / bTotalM;
          bot.radius = Math.sqrt(bTotalM);
        } else if (bot.cells[0]) {
          bot.x = bot.cells[0].x;
          bot.y = bot.cells[0].y;
          bot.radius = bot.cells[0].radius;
        }
      }

      // -------------------------------------------------------------------------
      // SPATIAL-GRID POWERED FOOD CONSUMPTION (Zero Allocation)
      // -------------------------------------------------------------------------
      let anyFoodEaten = false;

      const consumeFoodForCell = (cell: { x: number; y: number; radius: number; renderX?: number; renderY?: number; id?: string; jelly?: SoftBodyJelly }) => {
        const minC = Math.max(0, Math.floor((cell.x - cell.radius) / GRID_CELL_SIZE));
        const maxC = Math.min(GRID_COLS - 1, Math.floor((cell.x + cell.radius) / GRID_CELL_SIZE));
        const minR = Math.max(0, Math.floor((cell.y - cell.radius) / GRID_CELL_SIZE));
        const maxR = Math.min(GRID_ROWS - 1, Math.floor((cell.y + cell.radius) / GRID_CELL_SIZE));
        const cellSqR = cell.radius * cell.radius;

        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            let fIdx = foodGridHead[c + r * GRID_COLS];
            while (fIdx !== -1) {
              const food = allFoods[fIdx];
              if (!food.eaten) {
                if (!(food.canBeEatenAfter && now < food.canBeEatenAfter && food.ownerCellId === cell.id)) {
                  const fdx = cell.x - food.x;
                  const fdy = cell.y - food.y;
                  if (fdx * fdx + fdy * fdy < cellSqR) {
                    const massGain = food.mass !== undefined ? food.mass : 1.2;
                    cell.radius = Math.sqrt(cell.radius * cell.radius + massGain);
                    food.eaten = true;
                    anyFoodEaten = true;
                    triggerEatAnimation(cell, food.x, food.y, food.radius, food.color, now);
                    triggerPelletPop(food.x, food.y, food.color, now);
                    if (cell.jelly) {
                      cell.jelly.pulseTarget = 1.05;
                      cell.jelly.rippleAmp = Math.min(2.0, cell.jelly.rippleAmp + 0.35);
                    }
                  }
                }
              }
              fIdx = foodGridNext[fIdx];
            }
          }
        }
      };

      for (let i = 0; i < currentCells.length; i++) {
        consumeFoodForCell(currentCells[i]);
      }

      for (let i = 0; i < currentBots.length; i++) {
        const b = currentBots[i];
        for (let k = 0; k < b.cells.length; k++) {
          consumeFoodForCell(b.cells[k]);
        }
      }

      // Virus eating ejected mass and shooting mechanic (authentic Agar.io)
      const currentViruses = virusesRef.current;
      for (let i = 0; i < currentViruses.length; i++) {
        const virus = currentViruses[i];
        if (virus.vx || virus.vy) {
          virus.x += (virus.vx || 0) * dtRatio;
          virus.y += (virus.vy || 0) * dtRatio;
          const vDecay = Math.pow(0.93, dtRatio);
          virus.vx = (virus.vx || 0) * vDecay;
          virus.vy = (virus.vy || 0) * vDecay;
          if (Math.hypot(virus.vx, virus.vy) < 0.05) {
            virus.vx = 0;
            virus.vy = 0;
          }
          virus.x = Math.max(virus.radius, Math.min(MAP_SIZE - virus.radius, virus.x));
          virus.y = Math.max(virus.radius, Math.min(MAP_SIZE - virus.radius, virus.y));
        }

        const vTotalR = virus.radius + EJECTED_MASS_RADIUS;
        const vSqR = vTotalR * vTotalR;
        for (let j = 0; j < allFoods.length; j++) {
          const food = allFoods[j];
          if (food.eaten) continue;
          if (food.mass !== EJECTED_MASS_VALUE && food.radius !== EJECTED_MASS_RADIUS) continue;
          const vdx = virus.x - food.x;
          const vdy = virus.y - food.y;
          if (vdx * vdx + vdy * vdy < vSqR) {
            food.eaten = true;
            anyFoodEaten = true;
            virus.fedCount = (virus.fedCount || 0) + 1;
            virus.radius = VIRUS_RADIUS;

            // Once fed 7 times, virus shoots!
            if (virus.fedCount >= 7) {
              virus.fedCount = 0;
              virus.radius = VIRUS_RADIUS;

              let shootDirX = food.vx || 0;
              let shootDirY = food.vy || 0;
              const sMag = Math.hypot(shootDirX, shootDirY);
              if (sMag > 0.1) {
                shootDirX /= sMag;
                shootDirY /= sMag;
              } else {
                shootDirX = 0;
                shootDirY = -1;
              }

              const shootSpeed = 26;
              const spawnX = Math.max(VIRUS_RADIUS, Math.min(MAP_SIZE - VIRUS_RADIUS, virus.x + shootDirX * (VIRUS_RADIUS + 15)));
              const spawnY = Math.max(VIRUS_RADIUS, Math.min(MAP_SIZE - VIRUS_RADIUS, virus.y + shootDirY * (VIRUS_RADIUS + 15)));

              currentViruses.push({
                id: generateId(),
                x: spawnX,
                y: spawnY,
                radius: VIRUS_RADIUS,
                color: '#33ff33',
                vx: shootDirX * shootSpeed,
                vy: shootDirY * shootSpeed,
                fedCount: 0
              });
              break;
            }
          }
        }
      }

      if (anyFoodEaten) {
        let writeIdx = 0;
        for (let i = 0; i < allFoods.length; i++) {
          if (!allFoods[i].eaten) {
            allFoods[writeIdx++] = allFoods[i];
          }
        }
        allFoods.length = writeIdx;
      }

      while (allFoods.length < FOOD_COUNT) {
        const fx = Math.random() * MAP_SIZE;
        const fy = Math.random() * MAP_SIZE;
        allFoods.push({
          id: generateId(),
          x: fx,
          y: fy,
          renderX: fx,
          renderY: fy,
          radius: NORMAL_FOOD_RADIUS,
          color: randomColor()
        });
      }

      // Ghost Token consumption & persistent collection
      const currentTokens = ghostTokensRef.current;
      let anyTokenEaten = false;
      let tokensEatenByPlayer = 0;

      for (let i = 0; i < currentCells.length; i++) {
        const cell = currentCells[i];
        const cellSqR = cell.radius * cell.radius;
        for (let j = 0; j < currentTokens.length; j++) {
          const token = currentTokens[j];
          if (token.eaten) continue;
          const cdx = cell.x - token.x;
          const cdy = cell.y - token.y;
          if (cdx * cdx + cdy * cdy < cellSqR) {
            cell.radius = Math.sqrt(cell.radius * cell.radius + GHOST_TOKEN_MASS);
            token.eaten = true;
            anyTokenEaten = true;
            tokensEatenByPlayer++;
          }
        }
      }

      for (let i = 0; i < currentBots.length; i++) {
        const bot = currentBots[i];
        for (let k = 0; k < bot.cells.length; k++) {
          const c = bot.cells[k];
          const cSqR = c.radius * c.radius;
          for (let j = 0; j < currentTokens.length; j++) {
            const token = currentTokens[j];
            if (token.eaten) continue;
            const cdx = c.x - token.x;
            const cdy = c.y - token.y;
            if (cdx * cdx + cdy * cdy < cSqR) {
              c.radius = Math.sqrt(c.radius * c.radius + GHOST_TOKEN_MASS);
              token.eaten = true;
              anyTokenEaten = true;
            }
          }
        }
      }

      if (tokensEatenByPlayer > 0) {
        ghostTokenCountRef.current += tokensEatenByPlayer;
        setGhostTokenCount(ghostTokenCountRef.current);
        try {
          localStorage.setItem(STORAGE_KEY_GHOST_TOKEN, ghostTokenCountRef.current.toString());
        } catch {
          // safe ignore for restricted sandboxes
        }
      }

      if (anyTokenEaten) {
        let tokenWriteIdx = 0;
        for (let i = 0; i < currentTokens.length; i++) {
          if (!currentTokens[i].eaten) {
            currentTokens[tokenWriteIdx++] = currentTokens[i];
          }
        }
        currentTokens.length = tokenWriteIdx;
      }

      while (ghostTokensRef.current.length < GHOST_TOKEN_TARGET_COUNT) {
        const cx = Math.random() * (MAP_SIZE - 100) + 50;
        const cy = Math.random() * (MAP_SIZE - 100) + 50;
        ghostTokensRef.current.push({
          id: generateId(),
          x: cx,
          y: cy,
          radius: GHOST_TOKEN_RADIUS,
          pulsePhase: Math.random() * Math.PI * 2
        });
      }

      // Virus collision & pop
      const poppedVirusIds = new Set<string>();
      const nextPlayerCells: PlayerCell[] = [];
      let playerCellsChanged = false;

      const massBeforeVirus = currentCells.reduce((sum, c) => sum + c.radius * c.radius, 0);

      currentCells.forEach((cell, cellIdx) => {
        let cellPopped = false;

        virusesRef.current.forEach(virus => {
          if (cellPopped || poppedVirusIds.has(virus.id)) return;
          const vdx = cell.x - virus.x;
          const vdy = cell.y - virus.y;
          if (vdx * vdx + vdy * vdy < cell.radius * cell.radius && cell.radius > virus.radius) {
            poppedVirusIds.add(virus.id);
            cellPopped = true;
            playerCellsChanged = true;

            const remainingUnprocessed = currentCells.length - 1 - cellIdx;
            const occupiedSoFar = nextPlayerCells.length + remainingUnprocessed;
            const fragments = popPlayerCell(cell, virus, now, occupiedSoFar);
            nextPlayerCells.push(...fragments);
          }
        });

        if (!cellPopped) {
          nextPlayerCells.push(cell);
        }
      });

      while (nextPlayerCells.length > 16) {
        let minIdx1 = 0;
        let minIdx2 = 1;
        if (nextPlayerCells[minIdx2].radius < nextPlayerCells[minIdx1].radius) {
          minIdx1 = 1;
          minIdx2 = 0;
        }
        for (let i = 2; i < nextPlayerCells.length; i++) {
          const r = nextPlayerCells[i].radius;
          if (r < nextPlayerCells[minIdx1].radius) {
            minIdx2 = minIdx1;
            minIdx1 = i;
          } else if (r < nextPlayerCells[minIdx2].radius) {
            minIdx2 = i;
          }
        }

        const c1 = nextPlayerCells[minIdx1];
        const c2 = nextPlayerCells[minIdx2];
        const m1 = c1.radius * c1.radius;
        const m2 = c2.radius * c2.radius;
        const combinedMass = m1 + m2;
        const newRadius = Math.sqrt(combinedMass);

        c1.x = (c1.x * m1 + c2.x * m2) / combinedMass;
        c1.y = (c1.y * m1 + c2.y * m2) / combinedMass;
        c1.vx = (c1.vx * m1 + c2.vx * m2) / combinedMass;
        c1.vy = (c1.vy * m1 + c2.vy * m2) / combinedMass;
        c1.radius = newRadius;
        if (c1.renderRadius !== undefined && c2.renderRadius !== undefined) {
          c1.renderRadius = Math.sqrt(c1.renderRadius * c1.renderRadius + c2.renderRadius * c2.renderRadius);
        } else {
          c1.renderRadius = newRadius;
        }
        c1.splitTime = Math.max(c1.splitTime, c2.splitTime);

        nextPlayerCells.splice(minIdx2, 1);
        playerCellsChanged = true;
      }

      if (playerCellsChanged) {
        playerCellsRef.current = nextPlayerCells;
        const massAfterVirus = nextPlayerCells.reduce((sum, c) => sum + c.radius * c.radius, 0);
        console.assert(
          massAfterVirus >= massBeforeVirus - 0.05,
          `[Mass Conservation Violation] massBefore: ${massBeforeVirus.toFixed(2)}, massAfter: ${massAfterVirus.toFixed(2)}`
        );
      }

      // Bot cell virus collision & pop (fragments bot cell with authentic mass conservation)
      botsRef.current.forEach(bot => {
        const nextBotCells: BotCell[] = [];
        let botCellsChanged = false;

        bot.cells.forEach(cell => {
          let cellPopped = false;
          virusesRef.current.forEach(virus => {
            if (cellPopped || poppedVirusIds.has(virus.id)) return;
            const vdx = cell.x - virus.x;
            const vdy = cell.y - virus.y;
            if (vdx * vdx + vdy * vdy < cell.radius * cell.radius && cell.radius > virus.radius) {
              poppedVirusIds.add(virus.id);
              cellPopped = true;
              botCellsChanged = true;

              const originalMass = cell.radius * cell.radius;
              const availableSlots = Math.max(1, 8 - (bot.cells.length + nextBotCells.length));
              const numPieces = Math.min(5, Math.max(2, availableSlots));
              const pieceMass = originalMass / numPieces;
              const pieceRadius = Math.sqrt(pieceMass);

              for (let p = 0; p < numPieces; p++) {
                const angle = (p / numPieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
                const popSpeed = 15.5;
                const spawnX = Math.max(pieceRadius, Math.min(MAP_SIZE - pieceRadius, virus.x + Math.cos(angle) * (pieceRadius + 12)));
                const spawnY = Math.max(pieceRadius, Math.min(MAP_SIZE - pieceRadius, virus.y + Math.sin(angle) * (pieceRadius + 12)));

                nextBotCells.push({
                  id: generateId(),
                  x: spawnX,
                  y: spawnY,
                  renderX: cell.renderX ?? cell.x,
                  renderY: cell.renderY ?? cell.y,
                  renderRadius: pieceRadius * 0.7,
                  vx: Math.cos(angle) * popSpeed + (cell.vx || 0) * 0.2,
                  vy: Math.sin(angle) * popSpeed + (cell.vy || 0) * 0.2,
                  moveVx: 0,
                  moveVy: 0,
                  radius: pieceRadius,
                  splitTime: now,
                  phaseOffset: Math.random() * Math.PI * 2,
                  color: bot.color,
                  name: bot.name
                });
              }
            }
          });

          if (!cellPopped) {
            nextBotCells.push(cell);
          }
        });

        if (botCellsChanged) {
          bot.cells = nextBotCells;
        }
      });

      if (poppedVirusIds.size > 0) {
        virusesRef.current = virusesRef.current.filter(v => !poppedVirusIds.has(v.id));
        poppedVirusIds.forEach(() => {
          setTimeout(() => {
            virusesRef.current.push({
              id: generateId(),
              x: Math.random() * (MAP_SIZE - 200) + 100,
              y: Math.random() * (MAP_SIZE - 200) + 100,
              radius: VIRUS_RADIUS,
              color: '#33ff33'
            });
          }, 3000 + Math.random() * 2000);
        });
      }

      // -------------------------------------------------------------
      // CELL CONSUMPTION: PLAYER vs BOTS & BOT vs BOT
      // -------------------------------------------------------------
      // Player eats Bot cells
      currentBots.forEach(bot => {
        bot.cells = bot.cells.filter(bCell => {
          for (let i = 0; i < playerCellsRef.current.length; i++) {
            const pCell = playerCellsRef.current[i];
            const dx = pCell.x - bCell.x;
            const dy = pCell.y - bCell.y;
            if (dx * dx + dy * dy < pCell.radius * pCell.radius && pCell.radius > bCell.radius * 1.10) {
              pCell.radius = Math.sqrt(pCell.radius * pCell.radius + bCell.radius * bCell.radius * 0.75);
              triggerEatAnimation(pCell, bCell.x, bCell.y, bCell.radius, bot.color, now);
              if (pCell.jelly) {
                pCell.jelly.pulseTarget = 1.09;
                pCell.jelly.rippleAmp = Math.min(4.5, pCell.jelly.rippleAmp + 1.8);
              }
              return false;
            }
          }
          return true;
        });
      });

      // Bot cells eat Player cells
      const deadCellIds = new Set<string>();
      playerCellsRef.current.forEach(pCell => {
        currentBots.forEach(bot => {
          bot.cells.forEach(bCell => {
            if (deadCellIds.has(pCell.id)) return;
            const dx = bCell.x - pCell.x;
            const dy = bCell.y - pCell.y;
            if (dx * dx + dy * dy < bCell.radius * bCell.radius && bCell.radius > pCell.radius * 1.10) {
              bCell.radius = Math.sqrt(bCell.radius * bCell.radius + pCell.radius * pCell.radius * 0.75);
              deadCellIds.add(pCell.id);
              triggerEatAnimation(bCell, pCell.x, pCell.y, pCell.radius, playerColorRef.current || '#0284c7', now);
              if (bCell.jelly) {
                bCell.jelly.pulseTarget = 1.09;
                bCell.jelly.rippleAmp = Math.min(4.5, bCell.jelly.rippleAmp + 1.8);
              }
            }
          });
        });
      });

      if (deadCellIds.size > 0) {
        playerCellsRef.current = playerCellsRef.current.filter(c => !deadCellIds.has(c.id));
        if (playerCellsRef.current.length === 0) {
          isGameOverRef.current = true;
        }
      }

      // Bot cell eats other Bot cell
      for (let i = 0; i < currentBots.length; i++) {
        const botA = currentBots[i];
        for (let j = i + 1; j < currentBots.length; j++) {
          const botB = currentBots[j];

          botA.cells.forEach(cellA => {
            botB.cells = botB.cells.filter(cellB => {
              const dx = cellA.x - cellB.x;
              const dy = cellA.y - cellB.y;
              if (dx * dx + dy * dy < cellA.radius * cellA.radius && cellA.radius > cellB.radius * 1.10) {
                cellA.radius = Math.sqrt(cellA.radius * cellA.radius + cellB.radius * cellB.radius * 0.75);
                triggerEatAnimation(cellA, cellB.x, cellB.y, cellB.radius, botB.color, now);
                if (cellA.jelly) {
                  cellA.jelly.pulseTarget = 1.08;
                  cellA.jelly.rippleAmp = Math.min(4.0, cellA.jelly.rippleAmp + 1.5);
                }
                return false;
              }
              return true;
            });
          });

          botB.cells.forEach(cellB => {
            botA.cells = botA.cells.filter(cellA => {
              const dx = cellB.x - cellA.x;
              const dy = cellB.y - cellA.y;
              if (dx * dx + dy * dy < cellB.radius * cellB.radius && cellB.radius > cellA.radius * 1.10) {
                cellB.radius = Math.sqrt(cellB.radius * cellB.radius + cellA.radius * cellA.radius * 0.75);
                triggerEatAnimation(cellB, cellA.x, cellA.y, cellA.radius, botA.color, now);
                if (cellB.jelly) {
                  cellB.jelly.pulseTarget = 1.08;
                  cellB.jelly.rippleAmp = Math.min(4.0, cellB.jelly.rippleAmp + 1.5);
                }
                return false;
              }
              return true;
            });
          });
        }
      }

      // -------------------------------------------------------------
      // PERSISTENT BOT RESPAWNING (Names and colors strictly preserved)
      // -------------------------------------------------------------
      for (let i = 0; i < BOT_COUNT; i++) {
        if (!currentBots[i] || currentBots[i].cells.length === 0) {
          const slot = currentBots[i]?.botIndex ?? i;
          currentBots[i] = createBotInstance(slot, now, currentBots);
        }
      }

      // Throttled UI score and leaderboard update (avoids React re-render lag every frame)
      const currentScore = calculateTotalScore();
      scoreRef.current = currentScore;
      leaderboardTimerRef.current += dt;
      if (leaderboardTimerRef.current >= 350) {
        leaderboardTimerRef.current = 0;
        setScore(currentScore);

        const liveBots = botsRef.current;
        const botEntries = new Array(liveBots.length + 1);
        for (let i = 0; i < liveBots.length; i++) {
          const b = liveBots[i];
          const totalBotMass = b.cells.reduce((sum, c) => sum + c.radius * c.radius, 0);
          botEntries[i] = {
            name: b.name || 'An unnamed cell',
            score: Math.floor(totalBotMass / 10),
            isPlayer: false,
            color: b.color
          };
        }
        botEntries[liveBots.length] = {
          name: playerNameRef.current || 'You',
          score: currentScore,
          isPlayer: true
        };
        botEntries.sort((a, b) => b.score - a.score);
        const pIdx = botEntries.findIndex(e => e.isPlayer);
        setPlayerRank(pIdx >= 0 ? pIdx + 1 : null);
        setLeaderboard(botEntries.slice(0, 5));
      }

      if (activeEmojiRef.current) {
        activeEmojiRef.current.timeLeft -= dt;
        if (activeEmojiRef.current.timeLeft <= 0) {
          activeEmojiRef.current = null;
        }
      }
    };

    // Smooth render interpolation between physics steps (Agar.io/Sarok.io buttery jelly feel)
    const interpolate = (dt: number) => {
      const posLerp = 1 - Math.exp(-38 * (dt / 1000));
      const radLerp = 1 - Math.exp(-12 * (dt / 1000));
      const foodLerp = 1 - Math.exp(-28 * (dt / 1000));

      const cells = playerCellsRef.current;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c.renderX === undefined) c.renderX = c.x;
        else c.renderX += (c.x - c.renderX) * posLerp;

        if (c.renderY === undefined) c.renderY = c.y;
        else c.renderY += (c.y - c.renderY) * posLerp;

        if (c.renderRadius === undefined) c.renderRadius = c.radius;
        else c.renderRadius += (c.radius - c.renderRadius) * radLerp;
      }

      const bots = botsRef.current;
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        if (b.renderX === undefined) b.renderX = b.x;
        else b.renderX += (b.x - b.renderX) * posLerp;

        if (b.renderY === undefined) b.renderY = b.y;
        else b.renderY += (b.y - b.renderY) * posLerp;

        if (b.renderRadius === undefined) b.renderRadius = b.radius;
        else b.renderRadius += (b.radius - b.renderRadius) * radLerp;

        for (let k = 0; k < b.cells.length; k++) {
          const c = b.cells[k];
          if (c.renderX === undefined) c.renderX = c.x;
          else c.renderX += (c.x - c.renderX) * posLerp;

          if (c.renderY === undefined) c.renderY = c.y;
          else c.renderY += (c.y - c.renderY) * posLerp;

          if (c.renderRadius === undefined) c.renderRadius = c.radius;
          else c.renderRadius += (c.radius - c.renderRadius) * radLerp;
        }
      }

      const foods = foodsRef.current;
      for (let i = 0; i < foods.length; i++) {
        const f = foods[i];
        if (f.vx !== undefined || f.vy !== undefined) {
          if (f.renderX === undefined) f.renderX = f.x;
          else f.renderX += (f.x - f.renderX) * foodLerp;

          if (f.renderY === undefined) f.renderY = f.y;
          else f.renderY += (f.y - f.renderY) * foodLerp;
        } else {
          f.renderX = f.x;
          f.renderY = f.y;
        }
      }
    };

    const drawPlayerCell = (cell: PlayerCell, time: number) => {
      const name = playerNameRef.current;
      const cx = cell.renderX ?? cell.x;
      const cy = cell.renderY ?? cell.y;
      const cr = cell.renderRadius ?? cell.radius;
      const cellScore = Math.floor((cell.radius * cell.radius) / 10);

      renderSoftBodyCell(
        cx,
        cy,
        cr,
        playerColorRef.current || '#0284c7',
        playerSkinImgRef.current,
        cell.jelly,
        qualityRef.current
      );

      // Bold cell typography (name + score)
      const nameFontSize = Math.max(13, Math.min(cr * 0.32, 44));
      const showScore = cr >= 24;
      const nameY = showScore ? cy - cr * 0.08 : cy;

      ctx.font = `800 ${nameFontSize}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, nameFontSize * 0.22);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.strokeText(name, cx, nameY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, cx, nameY);

      if (showScore) {
        const scoreFontSize = Math.max(10, Math.min(nameFontSize * 0.58, 26));
        const scoreY = cy + cr * 0.22;
        ctx.font = `700 ${scoreFontSize}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.lineWidth = Math.max(2.5, scoreFontSize * 0.2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.strokeText(cellScore.toString(), cx, scoreY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(cellScore.toString(), cx, scoreY);
      }

      if (activeEmojiRef.current) {
        let largestCell = playerCellsRef.current[0];
        for (let i = 1; i < playerCellsRef.current.length; i++) {
          if (playerCellsRef.current[i].radius > largestCell.radius) {
            largestCell = playerCellsRef.current[i];
          }
        }
        if (cell.id === largestCell?.id) {
          const { emoji, timeLeft } = activeEmojiRef.current;
          const alpha = Math.min(1, timeLeft / 400);
          const img = emojiImagesRef.current[emoji];
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = alpha;
            // Draw uploaded custom emoji sticker centered on the player's cell
            const emojiSize = Math.max(38, cr * 1.6);
            ctx.drawImage(img, cx - emojiSize / 2, cy - emojiSize / 2, emojiSize, emojiSize);
            ctx.restore();
          }
        }
      }
    };

    const drawBot = (bot: BotCell, time: number) => {
      const bx = bot.renderX ?? bot.x;
      const by = bot.renderY ?? bot.y;
      const br = bot.renderRadius ?? bot.radius;
      const botScore = Math.floor((bot.radius * bot.radius) / 10);

      renderSoftBodyCell(
        bx,
        by,
        br,
        bot.color,
        bot.skinImg,
        bot.jelly,
        qualityRef.current
      );

      // Only draw name & score if bot has a name (30% are anonymous/unnamed)
      if (bot.name) {
        const nameFontSize = Math.max(12, Math.min(br * 0.32, 42));
        const showScore = br >= 24;
        const nameY = showScore ? by - br * 0.08 : by;

        ctx.font = `800 ${nameFontSize}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, nameFontSize * 0.22);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.strokeText(bot.name, bx, nameY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(bot.name, bx, nameY);

        if (showScore) {
          const scoreFontSize = Math.max(10, Math.min(nameFontSize * 0.58, 24));
          const scoreY = by + br * 0.22;
          ctx.font = `700 ${scoreFontSize}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.lineWidth = Math.max(2.5, scoreFontSize * 0.2);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
          ctx.strokeText(botScore.toString(), bx, scoreY);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(botScore.toString(), bx, scoreY);
        }
      }
    };

    const draw = () => {
      const now = performance.now();
      const logicalWidth = canvas.clientWidth;
      const logicalHeight = canvas.clientHeight;

      // Dynamic quality setting automatically adapting if FPS drops below 45
      fpsFramesCountRef.current++;
      if (now - fpsWindowStartRef.current >= 1000) {
        const measuredFps = (fpsFramesCountRef.current * 1000) / (now - fpsWindowStartRef.current);
        fpsFramesCountRef.current = 0;
        fpsWindowStartRef.current = now;
        // Step quality down quickly when sustained performance drops, but recover
        // one level at a time with headroom to avoid oscillating between settings.
        if (measuredFps < 42) {
          if (qualityRef.current === 'high') qualityRef.current = 'medium';
          else if (qualityRef.current === 'medium') qualityRef.current = 'low';
        } else if (measuredFps > 58) {
          if (qualityRef.current === 'low') qualityRef.current = 'medium';
          else if (qualityRef.current === 'medium') qualityRef.current = 'high';
        }
      }

      // Sarok.io / Agar.io: Lock camera 100% dead-center on the player's visual center
      const currentCells = playerCellsRef.current;
      if (currentCells.length > 0) {
        let sumX = 0, sumY = 0, totalMass = 0;
        for (let i = 0; i < currentCells.length; i++) {
          const c = currentCells[i];
          const cr = c.renderRadius ?? c.radius;
          const m = cr * cr;
          totalMass += m;
          sumX += (c.renderX ?? c.x) * m;
          sumY += (c.renderY ?? c.y) * m;
        }
        if (totalMass > 0) {
          cameraRef.current.x = sumX / totalMass;
          cameraRef.current.y = sumY / totalMass;
        } else {
          cameraRef.current.x = currentCells[0].renderX ?? currentCells[0].x;
          cameraRef.current.y = currentCells[0].renderY ?? currentCells[0].y;
        }
      }

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      ctx.save();
      
      const cam = cameraRef.current;
      const zoom = zoomRef.current;

      ctx.translate(logicalWidth / 2, logicalHeight / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cam.x, -cam.y);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      const gridSize = 20;

      const halfW = (logicalWidth / 2) / zoom;
      const halfH = (logicalHeight / 2) / zoom;
      const startX = Math.max(0, Math.floor((cam.x - halfW) / gridSize) * gridSize);
      const endX = Math.min(MAP_SIZE, Math.ceil((cam.x + halfW) / gridSize) * gridSize);
      const startY = Math.max(0, Math.floor((cam.y - halfH) / gridSize) * gridSize);
      const endY = Math.min(MAP_SIZE, Math.ceil((cam.y + halfH) / gridSize) * gridSize);

      if (startX <= endX && startY <= endY) {
        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
        }
        ctx.stroke();
      }

      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

      // Render Pellets: slight floating motion, tiny soft glow
      const foods = foodsRef.current;
      const isLowQuality = qualityRef.current === 'low';
      for (let i = 0; i < foods.length; i++) {
        const food = foods[i];
        if (food.eaten) continue;
        const fx = food.renderX ?? food.x;
        const fy = food.renderY ?? food.y;
        if (food.radius >= EJECTED_MASS_RADIUS) {
          ctx.beginPath();
          ctx.arc(fx, fy, food.radius, 0, Math.PI * 2);
          ctx.fillStyle = food.color;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.stroke();
        } else {
          const floatY = Math.sin(now * 0.003 + (food.x * 0.04 + food.y * 0.04)) * 0.85;
          const drawFoodY = fy + floatY;
          if (!isLowQuality) {
            ctx.beginPath();
            ctx.arc(fx, drawFoodY, food.radius + 1.8, 0, Math.PI * 2);
            ctx.fillStyle = food.color;
            ctx.globalAlpha = 0.22;
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }
          ctx.beginPath();
          ctx.arc(fx, drawFoodY, food.radius, 0, Math.PI * 2);
          ctx.fillStyle = food.color;
          ctx.fill();
        }
      }

      // Render pellet pops
      const popPool = popPoolRef.current;
      for (let p = 0; p < popPool.length; p++) {
        const pop = popPool[p];
        if (!pop.active) continue;
        const elapsed = now - pop.timeStart;
        if (elapsed >= pop.duration) {
          pop.active = false;
          continue;
        }
        const prog = elapsed / pop.duration;
        pop.x += pop.vx;
        pop.y += pop.vy;
        const popAlpha = (1 - prog) * 0.8;
        const popR = pop.radius * (1 + prog * 0.8);
        ctx.save();
        ctx.globalAlpha = popAlpha;
        ctx.beginPath();
        ctx.arc(pop.x, pop.y, popR, 0, Math.PI * 2);
        ctx.fillStyle = pop.color;
        ctx.fill();
        ctx.restore();
      }

      const tokens = ghostTokensRef.current;
      for (let i = 0; i < tokens.length; i++) {
        drawGhostToken(tokens[i], now);
      }

      // Liquid metaball bridges between merging cells
      const pCells = playerCellsRef.current;
      if (pCells.length > 1) {
        for (let i = 0; i < pCells.length; i++) {
          const c1 = pCells[i];
          const r1 = c1.renderRadius ?? c1.radius;
          const x1 = c1.renderX ?? c1.x;
          const y1 = c1.renderY ?? c1.y;
          for (let j = i + 1; j < pCells.length; j++) {
            const c2 = pCells[j];
            const r2 = c2.renderRadius ?? c2.radius;
            const x2 = c2.renderX ?? c2.x;
            const y2 = c2.renderY ?? c2.y;
            drawMetaballBridge(x1, y1, r1, x2, y2, r2, playerColorRef.current || '#0284c7');
          }
        }
      }

      const liveBots = botsRef.current;
      for (let b = 0; b < liveBots.length; b++) {
        const botCells = liveBots[b].cells;
        if (botCells.length > 1) {
          for (let i = 0; i < botCells.length; i++) {
            const c1 = botCells[i];
            const r1 = c1.renderRadius ?? c1.radius;
            const x1 = c1.renderX ?? c1.x;
            const y1 = c1.renderY ?? c1.y;
            for (let j = i + 1; j < botCells.length; j++) {
              const c2 = botCells[j];
              const r2 = c2.renderRadius ?? c2.radius;
              const x2 = c2.renderX ?? c2.x;
              const y2 = c2.renderY ?? c2.y;
              drawMetaballBridge(x1, y1, r1, x2, y2, r2, liveBots[b].color);
            }
          }
        }
      }

      // Re-use preallocated drawable list to eliminate per-frame GC allocation
      const pool = drawablePoolRef.current;
      let count = 0;

      if (!isGameOverRef.current) {
        for (let i = 0; i < pCells.length; i++) {
          const c = pCells[i];
          const r = c.renderRadius ?? c.radius;
          if (count < pool.length) {
            pool[count].type = 'player';
            pool[count].entity = c;
            pool[count].radius = r;
          } else {
            pool.push({ type: 'player', entity: c, radius: r });
          }
          count++;
        }
      }

      for (let i = 0; i < liveBots.length; i++) {
        const b = liveBots[i];
        for (let k = 0; k < b.cells.length; k++) {
          const c = b.cells[k];
          const r = c.renderRadius ?? c.radius;
          if (count < pool.length) {
            pool[count].type = 'bot';
            pool[count].entity = c;
            pool[count].radius = r;
          } else {
            pool.push({ type: 'bot', entity: c, radius: r });
          }
          count++;
        }
      }

      const viruses = virusesRef.current;
      for (let i = 0; i < viruses.length; i++) {
        const v = viruses[i];
        if (count < pool.length) {
          pool[count].type = 'virus';
          pool[count].entity = v;
          pool[count].radius = v.radius;
        } else {
          pool.push({ type: 'virus', entity: v, radius: v.radius });
        }
        count++;
      }

      pool.length = count;
      pool.sort((a, b) => a.radius - b.radius);

      for (let i = 0; i < pool.length; i++) {
        const item = pool[i];
        if (item.type === 'player') {
          drawPlayerCell(item.entity, now);
        } else if (item.type === 'bot') {
          drawBot(item.entity, now);
        } else if (item.type === 'virus') {
          drawVirus(item.entity, now);
        }
      }

      // Render Eating Animations: prey shrinking and pulling into predator center
      const eatingPool = eatingPoolRef.current;
      for (let e = 0; e < eatingPool.length; e++) {
        const anim = eatingPool[e];
        if (!anim.active) continue;
        const elapsed = now - anim.timeStart;
        if (elapsed >= anim.duration) {
          anim.active = false;
          continue;
        }
        const prog = elapsed / anim.duration;
        const targetX = anim.predatorCell.renderX ?? anim.predatorCell.x;
        const targetY = anim.predatorCell.renderY ?? anim.predatorCell.y;
        const curX = anim.startX + (targetX - anim.startX) * (prog * prog);
        const curY = anim.startY + (targetY - anim.startY) * (prog * prog);
        const curR = Math.max(1, anim.initialRadius * (1 - prog * 0.9));
        const alpha = Math.max(0, 1 - prog);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(curX, curY, curR, 0, Math.PI * 2);
        ctx.fillStyle = anim.color;
        ctx.fill();
        ctx.restore();
      }

      if (!isGameOverRef.current) {
        drawAimArrow();
      }

      ctx.restore();

      // Floating joystick: shows EXACTLY where the player clicked/tapped
      if (inputRef.current.active) {
        const isMobile = isPhoneRef.current || logicalWidth < 640;
        const ringRadius = isMobile ? 44 : 58;
        const stickRadius = isMobile ? 22 : 29;

        const startX = inputRef.current.startX;
        const startY = inputRef.current.startY;
        const curX = inputRef.current.curX;
        const curY = inputRef.current.curY;

        const dx = curX - startX;
        const dy = curY - startY;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, ringRadius);
        const stickX = startX + (dist > 0 ? (dx / dist) * clampedDist : 0);
        const stickY = startY + (dist > 0 ? (dy / dist) * clampedDist : 0);

        // Outer base ring (centered exactly where clicked)
        ctx.beginPath();
        ctx.arc(startX, startY, ringRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.stroke();

        // Inner thumb stick knob
        ctx.beginPath();
        ctx.arc(stickX, stickY, stickRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.65)';
        ctx.stroke();
      }
    };

    const loop = (time: number) => {
      const rawDt = time - lastTime;
      lastTime = time;
      const dt = Math.min(64, Math.max(1, rawDt));

      // Fixed 60Hz physics sub-stepping. The frame delta is capped above, so
      // four steps cover the maximum accumulated frame time without throwing
      // away simulation time (which previously caused visible hitching).
      physicsAccumulatorRef.current += dt;
      const fixedStep = 1000 / 60; // 16.667ms
      const maxSubSteps = 4;
      let steps = 0;
      while (physicsAccumulatorRef.current >= fixedStep && steps < maxSubSteps) {
        update(fixedStep);
        physicsAccumulatorRef.current -= fixedStep;
        steps++;
      }
      // Keep any fractional remainder for interpolation on the next frame.

      interpolate(dt);
      draw();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMoveTracking);
      window.removeEventListener('touchstart', handleWindowTouchStart);
      cancelAnimationFrame(animationFrameId);
      clearSplitTimers();
    };
  }, []);

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: clientX, y: clientY };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const extractPoint = (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } | null => {
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      return getCanvasCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
    const me = e as React.MouseEvent;
    return getCanvasCoords(me.clientX, me.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    // Only handle events targeted directly at the gameplay canvas (ignore UI buttons)
    if (e.target !== canvasRef.current) return;
    setShowEmojiPicker(false);
    if (isPausedRef.current) return;
    autoGatherRef.current = false;

    const canvas = canvasRef.current;
    const cw = canvas ? canvas.clientWidth : window.innerWidth;
    const ch = canvas ? canvas.clientHeight : window.innerHeight;

    if ('touches' in e) {
      if (!inputRef.current.active && e.changedTouches.length > 0) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          const p = getCanvasCoords(touch.clientX, touch.clientY);
          // Tap anywhere on canvas (outside action buttons cluster) activates joystick
          const inActionButtonZone = p.x > cw - 170 && p.y > ch - 230;
          if (!inActionButtonZone) {
            inputRef.current.active = true;
            inputRef.current.touchId = touch.identifier;
            // Spawn joystick EXACTLY where player clicked/tapped
            inputRef.current.startX = p.x;
            inputRef.current.startY = p.y;
            inputRef.current.curX = p.x;
            inputRef.current.curY = p.y;
            break;
          }
        }
      }
    } else {
      if (inputRef.current.active) return;
      const p = extractPoint(e);
      if (!p) return;
      const inActionButtonZone = p.x > cw - 170 && p.y > ch - 230;
      if (!inActionButtonZone) {
        inputRef.current.active = true;
        inputRef.current.touchId = null;
        inputRef.current.startX = p.x;
        inputRef.current.startY = p.y;
        inputRef.current.curX = p.x;
        inputRef.current.curY = p.y;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (isPausedRef.current) return;

    if ('touches' in e) {
      if (inputRef.current.active) {
        let touch: React.Touch | null = null;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === inputRef.current.touchId) {
            touch = e.touches[i];
            break;
          }
        }
        if (!touch) return;
        const p = getCanvasCoords(touch.clientX, touch.clientY);
        inputRef.current.curX = p.x;
        inputRef.current.curY = p.y;
      }
    } else {
      if (!inputRef.current.active) return;
      const p = extractPoint(e);
      if (!p) return;
      inputRef.current.curX = p.x;
      inputRef.current.curY = p.y;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === inputRef.current.touchId) {
          inputRef.current.active = false;
          inputRef.current.touchId = null;
          // STOP-ON-RELEASE REMOVED: keep cell moving forward in aimed direction!
        }
      }
    } else {
      inputRef.current.active = false;
      inputRef.current.touchId = null;
    }
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === inputRef.current.touchId) {
        inputRef.current.active = false;
        inputRef.current.touchId = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[#f8saf8] text-slate-900 font-sans select-none overflow-hidden touch-none">
      <canvas 
        ref={canvasRef}
        className="block"
        style={{ touchAction: 'none' }}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      />

      <div 
        className="absolute pointer-events-none z-10 flex flex-col items-start gap-1.5 sm:gap-3 md:gap-4"
        style={{ top: 'max(0.5rem, env(safe-area-inset-top))', left: 'max(0.5rem, env(safe-area-inset-left))' }}
      >
        {/* Pause Button & Score next to it (aligned high/up at the top like Agar.io) */}
        <div className="flex items-start gap-2 sm:gap-2.5 md:gap-3 pointer-events-auto">
          <TouchSafeButton
            onClick={togglePause}
            onMouseDown={() => setIsPausePressed(true)}
            onMouseUp={() => setIsPausePressed(false)}
            onMouseLeave={() => setIsPausePressed(false)}
            onTouchStart={() => setIsPausePressed(true)}
            onTouchEnd={() => setIsPausePressed(false)}
            onTouchCancel={() => setIsPausePressed(false)}
            className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-[rgba(140,140,140,0.18)] border border-[rgba(140,140,140,0.45)] sm:border-2 rounded-xl sm:rounded-2xl shadow-sm flex items-center justify-center cursor-pointer select-none group shrink-0"
            title={isPaused ? "Resume Game (P)" : "Pause Game (P)"}
          >
            <Pause 
              className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 transition-colors duration-75" 
              style={{ 
                color: isPausePressed ? '#000000' : '#9E9E9E',
                fill: isPausePressed ? '#000000' : '#9E9E9E'
              }}
            />
          </TouchSafeButton>

          <div className="flex flex-col select-none pt-0 sm:pt-0.5">
            <span 
              className="text-sm sm:text-base md:text-xl font-extrabold tracking-tight whitespace-nowrap"
              style={{ color: '#9E9E9E' }}
            >
              Score: {score}
            </span>
            <div 
              className="flex items-center gap-1 sm:gap-1.5 mt-0.5 w-fit"
              title="Ghost Tokens collected"
            >
              <img
                src="/ghost-token.png"
                alt="Ghost Token"
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 object-contain select-none pointer-events-none drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]"
              />
              <span className="text-xs sm:text-sm md:text-base font-black text-cyan-400 font-mono tracking-wide drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]">
                {ghostTokenCount}
              </span>
            </div>
          </div>
        </div>

        {/* Social / Communication Row: Emoji + Chat */}
        <div className="flex items-start gap-1.5 sm:gap-2 md:gap-2.5 pointer-events-auto">
          {/* Emoji Button & Agar.io-style Vertical Tray */}
          <div className="relative flex flex-col items-center">
            <TouchSafeButton
              onClick={() => {
                setShowEmojiPicker(prev => !prev);
                setShowChat(false);
              }}
              onMouseDown={() => setIsEmojiPressed(true)}
              onMouseUp={() => setIsEmojiPressed(false)}
              onMouseLeave={() => setIsEmojiPressed(false)}
              onTouchStart={() => setIsEmojiPressed(true)}
              onTouchEnd={() => setIsEmojiPressed(false)}
              onTouchCancel={() => setIsEmojiPressed(false)}
              className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-[rgba(140,140,140,0.18)] border border-[rgba(140,140,140,0.45)] sm:border-2 shadow-sm flex items-center justify-center cursor-pointer select-none group transition-all ${
                showEmojiPicker ? 'rounded-t-xl sm:rounded-t-2xl border-b-0 bg-[rgba(140,140,140,0.28)]' : 'rounded-xl sm:rounded-2xl'
              }`}
              title="Emotes"
            >
              <Smile 
                className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 transition-colors duration-75" 
                style={{ color: showEmojiPicker || isEmojiPressed ? '#000000' : '#9E9E9E' }} 
              />
            </TouchSafeButton>

            {showEmojiPicker && (
              <div className="w-9 sm:w-10 md:w-11 bg-[rgba(140,140,140,0.18)] border border-[rgba(140,140,140,0.45)] sm:border-2 border-t-0 rounded-b-xl sm:rounded-b-2xl shadow-lg flex flex-col items-center py-1 sm:py-1.5 gap-1 sm:gap-1.5 max-h-[50vh] overflow-y-auto overflow-x-hidden no-scrollbar panel-animate-in animate-in fade-in slide-in-from-top-1 duration-150">
                {QUICK_EMOJIS.map(emojiItem => (
                  <button
                    key={emojiItem.id}
                    onClick={() => {
                      activeEmojiRef.current = { emoji: emojiItem.id, timeLeft: EMOJI_DISPLAY_DURATION };
                      setShowEmojiPicker(false);
                    }}
                    className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center p-0.5 hover:bg-white/20 active:scale-90 transition-transform cursor-pointer select-none shrink-0"
                    title={emojiItem.name}
                  >
                    <img
                      src={emojiItem.src}
                      alt={emojiItem.name}
                      className="w-full h-full object-contain pointer-events-none drop-shadow-xs"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat Button & Chat Panel */}
          <div className="relative flex flex-col items-start">
            <TouchSafeButton
              onClick={() => {
                setShowChat(prev => !prev);
                setShowEmojiPicker(false);
              }}
              onMouseDown={() => setIsChatPressed(true)}
              onMouseUp={() => setIsChatPressed(false)}
              onMouseLeave={() => setIsChatPressed(false)}
              onTouchStart={() => setIsChatPressed(true)}
              onTouchEnd={() => setIsChatPressed(false)}
              onTouchCancel={() => setIsChatPressed(false)}
              className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-[rgba(140,140,140,0.18)] border border-[rgba(140,140,140,0.45)] sm:border-2 shadow-sm flex items-center justify-center cursor-pointer select-none group transition-all ${
                showChat ? 'bg-[rgba(140,140,140,0.28)] rounded-xl sm:rounded-2xl' : 'rounded-xl sm:rounded-2xl'
              }`}
              title="Chat"
            >
              <MessageCircle 
                className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 transition-colors duration-75" 
                style={{ color: showChat || isChatPressed ? '#000000' : '#9E9E9E' }} 
              />
            </TouchSafeButton>

            {showChat && (
              <div className="absolute top-11 sm:top-12 md:top-13 left-0 w-56 sm:w-64 md:w-72 max-w-[calc(100vw-2.5rem)] bg-[rgba(140,140,140,0.22)] backdrop-blur-md border border-[rgba(140,140,140,0.45)] sm:border-2 rounded-xl sm:rounded-2xl shadow-xl p-2 sm:p-2.5 space-y-1.5 sm:space-y-2 z-40 panel-animate-in animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-black/10 pb-1">
                  <span className="text-[10px] sm:text-[11px] md:text-xs font-black text-slate-600 uppercase tracking-wider">Chat</span>
                  <button
                    onClick={() => setShowChat(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 px-1 py-0.5 rounded cursor-pointer font-bold leading-none"
                  >
                    ✕
                  </button>
                </div>

                <div className="h-28 sm:h-36 md:h-44 overflow-y-auto space-y-1.5 pr-1 no-scrollbar text-[11px] sm:text-xs">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className="leading-tight break-words">
                      <span className={`font-bold ${msg.isPlayer ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {msg.sender}:{' '}
                      </span>
                      <span className="text-slate-800 font-medium">{msg.text}</span>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatInput.trim()) return;
                    setChatMessages(prev => [
                      ...prev,
                      {
                        id: generateId(),
                        sender: playerNameRef.current || 'You',
                        text: chatInput.trim(),
                        isPlayer: true
                      }
                    ]);
                    setChatInput('');
                  }}
                  className="flex items-center gap-1.5 pt-1.5 border-t border-black/10"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Type message..."
                    maxLength={60}
                    className="flex-1 bg-white/40 border border-[rgba(140,140,140,0.45)] rounded-lg px-2.5 py-1 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center cursor-pointer transition-transform shrink-0"
                    title="Send"
                  >
                    <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Mod Menu Button when custom positioned via hold-and-drag */}
      {mode === 'bots' && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-teal-600/90 backdrop-blur-xs border border-teal-300 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[10px] md:text-xs font-black tracking-wider uppercase shadow-md flex items-center gap-1.5"
          style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <span>🤖</span>
          <span>PRIVATE SERVER</span>
          <span className="text-teal-200">• BOTS ONLY</span>
        </div>
      )}
      {mode === 'instantMerge' && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-amber-600/90 backdrop-blur-xs border border-amber-300 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[10px] md:text-xs font-black tracking-wider uppercase shadow-md flex items-center gap-1.5"
          style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <span>⚡</span>
          <span>INSTANT MERGE MODE</span>
        </div>
      )}

      {modBtnPos && (
        <button
          onPointerDown={handleModPointerDown}
          onPointerMove={handleModPointerMove}
          onPointerUp={handleModPointerUp}
          onPointerCancel={handleModPointerCancel}
          className={`pointer-events-auto fixed z-30 w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 border border-[rgba(140,140,140,0.45)] sm:border-2 rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center cursor-pointer select-none transition-colors duration-100 ${
            isModDragging ? 'ring-2 ring-emerald-400 scale-105 shadow-xl' : ''
          }`}
          style={{
            left: `${modBtnPos.x}px`,
            top: `${modBtnPos.y}px`,
            touchAction: 'none',
            background: showModMenu ? 'rgba(16,185,129,0.18)' : 'rgba(140,140,140,0.18)',
            borderColor: showModMenu ? 'rgba(16,185,129,0.55)' : 'rgba(140,140,140,0.45)'
          }}
          title="Mod Menu (Hold to Reposition)"
        >
          <Sliders className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" style={{ color: showModMenu ? '#10b981' : (isModPressed ? '#000000' : '#9E9E9E') }} />
        </button>
      )}

      <div
        className="absolute flex flex-col items-end gap-1.5 sm:gap-2 md:gap-2.5 z-10"
        style={{ top: 'max(0.5rem, env(safe-area-inset-top))', right: 'max(0.5rem, env(safe-area-inset-right))' }}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5">
          {/* Mod Menu button in default spot (immediately to the LEFT of Leaderboard toggle) */}
          {!modBtnPos && (
            <button
              onPointerDown={handleModPointerDown}
              onPointerMove={handleModPointerMove}
              onPointerUp={handleModPointerUp}
              onPointerCancel={handleModPointerCancel}
              className={`pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 border border-[rgba(140,140,140,0.45)] sm:border-2 rounded-xl sm:rounded-2xl shadow-sm flex items-center justify-center cursor-pointer select-none transition-colors duration-100 ${
                isModDragging ? 'ring-2 ring-emerald-400 scale-105 shadow-xl' : ''
              }`}
              style={{
                touchAction: 'none',
                background: showModMenu ? 'rgba(16,185,129,0.18)' : 'rgba(140,140,140,0.18)',
                borderColor: showModMenu ? 'rgba(16,185,129,0.55)' : 'rgba(140,140,140,0.45)'
              }}
              title="Mod Menu (Hold to Reposition)"
            >
              <Sliders className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" style={{ color: showModMenu ? '#10b981' : (isModPressed ? '#000000' : '#9E9E9E') }} />
            </button>
          )}

          <TouchSafeButton
            onClick={() => setShowLeaderboard(prev => !prev)}
            className="pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-[rgba(140,140,140,0.18)] border border-[rgba(140,140,140,0.45)] sm:border-2 rounded-xl sm:rounded-2xl shadow-sm flex items-center justify-center cursor-pointer select-none"
            title="Leaderboard"
          >
            <ListOrdered className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" style={{ color: '#9E9E9E' }} />
          </TouchSafeButton>
        </div>

        {showLeaderboard && leaderboard.length > 0 && (
          <div className="bg-[rgba(140,140,140,0.18)] border border-[rgba(140,140,140,0.45)] sm:border-2 rounded-xl sm:rounded-2xl shadow-sm px-2.5 py-1.5 sm:px-3 sm:py-2 pointer-events-none w-36 sm:w-44 md:w-48 panel-animate-in animate-in fade-in zoom-in-95 duration-150">
            <div className="text-[9px] sm:text-[10px] md:text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1 text-center">
              {mode === 'bots' ? 'Bots Leaderboard' : (mode === 'instantMerge' ? 'Instant Merge' : 'Leaderboard')}
            </div>
            {leaderboard.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px] sm:text-[11px] md:text-xs font-bold py-0.5">
                <span className={`truncate max-w-[70%] ${entry.isPlayer ? 'text-emerald-600' : 'text-slate-600'}`}>
                  {idx + 1}. {entry.name || 'An unnamed cell'}
                </span>
                <span className={`font-mono shrink-0 ml-1.5 ${entry.isPlayer ? 'text-emerald-600' : 'text-slate-500'}`}>{entry.score}</span>
              </div>
            ))}
            {playerRank && playerRank > 5 && (
              <>
                <div className="my-0.5 border-t border-black/10" />
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] md:text-xs font-bold py-0.5 text-emerald-600">
                  <span className="truncate max-w-[70%]">{playerRank}. {playerNameRef.current || 'You'}</span>
                  <span className="font-mono shrink-0 ml-1.5">{score}</span>
                </div>
              </>
            )}
          </div>
        )}

        {showModMenu && (
          <div
            className={`bg-[rgba(140,140,140,0.22)] backdrop-blur-md border border-[rgba(140,140,140,0.45)] sm:border-2 rounded-xl sm:rounded-2xl shadow-xl px-3 py-2 sm:px-3.5 sm:py-2.5 pointer-events-auto w-52 sm:w-60 md:w-64 max-w-[85vw] max-h-[82vh] overflow-y-auto no-scrollbar space-y-2 panel-animate-in animate-in fade-in zoom-in-95 duration-150 ${
              modBtnPos ? 'fixed z-30' : ''
            }`}
            style={
              modBtnPos
                ? {
                    left: `${Math.max(10, Math.min(window.innerWidth - 260, modBtnPos.x - 70))}px`,
                    top: `${Math.min(window.innerHeight - 320, modBtnPos.y + 44)}px`
                  }
                : undefined
            }
          >
            <div className="flex items-center justify-between border-b border-black/10 pb-1">
              <span className="text-[10px] sm:text-[11px] font-black text-slate-600 uppercase tracking-wider">Mod Menu</span>
              <button
                onClick={() => setShowModMenu(false)}
                className="text-xs text-slate-500 hover:text-slate-800 px-1 rounded cursor-pointer font-bold leading-none"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                <span>Zoom</span>
                <span className="text-emerald-600 font-mono">{modZoom.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={1.6}
                step={0.05}
                value={modZoom}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setModZoom(v);
                  modZoomRef.current = v;
                }}
                className="w-full h-1 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* MACRO SPEED — allows up to 10,000 feeds/second */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                <span>Macro Speed</span>
                <span className="text-emerald-600 font-mono">{Math.round(1000 / modMacroInterval)}/s</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={200}
                step={0.1}
                value={200.1 - modMacroInterval}
                onChange={(e) => {
                  const interval = 200.1 - parseFloat(e.target.value);
                  setModMacroInterval(interval);
                  modMacroIntervalRef.current = interval;
                }}
                className="w-full h-1 accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                <span>Feed Speed</span>
                <span className="text-emerald-600 font-mono">{modFeedSpeed.toFixed(0)}</span>
              </div>
              <input
                type="range"
                min={6}
                max={24}
                step={1}
                value={modFeedSpeed}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setModFeedSpeed(v);
                  modFeedSpeedRef.current = v;
                }}
                className="w-full h-1 accent-emerald-500 cursor-pointer"
              />
            </div>

            {isInstantMergeMode && (
              <div className="flex items-center justify-between py-0.5 px-1.5 bg-amber-500/10 rounded border border-amber-500/20">
                <span className="text-[9px] sm:text-[10px] font-black text-amber-600 uppercase tracking-wide">Instant Merge</span>
                <span className="text-[8px] sm:text-[9px] font-black text-emerald-600 bg-emerald-500/20 px-1.5 py-0.2 rounded-full border border-emerald-500/40 uppercase">Active</span>
              </div>
            )}

            {/* Test Mass Controls */}
            <div className="space-y-1 pt-1 border-t border-slate-300/60">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wide block">Test Mass</span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (playerCellsRef.current.length > 0) {
                      const c = playerCellsRef.current[0];
                      c.radius = Math.sqrt(c.radius * c.radius + 10000);
                      c.renderRadius = c.radius;
                      const newScore = calculateTotalScore();
                      scoreRef.current = newScore;
                      setScore(newScore);
                    }
                  }}
                  className="px-1 py-0.5 sm:py-1 bg-white/70 hover:bg-white text-slate-700 text-[9px] sm:text-[10px] font-bold rounded border border-slate-300 shadow-xs cursor-pointer active:scale-95 text-center"
                >
                  +1k
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (playerCellsRef.current.length > 0) {
                      const c = playerCellsRef.current[0];
                      c.radius = Math.sqrt(c.radius * c.radius + 100000);
                      c.renderRadius = c.radius;
                      const newScore = calculateTotalScore();
                      scoreRef.current = newScore;
                      setScore(newScore);
                    }
                  }}
                  className="px-1 py-0.5 sm:py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold rounded shadow-xs cursor-pointer active:scale-95 text-center"
                >
                  +10k
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playerCellsRef.current = [{
                      id: generateId(),
                      x: playerCellsRef.current[0]?.x || MAP_SIZE / 2,
                      y: playerCellsRef.current[0]?.y || MAP_SIZE / 2,
                      renderX: playerCellsRef.current[0]?.x || MAP_SIZE / 2,
                      renderY: playerCellsRef.current[0]?.y || MAP_SIZE / 2,
                      renderRadius: INITIAL_RADIUS,
                      radius: INITIAL_RADIUS,
                      vx: 0,
                      vy: 0,
                      splitTime: 0,
                      phaseOffset: 0
                    }];
                    const newScore = calculateTotalScore();
                    scoreRef.current = newScore;
                    setScore(newScore);
                  }}
                  className="px-1 py-0.5 sm:py-1 bg-white/70 hover:bg-white text-rose-600 text-[9px] sm:text-[10px] font-bold rounded border border-slate-300 shadow-xs cursor-pointer active:scale-95 text-center"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Mod Menu: Controls Reference & Touch Buttons Toggle */}
            <div className="pt-1 border-t border-slate-300/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wide">Touch Buttons</span>
                <button
                  type="button"
                  onClick={() => setIsTouchDevice(prev => !prev)}
                  className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer ${isTouchDevice ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}`}
                >
                  {isTouchDevice ? 'Visible' : 'Hidden'}
                </button>
              </div>
              <div className="bg-slate-100/90 rounded-lg p-1.5 border border-slate-200 text-[9px] sm:text-[10px] text-slate-600 font-mono space-y-0.5">
                <div className="font-bold uppercase tracking-wider text-slate-500 text-[8px] sm:text-[9px]">PC Controls</div>
                <div className="flex justify-between"><span>Mouse:</span><span className="font-bold text-slate-800">Aim</span></div>
                <div className="flex justify-between"><span>Feed:</span><span className="font-bold text-amber-600">W</span></div>
                <div className="flex justify-between"><span>Split:</span><span className="font-bold text-cyan-600">SPACE</span></div>
                <div className="flex justify-between"><span>Macro:</span><span className="font-bold text-emerald-600">E</span></div>
                <div className="flex justify-between"><span>Double Split:</span><span className="font-bold text-purple-600">Q</span></div>
                <div className="flex justify-between"><span>Master Split:</span><span className="font-bold text-rose-600">F</span></div>
              </div>
            </div>

            {modBtnPos && (
              <button
                onClick={() => {
                  setModBtnPos(null);
                  try {
                    localStorage.removeItem(STORAGE_KEY_MOD_POS);
                  } catch {}
                }}
                className="w-full text-center text-[9px] sm:text-[10px] text-slate-500 hover:text-slate-800 underline py-0.5 cursor-pointer"
              >
                Reset button position
              </button>
            )}
          </div>
        )}
      </div>


      {/* MOBILE / TABLET TOUCH BUTTONS (Only rendered on touch devices) */}
      {isTouchDevice && (
        <div className="sm:contents">
          {/* BOTTOM: FEED / PULSE Button — MOBILE (Nestled between Titan and Split) */}
          <TouchSafeButton  
            onClick={handleEject}
            onMouseDown={() => setIsPulsePressed(true)}
            onMouseUp={() => setIsPulsePressed(false)}
            onMouseLeave={() => setIsPulsePressed(false)}
            onTouchStart={() => setIsPulsePressed(true)}
            onTouchEnd={() => setIsPulsePressed(false)}
            onTouchCancel={() => setIsPulsePressed(false)}
            className="pointer-events-auto fixed z-20 sm:hidden rounded-full bg-[rgba(140,140,140,0.18)] border-[3px] border-[rgba(140,140,140,0.45)] shadow-md flex items-center justify-center cursor-pointer select-none group"
            style={{
              width: PBTN_SIZE,
              height: PBTN_SIZE,
              right: `calc(${PBTN_EDGE_R} + (${PBTN_SIZE} + ${PBTN_GAP}) * 0.5)`,
              bottom: PBTN_EDGE_B
            }}
            title="Pulse / Eject (W)"
          >
            <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] transition-colors duration-75" fill="none" style={{ stroke: isPulsePressed ? '#000000' : '#9E9E9E' }}>
              <circle cx="50" cy="50" r="32" strokeWidth="4.5" />
              <circle cx="50" cy="50" r="17" strokeWidth="3.8" />
              <line x1="50" y1="10" x2="50" y2="90" strokeWidth="3.8" strokeLinecap="round" />
              <line x1="10" y1="50" x2="90" y2="50" strokeWidth="3.8" strokeLinecap="round" />
              <polygon points="50,34 45,48 49,48 48,62 56,47 52,47" style={{ fill: isPulsePressed ? '#000000' : '#9E9E9E' }} stroke="none" />
            </svg>
          </TouchSafeButton>

          {/* MIDDLE-LEFT: TITAN / MACRO Button — MOBILE (To the left of Split) */}
          <TouchSafeButton  
            onMouseDown={startMacro}
            onMouseUp={stopMacro}
            onMouseLeave={stopMacro}
            onTouchStart={startMacro}
            onTouchEnd={stopMacro}
            onTouchCancel={stopMacro}
            className="pointer-events-auto fixed z-20 sm:hidden rounded-full bg-[rgba(140,140,140,0.18)] border-[3px] border-[rgba(140,140,140,0.45)] shadow-md flex items-center justify-center cursor-pointer select-none group"
            style={{
              width: PBTN_SIZE,
              height: PBTN_SIZE,
              right: `calc(${PBTN_EDGE_R} + ${PBTN_SIZE} + ${PBTN_GAP})`,
              bottom: `calc(${PBTN_EDGE_B} + (${PBTN_SIZE} + ${PBTN_GAP}) * 0.866)`
            }}
            title="Titan / Macro Feed (Hold / E)"
          >
            <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] transition-colors duration-75" fill="none" style={{ stroke: isMacroPressed ? '#000000' : '#9E9E9E' }}>
              <circle cx="50" cy="50" r="30" strokeWidth="5" />
              <line x1="50" y1="8" x2="50" y2="28" strokeWidth="5" strokeLinecap="round" />
              <line x1="50" y1="72" x2="50" y2="92" strokeWidth="5" strokeLinecap="round" />
              <line x1="8" y1="50" x2="28" y2="50" strokeWidth="5" strokeLinecap="round" />
              <line x1="72" y1="50" x2="92" y2="50" strokeWidth="5" strokeLinecap="round" />
              <circle cx="50" cy="50" r="6" style={{ fill: isMacroPressed ? '#000000' : '#9E9E9E' }} stroke="none" />
            </svg>
          </TouchSafeButton>

          {/* MIDDLE-RIGHT: SPLIT Button — MOBILE (Directly under Master Split) */}
          <TouchSafeButton  
            onClick={handleSplit}
            onMouseDown={() => setIsSplitPressed(true)}
            onMouseUp={() => setIsSplitPressed(false)}
            onMouseLeave={() => setIsSplitPressed(false)}
            onTouchStart={() => setIsSplitPressed(true)}
            onTouchEnd={() => setIsSplitPressed(false)}
            onTouchCancel={() => setIsSplitPressed(false)}
            className="pointer-events-auto fixed z-20 sm:hidden rounded-full bg-[rgba(140,140,140,0.18)] border-[3px] border-[rgba(140,140,140,0.45)] shadow-md flex items-center justify-center cursor-pointer select-none group"
            style={{
              width: PBTN_SIZE,
              height: PBTN_SIZE,
              right: PBTN_EDGE_R,
              bottom: `calc(${PBTN_EDGE_B} + (${PBTN_SIZE} + ${PBTN_GAP}) * 0.866)`
            }}
            title="Split (Space)"
          >
            <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] transition-colors duration-75" fill="none" style={{ stroke: isSplitPressed ? '#000000' : '#9E9E9E' }}>
              <circle cx="34" cy="62" r="14" strokeWidth="5" fill="none" />
              <circle cx="66" cy="38" r="14" strokeWidth="5" fill="none" />
              <line x1="26" y1="24" x2="74" y2="76" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </TouchSafeButton>

          {/* TOP: MASTER SPLIT Button — MOBILE (Directly above Split) */}
          <TouchSafeButton  
            onClick={handleMasterSplit}
            onMouseDown={() => setIsMasterSplitPressed(true)}
            onMouseUp={() => setIsMasterSplitPressed(false)}
            onMouseLeave={() => setIsMasterSplitPressed(false)}
            onTouchStart={() => setIsMasterSplitPressed(true)}
            onTouchEnd={() => setIsMasterSplitPressed(false)}
            onTouchCancel={() => setIsMasterSplitPressed(false)}
            className="pointer-events-auto fixed z-20 sm:hidden rounded-full bg-[rgba(140,140,140,0.18)] border-[3px] border-[rgba(140,140,140,0.45)] shadow-md flex items-center justify-center cursor-pointer select-none group"
            style={{
              width: PBTN_SIZE,
              height: PBTN_SIZE,
              right: PBTN_EDGE_R,
              bottom: `calc(${PBTN_EDGE_B} + (${PBTN_SIZE} + ${PBTN_GAP}) * 0.866 + ${PBTN_SIZE} + ${PBTN_GAP})`
            }}
            title="Master Split (F / Shift+Space)"
          >
            <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] transition-colors duration-75" fill="none" style={{ stroke: isMasterSplitPressed ? '#000000' : '#9E9E9E' }}>
              <circle cx="28" cy="28" r="11" strokeWidth="4.5" />
              <circle cx="72" cy="28" r="11" strokeWidth="4.5" />
              <circle cx="28" cy="72" r="11" strokeWidth="4.5" />
              <circle cx="72" cy="72" r="11" strokeWidth="4.5" />
              <line x1="38" y1="38" x2="62" y2="62" strokeWidth="4" strokeLinecap="round" />
              <line x1="62" y1="38" x2="38" y2="62" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </TouchSafeButton>

          {/* ROW 1 (BOTTOM-RIGHT): FEED / PULSE Button — TABLET */}
          <TouchSafeButton
            onClick={handleEject}
            onMouseDown={() => setIsPulsePressed(true)}
            onMouseUp={() => setIsPulsePressed(false)}
            onMouseLeave={() => setIsPulsePressed(false)}
            onTouchStart={() => setIsPulsePressed(true)}
            onTouchEnd={() => setIsPulsePressed(false)}
            onTouchCancel={() => setIsPulsePressed(false)}
            className="hidden sm:flex sm:fixed sm:z-20 sm:pointer-events-auto rounded-full bg-[rgba(140,140,140,0.18)] border-[3px] border-[rgba(140,140,140,0.45)] shadow-md items-center justify-center cursor-pointer select-none group relative overflow-hidden"
            style={{
              position: 'fixed',
              width: TBTN_SIZE,
              height: TBTN_SIZE,
              right: TBTN_EDGE_R,
              bottom: TBTN_EDGE_B
            }}
            title="Pulse / Eject (W)"
          >
            <span className="absolute top-2.5 right-3 md:top-3 md:right-3.5 text-[10px] md:text-xs font-black text-slate-500 bg-white/60 px-1.5 py-0.5 rounded shadow-xs uppercase font-mono pointer-events-none">
              W
            </span>
            <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] transition-colors duration-75" fill="none" style={{ stroke: isPulsePressed ? '#000000' : '#9E9E9E' }}>
              <circle cx="50" cy="50" r="32" strokeWidth="4.5" />
              <circle cx="50" cy="50" r="17" strokeWidth="3.8" />
              <line x1="50" y1="10" x2="50" y2="90" strokeWidth="3.8" strokeLinecap="round" />
              <line x1="10" y1="50" x2="90" y2="50" strokeWidth="3.8" strokeLinecap="round" />
              <polygon points="50,34 45,48 49,48 48,62 56,47 52,47" style={{ fill: isPulsePressed ? '#000000' : '#9E9E9E' }} stroke="none" />
            </svg>
          </TouchSafeButton>

          {/* ROW 1 (BOTTOM-LEFT): MASTER SPLIT Button — TABLET */}
          <TouchSafeButton
            onClick={handleMasterSplit}
            onMouseDown={() => setIsMasterSplitPressed(true)}
            onMouseUp={() => setIsMasterSplitPressed(false)}
            onMouseLeave={() => setIsMasterSplitPressed(false)}
            onTouchStart={() => setIsMasterSplitPressed(true)}
            onTouchEnd={() => setIsMasterSplitPressed(false)}
            onTouchCancel={() => setIsMasterSplitPressed(false)}
            className="hidden sm:flex sm:fixed sm:z-20 sm:pointer-events-auto rounded-full bg-[rgba(140,140,140,0.18)] border-[3px] border-[rgba(140,140,140,0.45)] shadow-md items-center justify-center cursor-pointer select-none group relative overflow-hidden"
            style={{
              position: 'fixed',
              width: TBTN_SIZE,
              height: TBTN_SIZE,
              right: `calc(${TBTN_EDGE_R} + ${TBTN_SIZE} + ${TBTN_GAP})`,
              bottom: TBTN_EDGE_B
            }}
            title="Master Split / All-In (F / Shift+Space)"
          >
            <span className="absolute top-2.5 right-3 md:top-3 md:right-3.5 text-[10px] md:text-xs font-black text-slate-500 bg-white/60 px-1.5 py-0.5 rounded shadow-xs uppercase font-mono pointer-events-none">
              F
            </span>
            <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] transition-colors duration-75" fill="none" style={{ stroke: isMasterSplitPressed ? '#000000' : '#9E9E9E' }}>
              <circle cx="28" cy="28" r="11" strokeWidth="4.5" />
              <circle cx="72" cy="28" r="11" strokeWidth="4.5" />
              <circle cx="28" cy="72" r="11" strokeWidth="4.5" />
              <circle cx="72" cy="72" r="11" strokeWidth="4.5" />
              <line x1="38" y1="38" x2="62" y2="62" strokeWidth="4" strokeLinecap="round" />
              <line x1="62" y1="38" x2="38" y2="62" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </TouchSafeButton>

          {/* ROW 2 (TOP-RIGHT): SPLIT Button — TABLET */}
          <TouchSafeButton
            onClick={handleSplit}
            onMouseDown={() => setIsSplitPressed(true)}
            onMouseUp={() => setIsSplitPressed(false)}
            onMouseLeave={() => setIsSplitPressed(false)}
            onTouchStart={() => setIsSplitPressed(true)}
            onTouchEnd={() => setIsSplitPressed(false)}
            onTouchCancel={() => setIsSplitPressed(false)}
            className="hidden sm:flex sm:fixed sm:z-20 sm:pointer-events-auto rounded-full bg-[rgba(140,140,140,0.18)] border-[3px] border-[rgba(140,140,140,0.45)] shadow-md items-center justify-center cursor-pointer select-none group relative overflow-hidden"
            style={{
              position: 'fixed',
              width: TBTN_SIZE,
              height: TBTN_SIZE,
              right: TBTN_EDGE_R,
              bottom: `calc(${TBTN_EDGE_B} + ${TBTN_SIZE} + ${TBTN_GAP})`
            }}
            title="Split (Space)"
          >
            <span className="absolute top-2.5 right-3 md:top-3 md:right-3.5 text-[9px] md:text-[10px] font-black text-slate-500 bg-white/60 px-1.5 py-0.5 rounded shadow-xs uppercase font-mono pointer-events-none">
              SPACE
            </span>
            <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] transition-colors duration-75" fill="none" style={{ stroke: isSplitPressed ? '#000000' : '#9E9E9E' }}>
              <circle cx="34" cy="62" r="14" strokeWidth="5" fill="none" />
              <circle cx="66" cy="38" r="14" strokeWidth="5" fill="none" />
              <line x1="26" y1="24" x2="74" y2="76" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </TouchSafeButton>

          {/* ROW 2 (TOP-LEFT): MACRO Button (Hold to Feed) — TABLET */}
          <TouchSafeButton
            onMouseDown={startMacro}
            onMouseUp={stopMacro}
            onMouseLeave={stopMacro}
            onTouchStart={startMacro}
            onTouchEnd={stopMacro}
            onTouchCancel={stopMacro}
            className="hidden sm:flex sm:fixed sm:z-20 sm:pointer-events-auto rounded-full bg-[rgba(140,140,140,0.18)] border-[3px] border-[rgba(140,140,140,0.45)] shadow-md items-center justify-center cursor-pointer select-none group relative overflow-hidden"
            style={{
              position: 'fixed',
              width: TBTN_SIZE,
              height: TBTN_SIZE,
              right: `calc(${TBTN_EDGE_R} + ${TBTN_SIZE} + ${TBTN_GAP})`,
              bottom: `calc(${TBTN_EDGE_B} + ${TBTN_SIZE} + ${TBTN_GAP})`
            }}
            title="Macro / Titan Feed (Hold / E)"
          >
            <span className="absolute top-2.5 right-3 md:top-3 md:right-3.5 text-[10px] md:text-xs font-black text-slate-500 bg-white/60 px-1.5 py-0.5 rounded shadow-xs uppercase font-mono pointer-events-none">
              E
            </span>
            <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] transition-colors duration-75" fill="none" style={{ stroke: isMacroPressed ? '#000000' : '#9E9E9E' }}>
              <circle cx="50" cy="50" r="30" strokeWidth="5" />
              <line x1="50" y1="8" x2="50" y2="28" strokeWidth="5" strokeLinecap="round" />
              <line x1="50" y1="72" x2="50" y2="92" strokeWidth="5" strokeLinecap="round" />
              <line x1="8" y1="50" x2="28" y2="50" strokeWidth="5" strokeLinecap="round" />
              <line x1="72" y1="50" x2="92" y2="50" strokeWidth="5" strokeLinecap="round" />
              <circle cx="50" cy="50" r="6" style={{ fill: isMacroPressed ? '#000000' : '#9E9E9E' }} stroke="none" />
            </svg>
          </TouchSafeButton>
        </div>
      )}

      {isPaused && !isGameOverRef.current && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center pointer-events-auto z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-[#f1f5f9] border-[3px] border-[#cbd5e1] p-6 sm:p-8 rounded-3xl max-w-sm sm:max-w-md w-full shadow-2xl text-center flex flex-col items-center gap-4 sm:gap-6">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-800">
              Are you sure you want to leave?
            </h2>

            <div className="w-full grid grid-cols-2 gap-3 sm:gap-4 mt-1">
              {/* Red NO button */}
              <TouchSafeButton
                onClick={togglePause}
                className="w-full py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#ef4444] to-[#dc2626] border-2 border-[#b91c1c] hover:brightness-110 active:scale-95 text-white font-black text-sm sm:text-base tracking-wider shadow-md shadow-red-900/30 transition-all cursor-pointer flex items-center justify-center select-none"
              >
                No
              </TouchSafeButton>

              {/* Green YES button */}
              <TouchSafeButton
                onClick={onBack}
                className="w-full py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#22c55e] to-[#16a34a] border-2 border-[#15803d] hover:brightness-110 active:scale-95 text-white font-black text-sm sm:text-base tracking-wider shadow-md shadow-green-900/30 transition-all cursor-pointer flex items-center justify-center select-none"
              >
                Yes
              </TouchSafeButton>
            </div>
          </div>
        </div>
      )}

      {isGameOverRef.current && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center pointer-events-auto z-50">
          <h2 className="text-6xl font-black text-red-500 mb-4 tracking-widest drop-shadow-lg">WASTED</h2>
          <p className="text-white text-2xl mb-2">Final Score: {scoreRef.current}</p>
          <div className="flex items-center gap-2 mb-8 bg-purple-950/40 px-4 py-1.5 rounded-full border border-cyan-500/50 shadow-[0_0_15px_rgba(56,189,248,0.3)]">
            <img src="/ghost-token.png" alt="Ghost token" className="w-6 h-6 object-contain drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
            <span className="text-cyan-300 font-bold text-lg font-mono">Ghosts: {ghostTokenCount}</span>
          </div>
          <div className="flex gap-4">
            <TouchSafeButton  
              onClick={restartGame}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold text-xl transition-colors shadow-lg"
            >
              Play Again
            </TouchSafeButton>
            <TouchSafeButton  
              onClick={onBack}
              className="bg-white text-black px-8 py-4 rounded-xl font-bold text-xl hover:bg-gray-200 transition-colors shadow-lg"
            >
              Back to Menu
            </TouchSafeButton>
          </div>
        </div>
      )}
    </div>
  );
}