import { Game } from './core/Game';
import { Menu } from './ui/Menu';
import './ui/styles.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;

const game = new Game(canvas);
const menu = new Menu(uiRoot, {
  onPlay: (name: string) => {
    menu.hide();
    game.start(name);
  },
});

menu.show();

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  game.onResize();
}
window.addEventListener('resize', resize);
resize();

(window as any).dasgar = { game, menu };
