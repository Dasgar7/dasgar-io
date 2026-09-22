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
