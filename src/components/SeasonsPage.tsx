import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Crown, 
  Sparkles, 
  Coins, 
  Diamond, 
  Check, 
  ShoppingBag, 
  Gift, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  Zap,
  Lock,
  Target
} from 'lucide-react';
import { TouchSafeButton } from './TouchSafeButton';
import { playClaimRewardSound, playNodeClickSound, playChestSound } from '../utils/seasonSounds';
import seasonBgImage from '../assets/images/scary_halloween_season_bg_1791544045123.jpg';

interface SeasonsPageProps {
  onBack: () => void;
  onOpenShop?: () => void;
}

export interface TierReward {
  id: string;
  type: 'coins' | 'gems' | 'ghosts' | 'chest' | 'skin' | 'booster';
  name: string;
  amount: number;
  iconType: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  description?: string;
}

export interface SeasonTier {
  tier: number;
  tokensRequired: number;
  isMilestone?: boolean;
  milestoneTitle?: string;
  freeReward: TierReward;
  goldReward: TierReward;
}

const SEASON_TIERS: SeasonTier[] = [
  {
    tier: 1,
    tokensRequired: 50,
    isMilestone: true,
    milestoneTitle: 'WELCOME TIER',
    freeReward: { id: 'f1', type: 'coins', name: 'Cursed Coins', amount: 350, iconType: 'coins', rarity: 'common', description: 'Essential currency to upgrade your cells' },
    goldReward: { id: 'g1', type: 'gems', name: 'Soul Gems', amount: 80, iconType: 'gems', rarity: 'rare', description: 'Rare ethereal gems for VIP passes and skips' },
  },
  {
    tier: 2,
    tokensRequired: 100,
    freeReward: { id: 'f2', type: 'ghosts', name: 'Ghost Tokens', amount: 40, iconType: 'ghosts', rarity: 'common', description: 'Season 1 spectral tokens' },
    goldReward: { id: 'g2', type: 'coins', name: 'Cursed Coins', amount: 600, iconType: 'coins', rarity: 'common', description: 'Large bag of cursed gold' },
  },
  {
    tier: 3,
    tokensRequired: 160,
    freeReward: { id: 'f3', type: 'coins', name: 'Cursed Coins', amount: 450, iconType: 'coins', rarity: 'common', description: 'Cursed coin stash' },
    goldReward: { id: 'g3', type: 'ghosts', name: 'Ghost Tokens', amount: 60, iconType: 'ghosts', rarity: 'rare', description: 'Spectral token cache' },
  },
  {
    tier: 4,
    tokensRequired: 230,
    freeReward: { id: 'f4', type: 'gems', name: 'Soul Gems', amount: 25, iconType: 'gems', rarity: 'rare', description: 'Soul gem crystal' },
    goldReward: { id: 'g4', type: 'coins', name: 'Cursed Coins', amount: 850, iconType: 'coins', rarity: 'common', description: 'Heavy chest of gold' },
  },
  {
    tier: 5,
    tokensRequired: 310,
    isMilestone: true,
    milestoneTitle: 'GHOST COFFER',
    freeReward: { id: 'f5', type: 'chest', name: 'Spooky Ghost Coffer', amount: 1, iconType: 'chest', rarity: 'rare', description: 'Contains mystery coins, gems & tokens' },
    goldReward: { id: 'g5', type: 'gems', name: 'Soul Gems', amount: 120, iconType: 'gems', rarity: 'epic', description: 'Substantial soul gem hoard' },
  },
  {
    tier: 6,
    tokensRequired: 400,
    freeReward: { id: 'f6', type: 'coins', name: 'Cursed Coins', amount: 550, iconType: 'coins', rarity: 'common', description: 'Cursed coin treasure' },
    goldReward: { id: 'g6', type: 'ghosts', name: 'Ghost Tokens', amount: 80, iconType: 'ghosts', rarity: 'rare', description: 'Spectral ghost pouch' },
  },
  {
    tier: 7,
    tokensRequired: 500,
    freeReward: { id: 'f7', type: 'ghosts', name: 'Ghost Tokens', amount: 50, iconType: 'ghosts', rarity: 'common', description: 'Eerie ghost tokens' },
    goldReward: { id: 'g7', type: 'coins', name: 'Cursed Coins', amount: 1000, iconType: 'coins', rarity: 'rare', description: '1,000 cursed gold coins' },
  },
  {
    tier: 8,
    tokensRequired: 610,
    freeReward: { id: 'f8', type: 'gems', name: 'Soul Gems', amount: 35, iconType: 'gems', rarity: 'rare', description: 'Radiant soul gems' },
    goldReward: { id: 'g8', type: 'booster', name: 'Spectral Booster', amount: 1, iconType: 'booster', rarity: 'epic', description: '2x Mass & Speed temporary boost' },
  },
  {
    tier: 9,
    tokensRequired: 730,
    freeReward: { id: 'f9', type: 'coins', name: 'Cursed Coins', amount: 650, iconType: 'coins', rarity: 'common', description: 'Cursed coins reward' },
    goldReward: { id: 'g9', type: 'ghosts', name: 'Ghost Tokens', amount: 100, iconType: 'ghosts', rarity: 'epic', description: 'Centennial ghost token prize' },
  },
  {
    tier: 10,
    tokensRequired: 860,
    isMilestone: true,
    milestoneTitle: 'EPIC SPECTER CHEST',
    freeReward: { id: 'f10', type: 'chest', name: 'Haunted Crypt Chest', amount: 1, iconType: 'chest', rarity: 'epic', description: 'Gravekeeper chest filled with rare rewards' },
    goldReward: { id: 'g10', type: 'skin', name: 'Neon Specter Skin', amount: 1, iconType: 'skin', rarity: 'legendary', description: 'Exclusive glowing cyan ghost avatar skin' },
  },
  {
    tier: 11,
    tokensRequired: 1000,
    freeReward: { id: 'f11', type: 'coins', name: 'Cursed Coins', amount: 750, iconType: 'coins', rarity: 'common', description: 'Cursed coins bag' },
    goldReward: { id: 'g11', type: 'coins', name: 'Cursed Coins', amount: 1400, iconType: 'coins', rarity: 'rare', description: 'Large coin bounty' },
  },
  {
    tier: 12,
    tokensRequired: 1150,
    freeReward: { id: 'f12', type: 'ghosts', name: 'Ghost Tokens', amount: 65, iconType: 'ghosts', rarity: 'rare', description: 'Ghost token stash' },
    goldReward: { id: 'g12', type: 'gems', name: 'Soul Gems', amount: 150, iconType: 'gems', rarity: 'epic', description: 'Big soul gem pouch' },
  },
  {
    tier: 13,
    tokensRequired: 1310,
    freeReward: { id: 'f13', type: 'gems', name: 'Soul Gems', amount: 45, iconType: 'gems', rarity: 'rare', description: 'Shining soul crystals' },
    goldReward: { id: 'g13', type: 'ghosts', name: 'Ghost Tokens', amount: 120, iconType: 'ghosts', rarity: 'epic', description: 'Large spectral token bag' },
  },
  {
    tier: 14,
    tokensRequired: 1480,
    freeReward: { id: 'f14', type: 'coins', name: 'Cursed Coins', amount: 900, iconType: 'coins', rarity: 'common', description: 'Cursed coins bounty' },
    goldReward: { id: 'g14', type: 'coins', name: 'Cursed Coins', amount: 1800, iconType: 'coins', rarity: 'rare', description: 'Fortified gold treasure' },
  },
  {
    tier: 15,
    tokensRequired: 1660,
    isMilestone: true,
    milestoneTitle: 'PHANTOM VAULT',
    freeReward: { id: 'f15', type: 'chest', name: 'Ghost Swirl Mystery Box', amount: 1, iconType: 'chest', rarity: 'epic', description: 'Mystery box containing valuable relics' },
    goldReward: { id: 'g15', type: 'booster', name: 'Phantom Surge Booster', amount: 2, iconType: 'booster', rarity: 'legendary', description: 'Double XP & 1.5x split speed booster' },
  },
  {
    tier: 16,
    tokensRequired: 1850,
    freeReward: { id: 'f16', type: 'ghosts', name: 'Ghost Tokens', amount: 80, iconType: 'ghosts', rarity: 'rare', description: 'Spooky ghost tokens' },
    goldReward: { id: 'g16', type: 'gems', name: 'Soul Gems', amount: 180, iconType: 'gems', rarity: 'epic', description: 'Vast gem deposit' },
  },
  {
    tier: 17,
    tokensRequired: 2050,
    freeReward: { id: 'f17', type: 'coins', name: 'Cursed Coins', amount: 1100, iconType: 'coins', rarity: 'rare', description: 'Over a thousand cursed coins' },
    goldReward: { id: 'g17', type: 'ghosts', name: 'Ghost Tokens', amount: 150, iconType: 'ghosts', rarity: 'epic', description: 'Heavy spectral token hoard' },
  },
  {
    tier: 18,
    tokensRequired: 2260,
    freeReward: { id: 'f18', type: 'gems', name: 'Soul Gems', amount: 55, iconType: 'gems', rarity: 'rare', description: 'Glistening soul stones' },
    goldReward: { id: 'g18', type: 'coins', name: 'Cursed Coins', amount: 2200, iconType: 'coins', rarity: 'rare', description: 'Massive coin bag' },
  },
  {
    tier: 19,
    tokensRequired: 2480,
    freeReward: { id: 'f19', type: 'coins', name: 'Cursed Coins', amount: 1300, iconType: 'coins', rarity: 'rare', description: 'Cursed coin riches' },
    goldReward: { id: 'g19', type: 'gems', name: 'Soul Gems', amount: 200, iconType: 'gems', rarity: 'epic', description: '200 Soul Gem bounty' },
  },
  {
    tier: 20,
    tokensRequired: 2710,
    isMilestone: true,
    milestoneTitle: 'REAPER REWARD',
    freeReward: { id: 'f20', type: 'chest', name: 'Grand Citadel Chest', amount: 1, iconType: 'chest', rarity: 'epic', description: 'Imperial citadel chest full of riches' },
    goldReward: { id: 'g20', type: 'skin', name: 'Cursed Reaper Ghost Skin', amount: 1, iconType: 'skin', rarity: 'legendary', description: 'Cloaked haunted reaper cell skin' },
  },
  {
    tier: 21,
    tokensRequired: 2950,
    freeReward: { id: 'f21', type: 'ghosts', name: 'Ghost Tokens', amount: 95, iconType: 'ghosts', rarity: 'rare', description: 'Ghost token bounty' },
    goldReward: { id: 'g21', type: 'coins', name: 'Cursed Coins', amount: 2600, iconType: 'coins', rarity: 'rare', description: 'Citadel treasury bounty' },
  },
  {
    tier: 22,
    tokensRequired: 3200,
    freeReward: { id: 'f22', type: 'coins', name: 'Cursed Coins', amount: 1500, iconType: 'coins', rarity: 'rare', description: 'Generous gold coins' },
    goldReward: { id: 'g22', type: 'ghosts', name: 'Ghost Tokens', amount: 180, iconType: 'ghosts', rarity: 'epic', description: 'Extravagant ghost tokens' },
  },
  {
    tier: 23,
    tokensRequired: 3460,
    freeReward: { id: 'f23', type: 'gems', name: 'Soul Gems', amount: 70, iconType: 'gems', rarity: 'rare', description: 'Soul gem cache' },
    goldReward: { id: 'g23', type: 'gems', name: 'Soul Gems', amount: 250, iconType: 'gems', rarity: 'epic', description: '250 Soul Gems' },
  },
  {
    tier: 24,
    tokensRequired: 3730,
    freeReward: { id: 'f24', type: 'coins', name: 'Cursed Coins', amount: 1800, iconType: 'coins', rarity: 'rare', description: 'Grand coin coffer' },
    goldReward: { id: 'g24', type: 'coins', name: 'Cursed Coins', amount: 3200, iconType: 'coins', rarity: 'epic', description: 'Immense coin hoard' },
  },
  {
    tier: 25,
    tokensRequired: 4010,
    isMilestone: true,
    milestoneTitle: 'ROYAL PHANTOM VAULT',
    freeReward: { id: 'f25', type: 'chest', name: 'Royal Phantom Vault', amount: 1, iconType: 'chest', rarity: 'legendary', description: 'Ornate gold chest with legendary drop rates' },
    goldReward: { id: 'g25', type: 'booster', name: '3x Phantom Overlord Booster', amount: 3, iconType: 'booster', rarity: 'legendary', description: 'Massive stat & speed boosters' },
  },
  {
    tier: 26,
    tokensRequired: 4300,
    freeReward: { id: 'f26', type: 'ghosts', name: 'Ghost Tokens', amount: 120, iconType: 'ghosts', rarity: 'epic', description: 'Prestigious ghost token cache' },
    goldReward: { id: 'g26', type: 'coins', name: 'Cursed Coins', amount: 3800, iconType: 'coins', rarity: 'epic', description: 'Near four thousand coins' },
  },
  {
    tier: 27,
    tokensRequired: 4600,
    freeReward: { id: 'f27', type: 'coins', name: 'Cursed Coins', amount: 2200, iconType: 'coins', rarity: 'rare', description: 'Over two thousand coins' },
    goldReward: { id: 'g27', type: 'gems', name: 'Soul Gems', amount: 300, iconType: 'gems', rarity: 'legendary', description: '300 radiant soul gems' },
  },
  {
    tier: 28,
    tokensRequired: 4910,
    freeReward: { id: 'f28', type: 'gems', name: 'Soul Gems', amount: 90, iconType: 'gems', rarity: 'epic', description: 'Deep purple soul crystals' },
    goldReward: { id: 'g28', type: 'ghosts', name: 'Ghost Tokens', amount: 250, iconType: 'ghosts', rarity: 'legendary', description: 'Quarter-thousand ghost tokens' },
  },
  {
    tier: 29,
    tokensRequired: 5230,
    freeReward: { id: 'f29', type: 'coins', name: 'Cursed Coins', amount: 2800, iconType: 'coins', rarity: 'epic', description: 'Immense coin jackpot' },
    goldReward: { id: 'g29', type: 'coins', name: 'Cursed Coins', amount: 5000, iconType: 'coins', rarity: 'legendary', description: 'Five thousand cursed coins' },
  },
  {
    tier: 30,
    tokensRequired: 5560,
    isMilestone: true,
    milestoneTitle: 'ULTRA GRAND FINALE',
    freeReward: { id: 'f30', type: 'chest', name: 'Supreme Phantom Ark', amount: 1, iconType: 'chest', rarity: 'legendary', description: 'The ultimate season 1 mystery coffer' },
    goldReward: { id: 'g30', type: 'skin', name: 'Phantom Lord Specter Skin', amount: 1, iconType: 'skin', rarity: 'legendary', description: 'Exclusive ultra-mythic Ghost King skin with spectral trail!' },
  },
];

