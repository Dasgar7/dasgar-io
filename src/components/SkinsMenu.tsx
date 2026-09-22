import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Image as ImageIcon, Smile, Star, Gift, Video, Backpack, Check, Trash2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TouchSafeButton } from './TouchSafeButton';
import { PRESET_SKINS, SkinItem, getPlayerRank, RANK_BADGE_IMAGES } from '../data/skinsData';
import { CustomSkinBuilder } from './CustomSkinBuilder';

interface SkinsMenuProps {
  onBack: () => void;
}

const CATEGORIES = [
  { id: 'vip', label: 'Elite', icon: Lock, iconColor: 'text-pink-400', activeBg: 'bg-purple-900/40 border-purple-500/50 text-purple-200' },
  { id: 'custom', label: 'Custom', icon: ImageIcon, iconColor: 'text-sky-400', activeBg: 'bg-slate-700/80 border-slate-500 text-white' },
  { id: 'free', label: 'Basic', icon: Smile, iconColor: 'text-yellow-400', activeBg: 'bg-[#293666] border-[#3f5296] text-white shadow-lg' },
  { id: 'level', label: 'Ranked', icon: Star, iconColor: 'text-amber-500', activeBg: 'bg-slate-700/80 border-slate-500 text-white' },
  { id: 'premium', label: 'Vault', icon: Gift, iconColor: 'text-rose-400', activeBg: 'bg-slate-700/80 border-slate-500 text-white' },
  { id: 'creators', label: 'Creators', icon: Video, iconColor: 'text-red-400', activeBg: 'bg-red-900/40 border-red-500/50 text-red-200 shadow-lg' },
  { id: 'own', label: 'Mine', icon: Backpack, iconColor: 'text-blue-400', activeBg: 'bg-slate-700/80 border-slate-500 text-white' },
];

