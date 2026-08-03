export const WORLD = { WIDTH: 10000, HEIGHT: 10000, BORDER: 50 } as const;
export const PHYSICS = {
  BASE_SPEED: 6.5, SPEED_MASS_FACTOR: 0.22, MIN_SPEED: 1.2, MAX_SPEED: 9,
  FRICTION: 0.92, SPLIT_SPEED: 28, SPLIT_COOLDOWN: 400, MERGE_TIME: 14000,
  MASS_DECAY_RATE: 0.998, MASS_DECAY_THRESHOLD: 100, FOOD_MASS: 1,
  VIRUS_MASS: 100, VIRUS_MAX_MASS: 180, EJECT_MASS: 12, EJECT_SPEED: 22,
  MIN_SPLIT_MASS: 36, MIN_EJECT_MASS: 35, EAT_RATIO: 1.25, CELL_RADIUS_FACTOR: 6,
} as const;
export const FOOD = {
  COUNT: 1200,
  COLORS: ['#4ade80','#22d3ee','#a78bfa','#f472b6','#fbbf24','#34d399','#60a5fa','#e879f9'],
} as const;
export const VIRUS = { COUNT: 40, COLOR: '#22c55e', SPIKES: 16 } as const;
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

export enum MsgType {
  JOIN=1, INPUT=2, SPLIT=3, EJECT=4, PING=5, CHAT=6, RECONNECT=7,
  WELCOME=10, STATE=11, LEADERBOARD=12, KILL=13, CHAT_MSG=14, PONG=15, DEATH=16, NOTIFICATION=17,
}
export interface Vec2 { x: number; y: number; }
export interface CellData {
  id: number; ownerId: string; x: number; y: number; mass: number; radius: number;
  color: string; name?: string; mergeTimer?: number;
}
export interface FoodData { id: number; x: number; y: number; color: string; mass: number; }
export interface VirusData { id: number; x: number; y: number; mass: number; radius: number; }
export interface LeaderboardEntry { name: string; mass: number; id: string; }
export interface JoinPayload { name: string; skin?: string; color?: string; }
export interface InputPayload { mx: number; my: number; seq: number; }

export function massToRadius(mass: number): number {
  return Math.sqrt(Math.max(mass, 1)) * PHYSICS.CELL_RADIUS_FACTOR;
}
export function speedFromMass(mass: number): number {
  const s = PHYSICS.BASE_SPEED - Math.log(mass + 1) * PHYSICS.SPEED_MASS_FACTOR;
  return Math.max(PHYSICS.MIN_SPEED, Math.min(PHYSICS.MAX_SPEED, s));
}
export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
export const PLAYER_COLORS = [
  '#4ade80','#22d3ee','#a78bfa','#f472b6','#fbbf24','#34d399','#60a5fa','#e879f9','#fb7185','#2dd4bf',
];
