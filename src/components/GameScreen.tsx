import React, { useEffect, useRef, useState } from 'react';
import { Target, Zap, Play, Pause, RotateCcw, Home, HelpCircle, Smile, ListOrdered, Sliders, MessageCircle, Send } from 'lucide-react';
import { TouchSafeButton } from './TouchSafeButton';
import { PRESET_SKINS, SkinItem } from '../data/skinsData';

interface GameScreenProps {
  onBack: () => void;
  mode?: 'classic' | 'bots' | 'instantMerge';
}

// Game Constants
const MAP_SIZE = 3000;
const INITIAL_RADIUS = 20;
const BASE_PLAYER_SPEED = 2.4;
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
const GREEN_CANDY_TARGET_COUNT = 35;
const GREEN_CANDY_RADIUS = 9;
const GREEN_CANDY_MASS = 3.5;
const STORAGE_KEY_GREEN_CANDY = 'dasgar_greenCandyCount';
const BOT_COUNT = 15;
const VIRUS_COUNT = 20;
const VIRUS_RADIUS = 48;

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
};
type BotPlayer = Circle & {
  targetX: number;
  targetY: number;
  speed: number;
  name: string;
  vx: number;
  vy: number;
  renderX?: number;
  renderY?: number;
  renderRadius?: number;
  phaseOffset?: number;
};
type GreenCandy = {
  id: string;
  x: number;
  y: number;
  radius: number;
  pulsePhase?: number;
  eaten?: boolean;
};
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
      phaseOffset: Math.random() * Math.PI * 2
    }
  ]);

  const playerNameRef = useRef('You');
  const playerColorRef = useRef('#ff4444');
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
  const greenCandiesRef = useRef<GreenCandy[]>([]);
  const greenCandyImgRef = useRef<HTMLImageElement | null>(null);
  const botsRef = useRef<BotPlayer[]>([]);
  const virusesRef = useRef<Virus[]>([]);
  const scoreRef = useRef(PLAYER_START_SCORE);
  const isGameOverRef = useRef(false);
  const isPausedRef = useRef(false);

  const getInitialGreenCandyCount = (): number => {
    try {
      const val = localStorage.getItem(STORAGE_KEY_GREEN_CANDY);
      if (val !== null) {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
    } catch {
      // localStorage may fail in restricted iframes
    }
    return 0;
  };
  const greenCandyCountRef = useRef<number>(getInitialGreenCandyCount());
  const [greenCandyCount, setGreenCandyCount] = useState<number>(() => greenCandyCountRef.current);

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
  const [modFeedSpeed, setModFeedSpeed] = useState(14);
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

    greenCandiesRef.current = Array.from({ length: GREEN_CANDY_TARGET_COUNT }).map(() => ({
      id: generateId(),
      x: Math.random() * (MAP_SIZE - 100) + 50,
      y: Math.random() * (MAP_SIZE - 100) + 50,
      radius: GREEN_CANDY_RADIUS,
      pulsePhase: Math.random() * Math.PI * 2
    }));

    const BOT_NAMES = ['Apex', 'Vortex', 'Nova', 'Echo', 'Blaze', 'Savage', 'Pixel', 'Titan', 'Ghost', 'Orbit', 'Frost', 'Spark', 'Shadow', 'Cosmo', 'Neon'];

    botsRef.current = Array.from({ length: BOT_COUNT }).map((_, i) => {
      const x = Math.random() * (MAP_SIZE - 200) + 100;
      const y = Math.random() * (MAP_SIZE - 200) + 100;
      const radius = INITIAL_RADIUS + Math.random() * 15;
      return {
        id: generateId(),
        x,
        y,
        renderX: x,
        renderY: y,
        renderRadius: radius,
        radius,
        color: randomColor(),
        targetX: Math.random() * (MAP_SIZE - 200) + 100,
        targetY: Math.random() * (MAP_SIZE - 200) + 100,
        speed: 1.6 + Math.random() * 0.4,
        name: BOT_NAMES[i % BOT_NAMES.length] || `Bot ${i + 1}`,
        vx: 0,
        vy: 0,
        phaseOffset: Math.random() * Math.PI * 2
      };
    });

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
        phaseOffset: Math.random() * Math.PI * 2
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
        const burstSpeed = 24;
        const spawnX = Math.max(newRadius, Math.min(MAP_SIZE - newRadius, cell.x + dirX * (cell.radius * 0.85)));
        const spawnY = Math.max(newRadius, Math.min(MAP_SIZE - newRadius, cell.y + dirY * (cell.radius * 0.85)));

        // Parent recoil: smooth physical kickback
        cell.vx = -dirX * 2.2;
        cell.vy = -dirY * 2.2;
        cell.moveVx = 0;
        cell.moveVy = 0;

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
          ignoreParentUntil: now + 140
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

    // Preload Green Candy image asset
    const candyImg = new Image();
    candyImg.src = '/green-candy.png';
    candyImg.onload = () => {
      greenCandyImgRef.current = candyImg;
    };
    greenCandyImgRef.current = candyImg;

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

    const drawCircle = (circle: Circle, outline = false) => {
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      ctx.fillStyle = circle.color;
      ctx.fill();
      if (outline) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.stroke();
      }
    };

    const traceJellyCellPath = (cx: number, cy: number, radius: number, phaseOffset: number, time: number) => {
      const points = 52;
      // 1.5 - 2.5% subtle organic membrane shimmer, strictly bound
      const amplitude = Math.max(0.6, Math.min(radius * 0.02, 3.0));
      const lobes = 6;
      const speed = 0.0032;
      const angleStep = (Math.PI * 2) / points;

      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = i * angleStep;
        const rOffset = amplitude * Math.sin(angle * lobes + time * speed + phaseOffset);
        const r = radius + rOffset;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
    };

    const drawJellyCell = (
      cx: number,
      cy: number,
      radius: number,
      color: string,
      phaseOffset: number,
      time: number,
      outline = false,
      outlineColor = 'rgba(0,0,0,0.3)'
    ) => {
      traceJellyCellPath(cx, cy, radius, phaseOffset, time);
      ctx.fillStyle = color;
      ctx.fill();
      if (outline) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = outlineColor;
        ctx.stroke();
      }
    };

    const drawGreenCandy = (candy: GreenCandy, time: number) => {
      const cx = candy.x;
      const cy = candy.y;
      const r = candy.radius;

      const pulse = 0.88 + 0.12 * Math.sin(time * 0.0035 + (candy.pulsePhase || 0));
      const effectiveR = r * pulse;

      ctx.save();
      // Gentle aura glow behind candy
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR + 3.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(74, 222, 128, 0.22)';
      ctx.fill();

      if (greenCandyImgRef.current && greenCandyImgRef.current.complete && greenCandyImgRef.current.naturalWidth > 0) {
        const size = (effectiveR + 3) * 2;
        ctx.drawImage(
          greenCandyImgRef.current,
          cx - size / 2,
          cy - size / 2,
          size,
          size
        );
      } else {
        const grad = ctx.createRadialGradient(
          cx - r * 0.3, cy - r * 0.3, r * 0.15,
          cx, cy, r
        );
        grad.addColorStop(0, '#a7f3d0');
        grad.addColorStop(0.45, '#22c55e');
        grad.addColorStop(1, '#15803d');

        ctx.beginPath();
        ctx.arc(cx, cy, effectiveR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.restore();
    };

    const drawVirus = (virus: Virus) => {
      const spikes = 16;
      const outerRadius = virus.radius;
      const innerRadius = virus.radius * 0.88;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const px = virus.x + Math.cos(angle) * r;
        const py = virus.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#33ff33';
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
      const gap = 16;
      const arrowDist = maxRadius + gap;
      const arrowX = clusterCenterX + Math.cos(angle) * arrowDist;
      const arrowY = clusterCenterY + Math.sin(angle) * arrowDist;
      const arrowSize = Math.max(14, Math.min(maxRadius * 0.24, 28));

      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(arrowSize * 1.15, 0);
      ctx.lineTo(-arrowSize * 0.7, -arrowSize * 0.65);
      ctx.lineTo(-arrowSize * 0.35, 0);
      ctx.lineTo(-arrowSize * 0.7, arrowSize * 0.65);
      ctx.closePath();
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0284c7';
      ctx.stroke();
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
          phaseOffset: Math.random() * Math.PI * 2
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
        const accelRate = (inputMag > 0.02 || gatherMode) ? 10.0 * massTurnAgility : 4.0;
        const accel = 1 - Math.exp(-accelRate * (dt / 1000));
        cell.moveVx = (cell.moveVx || 0) + (targetVx - (cell.moveVx || 0)) * accel;
        cell.moveVy = (cell.moveVy || 0) + (targetVy - (cell.moveVy || 0)) * accel;

        // Apply movement velocity and burst split velocity
        cell.x += (cell.moveVx + cell.vx) * dtRatio;
        cell.y += (cell.moveVy + cell.vy) * dtRatio;

        // Smooth Agar.io split launch decay curve
        const burstDecay = Math.pow(0.88, dtRatio);
        cell.vx *= burstDecay;
        cell.vy *= burstDecay;
        if (Math.hypot(cell.vx, cell.vy) < 0.08) {
          cell.vx = 0;
          cell.vy = 0;
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

      // Bot movement (classic Agar.io bots: casual wandering, eating food, not hyper-active)
      const currentBots = botsRef.current;
      for (let i = 0; i < currentBots.length; i++) {
        const bot = currentBots[i];
        const dx = bot.targetX - bot.x;
        const dy = bot.targetY - bot.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 35) {
          bot.targetX = Math.random() * (MAP_SIZE - 200) + 100;
          bot.targetY = Math.random() * (MAP_SIZE - 200) + 100;
        } else {
          const botSpeed = 2.0 / Math.pow(Math.max(12, bot.radius) / INITIAL_RADIUS, 0.44);
          const targetVx = (dx / dist) * botSpeed;
          const targetVy = (dy / dist) * botSpeed;

          const accel = 1 - Math.exp(-6.0 * (dt / 1000));
          bot.vx = (bot.vx || 0) + (targetVx - (bot.vx || 0)) * accel;
          bot.vy = (bot.vy || 0) + (targetVy - (bot.vy || 0)) * accel;

          bot.x += bot.vx * dtRatio;
          bot.y += bot.vy * dtRatio;
        }

        bot.x = Math.max(bot.radius, Math.min(MAP_SIZE - bot.radius, bot.x));
        bot.y = Math.max(bot.radius, Math.min(MAP_SIZE - bot.radius, bot.y));
      }

      // Food consumption with zero-allocation in-place compaction
      let anyFoodEaten = false;
      for (let i = 0; i < currentCells.length; i++) {
        const cell = currentCells[i];
        const cellSqR = cell.radius * cell.radius;
        for (let j = 0; j < allFoods.length; j++) {
          const food = allFoods[j];
          if (food.eaten) continue;
          if (food.canBeEatenAfter && now < food.canBeEatenAfter && food.ownerCellId === cell.id) {
            continue;
          }
          const fdx = cell.x - food.x;
          const fdy = cell.y - food.y;
          if (fdx * fdx + fdy * fdy < cellSqR) {
            const massGain = food.mass !== undefined ? food.mass : 1.2;
            cell.radius = Math.sqrt(cell.radius * cell.radius + massGain);
            food.eaten = true;
            anyFoodEaten = true;
          }
        }
      }

      for (let i = 0; i < currentBots.length; i++) {
        const bot = currentBots[i];
        const botSqR = bot.radius * bot.radius;
        for (let j = 0; j < allFoods.length; j++) {
          const food = allFoods[j];
          if (food.eaten) continue;
          const fdx = bot.x - food.x;
          const fdy = bot.y - food.y;
          if (fdx * fdx + fdy * fdy < botSqR) {
            const massGain = food.mass !== undefined ? food.mass : 1.2;
            bot.radius = Math.sqrt(bot.radius * bot.radius + massGain);
            food.eaten = true;
            anyFoodEaten = true;
          }
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
            // Virus stays at standard radius (removed swelling/expansion effect when pushing virus)
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

      // Green Candy consumption & persistent collection
      const currentCandies = greenCandiesRef.current;
      let anyCandyEaten = false;
      let candiesEatenByPlayer = 0;

      for (let i = 0; i < currentCells.length; i++) {
        const cell = currentCells[i];
        const cellSqR = cell.radius * cell.radius;
        for (let j = 0; j < currentCandies.length; j++) {
          const candy = currentCandies[j];
          if (candy.eaten) continue;
          const cdx = cell.x - candy.x;
          const cdy = cell.y - candy.y;
          if (cdx * cdx + cdy * cdy < cellSqR) {
            cell.radius = Math.sqrt(cell.radius * cell.radius + GREEN_CANDY_MASS);
            candy.eaten = true;
            anyCandyEaten = true;
            candiesEatenByPlayer++;
          }
        }
      }

      for (let i = 0; i < currentBots.length; i++) {
        const bot = currentBots[i];
        const botSqR = bot.radius * bot.radius;
        for (let j = 0; j < currentCandies.length; j++) {
          const candy = currentCandies[j];
          if (candy.eaten) continue;
          const cdx = bot.x - candy.x;
          const cdy = bot.y - candy.y;
          if (cdx * cdx + cdy * cdy < botSqR) {
            bot.radius = Math.sqrt(bot.radius * bot.radius + GREEN_CANDY_MASS);
            candy.eaten = true;
            anyCandyEaten = true;
          }
        }
      }

      if (candiesEatenByPlayer > 0) {
        greenCandyCountRef.current += candiesEatenByPlayer;
        setGreenCandyCount(greenCandyCountRef.current);
        try {
          localStorage.setItem(STORAGE_KEY_GREEN_CANDY, greenCandyCountRef.current.toString());
        } catch {
          // safe ignore for restricted sandboxes
        }
      }

      if (anyCandyEaten) {
        let candyWriteIdx = 0;
        for (let i = 0; i < currentCandies.length; i++) {
          if (!currentCandies[i].eaten) {
            currentCandies[candyWriteIdx++] = currentCandies[i];
          }
        }
        currentCandies.length = candyWriteIdx;
      }

      while (greenCandiesRef.current.length < GREEN_CANDY_TARGET_COUNT) {
        const cx = Math.random() * (MAP_SIZE - 100) + 50;
        const cy = Math.random() * (MAP_SIZE - 100) + 50;
        greenCandiesRef.current.push({
          id: generateId(),
          x: cx,
          y: cy,
          radius: GREEN_CANDY_RADIUS,
          pulsePhase: Math.random() * Math.PI * 2
        });
      }

      // Virus collision & pop
      const poppedVirusIds = new Set<string>();
      const nextPlayerCells: PlayerCell[] = [];
      let playerCellsChanged = false;

      // Measure total player mass before virus collisions to strictly guarantee mass conservation
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

      // Mass must be 100% conserved no matter how many viruses get popped in one tick:
      // If the combined count exceeds 16, MERGE the excess back into existing cells
      // so total mass (sum of radius² across all cells) is provably identical before
      // and after this collision-handling block (repeatedly merge the two smallest cells).
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

        // Weighted center of position & velocity based on mass
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

        // Remove the second smallest cell
        nextPlayerCells.splice(minIdx2, 1);
        playerCellsChanged = true;
      }

      if (playerCellsChanged) {
        playerCellsRef.current = nextPlayerCells;

        // Sanity-check: Mass after virus pop must never be lower than mass before it
        const massAfterVirus = nextPlayerCells.reduce((sum, c) => sum + c.radius * c.radius, 0);
        console.assert(
          massAfterVirus >= massBeforeVirus - 0.05,
          `[Mass Conservation Violation] massBefore: ${massBeforeVirus.toFixed(2)}, massAfter: ${massAfterVirus.toFixed(2)}`
        );
      }

      botsRef.current.forEach(bot => {
        virusesRef.current.forEach(virus => {
          if (poppedVirusIds.has(virus.id)) return;
          const vdx = bot.x - virus.x;
          const vdy = bot.y - virus.y;
          if (vdx * vdx + vdy * vdy < bot.radius * bot.radius && bot.radius > virus.radius) {
            bot.radius = Math.max(INITIAL_RADIUS, bot.radius * 0.65);
            poppedVirusIds.add(virus.id);
          }
        });
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

      // Player eats Bot
      botsRef.current = botsRef.current.filter(bot => {
        for (let i = 0; i < playerCellsRef.current.length; i++) {
          const cell = playerCellsRef.current[i];
          const bdx = cell.x - bot.x;
          const bdy = cell.y - bot.y;
          if (bdx * bdx + bdy * bdy < cell.radius * cell.radius && cell.radius > bot.radius * 1.1) {
            cell.radius = Math.sqrt(cell.radius * cell.radius + bot.radius * bot.radius * 0.6);
            return false;
          }
        }
        return true;
      });

      // Bot eats Player
      const deadCellIds = new Set<string>();
      playerCellsRef.current.forEach(cell => {
        botsRef.current.forEach(bot => {
          const bdx = bot.x - cell.x;
          const bdy = bot.y - cell.y;
          if (bdx * bdx + bdy * bdy < bot.radius * bot.radius && bot.radius > cell.radius * 1.1) {
            bot.radius = Math.sqrt(bot.radius * bot.radius + cell.radius * cell.radius * 0.6);
            deadCellIds.add(cell.id);
          }
        });
      });

      if (deadCellIds.size > 0) {
        playerCellsRef.current = playerCellsRef.current.filter(c => !deadCellIds.has(c.id));
        if (playerCellsRef.current.length === 0) {
          isGameOverRef.current = true;
        }
      }

      while (botsRef.current.length < BOT_COUNT) {
        const bx = Math.random() * MAP_SIZE;
        const by = Math.random() * MAP_SIZE;
        const br = INITIAL_RADIUS + Math.random() * 20;
        botsRef.current.push({
          id: generateId(),
          x: bx,
          y: by,
          renderX: bx,
          renderY: by,
          renderRadius: br,
          radius: br,
          color: randomColor(),
          targetX: Math.random() * MAP_SIZE,
          targetY: Math.random() * MAP_SIZE,
          speed: 1.8 + Math.random() * 0.5,
          name: ['Apex', 'Vortex', 'Nova', 'Echo', 'Blaze', 'Savage', 'Pixel', 'Titan', 'Ghost', 'Orbit', 'Frost', 'Spark', 'Shadow', 'Cosmo', 'Neon'][Math.floor(Math.random() * 15)],
          vx: 0,
          vy: 0
        });
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
          botEntries[i] = {
            name: b.name,
            score: Math.floor((b.radius * b.radius) / 10),
            isPlayer: false
          };
        }
        botEntries[liveBots.length] = {
          name: playerNameRef.current,
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

      ctx.save();
      ctx.translate(cx, cy);

      // In Sarok.io / Agar.io, cells are ALWAYS 100% round circles (never oval/stretched)
      ctx.beginPath();
      ctx.arc(0, 0, cr, 0, Math.PI * 2);

      if (playerSkinImgRef.current && playerSkinImgRef.current.complete) {
        ctx.save();
        ctx.clip();
        
        const img = playerSkinImgRef.current;
        const iw = img.naturalWidth || img.width || 1;
        const ih = img.naturalHeight || img.height || 1;
        const minDim = Math.min(iw, ih);
        const sx = (iw - minDim) / 2;
        const sy = (ih - minDim) / 2;

        // Upright, static, centered skin image - never rotates or moves on the cell
        ctx.drawImage(
          img,
          sx,
          sy,
          minDim,
          minDim,
          -cr,
          -cr,
          cr * 2,
          cr * 2
        );
        ctx.restore();
        
        // Simple clean border
        ctx.lineWidth = Math.max(3.5, Math.min(8, cr * 0.045));
        ctx.strokeStyle = '#0284c7';
        ctx.stroke();
      } else {
        // Simple solid color when no skin is equipped
        ctx.fillStyle = playerColorRef.current || '#0284c7';
        ctx.fill();

        ctx.lineWidth = Math.max(3, Math.min(7, cr * 0.04));
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.stroke();
      }
      ctx.restore();

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

    const drawBot = (bot: BotPlayer, time: number) => {
      const bx = bot.renderX ?? bot.x;
      const by = bot.renderY ?? bot.y;
      const br = bot.renderRadius ?? bot.radius;
      const botScore = Math.floor((bot.radius * bot.radius) / 10);

      ctx.save();
      ctx.translate(bx, by);

      // In Sarok.io / Agar.io, cells are ALWAYS 100% round circles (never oval)
      ctx.beginPath();
      ctx.arc(0, 0, br, 0, Math.PI * 2);
      ctx.fillStyle = bot.color;
      ctx.fill();
      ctx.lineWidth = Math.max(2.5, Math.min(6, br * 0.04));
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.stroke();
      ctx.restore();

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
    };

    const draw = () => {
      const now = performance.now();
      const logicalWidth = canvas.clientWidth;
      const logicalHeight = canvas.clientHeight;

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

      const foods = foodsRef.current;
      for (let i = 0; i < foods.length; i++) {
        const food = foods[i];
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
          ctx.beginPath();
          ctx.arc(fx, fy, food.radius, 0, Math.PI * 2);
          ctx.fillStyle = food.color;
          ctx.fill();
        }
      }

      const candies = greenCandiesRef.current;
      for (let i = 0; i < candies.length; i++) {
        drawGreenCandy(candies[i], now);
      }

      // Re-use preallocated drawable list to eliminate per-frame GC allocation
      const pool = drawablePoolRef.current;
      let count = 0;

      if (!isGameOverRef.current) {
        const pCells = playerCellsRef.current;
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

      const bots = botsRef.current;
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        const r = b.renderRadius ?? b.radius;
        if (count < pool.length) {
          pool[count].type = 'bot';
          pool[count].entity = b;
          pool[count].radius = r;
        } else {
          pool.push({ type: 'bot', entity: b, radius: r });
        }
        count++;
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
          drawVirus(item.entity);
        }
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

      // Fixed 60Hz physics sub-stepping with accumulator for buttery smooth, consistent physics
      physicsAccumulatorRef.current += dt;
      const fixedStep = 1000 / 60; // 16.667ms
      const maxSubSteps = 3;
      let steps = 0;
      while (physicsAccumulatorRef.current >= fixedStep && steps < maxSubSteps) {
        update(fixedStep);
        physicsAccumulatorRef.current -= fixedStep;
        steps++;
      }
      if (steps >= maxSubSteps) {
        physicsAccumulatorRef.current = 0;
      }

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
        <div className="flex items-start gap-2 sm:gap-3 md:gap-4 pointer-events-auto">
          <TouchSafeButton
            onClick={togglePause}
            onMouseDown={() => setIsPausePressed(true)}
            onMouseUp={() => setIsPausePressed(false)}
            onMouseLeave={() => setIsPausePressed(false)}
            onTouchStart={() => setIsPausePressed(true)}
            onTouchEnd={() => setIsPausePressed(false)}
            onTouchCancel={() => setIsPausePressed(false)}
            className="w-10 h-10 sm:w-13 sm:h-13 md:w-18 md:h-18 lg:w-22 lg:h-22 bg-[rgba(140,140,140,0.18)] border-2 md:border-[3px] border-[rgba(140,140,140,0.45)] rounded-xl sm:rounded-2xl md:rounded-3xl shadow-sm flex items-center justify-center cursor-pointer select-none group shrink-0"
            title={isPaused ? "Resume Game (P)" : "Pause Game (P)"}
          >
            <Pause 
              className="w-5 h-5 sm:w-6.5 sm:h-6.5 md:w-9 md:h-9 lg:w-11 lg:h-11 transition-colors duration-75" 
              style={{ 
                color: isPausePressed ? '#000000' : '#9E9E9E',
                fill: isPausePressed ? '#000000' : '#9E9E9E'
              }}
            />
          </TouchSafeButton>

          <div className="flex flex-col select-none pt-0 sm:pt-0.5 md:pt-1.5">
            <span 
              className="text-base sm:text-xl md:text-3xl lg:text-4xl font-extrabold tracking-tight whitespace-nowrap"
              style={{ color: '#9E9E9E' }}
            >
              Score: {score}
            </span>
            <div 
              className="flex items-center gap-1 sm:gap-1.5 md:gap-2 mt-0.5 md:mt-1.5 w-fit"
              title="Green Candies collected"
            >
              <img
                src="/green-candy.png"
                alt="Green Candy"
                className="w-4 h-4 sm:w-5 sm:h-5 md:w-8 md:h-8 lg:w-9 lg:h-9 object-contain select-none pointer-events-none drop-shadow-sm"
              />
              <span className="text-xs sm:text-base md:text-xl lg:text-2xl font-black text-emerald-500 font-mono tracking-wide">
                {greenCandyCount}
              </span>
            </div>
          </div>
        </div>

        {/* Social / Communication Row: Emoji + Chat */}
        <div className="flex items-start gap-1.5 sm:gap-2.5 md:gap-3 pointer-events-auto">
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
              className={`w-10 h-10 sm:w-13 sm:h-13 md:w-18 md:h-18 lg:w-22 lg:h-22 bg-[rgba(140,140,140,0.18)] border-2 md:border-[3px] border-[rgba(140,140,140,0.45)] shadow-sm flex items-center justify-center cursor-pointer select-none group transition-all ${
                showEmojiPicker ? 'rounded-t-xl sm:rounded-t-2xl md:rounded-t-3xl border-b-0 bg-[rgba(140,140,140,0.28)]' : 'rounded-xl sm:rounded-2xl md:rounded-3xl'
              }`}
              title="Emotes"
            >
              <Smile 
                className="w-5 h-5 sm:w-6.5 sm:h-6.5 md:w-9 md:h-9 lg:w-11 lg:h-11 transition-colors duration-75" 
                style={{ color: showEmojiPicker || isEmojiPressed ? '#000000' : '#9E9E9E' }} 
              />
            </TouchSafeButton>

            {showEmojiPicker && (
              <div className="w-10 sm:w-13 md:w-18 lg:w-22 bg-[rgba(140,140,140,0.18)] border-2 md:border-[3px] border-t-0 border-[rgba(140,140,140,0.45)] rounded-b-xl sm:rounded-b-2xl md:rounded-b-3xl shadow-lg flex flex-col items-center py-1.5 sm:py-2.5 md:py-3 gap-1.5 sm:gap-2 md:gap-3 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto overflow-x-hidden no-scrollbar panel-animate-in animate-in fade-in slide-in-from-top-1 duration-150">
                {QUICK_EMOJIS.map(emojiItem => (
                  <button
                    key={emojiItem.id}
                    onClick={() => {
                      activeEmojiRef.current = { emoji: emojiItem.id, timeLeft: EMOJI_DISPLAY_DURATION };
                      setShowEmojiPicker(false);
                    }}
                    className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 lg:w-18 lg:h-18 rounded-full flex items-center justify-center p-0.5 hover:bg-white/20 active:scale-90 transition-transform cursor-pointer select-none shrink-0"
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
              className={`w-10 h-10 sm:w-13 sm:h-13 md:w-18 md:h-18 lg:w-22 lg:h-22 bg-[rgba(140,140,140,0.18)] border-2 md:border-[3px] border-[rgba(140,140,140,0.45)] shadow-sm flex items-center justify-center cursor-pointer select-none group transition-all ${
                showChat ? 'bg-[rgba(140,140,140,0.28)] rounded-xl sm:rounded-2xl md:rounded-3xl' : 'rounded-xl sm:rounded-2xl md:rounded-3xl'
              }`}
              title="Chat"
            >
              <MessageCircle 
                className="w-5 h-5 sm:w-6.5 sm:h-6.5 md:w-9 md:h-9 lg:w-11 lg:h-11 transition-colors duration-75" 
                style={{ color: showChat || isChatPressed ? '#000000' : '#9E9E9E' }} 
              />
            </TouchSafeButton>

            {showChat && (
              <div className="absolute top-12 sm:top-16 md:top-20 lg:top-26 left-0 w-60 sm:w-76 md:w-96 lg:w-[28rem] bg-[rgba(140,140,140,0.22)] backdrop-blur-md border-2 md:border-[3px] border-[rgba(140,140,140,0.45)] rounded-2xl md:rounded-3xl shadow-xl p-2.5 sm:p-3.5 md:p-4.5 space-y-2 sm:space-y-2.5 md:space-y-3.5 z-40 panel-animate-in animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-black/10 pb-1.5 md:pb-2">
                  <span className="text-[11px] sm:text-xs md:text-sm font-black text-slate-600 uppercase tracking-wider">Chat</span>
                  <button
                    onClick={() => setShowChat(false)}
                    className="text-xs sm:text-sm md:text-base text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded cursor-pointer font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="h-36 sm:h-48 md:h-60 lg:h-72 overflow-y-auto space-y-2 pr-1 no-scrollbar text-xs sm:text-sm md:text-base">
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
                  className="flex items-center gap-2 pt-1.5 md:pt-2 border-t border-black/10"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Type message..."
                    maxLength={60}
                    className="flex-1 bg-white/40 border border-[rgba(140,140,140,0.45)] rounded-xl md:rounded-2xl px-3 py-1.5 md:py-2 text-xs sm:text-sm md:text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center cursor-pointer transition-transform shrink-0"
                    title="Send"
                  >
                    <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
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
          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-teal-600/90 backdrop-blur-xs border border-teal-300 text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase shadow-md flex items-center gap-1.5"
          style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <span>🤖</span>
          <span>PRIVATE SERVER</span>
          <span className="text-teal-200">• BOTS ONLY</span>
        </div>
      )}
      {mode === 'instantMerge' && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-amber-600/90 backdrop-blur-xs border border-amber-300 text-white px-3 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase shadow-md flex items-center gap-1.5"
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
          className={`pointer-events-auto fixed z-30 w-10 h-10 sm:w-13 sm:h-13 md:w-18 md:h-18 lg:w-22 lg:h-22 border-2 md:border-[3px] rounded-xl sm:rounded-2xl md:rounded-3xl shadow-md flex items-center justify-center cursor-pointer select-none transition-colors duration-100 ${
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
          <Sliders className="w-5 h-5 sm:w-6.5 sm:h-6.5 md:w-9 md:h-9 lg:w-11 lg:h-11" style={{ color: showModMenu ? '#10b981' : (isModPressed ? '#000000' : '#9E9E9E') }} />
        </button>
      )}

      <div
        className="absolute flex flex-col items-end gap-1.5 sm:gap-3 md:gap-4 z-10"
        style={{ top: 'max(0.5rem, env(safe-area-inset-top))', right: 'max(0.5rem, env(safe-area-inset-right))' }}
      >
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3.5">
          {/* Mod Menu button in default spot (immediately to the LEFT of Leaderboard toggle) */}
          {!modBtnPos && (
            <button
              onPointerDown={handleModPointerDown}
              onPointerMove={handleModPointerMove}
              onPointerUp={handleModPointerUp}
              onPointerCancel={handleModPointerCancel}
              className={`pointer-events-auto w-10 h-10 sm:w-13 sm:h-13 md:w-18 md:h-18 lg:w-22 lg:h-22 border-2 md:border-[3px] rounded-xl sm:rounded-2xl md:rounded-3xl shadow-sm flex items-center justify-center cursor-pointer select-none transition-colors duration-100 ${
                isModDragging ? 'ring-2 ring-emerald-400 scale-105 shadow-xl' : ''
              }`}
              style={{
                touchAction: 'none',
                background: showModMenu ? 'rgba(16,185,129,0.18)' : 'rgba(140,140,140,0.18)',
                borderColor: showModMenu ? 'rgba(16,185,129,0.55)' : 'rgba(140,140,140,0.45)'
              }}
              title="Mod Menu (Hold to Reposition)"
            >
              <Sliders className="w-5 h-5 sm:w-6.5 sm:h-6.5 md:w-9 md:h-9 lg:w-11 lg:h-11" style={{ color: showModMenu ? '#10b981' : (isModPressed ? '#000000' : '#9E9E9E') }} />
            </button>
          )}

          <TouchSafeButton
            onClick={() => setShowLeaderboard(prev => !prev)}
            className="pointer-events-auto w-10 h-10 sm:w-13 sm:h-13 md:w-18 md:h-18 lg:w-22 lg:h-22 bg-[rgba(140,140,140,0.18)] border-2 md:border-[3px] border-[rgba(140,140,140,0.45)] rounded-xl sm:rounded-2xl md:rounded-3xl shadow-sm flex items-center justify-center cursor-pointer select-none"
            title="Leaderboard"
          >
            <ListOrdered className="w-5 h-5 sm:w-6.5 sm:h-6.5 md:w-9 md:h-9 lg:w-11 lg:h-11" style={{ color: '#9E9E9E' }} />
          </TouchSafeButton>
        </div>

        {showLeaderboard && leaderboard.length > 0 && (
          <div className="bg-[rgba(140,140,140,0.18)] border-2 md:border-[3px] border-[rgba(140,140,140,0.45)] rounded-xl sm:rounded-2xl md:rounded-3xl shadow-sm px-2.5 sm:px-4 md:px-6 py-1.5 sm:py-3 md:py-4.5 pointer-events-none w-36 sm:w-56 md:w-72 lg:w-80 panel-animate-in animate-in fade-in zoom-in-95 duration-150">
            <div className="text-[9px] sm:text-xs md:text-sm lg:text-base font-black text-slate-600 uppercase tracking-widest mb-1 sm:mb-2 text-center">
              {mode === 'bots' ? 'Bots Leaderboard' : (mode === 'instantMerge' ? 'Instant Merge' : 'Leaderboard')}
            </div>
            {leaderboard.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px] sm:text-xs md:text-base lg:text-lg font-bold py-0.5 sm:py-1 md:py-1.5">
                <span className={entry.isPlayer ? 'text-emerald-600' : 'text-slate-600'}>
                  {idx + 1}. {entry.name}
                </span>
                <span className={`font-mono ${entry.isPlayer ? 'text-emerald-600' : 'text-slate-500'}`}>{entry.score}</span>
              </div>
            ))}
            {playerRank && playerRank > 5 && (
              <>
                <div className="my-1 border-t border-black/10" />
                <div className="flex items-center justify-between text-[10px] sm:text-xs md:text-base lg:text-lg font-bold py-0.5 sm:py-1 md:py-1.5 text-emerald-600">
                  <span>{playerRank}. {playerNameRef.current || 'You'}</span>
                  <span className="font-mono">{score}</span>
                </div>
              </>
            )}
          </div>
        )}

        {showModMenu && (
          <div
            className={`bg-[rgba(140,140,140,0.18)] backdrop-blur-md border-2 md:border-[3px] border-[rgba(140,140,140,0.45)] rounded-2xl md:rounded-3xl shadow-lg px-4 sm:px-5 md:px-6 py-3 sm:py-4 md:py-5 pointer-events-auto w-56 sm:w-72 md:w-84 lg:w-96 space-y-3 sm:space-y-4 md:space-y-4.5 panel-animate-in animate-in fade-in zoom-in-95 duration-150 ${
              modBtnPos ? 'fixed z-30' : ''
            }`}
            style={
              modBtnPos
                ? {
                    left: `${Math.max(10, Math.min(window.innerWidth - 300, modBtnPos.x - 80))}px`,
                    top: `${Math.min(window.innerHeight - 300, modBtnPos.y + 54)}px`
                  }
                : undefined
            }
          >
            <div className="text-[10px] sm:text-xs md:text-sm lg:text-base font-black text-slate-600 uppercase tracking-widest text-center">Mod Menu</div>

            <div className="space-y-1 sm:space-y-1.5">
              <div className="flex items-center justify-between text-[10px] sm:text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wide">
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
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* MACRO SPEED — UPDATED to allow up to 10,000 feeds/second */}
            <div className="space-y-1 sm:space-y-1.5">
              <div className="flex items-center justify-between text-[10px] sm:text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wide">
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
                  // Slider is inverted so dragging RIGHT = faster (lower ms interval)
                  // min 0.1ms = 10,000/s, max 200ms = 5/s
                  const interval = 200.1 - parseFloat(e.target.value);
                  setModMacroInterval(interval);
                  modMacroIntervalRef.current = interval;
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1 sm:space-y-1.5">
              <div className="flex items-center justify-between text-[10px] sm:text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wide">
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
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {isInstantMergeMode && (
              <div className="flex items-center justify-between pt-0.5 pb-0.5 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                <span className="text-[10px] sm:text-xs md:text-sm font-black text-amber-600 uppercase tracking-wide">Instant Merge</span>
                <span className="text-[9px] sm:text-[10px] font-black text-emerald-600 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40 uppercase">Active</span>
              </div>
            )}

            {/* Test Mass Controls */}
            <div className="space-y-1.5 sm:space-y-2 pt-1.5 border-t border-slate-300/60">
              <span className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wide block">Test Mass</span>
              <div className="grid grid-cols-3 gap-1 sm:gap-2">
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
                  className="px-1 py-1 sm:py-1.5 bg-white/70 hover:bg-white text-slate-700 text-[10px] sm:text-xs md:text-sm font-bold rounded-lg md:rounded-xl border border-slate-300 shadow-xs cursor-pointer active:scale-95 text-center"
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
                  className="px-1 py-1 sm:py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] sm:text-xs md:text-sm font-bold rounded-lg md:rounded-xl shadow-xs cursor-pointer active:scale-95 text-center"
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
                  className="px-1 py-1 sm:py-1.5 bg-white/70 hover:bg-white text-rose-600 text-[10px] sm:text-xs md:text-sm font-bold rounded-lg md:rounded-xl border border-slate-300 shadow-xs cursor-pointer active:scale-95 text-center"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Mod Menu: Controls Reference & Touch Buttons Toggle */}
            <div className="pt-2 border-t border-slate-300/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wide">Touch Buttons</span>
                <button
                  type="button"
                  onClick={() => setIsTouchDevice(prev => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-colors cursor-pointer ${isTouchDevice ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}`}
                >
                  {isTouchDevice ? 'Visible' : 'Hidden (PC)'}
                </button>
              </div>
              <div className="bg-slate-100/90 rounded-xl p-2 border border-slate-200 text-[10px] sm:text-xs text-slate-600 font-mono space-y-1">
                <div className="font-bold uppercase tracking-wider text-slate-500 text-[9px] sm:text-[10px]">PC Controls</div>
                <div className="flex justify-between"><span>Mouse:</span><span className="font-bold text-slate-800">Move / Aim</span></div>
                <div className="flex justify-between"><span>Feed:</span><span className="font-bold text-amber-600">W</span></div>
                <div className="flex justify-between"><span>Split:</span><span className="font-bold text-cyan-600">SPACE</span></div>
                <div className="flex justify-between"><span>Macro Feed:</span><span className="font-bold text-emerald-600">E</span></div>
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
                className="w-full text-center text-[10px] sm:text-xs text-slate-500 hover:text-slate-800 underline py-0.5 cursor-pointer"
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
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center pointer-events-auto z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900/95 border-2 border-slate-700/80 p-7 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl text-center flex flex-col items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-inner">
              <HelpCircle className="w-8 h-8 text-amber-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-wide text-white drop-shadow">
                Are you sure you want to quit the game?
              </h2>
              <p className="text-xs font-medium text-slate-400">
                Your match progress and current score of <span className="text-emerald-400 font-bold">{score}</span> will be lost.
              </p>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 mt-2">
              <TouchSafeButton
                onClick={onBack}
                className="w-full py-3.5 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
              >
                Yes
              </TouchSafeButton>

              <TouchSafeButton
                onClick={togglePause}
                className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                No
              </TouchSafeButton>
            </div>
          </div>
        </div>
      )}

      {isGameOverRef.current && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center pointer-events-auto z-50">
          <h2 className="text-6xl font-black text-red-500 mb-4 tracking-widest drop-shadow-lg">WASTED</h2>
          <p className="text-white text-2xl mb-2">Final Score: {scoreRef.current}</p>
          <div className="flex items-center gap-2 mb-8 bg-white/10 px-4 py-1.5 rounded-full border border-emerald-500/40">
            <img src="/green-candy.png" alt="Green candy" className="w-6 h-6 object-contain" />
            <span className="text-emerald-400 font-bold text-lg font-mono">Candies: {greenCandyCount}</span>
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