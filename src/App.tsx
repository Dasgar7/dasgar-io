import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { MainMenu } from './components/MainMenu';
import { GameScreen } from './components/GameScreen';
import { SkinsMenu } from './components/SkinsMenu';
import { SettingsPage } from './components/SettingsPage';
import { SeasonsPage } from './components/SeasonsPage';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'game' | 'skins' | 'settings' | 'seasons'>('menu');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [gameMode, setGameMode] = useState<'classic' | 'bots' | 'instantMerge'>('classic');

  useEffect(() => {
    const preventDrag = (e: Event) => e.preventDefault();
    const preventContextMenu = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };
    document.addEventListener('dragstart', preventDrag, false);
    window.addEventListener('contextmenu', preventContextMenu, { passive: false });
    return () => {
      document.removeEventListener('dragstart', preventDrag, false);
      window.removeEventListener('contextmenu', preventContextMenu);
    };
  }, []);

  return (
    <>
      <style>{`
        * {
          -webkit-user-drag: none !important;
          user-drag: none !important;
        }
        html, body, #root, * {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -khtml-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-user-drag: none !important;
          user-drag: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        input, textarea {
          -webkit-touch-callout: default !important;
          -webkit-user-select: auto !important;
          -khtml-user-select: auto !important;
          -moz-user-select: auto !important;
          -ms-user-select: auto !important;
          user-select: auto !important;
          pointer-events: auto !important;
        }
        button, a, img, svg, div[role="button"] {
          -webkit-user-drag: none !important;
          user-drag: none !important;
          touch-action: manipulation !important;
        }
        img, svg, svg * {
          pointer-events: none !important;
          -webkit-user-drag: none !important;
          user-drag: none !important;
          -webkit-touch-callout: none !important;
          user-select: none !important;
        }
        [role="button"] > *, button > * {
          pointer-events: none !important;
          -webkit-user-drag: none !important;
          user-drag: none !important;
          -webkit-touch-callout: none !important;
          user-select: none !important;
        }
        html, body {
          overflow-x: hidden !important;
          overflow-y: hidden !important;
          position: fixed !important;
          width: 100% !important;
          height: 100% !important;
          touch-action: manipulation !important;
          overscroll-behavior: none !important;
        }
        #root {
          overflow-x: hidden !important;
          overflow-y: hidden !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
      <div 
        className="relative w-full h-full bg-gray-900 text-white font-sans overflow-hidden select-none" 
        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
      >
        {currentScreen === 'menu' && (
          <MainMenu 
            onPlay={(mode = 'classic') => {
              setGameMode(mode);
              setCurrentScreen('game');
            }} 
            onSkins={() => setCurrentScreen('skins')}
            onSettings={() => setIsSettingsOpen(true)}
            onSeason={() => setCurrentScreen('seasons')}
          />
        )}
        {currentScreen === 'game' && (
          <GameScreen 
            mode={gameMode}
            onBack={() => setCurrentScreen('menu')} 
          />
        )}
        {currentScreen === 'skins' && (
          <SkinsMenu onBack={() => setCurrentScreen('menu')} />
        )}
        {currentScreen === 'seasons' && (
          <SeasonsPage 
            onBack={() => setCurrentScreen('menu')}
            onOpenShop={() => setCurrentScreen('skins')}
          />
        )}

        <AnimatePresence>
          {(isSettingsOpen || currentScreen === 'settings') && (
            <SettingsPage 
              onBack={() => {
                setIsSettingsOpen(false);
                if (currentScreen === 'settings') {
                  setCurrentScreen('menu');
                }
              }} 
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

