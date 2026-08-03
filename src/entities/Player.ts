import { Cell } from './Cell';
import { PHYSICS, PLAYER_COLORS, pick } from '../utils/constants';

/**
 * Unified player entity — used for both the human and AI bots.
 * Designed so a future network layer can own the same shape.
 */
export class Player {
  id: string;
  name: string;
  color: string;
  cells: Cell[] = [];
  targetX = 0;
  targetY = 0;
  score = 0;
  kills = 0;
  alive = true;
  isBot = false;
  isHuman = false;
  aggression = 0.5;
  caution = 0.5;
  splitChance = 0.3;
  lastSplitAt = 0;
  respawnAt = 0;

  constructor(id: string, name: string, opts?: { color?: string; isBot?: boolean; isHuman?: boolean }) {
    this.id = id;
    this.name = name.slice(0, 16) || 'Cell';
    this.color = opts?.color || pick(PLAYER_COLORS);
    this.isBot = opts?.isBot ?? false;
    this.isHuman = opts?.isHuman ?? false;
    if (this.isBot) {
      this.aggression = 0.25 + Math.random() * 0.6;
      this.caution = 0.2 + Math.random() * 0.6;
      this.splitChance = 0.15 + Math.random() * 0.4;
    }
  }

  get totalMass(): number {
    return this.cells.reduce((s, c) => s + c.mass, 0);
  }

  get center(): { x: number; y: number } {
    if (!this.cells.length) return { x: this.targetX, y: this.targetY };
    let mx = 0, my = 0, m = 0;
    for (const c of this.cells) {
      mx += c.x * c.mass;
      my += c.y * c.mass;
      m += c.mass;
    }
    return { x: mx / m, y: my / m };
  }

  spawn(x: number, y: number, mass = 12) {
    this.cells = [new Cell(this.id, x, y, mass, this.color, this.name)];
    this.alive = true;
    this.score = mass;
    this.targetX = x;
    this.targetY = y;
  }

  split() {
    const now = performance.now();
    if (now - this.lastSplitAt < 350) return;
    this.lastSplitAt = now;
    const newCells: Cell[] = [];
    for (const cell of this.cells) {
      if (cell.mass < PHYSICS.MIN_SPLIT_MASS) continue;
      if (this.cells.length + newCells.length >= PHYSICS.MAX_CELLS_PER_PLAYER) break;
      const half = cell.mass / 2;
      cell.mass = half;
      const dx = this.targetX - cell.x;
      const dy = this.targetY - cell.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      const child = new Cell(
        this.id,
        cell.x + nx * cell.radius * 0.4,
        cell.y + ny * cell.radius * 0.4,
        half,
        this.color,
        this.name,
        PHYSICS.MERGE_TIME
      );
      child.vx = nx * PHYSICS.SPLIT_SPEED;
      child.vy = ny * PHYSICS.SPLIT_SPEED;
      child.boostTimer = 0.55;
      cell.mergeTimer = PHYSICS.MERGE_TIME;
      newCells.push(child);
    }
    this.cells.push(...newCells);
  }

  removeCell(cell: Cell) {
    this.cells = this.cells.filter((c) => c.id !== cell.id);
    if (!this.cells.length) this.alive = false;
  }
}
