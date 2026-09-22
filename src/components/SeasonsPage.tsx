import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Crown, 
  Sparkles, 
  Coins, 
  Diamond, 
  Check, 
  ShoppingBag, 
  AlertCircle, 
  Gift, 
  ArrowLeft,
  ChevronRight,
  Flame,
  Star,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move
} from 'lucide-react';
import { TouchSafeButton } from './TouchSafeButton';
import { playClaimRewardSound, playNodeClickSound, playChestSound } from '../utils/seasonSounds';
import seasonBgImage from '../assets/images/season_map_bg_1789659135767.jpg';

interface SeasonsPageProps {
  onBack: () => void;
  onOpenShop?: () => void;
}

interface SeasonNode {
  id: number;
  tier: number;
  label?: string;
  badgeType?: 'check' | 'chest' | 'gem' | 'daily' | 'bonus' | 'boss';
  rewardType: 'coins' | 'gems' | 'skin' | 'chest' | 'booster';
  rewardName: string;
  rewardAmount?: number;
  rewardIcon: string;
  xPercent: number; // relative % for responsive map layout
  yPercent: number;
}

const SEASON_NODES: SeasonNode[] = [
  {
    id: 1,
    tier: 1,
    badgeType: 'check',
    rewardType: 'coins',
    rewardName: '300 Gold Coins',
    rewardAmount: 300,
    rewardIcon: 'coins',
    xPercent: 28,
    yPercent: 71,
  },
  {
    id: 2,
    tier: 5,
    badgeType: 'check',
    rewardType: 'gems',
    rewardName: '50 Emerald Gems',
    rewardAmount: 50,
    rewardIcon: 'gem',
    xPercent: 37,
    yPercent: 67,
  },
  {
    id: 3,
    tier: 10,
    label: 'BONUS CHEST',
    badgeType: 'bonus',
    rewardType: 'chest',
    rewardName: 'Sweet Candy Chest',
    rewardAmount: 1,
    rewardIcon: 'chest',
    xPercent: 45,
    yPercent: 71,
  },
  {
    id: 4,
    tier: 16,
    badgeType: 'chest',
    rewardType: 'coins',
    rewardName: '800 Gold Coins',
    rewardAmount: 800,
    rewardIcon: 'coins',
    xPercent: 54,
    yPercent: 61,
  },
  {
    id: 5,
    tier: 22,
    label: 'BONUS CHEST',
    badgeType: 'gem',
    rewardType: 'gems',
    rewardName: '120 Emerald Gems',
    rewardAmount: 120,
    rewardIcon: 'gem',
    xPercent: 62,
    yPercent: 64,
  },
  {
    id: 6,
    tier: 25,
    label: 'BONUS CHEST',
    badgeType: 'chest',
    rewardType: 'chest',
    rewardName: 'Candy Swirl Mystery Box',
    rewardAmount: 1,
    rewardIcon: 'chest',
    xPercent: 64,
    yPercent: 52,
  },
  {
    id: 7,
    tier: 28,
    badgeType: 'chest',
    rewardType: 'coins',
    rewardName: '1,500 Gold Coins',
    rewardAmount: 1500,
    rewardIcon: 'coins',
    xPercent: 64,
    yPercent: 40,
  },
  {
    id: 8,
    tier: 32,
    label: 'DAILY QUEST',
    badgeType: 'daily',
    rewardType: 'gems',
    rewardName: '200 Emerald Gems',
    rewardAmount: 200,
    rewardIcon: 'gem',
    xPercent: 53,
    yPercent: 33,
  },
  {
    id: 9,
    tier: 36,
    badgeType: 'gem',
    rewardType: 'gems',
    rewardName: 'Candy Cane Booster',
    rewardAmount: 1,
    rewardIcon: 'booster',
    xPercent: 60,
    yPercent: 28,
  },
  {
    id: 10,
    tier: 40,
    label: 'BOSS: CANDY SWIRL PEAK',
    badgeType: 'boss',
    rewardType: 'skin',
    rewardName: 'Exclusive "Green Candy King" Skin',
    rewardIcon: 'skin',
    xPercent: 67,
    yPercent: 27,
  },
];

interface QuestItem {
  id: string;
  title: string;
  desc: string;
  progress: number;
  target: number;
  rewardXp: number;
  rewardCoins: number;
  completed: boolean;
  claimed: boolean;
}

const DEFAULT_QUESTS: QuestItem[] = [
  {
    id: 'q1',
    title: 'Sweet Tooth Feast',
    desc: 'Consume 500 green candy pellets in any game mode',
    progress: 500,
    target: 500,
    rewardXp: 250,
    rewardCoins: 400,
    completed: true,
    claimed: false,
  },
  {
    id: 'q2',
    title: 'Rapid Cell Division',
    desc: 'Perform 15 tactical splits in Classic FFA',
    progress: 15,
    target: 15,
    rewardXp: 350,
    rewardCoins: 600,
    completed: true,
    claimed: false,
  },
  {
    id: 'q3',
    title: 'Candy Mountain King',
    desc: 'Survive in the top 5 leaderboard for 3 minutes',
    progress: 2,
    target: 3,
    rewardXp: 600,
    rewardCoins: 1000,
    completed: false,
    claimed: false,
  },
];

