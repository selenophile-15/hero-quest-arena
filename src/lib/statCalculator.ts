/**
 * Stat Calculator - Phase 1: Base Stats + Seeds
 * 
 * Formula:
 * - ATK/DEF/HP = (base + seeds + equipment + flat bonuses) × (1 + skill%)
 * - Crit/Eva/CritDmg/Threat = base + equipment + all bonuses (additive)
 * 
 * Phase 1 only computes base + seeds.
 * Equipment, skills, and special mechanics will be added in later phases.
 */

import { lookupHeroStats, HeroLevelStats, HeroFixedStats } from './gameData';

export interface CalculatedStats {
  // Base stats from STD1
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseCrit: number;
  baseCritDmg: number;
  baseEvasion: number;
  baseThreat: number;

  // Seed bonuses
  seedHp: number;
  seedAtk: number;
  seedDef: number;

  // Phase 1 totals (base + seeds only for now)
  totalHp: number;
  totalAtk: number;
  totalDef: number;
  totalCrit: number;
  totalCritDmg: number;
  totalCritAttack: number;
  totalEvasion: number;
  totalThreat: number;

  // Metadata
  jobElement: string;
}

const SEED_MULTIPLIER = { hp: 1, atk: 4, def: 4 };

export async function calculateHeroStats(
  jobName: string,
  level: number,
  seeds: { hp: number; atk: number; def: number },
): Promise<CalculatedStats | null> {
  if (!jobName || !level) return null;

  const statsData = await lookupHeroStats(jobName, level);
  if (!statsData) return null;

  const { level: levelStats, fixed } = statsData;

  // Base stats
  const baseHp = levelStats.hp;
  const baseAtk = levelStats.atk;
  const baseDef = levelStats.def;
  const baseCrit = fixed.critRate;
  const baseCritDmg = fixed.critDmg;
  const baseEvasion = fixed.evasion;
  const baseThreat = fixed.threat;

  // Seed bonuses
  const seedHp = seeds.hp * SEED_MULTIPLIER.hp;
  const seedAtk = seeds.atk * SEED_MULTIPLIER.atk;
  const seedDef = seeds.def * SEED_MULTIPLIER.def;

  // Phase 1 totals: (base + seeds) — equipment and skills will be added later
  // For ATK/DEF/HP: (base + seeds + equipment + flat) × (1 + skill%)
  // For now, skill% = 0, equipment = 0, flat = 0
  const totalHp = baseHp + seedHp;
  const totalAtk = baseAtk + seedAtk;
  const totalDef = baseDef + seedDef;

  // These are purely additive
  const totalCrit = baseCrit;
  const totalCritDmg = baseCritDmg;
  const totalEvasion = baseEvasion;
  const totalThreat = baseThreat;

  // Crit attack = atk × critDmg / 100
  const totalCritAttack = Math.floor(totalAtk * totalCritDmg / 100);

  return {
    baseHp, baseAtk, baseDef,
    baseCrit, baseCritDmg, baseEvasion, baseThreat,
    seedHp, seedAtk, seedDef,
    totalHp, totalAtk, totalDef,
    totalCrit, totalCritDmg, totalCritAttack,
    totalEvasion, totalThreat,
    jobElement: fixed.element,
  };
}
