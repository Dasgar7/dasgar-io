import { Cell } from '../entities/Cell';
import { FoodPellet } from '../entities/Food';
import { Virus } from '../entities/Virus';
import { Player } from '../entities/Player';
import { BotController } from '../ai/BotController';
import { SpatialGrid } from './SpatialGrid';
import {
  WORLD, FOOD, VIRUS, PHYSICS, BOTS, BOT_NAMES, PLAYER_COLORS,
  dist, pick, randRange,
} from '../utils/constants';

export interface KillEvent { killer: string; victim: string; }

export class World {
  players = new Map<string, Player>();
  foods: FoodPellet[] = [];
  viruses: Virus[] = [];
  ejected: { x: number; y: number; vx: number; vy: number; mass: number; color: string; ownerId: string }[] = [];
  human: Player | null = null;
  bots = new Map<string, BotController>();
  private cellGrid = new SpatialGrid<{ id: number; x: number; y: number; radius: number; cell: Cell; player: Player }>(WORLD.WIDTH, WORLD.HEIGHT, 150);
  private foodGrid = new SpatialGrid<FoodPellet & { radius: number }>(WORLD.WIDTH, WORLD.HEIGHT, 100);
  onKill?: (e: KillEvent) => void;
  onDeath?: (name: string) => void;
  private botId = 0;

  constructor() {
    this.spawnFood(FOOD.COUNT);
    this.spawnViruses(VIRUS.COUNT);
  }

  spawnHuman(name: string): Player {
    const p = new Player('human', name || 'You', { isHuman: true, color: '#4ade80' });
    p.spawn(randRange(1500, WORLD.WIDTH - 1500), randRange(1500, WORLD.HEIGHT - 1500), 14);
    this.players.set(p.id, p);
    this.human = p;
    return p;
  }

  spawnBots(count = BOTS.COUNT) {
    for (let i = 0; i < count; i++) this.addBot();
  }

  private addBot() {
    const id = `bot-${this.botId++}`;
    const name = pick(BOT_NAMES) + (Math.random() > 0.7 ? String(Math.floor(Math.random() * 99)) : '');
    const p = new Player(id, name, { isBot: true, color: pick(PLAYER_COLORS) });
    p.spawn(randRange(300, WORLD.WIDTH - 300), randRange(300, WORLD.HEIGHT - 300), 10 + Math.random() * 20);
    this.players.set(id, p);
    this.bots.set(id, new BotController(p));
  }

  private respawnBot(p: Player) {
    p.color = pick(PLAYER_COLORS);
    p.name = pick(BOT_NAMES) + (Math.random() > 0.6 ? String(Math.floor(Math.random() * 99)) : '');
    p.spawn(randRange(300, WORLD.WIDTH - 300), randRange(300, WORLD.HEIGHT - 300), 10 + Math.random() * 15);
    p.kills = 0;
    this.bots.set(p.id, new BotController(p));
  }

  spawnFood(count: number) {
    for (let i = 0; i < count; i++) {
      this.foods.push(FoodPellet.acquire(Math.random() * WORLD.WIDTH, Math.random() * WORLD.HEIGHT));
    }
  }

  spawnViruses(count: number) {
    for (let i = 0; i < count; i++) {
      this.viruses.push(new Virus(randRange(600, WORLD.WIDTH - 600), randRange(600, WORLD.HEIGHT - 600)));
    }
  }