export function SeasonsPage({ onBack, onOpenShop }: SeasonsPageProps) {
  // Player state persisted in localStorage
  const [collectedRewards, setCollectedRewards] = useState<number>(() => {
    const saved = localStorage.getItem('dasgar_season1_rewards_collected');
    return saved !== null ? parseInt(saved, 10) : 25;
  });

  const [coins, setCoins] = useState<number>(() => {
    const saved = localStorage.getItem('dasgar_player_coins');
    return saved !== null ? parseInt(saved, 10) : 8930;
  });

  const [gems, setGems] = useState<number>(() => {
    const saved = localStorage.getItem('dasgar_player_gems');
    return saved !== null ? parseInt(saved, 10) : 1245;
  });

  const [claimedNodeIds, setClaimedNodeIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('dasgar_season1_claimed_nodes');
      return saved ? JSON.parse(saved) : [1, 2, 3, 4];
    } catch {
      return [1, 2, 3, 4];
    }
  });

  const [quests, setQuests] = useState<QuestItem[]>(() => {
    try {
      const saved = localStorage.getItem('dasgar_season1_quests');
      return saved ? JSON.parse(saved) : DEFAULT_QUESTS;
    } catch {
      return DEFAULT_QUESTS;
    }
  });

  // Modal states
  const [selectedNode, setSelectedNode] = useState<SeasonNode | null>(null);
  const [isQuestsOpen, setIsQuestsOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [celebrationParticles, setCelebrationParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);

  // Viewport tracking for robust multi-device support
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1000,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Hide the gesture hint after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 4200);
    return () => clearTimeout(timer);
  }, []);

  // Compute world dimensions matching image aspect ratio (1376 / 768)
  const imageAspect = 1376 / 768; // ~1.79167
  let baseWorldWidth = viewportSize.width;
  let baseWorldHeight = viewportSize.width / imageAspect;
  if (baseWorldHeight < viewportSize.height) {
    baseWorldHeight = viewportSize.height;
    baseWorldWidth = viewportSize.height * imageAspect;
  }

  // Map Zoom & Pan State
  const [scale, setScale] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  scaleRef.current = scale;
  panRef.current = pan;

  const viewportRef = useRef<HTMLDivElement>(null);

  // Gesture tracking ref to reliably distinguish tap vs pan/pinch
  const gestureRef = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    startClient: { x: number; y: number };
    startPan: { x: number; y: number };
    startScale: number;
    startDistance: number;
    startMidpoint: { x: number; y: number };
    hasMoved: boolean;
    dragDistance: number;
  }>({
    mode: 'none',
    startClient: { x: 0, y: 0 },
    startPan: { x: 0, y: 0 },
    startScale: 1.0,
    startDistance: 0,
    startMidpoint: { x: 0, y: 0 },
    hasMoved: false,
    dragDistance: 0,
  });

  // Clamping function to keep the map well-bounded on any device
  const clampPan = useCallback((newPan: { x: number; y: number }, curScale: number) => {
    const overflowX = Math.max(0, (baseWorldWidth * curScale - viewportSize.width) / 2);
    const overflowY = Math.max(0, (baseWorldHeight * curScale - viewportSize.height) / 2);
    const allowSlackX = 120 * curScale;
    const allowSlackY = 80 * curScale;
    const maxX = overflowX + allowSlackX;
    const maxY = overflowY + allowSlackY;
    return {
      x: Math.max(-maxX, Math.min(maxX, newPan.x)),
      y: Math.max(-maxY, Math.min(maxY, newPan.y)),
    };
  }, [baseWorldWidth, baseWorldHeight, viewportSize.width, viewportSize.height]);

  // Touch gesture listeners (Pinch-to-zoom & one-finger pan)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      setShowHint(false);
      setIsTransitioning(false);
      if (e.touches.length === 1) {
        gestureRef.current.mode = 'pan';
        gestureRef.current.startClient = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        gestureRef.current.startPan = { ...panRef.current };
        gestureRef.current.hasMoved = false;
        gestureRef.current.dragDistance = 0;
      } else if (e.touches.length >= 2) {
        gestureRef.current.mode = 'pinch';
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        gestureRef.current.startDistance = dist;
        gestureRef.current.startScale = scaleRef.current;
        gestureRef.current.startPan = { ...panRef.current };
        gestureRef.current.startMidpoint = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        gestureRef.current.hasMoved = true;
        e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (gestureRef.current.mode === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - gestureRef.current.startClient.x;
        const dy = e.touches[0].clientY - gestureRef.current.startClient.y;
        gestureRef.current.dragDistance += Math.hypot(dx, dy);
        if (gestureRef.current.dragDistance > 6) {
          gestureRef.current.hasMoved = true;
        }
        const updatedPan = clampPan(
          { x: gestureRef.current.startPan.x + dx, y: gestureRef.current.startPan.y + dy },
          scaleRef.current
        );
        panRef.current = updatedPan;
        setPan(updatedPan);
        // Prevent unwanted browser pull-to-refresh or page swipe navigation
        e.preventDefault();
      } else if (e.touches.length >= 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (gestureRef.current.startDistance > 0) {
          const ratio = dist / gestureRef.current.startDistance;
          const newScale = Math.min(2.8, Math.max(0.75, gestureRef.current.startScale * ratio));

          const curMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const curMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const midDx = curMidX - gestureRef.current.startMidpoint.x;
          const midDy = curMidY - gestureRef.current.startMidpoint.y;

          const updatedPan = clampPan(
            { x: gestureRef.current.startPan.x + midDx, y: gestureRef.current.startPan.y + midDy },
            newScale
          );
          scaleRef.current = newScale;
          panRef.current = updatedPan;
          setScale(newScale);
          setPan(updatedPan);
          gestureRef.current.hasMoved = true;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // Transition back to pan if one finger still touches
        gestureRef.current.mode = 'pan';
        gestureRef.current.startClient = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        gestureRef.current.startPan = { ...panRef.current };
      } else if (e.touches.length === 0) {
        gestureRef.current.mode = 'none';
        gestureRef.current.startDistance = 0;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [clampPan]);

  // Desktop Mouse Drag & Wheel handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setShowHint(false);
    setIsTransitioning(false);
    gestureRef.current.mode = 'pan';
    gestureRef.current.startClient = { x: e.clientX, y: e.clientY };
    gestureRef.current.startPan = { ...panRef.current };
    gestureRef.current.hasMoved = false;
    gestureRef.current.dragDistance = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (gestureRef.current.mode === 'pan') {
      const dx = e.clientX - gestureRef.current.startClient.x;
      const dy = e.clientY - gestureRef.current.startClient.y;
      gestureRef.current.dragDistance += Math.hypot(dx, dy);
      if (gestureRef.current.dragDistance > 6) {
        gestureRef.current.hasMoved = true;
      }
      const updatedPan = clampPan(
        { x: gestureRef.current.startPan.x + dx, y: gestureRef.current.startPan.y + dy },
        scale
      );
      panRef.current = updatedPan;
      setPan(updatedPan);
    }
  };

  const handleMouseUp = () => {
    gestureRef.current.mode = 'none';
  };

  const handleWheel = (e: React.WheelEvent) => {
    setShowHint(false);
    setIsTransitioning(false);
    const zoomDelta = -e.deltaY * 0.0015;
    const newScale = Math.min(2.8, Math.max(0.75, scale * (1 + zoomDelta)));
    const updatedPan = clampPan(pan, newScale);
    scaleRef.current = newScale;
    panRef.current = updatedPan;
    setScale(newScale);
    setPan(updatedPan);
  };

  // Quick Zoom buttons
  const handleZoomIn = () => {
    setIsTransitioning(true);
    const newScale = Math.min(2.8, scale * 1.3);
    const updatedPan = clampPan(pan, newScale);
    setScale(newScale);
    setPan(updatedPan);
  };

  const handleZoomOut = () => {
    setIsTransitioning(true);
    const newScale = Math.max(0.75, scale / 1.3);
    const updatedPan = clampPan(pan, newScale);
    setScale(newScale);
    setPan(updatedPan);
  };

  const handleResetZoom = () => {
    setIsTransitioning(true);
    setScale(1.0);
    setPan({ x: 0, y: 0 });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const saveState = (newCollected: number, newCoins: number, newGems: number, newClaimed: number[]) => {
    setCollectedRewards(newCollected);
    setCoins(newCoins);
    setGems(newGems);
    setClaimedNodeIds(newClaimed);

    localStorage.setItem('dasgar_season1_rewards_collected', newCollected.toString());
    localStorage.setItem('dasgar_player_coins', newCoins.toString());
    localStorage.setItem('dasgar_player_gems', newGems.toString());
    localStorage.setItem('dasgar_season1_claimed_nodes', JSON.stringify(newClaimed));
  };

  const triggerCelebration = () => {
    const colors = ['#4ade80', '#22c55e', '#a3e635', '#38bdf8', '#facc15', '#f472b6'];
    const newParticles = Array.from({ length: 24 }).map((_, i) => ({
      id: Date.now() + i,
      x: 50 + (Math.random() - 0.5) * 40,
      y: 70 + (Math.random() - 0.5) * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setCelebrationParticles(newParticles);
    setTimeout(() => {
      setCelebrationParticles([]);
    }, 1200);
  };

  // Claim All Rewards button
  const handleClaimAll = () => {
    playClaimRewardSound();
    triggerCelebration();

    const unclaimedUnlocked = SEASON_NODES.filter(
      n => n.tier <= collectedRewards && !claimedNodeIds.includes(n.id)
    );

    let addedCoins = 0;
    let addedGems = 0;
    const newClaimed = [...claimedNodeIds];

    if (unclaimedUnlocked.length > 0) {
      unclaimedUnlocked.forEach(node => {
        newClaimed.push(node.id);
        if (node.rewardType === 'coins' && node.rewardAmount) addedCoins += node.rewardAmount;
        if (node.rewardType === 'gems' && node.rewardAmount) addedGems += node.rewardAmount;
      });
      const nextCount = Math.min(40, collectedRewards + unclaimedUnlocked.length);
      saveState(nextCount, coins + addedCoins, gems + addedGems, newClaimed);
      showToast(`Collected +${addedCoins} Coins & +${addedGems} Gems!`);
    } else {
      const nextCount = Math.min(40, collectedRewards + 1);
      const bonusCoins = 500;
      const bonusGems = 50;
      saveState(nextCount, coins + bonusCoins, gems + bonusGems, newClaimed);
      showToast(`Tier Claimed! +${bonusCoins} Coins & +${bonusGems} Gems!`);
    }
  };

  // Claim single node
  const handleClaimSingleNode = (node: SeasonNode) => {
    playChestSound();
    triggerCelebration();

    const newClaimed = [...claimedNodeIds, node.id];
    let newCoins = coins;
    let newGems = gems;

    if (node.rewardType === 'coins' && node.rewardAmount) newCoins += node.rewardAmount;
    if (node.rewardType === 'gems' && node.rewardAmount) newGems += node.rewardAmount;
    if (node.rewardType === 'chest') {
      newCoins += 650;
      newGems += 45;
    }
    if (node.rewardType === 'skin') {
      newCoins += 1000;
      newGems += 100;
    }

    const nextCount = Math.min(40, Math.max(collectedRewards, node.tier));
    saveState(nextCount, newCoins, newGems, newClaimed);
    setSelectedNode(null);
    showToast(`Claimed ${node.rewardName}!`);
  };

  const handleClaimQuest = (questId: string) => {
    playClaimRewardSound();
    triggerCelebration();

    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    const updated = quests.map(q => q.id === questId ? { ...q, claimed: true } : q);
    setQuests(updated);
    localStorage.setItem('dasgar_season1_quests', JSON.stringify(updated));

    const nextCount = Math.min(40, collectedRewards + 1);
    saveState(nextCount, coins + quest.rewardCoins, gems + 25, claimedNodeIds);
    showToast(`Quest Complete! +${quest.rewardCoins} Coins & +${quest.rewardXp} XP!`);
  };

  const progressPercent = Math.min(100, Math.round((collectedRewards / 40) * 100));

  // Determine if screen is in compact height / landscape mode (e.g. iPhone in landscape, screen height <= 520px)
  const isLandscapeCompact = viewportSize.height <= 520 || (viewportSize.width > viewportSize.height && viewportSize.height < 600);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-sans text-white">
      {/* ========================================================================= */}
      {/* INTERACTIVE ZOOMABLE & PANNABLE MAP VIEWPORT                               */}
      {/* ========================================================================= */}
      <div 
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="absolute inset-0 z-0 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none' }}
      >
        {/* Transformable World Canvas (Background + All Nodes strictly bound together) */}
        <div 
          className="relative pointer-events-auto"
          style={{
            width: `${baseWorldWidth}px`,
            height: `${baseWorldHeight}px`,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isTransitioning ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
          }}
        >
          {/* Lush 3D Isometric Green Candy World Background */}
          <img 
            src={seasonBgImage} 
            alt="Season 1 Green Candy World" 
            className="w-full h-full object-cover object-center pointer-events-none select-none block"
            draggable={false}
          />

          {/* Vignette and lighting layer */}
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/70 via-transparent to-emerald-950/50 pointer-events-none" />
          <div className="absolute inset-0 bg-emerald-900/10 mix-blend-color pointer-events-none" />

          {/* Start Flag (bottom left on candy road) */}
          <div 
            className="absolute z-10 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: '17%', top: '76%' }}
          >
            <div className="bg-emerald-950/90 border-2 border-emerald-400 rounded-full px-2.5 sm:px-3 py-1 flex items-center gap-1.5 shadow-lg shadow-black/50">
              <div className="w-3.5 h-3.5 rounded-full bg-lime-400 flex items-center justify-center text-emerald-950 font-black text-[9px]">
                ★
              </div>
              <span className="font-black text-[10px] sm:text-xs text-lime-300 tracking-widest uppercase whitespace-nowrap">START</span>
            </div>
          </div>

          {/* Boss Peak Tag (top right candy mountain peak) */}
          <div 
            className="absolute z-10 pointer-events-auto transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: '67%', top: '21%' }}
          >
            <motion.div 
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="bg-emerald-950/90 border-2 border-amber-400/80 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer hud-tap whitespace-nowrap"
              onClick={() => {
                if (gestureRef.current.hasMoved) return;
                const bossNode = SEASON_NODES.find(n => n.id === 10);
                if (bossNode) {
                  playNodeClickSound();
                  setSelectedNode(bossNode);
                }
              }}
            >
              <Crown size={14} className="text-amber-400 fill-amber-400" />
              <span className="font-black text-[9.5px] sm:text-xs text-amber-300 tracking-wider uppercase whitespace-nowrap">
                BOSS: CANDY SWIRL PEAK
              </span>
            </motion.div>
          </div>

          {/* Interactive Checkpoints along the candy path */}
          {SEASON_NODES.map((node) => {
            const isClaimed = claimedNodeIds.includes(node.id);
            const isUnlocked = node.tier <= collectedRewards;
            const isCurrentActive = isUnlocked && !isClaimed;

            return (
              <div
                key={node.id}
                className="absolute z-10 pointer-events-auto transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.xPercent}%`, top: `${node.yPercent}%` }}
              >
                {/* Optional Floating Tag above node */}
                {node.label && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                    <div className="bg-emerald-950/90 border border-lime-400/80 rounded-full px-2 py-0.5 text-[8.5px] sm:text-[9.5px] font-black tracking-wider text-lime-300 shadow-md uppercase whitespace-nowrap">
                      {node.label}
                    </div>
                  </div>
                )}

                {/* Node Button with Pin Style and Glow */}
                <TouchSafeButton
                  onClick={() => {
                    // Suppress node opening if user was dragging or pinching the map
                    if (gestureRef.current.hasMoved) return;
                    playNodeClickSound();
                    setSelectedNode(node);
                  }}
                  className={`relative group rounded-full flex items-center justify-center transition-all select-none hud-tap ${
                    isCurrentActive
                      ? 'scale-110 sm:scale-125'
                      : 'scale-90 sm:scale-100 hover:scale-110'
                  }`}
                >
                  {/* Ripple Glow for Current Active Node */}
                  {isCurrentActive && (
                    <motion.div
                      animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full bg-lime-400 blur-sm pointer-events-none"
                    />
                  )}

                  {/* Outer Pin Body */}
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-[2.5px] shadow-xl flex items-center justify-center ${
                    isClaimed
                      ? 'bg-emerald-600 border-lime-300 text-white shadow-emerald-500/40'
                      : isCurrentActive
                      ? 'bg-gradient-to-b from-lime-400 to-green-600 border-white text-emerald-950 shadow-lime-400/60 ring-2 ring-lime-400'
                      : 'bg-emerald-950/90 border-emerald-600/70 text-emerald-400 shadow-black/50 opacity-90'
                  }`}>
                    {/* Pin Content Icon */}
                    {isClaimed ? (
                      <Check size={16} strokeWidth={3} className="text-white drop-shadow" />
                    ) : node.badgeType === 'boss' ? (
                      <Crown size={18} className="text-amber-300 fill-amber-300 drop-shadow" />
                    ) : node.badgeType === 'chest' || node.badgeType === 'bonus' ? (
                      <Gift size={16} className={isCurrentActive ? 'text-white' : 'text-lime-300'} />
                    ) : node.badgeType === 'gem' ? (
                      <Diamond size={16} className={isCurrentActive ? 'text-cyan-200 fill-cyan-200' : 'text-emerald-300'} />
                    ) : (
                      <Star size={16} className={isCurrentActive ? 'text-white fill-white' : 'text-lime-400'} />
                    )}
                  </div>

                  {/* Ground ripple ring under pin */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-2 rounded-full bg-emerald-400/30 blur-[1px] pointer-events-none" />
                </TouchSafeButton>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Celebration Particles */}
      {celebrationParticles.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, scale: 0.5, x: `${p.x}vw`, y: `${p.y}vh` }}
          animate={{
            opacity: 0,
            scale: 1.8,
            x: `${p.x + (Math.random() - 0.5) * 20}vw`,
            y: `${p.y - 25 - Math.random() * 20}vh`,
          }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="absolute z-50 pointer-events-none w-3 h-3 sm:w-4 sm:h-4 rounded-full shadow-lg"
          style={{ backgroundColor: p.color }}
        />
      ))}

      {/* Toast Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-900/95 border-2 border-lime-400 text-lime-200 font-extrabold text-xs sm:text-sm px-5 py-2 rounded-full shadow-2xl flex items-center gap-2 pointer-events-none backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-lime-400 animate-spin" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* FLOATING ZOOM & NAV CONTROLS (Right Side HUD)                             */}
      {/* ========================================================================= */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 pointer-events-auto">
        <div className="bg-emerald-950/90 border border-emerald-500/60 rounded-full p-1 shadow-2xl backdrop-blur-md flex flex-col items-center gap-1">
          <TouchSafeButton
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-full bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 hover:text-white flex items-center justify-center hud-tap transition-all"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </TouchSafeButton>
          <div className="text-[9px] font-black text-lime-400 select-none py-0.5">
            {Math.round(scale * 100)}%
          </div>
          <TouchSafeButton
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-full bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 hover:text-white flex items-center justify-center hud-tap transition-all"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </TouchSafeButton>
          <div className="w-4 h-[1px] bg-emerald-700/60 my-0.5" />
          <TouchSafeButton
            onClick={handleResetZoom}
            className="w-8 h-8 rounded-full bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 hover:text-white flex items-center justify-center hud-tap transition-all"
            title="Reset View"
          >
            <RotateCcw size={14} />
          </TouchSafeButton>
        </div>
      </div>

      {/* Touch Gesture Prompt Hint (Fades out automatically) */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-30 bg-emerald-950/90 border border-emerald-500/60 rounded-full px-4 py-1 text-[11px] font-black text-lime-300 shadow-xl backdrop-blur-md pointer-events-none flex items-center gap-2"
          >
            <Move size={12} className="text-lime-400 animate-pulse" />
            <span>Pinch with 2 fingers to zoom • Drag to explore</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* TOP HEADER CONSOLE: RESPONSIVE FOR ALL DEVICES (LANDSCAPE & PORTRAIT)    */}
      {/* ========================================================================= */}
      <div className="absolute top-1.5 sm:top-3 left-0 right-0 z-30 px-2.5 sm:px-6 pointer-events-none">
        {/* In Compact/Landscape orientation (like iPhone landscape shown in IMG_1911) */}
        {isLandscapeCompact ? (
          <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-2 pointer-events-auto">
            {/* Left: Back / Exit Button */}
            <TouchSafeButton
              onClick={onBack}
              className="bg-emerald-950/90 hover:bg-emerald-900 border-2 border-emerald-500/60 rounded-full px-3 py-1.5 text-emerald-200 hover:text-white flex items-center gap-1.5 shadow-lg shadow-emerald-950/80 transition-all hud-tap flex-shrink-0"
              title="Return to Main Menu"
            >
              <ArrowLeft size={16} className="text-emerald-400 pointer-events-none" />
              <span className="font-black text-[11px] uppercase tracking-wider pointer-events-none">Menu</span>
            </TouchSafeButton>

            {/* Center: Sleek Unified Season Header & Progress Bar in a Single Compact Bar */}
            <div className="bg-emerald-950/95 border-2 border-emerald-500/70 rounded-full px-3.5 py-1 shadow-xl backdrop-blur-md flex items-center gap-2.5 flex-shrink-0">
              {/* Lollipop Swirl Mini Icon */}
              <div className="w-5 h-5 flex-shrink-0">
                <svg viewBox="0 0 40 40" className="w-full h-full">
                  <rect x="18" y="22" width="4" height="16" rx="2" fill="#dcfce7" stroke="#15803d" strokeWidth="1" />
                  <circle cx="20" cy="18" r="14" fill="#22c55e" stroke="#16a34a" strokeWidth="2" />
                  <path d="M 20 6 A 12 12 0 0 1 32 18 A 9 9 0 0 1 23 27 A 6 6 0 0 1 17 21 A 3 3 0 0 1 20 18" fill="none" stroke="#f0fdf4" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              {/* Title & Season Tag */}
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-wider text-white">
                  DASGAR<span className="text-lime-400">.IO</span>
                </span>
                <span className="bg-lime-400/20 border border-lime-400/50 text-lime-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap">
                  SEASON 1
                </span>
              </div>

              {/* Divider */}
              <div className="w-[1px] h-4 bg-emerald-700/80" />

              {/* Progress Tracker */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-emerald-200 uppercase whitespace-nowrap">
                  REWARDS {collectedRewards}/40
                </span>
                <div className="w-20 sm:w-28 bg-emerald-900/80 border border-emerald-600/50 rounded-full h-2.5 overflow-hidden p-0.5">
                  <div 
                    className="bg-gradient-to-r from-lime-400 to-green-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(74,222,128,0.9)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-lime-300">{progressPercent}%</span>
              </div>
            </div>

            {/* Right: Currencies & Season Timer */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Gems */}
              <div className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-600/50 rounded-full px-2.5 py-1 shadow-inner">
                <Diamond size={13} className="text-cyan-400 fill-cyan-400" />
                <span className="font-black text-xs text-white">{gems.toLocaleString()}</span>
              </div>

              {/* Coins */}
              <div className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-600/50 rounded-full px-2.5 py-1 shadow-inner">
                <Coins size={13} className="text-amber-400 fill-amber-400" />
                <span className="font-black text-xs text-white">{coins.toLocaleString()}</span>
              </div>

              {/* Ends in 14D */}
              <div className="hidden xs:flex items-center gap-1 bg-emerald-950/90 border border-emerald-500/50 rounded-full px-2.5 py-1 text-lime-300 text-[10px] font-black shadow-lg whitespace-nowrap">
                <Flame className="w-3.5 h-3.5 text-lime-400 fill-lime-400" />
                <span>14D 8H</span>
              </div>
            </div>
          </div>
        ) : (
          /* In Portrait / Tall Screen Orientation */
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-1.5 pointer-events-auto">
            {/* Top Row: Menu Button & Currencies & Timer */}
            <div className="w-full flex items-center justify-between gap-2">
              <TouchSafeButton
                onClick={onBack}
                className="bg-emerald-950/90 hover:bg-emerald-900 border-2 border-emerald-500/60 rounded-full px-3 py-1.5 text-emerald-200 hover:text-white flex items-center gap-1.5 shadow-lg shadow-emerald-950/80 transition-all hud-tap"
                title="Return to Main Menu"
              >
                <ArrowLeft size={16} className="text-emerald-400 pointer-events-none" />
                <span className="font-black text-xs uppercase tracking-wider pointer-events-none">Menu</span>
              </TouchSafeButton>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-600/50 rounded-full px-2.5 py-1 shadow-inner">
                  <Diamond size={13} className="text-cyan-400 fill-cyan-400" />
                  <span className="font-black text-xs text-white">{gems.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-600/50 rounded-full px-2.5 py-1 shadow-inner">
                  <Coins size={13} className="text-amber-400 fill-amber-400" />
                  <span className="font-black text-xs text-white">{coins.toLocaleString()}</span>
                </div>
                <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-full px-2.5 py-1 flex items-center gap-1 text-lime-300 text-[10px] font-black shadow-lg">
                  <Flame className="w-3.5 h-3.5 text-lime-400 fill-lime-400" />
                  <span>14D 8H</span>
                </div>
              </div>
            </div>

            {/* Second Row: Compact Season Title & Progress Bar Card */}
            <div className="w-full bg-emerald-950/95 border-2 border-emerald-500/70 rounded-2xl px-4 py-2 shadow-xl backdrop-blur-md flex flex-col items-center">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 flex-shrink-0">
                  <svg viewBox="0 0 40 40" className="w-full h-full">
                    <rect x="18" y="22" width="4" height="16" rx="2" fill="#dcfce7" stroke="#15803d" strokeWidth="1" />
                    <circle cx="20" cy="18" r="14" fill="#22c55e" stroke="#16a34a" strokeWidth="2" />
                    <path d="M 20 6 A 12 12 0 0 1 32 18 A 9 9 0 0 1 23 27 A 6 6 0 0 1 17 21 A 3 3 0 0 1 20 18" fill="none" stroke="#f0fdf4" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white leading-none">
                  DASGAR<span className="text-lime-400">.IO</span>
                </h1>
                <span className="bg-lime-400/20 border border-lime-400/50 text-lime-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ml-1">
                  SEASON 1
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] font-black tracking-wider text-emerald-200 uppercase">
                  <span>REWARDS {collectedRewards}/40 COLLECTED</span>
                  <span className="text-lime-300">{progressPercent}%</span>
                </div>
                <div className="w-full bg-emerald-900/80 border border-emerald-600/50 rounded-full h-2.5 overflow-hidden p-0.5">
                  <div 
                    className="bg-gradient-to-r from-lime-400 to-green-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(74,222,128,0.9)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM ACTION BAR: DAILY QUESTS, CLAIM REWARDS, SHOP                      */}
      {/* ========================================================================= */}
      <div className="absolute bottom-2 sm:bottom-3 left-0 right-0 z-30 flex justify-center px-3 sm:px-6 pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-3xl flex items-center justify-between gap-2 sm:gap-3 pointer-events-auto">
          {/* Left: DAILY QUESTS button */}
          <TouchSafeButton
            onClick={() => {
              playNodeClickSound();
              setIsQuestsOpen(true);
            }}
            className={`flex-1 sm:flex-initial bg-emerald-950/95 hover:bg-emerald-900 border-2 border-emerald-500/70 rounded-full flex items-center justify-center gap-1.5 text-white shadow-xl shadow-emerald-950/80 hud-tap transition-all ${
              isLandscapeCompact ? 'py-1.5 sm:py-2 px-3 sm:px-5' : 'py-2.5 sm:py-3 px-4 sm:px-6'
            }`}
          >
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-lime-400 text-emerald-950 flex items-center justify-center font-black text-[10px] sm:text-xs flex-shrink-0">
              !
            </div>
            <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-emerald-100 whitespace-nowrap">
              DAILY QUESTS
            </span>
          </TouchSafeButton>

          {/* Center: CLAIM REWARDS Glowing Button */}
          <TouchSafeButton
            onClick={handleClaimAll}
            className={`flex-1 max-w-[280px] sm:max-w-[340px] bg-gradient-to-r from-lime-400 via-green-400 to-emerald-500 hover:from-lime-300 hover:to-emerald-400 active:scale-95 border-2 border-lime-100 rounded-full flex items-center justify-center shadow-[0_6px_25px_rgba(34,197,94,0.7)] text-emerald-950 hud-tap transition-all select-none ${
              isLandscapeCompact ? 'py-2 px-4 sm:px-7' : 'py-2.5 sm:py-3.5 px-6 sm:px-8'
            }`}
          >
            <Sparkles size={isLandscapeCompact ? 16 : 18} className="mr-1.5 text-emerald-950 fill-emerald-950 animate-bounce" />
            <span className={`font-black tracking-wider uppercase whitespace-nowrap drop-shadow-sm ${
              isLandscapeCompact ? 'text-xs sm:text-sm md:text-base' : 'text-sm sm:text-base md:text-lg'
            }`}>
              CLAIM REWARDS
            </span>
          </TouchSafeButton>

          {/* Right: SHOP button */}
          <TouchSafeButton
            onClick={() => {
              playNodeClickSound();
              if (onOpenShop) {
                onOpenShop();
              } else {
                setIsShopOpen(true);
              }
            }}
            className={`flex-1 sm:flex-initial bg-emerald-950/95 hover:bg-emerald-900 border-2 border-emerald-500/70 rounded-full flex items-center justify-center gap-1.5 text-white shadow-xl shadow-emerald-950/80 hud-tap transition-all ${
              isLandscapeCompact ? 'py-1.5 sm:py-2 px-3 sm:px-5' : 'py-2.5 sm:py-3 px-4 sm:px-6'
            }`}
          >
            <ShoppingBag size={16} className="text-lime-400 flex-shrink-0" />
            <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-emerald-100 whitespace-nowrap">
              SHOP
            </span>
          </TouchSafeButton>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NODE DETAILS MODAL                                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedNode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-emerald-950 border-[3px] border-emerald-500 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center text-white"
            >
              <button 
                onClick={() => setSelectedNode(null)}
                className="absolute top-3.5 right-3.5 text-emerald-400 hover:text-white p-1 rounded-full bg-emerald-900/50"
              >
                <X size={18} />
              </button>

              <div className="bg-emerald-900 border border-emerald-500/60 rounded-full px-3 py-1 text-xs font-black text-lime-300 uppercase tracking-wider mb-3">
                TIER {selectedNode.tier} REWARD
              </div>

              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-900 to-green-600 border-2 border-lime-400 flex items-center justify-center shadow-lg shadow-green-500/30 mb-3">
                {selectedNode.rewardType === 'coins' && <Coins size={40} className="text-amber-400" />}
                {selectedNode.rewardType === 'gems' && <Diamond size={40} className="text-cyan-300" />}
                {selectedNode.rewardType === 'chest' && <Gift size={40} className="text-yellow-300" />}
                {selectedNode.rewardType === 'skin' && <Crown size={42} className="text-amber-400" />}
                {selectedNode.rewardType === 'booster' && <Zap size={40} className="text-yellow-400" />}
              </div>

              <h3 className="font-black text-lg sm:text-xl text-white mb-1">
                {selectedNode.rewardName}
              </h3>
              <p className="text-xs text-emerald-300 font-medium mb-5">
                Season 1: Green Candy Exclusive Trail Unlock
              </p>

              {claimedNodeIds.includes(selectedNode.id) ? (
                <div className="w-full bg-emerald-900/70 border border-emerald-600 rounded-2xl py-3 font-black text-emerald-300 text-sm uppercase flex items-center justify-center gap-2">
                  <Check size={16} /> CLAIMED
                </div>
              ) : selectedNode.tier <= collectedRewards ? (
                <TouchSafeButton
                  onClick={() => handleClaimSingleNode(selectedNode)}
                  className="w-full bg-gradient-to-r from-lime-400 to-green-500 border border-lime-200 text-emerald-950 rounded-2xl py-3 font-black text-sm uppercase tracking-wider shadow-lg shadow-green-500/40 hud-tap hover:brightness-110"
                >
                  CLAIM REWARD
                </TouchSafeButton>
              ) : (
                <div className="w-full bg-emerald-900/40 border border-emerald-800 rounded-2xl py-3 font-black text-emerald-500 text-xs uppercase">
                  LOCKED • REACH TIER {selectedNode.tier}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* DAILY QUESTS MODAL                                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isQuestsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-emerald-950 border-[3px] border-emerald-500 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col text-white max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-emerald-800/80 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-lime-400 text-emerald-950 flex items-center justify-center font-black text-sm">
                    !
                  </div>
                  <div>
                    <h2 className="font-black text-lg text-white">Daily Quests</h2>
                    <p className="text-[10px] text-lime-300 font-bold uppercase tracking-wider">Refreshes in 18h 42m</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsQuestsOpen(false)}
                  className="text-emerald-400 hover:text-white p-1 rounded-full bg-emerald-900/50"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {quests.map(quest => (
                  <div key={quest.id} className="bg-emerald-900/60 border border-emerald-700/60 rounded-2xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm text-white">{quest.title}</h4>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-300">
                        <Coins size={12} />
                        <span>+{quest.rewardCoins}</span>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-300">{quest.desc}</p>

                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 bg-emerald-950 rounded-full h-2.5 overflow-hidden border border-emerald-700/50">
                        <div 
                          className="bg-lime-400 h-full rounded-full" 
                          style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }} 
                        />
                      </div>
                      <span className="text-[11px] font-bold text-emerald-200 whitespace-nowrap">
                        {quest.progress}/{quest.target}
                      </span>
                    </div>

                    {quest.claimed ? (
                      <div className="text-center py-1 font-bold text-xs text-emerald-400 flex items-center justify-center gap-1">
                        <Check size={14} /> Claimed
                      </div>
                    ) : quest.completed ? (
                      <TouchSafeButton
                        onClick={() => handleClaimQuest(quest.id)}
                        className="w-full bg-gradient-to-r from-lime-400 to-green-500 text-emerald-950 font-black text-xs uppercase py-2 rounded-xl mt-1 shadow hud-tap"
                      >
                        Claim Reward
                      </TouchSafeButton>
                    ) : (
                      <div className="text-center py-1 font-bold text-[11px] text-emerald-500 uppercase">
                        In Progress
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* SHOP MODAL                                                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isShopOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-emerald-950 border-[3px] border-emerald-500 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col text-white max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-emerald-800/80 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={20} className="text-lime-400" />
                  <h2 className="font-black text-lg text-white">Season 1 Candy Shop</h2>
                </div>
                <button 
                  onClick={() => setIsShopOpen(false)}
                  className="text-emerald-400 hover:text-white p-1 rounded-full bg-emerald-900/50"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {/* Item 1 */}
                <div className="bg-emerald-900/60 border border-emerald-700/60 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-emerald-950">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">+5 Tier Skip Pass</h4>
                      <p className="text-xs text-emerald-300">Instantly advance 5 Season Tiers</p>
                    </div>
                  </div>
                  <TouchSafeButton
                    onClick={() => {
                      if (gems >= 150) {
                        saveState(Math.min(40, collectedRewards + 5), coins, gems - 150, claimedNodeIds);
                        playClaimRewardSound();
                        showToast('Skipped 5 Tiers!');
                      } else {
                        showToast('Not enough Gems!');
                      }
                    }}
                    className="bg-lime-400 hover:bg-lime-300 text-emerald-950 font-black text-xs px-3 py-2 rounded-xl hud-tap flex items-center gap-1"
                  >
                    <Diamond size={12} /> 150
                  </TouchSafeButton>
                </div>

                {/* Item 2 */}
                <div className="bg-emerald-900/60 border border-emerald-700/60 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-lime-400 flex items-center justify-center text-emerald-950">
                      <Coins size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">5,000 Coin Bag</h4>
                      <p className="text-xs text-emerald-300">Boost your coin reserve</p>
                    </div>
                  </div>
                  <TouchSafeButton
                    onClick={() => {
                      if (gems >= 100) {
                        saveState(collectedRewards, coins + 5000, gems - 100, claimedNodeIds);
                        playClaimRewardSound();
                        showToast('Added 5,000 Coins!');
                      } else {
                        showToast('Not enough Gems!');
                      }
                    }}
                    className="bg-lime-400 hover:bg-lime-300 text-emerald-950 font-black text-xs px-3 py-2 rounded-xl hud-tap flex items-center gap-1"
                  >
                    <Diamond size={12} /> 100
                  </TouchSafeButton>
                </div>

                {/* Item 3 */}
                <div className="bg-emerald-900/60 border border-emerald-700/60 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-400 flex items-center justify-center text-white">
                      <Crown size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">Season 1 VIP Pass</h4>
                      <p className="text-xs text-emerald-300">Double XP & VIP Candy Badge</p>
                    </div>
                  </div>
                  <TouchSafeButton
                    onClick={() => {
                      playClaimRewardSound();
                      showToast('Season 1 VIP Pass Activated!');
                    }}
                    className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-xs px-3 py-2 rounded-xl hud-tap"
                  >
                    ACTIVE
                  </TouchSafeButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