export function SkinsMenu({ onBack }: SkinsMenuProps) {
  const [activeCategory, setActiveCategory] = useState('level');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [playerRank, setPlayerRankState] = useState<number>(() => getPlayerRank());
  const [selectedSkinId, setSelectedSkinId] = useState<string | null>(() => {
    return localStorage.getItem('dasgario_equipped_skin');
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingCardsRef = useRef(false);
  const dragCardsStartXRef = useRef(0);
  const dragCardsStartScrollRef = useRef(0);
  const hasMovedCardsRef = useRef(false);

  const handleCancelSearch = () => {
    setSearchQuery('');
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
  };

  useEffect(() => {
    const handleRankUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent.detail === 'number') {
        setPlayerRankState(customEvent.detail);
      } else {
        setPlayerRankState(getPlayerRank());
      }
    };

    window.addEventListener('dasgario_rank_updated', handleRankUpdate);
    window.addEventListener('storage', handleRankUpdate);

    return () => {
      window.removeEventListener('dasgario_rank_updated', handleRankUpdate);
      window.removeEventListener('storage', handleRankUpdate);
    };
  }, []);

  // Smooth wheel scrolling for mouse/trackpad
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
        container.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Mouse drag-to-scroll on cards container for desktop fluidity ONLY
  const handleCardsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only capture real mouse clicks (button 0), let native touch handle mobile seamlessly
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    isDraggingCardsRef.current = true;
    hasMovedCardsRef.current = false;
    dragCardsStartXRef.current = e.clientX;
    dragCardsStartScrollRef.current = container.scrollLeft;
  };

  const handleCardsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCardsRef.current || e.pointerType !== 'mouse') return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const deltaX = e.clientX - dragCardsStartXRef.current;
    if (Math.abs(deltaX) > 3) {
      hasMovedCardsRef.current = true;
    }
    if (hasMovedCardsRef.current) {
      container.scrollLeft = dragCardsStartScrollRef.current - deltaX;
    }
  };

  const handleCardsPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    isDraggingCardsRef.current = false;
    setTimeout(() => {
      hasMovedCardsRef.current = false;
    }, 50);
  };

  const [customSkins, setCustomSkins] = useState<SkinItem[]>(() => {
    try {
      const saved = localStorage.getItem('dasgario_custom_skins');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleSelectSkin = (skin: SkinItem) => {
    const isLocked = typeof skin.requiredRank === 'number' && playerRank < skin.requiredRank;
    if (isLocked) return;

    if (selectedSkinId === skin.id) {
      setSelectedSkinId(null);
      localStorage.removeItem('dasgario_equipped_skin');
    } else {
      setSelectedSkinId(skin.id);
      localStorage.setItem('dasgario_equipped_skin', skin.id);
    }
  };

  const handleSaveCustomSkin = (newSkin: SkinItem) => {
    setCustomSkins((prev) => {
      const updated = [newSkin, ...prev];
      try {
        localStorage.setItem('dasgario_custom_skins', JSON.stringify(updated));
      } catch (err) {
        console.warn('Unable to persist custom skin to localStorage', err);
      }
      return updated;
    });
    setSelectedSkinId(newSkin.id);
    localStorage.setItem('dasgario_equipped_skin', newSkin.id);
  };

  const handleDeleteCustomSkin = (skinId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomSkins((prev) => {
      const updated = prev.filter((s) => s.id !== skinId);
      try {
        localStorage.setItem('dasgario_custom_skins', JSON.stringify(updated));
      } catch (err) {
        console.warn(err);
      }
      return updated;
    });
    if (selectedSkinId === skinId) {
      setSelectedSkinId(null);
      localStorage.removeItem('dasgario_equipped_skin');
    }
  };

  // Current category skins
  const currentSkins: SkinItem[] = 
    activeCategory === 'custom' 
      ? customSkins 
      : activeCategory === 'creators' 
        ? [] 
        : PRESET_SKINS[activeCategory] || [];

  const filteredSkins = currentSkins.filter(skin => 
    skin.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div 
      className="w-full bg-[#0b101e] text-white flex justify-center font-sans select-none overflow-hidden"
      style={{ 
        height: 'calc(100% - env(safe-area-inset-bottom, 0px) - 16px)',
        maxHeight: 'calc(100vh - env(safe-area-inset-bottom, 0px) - 16px)',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))'
      }}
    >
      <div 
        className="w-full max-w-5xl h-full flex flex-col bg-[#0b101e] relative border-x border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.15)]"
      >
        
        {/* Glow Overlay */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_20px_0_50px_-20px_rgba(59,130,246,0.25),inset_-20px_0_50px_-20px_rgba(59,130,246,0.25)] z-50"></div>

        {/* Top Header */}
        <div className="relative flex justify-center items-center py-3.5 sm:py-4 landscape:py-2.5 bg-[#111728] border-b border-slate-800/60 z-10 shadow-sm shrink-0">
          <h1 
            className="text-4xl sm:text-5xl landscape:text-3xl font-black text-transparent bg-clip-text bg-white uppercase drop-shadow-md select-none pointer-events-none" 
            style={{ WebkitTextStroke: '1.5px #64748b', letterSpacing: '2px' }}
          >
            SKINS
          </h1>
          <TouchSafeButton  
            onClick={onBack}
            className="absolute right-4 sm:right-6 landscape:right-5 text-white select-none flex items-center justify-center p-1.5 hover:opacity-80 transition-opacity"
          >
            <X size={40} strokeWidth={3.5} className="text-white pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] w-9 h-9 sm:w-10 sm:h-10 landscape:w-8 landscape:h-8" />
          </TouchSafeButton>
        </div>

        {/* Categories Tabs */}
        <div className="flex gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-2 landscape:py-1 bg-[#111728] border-b border-[#1c2438] w-full items-center justify-between shrink-0">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            
            return (
              <TouchSafeButton 
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-1 min-w-0 h-10 sm:h-11 landscape:h-8 flex items-center justify-center gap-1 sm:gap-1.5 px-0.5 sm:px-1.5 rounded-xl landscape:rounded-lg font-bold text-[11px] sm:text-xs md:text-sm landscape:text-[11px] whitespace-nowrap transition-all border-2 select-none ${
                  isActive 
                    ? cat.activeBg
                    : 'bg-[#1a2235] border-[#2a3652] text-slate-300 hover:bg-[#202a40]'
                } ${cat.id === 'vip' && !isActive ? 'border-purple-900/60 text-purple-300/80' : ''}`}
              >
                <cat.icon size={16} className={`${cat.iconColor} shrink-0 pointer-events-none landscape:w-3.5 landscape:h-3.5`} />
                <span className="pointer-events-none font-extrabold tracking-wide">{cat.label}</span>
              </TouchSafeButton>
            );
          })}
        </div>

        {/* Native iOS-Style Search Bar with Spring Animation & Cancel Button */}
        {activeCategory !== 'creators' && (
          <div className="w-full px-4 sm:px-6 landscape:px-4 pt-1.5 pb-0 flex items-center justify-center shrink-0 z-10">
            <div className="w-full max-w-2xl flex items-center overflow-hidden">
              <motion.div 
                layout
                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                className={`relative flex-1 flex items-center rounded-full transition-all duration-300 ease-out ${
                  isSearchFocused 
                    ? 'bg-white/[0.17] ring-2 ring-sky-400/40 border-white/40 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.3),0_4px_24px_rgba(0,0,0,0.45)]' 
                    : 'bg-white/[0.11] hover:bg-white/[0.14] border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.35)]'
                } border backdrop-blur-2xl`}
              >
                <div className="absolute left-3.5 landscape:left-3 flex items-center pointer-events-none text-slate-300/75">
                  <Search size={15} strokeWidth={1.9} className="landscape:w-3.5 landscape:h-3.5" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    if (searchQuery.length === 0) {
                      setIsSearchFocused(false);
                    }
                  }}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search skins..."
                  className="w-full h-8.5 sm:h-9 landscape:h-7 pl-9 landscape:pl-8 pr-8 landscape:pr-7 bg-transparent text-slate-100 placeholder:text-slate-400/70 text-xs sm:text-sm landscape:text-xs rounded-full focus:outline-none transition-colors"
                />
                <AnimatePresence>
                  {searchQuery.length > 0 && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.16, ease: [0.25, 0.1, 0.25, 1] }}
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2.5 landscape:right-2 p-1 landscape:p-0.5 text-slate-300 hover:text-white bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                      title="Clear search"
                    >
                      <X size={12} strokeWidth={2.2} className="landscape:w-2.5 landscape:h-2.5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* iOS-Style "Cancel" Button - Instant coordinated slide */}
              <AnimatePresence initial={false} mode="sync">
                {(isSearchFocused || searchQuery.length > 0) && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, x: 24, width: 0, marginLeft: 0 }}
                    animate={{ opacity: 1, x: 0, width: 'auto', marginLeft: 12 }}
                    exit={{ opacity: 0, x: 24, width: 0, marginLeft: 0 }}
                    transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                    onClick={handleCancelSearch}
                    className="text-sky-400 hover:text-sky-300 active:opacity-60 font-medium text-xs sm:text-sm landscape:text-xs whitespace-nowrap overflow-hidden transition-colors cursor-pointer select-none shrink-0"
                  >
                    Cancel
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Section Subheader (if Creators is active) */}
        {activeCategory === 'creators' && (
          <div className="flex items-center gap-2 px-6 py-1.5 landscape:py-1 bg-[#111728] border-b border-[#1c2438] shrink-0">
            <Video size={16} className="text-red-400 pointer-events-none landscape:w-3.5 landscape:h-3.5" />
            <span className="font-extrabold text-xs landscape:text-[11px] tracking-wider uppercase text-slate-300 pointer-events-none">
              CREATORS SKINS
            </span>
          </div>
        )}

        {/* Custom Skin Builder Section (Only on Custom tab) */}
        {activeCategory === 'custom' && (
          <div className="shrink-0 max-h-[48vh] landscape:max-h-[38vh] overflow-y-auto">
            <CustomSkinBuilder onSaveSkin={handleSaveCustomSkin} />
          </div>
        )}

        {/* Skins Grid Container */}
        <div 
          ref={scrollContainerRef}
          onPointerDown={handleCardsPointerDown}
          onPointerMove={handleCardsPointerMove}
          onPointerUp={handleCardsPointerUp}
          onPointerCancel={handleCardsPointerUp}
          className="flex-1 overflow-x-auto overflow-y-hidden px-4 sm:px-6 landscape:px-4 bg-[#0b101e] flex items-center select-none cursor-grab active:cursor-grabbing"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            touchAction: 'pan-x',
            scrollBehavior: 'auto',
            paddingTop: '20px',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 48px)'
          }}
        >
          {/* Creators Tab (Blank / Empty) */}
          {activeCategory === 'creators' ? (
            <div className="w-full min-h-full flex flex-col items-center justify-center text-center p-8 landscape:p-4 select-none">
              <div className="w-20 h-20 landscape:w-14 landscape:h-14 rounded-full bg-slate-900/80 border-2 border-dashed border-slate-700 flex items-center justify-center mb-3 landscape:mb-1.5">
                <Video size={36} className="text-slate-600 landscape:w-6 landscape:h-6" />
              </div>
              <p className="text-sm landscape:text-xs font-bold text-slate-400">No Creator Skins Available Yet</p>
              <p className="text-xs landscape:text-[10px] text-slate-600 mt-1">Creator skins will be assigned manually soon.</p>
            </div>
          ) : activeCategory === 'custom' && currentSkins.length === 0 ? (
            /* Custom Tab Empty state if no skins saved yet */
            <div className="w-full min-h-full flex flex-col items-center justify-center text-center p-8 landscape:p-4 select-none">
              <div className="w-20 h-20 landscape:w-14 landscape:h-14 rounded-full bg-slate-900/80 border-2 border-dashed border-sky-500/40 flex items-center justify-center mb-3 landscape:mb-1.5 shadow-[0_0_20px_rgba(56,189,248,0.15)]">
                <ImageIcon size={36} className="text-sky-400/60 landscape:w-6 landscape:h-6" />
              </div>
              <p className="text-sm landscape:text-xs font-bold text-slate-300">No Custom Skins Created Yet</p>
              <p className="text-xs landscape:text-[10px] text-slate-500 mt-1 max-w-sm">
                Use the tools above to draw a skin, upload an image from your device, or paste a web image link!
              </p>
            </div>
          ) : searchQuery.trim() !== '' && filteredSkins.length === 0 ? (
            /* No search results empty state */
            <div className="w-full min-h-full flex flex-col items-center justify-center text-center p-8 landscape:p-4 select-none">
              <div className="w-16 h-16 landscape:w-12 landscape:h-12 rounded-full bg-slate-900/80 border border-slate-700/60 flex items-center justify-center mb-2.5 landscape:mb-1">
                <Search size={24} className="text-slate-500 landscape:w-5 landscape:h-5" />
              </div>
              <p className="text-sm landscape:text-xs font-bold text-slate-300">No matching skins found</p>
              <p className="text-xs landscape:text-[10px] text-slate-500 mt-0.5 max-w-xs">
                No skins matching &ldquo;{searchQuery}&rdquo; in this tab.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 landscape:mt-1.5 px-3.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs landscape:text-[10px] font-semibold text-sky-400 hover:text-sky-300 rounded-lg transition-colors cursor-pointer"
              >
                Clear search
              </button>
            </div>
          ) : (
            /* Skins Cards Row */
            <div 
              className="flex gap-4 sm:gap-6 landscape:gap-3 items-center min-w-max my-auto"
            >
              {filteredSkins.map((skin) => {
                const isSelected = selectedSkinId === skin.id;
                const isRankLocked = typeof skin.requiredRank === 'number' && playerRank < skin.requiredRank;

                return (
                  <div 
                    key={skin.id} 
                    className={`bg-[#161d2d] border-2 rounded-2xl landscape:rounded-xl p-3 sm:p-4 landscape:p-2.5 flex flex-col items-center justify-between transition-all group w-44 sm:w-52 md:w-56 landscape:w-36 landscape:sm:w-40 h-64 sm:h-72 md:h-76 landscape:h-[188px] landscape:sm:h-[200px] shrink-0 relative shadow-lg ${
                      isSelected 
                        ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)] bg-[#1a2538]' 
                        : isRankLocked
                          ? 'border-[#1b2336] bg-[#121826]'
                          : 'border-[#1f2940] hover:bg-[#1a2235] hover:border-[#304060]'
                    }`}
                  >
                    {/* Delete button for custom skins */}
                    {activeCategory === 'custom' && (
                      <button
                        onClick={(e) => handleDeleteCustomSkin(skin.id, e)}
                        className="absolute top-2 right-2 landscape:top-1.5 landscape:right-1.5 p-1.5 landscape:p-1 text-slate-500 hover:text-rose-400 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors z-20"
                        title="Delete custom skin"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    {/* 1. Skin Name Label (Top of Card) */}
                    <span className="text-xs sm:text-sm landscape:text-[11px] font-extrabold text-slate-200 mb-1 landscape:mb-0.5 truncate max-w-[140px] sm:max-w-[170px] landscape:max-w-[110px] text-center tracking-wide shrink-0">
                      {skin.name}
                    </span>

                    {/* 2. Skin Circle Container (Middle) */}
                    <div 
                      className="w-full flex-1 flex flex-col items-center justify-center select-none pointer-events-none relative my-0.5"
                    >
                      <div className="relative flex items-center justify-center">
                        <div className={`w-[148px] sm:w-[172px] md:w-[188px] landscape:w-[106px] landscape:sm:w-[116px] h-[148px] sm:h-[172px] md:h-[188px] landscape:h-[106px] landscape:sm:h-[116px] rounded-full bg-slate-900 border-[3.5px] landscape:border-2 transition-all flex items-center justify-center overflow-hidden relative shadow-inner ${
                          isSelected 
                            ? 'border-emerald-400 ring-2 ring-emerald-400/40' 
                            : isRankLocked 
                              ? 'border-[#222c42]' 
                              : 'border-[#2a3652] group-hover:border-indigo-400'
                        }`}>
                          <img 
                            src={skin.svg} 
                            alt={skin.name} 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (skin.id === 'rank-1' && target.src !== '/skins/rank1-pig.png') {
                                target.src = '/skins/rank1-pig.png';
                              } else if (skin.id === 'rank-7' && target.src !== '/skins/rank7-spider.png') {
                                target.src = '/skins/rank7-spider.png';
                              } else if (skin.id === 'rank-15' && target.src !== '/skins/rank15-cat.png') {
                                target.src = '/skins/rank15-cat.png';
                              } else if (skin.id === 'rank-23' && target.src !== '/skins/rank23-dragon.png') {
                                target.src = '/skins/rank23-dragon.png';
                              } else if (skin.id === 'rank-27' && target.src !== '/skins/rank27-shark.png') {
                                target.src = '/skins/rank27-shark.png';
                              } else if (skin.id === 'rank-35' && target.src !== '/skins/rank35-fox.png') {
                                target.src = '/skins/rank35-fox.png';
                              }
                            }}
                            className={`w-full h-full object-cover pointer-events-none transition-transform duration-200 ${
                              skin.id === 'rank-7' ? 'scale-110' : skin.id === 'rank-15' ? 'scale-105' : skin.id === 'rank-23' ? 'scale-105' : skin.id === 'rank-27' ? 'scale-105' : skin.id === 'rank-35' ? 'scale-105' : ''
                            }`} 
                          />
                        </div>

                        {/* Premium Star Medal Rank Badge with Embedded Number & Corner Lock */}
                        {typeof skin.requiredRank === 'number' && (() => {
                          const rank = skin.requiredRank;
                          const customBadgeImg = skin.badgeImg || RANK_BADGE_IMAGES[rank];

                          if (customBadgeImg) {
                            return (
                              <div className="absolute -bottom-4 landscape:-bottom-3 z-10 flex items-center justify-center pointer-events-none select-none">
                                <img
                                  src={customBadgeImg}
                                  alt=""
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src !== '/assets/badges/rank1-star-badge.png') {
                                      target.src = '/assets/badges/rank1-star-badge.png';
                                    }
                                  }}
                                  className="w-10 h-10 sm:w-11 sm:h-11 landscape:w-8 landscape:h-8 object-contain drop-shadow-[0_0_8px_rgba(244,114,182,0.6)] drop-shadow-[0_3px_5px_rgba(0,0,0,0.85)]"
                                />
                              </div>
                            );
                          }

                          const theme = rank >= 35
                            ? {
                                glow: 'drop-shadow(0 0 7px rgba(249,115,22,0.75)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                                gradId: `grad-rank-${skin.id}-orange`,
                                stop1: '#fb923c',
                                stop2: '#ea580c',
                                border: '#fed7aa',
                                textColor: '#ffffff'
                              }
                            : rank >= 27
                            ? {
                                glow: 'drop-shadow(0 0 7px rgba(59,130,246,0.7)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                                gradId: `grad-rank-${skin.id}-blue`,
                                stop1: '#60a5fa',
                                stop2: '#2563eb',
                                border: '#93c5fd',
                                textColor: '#ffffff'
                              }
                            : rank === 23
                              ? {
                                  glow: 'drop-shadow(0 0 7px rgba(168,85,247,0.7)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                                  gradId: `grad-rank-${skin.id}-purple`,
                                  stop1: '#c084fc',
                                  stop2: '#7e22ce',
                                  border: '#e9d5ff',
                                  textColor: '#ffffff'
                                }
                              : rank === 15
                                ? {
                                    glow: 'drop-shadow(0 0 7px rgba(234,179,8,0.7)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                                    gradId: `grad-rank-${skin.id}-yellow`,
                                    stop1: '#fde047',
                                    stop2: '#ca8a04',
                                    border: '#fef08a',
                                    textColor: '#ffffff'
                                  }
                                : rank === 7
                                  ? {
                                      glow: 'drop-shadow(0 0 7px rgba(239,68,68,0.7)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                                      gradId: `grad-rank-${skin.id}-red`,
                                      stop1: '#f87171',
                                      stop2: '#dc2626',
                                      border: '#fecaca',
                                      textColor: '#ffffff'
                                    }
                                  : {
                                      glow: 'drop-shadow(0 0 7px rgba(244,114,182,0.7)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                                      gradId: `grad-rank-${skin.id}-pink`,
                                      stop1: '#f472b6',
                                      stop2: '#db2777',
                                      border: '#fbcfe8',
                                      textColor: '#ffffff'
                                    };

                          return (
                            <div className="absolute -bottom-3.5 landscape:-bottom-2.5 z-10 flex items-center justify-center pointer-events-none select-none">
                              <div className="relative flex items-center justify-center">
                                {/* SVG Star Medal with Embedded Number */}
                                <svg 
                                  className="w-8 h-8 sm:w-9 sm:h-9 landscape:w-7 landscape:h-7"
                                  viewBox="0 0 36 36" 
                                  style={{ filter: theme.glow }}
                                >
                                  <defs>
                                    <linearGradient id={theme.gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor={theme.stop1} />
                                      <stop offset="100%" stopColor={theme.stop2} />
                                    </linearGradient>
                                  </defs>
                                  {/* Star Body */}
                                  <polygon
                                    points="18,1.5 23.2,12.1 34.8,13.8 26.4,22 28.4,33.5 18,28 7.6,33.5 9.6,22 1.2,13.8 12.8,12.1"
                                    fill={`url(#${theme.gradId})`}
                                    stroke={theme.border}
                                    strokeWidth="1.4"
                                    strokeLinejoin="round"
                                  />
                                  {/* Star Inner Specular Highlight */}
                                  <polygon
                                    points="18,3.5 22.4,12.3 32.5,13.8 25.5,20.6 18,22 10.5,20.6 3.5,13.8 13.6,12.3"
                                    fill="white"
                                    fillOpacity="0.22"
                                  />
                                  {/* Embedded Rank Number */}
                                  <text
                                    x="18"
                                    y={rank >= 10 ? "23.5" : "23.8"}
                                    textAnchor="middle"
                                    fill={theme.textColor}
                                    fontSize={rank >= 10 ? "11.5" : "13.5"}
                                    fontWeight="900"
                                    fontFamily="system-ui, -apple-system, sans-serif"
                                    style={{
                                      textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,0.6)'
                                    }}
                                  >
                                    {rank}
                                  </text>
                                </svg>

                                {/* Badge-on-badge Corner Lock Icon */}
                                {isRankLocked && (
                                  <div className="absolute -bottom-0.5 -right-1 sm:-right-1.5 landscape:-right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 landscape:w-3 landscape:h-3 rounded-full bg-[#0c1220] border border-slate-600/80 shadow-[0_1px_4px_rgba(0,0,0,0.9)] flex items-center justify-center">
                                    <Lock size={9} strokeWidth={2.4} className="text-slate-300 landscape:w-2 landscape:h-2" />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* 3. Button Section (Bottom of Card) */}
                    {isRankLocked ? (
                      <div
                        className="w-full py-2.5 sm:py-3 landscape:py-1.5 rounded-xl landscape:rounded-lg font-extrabold text-xs sm:text-sm landscape:text-xs tracking-wide flex items-center justify-center gap-1.5 landscape:gap-1.5 bg-[#141b29] border border-[#212c40] text-slate-500 cursor-not-allowed select-none opacity-80 mt-1 landscape:mt-1 shadow-sm"
                      >
                        <Lock size={15} className="text-slate-500 landscape:w-3.5 landscape:h-3.5" />
                        <span>Locked</span>
                      </div>
                    ) : (
                      <TouchSafeButton
                        onClick={() => handleSelectSkin(skin)}
                        className={`w-full py-2.5 sm:py-3 landscape:py-1.5 rounded-xl landscape:rounded-lg font-extrabold text-xs sm:text-sm md:text-base landscape:text-xs tracking-wide flex items-center justify-center gap-1.5 landscape:gap-1.5 transition-all shadow-md active:scale-95 border select-none mt-1 landscape:mt-1 ${
                          isSelected
                            ? 'bg-gradient-to-b from-emerald-500 to-green-600 border-emerald-300 text-white shadow-emerald-500/25'
                            : 'bg-gradient-to-b from-blue-600 to-blue-800 border-blue-400/60 text-white hover:from-blue-500 hover:to-blue-700 shadow-blue-900/30'
                        }`}
                      >
                        {isSelected && <Check size={16} strokeWidth={3} className="pointer-events-none landscape:w-3.5 landscape:h-3.5" />}
                        <span className="pointer-events-none">{isSelected ? 'Unselect' : 'Select'}</span>
                      </TouchSafeButton>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}