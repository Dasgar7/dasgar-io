import { Cell } from './Cell';
import { FoodPellet } from './Food';
import { Virus } from './Virus';
import { Player } from './Player';
import { WORLD, FOOD, VIRUS, PHYSICS, dist } from '../../../shared/src/index';

export class GameWorld {
  players = new Map<string, Player>();
  foods: FoodPellet[] = [];
  viruses: Virus[] = [];
  tick = 0;
  ejectedMass: { x: number; y: number; vx: number; vy: number; mass: number; color: string; ownerId: string }[] = [];
  onKill?: (killer: Player, victim: Player) => void;

  constructor() {
    this.spawnFood(FOOD.COUNT);
    this.spawnViruses(VIRUS.COUNT);
  }
  spawnFood(count: number) {
    for (let i = 0; i < count; i++)
      this.foods.push(new FoodPellet(Math.random() * WORLD.WIDTH, Math.random() * WORLD.HEIGHT));
  }
  spawnViruses(count: number) {
    for (let i = 0; i < count; i++)
      this.viruses.push(new Virus(500 + Math.random() * (WORLD.WIDTH - 1000), 500 + Math.random() * (WORLD.HEIGHT - 1000)));
  }
  addPlayer(player: Player) {
    player.spawn(1000 + Math.random() * (WORLD.WIDTH - 2000), 1000 + Math.random() * (WORLD.HEIGHT - 2000));
    this.players.set(player.id, player);
  }
  removePlayer(id: string) { this.players.delete(id); }

