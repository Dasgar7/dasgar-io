import { Player } from '../entities/Player';
import { Cell } from '../entities/Cell';
import { FoodPellet } from '../entities/Food';
import { Virus } from '../entities/Virus';
import { WORLD, PHYSICS, dist, randRange } from '../utils/constants';

/**
 * Local AI that drives a Player the same way a remote client would set targets.
 * Future multiplayer can swap this for network input without changing Player/World.
 */
export class BotController {
  private wanderTx = 0;
  private wanderTy = 0;
  private nextWander = 0;
  private thinkTimer = 0;

  constructor(private player: Player) {
    this.pickWander();
  }

  private pickWander() {
    this.wanderTx = randRange(400, WORLD.WIDTH - 400);
    this.wanderTy = randRange(400, WORLD.HEIGHT - 400);
    this.nextWander = performance.now() + 2000 + Math.random() * 4000;
  }

  update(
    dt: number,
    nearbyCells: { cell: Cell; player: Player }[],
    nearbyFood: FoodPellet[],
    nearbyViruses: Virus[]
  ) {
    if (!this.player.alive || !this.player.cells.length) return;

    this.thinkTimer -= dt;
    const center = this.player.center;
    const myMass = this.player.totalMass;

    let bestThreat: { cell: Cell; d: number } | null = null;
    let bestPrey: { cell: Cell; d: number } | null = null;

    for (const { cell, player } of nearbyCells) {
      if (player.id === this.player.id) continue;
      const d = dist(center.x, center.y, cell.x, cell.y);
      if (cell.mass * PHYSICS.EAT_RATIO > myMass && d < 500 + cell.radius) {
        if (!bestThreat || d < bestThreat.d) bestThreat = { cell, d };
      } else if (myMass > cell.mass * PHYSICS.EAT_RATIO && d < 600) {
        if (!bestPrey || d < bestPrey.d) bestPrey = { cell, d };
      }
    }

    let bestFood: FoodPellet | null = null;
    let bestFoodD = Infinity;
    for (const f of nearbyFood) {
      const d = dist(center.x, center.y, f.x, f.y);
      if (d < bestFoodD) {
        bestFoodD = d;
        bestFood = f;
      }
    }

    let virusThreat: Virus | null = null;
    if (myMass > 80) {
      for (const v of nearbyViruses) {
        const d = dist(center.x, center.y, v.x, v.y);
        if (d < v.radius + 80 + this.player.cells[0].radius) {
          virusThreat = v;
          break;
        }
      }
    }

    let tx = this.wanderTx;
    let ty = this.wanderTy;

    if (bestThreat && Math.random() < 0.4 + this.player.caution * 0.5) {
      const dx = center.x - bestThreat.cell.x;
      const dy = center.y - bestThreat.cell.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      tx = center.x + (dx / d) * 800;
      ty = center.y + (dy / d) * 800;
    } else if (bestPrey && Math.random() < 0.35 + this.player.aggression * 0.5) {
      tx = bestPrey.cell.x;
      ty = bestPrey.cell.y;
      if (
        bestPrey.d < 280 &&
        myMass > bestPrey.cell.mass * 2.2 &&
        myMass > PHYSICS.MIN_SPLIT_MASS * 2 &&
        Math.random() < this.player.splitChance * 0.04
      ) {
        this.player.split();
      }
    } else if (bestFood) {
      tx = bestFood.x;
      ty = bestFood.y;
    } else if (performance.now() > this.nextWander) {
      this.pickWander();
      tx = this.wanderTx;
      ty = this.wanderTy;
    }

    if (virusThreat) {
      const dx = center.x - virusThreat.x;
      const dy = center.y - virusThreat.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      tx = center.x + (dx / d) * 400;
      ty = center.y + (dy / d) * 400;
    }

    this.player.targetX = Math.max(50, Math.min(WORLD.WIDTH - 50, tx));
    this.player.targetY = Math.max(50, Math.min(WORLD.HEIGHT - 50, ty));
  }
}
