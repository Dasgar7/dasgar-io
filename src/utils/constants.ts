/** Shared game constants — keep pure so multiplayer can reuse later */

export const WORLD = {
  WIDTH: 8000,
  HEIGHT: 8000,
  BORDER: 40,
} as const;

export const PHYSICS = {
  BASE_SPEED: 6.8,
  SPEED_MASS_FACTOR: 0.24,
  MIN_SPEED: 1.15,
  MAX_SPEED: 9.5,
  FRICTION: 0.91,
  SPLIT_SPEED: 30,
  MERGE_TIME: 12000,
  MASS_DECAY_RATE: 0.9975,
  MASS_DECAY_THRESHOLD: 120,
  FOOD_MASS: 1.2,
  VIRUS_MASS: 100,
  VIRUS_MAX_MASS: 190,
  EJECT_MASS: 14,
  EJECT_SPEED: 24,
  MIN_SPLIT_MASS: 36,
  MIN_EJECT_MASS: 35,
  EAT_RATIO: 1.22,
  CELL_RADIUS_FACTOR: 5.5,
  MAX_CELLS_PER_PLAYER: 16,
} as const;

export const FOOD = {
  COUNT: 1800,
  COLORS: [
    '#4ade80', '#22d3ee', '#a78bfa', '#f472b6',
    '#fbbf24', '#34d399', '#60a5fa', '#e879f9',
    '#fb7185', '#2dd4bf',
  ],
} as const;

export const VIRUS = {
  COUNT: 35,
  COLOR: '#22c55e',
  SPIKES: 16,
} as const;

export const BOTS = {
  COUNT: 70,
  RESPAWN_DELAY: 800,
} as const;

export const PLAYER_COLORS = [
  '#4ade80', '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24',
  '#34d399', '#60a5fa', '#e879f9', '#fb7185', '#2dd4bf',
  '#f97316', '#14b8a6', '#8b5cf6', '#ec4899',
];

export const BOT_NAMES = [
  'Shadow', 'Nova', 'Blaze', 'Echo', 'Frost', 'Viper', 'Orbit', 'Pixel',
  'Zen', 'Bolt', 'Drift', 'Quark', 'Nebula', 'Pulse', 'Rift', 'Spark',
  'Vortex', 'Ember', 'Glitch', 'Luna', 'Apex', 'Cipher', 'Flux', 'Halo',
  'Ion', 'Jade', 'Kite', 'Lynx', 'Mote', 'Nexus', 'Onyx', 'Prism',
  'Quill', 'Raven', 'Sable', 'Tide', 'Umbra', 'Volt', 'Wisp', 'Xenon',
  'Yeti', 'Zephyr', 'Ash', 'Byte', 'Core', 'Dash', 'Edge', 'Fang',
  'Glimmer', 'Hex', 'Iris', 'Jolt', 'Karma', 'Leaf', 'Mist', 'Node',
  'Omega', 'Phantom', 'Quest', 'Rune', 'Storm', 'Thorn', 'Ultra', 'Void',
  'Wave', 'Zero', 'Ace', 'Bloom', 'Crash', 'Dusk', 'Eclipse', 'Flare',
];

export function massToRadius(mass: number): number {
  return Math.sqrt(Math.max(mass, 1)) * PHYSICS.CELL_RADIUS_FACTOR;
}

export function speedFromMass(mass: number): number {
  const s = PHYSICS.BASE_SPEED - Math.log(mass + 1) * PHYSICS.SPEED_MASS_FACTOR;
  return Math.max(PHYSICS.MIN_SPEED, Math.min(PHYSICS.MAX_SPEED, s));
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function randRange(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
