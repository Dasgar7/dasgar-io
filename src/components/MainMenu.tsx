import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Star, Zap, ShoppingCart, 
  Plus, Eye, EyeOff, Gamepad2, MoreHorizontal, User, Play,
  Coins, Banknote, Crown, Bot, Sliders, Check, RotateCcw, Move,
  X, Copy, Users
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { TouchSafeButton } from './TouchSafeButton';
import { PRESET_SKINS, SkinItem, getPlayerRank } from '../data/skinsData';
import { getStarStyleForLevel } from '../utils/levelUtils';
import spectateBtnImg from '../assets/images/spectate-button.png';
import playBtnImg from '../assets/images/play-button.png';
import moreBtnImg from '../assets/images/more-button.png';
import { SeasonVideoBtn } from './SeasonVideoBtn';

interface MainMenuProps {
  onPlay: (mode?: 'classic' | 'bots' | 'instantMerge') => void;
  onSkins?: () => void;
  onSettings?: () => void;
  onSeason?: () => void;
}

export type HudElementKey =
  | 'logo'
  | 'avatar'
  | 'nickname'
  | 'shop'
  | 'coins'
  | 'cash'
  | 'season'
  | 'settings'
  | 'party'
  | 'spectate'
  | 'play'
  | 'more'
  | 'levelStar';

export interface HudItemConfig {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
}

export const DEFAULT_SPECIFIC_HUD: Record<HudElementKey, HudItemConfig> = {
  logo: { x: 0, y: 0, scale: 1, visible: true },
  avatar: { x: 0, y: 0, scale: 1, visible: true },
  nickname: { x: 0, y: 0, scale: 1, visible: true },
  shop: { x: 0, y: 0, scale: 1, visible: true },
  coins: { x: 0, y: 0, scale: 1, visible: true },
  cash: { x: 0, y: 0, scale: 1, visible: true },
  season: { x: 0, y: 0, scale: 1, visible: true },
  settings: { x: 0, y: 0, scale: 1, visible: true },
  party: { x: 0, y: 0, scale: 1, visible: true },
  spectate: { x: 0, y: 0, scale: 1, visible: true },
  play: { x: 0, y: 0, scale: 1, visible: true },
  more: { x: 0, y: 0, scale: 1, visible: true },
  levelStar: { x: 0, y: 0, scale: 1, visible: true },
};

const HUD_ITEM_NAMES: Record<HudElementKey, string> = {
  logo: 'Logo',
  avatar: 'Avatar',
  nickname: 'Nickname Bar',
  shop: 'Shop Button',
  coins: 'Coins',
  cash: 'Cash',
  season: 'Season Button',
  settings: 'Settings Button',
  party: 'Party Button',
  spectate: 'Spectate Button',
  play: 'Play Button',
  more: 'More Button',
  levelStar: 'Level Rank',
};

// Subtle ambient background pellets matching Agar.io's iconic colorful arena feel
const BG_PELLETS = [
  { x: '8%', y: '12%', size: 9, color: '#ff4757' },
  { x: '18%', y: '6%', size: 12, color: '#1e90ff' },
  { x: '25%', y: '18%', size: 8, color: '#2ed573' },
  { x: '12%', y: '28%', size: 11, color: '#ffa502' },
  { x: '6%', y: '45%', size: 8, color: '#e056fd' },
  { x: '15%', y: '62%', size: 10, color: '#00d2d3' },
  { x: '22%', y: '78%', size: 13, color: '#ff4757' },
  { x: '28%', y: '88%', size: 9, color: '#2ed573' },
  { x: '35%', y: '10%', size: 10, color: '#9b59b6' },
  { x: '42%', y: '24%', size: 7, color: '#ffa502' },
  { x: '60%', y: '8%', size: 11, color: '#ff4757' },
  { x: '68%', y: '16%', size: 8, color: '#1e90ff' },
  { x: '75%', y: '7%', size: 12, color: '#2ed573' },
  { x: '82%', y: '22%', size: 9, color: '#e056fd' },
  { x: '92%', y: '14%', size: 11, color: '#ffa502' },
  { x: '88%', y: '35%', size: 8, color: '#00d2d3' },
  { x: '78%', y: '48%', size: 12, color: '#ff4757' },
  { x: '85%', y: '65%', size: 10, color: '#1e90ff' },
  { x: '94%', y: '75%', size: 8, color: '#2ed573' },
  { x: '72%', y: '82%', size: 13, color: '#ffa502' },
  { x: '64%', y: '90%', size: 9, color: '#e056fd' },
  { x: '52%', y: '85%', size: 11, color: '#00d2d3' },
  { x: '40%', y: '82%', size: 8, color: '#ff4757' },
  { x: '32%', y: '68%', size: 10, color: '#1e90ff' },
  { x: '48%', y: '62%', size: 7, color: '#2ed573' },
  { x: '58%', y: '72%', size: 10, color: '#f1c40f' },
];

