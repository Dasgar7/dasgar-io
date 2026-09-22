import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  HelpCircle, 
  Check, 
  RotateCcw, 
  Globe, 
  LogOut, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  X,
  User,
  Sliders,
  Eye,
  Crosshair
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TouchSafeButton } from './TouchSafeButton';

export interface ModSettings {
  // Zoom
  dynamicZoom: boolean;
  staticZoom: boolean;
  zoomButtons: boolean;
  invertZoom: boolean;
  // Inventory
  unlockSkins: boolean;
  coinSkins: boolean;
  customTab: boolean;
  // Controls
  masterSplit: boolean;
  settingsButton: boolean;
  editButtons: boolean;
  // Cells
  enemyScore: boolean;
  virusMass: boolean;
  // Arena
  grids: boolean;
  foods: boolean;
  tokens: boolean;
  darkMode: boolean;
  // Game Options
  language: string;
  stopOnRelease: boolean;
  directionOnTouch: boolean;
  // Audio & Display
  sfx: boolean;
  music: boolean;
  highFps: boolean;
  showFps: boolean;
  // Account
  nickname: string;
}

export const DEFAULT_MOD_SETTINGS: ModSettings = {
  dynamicZoom: true,
  staticZoom: false,
  zoomButtons: true,
  invertZoom: false,
  unlockSkins: true,
  coinSkins: true,
  customTab: true,
  masterSplit: true,
  settingsButton: true,
  editButtons: false,
  enemyScore: true,
  virusMass: true,
  grids: true,
  foods: true,
  tokens: true,
  darkMode: false,
  language: 'English',
  stopOnRelease: false,
  directionOnTouch: true,
  sfx: true,
  music: true,
  highFps: true,
  showFps: false,
  nickname: 'Player',
};

const STORAGE_KEY_SETTINGS = 'dasgario_mod_settings';
const STORAGE_KEY_MOD_POS = 'dasgar_modMenuButtonPos';

const LANGUAGES = ['English', 'Español', 'Français', 'Deutsch', 'Português', 'Русский'];

