import pigRank1Img from '../assets/skins/rank1-pig.png';
import spiderRank7Img from '../assets/skins/rank7-spider.png';
import catRank15Img from '../assets/skins/rank15-cat.png';
import dragonRank23Img from '../assets/skins/rank23-dragon.png';
import sharkRank27Img from '../assets/skins/rank27-shark.png';
import foxRank35Img from '../assets/skins/rank35-fox.png';
import rank1StarBadge from '../assets/skins/rank1-star-badge.png';

export interface SkinItem {
  id: string;
  name: string;
  category: string;
  svg: string; // Image URL or Data URL
  border?: string;
  bg?: string;
  requiredRank?: number;
  badgeImg?: string;
}

// Reusable rank badge image map
export const RANK_BADGE_IMAGES: Record<number, string> = {
  1: rank1StarBadge || '/assets/badges/rank1-star-badge.png',
  // Future rank badge image assets (Rank 7, 15, 23, 27) plug directly into this registry
};

// Player rank storage helper functions
export function getPlayerRank(): number {
  try {
    const rank = localStorage.getItem('dasgario_player_rank');
    return rank !== null ? parseInt(rank, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setPlayerRank(rank: number): void {
  try {
    localStorage.setItem('dasgario_player_rank', rank.toString());
    window.dispatchEvent(new CustomEvent('dasgario_rank_updated', { detail: rank }));
  } catch (e) {
    console.warn('Could not save player rank to localStorage', e);
  }
}

export const PRESET_SKINS: Record<string, SkinItem[]> = {
  vip: [],
  free: [],
  level: [
    {
      id: 'rank-1',
      name: 'Savage Swine',
      category: 'level',
      requiredRank: 1,
      svg: pigRank1Img || '/skins/rank1-pig.png'
    },
    {
      id: 'rank-7',
      name: 'Iron Widow',
      category: 'level',
      requiredRank: 7,
      svg: spiderRank7Img || '/skins/rank7-spider.png'
    },
    {
      id: 'rank-15',
      name: 'Shadow Stalker',
      category: 'level',
      requiredRank: 15,
      svg: catRank15Img || '/skins/rank15-cat.png'
    },
    {
      id: 'rank-23',
      name: 'Void Wyrm',
      category: 'level',
      requiredRank: 23,
      svg: dragonRank23Img || '/skins/rank23-dragon.png'
    },
    {
      id: 'rank-27',
      name: 'Abyss Hunter',
      category: 'level',
      requiredRank: 27,
      svg: sharkRank27Img || '/skins/rank27-shark.png'
    },
    {
      id: 'rank-35',
      name: 'Ember Fox',
      category: 'level',
      requiredRank: 35,
      svg: foxRank35Img || '/skins/rank35-fox.png'
    }
  ],
  premium: [],
  own: []
};

// 6 Animal preset skins assigned to ~40% of bots
export const BOT_SKIN_ITEMS: SkinItem[] = PRESET_SKINS.level.slice(0, 6);

// Modern realistic player gamer tags pool (~60 names with short tags, dots, numbers, lowercase, emojis)
export const BOT_NAME_POOL: string[] = [
  'xKira', 'vibe.', 'mochi', 'n0va', 'sleepy', 'ratio', 'lowkey', 'zyn', 'mira7',
  'k4rma', 'apex.', 'void9', 'blush', 'toxic_', 'ghosty', 'pluto', 'zenith', 'dr1ft',
  'lunar', 'glitch', 'echo.', 'pulse', 'frosty', 'sh4dow', 'pixie', 'sn4ke', 'crying_',
  'k1ng', 'aura', 'slump', 'yuki', 'zero2', 'boba', 'fizz', 'neon_', 'vortex',
  'sp1ke', 'clover', 'phantom', 'cyber', 'dusk', 'orbit.', 'hype', 'flame', 'r1val',
  'mist', 'krono', 'sparky', 'haz3', 'blade', 'cloud9', 's1lent', 'omen', 'toxic',
  'demon', 'angel', '⚡strike', '👑boss', '💀reaper', '🔥blaze', '✨star'
];

// Vibrant cell color palette for bots
export const BOT_COLOR_POOL: string[] = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e',
  '#14b8a6', '#84cc16', '#e11d48', '#0284c7', '#7c3aed'
];
