import type { Hero } from '@/types/game';

const SHORT_LEADER_TIER_CHAMPIONS = ['라인홀드', 'Reinhold', '타마스', 'Tamas'];

function clampTier(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(4, Math.max(1, Math.floor(value)));
}

export function getChampionLeaderSkillTier(champion: Pick<Hero, 'championName' | 'name' | 'rank' | 'promoted' | 'cardLevel'> | null | undefined): number {
  if (!champion) return 1;

  const rank = Number(champion.rank) || 0;
  if (rank > 0) {
    const name = champion.championName || champion.name || '';
    const thresholds = SHORT_LEADER_TIER_CHAMPIONS.some(n => name.includes(n))
      ? [1, 2, 3, 4]
      : [1, 4, 7, 11];

    for (let tier = 4; tier >= 1; tier--) {
      if (rank >= thresholds[tier - 1]) return tier;
    }
    return 1;
  }

  if (champion.promoted) return 4;
  return clampTier(Number(champion.cardLevel) || 1);
}

export function getCombatSkillTier(hero: Hero): number {
  if (hero.type === 'champion') return getChampionLeaderSkillTier(hero);
  if (hero.promoted) return 4;
  return clampTier(Number(hero.cardLevel) || 1);
}