export function MainMenu({ onPlay, onSkins, onSettings, onSeason }: MainMenuProps) {
  const [equippedSkinSvg, setEquippedSkinSvg] = useState<string | null>(null);
  const [playerLevel, setPlayerLevel] = useState<number>(() => getPlayerRank());
  
  // More menu drawer state
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Edit HUD mode state
  const [isEditingHud, setIsEditingHud] = useState(false);
  const [selectedKey, setSelectedKey] = useState<HudElementKey | null>('nickname');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Party Mode Modal state
  const [isPartyOpen, setIsPartyOpen] = useState(false);
  const [createdPartyCode, setCreatedPartyCode] = useState<string | null>(null);
  const [inputPartyCode, setInputPartyCode] = useState('');
  const [partyCopied, setPartyCopied] = useState(false);

  // Nickname state with persistence
  const [nickname, setNickname] = useState(() => {
    return localStorage.getItem('dasgar_player_name') || '';
  });

  const handleNicknameChange = (val: string) => {
    setNickname(val);
    localStorage.setItem('dasgar_player_name', val);
  };

  // Specific per-element HUD layout state
  const [hudLayout, setHudLayout] = useState<Record<HudElementKey, HudItemConfig>>(() => {
    try {
      const saved = localStorage.getItem('dasgar_specific_hud_layout_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        const result = { ...DEFAULT_SPECIFIC_HUD };
        (Object.keys(DEFAULT_SPECIFIC_HUD) as HudElementKey[]).forEach(k => {
          if (parsed[k]) {
            result[k] = { ...DEFAULT_SPECIFIC_HUD[k], ...parsed[k] };
          }
        });
        return result;
      }
    } catch {}
    return DEFAULT_SPECIFIC_HUD;
  });

  // Pointer dragging logic for individual HUD elements
  const activeDragKeyRef = useRef<HudElementKey | null>(null);
  const dragOriginRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0
  });

  const onPointerDownDrag = (key: HudElementKey, e: React.PointerEvent) => {
    if (!isEditingHud) return;
    if ((e.target as HTMLElement).closest('.edit-hud-action')) return;

    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    activeDragKeyRef.current = key;
    setSelectedKey(key);
    dragOriginRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: hudLayout[key]?.x ?? 0,
      startY: hudLayout[key]?.y ?? 0
    };
  };

  const onPointerMoveDrag = (key: HudElementKey, e: React.PointerEvent) => {
    if (!isEditingHud || activeDragKeyRef.current !== key) return;
    const dx = e.clientX - dragOriginRef.current.clientX;
    const dy = e.clientY - dragOriginRef.current.clientY;
    setHudLayout(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        x: Math.round(dragOriginRef.current.startX + dx),
        y: Math.round(dragOriginRef.current.startY + dy)
      }
    }));
  };

  const onPointerUpDrag = (key: HudElementKey, e: React.PointerEvent) => {
    if (!isEditingHud || activeDragKeyRef.current !== key) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    activeDragKeyRef.current = null;
  };

  const toggleVisibility = (key: HudElementKey) => {
    setHudLayout(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        visible: !prev[key].visible
      }
    }));
  };

  const resetItem = (key: HudElementKey) => {
    setHudLayout(prev => ({
      ...prev,
      [key]: { ...DEFAULT_SPECIFIC_HUD[key] }
    }));
    showToast(`${HUD_ITEM_NAMES[key]} reset to default`);
  };

  const changeItemScale = (key: HudElementKey, delta: number) => {
    setHudLayout(prev => {
      const currentScale = prev[key]?.scale ?? 1;
      const newScale = Math.min(1.6, Math.max(0.6, Math.round((currentScale + delta) * 10) / 10));
      return {
        ...prev,
        [key]: {
          ...prev[key],
          scale: newScale
        }
      };
    });
  };

  const showToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSaveHud = () => {
    localStorage.setItem('dasgar_specific_hud_layout_v2', JSON.stringify(hudLayout));
    setIsEditingHud(false);
    showToast('All HUD Customizations Saved');
  };

  const handleResetHud = () => {
    setHudLayout(DEFAULT_SPECIFIC_HUD);
    localStorage.removeItem('dasgar_specific_hud_layout_v2');
    showToast('HUD Layout Reset to Default');
  };

  useEffect(() => {
    const handleRankUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent.detail === 'number') {
        setPlayerLevel(customEvent.detail);
      } else {
        setPlayerLevel(getPlayerRank());
      }
    };

    window.addEventListener('dasgario_rank_updated', handleRankUpdate);
    window.addEventListener('storage', handleRankUpdate);

    return () => {
      window.removeEventListener('dasgario_rank_updated', handleRankUpdate);
      window.removeEventListener('storage', handleRankUpdate);
    };
  }, []);

  const starStyle = getStarStyleForLevel(playerLevel);

  useEffect(() => {
    const skinId = localStorage.getItem('dasgario_equipped_skin');
    if (!skinId) {
      setEquippedSkinSvg(null);
      return;
    }
    for (const cat in PRESET_SKINS) {
      const found = PRESET_SKINS[cat].find((s) => s.id === skinId);
      if (found) {
        setEquippedSkinSvg(found.svg);
        return;
      }
    }
    try {
      const custom = JSON.parse(localStorage.getItem('dasgario_custom_skins') || '[]');
      const found = custom.find((s: SkinItem) => s.id === skinId);
      if (found) {
        setEquippedSkinSvg(found.svg);
        return;
      }
    } catch {}
    setEquippedSkinSvg(null);
  }, []);

  // Helper renderer for each individually editable HUD item
  const renderEditableItem = (
    key: HudElementKey,
    children: React.ReactNode,
    baseWrapperClass: string = '',
    baseWrapperStyle: React.CSSProperties = {}
  ) => {
    const config = hudLayout[key] || DEFAULT_SPECIFIC_HUD[key];
    const isSelected = selectedKey === key;

    // In normal gameplay mode: hide if toggled off
    if (!isEditingHud && !config.visible) {
      return null;
    }

    const hasCustomTransform = config.x !== 0 || config.y !== 0 || config.scale !== 1;
    const itemTransform = hasCustomTransform
      ? `translate3d(${config.x}px, ${config.y}px, 0) scale(${config.scale})`
      : '';
    const combinedTransform = baseWrapperStyle.transform 
      ? (itemTransform ? `${baseWrapperStyle.transform} ${itemTransform}` : baseWrapperStyle.transform)
      : (itemTransform || undefined);

    if (!isEditingHud) {
      return (
        <div
          style={{
            ...baseWrapperStyle,
            ...(combinedTransform ? { transform: combinedTransform } : {}),
          }}
          className={baseWrapperClass}
        >
          {children}
        </div>
      );
    }

    // In Edit HUD Mode: individual handles, badges, outline, and pointer events
    return (
      <div
        onPointerDown={(e) => onPointerDownDrag(key, e)}
        onPointerMove={(e) => onPointerMoveDrag(key, e)}
        onPointerUp={(e) => onPointerUpDrag(key, e)}
        onPointerCancel={(e) => onPointerUpDrag(key, e)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedKey(key);
        }}
        style={{
          ...baseWrapperStyle,
          transform: combinedTransform,
          touchAction: 'none',
        }}
        className={`relative pointer-events-auto cursor-grab active:cursor-grabbing select-none transition-shadow ${baseWrapperClass} ${
          isSelected 
            ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900/40 rounded-2xl z-40 shadow-xl shadow-cyan-500/20' 
            : 'hover:ring-1 hover:ring-cyan-300/70 rounded-2xl z-20'
        } ${!config.visible ? 'opacity-35 grayscale' : ''}`}
      >
        {/* Floating Item Badge with quick controls */}
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/95 text-white border border-cyan-400 rounded-full px-2 py-0.5 shadow-2xl z-50 text-[9px] font-black tracking-wider whitespace-nowrap pointer-events-auto edit-hud-action">
          <Move size={10} className="text-cyan-400" />
          <span className="uppercase">{HUD_ITEM_NAMES[key]}</span>
          <span className="text-[8px] text-cyan-300 font-mono">({Math.round(config.scale * 100)}%)</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility(key);
            }}
            className="ml-1 p-0.5 hover:text-cyan-300 edit-hud-action"
            title={config.visible ? 'Hide Element' : 'Show Element'}
          >
            {config.visible ? <Eye size={11} className="text-emerald-400" /> : <EyeOff size={11} className="text-red-400" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetItem(key);
            }}
            className="p-0.5 hover:text-cyan-300 edit-hud-action"
            title="Reset position & size"
          >
            <RotateCcw size={10} />
          </button>
        </div>

        {/* Dashed visual bounding outline */}
        <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-cyan-400/80 bg-cyan-400/5 rounded-2xl -m-1" />

        {/* The underlying HUD Element */}
        <div className="pointer-events-none w-full h-full">
          {children}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="relative w-full h-full h-[100dvh] bg-slate-50 flex flex-col justify-between p-4 overflow-hidden select-none"
      style={{ 
        backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
      onContextMenu={(e) => e.preventDefault()}
    >

      {/* Ambient background food pellets matching Agar.io */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
        {BG_PELLETS.map((p, idx) => (
          <div
            key={idx}
            className="absolute rounded-full shadow-xs"
            style={{
              left: p.x,
              top: p.y,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              opacity: 0.8,
            }}
          />
        ))}
      </div>

      {/* Floating HUD Editor Toolbar when Edit HUD is active */}
      <AnimatePresence>
        {isEditingHud && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-2.5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border-2 border-cyan-400 text-white rounded-2xl px-3 sm:px-5 py-2 shadow-2xl flex flex-wrap items-center justify-between gap-2 sm:gap-4 w-[96vw] max-w-2xl"
          >
            {/* Left: Info */}
            <div className="flex items-center gap-2 min-w-0">
              <Sliders className="w-5 h-5 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black tracking-wider text-cyan-300 uppercase leading-none truncate">
                  {selectedKey ? `EDITING: ${HUD_ITEM_NAMES[selectedKey].toUpperCase()}` : 'EDIT HUD MODE'}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-300 truncate mt-0.5">
                  Drag any element • Size with -/+ • Eye to hide
                </div>
              </div>
            </div>

            {/* Center: Selected Element Controls (Scale -/+, Visibility, Reset) */}
            {selectedKey && (
              <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-2 py-1 shrink-0">
                <span className="text-[9px] font-bold text-slate-300">SIZE:</span>
                <button
                  type="button"
                  onClick={() => changeItemScale(selectedKey, -0.1)}
                  className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-black text-xs flex items-center justify-center transition-all hud-tap"
                  title="Decrease Size"
                >
                  -
                </button>
                <span className="text-[10px] font-mono font-bold text-cyan-300 min-w-[34px] text-center">
                  {Math.round((hudLayout[selectedKey]?.scale ?? 1) * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => changeItemScale(selectedKey, 0.1)}
                  className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-black text-xs flex items-center justify-center transition-all hud-tap"
                  title="Increase Size"
                >
                  +
                </button>
                <div className="w-px h-4 bg-slate-700 mx-0.5" />
                <button
                  type="button"
                  onClick={() => toggleVisibility(selectedKey)}
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-white transition-all hud-tap"
                  title={hudLayout[selectedKey]?.visible ? 'Hide Element' : 'Show Element'}
                >
                  {hudLayout[selectedKey]?.visible ? <Eye size={13} className="text-emerald-400" /> : <EyeOff size={13} className="text-red-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => resetItem(selectedKey)}
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-white transition-all hud-tap"
                  title="Reset Item"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            )}

            {/* Right: Global Actions (RESET ALL, DONE) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetHud}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10.5px] font-bold text-slate-200 flex items-center gap-1 transition-all hud-tap"
                title="Reset all elements to default"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">RESET ALL</span>
              </button>
              <button
                type="button"
                onClick={handleSaveHud}
                className="px-3 sm:px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[10.5px] font-black text-white flex items-center gap-1 shadow-md shadow-emerald-500/30 transition-all hud-tap"
              >
                <Check size={14} strokeWidth={3} />
                <span>DONE</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Party Modal */}
      <AnimatePresence>
        {isPartyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 pointer-events-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm sm:max-w-md bg-[#1e293b] border-2 border-slate-600 rounded-3xl p-5 sm:p-6 shadow-2xl text-white select-none pointer-events-auto"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsPartyOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700/50 cursor-pointer"
              >
                <X size={22} />
              </button>

              {/* Title */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Users size={18} />
                </div>
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">Party Mode</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mb-5">
                Play with your friends in the same arena!
              </p>

              {/* Create Party */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 mb-4">
                <div className="font-extrabold text-xs uppercase tracking-wider text-slate-300 mb-2">Create Party</div>
                {createdPartyCode ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between bg-slate-900 border border-purple-500/40 rounded-xl px-3.5 py-2">
                      <span className="font-mono font-black text-purple-300 tracking-widest text-base sm:text-lg">
                        {createdPartyCode}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(createdPartyCode);
                          setPartyCopied(true);
                          setTimeout(() => setPartyCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-600 transition-colors cursor-pointer"
                      >
                        <Copy size={13} />
                        <span>{partyCopied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <TouchSafeButton
                      onClick={() => {
                        setIsPartyOpen(false);
                        onPlay('classic');
                      }}
                      className="w-full py-2.5 bg-gradient-to-b from-[#22c55e] to-[#16a34a] border border-[#15803d] rounded-xl font-black text-sm uppercase tracking-wider text-white shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center"
                    >
                      Join Party Arena
                    </TouchSafeButton>
                  </div>
                ) : (
                  <TouchSafeButton
                    onClick={() => {
                      const code = `DASGAR-${Math.floor(1000 + Math.random() * 9000)}`;
                      setCreatedPartyCode(code);
                    }}
                    className="w-full py-2.5 bg-gradient-to-b from-[#8b5cf6] to-[#7c3aed] border border-[#6d28d9] rounded-xl font-black text-sm uppercase tracking-wider text-white shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center"
                  >
                    Create Party
                  </TouchSafeButton>
                )}
              </div>

              {/* Join Party */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
                <div className="font-extrabold text-xs uppercase tracking-wider text-slate-300 mb-2">Join with Code</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputPartyCode}
                    onChange={(e) => setInputPartyCode(e.target.value.toUpperCase())}
                    placeholder="DASGAR-XXXX"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center font-mono font-bold text-sm tracking-widest text-white placeholder:text-slate-500 uppercase outline-none focus:border-purple-500"
                    maxLength={12}
                  />
                  <TouchSafeButton
                    onClick={() => {
                      if (inputPartyCode.trim()) {
                        setIsPartyOpen(false);
                        onPlay('classic');
                      }
                    }}
                    className="px-5 py-2 bg-gradient-to-b from-[#0ea5e9] to-[#0284c7] border border-[#0369a1] rounded-xl font-black text-sm uppercase tracking-wider text-white shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center disabled:opacity-50"
                  >
                    Join
                  </TouchSafeButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg border border-cyan-400/40 pointer-events-none"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 1. TOP LOGO: "Dasgar.io" at the top center like agar.io                  */}
      {/* ========================================================================= */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-20 select-none"
        style={{
          paddingTop: 'max(0.6rem, env(safe-area-inset-top))',
        }}
      >
        {renderEditableItem(
          'logo',
          <h1 className="font-black tracking-tight leading-none text-3xl sm:text-4xl md:text-5xl pointer-events-auto select-none drop-shadow-xs transition-all duration-300 ease-out">
            <span className="text-[#334155]">Dasgar</span>
            <span className="text-[#22c55e]">.io</span>
          </h1>,
          'pointer-events-auto z-10 flex justify-center'
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. CENTER CONSOLE: AVATAR, NICKNAME BAR, ACTIONS (SPECTATE, PLAY, MORE)   */}
      {/*    Elevated higher up, exactly centered action buttons, tight Agar.io gaps */}
      {/* ========================================================================= */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20 px-2 sm:px-4 select-none"
        style={{
          paddingTop: 'max(2rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="w-full max-w-[420px] sm:max-w-[480px] md:max-w-[540px] lg:max-w-[580px] flex flex-col items-center pointer-events-none transition-all duration-300 ease-out my-auto -translate-y-2 sm:-translate-y-3 md:-translate-y-4">
          {/* AVATAR (SKIN BUTTON) + BADGES */}
          {renderEditableItem(
            'avatar',
            <TouchSafeButton 
              className="relative group hud-tap pointer-events-auto transition-all duration-300 ease-out mb-2 sm:mb-2.5"
              onClick={isEditingHud ? undefined : onSkins}
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-slate-200 border-4 border-[#22c55e] shadow-md flex items-center justify-center pointer-events-none overflow-hidden relative transition-all duration-300 ease-out">
                {equippedSkinSvg ? (
                  <img 
                    src={equippedSkinSvg} 
                    alt="Equipped Skin" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const skinId = localStorage.getItem('dasgario_equipped_skin');
                      const target = e.currentTarget;
                      if (skinId === 'rank-1' && target.src !== '/skins/rank1-pig.png') {
                        target.src = '/skins/rank1-pig.png';
                      } else if (skinId === 'rank-7' && target.src !== '/skins/rank7-spider.png') {
                        target.src = '/skins/rank7-spider.png';
                      } else if (skinId === 'rank-15' && target.src !== '/skins/rank15-cat.png') {
                        target.src = '/skins/rank15-cat.png';
                      } else if (skinId === 'rank-23' && target.src !== '/skins/rank23-dragon.png') {
                        target.src = '/skins/rank23-dragon.png';
                      } else if (skinId === 'rank-27' && target.src !== '/skins/rank27-shark.png') {
                        target.src = '/skins/rank27-shark.png';
                      } else if (skinId === 'rank-35' && target.src !== '/skins/rank35-fox.png') {
                        target.src = '/skins/rank35-fox.png';
                      }
                    }}
                    className="w-full h-full object-cover pointer-events-none" 
                  />
                ) : null}
              </div>
              
              {/* Plus button (top right) */}
              <div className="absolute top-[2px] right-[2px] w-6 h-6 sm:w-7 sm:h-7 bg-[#22c55e] border-2 border-white rounded-full flex items-center justify-center text-white shadow-xs z-10 select-none overflow-hidden transition-all duration-300">
                <Plus size={14} strokeWidth={3.5} className="pointer-events-none" />
              </div>

              {/* XP Star button (top left) */}
              <div className="absolute -top-[2px] -left-[2px] w-8 h-8 sm:w-9 sm:h-9 bg-[#f59e0b] border-2 border-white rounded-full flex items-center justify-center text-white shadow-xs z-10 select-none overflow-hidden transition-all duration-300">
                <Star size={18} className="fill-white text-white pointer-events-none" />
                <span className="absolute text-amber-900 font-black text-[8px] pointer-events-none tracking-tighter pt-0.5 ml-0.5 z-10">XP</span>
              </div>

              {/* Boost Zap button (bottom left) */}
              <div className="absolute -bottom-[2px] -left-[2px] w-8 h-8 sm:w-9 sm:h-9 bg-[#0ea5e9] border-2 border-white rounded-full flex flex-col items-center justify-center pt-0.5 text-white shadow-xs z-10 select-none overflow-hidden transition-all duration-300">
                <Zap size={12} className="fill-white pointer-events-none" />
                <span className="text-white font-black text-[7.5px] leading-none mt-0.5 pointer-events-none tracking-wide">BST</span>
              </div>
            </TouchSafeButton>,
            'pointer-events-auto flex justify-center'
          )}

          {/* NICKNAME BAR - Polished, clean white input centered above buttons, scaled up for mobile touch */}
          {renderEditableItem(
            'nickname',
            <div className="w-[230px] sm:w-[270px] md:w-[310px] mx-auto bg-white border-2 border-slate-300 rounded-2xl shadow-xs text-center transition-all duration-200 focus-within:border-[#22c55e] focus-within:ring-2 focus-within:ring-[#22c55e]/20 px-4 py-2 sm:py-2.5 pointer-events-auto">
              <input 
                type="text" 
                placeholder="Nickname" 
                value={nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
                className="w-full bg-transparent outline-none text-center text-slate-800 font-bold placeholder:text-slate-400 placeholder:font-medium text-sm sm:text-base tracking-wide"
                maxLength={15}
              />
            </div>,
            'w-full flex justify-center pointer-events-auto mb-2.5 sm:mb-3'
          )}

          {/* ACTION BUTTONS (SPECTATE, PLAY, MORE) + MORE DRAWER */}
          <div className="w-full flex flex-col items-center pointer-events-auto">
            {/* Action Buttons Row - Centered, big & clean like Agar.io with tight spacing */}
            <div className="flex items-center justify-center gap-0.5 sm:gap-1 w-full max-w-[420px] sm:max-w-[480px] md:max-w-[530px] lg:max-w-[560px] mx-auto pointer-events-auto">
              {/* SPECTATE BUTTON */}
              {renderEditableItem(
                'spectate',
                <TouchSafeButton 
                  onClick={() => onPlay('classic')}
                  className="w-full h-[76px] sm:h-[88px] md:h-[96px] lg:h-[104px] flex items-center justify-center select-none hud-tap pointer-events-auto transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  title="Spectate"
                >
                  <img
                    src={spectateBtnImg}
                    alt="Spectate"
                    style={{ imageRendering: '-webkit-optimize-contrast' as any }}
                    className="w-full h-full object-contain pointer-events-none select-none drop-shadow-sm"
                    draggable={false}
                  />
                </TouchSafeButton>,
                'flex-1 flex justify-center pointer-events-auto'
              )}
              
              {/* PLAY BUTTON */}
              {renderEditableItem(
                'play',
                <TouchSafeButton 
                  onClick={() => onPlay('classic')}
                  className="w-full h-[76px] sm:h-[88px] md:h-[96px] lg:h-[104px] flex items-center justify-center select-none hud-tap pointer-events-auto transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  title="Play"
                >
                  <img
                    src={playBtnImg}
                    alt="Play"
                    style={{ imageRendering: '-webkit-optimize-contrast' as any }}
                    className="w-full h-full object-contain pointer-events-none select-none drop-shadow-sm"
                    draggable={false}
                  />
                </TouchSafeButton>,
                'flex-[1.2] flex justify-center pointer-events-auto'
              )}

              {/* MORE BUTTON */}
              {renderEditableItem(
                'more',
                <TouchSafeButton 
                  onClick={() => setIsMoreOpen(prev => !prev)}
                  className="w-full h-[76px] sm:h-[88px] md:h-[96px] lg:h-[104px] flex items-center justify-center select-none hud-tap pointer-events-auto transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  title="More Modes"
                >
                  <img
                    src={moreBtnImg}
                    alt="More"
                    style={{ imageRendering: '-webkit-optimize-contrast' as any }}
                    className="w-full h-full object-contain pointer-events-none select-none drop-shadow-sm"
                    draggable={false}
                  />
                </TouchSafeButton>,
                'flex-1 flex justify-center pointer-events-auto'
              )}
            </div>

            {/* MORE Buttons Drawer (Opens smoothly directly below action buttons) */}
            <AnimatePresence initial={false}>
              {isMoreOpen && (
                <motion.div
                  key="more-buttons-drawer"
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ 
                    opacity: 1, 
                    height: 'auto', 
                    scale: 1,
                    transition: {
                      height: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                      opacity: { duration: 0.2, ease: 'easeOut' },
                      scale: { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
                    }
                  }}
                  exit={{ 
                    opacity: 0, 
                    height: 0, 
                    scale: 0.95,
                    transition: {
                      height: { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
                      opacity: { duration: 0.18, ease: 'easeIn' },
                      scale: { duration: 0.2, ease: 'easeIn' }
                    }
                  }}
                  className="pointer-events-auto w-full overflow-hidden select-none"
                >
                  <div className="grid grid-cols-3 gap-1 sm:gap-1.5 w-full max-w-[420px] sm:max-w-[480px] md:max-w-[530px] lg:max-w-[560px] mx-auto pt-2 pb-0.5">
                    {/* 1. BOTS: Private server, bots only, no friends */}
                    <TouchSafeButton
                      onClick={() => onPlay('bots')}
                      className="h-[46px] sm:h-[52px] bg-gradient-to-b from-[#06b6d4] to-[#0891b2] border border-[#0e7490] rounded-xl px-1 flex flex-col items-center justify-center text-white shadow-xs select-none hud-tap"
                    >
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white mb-0.5 pointer-events-none" />
                      <span className="font-black text-[10px] sm:text-xs tracking-wider uppercase pointer-events-none leading-none">
                        BOTS
                      </span>
                    </TouchSafeButton>

                    {/* 2. INSTANT MERGE: Fast recombine, exclusive mode */}
                    <TouchSafeButton
                      onClick={() => onPlay('instantMerge')}
                      className="h-[46px] sm:h-[52px] bg-gradient-to-b from-[#f97316] to-[#ea580c] border border-[#c2410c] rounded-xl px-1 flex flex-col items-center justify-center text-white shadow-xs select-none hud-tap"
                    >
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white mb-0.5 pointer-events-none" />
                      <span className="font-black text-[8.5px] sm:text-[10px] tracking-wider uppercase pointer-events-none leading-none whitespace-nowrap">
                        INSTANT MERGE
                      </span>
                    </TouchSafeButton>

                    {/* 3. EDIT HUD: Customize main menu HUD elements specifically */}
                    <TouchSafeButton
                      onClick={() => {
                        setIsMoreOpen(false);
                        setIsEditingHud(true);
                      }}
                      className="h-[46px] sm:h-[52px] bg-gradient-to-b from-[#8b5cf6] to-[#7c3aed] border border-[#6d28d9] rounded-xl px-1 flex flex-col items-center justify-center text-white shadow-xs select-none hud-tap"
                    >
                      <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-white mb-0.5 pointer-events-none" />
                      <span className="font-black text-[10px] sm:text-xs tracking-wider uppercase pointer-events-none leading-none whitespace-nowrap">
                        EDIT HUD
                      </span>
                    </TouchSafeButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP LEFT: SHOP BUTTON                                                  */}
      {/* ========================================================================= */}
      {renderEditableItem(
        'shop',
        <TouchSafeButton 
          id="shop-cart-button" 
          onClick={isEditingHud ? undefined : onSkins}
          className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-b from-[#ef4444] to-[#dc2626] border border-[#b91c1c] rounded-2xl flex items-center justify-center text-white shadow-sm shadow-red-500/20 select-none hud-tap pointer-events-auto"
        >
          <ShoppingCart size={28} className="pointer-events-none text-white" />
        </TouchSafeButton>,
        'absolute pointer-events-auto z-10 select-none',
        { 
          top: 'max(0.5rem, env(safe-area-inset-top))', 
          left: 'max(1rem, env(safe-area-inset-left))' 
        }
      )}

      {/* ========================================================================= */}
      {/* 3. TOP RIGHT INDIVIDUAL ELEMENTS: COINS, CASH, SEASON                     */}
      {/* ========================================================================= */}
      <div 
        className="absolute pointer-events-none z-10 select-none flex flex-col gap-2 items-end"
        style={{ 
          top: 'max(0.5rem, env(safe-area-inset-top))', 
          right: 'max(1rem, env(safe-area-inset-right))' 
        }}
      >
        {/* COINS */}
        {renderEditableItem(
          'coins',
          <div draggable={false} onDragStart={(e) => e.preventDefault()} className="bg-white border-2 border-slate-200 rounded-full flex items-center p-1 pr-3 sm:pr-4 shadow-xs min-w-[130px] sm:min-w-[145px] pointer-events-auto">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#f59e0b] rounded-full flex items-center justify-center mr-2 pointer-events-none">
              <Coins size={15} className="text-white pointer-events-none" />
            </div>
            <span className="text-slate-800 font-black flex-1 text-center pointer-events-none text-sm sm:text-base tabular-nums">613</span>
            <TouchSafeButton 
              onClick={isEditingHud ? undefined : onSkins}
              className="w-5 h-5 sm:w-6 sm:h-6 bg-[#22c55e] rounded-full flex items-center justify-center text-white shadow-xs ml-1.5 select-none hud-tap"
            >
              <Plus size={13} strokeWidth={3.5} className="pointer-events-none" />
            </TouchSafeButton>
          </div>,
          'pointer-events-auto'
        )}

        {/* CASH */}
        {renderEditableItem(
          'cash',
          <div draggable={false} onDragStart={(e) => e.preventDefault()} className="bg-white border-2 border-slate-200 rounded-full flex items-center p-1 pr-3 sm:pr-4 shadow-xs min-w-[130px] sm:min-w-[145px] pointer-events-auto">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#10b981] rounded-full flex items-center justify-center mr-2 pointer-events-none">
              <Banknote size={15} className="text-white pointer-events-none" />
            </div>
            <span className="text-slate-800 font-black flex-1 text-center pointer-events-none text-sm sm:text-base tabular-nums">15</span>
            <TouchSafeButton 
              onClick={isEditingHud ? undefined : onSkins}
              className="w-5 h-5 sm:w-6 sm:h-6 bg-[#22c55e] rounded-full flex items-center justify-center text-white shadow-xs ml-1.5 select-none hud-tap"
            >
              <Plus size={13} strokeWidth={3.5} className="pointer-events-none" />
            </TouchSafeButton>
          </div>,
          'pointer-events-auto'
        )}

        {/* SEASON */}
        {renderEditableItem(
          'season',
          <TouchSafeButton 
            onClick={isEditingHud ? undefined : onSeason}
            className="w-[165px] sm:w-[195px] md:w-[220px] h-[80px] sm:h-[94px] md:h-[106px] flex items-center justify-end select-none hud-tap pointer-events-auto translate-x-3 sm:translate-x-4 md:translate-x-5"
          >
            <SeasonVideoBtn className="w-full h-full pointer-events-none" />
          </TouchSafeButton>,
          'pointer-events-auto -mt-3 sm:-mt-4 md:-mt-5'
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. BOTTOM LEFT INDIVIDUAL ELEMENTS: SETTINGS & PARTY                      */}
      {/* ========================================================================= */}
      <div 
        className="absolute pointer-events-none z-10 select-none flex items-center gap-2"
        style={{ 
          bottom: 'max(0.75rem, env(safe-area-inset-bottom))', 
          left: 'max(0.75rem, env(safe-area-inset-left))' 
        }}
      >
        {/* SETTINGS BUTTON */}
        {renderEditableItem(
          'settings',
          <TouchSafeButton 
            id="settings-button" 
            onClick={isEditingHud ? undefined : onSettings}
            className="w-[74px] sm:w-[82px] h-[50px] sm:h-14 bg-gradient-to-b from-[#64748b] to-[#475569] border border-[#334155] rounded-xl flex flex-col items-center justify-center text-white shadow-xs select-none hud-tap pointer-events-auto"
          >
            <Settings size={20} className="pointer-events-none text-white mb-0.5" />
            <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-wider text-white uppercase pointer-events-none leading-none whitespace-nowrap">
              SETTINGS
            </span>
          </TouchSafeButton>,
          'pointer-events-auto'
        )}

        {/* PARTY BUTTON */}
        {renderEditableItem(
          'party',
          <TouchSafeButton 
            id="party-button"
            onClick={isEditingHud ? undefined : () => setIsPartyOpen(true)}
            className="w-[50px] sm:w-14 h-[50px] sm:h-14 bg-gradient-to-b from-[#8b5cf6] to-[#7c3aed] border border-[#6d28d9] rounded-xl flex flex-col items-center justify-center text-white shadow-xs select-none hud-tap pointer-events-auto"
          >
            <User size={20} className="pointer-events-none text-white mb-0.5" />
            <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-wider text-white uppercase pointer-events-none leading-none whitespace-nowrap">
              PARTY
            </span>
          </TouchSafeButton>,
          'pointer-events-auto'
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. BOTTOM RIGHT: STAR RANK LEVEL BADGE                                    */}
      {/* ========================================================================= */}
      {renderEditableItem(
        'levelStar',
        <TouchSafeButton className="relative flex items-center justify-center hud-tap pointer-events-auto">
          <div className="relative flex items-center justify-center pointer-events-none">
            <Star 
              size={76} 
              strokeWidth={starStyle.isOutlineOnly ? 2 : 1.5} 
              style={{ 
                color: starStyle.stroke, 
                fill: starStyle.fill,
                transition: 'fill 1.5s cubic-bezier(0.4, 0, 0.2, 1), color 1.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
              }} 
              className="pointer-events-none" 
            />
            <span 
              className="absolute inset-0 flex items-center justify-center font-black text-2xl pt-1 pointer-events-none"
              style={{ 
                color: starStyle.text,
                transition: 'color 1.5s ease-in-out'
              }}
            >
              {playerLevel}
            </span>
          </div>
        </TouchSafeButton>,
        'absolute pointer-events-auto z-10 select-none flex items-center justify-center',
        { 
          bottom: 'max(1rem, env(safe-area-inset-bottom))', 
          right: 'max(1rem, env(safe-area-inset-right))' 
        }
      )}

    </div>
  );
}
