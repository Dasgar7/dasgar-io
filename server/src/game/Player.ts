import { Cell } from './Cell';
import { PHYSICS, PLAYER_COLORS } from '../../../shared/src/index';
export class Player {
  id: string; name: string; color: string; skin?: string; cells: Cell[] = [];
  targetX = 0; targetY = 0; score = 0; kills = 0; alive = true; lastInputSeq = 0;
  joinTime = Date.now(); ws: any;
  constructor(id: string, name: string, ws: any, color?: string) {
    this.id = id; this.name = name.slice(0, 16) || 'Cell';
    this.color = color || PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
    this.ws = ws;
  }
  get totalMass() { return this.cells.reduce((s, c) => s + c.mass, 0); }
  get center() {
    if (!this.cells.length) return { x: 0, y: 0 };
    let mx = 0, my = 0, m = 0;
    for (const c of this.cells) { mx += c.x * c.mass; my += c.y * c.mass; m += c.mass; }
    return { x: mx / m, y: my / m };
  }
  spawn(x: number, y: number) {
    this.cells = [new Cell(this.id, x, y, 10, this.color, this.name)];
    this.alive = true; this.score = 10;
  }
  split() {
    const newCells: Cell[] = [];
    for (const cell of this.cells) {
      if (cell.mass < PHYSICS.MIN_SPLIT_MASS) continue;
      if (this.cells.length + newCells.length >= 16) break;
      const half = cell.mass / 2; cell.mass = half;
      const dx = this.targetX - cell.x, dy = this.targetY - cell.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist, ny = dy / dist;
      const child = new Cell(this.id, cell.x + nx * cell.radius * 0.5, cell.y + ny * cell.radius * 0.5,
        half, this.color, this.name, PHYSICS.MERGE_TIME);
      child.vx = nx * PHYSICS.SPLIT_SPEED; child.vy = ny * PHYSICS.SPLIT_SPEED;
      child.boostTimer = 0.6; cell.mergeTimer = PHYSICS.MERGE_TIME;
      newCells.push(child);
    }
    this.cells.push(...newCells);
  }
  removeCell(cell: Cell) {
    this.cells = this.cells.filter(c => c.id !== cell.id);
    if (!this.cells.length) this.alive = false;
  }
}
