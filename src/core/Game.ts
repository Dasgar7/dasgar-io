import { World } from './World';
import { Renderer } from '../render/Renderer';
import { InputManager } from '../input/InputManager';
import { HUD } from '../ui/HUD';
import { BOTS } from '../utils/constants';

export class Game {
  private canvas: HTMLCanvasElement;
  private world: World;
  private renderer: Renderer;
  private input: InputManager;
  private hud: HUD;
  private running = false;
  private lastTime = 0;
  private fps = 60;
  private frameCount = 0;
  private fpsTimer = 0;
  private lbTimer = 0;
  private playerName = 'You';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.world = new World();
    this.renderer = new Renderer(canvas);

    this.input = new InputManager(canvas, {
      onSplit: () => { if (this.world.human?.alive) this.world.doSplit('human'); },
      onEject: () => { if (this.world.human?.alive) this.world.doEject('human'); },
      onMultiSplit: (n) => {
        for (let i = 0; i < n; i++) {
          setTimeout(() => { if (this.world.human?.alive) this.world.doSplit('human'); }, i * 55);
        }
      },
    });

    const uiRoot = document.getElementById('ui-root')!;
    this.hud = new HUD(uiRoot, {
      onSplit: () => this.world.doSplit('human'),
      onEject: () => this.world.doEject('human'),
      onMultiSplit: (n) => {
        for (let i = 0; i < n; i++) setTimeout(() => this.world.doSplit('human'), i * 55);
      },
      onJoystick: (dx, dy, active) => this.input.setJoystick(dx, dy, active),
      onRespawn: () => this.respawn(),
    });

    this.world.onKill = (e) => this.hud.toast(`${e.killer} ate ${e.victim}`);
    this.world.onDeath = (killer) => this.hud.showDeath(killer);
  }

  start(name: string) {
    this.playerName = name;
    this.world.spawnHuman(name);
    this.world.spawnBots(BOTS.COUNT);
    this.hud.show();
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private respawn() {
    if (this.world.human) this.world.players.delete('human');
    this.world.spawnHuman(this.playerName);
  }

  onResize() {}

  private loop(now: number) {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = this.frameCount / this.fpsTimer;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    const human = this.world.human;
    if (human?.alive) {
      const c = human.center;
      this.input.updateWorldMouse(c.x, c.y, this.renderer.zoom);
      human.targetX = this.input.worldMouseX;
      human.targetY = this.input.worldMouseY;
    }

    this.world.update(dt);

    if (human?.alive) {
      const c = human.center;
      this.renderer.setCamera(c.x, c.y, human.totalMass);
    }

    this.renderer.begin(dt);
    this.renderer.drawFood(this.world.foods);
    this.renderer.drawViruses(this.world.viruses);

    const drawList: { cell: import('../entities/Cell').Cell; isMe: boolean }[] = [];
    for (const p of this.world.players.values()) {
      if (!p.alive) continue;
      for (const cell of p.cells) drawList.push({ cell, isMe: p.isHuman });
    }
    this.renderer.drawCells(drawList);
    this.renderer.end();

    this.lbTimer += dt;
    if (this.lbTimer > 0.4) {
      this.lbTimer = 0;
      this.hud.updateLeaderboard(this.world.getLeaderboard(), 'human');
    }
    if (human) {
      const c = human.center;
      this.hud.updateStats(
        this.fps,
        human.alive ? human.totalMass : 0,
        this.world.aliveCount(),
        c.x,
        c.y
      );
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}
