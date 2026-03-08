/**
 * Stat Calculator - Phase 3: Full Formula
 * 
 * Formula:
 * - ATK/DEF/HP = (base + seeds + Σequipment + flat bonuses) × (1 + common%/100)
 * - Crit/Eva/CritDmg/Threat = base + equipment + skill/soul additive bonuses
 */

import { lookupHeroStats } from './gameData';
import { calculateEquipmentStats, parseEquipSkillBonuses, EquipCalcResult, EquipSlotCalc, SkillBonuses } from './equipStatCalculator';
import { parseSkillBonuses, parseSoulBonuses, combineBonuses, SkillBonusSummary, SkillBonusInput, SoulBonusInput, SkillBonusSource } from './skillBonusParser';

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

  // Equipment-specific skill bonuses (해당장비/모든장비)
  equipBonuses: SkillBonuses;

  // Skill & Soul bonuses
  bonusSummary: SkillBonusSummary;

  // Final totals
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

export type { EquipCalcResult, EquipSlotCalc, SkillBonusSummary, SkillBonusSource, SkillBonuses };

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
  // Skill data for equipment bonuses + general bonuses
  skillBonusInputs: Array<{
    bonusData: Record<string, number | number[]>;
    appliedEquip: string[][] | undefined;
    skillLevel: number;
  }>;
  // Skill data for general stat parsing (with names)
  skillInputs: SkillBonusInput[];
}

export async function calculateHeroStats(input: CalcInput): Promise<CalculatedStats | null> {
  const { jobName, level, seeds, equipmentSlots, hasRangedWeapon, skillBonusInputs, skillInputs } = input;
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

  // Equipment calculation (includes equipment-specific skill bonuses)
  const equipBonuses = parseEquipSkillBonuses(skillBonusInputs);
  const equipResult = await calculateEquipmentStats(equipmentSlots, equipBonuses, hasRangedWeapon);

  // Parse general skill bonuses (flat + %)
  const skillResult = parseSkillBonuses(skillInputs);

  // Parse soul bonuses from equipped spirits
  const soulInputs: SoulBonusInput[] = equipmentSlots
    .map((slot, i) => ({
      slotIndex: i,
      spiritName: slot.spirit?.name || '',
      affinity: slot.spirit?.affinity || false,
    }))
    .filter(s => s.spiritName);

  const soulResult = await parseSoulBonuses(soulInputs);

  // Combine all bonuses
  const bonusSummary = combineBonuses(skillResult, soulResult);

  // Final formula: (base + seed + Σequip + flat) × (1 + pct/100)
  const totalAtk = Math.floor((baseAtk + seedAtk + equipResult.totalAtk + bonusSummary.flatAtk) * (1 + bonusSummary.pctAtk / 100));
  const totalDef = Math.floor((baseDef + seedDef + equipResult.totalDef + bonusSummary.flatDef) * (1 + bonusSummary.pctDef / 100));
  const totalHp = Math.floor((baseHp + seedHp + equipResult.totalHp + bonusSummary.flatHp) * (1 + bonusSummary.pctHp / 100));

  // Additive stats
  const totalCrit = baseCrit + equipResult.totalCrit + bonusSummary.critRate;
  const totalCritDmg = baseCritDmg + bonusSummary.critDmg;
  const totalEvasion = baseEvasion + equipResult.totalEvasion + bonusSummary.evasion;
  const totalThreat = baseThreat + bonusSummary.threat;

  // Crit attack = atk × critDmg / 100
  const totalCritAttack = Math.floor(totalAtk * totalCritDmg / 100);

  return {
    baseHp, baseAtk, baseDef,
    baseCrit, baseCritDmg, baseEvasion, baseThreat,
    seedHp, seedAtk, seedDef,
    equipResult,
    bonusSummary,
    totalHp, totalAtk, totalDef,
    totalCrit, totalCritDmg, totalCritAttack,
    totalEvasion, totalThreat,
    jobElement: fixed.element,
  };
}