  update(dt: number) {
    this.tick++;
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      for (const cell of player.cells) cell.update(dt, player.targetX, player.targetY);
      this.tryMerge(player);
    }
    for (let i = this.ejectedMass.length - 1; i >= 0; i--) {
      const e = this.ejectedMass[i];
      e.x += e.vx; e.y += e.vy; e.vx *= 0.95; e.vy *= 0.95;
      if (Math.abs(e.vx) < 0.1 && Math.abs(e.vy) < 0.1) {
        this.foods.push(new FoodPellet(e.x, e.y, e.color));
        this.ejectedMass.splice(i, 1);
      }
    }
    this.handleFoodCollisions();
    this.handleCellCollisions();
    this.handleVirusCollisions();
    if (this.foods.length < FOOD.COUNT * 0.7) this.spawnFood(Math.floor(FOOD.COUNT * 0.15));
  }

  tryMerge(player: Player) {
    const cells = player.cells;
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i], b = cells[j];
        if (!a.canMerge() || !b.canMerge()) continue;
        if (dist(a, b) < Math.max(a.radius, b.radius) * 0.6) {
          if (a.mass >= b.mass) { a.mass += b.mass; a.vx = (a.vx+b.vx)*0.5; a.vy = (a.vy+b.vy)*0.5; cells.splice(j,1); j--; }
          else { b.mass += a.mass; b.vx = (a.vx+b.vx)*0.5; b.vy = (a.vy+b.vy)*0.5; cells.splice(i,1); i--; break; }
        }
      }
    }
  }

  handleFoodCollisions() {
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      for (const cell of player.cells) {
        for (let i = this.foods.length - 1; i >= 0; i--) {
          if (dist(cell, this.foods[i]) < cell.radius + 4) {
            cell.mass += this.foods[i].mass; player.score += this.foods[i].mass; this.foods.splice(i, 1);
          }
        }
        for (let i = this.ejectedMass.length - 1; i >= 0; i--) {
          if (dist(cell, this.ejectedMass[i]) < cell.radius) {
            cell.mass += this.ejectedMass[i].mass; player.score += this.ejectedMass[i].mass; this.ejectedMass.splice(i, 1);
          }
        }
      }
    }
  }

  handleCellCollisions() {
    const all: { cell: Cell; player: Player }[] = [];
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const c of p.cells) all.push({ cell: c, player: p });
    }
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const A = all[i], B = all[j];
        if (A.player.id === B.player.id) continue;
        const bigger = A.cell.mass >= B.cell.mass ? A : B;
        const smaller = bigger === A ? B : A;
        if (bigger.cell.mass < smaller.cell.mass * PHYSICS.EAT_RATIO) continue;
        if (dist(A.cell, B.cell) >= bigger.cell.radius - smaller.cell.radius * 0.3) continue;
        bigger.cell.mass += smaller.cell.mass; bigger.player.score += smaller.cell.mass; bigger.player.kills++;
        smaller.player.removeCell(smaller.cell);
        this.onKill?.(bigger.player, smaller.player);
      }
    }
  }

  handleVirusCollisions() {
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      for (const cell of [...player.cells]) {
        for (const virus of this.viruses) {
          if (dist(cell, virus) >= cell.radius + virus.radius * 0.5) continue;
          if (cell.mass > virus.mass * 1.1) this.popCell(player, cell, virus);
        }
      }
    }
    for (let i = this.ejectedMass.length - 1; i >= 0; i--) {
      const e = this.ejectedMass[i];
      for (const virus of this.viruses) {
        if (dist(e, virus) < virus.radius + 10) {
          virus.mass += e.mass; this.ejectedMass.splice(i, 1);
          if (virus.mass >= PHYSICS.VIRUS_MAX_MASS) {
            virus.mass = PHYSICS.VIRUS_MASS;
            const angle = Math.random() * Math.PI * 2;
            const nv = new Virus(virus.x + Math.cos(angle)*80, virus.y + Math.sin(angle)*80);
            this.viruses.push(nv);
          }
          break;
        }
      }
    }
  }

  popCell(player: Player, cell: Cell, _virus: Virus) {
    const pieces = Math.min(16, Math.floor(cell.mass / 20));
    const pieceMass = cell.mass / pieces;
    player.removeCell(cell);
    for (let i = 0; i < pieces; i++) {
      const angle = (Math.PI * 2 * i) / pieces + Math.random() * 0.3;
      const nc = new Cell(player.id, cell.x + Math.cos(angle)*30, cell.y + Math.sin(angle)*30,
        pieceMass, player.color, player.name, PHYSICS.MERGE_TIME);
      nc.vx = Math.cos(angle) * PHYSICS.SPLIT_SPEED * 0.7;
      nc.vy = Math.sin(angle) * PHYSICS.SPLIT_SPEED * 0.7;
      nc.boostTimer = 0.5;
      player.cells.push(nc);
    }
  }

  doSplit(id: string) { const p = this.players.get(id); if (p?.alive) p.split(); }
  doEject(id: string) {
    const p = this.players.get(id); if (!p?.alive) return;
    for (const cell of p.cells) {
      if (cell.mass < PHYSICS.MIN_EJECT_MASS) continue;
      cell.mass -= PHYSICS.EJECT_MASS;
      const dx = p.targetX - cell.x, dy = p.targetY - cell.y;
      const d = Math.sqrt(dx*dx+dy*dy) || 1;
      this.ejectedMass.push({
        x: cell.x + (dx/d)*cell.radius, y: cell.y + (dy/d)*cell.radius,
        vx: (dx/d)*PHYSICS.EJECT_SPEED, vy: (dy/d)*PHYSICS.EJECT_SPEED,
        mass: PHYSICS.EJECT_MASS * 0.8, color: cell.color, ownerId: id,
      });
    }
  }

  getLeaderboard(limit = 10) {
    return [...this.players.values()].filter(p => p.alive).sort((a,b) => b.totalMass - a.totalMass)
      .slice(0, limit).map(p => ({ id: p.id, name: p.name, mass: Math.round(p.totalMass) }));
  }
  getSnapshot() {
    const cells = [];
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const c of p.cells) cells.push(c.toData());
    }
    return {
      tick: this.tick, cells, foods: this.foods.map(f => f.toData()),
      viruses: this.viruses.map(v => v.toData()),
      playersAlive: [...this.players.values()].filter(p => p.alive).length,
    };
  }
}