  update(dt: number) {
    this.cellGrid.clear();
    this.foodGrid.clear();

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const c of p.cells) {
        this.cellGrid.insert({ id: c.id, x: c.x, y: c.y, radius: c.radius, cell: c, player: p });
      }
    }
    for (const f of this.foods) {
      if (!f.alive) continue;
      (f as any).radius = 6;
      this.foodGrid.insert(f as FoodPellet & { radius: number });
    }

    for (const [id, bot] of this.bots) {
      const p = this.players.get(id);
      if (!p || !p.alive) continue;
      const center = p.center;
      const nearCells = this.cellGrid.queryRadius(center.x, center.y, 700).map((i) => ({ cell: i.cell, player: i.player }));
      const nearFood = this.foodGrid.queryRadius(center.x, center.y, 450) as FoodPellet[];
      const nearViruses = this.viruses.filter((v) => dist(center.x, center.y, v.x, v.y) < 400);
      bot.update(dt, nearCells, nearFood, nearViruses);
    }

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const c of p.cells) c.update(dt, p.targetX, p.targetY);
      this.tryMerge(p);
    }

    for (let i = this.ejected.length - 1; i >= 0; i--) {
      const e = this.ejected[i];
      e.x += e.vx; e.y += e.vy; e.vx *= 0.94; e.vy *= 0.94;
      if (Math.abs(e.vx) < 0.15 && Math.abs(e.vy) < 0.15) {
        this.foods.push(FoodPellet.acquire(e.x, e.y, e.color));
        this.ejected.splice(i, 1);
      }
    }

    this.handleFood();
    this.handleCells();
    this.handleViruses();

    for (const p of this.players.values()) {
      if (p.isBot && !p.alive) {
        if (!p.respawnAt) p.respawnAt = performance.now() + BOTS.RESPAWN_DELAY;
        if (performance.now() >= p.respawnAt) {
          p.respawnAt = 0;
          this.respawnBot(p);
        }
      }
    }

    if (this.foods.length < FOOD.COUNT * 0.65) {
      this.spawnFood(Math.floor(FOOD.COUNT * 0.2));
    }
  }

  private tryMerge(player: Player) {
    const cells = player.cells;
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i], b = cells[j];
        if (!a.canMerge() || !b.canMerge()) continue;
        if (dist(a.x, a.y, b.x, b.y) < Math.max(a.radius, b.radius) * 0.55) {
          if (a.mass >= b.mass) {
            a.mass += b.mass; a.vx = (a.vx + b.vx) * 0.5; a.vy = (a.vy + b.vy) * 0.5;
            cells.splice(j, 1); j--;
          } else {
            b.mass += a.mass; b.vx = (a.vx + b.vx) * 0.5; b.vy = (a.vy + b.vy) * 0.5;
            cells.splice(i, 1); i--; break;
          }
        }
      }
    }
  }

  private handleFood() {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const cell of p.cells) {
        const near = this.foodGrid.queryRadius(cell.x, cell.y, cell.radius + 20);
        for (const f of near) {
          if (!f.alive) continue;
          if (dist(cell.x, cell.y, f.x, f.y) < cell.radius + 5) {
            cell.mass += f.mass; p.score += f.mass;
            f.release();
            const idx = this.foods.indexOf(f);
            if (idx >= 0) this.foods.splice(idx, 1);
          }
        }
        for (let i = this.ejected.length - 1; i >= 0; i--) {
          const e = this.ejected[i];
          if (dist(cell.x, cell.y, e.x, e.y) < cell.radius) {
            cell.mass += e.mass; p.score += e.mass;
            this.ejected.splice(i, 1);
          }
        }
      }
    }
  }

  private handleCells() {
    const all: { cell: Cell; player: Player }[] = [];
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const c of p.cells) all.push({ cell: c, player: p });
    }
    for (let i = 0; i < all.length; i++) {
      const A = all[i];
      const candidates = this.cellGrid.queryRadius(A.cell.x, A.cell.y, A.cell.radius + 200);
      for (const item of candidates) {
        if (item.cell.id <= A.cell.id) continue;
        if (item.player.id === A.player.id) continue;
        const B = { cell: item.cell, player: item.player };
        const bigger = A.cell.mass >= B.cell.mass ? A : B;
        const smaller = bigger === A ? B : A;
        if (bigger.cell.mass < smaller.cell.mass * PHYSICS.EAT_RATIO) continue;
        const d = dist(A.cell.x, A.cell.y, B.cell.x, B.cell.y);
        if (d >= bigger.cell.radius - smaller.cell.radius * 0.25) continue;
        bigger.cell.mass += smaller.cell.mass;
        bigger.player.score += smaller.cell.mass;
        bigger.player.kills++;
        const victimName = smaller.player.name;
        const wasAlive = smaller.player.alive;
        smaller.player.removeCell(smaller.cell);
        if (wasAlive && !smaller.player.alive) {
          this.onKill?.({ killer: bigger.player.name, victim: victimName });
          if (smaller.player.isHuman) this.onDeath?.(bigger.player.name);
        }
      }
    }
  }

  private handleViruses() {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const cell of [...p.cells]) {
        for (const virus of this.viruses) {
          if (dist(cell.x, cell.y, virus.x, virus.y) >= cell.radius + virus.radius * 0.45) continue;
          if (cell.mass > virus.mass * 1.15) this.popCell(p, cell);
        }
      }
    }
    for (let i = this.ejected.length - 1; i >= 0; i--) {
      const e = this.ejected[i];
      for (const virus of this.viruses) {
        if (dist(e.x, e.y, virus.x, virus.y) < virus.radius + 12) {
          virus.mass += e.mass;
          this.ejected.splice(i, 1);
          if (virus.mass >= PHYSICS.VIRUS_MAX_MASS) {
            virus.mass = PHYSICS.VIRUS_MASS;
            const angle = Math.random() * Math.PI * 2;
            this.viruses.push(new Virus(virus.x + Math.cos(angle) * 90, virus.y + Math.sin(angle) * 90));
          }
          break;
        }
      }
    }
  }

  private popCell(player: Player, cell: Cell) {
    const pieces = Math.min(16, Math.max(4, Math.floor(cell.mass / 22)));
    const pieceMass = cell.mass / pieces;
    player.removeCell(cell);
    for (let i = 0; i < pieces; i++) {
      const angle = (Math.PI * 2 * i) / pieces + Math.random() * 0.25;
      const nc = new Cell(player.id, cell.x + Math.cos(angle) * 28, cell.y + Math.sin(angle) * 28, pieceMass, player.color, player.name, PHYSICS.MERGE_TIME);
      nc.vx = Math.cos(angle) * PHYSICS.SPLIT_SPEED * 0.65;
      nc.vy = Math.sin(angle) * PHYSICS.SPLIT_SPEED * 0.65;
      nc.boostTimer = 0.45;
      player.cells.push(nc);
    }
  }

  doSplit(playerId: string) { this.players.get(playerId)?.split(); }

  doEject(playerId: string) {
    const p = this.players.get(playerId);
    if (!p?.alive) return;
    for (const cell of p.cells) {
      if (cell.mass < PHYSICS.MIN_EJECT_MASS) continue;
      cell.mass -= PHYSICS.EJECT_MASS;
      const dx = p.targetX - cell.x, dy = p.targetY - cell.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      this.ejected.push({
        x: cell.x + (dx / d) * cell.radius, y: cell.y + (dy / d) * cell.radius,
        vx: (dx / d) * PHYSICS.EJECT_SPEED, vy: (dy / d) * PHYSICS.EJECT_SPEED,
        mass: PHYSICS.EJECT_MASS * 0.75, color: cell.color, ownerId: playerId,
      });
    }
  }

  getLeaderboard(limit = 10) {
    return [...this.players.values()].filter((p) => p.alive).sort((a, b) => b.totalMass - a.totalMass)
      .slice(0, limit).map((p) => ({ id: p.id, name: p.name, mass: Math.round(p.totalMass) }));
  }

  aliveCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.alive) n++;
    return n;
  }
}
