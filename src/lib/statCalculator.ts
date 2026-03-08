/**
 * Stat Calculator - Phase 2: Base Stats + Seeds + Equipment
 * 
 * Formula:
 * - ATK/DEF/HP = (base + seeds + equipment + flat bonuses) × (1 + skill%)
 * - Crit/Eva/CritDmg/Threat = base + equipment + all bonuses (additive)
 */

import { lookupHeroStats } from './gameData';
import { calculateEquipmentStats, parseEquipSkillBonuses, EquipCalcResult, EquipSlotCalc } from './equipStatCalculator';

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

  // Equipment totals
  equipResult: EquipCalcResult;

  // Phase 2 totals (base + seeds + equipment)
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

export type { EquipCalcResult, EquipSlotCalc };

const SEED_MULTIPLIER = { hp: 1, atk: 4, def: 4 };

export interface CalcInput {
  jobName: string;
  level: number;
  seeds: { hp: number; atk: number; def: number };
  equipmentSlots: Array<{
    item: any | null;
    quality: string;
    element: { type: string; tier: number; affinity: boolean } | null;
    spirit: { name: string; affinity: boolean } | null;
  }>;
  hasRangedWeapon: boolean;
  // Skill data for equipment bonuses
  skillBonusInputs: Array<{
    bonusData: Record<string, number | number[]>;
    appliedEquip: string[][] | undefined;
    skillLevel: number;
  }>;
}

export async function calculateHeroStats(input: CalcInput): Promise<CalculatedStats | null> {
  const { jobName, level, seeds, equipmentSlots, hasRangedWeapon, skillBonusInputs } = input;
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

  // Equipment calculation
  const equipBonuses = parseEquipSkillBonuses(skillBonusInputs);
  const equipResult = await calculateEquipmentStats(equipmentSlots, equipBonuses, hasRangedWeapon);

  // Phase 2 totals: (base + seeds + equipment) — flat bonuses and skill% will be added later
  const totalHp = baseHp + seedHp + equipResult.totalHp;
  const totalAtk = baseAtk + seedAtk + equipResult.totalAtk;
  const totalDef = baseDef + seedDef + equipResult.totalDef;

  // Additive stats
  const totalCrit = baseCrit + equipResult.totalCrit;
  const totalCritDmg = baseCritDmg;
  const totalEvasion = baseEvasion + equipResult.totalEvasion;
  const totalThreat = baseThreat;

  // Crit attack = atk × critDmg / 100
  const totalCritAttack = Math.floor(totalAtk * totalCritDmg / 100);

  return {
    baseHp, baseAtk, baseDef,
    baseCrit, baseCritDmg, baseEvasion, baseThreat,
    seedHp, seedAtk, seedDef,
    equipResult,
    totalHp, totalAtk, totalDef,
    totalCrit, totalCritDmg, totalCritAttack,
    totalEvasion, totalThreat,
    jobElement: fixed.element,
  };
}
