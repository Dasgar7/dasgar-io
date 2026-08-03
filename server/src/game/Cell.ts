import { PHYSICS, massToRadius, speedFromMass, WORLD, clamp } from '../../../shared/src/index';
let nextCellId = 1;
export class Cell {
  id: number; ownerId: string; x: number; y: number; vx = 0; vy = 0;
  mass: number; color: string; name: string; mergeTimer = 0; boostTimer = 0;
  constructor(ownerId: string, x: number, y: number, mass: number, color: string, name: string, mergeDelay = 0) {
    this.id = nextCellId++; this.ownerId = ownerId; this.x = x; this.y = y;
    this.mass = mass; this.color = color; this.name = name; this.mergeTimer = mergeDelay;
  }
  get radius() { return massToRadius(this.mass); }
  get speed() { return speedFromMass(this.mass); }
  update(dt: number, targetX?: number, targetY?: number) {
    if (this.mergeTimer > 0) this.mergeTimer = Math.max(0, this.mergeTimer - dt * 1000);
    if (this.mass > PHYSICS.MASS_DECAY_THRESHOLD) this.mass *= Math.pow(PHYSICS.MASS_DECAY_RATE, dt * 20);
    if (targetX !== undefined && targetY !== undefined) {
      const dx = targetX - this.x, dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.vx += (dx / dist) * this.speed * 0.35;
      this.vy += (dy / dist) * this.speed * 0.35;
    }
    if (this.boostTimer > 0) this.boostTimer -= dt;
    else { this.vx *= PHYSICS.FRICTION; this.vy *= PHYSICS.FRICTION; }
    const maxV = this.boostTimer > 0 ? PHYSICS.SPLIT_SPEED : this.speed * 1.8;
    const v = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (v > maxV) { this.vx = (this.vx / v) * maxV; this.vy = (this.vy / v) * maxV; }
    this.x += this.vx; this.y += this.vy;
    const r = this.radius;
    this.x = clamp(this.x, r + WORLD.BORDER, WORLD.WIDTH - r - WORLD.BORDER);
    this.y = clamp(this.y, r + WORLD.BORDER, WORLD.HEIGHT - r - WORLD.BORDER);
  }
  canMerge() { return this.mergeTimer <= 0; }
  toData() {
    return { id: this.id, ownerId: this.ownerId, x: Math.round(this.x*10)/10, y: Math.round(this.y*10)/10,
      mass: Math.round(this.mass*10)/10, radius: Math.round(this.radius*10)/10, color: this.color,
      name: this.name, mergeTimer: Math.round(this.mergeTimer) };
  }
}