const HELP_DESCRIPTIONS: Record<string, { title: string; desc: string }> = {
  stopOnRelease: {
    title: 'Stop on Release',
    desc: 'When enabled, your cell immediately halts forward movement when your finger lifts off the screen, preventing drifting toward the last touch point.'
  },
  directionOnTouch: {
    title: 'Direction on Touch',
    desc: 'Allows immediate steering toward wherever you place your finger on the arena surface, enabling quick reactive evasions.'
  },
  dynamicZoom: {
    title: 'Dynamic Zoom',
    desc: 'Dynamically scales the viewport as your cell grows in mass so you always have optimal visibility of nearby threats and targets.'
  },
  staticZoom: {
    title: 'Static Zoom',
    desc: 'Locks viewport magnification to a fixed constant level regardless of your current cell mass or splitting state.'
  },
  zoomButtons: {
    title: 'Zoom Buttons',
    desc: 'Displays on-screen plus and minus touch controls allowing manual field-of-view adjustments.'
  },
  invertZoom: {
    title: 'Invert Zoom',
    desc: 'Reverses the directional behavior of zoom pinch gestures and mouse wheel zooming.'
  },
  masterSplit: {
    title: 'Master Split',
    desc: 'Enables the rapid multi-split keybinding (F key or top HUD button) to split up to the 16-cell limit in rapid succession.'
  },
  settingsButton: {
    title: 'Settings Button',
    desc: 'Toggles the in-game quick gear shortcut button on your HUD overlay.'
  },
  editButtons: {
    title: 'Edit Buttons',
    desc: 'Allows dragging and repositioning on-screen touch buttons anywhere on your display.'
  },
  enemyScore: {
    title: 'Enemy Score',
    desc: 'Shows real-time mass numbers directly on opponent cells to assess if they are edible or predatory.'
  },
  virusMass: {
    title: 'Virus Mass',
    desc: 'Displays mass counts inside green viruses so you know precisely how many shots until they pop.'
  },
  grids: {
    title: 'Arena Grids',
    desc: 'Renders the background coordinate grid mesh across the playing field.'
  },
  foods: {
    title: 'Pellet Foods',
    desc: 'Renders standard mass food dots scattered throughout the arena.'
  },
  tokens: {
    title: 'Event Tokens',
    desc: 'Displays seasonal green candies and special collectible bonus tokens.'
  },
  darkMode: {
    title: 'Dark Mode Arena',
    desc: 'Switches the arena background to an eye-safe dark theme.'
  }
};

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [settings, setSettings] = useState<ModSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        return { ...DEFAULT_MOD_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_MOD_SETTINGS;
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeHelp, setActiveHelp] = useState<{ title: string; desc: string } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const isFirstMount = useRef(true);

  // Persist settings whenever changed (skip first mount)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const updateSetting = <K extends keyof ModSettings>(key: K, value: ModSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleSetting = (key: keyof ModSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Reset Control Button Positions
  const handleResetControls = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_MOD_POS);
    } catch {
      // Ignore
    }
    showToast('Controls & button positions reset to defaults!');
  };

  // Reset Zoom Positions
  const handleResetZoom = () => {
    setSettings(prev => ({
      ...prev,
      dynamicZoom: true,
      staticZoom: false,
      zoomButtons: true,
      invertZoom: false
    }));
    showToast('Zoom configurations restored to defaults!');
  };

  // Unlock all skins
  const handleUnlockSkins = () => {
    try {
      localStorage.setItem('dasgario_player_rank', '100');
    } catch {
      // Ignore
    }
    setSettings(prev => ({
      ...prev,
      unlockSkins: true,
      coinSkins: true,
      customTab: true
    }));
    showToast('All 30 Rank Skins & Custom Skins Unlocked!');
  };

  // Cycle Language
  const handleCycleLanguage = () => {
    const currentIndex = LANGUAGES.indexOf(settings.language);
    const nextIndex = (currentIndex + 1) % LANGUAGES.length;
    updateSetting('language', LANGUAGES[nextIndex]);
    showToast(`Language set to ${LANGUAGES[nextIndex]}`);
  };

  // Confirm logout / reset data
  const handleConfirmLogout = () => {
    try {
      localStorage.removeItem('dasgario_equipped_skin');
      localStorage.removeItem('dasgario_player_rank');
      localStorage.removeItem('dasgar_greenCandyCount');
    } catch {
      // Ignore
    }
    setSettings(prev => ({ ...prev, nickname: 'Player' }));
    setShowLogoutConfirm(false);
    showToast('Logged out of guest session successfully!');
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
      className="fixed inset-0 z-50 w-full h-full bg-[#348ceb] text-slate-800 flex flex-col select-none overflow-hidden"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      {/* ================= FIXED TOP HEADER ================= */}
      <header className="shrink-0 h-14 sm:h-16 bg-white border-b border-[#CBD5E1] px-3 sm:px-6 flex items-center justify-between z-20 shadow-xs">
        {/* Left: Cyan circular back button */}
        <TouchSafeButton
          onClick={onBack}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#00BCD4] border-2 border-[#0097A7] shadow-sm flex items-center justify-center text-white cursor-pointer select-none hud-tap"
          title="Back"
        >
          <ChevronLeft size={28} strokeWidth={3.5} className="pointer-events-none -ml-0.5" />
        </TouchSafeButton>

        {/* Center: "Settings" Title */}
        <h1 className="text-xl sm:text-2xl font-black text-[#334155] tracking-tight uppercase">
          Settings
        </h1>

        {/* Right: Balanced spacing without any icon */}
        <div className="w-10 sm:w-11" />
      </header>

      {/* ================= SCROLLABLE SETTINGS CONTENT ================= */}
      <main 
        className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-10 py-3 sm:py-5 space-y-4"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
      >
        <div className="w-full max-w-5xl mx-auto space-y-5">

          {/* ================= SECTION: CONTROLS & MODS ================= */}
          <section>
            <div className="space-y-2">
              {/* Row 1: Zoom */}
              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                    Zoom
                  </span>
                  <TouchSafeButton
                    onClick={() => setActiveHelp(HELP_DESCRIPTIONS.dynamicZoom)}
                    className="w-5 h-5 rounded-full bg-[#00BCD4] text-white text-[11px] font-black flex items-center justify-center cursor-pointer shadow-xs select-none hud-tap"
                    title="Help"
                  >
                    ?
                  </TouchSafeButton>
                </div>

                <div className="flex flex-wrap items-center justify-start md:justify-end gap-1.5 sm:gap-2">
                  <ModActionButton
                    label="Dynamic&#10;Zoom"
                    active={settings.dynamicZoom}
                    onClick={() => {
                      updateSetting('dynamicZoom', !settings.dynamicZoom);
                      if (!settings.dynamicZoom) updateSetting('staticZoom', false);
                    }}
                  />
                  <ModActionButton
                    label="Static&#10;Zoom"
                    active={settings.staticZoom}
                    onClick={() => {
                      updateSetting('staticZoom', !settings.staticZoom);
                      if (!settings.staticZoom) updateSetting('dynamicZoom', false);
                    }}
                  />
                  <ModActionButton
                    label="Zoom&#10;Buttons"
                    active={settings.zoomButtons}
                    onClick={() => toggleSetting('zoomButtons')}
                  />
                  <ModActionButton
                    label="Invert&#10;Zoom"
                    active={settings.invertZoom}
                    onClick={() => toggleSetting('invertZoom')}
                  />
                  <ModActionButton
                    label="Reset&#10;Positions"
                    variant="red"
                    onClick={handleResetZoom}
                  />
                </div>
              </div>

              {/* Row 2: Inventory */}
              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                    Inventory
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-start md:justify-end gap-1.5 sm:gap-2">
                  <ModActionButton
                    label="Unlock&#10;Skins"
                    active={settings.unlockSkins}
                    onClick={handleUnlockSkins}
                  />
                  <ModActionButton
                    label="Coin&#10;Skins"
                    active={settings.coinSkins}
                    onClick={() => toggleSetting('coinSkins')}
                  />
                  <ModActionButton
                    label="Custom&#10;Tab"
                    active={settings.customTab}
                    onClick={() => toggleSetting('customTab')}
                  />
                </div>
              </div>

              {/* Row 3: Controls */}
              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                    Controls
                  </span>
                  <TouchSafeButton
                    onClick={() => setActiveHelp(HELP_DESCRIPTIONS.masterSplit)}
                    className="w-5 h-5 rounded-full bg-[#00BCD4] text-white text-[11px] font-black flex items-center justify-center cursor-pointer shadow-xs select-none hud-tap"
                    title="Help"
                  >
                    ?
                  </TouchSafeButton>
                </div>

                <div className="flex flex-wrap items-center justify-start md:justify-end gap-1.5 sm:gap-2">
                  <ModActionButton
                    label="Master&#10;Split"
                    active={settings.masterSplit}
                    onClick={() => toggleSetting('masterSplit')}
                  />
                  <ModActionButton
                    label="Settings&#10;Button"
                    active={settings.settingsButton}
                    onClick={() => toggleSetting('settingsButton')}
                  />
                  <ModActionButton
                    label="Edit&#10;Buttons"
                    active={settings.editButtons}
                    onClick={() => {
                      toggleSetting('editButtons');
                      showToast(settings.editButtons ? 'Button drag mode disabled' : 'Button drag mode enabled in-game');
                    }}
                  />
                  <ModActionButton
                    label="Reset&#10;Positions"
                    variant="red"
                    onClick={handleResetControls}
                  />
                </div>
              </div>

              {/* Row 4: Cells */}
              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                    Cells
                  </span>
                  <TouchSafeButton
                    onClick={() => setActiveHelp(HELP_DESCRIPTIONS.enemyScore)}
                    className="w-5 h-5 rounded-full bg-[#00BCD4] text-white text-[11px] font-black flex items-center justify-center cursor-pointer shadow-xs select-none hud-tap"
                    title="Help"
                  >
                    ?
                  </TouchSafeButton>
                </div>

                <div className="flex flex-wrap items-center justify-start md:justify-end gap-1.5 sm:gap-2">
                  <ModActionButton
                    label="Enemy&#10;Score"
                    active={settings.enemyScore}
                    onClick={() => toggleSetting('enemyScore')}
                  />
                  <ModActionButton
                    label="Virus&#10;Mass"
                    active={settings.virusMass}
                    onClick={() => toggleSetting('virusMass')}
                  />
                </div>
              </div>

              {/* Row 5: Arena */}
              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                    Arena
                  </span>
                  <TouchSafeButton
                    onClick={() => setActiveHelp(HELP_DESCRIPTIONS.grids)}
                    className="w-5 h-5 rounded-full bg-[#00BCD4] text-white text-[11px] font-black flex items-center justify-center cursor-pointer shadow-xs select-none hud-tap"
                    title="Help"
                  >
                    ?
                  </TouchSafeButton>
                </div>

                <div className="flex flex-wrap items-center justify-start md:justify-end gap-1.5 sm:gap-2">
                  <ModActionButton
                    label="Grids"
                    active={settings.grids}
                    onClick={() => toggleSetting('grids')}
                  />
                  <ModActionButton
                    label="Foods"
                    active={settings.foods}
                    onClick={() => toggleSetting('foods')}
                  />
                  <ModActionButton
                    label="Tokens"
                    active={settings.tokens}
                    onClick={() => toggleSetting('tokens')}
                  />
                  <ModActionButton
                    label="Dark&#10;Mode"
                    active={settings.darkMode}
                    onClick={() => toggleSetting('darkMode')}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ================= SECTION: GAME OPTIONS ================= */}
          <section>
            <h2 className="text-lg sm:text-xl font-black text-white drop-shadow-xs tracking-tight mb-2.5 px-1">
              Game Options
            </h2>

            <div className="space-y-2">
              {/* Language Row */}
              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Globe size={20} className="text-[#546E7A]" />
                  <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                    Language
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-600 hidden sm:inline">
                    {settings.language}
                  </span>
                  <ModActionButton
                    label={`Change (${settings.language})`}
                    variant="cyan"
                    onClick={handleCycleLanguage}
                  />
                </div>
              </div>

              {/* Stop on Release Row */}
              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                    Stop on Release
                  </span>
                  <TouchSafeButton
                    onClick={() => setActiveHelp(HELP_DESCRIPTIONS.stopOnRelease)}
                    className="w-5 h-5 rounded-full bg-[#00BCD4] text-white text-[11px] font-black flex items-center justify-center cursor-pointer shadow-xs select-none hud-tap"
                    title="Help"
                  >
                    ?
                  </TouchSafeButton>
                </div>
                <NativeSwitch
                  checked={settings.stopOnRelease}
                  onChange={(val) => updateSetting('stopOnRelease', val)}
                />
              </div>

              {/* Direction on Touch Row */}
              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                    Direction on Touch
                  </span>
                  <TouchSafeButton
                    onClick={() => setActiveHelp(HELP_DESCRIPTIONS.directionOnTouch)}
                    className="w-5 h-5 rounded-full bg-[#00BCD4] text-white text-[11px] font-black flex items-center justify-center cursor-pointer shadow-xs select-none hud-tap"
                    title="Help"
                  >
                    ?
                  </TouchSafeButton>
                </div>
                <NativeSwitch
                  checked={settings.directionOnTouch}
                  onChange={(val) => updateSetting('directionOnTouch', val)}
                />
              </div>
            </div>
          </section>

          {/* ================= SECTION: AUDIO & DISPLAY ================= */}
          <section>
            <h2 className="text-lg sm:text-xl font-black text-white drop-shadow-xs tracking-tight mb-2.5 px-1">
              Audio & Display
            </h2>

            <div className="space-y-2">
              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 shadow-2xs">
                <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                  Sound Effects (SFX)
                </span>
                <NativeSwitch
                  checked={settings.sfx}
                  onChange={(val) => updateSetting('sfx', val)}
                />
              </div>

              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 shadow-2xs">
                <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                  High Refresh Rate (60/120 FPS)
                </span>
                <NativeSwitch
                  checked={settings.highFps}
                  onChange={(val) => updateSetting('highFps', val)}
                />
              </div>

              <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 shadow-2xs">
                <span className="text-base sm:text-lg font-black text-[#546E7A] tracking-wide">
                  Show Ping & FPS Overlay
                </span>
                <NativeSwitch
                  checked={settings.showFps}
                  onChange={(val) => updateSetting('showFps', val)}
                />
              </div>
            </div>
          </section>

          {/* ================= SECTION: ACCOUNT ================= */}
          <section className="pb-6">
            <h2 className="text-lg sm:text-xl font-black text-white drop-shadow-xs tracking-tight mb-2.5 px-1">
              Account
            </h2>

            <div className="w-full bg-white/90 border border-[#CBD5E1] rounded-xl sm:rounded-2xl p-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500 text-white flex items-center justify-center font-black shadow-xs">
                  <User size={22} />
                </div>
                <div>
                  <div className="text-base font-black text-slate-800">
                    {settings.nickname || 'Guest Player'}
                  </div>
                  <div className="text-xs font-bold text-slate-500">
                    Level 15 • Unlocked Rank 30
                  </div>
                </div>
              </div>

              <ModActionButton
                label="Logout"
                variant="red"
                onClick={() => setShowLogoutConfirm(true)}
              />
            </div>
          </section>

        </div>
      </main>

      {/* ================= HELP POPUP DIALOG ================= */}
      <AnimatePresence>
        {activeHelp && (
          <div 
            className="fixed inset-0 z-60 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setActiveHelp(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-2xl p-5 border-2 border-slate-300 shadow-2xl flex flex-col items-center text-center space-y-3"
            >
              <div className="w-10 h-10 rounded-full bg-[#00BCD4] text-white flex items-center justify-center font-black text-xl shadow-xs">
                ?
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">
                {activeHelp.title}
              </h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                {activeHelp.desc}
              </p>
              <TouchSafeButton
                onClick={() => setActiveHelp(null)}
                className="w-full py-2.5 rounded-xl bg-[#00BCD4] border-b-3 border-[#0097A7] text-white font-black uppercase text-sm tracking-wider shadow-sm cursor-pointer select-none hud-tap mt-1"
              >
                OK
              </TouchSafeButton>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= LOGOUT CONFIRM DIALOG ================= */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div 
            className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-2xl p-5 border-2 border-red-300 shadow-2xl flex flex-col items-center text-center space-y-3"
            >
              <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-black shadow-xs">
                <LogOut size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">
                Confirm Logout
              </h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Are you sure you want to log out and reset your guest session data?
              </p>
              <div className="flex gap-2 w-full pt-1">
                <TouchSafeButton
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-200 border-b-3 border-slate-300 text-slate-700 font-black uppercase text-xs tracking-wider cursor-pointer select-none hud-tap"
                >
                  Cancel
                </TouchSafeButton>
                <TouchSafeButton
                  onClick={handleConfirmLogout}
                  className="flex-1 py-2.5 rounded-xl bg-[#E53935] border-b-3 border-[#B71C1C] text-white font-black uppercase text-xs tracking-wider shadow-sm cursor-pointer select-none hud-tap"
                >
                  Logout
                </TouchSafeButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= TOAST NOTIFICATION ================= */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-70 bg-slate-900/95 text-white px-5 py-2.5 rounded-full shadow-2xl border border-slate-700 text-xs sm:text-sm font-bold tracking-wide flex items-center gap-2 pointer-events-none"
          >
            <Check size={16} className="text-[#5CB811]" strokeWidth={3} />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ================= MOD ACTION BUTTON COMPONENT =================
interface ModActionButtonProps {
  label: string;
  active?: boolean;
  variant?: 'toggle' | 'red' | 'cyan';
  onClick?: () => void;
}

function ModActionButton({
  label,
  active = false,
  variant = 'toggle',
  onClick
}: ModActionButtonProps) {
  let styleClasses = '';

  if (variant === 'red') {
    // Red Reset Button
    styleClasses = 'bg-[#E53935] border-b-[3px] border-[#B71C1C] text-white shadow-xs';
  } else if (variant === 'cyan') {
    // Cyan Action Button
    styleClasses = 'bg-[#00BCD4] border-b-[3px] border-[#00838F] text-white shadow-xs';
  } else {
    // Toggle Button: Green when ON, Gray when OFF
    if (active) {
      styleClasses = 'bg-[#5CB811] border-b-[3px] border-[#3E8509] text-white shadow-xs';
    } else {
      styleClasses = 'bg-[#94A3B8] border-b-[3px] border-[#6E7C8F] text-white shadow-xs';
    }
  }

  // Parse newlines in label for two-line text
  const lines = label.split('\n');

  return (
    <TouchSafeButton
      onClick={onClick}
      className={`h-11 sm:h-12 min-w-[72px] sm:min-w-[84px] px-2.5 sm:px-3 rounded-lg sm:rounded-xl flex flex-col items-center justify-center cursor-pointer select-none hud-tap ${styleClasses}`}
    >
      {lines.map((line, idx) => (
        <span
          key={idx}
          className="text-[10.5px] sm:text-[11.5px] font-black uppercase leading-tight tracking-wider text-center drop-shadow-2xs pointer-events-none whitespace-nowrap"
        >
          {line}
        </span>
      ))}
    </TouchSafeButton>
  );
}

// ================= CUSTOM NATIVE SWITCH COMPONENT =================
function NativeSwitch({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <TouchSafeButton
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-13 h-7 sm:w-14 sm:h-7.5 rounded-full p-0.5 transition-colors duration-200 border-2 flex items-center cursor-pointer select-none shrink-0 hud-tap ${
        disabled
          ? 'opacity-40 cursor-not-allowed bg-slate-300 border-slate-400'
          : checked
            ? 'bg-[#5CB811] border-[#489907]'
            : 'bg-[#94A3B8] border-[#788899]'
      }`}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-white shadow-md border border-slate-200/80 pointer-events-none ${
          checked ? 'ml-auto' : 'mr-auto'
        }`}
      />
    </TouchSafeButton>
  );
}