interface QuestItem {
  id: string;
  title: string;
  desc: string;
  progress: number;
  target: number;
  rewardXp: number;
  rewardCoins: number;
  completed: boolean;
  claimed: boolean;
}

const DEFAULT_QUESTS: QuestItem[] = [
  {
    id: 'q1',
    title: 'Phantom Harvest',
    desc: 'Collect 500 Ghost Tokens (👻) in any game mode',
    progress: 500,
    target: 500,
    rewardXp: 300,
    rewardCoins: 500,
    completed: true,
    claimed: false,
  },
  {
    id: 'q2',
    title: 'Shadow Cell Division',
    desc: 'Perform 15 tactical splits in the shadowy arena',
    progress: 15,
    target: 15,
    rewardXp: 400,
    rewardCoins: 750,
    completed: true,
    claimed: false,
  },
  {
    id: 'q3',
    title: 'Citadel Sovereign',
    desc: 'Survive in the top 5 leaderboard for 3 minutes',
    progress: 2,
    target: 3,
    rewardXp: 700,
    rewardCoins: 1200,
    completed: false,
    claimed: false,
  },
];

export function SeasonsPage({ onBack, onOpenShop }: SeasonsPageProps) {
  // Current player unlocked tier
  const [currentTier, setCurrentTier] = useState<number>(() => {
    const saved = localStorage.getItem('dasgar_season1_tier');
    return saved !== null ? parseInt(saved, 10) : 18;
  });

  // Track claimed tiers
  const [claimedFreeTiers, setClaimedFreeTiers] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('dasgar_season1_claimed_free');
      return saved ? JSON.parse(saved) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    } catch {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
  });

  const [claimedGoldTiers, setClaimedGoldTiers] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('dasgar_season1_claimed_gold');
      return saved ? JSON.parse(saved) : [1, 2, 3, 4, 5];
    } catch {
      return [1, 2, 3, 4, 5];
    }
  });

  // Gold Pass VIP ownership
  const [hasGoldPass, setHasGoldPass] = useState<boolean>(() => {
    const saved = localStorage.getItem('dasgar_has_gold_pass');
    return saved === 'true';
  });

  // Player currencies
  const [coins, setCoins] = useState<number>(() => {
    const saved = localStorage.getItem('dasgar_player_coins');
    return saved !== null ? parseInt(saved, 10) : 8930;
  });

  const [gems, setGems] = useState<number>(() => {
    const saved = localStorage.getItem('dasgar_player_gems');
    return saved !== null ? parseInt(saved, 10) : 1245;
  });

  const [ghostTokens, setGhostTokens] = useState<number>(() => {
    const saved = localStorage.getItem('dasgar_ghostTokenCount') ?? localStorage.getItem('dasgar_greenCandyCount');
    return saved !== null ? parseInt(saved, 10) : 2350;
  });

  const [quests, setQuests] = useState<QuestItem[]>(() => {
    try {
      const saved = localStorage.getItem('dasgar_season1_quests');
      return saved ? JSON.parse(saved) : DEFAULT_QUESTS;
    } catch {
      return DEFAULT_QUESTS;
    }
  });

  // UI state
  const [selectedReward, setSelectedReward] = useState<{ reward: TierReward; tier: number; isGold: boolean; isClaimed: boolean; isUnlocked: boolean } | null>(null);
  const [isQuestsOpen, setIsQuestsOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isGoldPassModalOpen, setIsGoldPassModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [celebrationParticles, setCelebrationParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current tier on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        // Find card for current tier (approx 160px per tier column)
        const targetX = Math.max(0, (currentTier - 2) * 168);
        scrollContainerRef.current.scrollTo({ left: targetX, behavior: 'smooth' });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const triggerCelebration = () => {
    const colors = ['#38bdf8', '#c084fc', '#a855f7', '#fb923c', '#22d3ee', '#facc15'];
    const newParticles = Array.from({ length: 30 }).map((_, i) => ({
      id: Date.now() + i,
      x: 50 + (Math.random() - 0.5) * 40,
      y: 70 + (Math.random() - 0.5) * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setCelebrationParticles(newParticles);
    setTimeout(() => {
      setCelebrationParticles([]);
    }, 1200);
  };

  // Scroll navigation helpers
  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -340, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 340, behavior: 'smooth' });
    }
  };

  const handleJumpToCurrent = () => {
    if (scrollContainerRef.current) {
      const targetX = Math.max(0, (currentTier - 2) * 168);
      scrollContainerRef.current.scrollTo({ left: targetX, behavior: 'smooth' });
    }
  };

  // Claim single free reward
  const handleClaimFree = (tierNum: number) => {
    const tierObj = SEASON_TIERS.find(t => t.tier === tierNum);
    if (!tierObj || claimedFreeTiers.includes(tierNum) || tierNum > currentTier) return;

    playChestSound();
    triggerCelebration();

    const newClaimed = [...claimedFreeTiers, tierNum];
    setClaimedFreeTiers(newClaimed);
    localStorage.setItem('dasgar_season1_claimed_free', JSON.stringify(newClaimed));

    applyReward(tierObj.freeReward);
    showToast(`Claimed Tier ${tierNum}: ${tierObj.freeReward.name}!`);
    if (selectedReward) setSelectedReward(null);
  };

  // Claim single gold reward
  const handleClaimGold = (tierNum: number) => {
    if (!hasGoldPass) {
      setIsGoldPassModalOpen(true);
      return;
    }

    const tierObj = SEASON_TIERS.find(t => t.tier === tierNum);
    if (!tierObj || claimedGoldTiers.includes(tierNum) || tierNum > currentTier) return;

    playClaimRewardSound();
    triggerCelebration();

    const newClaimed = [...claimedGoldTiers, tierNum];
    setClaimedGoldTiers(newClaimed);
    localStorage.setItem('dasgar_season1_claimed_gold', JSON.stringify(newClaimed));

    applyReward(tierObj.goldReward);
    showToast(`Claimed VIP Tier ${tierNum}: ${tierObj.goldReward.name}!`);
    if (selectedReward) setSelectedReward(null);
  };

  // Apply reward contents
  const applyReward = (r: TierReward) => {
    if (r.type === 'coins') {
      const nextCoins = coins + r.amount;
      setCoins(nextCoins);
      localStorage.setItem('dasgar_player_coins', nextCoins.toString());
    } else if (r.type === 'gems') {
      const nextGems = gems + r.amount;
      setGems(nextGems);
      localStorage.setItem('dasgar_player_gems', nextGems.toString());
    } else if (r.type === 'ghosts') {
      const nextGhosts = ghostTokens + r.amount;
      setGhostTokens(nextGhosts);
      localStorage.setItem('dasgar_ghostTokenCount', nextGhosts.toString());
    } else if (r.type === 'chest') {
      const nextCoins = coins + 750;
      const nextGhosts = ghostTokens + 60;
      setCoins(nextCoins);
      setGhostTokens(nextGhosts);
      localStorage.setItem('dasgar_player_coins', nextCoins.toString());
      localStorage.setItem('dasgar_ghostTokenCount', nextGhosts.toString());
    } else if (r.type === 'skin') {
      const nextGems = gems + 100;
      setGems(nextGems);
      localStorage.setItem('dasgar_player_gems', nextGems.toString());
    }
  };

  // Claim ALL available unlocked rewards across both tracks
  const handleClaimAll = () => {
    playClaimRewardSound();
    triggerCelebration();

    let addedCoins = 0;
    let addedGems = 0;
    let addedGhosts = 0;
    let count = 0;

    const newClaimedFree = [...claimedFreeTiers];
    const newClaimedGold = [...claimedGoldTiers];

    SEASON_TIERS.forEach(t => {
      if (t.tier <= currentTier) {
        // Check free track
        if (!newClaimedFree.includes(t.tier)) {
          newClaimedFree.push(t.tier);
          count++;
          if (t.freeReward.type === 'coins') addedCoins += t.freeReward.amount;
          if (t.freeReward.type === 'gems') addedGems += t.freeReward.amount;
          if (t.freeReward.type === 'ghosts') addedGhosts += t.freeReward.amount;
          if (t.freeReward.type === 'chest') { addedCoins += 600; addedGhosts += 50; }
        }

        // Check gold track if user owns Gold Pass
        if (hasGoldPass && !newClaimedGold.includes(t.tier)) {
          newClaimedGold.push(t.tier);
          count++;
          if (t.goldReward.type === 'coins') addedCoins += t.goldReward.amount;
          if (t.goldReward.type === 'gems') addedGems += t.goldReward.amount;
          if (t.goldReward.type === 'ghosts') addedGhosts += t.goldReward.amount;
          if (t.goldReward.type === 'chest') { addedCoins += 1000; addedGems += 50; }
        }
      }
    });

    if (count > 0) {
      setClaimedFreeTiers(newClaimedFree);
      setClaimedGoldTiers(newClaimedGold);
      localStorage.setItem('dasgar_season1_claimed_free', JSON.stringify(newClaimedFree));
      localStorage.setItem('dasgar_season1_claimed_gold', JSON.stringify(newClaimedGold));

      const nextCoins = coins + addedCoins;
      const nextGems = gems + addedGems;
      const nextGhosts = ghostTokens + addedGhosts;

      setCoins(nextCoins);
      setGems(nextGems);
      setGhostTokens(nextGhosts);

      localStorage.setItem('dasgar_player_coins', nextCoins.toString());
      localStorage.setItem('dasgar_player_gems', nextGems.toString());
      localStorage.setItem('dasgar_ghostTokenCount', nextGhosts.toString());

      showToast(`Collected ${count} Rewards! (+${addedCoins} Coins, +${addedGems} Gems, +${addedGhosts} Ghosts)`);
    } else {
      showToast('All unlocked rewards already claimed!');
    }
  };

  // Buy / Activate Gold Pass
  const handleActivateGoldPass = () => {
    if (gems >= 250) {
      const nextGems = gems - 250;
      setGems(nextGems);
      setHasGoldPass(true);
      localStorage.setItem('dasgar_player_gems', nextGems.toString());
      localStorage.setItem('dasgar_has_gold_pass', 'true');
      playClaimRewardSound();
      triggerCelebration();
      setIsGoldPassModalOpen(false);
      showToast('GHOST PASS VIP ACTIVATED! Exclusive Gold track unlocked!');
    } else {
      showToast('Not enough Soul Gems! Need 250 Gems.');
    }
  };

  // Claim Quest
  const handleClaimQuest = (questId: string) => {
    playClaimRewardSound();
    triggerCelebration();

    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    const updated = quests.map(q => q.id === questId ? { ...q, claimed: true } : q);
    setQuests(updated);
    localStorage.setItem('dasgar_season1_quests', JSON.stringify(updated));

    const addedGhosts = 150;
    const newGhostTokens = ghostTokens + addedGhosts;
    const newCoins = coins + quest.rewardCoins;
    setGhostTokens(newGhostTokens);
    setCoins(newCoins);

    localStorage.setItem('dasgar_ghostTokenCount', newGhostTokens.toString());
    localStorage.setItem('dasgar_player_coins', newCoins.toString());

    // Advance tier if reached
    if (currentTier < 30) {
      const nextTier = Math.min(30, currentTier + 1);
      setCurrentTier(nextTier);
      localStorage.setItem('dasgar_season1_tier', nextTier.toString());
    }

    showToast(`Quest Complete! +${quest.rewardCoins} Coins & +${addedGhosts} Ghost Tokens!`);
  };

  // Helper for rendering reward icon
  const renderRewardIcon = (r: TierReward, size: 'sm' | 'md' | 'lg' = 'md') => {
    const dim = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
    if (r.type === 'coins') {
      return <Coins className={`${dim} text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]`} />;
    }
    if (r.type === 'gems') {
      return <Diamond className={`${dim} text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.6)]`} />;
    }
    if (r.type === 'ghosts') {
      return (
        <img 
          src="/ghost-token.png" 
          alt="Ghost Token" 
          className={`${dim} object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]`} 
        />
      );
    }
    if (r.type === 'chest') {
      return <Gift className={`${dim} text-fuchsia-300 drop-shadow-[0_0_10px_rgba(240,171,252,0.6)]`} />;
    }
    if (r.type === 'skin') {
      return <Crown className={`${dim} text-amber-300 fill-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.8)] animate-pulse`} />;
    }
    if (r.type === 'booster') {
      return <Zap className={`${dim} text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]`} />;
    }
    return <Gift className={`${dim} text-white`} />;
  };

  const progressPercent = Math.min(100, Math.round((currentTier / 30) * 100));

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-sans text-white flex flex-col">
      {/* Background with Scary Halloween Theme and Dark Blur Layer */}
      <img 
        src={seasonBgImage} 
        alt="Halloween Season Background" 
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none opacity-40 brightness-75 scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-purple-950/70 pointer-events-none" />
      <div className="absolute inset-0 bg-radial from-transparent via-purple-950/40 to-black/80 pointer-events-none" />

      {/* Floating Spooky Celebration Particles */}
      {celebrationParticles.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, scale: 0.5, x: `${p.x}vw`, y: `${p.y}vh` }}
          animate={{
            opacity: 0,
            scale: 1.8,
            x: `${p.x + (Math.random() - 0.5) * 20}vw`,
            y: `${p.y - 25 - Math.random() * 20}vh`,
          }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="absolute z-50 pointer-events-none w-3.5 h-3.5 rounded-full shadow-lg"
          style={{ backgroundColor: p.color }}
        />
      ))}

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 border-2 border-cyan-400 text-cyan-200 font-extrabold text-xs sm:text-sm px-5 py-2 rounded-full shadow-[0_0_25px_rgba(56,189,248,0.5)] flex items-center gap-2 pointer-events-none backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* TOP HEADER CONSOLE (Fixed Top Bar)                                        */}
      {/* ========================================================================= */}
      <header className="relative z-30 w-full px-3 sm:px-6 pt-2 pb-1.5 flex items-center justify-between gap-2 border-b border-purple-900/40 bg-slate-950/80 backdrop-blur-md flex-shrink-0">
        {/* Left: Back to Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          <TouchSafeButton
            onClick={onBack}
            className="bg-slate-900/90 hover:bg-slate-800 border-2 border-purple-500/70 rounded-full px-3 py-1.5 text-purple-200 hover:text-white flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.35)] transition-all hud-tap"
            title="Return to Main Menu"
          >
            <ArrowLeft size={16} className="text-cyan-400" />
            <span className="font-black text-xs uppercase tracking-wider">Menu</span>
          </TouchSafeButton>

          {/* Season Title & Badge */}
          <div className="flex items-center gap-2">
            <img 
              src="/ghost-token.png" 
              alt="Ghost Token" 
              className="w-6 h-6 object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]" 
            />
            <div className="hidden xs:flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-sm tracking-wider text-white">
                  DASGAR<span className="text-cyan-400">.IO</span>
                </span>
                <span className="bg-purple-900/70 border border-purple-400/60 text-cyan-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                  GHOST PASS
                </span>
              </div>
              <span className="text-[10px] text-purple-300/80 font-bold tracking-tight">
                SEASON 1 • SPOOKY HAUNT
              </span>
            </div>
          </div>
        </div>

        {/* Center: Jump to Current Tier */}
        <div className="hidden md:flex items-center gap-2 bg-slate-900/80 border border-purple-600/50 rounded-full px-3 py-1 shadow-inner">
          <Target size={14} className="text-cyan-400 animate-pulse" />
          <span className="text-xs font-black text-purple-200 uppercase">
            TIER {currentTier}/30
          </span>
          <div className="w-20 bg-slate-950 rounded-full h-2 overflow-hidden border border-purple-800/60">
            <div 
              className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <TouchSafeButton
            onClick={handleJumpToCurrent}
            className="text-[10px] font-black text-cyan-300 hover:text-white uppercase bg-purple-900/60 hover:bg-purple-800 px-2 py-0.5 rounded-full hud-tap"
          >
            Jump
          </TouchSafeButton>
        </div>

        {/* Right: Currencies & Season Timer */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Ghost Tokens (👻) */}
          <div 
            className="flex items-center gap-1 bg-slate-900/90 border border-cyan-500/70 rounded-full px-2.5 py-1 shadow-[0_0_12px_rgba(56,189,248,0.35)]"
            title="Ghost Tokens"
          >
            <img src="/ghost-token.png" alt="Ghost" className="w-3.5 h-3.5 object-contain" />
            <span className="font-black text-xs text-cyan-300 font-mono">{ghostTokens.toLocaleString()}</span>
          </div>

          {/* Soul Gems */}
          <div 
            className="flex items-center gap-1 bg-slate-900/90 border border-purple-500/60 rounded-full px-2.5 py-1 shadow-inner"
            title="Soul Gems"
          >
            <Diamond size={13} className="text-fuchsia-400 fill-fuchsia-400" />
            <span className="font-black text-xs text-white">{gems.toLocaleString()}</span>
          </div>

          {/* Cursed Coins */}
          <div 
            className="flex items-center gap-1 bg-slate-900/90 border border-amber-500/60 rounded-full px-2.5 py-1 shadow-inner"
            title="Cursed Coins"
          >
            <Coins size={13} className="text-amber-400 fill-amber-400" />
            <span className="font-black text-xs text-white">{coins.toLocaleString()}</span>
          </div>

          {/* Season Countdown */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900/90 border border-orange-500/60 rounded-full px-2.5 py-1 text-orange-300 text-[10px] font-black shadow-lg">
            <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
            <span>14D 8H</span>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* SUB-HEADER: TRACK LABELS & PASS STATUS STRIP                              */}
      {/* ========================================================================= */}
      <div className="relative z-20 w-full px-3 sm:px-6 py-1.5 flex items-center justify-between gap-3 bg-purple-950/30 border-b border-purple-900/30 flex-shrink-0">
        {/* Left: Free vs Gold Legend / Pass Promo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
            <span className="text-[11px] font-black uppercase text-cyan-200">FREE TRACK</span>
          </div>
          <div className="w-[1px] h-3 bg-purple-700/60" />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            <span className="text-[11px] font-black uppercase text-amber-300">GOLD PASS TRACK</span>
          </div>
        </div>

        {/* Right: Gold Pass VIP Trigger Banner */}
        <div className="flex items-center gap-2">
          {hasGoldPass ? (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-950/80 to-purple-950/80 border border-amber-400/80 rounded-full px-3 py-0.5 shadow-[0_0_12px_rgba(245,158,11,0.4)]">
              <Crown size={13} className="text-amber-400 fill-amber-400 animate-pulse" />
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider">
                GOLD PASS ACTIVE (VIP)
              </span>
            </div>
          ) : (
            <TouchSafeButton
              onClick={() => setIsGoldPassModalOpen(true)}
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-[11px] uppercase tracking-wider px-3.5 py-1 rounded-full shadow-[0_0_18px_rgba(245,158,11,0.6)] hud-tap flex items-center gap-1.5"
            >
              <Crown size={13} className="text-slate-950 fill-slate-950" />
              <span>UPGRADE TO GOLD PASS</span>
            </TouchSafeButton>
          )}

          {/* Quick jump arrows */}
          <div className="flex items-center gap-1">
            <TouchSafeButton
              onClick={handleScrollLeft}
              className="w-7 h-7 rounded-full bg-slate-900 border border-purple-700/70 hover:bg-slate-800 text-purple-200 hover:text-white flex items-center justify-center hud-tap"
              title="Scroll Left"
            >
              <ChevronLeft size={16} />
            </TouchSafeButton>
            <TouchSafeButton
              onClick={handleScrollRight}
              className="w-7 h-7 rounded-full bg-slate-900 border border-purple-700/70 hover:bg-slate-800 text-purple-200 hover:text-white flex items-center justify-center hud-tap"
              title="Scroll Right"
            >
              <ChevronRight size={16} />
            </TouchSafeButton>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN CARDS TRACK VIEWPORT (HORIZONTAL SCROLLING CAROUSEL)                 */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 w-full overflow-hidden flex flex-col justify-center py-2 sm:py-3">
        <div 
          ref={scrollContainerRef}
          className="w-full h-full overflow-x-auto overflow-y-hidden px-4 sm:px-8 flex items-center gap-3 sm:gap-4 scroll-smooth select-none cursor-grab active:cursor-grabbing no-scrollbar"
          style={{ touchAction: 'pan-x' }}
        >
          {SEASON_TIERS.map((tier) => {
            const isUnlocked = tier.tier <= currentTier;
            const isCurrent = tier.tier === currentTier;
            const isFreeClaimed = claimedFreeTiers.includes(tier.tier);
            const isGoldClaimed = claimedGoldTiers.includes(tier.tier);

            return (
              <div
                key={tier.tier}
                className={`flex-shrink-0 w-[140px] sm:w-[155px] md:w-[168px] flex flex-col gap-2 relative transition-transform ${
                  isCurrent ? 'scale-[1.02]' : ''
                }`}
              >
                {/* ------------------------------------------------------------- */}
                {/* TIER HEADER BADGE                                             */}
                {/* ------------------------------------------------------------- */}
                <div className={`w-full py-1 rounded-xl flex items-center justify-between px-2.5 border transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-r from-purple-800 to-indigo-700 border-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.7)]'
                    : isUnlocked
                    ? 'bg-slate-900/90 border-purple-700/70 text-purple-200'
                    : 'bg-slate-950/80 border-slate-800 text-slate-500'
                }`}>
                  <div className="flex items-center gap-1">
                    {tier.isMilestone && <Crown size={12} className="text-amber-400 fill-amber-400 animate-pulse" />}
                    <span className={`font-black text-[11px] sm:text-xs tracking-wider uppercase ${isCurrent ? 'text-white' : ''}`}>
                      TIER {tier.tier}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 text-[10px] font-bold text-cyan-300 font-mono">
                    <img src="/ghost-token.png" alt="Ghosts" className="w-3 h-3 object-contain" />
                    <span>{tier.tokensRequired}</span>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* FREE PASS REWARD CARD (Top Card)                             */}
                {/* ------------------------------------------------------------- */}
                <div 
                  onClick={() => {
                    playNodeClickSound();
                    setSelectedReward({
                      reward: tier.freeReward,
                      tier: tier.tier,
                      isGold: false,
                      isClaimed: isFreeClaimed,
                      isUnlocked,
                    });
                  }}
                  className={`relative w-full rounded-2xl p-2.5 flex flex-col items-center text-center cursor-pointer transition-all border-2 hud-tap select-none ${
                    isFreeClaimed
                      ? 'bg-slate-950/70 border-cyan-700/40 text-cyan-400/80'
                      : isUnlocked
                      ? 'bg-gradient-to-b from-slate-900/90 to-purple-950/90 border-cyan-400/80 shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:scale-[1.03]'
                      : 'bg-slate-950/80 border-slate-800/80 opacity-75 hover:opacity-90'
                  }`}
                >
                  {/* Top Free Track Pill */}
                  <div className="w-full flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black tracking-wider text-cyan-300 uppercase bg-cyan-950/60 border border-cyan-500/40 px-1.5 py-0.2 rounded-full">
                      FREE
                    </span>
                    {isFreeClaimed ? (
                      <span className="text-[9px] font-black text-cyan-400 flex items-center gap-0.5">
                        <Check size={10} strokeWidth={3} /> Done
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-[9px] font-black text-lime-400 animate-pulse">
                        Ready
                      </span>
                    ) : (
                      <Lock size={10} className="text-slate-500" />
                    )}
                  </div>

                  {/* Reward Artwork Display */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-900/80 border border-purple-700/50 flex items-center justify-center my-1 relative shadow-inner">
                    {renderRewardIcon(tier.freeReward, 'md')}
                    {tier.freeReward.amount > 1 && (
                      <span className="absolute bottom-1 right-1 bg-slate-950/90 border border-purple-500/60 rounded px-1 text-[9px] font-black font-mono text-cyan-300">
                        x{tier.freeReward.amount}
                      </span>
                    )}
                  </div>

                  {/* Reward Title */}
                  <h4 className="font-black text-[11px] sm:text-xs text-white leading-tight truncate w-full mt-0.5">
                    {tier.freeReward.name}
                  </h4>

                  {/* Action / Claim Button */}
                  <div className="w-full mt-2">
                    {isFreeClaimed ? (
                      <div className="w-full py-1 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase flex items-center justify-center gap-1 shadow-inner">
                        <Check size={12} strokeWidth={3} /> CLAIMED
                      </div>
                    ) : isUnlocked ? (
                      <TouchSafeButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClaimFree(tier.tier);
                        }}
                        className="w-full py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-[10px] sm:text-xs uppercase shadow-[0_0_12px_rgba(56,189,248,0.7)] animate-pulse"
                      >
                        CLAIM
                      </TouchSafeButton>
                    ) : (
                      <div className="w-full py-1 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-[10px] font-bold flex items-center justify-center gap-1">
                        <Lock size={10} /> TIER {tier.tier}
                      </div>
                    )}
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* CONNECTOR LINE & MILESTONE NODE                               */}
                {/* ------------------------------------------------------------- */}
                <div className="relative w-full flex items-center justify-center my-0.5">
                  <div className={`w-full h-1 rounded-full ${
                    isUnlocked ? 'bg-gradient-to-r from-purple-500 to-cyan-400' : 'bg-slate-800'
                  }`} />
                  <div className={`absolute w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-black ${
                    isCurrent
                      ? 'bg-cyan-400 border-white text-slate-950 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-ping'
                      : isUnlocked
                      ? 'bg-purple-600 border-cyan-300 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`} />
                </div>

                {/* ------------------------------------------------------------- */}
                {/* GOLD PASS REWARD CARD (Bottom Card - VIP Track)              */}
                {/* ------------------------------------------------------------- */}
                <div 
                  onClick={() => {
                    playNodeClickSound();
                    setSelectedReward({
                      reward: tier.goldReward,
                      tier: tier.tier,
                      isGold: true,
                      isClaimed: isGoldClaimed,
                      isUnlocked,
                    });
                  }}
                  className={`relative w-full rounded-2xl p-2.5 flex flex-col items-center text-center cursor-pointer transition-all border-2 hud-tap select-none ${
                    isGoldClaimed
                      ? 'bg-slate-950/70 border-amber-600/40 text-amber-300/80'
                      : isUnlocked && hasGoldPass
                      ? 'bg-gradient-to-b from-amber-950/90 via-slate-900/90 to-purple-950/90 border-amber-400/90 shadow-[0_0_18px_rgba(245,158,11,0.35)] hover:scale-[1.03]'
                      : 'bg-gradient-to-b from-slate-950/90 to-amber-950/30 border-amber-600/40 hover:border-amber-400/60'
                  }`}
                >
                  {/* Top Gold Track Pill */}
                  <div className="w-full flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black tracking-wider text-amber-300 uppercase bg-amber-950/80 border border-amber-400/50 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shadow-sm">
                      <Crown size={9} className="text-amber-400 fill-amber-400" />
                      GOLD PASS
                    </span>
                    {isGoldClaimed ? (
                      <span className="text-[9px] font-black text-amber-400 flex items-center gap-0.5">
                        <Check size={10} strokeWidth={3} /> Done
                      </span>
                    ) : isUnlocked && hasGoldPass ? (
                      <span className="text-[9px] font-black text-yellow-300 animate-pulse">
                        Ready
                      </span>
                    ) : (
                      <Lock size={10} className="text-amber-500/70" />
                    )}
                  </div>

                  {/* Reward Artwork Display */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-tr from-amber-950/70 to-slate-900 border border-amber-400/60 flex items-center justify-center my-1 relative shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                    {renderRewardIcon(tier.goldReward, 'md')}
                    {tier.goldReward.amount > 1 && (
                      <span className="absolute bottom-1 right-1 bg-amber-950/90 border border-amber-400/60 rounded px-1 text-[9px] font-black font-mono text-amber-300">
                        x{tier.goldReward.amount}
                      </span>
                    )}
                  </div>

                  {/* Reward Title */}
                  <h4 className="font-black text-[11px] sm:text-xs text-amber-200 leading-tight truncate w-full mt-0.5">
                    {tier.goldReward.name}
                  </h4>

                  {/* Action / Claim Button */}
                  <div className="w-full mt-2">
                    {isGoldClaimed ? (
                      <div className="w-full py-1 rounded-xl bg-slate-900/90 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase flex items-center justify-center gap-1 shadow-inner">
                        <Check size={12} strokeWidth={3} /> CLAIMED
                      </div>
                    ) : hasGoldPass && isUnlocked ? (
                      <TouchSafeButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClaimGold(tier.tier);
                        }}
                        className="w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 hover:brightness-110 text-slate-950 font-black text-[10px] sm:text-xs uppercase shadow-[0_0_15px_rgba(245,158,11,0.8)] animate-pulse"
                      >
                        CLAIM
                      </TouchSafeButton>
                    ) : !hasGoldPass && isUnlocked ? (
                      <TouchSafeButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsGoldPassModalOpen(true);
                        }}
                        className="w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black text-[9.5px] uppercase shadow-md flex items-center justify-center gap-1"
                      >
                        <Crown size={11} /> GET PASS
                      </TouchSafeButton>
                    ) : (
                      <div className="w-full py-1 rounded-xl bg-slate-900/40 border border-amber-900/60 text-amber-600/70 text-[10px] font-bold flex items-center justify-center gap-1">
                        <Lock size={10} /> LOCKED
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* BOTTOM ACTION BAR (CLAIM ALL, QUESTS, SHOP)                               */}
      {/* ========================================================================= */}
      <footer className="relative z-30 w-full px-3 sm:px-6 py-2.5 bg-slate-950/90 border-t border-purple-900/40 backdrop-blur-md flex items-center justify-center flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-4xl flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: SPOOKY QUESTS button */}
          <TouchSafeButton
            onClick={() => {
              playNodeClickSound();
              setIsQuestsOpen(true);
            }}
            className="flex-1 sm:flex-initial bg-slate-900/90 hover:bg-slate-800 border-2 border-purple-500/70 rounded-full px-3 sm:px-5 py-2 text-white flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.3)] hud-tap transition-all"
          >
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-black text-[10px] sm:text-xs flex-shrink-0">
              !
            </div>
            <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-purple-100 whitespace-nowrap">
              SPOOKY QUESTS
            </span>
          </TouchSafeButton>

          {/* Center: CLAIM ALL Rewards Glowing Button */}
          <TouchSafeButton
            onClick={handleClaimAll}
            className="flex-1 max-w-[280px] sm:max-w-[340px] bg-gradient-to-r from-purple-700 via-indigo-600 to-cyan-500 hover:from-purple-600 hover:to-cyan-400 active:scale-95 border-2 border-cyan-300/90 rounded-full py-2.5 sm:py-3 px-5 sm:px-8 flex items-center justify-center shadow-[0_0_25px_rgba(56,189,248,0.7)] text-white hud-tap transition-all select-none"
          >
            <Sparkles size={18} className="mr-1.5 text-cyan-200 fill-cyan-200 animate-bounce" />
            <span className="font-black text-xs sm:text-sm md:text-base tracking-wider uppercase whitespace-nowrap drop-shadow-md">
              CLAIM ALL
            </span>
          </TouchSafeButton>

          {/* Right: HALLOWEEN SHOP button */}
          <TouchSafeButton
            onClick={() => {
              playNodeClickSound();
              if (onOpenShop) {
                onOpenShop();
              } else {
                setIsShopOpen(true);
              }
            }}
            className="flex-1 sm:flex-initial bg-slate-900/90 hover:bg-slate-800 border-2 border-purple-500/70 rounded-full px-3 sm:px-5 py-2 text-white flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.3)] hud-tap transition-all"
          >
            <ShoppingBag size={16} className="text-cyan-400 flex-shrink-0" />
            <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-purple-100 whitespace-nowrap">
              SHOP
            </span>
          </TouchSafeButton>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* REWARD DETAILS INSPECT MODAL                                              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedReward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-slate-950 border-[3px] border-purple-500/80 rounded-3xl p-5 sm:p-6 shadow-[0_0_35px_rgba(168,85,247,0.5)] flex flex-col items-center text-center text-white"
            >
              <button 
                onClick={() => setSelectedReward(null)}
                className="absolute top-3.5 right-3.5 text-purple-400 hover:text-white p-1 rounded-full bg-purple-950/60"
              >
                <X size={18} />
              </button>

              <div className={`border rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider mb-3 ${
                selectedReward.isGold 
                  ? 'bg-amber-950/80 border-amber-400/70 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                  : 'bg-purple-950 border-purple-500/60 text-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
              }`}>
                TIER {selectedReward.tier} • {selectedReward.isGold ? 'GOLD PASS' : 'FREE TRACK'}
              </div>

              <div className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-3 border-2 shadow-2xl ${
                selectedReward.isGold
                  ? 'bg-gradient-to-tr from-amber-950 to-purple-900 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)]'
                  : 'bg-gradient-to-tr from-purple-950 to-indigo-900 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.4)]'
              }`}>
                {renderRewardIcon(selectedReward.reward, 'lg')}
              </div>

              <h3 className="font-black text-xl text-white mb-1">
                {selectedReward.reward.name}
              </h3>
              <p className="text-xs text-purple-300 font-medium mb-5 px-3">
                {selectedReward.reward.description || 'Exclusive Season 1 Haunted Hollow reward'}
              </p>

              {selectedReward.isClaimed ? (
                <div className="w-full bg-slate-900/90 border border-cyan-500/60 rounded-2xl py-3 font-black text-cyan-300 text-sm uppercase flex items-center justify-center gap-2">
                  <Check size={16} /> ALREADY CLAIMED
                </div>
              ) : selectedReward.isUnlocked ? (
                selectedReward.isGold && !hasGoldPass ? (
                  <TouchSafeButton
                    onClick={() => {
                      setSelectedReward(null);
                      setIsGoldPassModalOpen(true);
                    }}
                    className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-slate-950 rounded-2xl py-3 font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.6)] hud-tap"
                  >
                    UPGRADE TO GOLD PASS TO CLAIM
                  </TouchSafeButton>
                ) : (
                  <TouchSafeButton
                    onClick={() => {
                      if (selectedReward.isGold) {
                        handleClaimGold(selectedReward.tier);
                      } else {
                        handleClaimFree(selectedReward.tier);
                      }
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 border border-cyan-300 text-white rounded-2xl py-3 font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(56,189,248,0.6)] hud-tap hover:brightness-110"
                  >
                    CLAIM REWARD NOW
                  </TouchSafeButton>
                )
              ) : (
                <div className="w-full bg-slate-900/60 border border-purple-900 rounded-2xl py-3 font-black text-purple-400 text-xs uppercase">
                  LOCKED • REACH TIER {selectedReward.tier}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* GOLD PASS UPGRADE PROMO MODAL                                             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isGoldPassModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-950 border-[3px] border-amber-400 rounded-3xl p-6 shadow-[0_0_40px_rgba(245,158,11,0.5)] flex flex-col items-center text-center text-white"
            >
              <button 
                onClick={() => setIsGoldPassModalOpen(false)}
                className="absolute top-3.5 right-3.5 text-amber-400 hover:text-white p-1 rounded-full bg-amber-950/60"
              >
                <X size={18} />
              </button>

              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-300 flex items-center justify-center text-slate-950 mb-3 shadow-[0_0_25px_rgba(245,158,11,0.8)]">
                <Crown size={36} className="fill-slate-950" />
              </div>

              <h2 className="font-black text-2xl text-white mb-1">
                GHOST PASS VIP
              </h2>
              <p className="text-xs text-amber-200/90 mb-4 px-4">
                Unlock 30 exclusive Gold Track tiers, legendary skins, and collect double rewards!
              </p>

              <div className="w-full bg-slate-900/80 border border-amber-500/40 rounded-2xl p-3.5 text-left space-y-2 mb-5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                  <Check size={16} className="text-amber-400 flex-shrink-0" />
                  <span>Instant unlock for all previous reached Gold tiers</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                  <Check size={16} className="text-amber-400 flex-shrink-0" />
                  <span>Exclusive Phantom Lord Specter Legendary Skin</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                  <Check size={16} className="text-amber-400 flex-shrink-0" />
                  <span>Double Ghost Tokens (👻) from games and quests</span>
                </div>
              </div>

              <TouchSafeButton
                onClick={handleActivateGoldPass}
                className="w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm uppercase py-3.5 rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.8)] hud-tap flex items-center justify-center gap-2"
              >
                <Diamond size={16} className="text-slate-950 fill-slate-950" />
                <span>ACTIVATE FOR 250 SOUL GEMS</span>
              </TouchSafeButton>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* DAILY QUESTS MODAL                                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isQuestsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-950 border-[3px] border-purple-500/80 rounded-3xl p-5 sm:p-6 shadow-[0_0_35px_rgba(168,85,247,0.4)] flex flex-col text-white max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-purple-800/80 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-sm">
                    !
                  </div>
                  <div>
                    <h2 className="font-black text-lg text-white">Halloween Quests</h2>
                    <p className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">Refreshes in 18h 42m</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsQuestsOpen(false)}
                  className="text-purple-400 hover:text-white p-1 rounded-full bg-purple-950/60"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {quests.map(quest => (
                  <div key={quest.id} className="bg-purple-950/40 border border-purple-700/60 rounded-2xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm text-white">{quest.title}</h4>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                        <img src="/ghost-token.png" alt="Ghost" className="w-3.5 h-3.5 object-contain" />
                        <span>+150</span>
                        <span className="text-amber-300 ml-1">+{quest.rewardCoins}🪙</span>
                      </div>
                    </div>
                    <p className="text-xs text-purple-300">{quest.desc}</p>

                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 bg-slate-900 rounded-full h-2.5 overflow-hidden border border-purple-700/50">
                        <div 
                          className="bg-cyan-400 h-full rounded-full shadow-[0_0_8px_rgba(56,189,248,0.7)]" 
                          style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }} 
                        />
                      </div>
                      <span className="text-[11px] font-bold text-cyan-200 whitespace-nowrap font-mono">
                        {quest.progress}/{quest.target}
                      </span>
                    </div>

                    {quest.claimed ? (
                      <div className="text-center py-1 font-bold text-xs text-cyan-400 flex items-center justify-center gap-1">
                        <Check size={14} /> Claimed
                      </div>
                    ) : quest.completed ? (
                      <TouchSafeButton
                        onClick={() => handleClaimQuest(quest.id)}
                        className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 text-white font-black text-xs uppercase py-2 rounded-xl mt-1 shadow-[0_0_15px_rgba(56,189,248,0.5)] hud-tap"
                      >
                        Claim Reward
                      </TouchSafeButton>
                    ) : (
                      <div className="text-center py-1 font-bold text-[11px] text-purple-400 uppercase">
                        In Progress
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* SHOP MODAL                                                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isShopOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-950 border-[3px] border-purple-500/80 rounded-3xl p-5 sm:p-6 shadow-[0_0_35px_rgba(168,85,247,0.4)] flex flex-col text-white max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-purple-800/80 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <img src="/ghost-token.png" alt="Ghost" className="w-6 h-6 object-contain drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                  <h2 className="font-black text-lg text-white">Halloween Ghost Shop</h2>
                </div>
                <button 
                  onClick={() => setIsShopOpen(false)}
                  className="text-purple-400 hover:text-white p-1 rounded-full bg-purple-950/60"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {/* Item 1 */}
                <div className="bg-purple-950/40 border border-purple-700/60 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">+5 Tier Phantom Skip</h4>
                      <p className="text-xs text-purple-300">Instantly advance 5 Season Tiers</p>
                    </div>
                  </div>
                  <TouchSafeButton
                    onClick={() => {
                      if (gems >= 150) {
                        const nextGems = gems - 150;
                        const nextTier = Math.min(30, currentTier + 5);
                        setGems(nextGems);
                        setCurrentTier(nextTier);
                        localStorage.setItem('dasgar_player_gems', nextGems.toString());
                        localStorage.setItem('dasgar_season1_tier', nextTier.toString());
                        playClaimRewardSound();
                        showToast('Skipped 5 Tiers!');
                      } else {
                        showToast('Not enough Soul Gems!');
                      }
                    }}
                    className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs px-3 py-2 rounded-xl hud-tap flex items-center gap-1 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                  >
                    <Diamond size={12} /> 150
                  </TouchSafeButton>
                </div>

                {/* Item 2 */}
                <div className="bg-purple-950/40 border border-purple-700/60 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-slate-950 shadow-md">
                      <Coins size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">5,000 Cursed Coins</h4>
                      <p className="text-xs text-purple-300">Boost your gold reserve</p>
                    </div>
                  </div>
                  <TouchSafeButton
                    onClick={() => {
                      if (gems >= 100) {
                        const nextGems = gems - 100;
                        const nextCoins = coins + 5000;
                        setGems(nextGems);
                        setCoins(nextCoins);
                        localStorage.setItem('dasgar_player_gems', nextGems.toString());
                        localStorage.setItem('dasgar_player_coins', nextCoins.toString());
                        playClaimRewardSound();
                        showToast('Added 5,000 Cursed Coins!');
                      } else {
                        showToast('Not enough Soul Gems!');
                      }
                    }}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3 py-2 rounded-xl hud-tap flex items-center gap-1 shadow-md"
                  >
                    <Diamond size={12} /> 100
                  </TouchSafeButton>
                </div>

                {/* Item 3 */}
                <div className="bg-purple-950/40 border border-purple-700/60 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
                      <Crown size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">Ghost Season VIP Pass</h4>
                      <p className="text-xs text-purple-300">Double Ghost Tokens & Gold Pass</p>
                    </div>
                  </div>
                  <TouchSafeButton
                    onClick={() => {
                      if (hasGoldPass) {
                        showToast('Already Active!');
                      } else {
                        setIsGoldPassModalOpen(true);
                        setIsShopOpen(false);
                      }
                    }}
                    className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-black text-xs px-3 py-2 rounded-xl hud-tap shadow-[0_0_15px_rgba(56,189,248,0.5)]"
                  >
                    {hasGoldPass ? 'ACTIVE' : 'UPGRADE'}
                  </TouchSafeButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
