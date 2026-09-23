import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Star, Zap, ShoppingCart, 
  Plus, Eye, EyeOff, Gamepad2, MoreHorizontal, User, Play,
  Coins, Banknote, Crown, Bot, Sliders, Check, RotateCcw, Move
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { TouchSafeButton } from './TouchSafeButton';
import { PRESET_SKINS, SkinItem, getPlayerRank } from '../data/skinsData';
import { getStarStyleForLevel } from '../utils/levelUtils';

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

export function MainMenu({ onPlay, onSkins, onSettings, onSeason }: MainMenuProps) {
  const [equippedSkinSvg, setEquippedSkinSvg] = useState<string | null>(null);
  const [playerLevel, setPlayerLevel] = useState<number>(() => getPlayerRank());
  
  // More menu drawer state
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Edit HUD mode state
  const [isEditingHud, setIsEditingHud] = useState(false);
  const [selectedKey, setSelectedKey] = useState<HudElementKey | null>('nickname');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

    const itemTransform = `translate3d(${config.x}px, ${config.y}px, 0) scale(${config.scale})`;
    const combinedTransform = baseWrapperStyle.transform 
      ? `${baseWrapperStyle.transform} ${itemTransform}`
      : itemTransform;

    if (!isEditingHud) {
      return (
        <div
          style={{
            ...baseWrapperStyle,
            transform: combinedTransform,
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
      className="relative w-full h-full bg-slate-50 flex flex-col justify-between p-4 overflow-hidden select-none"
      style={{ 
        backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
      onContextMenu={(e) => e.preventDefault()}
    >

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
      {/* 1. CENTER CONSOLE: LOGO, AVATAR, NICKNAME BAR, ACTIONS & DRAWER           */}
      {/* ========================================================================= */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center z-20 w-full max-w-[460px] sm:max-w-[500px] md:max-w-[540px] px-2 pointer-events-none transition-all duration-300 ease-out ${
          isMoreOpen && !isEditingHud 
            ? 'top-1 sm:top-2 -translate-y-1 sm:-translate-y-2' 
            : 'top-1 sm:top-2 translate-y-0'
        }`}
      >
        {/* LOGO */}
        {renderEditableItem(
          'logo',
          <h1 className={`font-black text-slate-500 tracking-wide drop-shadow-sm mb-0.5 pointer-events-auto transition-all duration-300 ease-out ${
            isMoreOpen && !isEditingHud ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
          }`}>
            Dasgar<span className="text-green-500">.io</span>
          </h1>,
          'pointer-events-auto'
        )}

        {/* AVATAR + BADGES */}
        {renderEditableItem(
          'avatar',
          <TouchSafeButton 
            className="relative group hud-tap pointer-events-auto transition-all duration-300 ease-out my-0.5"
            onClick={isEditingHud ? undefined : onSkins}
          >
            <div className={`rounded-full shadow-md bg-slate-400/30 border-[3px] border-green-500 backdrop-blur-sm flex items-center justify-center pointer-events-none overflow-hidden relative transition-all duration-300 ease-out ${
              isMoreOpen && !isEditingHud ? 'w-16 h-16 sm:w-18 sm:h-18' : 'w-20 h-20 sm:w-22 sm:h-22'
            }`}>
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
            <div className={`absolute top-[2px] right-[2px] w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-b from-emerald-400 to-green-600 border-[1.5px] border-emerald-100 rounded-full flex items-center justify-center text-white shadow-md shadow-green-600/40 z-10 select-none overflow-hidden before:absolute before:inset-0 before:rounded-full before:shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)] before:pointer-events-none transition-all duration-300 ${
              isMoreOpen && !isEditingHud ? 'scale-75' : 'scale-100'
            }`}>
              <Plus size={12} strokeWidth={4} className="pointer-events-none drop-shadow relative z-10" />
            </div>

            {/* XP Star button (top left) */}
            <div className={`absolute -top-[2px] -left-[2px] w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-b from-yellow-300 to-amber-500 border-[2px] border-yellow-100 rounded-full flex items-center justify-center text-white shadow-md shadow-amber-500/40 z-10 select-none overflow-hidden before:absolute before:inset-0 before:rounded-full before:shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] before:pointer-events-none transition-all duration-300 ${
              isMoreOpen && !isEditingHud ? 'scale-75 -top-[4px] -left-[4px]' : 'scale-100'
            }`}>
              <Star size={18} className="fill-white text-white pointer-events-none drop-shadow relative z-10" />
              <span className="absolute text-amber-600 font-black text-[7.5px] pointer-events-none tracking-tighter pt-0.5 ml-0.5 z-10">XP</span>
            </div>

            {/* Boost Zap button (bottom left) */}
            <div className={`absolute -bottom-[2px] -left-[2px] w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-b from-cyan-400 to-blue-600 border-[2px] border-cyan-100 rounded-full flex flex-col items-center justify-center pt-0.5 text-white shadow-md shadow-blue-500/40 z-10 select-none overflow-hidden before:absolute before:inset-0 before:rounded-full before:shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)] before:pointer-events-none transition-all duration-300 ${
              isMoreOpen && !isEditingHud ? 'scale-75 -bottom-[4px] -left-[4px]' : 'scale-100'
            }`}>
              <Zap size={11} className="fill-white pointer-events-none drop-shadow relative z-10" />
              <span className="text-white font-black text-[7px] leading-none mt-0.5 pointer-events-none tracking-wide drop-shadow relative z-10">BST</span>
            </div>
          </TouchSafeButton>,
          'pointer-events-auto'
        )}

        {/* NICKNAME BAR */}
        {renderEditableItem(
          'nickname',
          <div className="w-full max-w-[250px] sm:max-w-[280px] mx-auto bg-white/75 backdrop-blur-sm border-2 border-slate-300/80 rounded-xl shadow-sm text-center transition-all duration-300 ease-out focus-within:bg-white focus-within:border-slate-400 mt-1 px-3.5 py-1.5 pointer-events-auto">
            <input 
              type="text" 
              placeholder="Nickname" 
              value={nickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
              className="w-full bg-transparent outline-none text-center text-slate-800 font-bold placeholder-slate-400 text-sm sm:text-base"
              maxLength={15}
            />
          </div>,
          'w-full flex justify-center pointer-events-auto'
        )}

        {/* ACTION BUTTONS (SPECTATE, PLAY, MORE) + MORE DRAWER - Centered directly under nickname bar */}
        <div className="w-full mt-2.5 sm:mt-3 flex flex-col items-center pointer-events-auto">
          {/* Action Buttons Row - Equal sized 3-column landscape grid matching Agar.io */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[430px] sm:max-w-[470px] md:max-w-[490px] mx-auto pointer-events-auto">
            {/* SPECTATE BUTTON */}
            {renderEditableItem(
              'spectate',
              <TouchSafeButton className="w-full h-[62px] sm:h-[70px] md:h-[74px] bg-gradient-to-b from-red-500 to-red-700 border-2 border-red-300 rounded-2xl px-1 sm:px-2 flex flex-col items-center justify-center text-white shadow-md shadow-red-500/25 select-none hud-tap pointer-events-auto">
                <Eye className="w-6 h-6 sm:w-7 sm:h-7 text-white mb-0.5 pointer-events-none drop-shadow" />
                <span className="font-black text-xs sm:text-sm tracking-wider uppercase pointer-events-none leading-none whitespace-nowrap">
                  SPECTATE
                </span>
              </TouchSafeButton>,
              'w-full flex pointer-events-auto'
            )}
            
            {/* PLAY BUTTON */}
            {renderEditableItem(
              'play',
              <TouchSafeButton 
                onClick={() => onPlay('classic')}
                className="w-full h-[62px] sm:h-[70px] md:h-[74px] bg-gradient-to-b from-emerald-400 via-green-500 to-green-600 border-2 border-green-200 rounded-2xl px-1 sm:px-2 flex flex-col items-center justify-center text-white shadow-md shadow-green-500/30 select-none hud-tap pointer-events-auto"
              >
                <Gamepad2 className="w-6 h-6 sm:w-7 sm:h-7 text-white mb-0.5 pointer-events-none drop-shadow" />
                <span className="font-black text-xs sm:text-sm tracking-wider uppercase pointer-events-none leading-none whitespace-nowrap">
                  PLAY
                </span>
              </TouchSafeButton>,
              'w-full flex pointer-events-auto'
            )}

            {/* MORE BUTTON */}
            {renderEditableItem(
              'more',
              <TouchSafeButton 
                onClick={() => setIsMoreOpen(prev => !prev)}
                className={`w-full h-[62px] sm:h-[70px] md:h-[74px] bg-gradient-to-b ${
                  isMoreOpen 
                    ? 'from-blue-600 to-blue-800 border-cyan-300 ring-2 ring-blue-400 shadow-blue-500/40' 
                    : 'from-blue-500 to-blue-700 border-blue-200 shadow-blue-500/25'
                } border-2 rounded-2xl px-1 sm:px-2 flex flex-col items-center justify-center text-white shadow-md select-none hud-tap pointer-events-auto`}
              >
                <MoreHorizontal className="w-6 h-6 sm:w-7 sm:h-7 text-white mb-0.5 pointer-events-none drop-shadow" />
                <span className="font-black text-xs sm:text-sm tracking-wider uppercase pointer-events-none leading-none whitespace-nowrap">
                  MORE
                </span>
              </TouchSafeButton>,
              'w-full flex pointer-events-auto'
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
                    height: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.25, ease: 'easeOut' },
                    scale: { duration: 0.32, ease: [0.16, 1, 0.3, 1] }
                  }
                }}
                exit={{ 
                  opacity: 0, 
                  height: 0, 
                  scale: 0.95,
                  transition: {
                    height: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
                    opacity: { duration: 0.2, ease: 'easeIn' },
                    scale: { duration: 0.24, ease: 'easeIn' }
                  }
                }}
                className="pointer-events-auto w-full overflow-hidden select-none"
              >
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[430px] sm:max-w-[470px] md:max-w-[490px] mx-auto pt-2 pb-0.5">
                  {/* 1. BOTS: Private server, bots only, no friends */}
                  <TouchSafeButton
                    onClick={() => onPlay('bots')}
                    className="h-[46px] sm:h-[52px] bg-gradient-to-b from-teal-400 to-emerald-600 border-2 border-teal-200 rounded-xl px-1 flex flex-col items-center justify-center text-white shadow-md shadow-emerald-500/25 select-none hud-tap"
                  >
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white mb-0.5 pointer-events-none drop-shadow" />
                    <span className="font-black text-[10px] sm:text-xs tracking-wider uppercase pointer-events-none leading-none">
                      BOTS
                    </span>
                  </TouchSafeButton>

                  {/* 2. INSTANT MERGE: Fast recombine, exclusive mode */}
                  <TouchSafeButton
                    onClick={() => onPlay('instantMerge')}
                    className="h-[46px] sm:h-[52px] bg-gradient-to-b from-amber-400 via-orange-500 to-red-600 border-2 border-amber-200 rounded-xl px-1 flex flex-col items-center justify-center text-white shadow-md shadow-orange-500/25 select-none hud-tap"
                  >
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white mb-0.5 pointer-events-none drop-shadow" />
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
                    className="h-[46px] sm:h-[52px] bg-gradient-to-b from-indigo-500 to-purple-600 border-2 border-indigo-200 rounded-xl px-1 flex flex-col items-center justify-center text-white shadow-md shadow-purple-500/25 select-none hud-tap"
                  >
                    <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-white mb-0.5 pointer-events-none drop-shadow" />
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

      {/* ========================================================================= */}
      {/* 2. TOP LEFT: SHOP BUTTON                                                  */}
      {/* ========================================================================= */}
      {renderEditableItem(
        'shop',
        <TouchSafeButton 
          id="shop-cart-button" 
          className="w-14 h-14 sm:w-16 sm:h-16 bg-red-500 border-2 border-red-300 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-500/30 select-none hud-tap pointer-events-auto"
        >
          <ShoppingCart size={28} className="pointer-events-none" />
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
          <div draggable={false} onDragStart={(e) => e.preventDefault()} className="bg-white border border-slate-300 rounded-full flex items-center p-1 pr-3 sm:pr-4 shadow-sm min-w-[125px] sm:min-w-[140px] pointer-events-auto">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-yellow-500 rounded-full flex items-center justify-center border border-yellow-300 mr-2 pointer-events-none">
              <Coins size={15} className="text-yellow-100 pointer-events-none" />
            </div>
            <span className="text-slate-800 font-bold flex-1 text-center pointer-events-none text-sm sm:text-base">613</span>
            <TouchSafeButton className="w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded-full flex items-center justify-center text-white shadow ml-1.5 select-none hud-tap">
              <Plus size={13} strokeWidth={3} className="pointer-events-none" />
            </TouchSafeButton>
          </div>,
          'pointer-events-auto'
        )}

        {/* CASH */}
        {renderEditableItem(
          'cash',
          <div draggable={false} onDragStart={(e) => e.preventDefault()} className="bg-white border border-slate-300 rounded-full flex items-center p-1 pr-3 sm:pr-4 shadow-sm min-w-[125px] sm:min-w-[140px] pointer-events-auto">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-500 rounded-full flex items-center justify-center border border-emerald-400 mr-2 pointer-events-none">
              <Banknote size={15} className="text-green-100 pointer-events-none" />
            </div>
            <span className="text-slate-800 font-bold flex-1 text-center pointer-events-none text-sm sm:text-base">15</span>
            <TouchSafeButton className="w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded-full flex items-center justify-center text-white shadow ml-1.5 select-none hud-tap">
              <Plus size={13} strokeWidth={3} className="pointer-events-none" />
            </TouchSafeButton>
          </div>,
          'pointer-events-auto'
        )}

        {/* SEASON */}
        {renderEditableItem(
          'season',
          <TouchSafeButton 
            onClick={isEditingHud ? undefined : onSeason}
            className="bg-gradient-to-b from-yellow-400 to-yellow-600 border-2 border-yellow-300 rounded-full py-1.5 sm:py-2 px-6 sm:px-8 flex items-center gap-2 shadow-lg shadow-yellow-500/20 mt-0.5 select-none pointer-events-auto hud-tap"
          >
            <Crown size={18} className="text-white fill-white pointer-events-none" />
            <span className="text-white font-extrabold tracking-wide uppercase text-xs sm:text-sm pointer-events-none">Season</span>
          </TouchSafeButton>,
          'pointer-events-auto'
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
            className="w-[74px] sm:w-[82px] h-[50px] sm:h-14 bg-gradient-to-b from-gray-400 to-gray-600 border border-gray-300/80 rounded-xl flex flex-col items-center justify-center text-white shadow-md shadow-gray-500/20 select-none hud-tap pointer-events-auto"
          >
            <Settings size={20} className="pointer-events-none text-white drop-shadow mb-0.5" />
            <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-wider text-white uppercase pointer-events-none leading-none drop-shadow-xs whitespace-nowrap">
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
            onClick={() => {}}
            className="w-[50px] sm:w-14 h-[50px] sm:h-14 bg-gradient-to-b from-violet-400 to-purple-600 border border-violet-200/80 rounded-xl flex flex-col items-center justify-center text-white shadow-md shadow-purple-500/20 select-none hud-tap pointer-events-auto"
          >
            <User size={20} className="pointer-events-none text-white drop-shadow mb-0.5" />
            <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-wider text-white uppercase pointer-events-none leading-none drop-shadow-xs whitespace-nowrap">
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
          <div className="relative flex items-center justify-center filter drop-shadow-xl pointer-events-none">
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
              className="absolute inset-0 flex items-center justify-center font-black text-2xl pt-1 pointer-events-none drop-shadow-md"
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
          right: 'max(1.5rem, env(safe-area-inset-right))' 
        }
      )}

    </div>
  );
}
