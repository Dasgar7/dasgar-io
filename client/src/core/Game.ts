import { Network } from '../network/Network';
import { Renderer } from '../render/Renderer';
import { InputManager } from '../input/InputManager';
import { HUD } from '../ui/HUD';
import { MsgType, CellData, FoodData, VirusData, LeaderboardEntry } from '../../../shared/src/index';

interface InterpCell extends CellData { renderX: number; renderY: number; }

export class Game {
  private canvas: HTMLCanvasElement;
  private network: Network; private renderer: Renderer; private input: InputManager; private hud: HUD;
  private playerId = ''; private cells: InterpCell[] = []; private foods: FoodData[] = [];
  private viruses: VirusData[] = []; private leaderboard: LeaderboardEntry[] = [];
  private running = false; private seq = 0; private lastTime = 0; private fps = 60;
  private frameCount = 0; private fpsTimer = 0; private myMass = 10; private myX = 0; private myY = 0;
  private playerName = 'Cell';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.network = new Network();
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas, {
      onSplit: () => this.network.split(),
      onEject: () => this.network.eject(),
      onMultiSplit: (n) => { for (let i = 0; i < n; i++) setTimeout(() => this.network.split(), i * 50); },
    });
    const uiRoot = document.getElementById('ui-root')!;
    this.hud = new HUD(uiRoot, {
      onSplit: () => this.network.split(),
      onEject: () => this.network.eject(),
      onMultiSplit: (n) => { for (let i = 0; i < n; i++) setTimeout(() => this.network.split(), i * 50); },
      onJoystick: (dx, dy, active) => this.input.setJoystick(dx, dy, active),
      onRespawn: () => this.respawn(),
    });
    this.network.onMessage(msg => this.onMessage(msg));
  }
  start(name: string) {
    this.playerName = name;
    this.network.connect();
    const tryJoin = () => {
      if (this.network.connected) {
        this.network.join(name); this.hud.show(); this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame(t => this.loop(t));
      } else setTimeout(tryJoin, 100);
    };
    tryJoin();
  }
  private respawn() { this.network.join(this.playerName); }
  onResize() {}
  private onMessage(msg: any) {
    switch (msg.type) {
      case MsgType.WELCOME: this.playerId = msg.playerId; break;
      case MsgType.STATE: this.applyState(msg); break;
      case MsgType.LEADERBOARD:
        this.leaderboard = msg.entries || [];
        this.hud.updateLeaderboard(this.leaderboard, this.playerId); break;
      case MsgType.KILL: this.hud.toast(`${msg.killer} ate ${msg.victim}`); break;
      case MsgType.DEATH: this.hud.showDeath(msg.killer); break;
    }
  }
  private applyState(msg: any) {
    const prev = new Map(this.cells.map(c => [c.id, c]));
    this.cells = (msg.cells as CellData[]).map(c => {
      const old = prev.get(c.id);
      return { ...c, renderX: old ? old.renderX : c.x, renderY: old ? old.renderY : c.y };
    });
    this.foods = msg.foods || []; this.viruses = msg.viruses || [];
    const mine = this.cells.filter(c => c.ownerId === this.playerId);
    if (mine.length) {
      let mx = 0, my = 0, m = 0;
      for (const c of mine) { mx += c.x * c.mass; my += c.y * c.mass; m += c.mass; }
      this.myX = mx / m; this.myY = my / m; this.myMass = m;
    }
  }
  private loop(now: number) {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.frameCount++; this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) { this.fps = this.frameCount / this.fpsTimer; this.frameCount = 0; this.fpsTimer = 0; }
    for (const c of this.cells) {
      c.renderX += (c.x - c.renderX) * Math.min(1, dt * 18);
      c.renderY += (c.y - c.renderY) * Math.min(1, dt * 18);
    }
    this.input.updateWorldMouse(this.myX, this.myY, this.renderer.zoom);
    this.seq++;
    if (this.seq % 2 === 0) this.network.sendInput(this.input.worldMouseX, this.input.worldMouseY, this.seq);
    this.renderer.setCamera(this.myX, this.myY, this.myMass);
    this.renderer.begin(dt);
    this.renderer.drawFood(this.foods);
    this.renderer.drawViruses(this.viruses);
    this.renderer.drawCells(this.cells.map(c => ({ ...c, x: c.renderX, y: c.renderY })), this.playerId);
    this.renderer.end();
    this.hud.updateStats(this.fps, this.network.latency, this.myMass, this.myX, this.myY);
    requestAnimationFrame(t => this.loop(t));
  }
}
