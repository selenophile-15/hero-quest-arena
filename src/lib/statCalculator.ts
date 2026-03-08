/**
 * Stat Calculator - Phase 3: Full Formula
 * 
 * Formula:
 * - ATK/DEF/HP = (base + seeds + Σequipment + flat bonuses) × (1 + common%/100)
 * - Crit/Eva/CritDmg/Threat = base + equipment + skill/soul additive bonuses
 */

import { lookupHeroStats } from './gameData';
import { calculateEquipmentStats, parseEquipSkillBonuses, EquipCalcResult, EquipSlotCalc, SkillBonuses, RelicEffect } from './equipStatCalculator';
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

  // Relic effects
  relicEffects: RelicEffect[];
  // Pre-relic values (before fixed effects)
  preRelicCrit: number;
  preRelicEvasion: number;


  // Metadata
  jobName: string;
  jobElement: string;
}

export type { EquipCalcResult, EquipSlotCalc, SkillBonusSummary, SkillBonusSource, SkillBonuses, RelicEffect };

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

  // Process relic stat bonuses from equipped items
  const relicBonusFlat = { atk: 0, def: 0, hp: 0, crit: 0, critDmg: 0, evasion: 0, threat: 0 };
  const relicBonusPct = { atk: 0, def: 0, hp: 0 };

  for (const effect of equipResult.relicEffects) {
    if (effect.type === 'relic_bonus' && effect.bonuses) {
      for (const b of effect.bonuses) {
        const val = b.op === '감소' ? -b.value : b.value;
        if (b.op === '고정') continue; // Fixed effects handled separately
        switch (b.stat) {
          case '깡공격력': relicBonusFlat.atk += val; break;
          case '깡방어력': relicBonusFlat.def += val; break;
          case '깡체력': relicBonusFlat.hp += val; break;
          case '공격력%': relicBonusPct.atk += val; break;
          case '방어력%': relicBonusPct.def += val; break;
          case '체력%': relicBonusPct.hp += val; break;
          case '치명타확률%': relicBonusFlat.crit += val; break;
          case '치명타데미지%': relicBonusFlat.critDmg += val; break;
          case '회피%': relicBonusFlat.evasion += val; break;
          case '위협도': relicBonusFlat.threat += val; break;
        }
      }
    }
    // 키쿠 이치몬지 also gives +200% crit damage
    if (effect.type === 'crit_fixed') {
      relicBonusFlat.critDmg += 200;
    }
    // 락 스톰퍼 gives +250 def and +25% def
    if (effect.type === 'evasion_fixed') {
      relicBonusFlat.def += 250;
      relicBonusPct.def += 25;
    }
    // 평화의 목걸이 gives +20% hp and +10% evasion
    if (effect.type === 'weapon_nullify') {
      relicBonusPct.hp += 20;
      relicBonusFlat.evasion += 10;
    }
  }

  // Final formula: (base + seed + Σequip + flat + relicFlat) × (1 + (pct + relicPct)/100)
  const totalAtk = Math.floor((baseAtk + seedAtk + equipResult.totalAtk + bonusSummary.flatAtk + relicBonusFlat.atk) * (1 + (bonusSummary.pctAtk + relicBonusPct.atk) / 100));
  const totalDef = Math.floor((baseDef + seedDef + equipResult.totalDef + bonusSummary.flatDef + relicBonusFlat.def) * (1 + (bonusSummary.pctDef + relicBonusPct.def) / 100));
  const totalHp = Math.floor((baseHp + seedHp + equipResult.totalHp + bonusSummary.flatHp + relicBonusFlat.hp) * (1 + (bonusSummary.pctHp + relicBonusPct.hp) / 100));

  // Additive stats (including relic bonuses)
  let totalCrit = baseCrit + equipResult.totalCrit + bonusSummary.critRate + relicBonusFlat.crit;
  let totalCritDmg = baseCritDmg + bonusSummary.critDmg + relicBonusFlat.critDmg;
  let totalEvasion = baseEvasion + equipResult.totalEvasion + bonusSummary.evasion + relicBonusFlat.evasion;
  const totalThreat = baseThreat + bonusSummary.threat + relicBonusFlat.threat;

  // Store pre-relic values for display
  const preRelicCrit = totalCrit;
  const preRelicEvasion = totalEvasion;

  // Apply fixed relic effects
  const relicEffects = equipResult.relicEffects;
  
  // 키쿠 이치몬지: crit rate fixed at 20%
  const hasCritFixed = relicEffects.find(e => e.type === 'crit_fixed');
  if (hasCritFixed) {
    totalCrit = hasCritFixed.fixedValue!;
  }

  // 락 스톰퍼: evasion fixed at 0%
  const hasEvasionFixed = relicEffects.find(e => e.type === 'evasion_fixed');
  if (hasEvasionFixed) {
    totalEvasion = hasEvasionFixed.fixedValue!;
  }

  // Check manual relic bonuses for fixed effects
  for (const effect of relicEffects) {
    if (effect.type === 'relic_bonus' && effect.bonuses) {
      for (const b of effect.bonuses) {
        if (b.op !== '고정') continue;
        switch (b.stat) {
          case '치명타확률%': totalCrit = b.value; break;
          case '회피%': totalEvasion = b.value; break;
        }
      }
    }
  }

  // Crit attack = atk × critDmg / 100
  const totalCritAttack = Math.floor(totalAtk * totalCritDmg / 100);

  return {
    baseHp, baseAtk, baseDef,
    baseCrit, baseCritDmg, baseEvasion, baseThreat,
    seedHp, seedAtk, seedDef,
    equipResult,
    equipBonuses,
    bonusSummary,
    totalHp, totalAtk, totalDef,
    totalCrit, totalCritDmg, totalCritAttack,
    totalEvasion, totalThreat,
    relicEffects,
    preRelicCrit,
    preRelicEvasion,
    relicBonusFlat,
    relicBonusPct,
    jobName,
    jobElement: fixed.element,
  };
}
