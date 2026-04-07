/**
 * Stat Calculator - Phase 3: Full Formula
 * 
 * Formula:
 * - ATK/DEF/HP = (base + seeds + Σequipment + flat bonuses) × (1 + common%/100)
 * - Crit/Eva/CritDmg/Threat = base + equipment + skill/soul additive bonuses
 */

import { lookupHeroStats } from './gameData';
import { calculateEquipmentStats, parseEquipSkillBonuses, EquipCalcResult, EquipSlotCalc, SkillBonuses, RelicEffect, EquipBonusSource } from './equipStatCalculator';
import { parseSkillBonuses, parseSoulBonuses, combineBonuses, SkillBonusSummary, SkillBonusInput, SoulBonusInput, SkillBonusSource, DetailStatsSummary } from './skillBonusParser';

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

  // Detail stats (auto-calculated)
  detailStats: Record<string, number>;

  // Metadata
  jobName: string;
  jobElement: string;
}

export type { EquipCalcResult, EquipSlotCalc, SkillBonusSummary, SkillBonusSource, SkillBonuses, RelicEffect, EquipBonusSource, DetailStatsSummary };

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
  totalElementPoints: number; // 풍수사: total element points for atk% bonus
  // Skill data for equipment bonuses + general bonuses
  skillBonusInputs: Array<{
    bonusData: Record<string, number | number[]>;
    appliedEquip: string[][] | undefined;
    skillLevel: number;
    skillType: 'unique' | 'common';
    skillName: string;
  }>;
  // Skill data for general stat parsing (with names)
  skillInputs: SkillBonusInput[];
}

export async function calculateHeroStats(input: CalcInput): Promise<CalculatedStats | null> {
  const { jobName, level, seeds, equipmentSlots, hasRangedWeapon, totalElementPoints, skillBonusInputs, skillInputs } = input;
  if (!jobName || !level) return null;

  const statsData = await lookupHeroStats(jobName, level);
  if (!statsData) return null;

  const { level: levelStats, fixed } = statsData;

  // Jobs that don't use weapons (수도승/그랜드마스터, 경보병/근위병)
  const WEAPONLESS_JOBS = new Set(['수도승', '그랜드 마스터', '경보병', '근위병']);
  const isWeaponlessJob = WEAPONLESS_JOBS.has(jobName);

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
  const isSpellknight = jobName === '스펠나이트';
  const equipResult = await calculateEquipmentStats(equipmentSlots, equipBonuses, hasRangedWeapon, isSpellknight, isWeaponlessJob);

  // Parse general skill bonuses (flat + %)
  const skillResult = parseSkillBonuses(skillInputs);

  // Parse soul bonuses from equipped spirits
  const soulInputs: SoulBonusInput[] = equipmentSlots
    .map((slot, i) => ({
      slotIndex: i,
      spiritName: slot.spirit?.name || '',
      affinity: slot.spirit?.affinity || false,
      isIdol: slot.item?.type === 'idol' || slot.item?.typeKor === '우상' || slot.item?.manualData?.type === '우상',
    }))
    .filter(s => s.spiritName);

  const soulResult = await parseSoulBonuses(soulInputs);

  // Combine all bonuses
  const bonusSummary = combineBonuses(skillResult, soulResult);

  // Process relic stat bonuses — merge into bonusSummary as relic sources
  for (const effect of equipResult.relicEffects) {
    const src = { name: '', type: 'relic' as const, flatAtk: 0, flatDef: 0, flatHp: 0, pctAtk: 0, pctDef: 0, pctHp: 0, critRate: 0, critDmg: 0, evasion: 0, threat: 0 };
    let hasBonus = false;

    if (effect.type === 'relic_bonus' && effect.bonuses) {
      src.name = effect.itemName;
      for (const b of effect.bonuses) {
        if (b.op === '고정') continue;
        const val = b.op === '감소' ? -b.value : b.value;
        switch (b.stat) {
          case '깡공격력': src.flatAtk += val; break;
          case '깡방어력': src.flatDef += val; break;
          case '깡체력': src.flatHp += val; break;
          case '공격력%': src.pctAtk += val; break;
          case '방어력%': src.pctDef += val; break;
          case '체력%': src.pctHp += val; break;
          case '치명타확률%': src.critRate += val; break;
          case '치명타데미지%': src.critDmg += val; break;
          case '회피%': src.evasion += val; break;
          case '위협도': src.threat += val; break;
        }
        hasBonus = true;
      }
    }
    if (effect.type === 'crit_fixed') {
      src.name = effect.itemName;
      src.critDmg += 200;
      hasBonus = true;
    }
    if (effect.type === 'evasion_fixed') {
      src.name = effect.itemName;
      src.flatDef += 250;
      src.pctDef += 25;
      hasBonus = true;
    }
    if (effect.type === 'weapon_nullify') {
      src.name = effect.itemName;
      src.pctHp += 20;
      src.evasion += 10;
      hasBonus = true;
    }

    if (hasBonus) {
      bonusSummary.sources.push(src);
      bonusSummary.flatAtk += src.flatAtk;
      bonusSummary.flatDef += src.flatDef;
      bonusSummary.flatHp += src.flatHp;
      bonusSummary.pctAtk += src.pctAtk;
      bonusSummary.pctDef += src.pctDef;
      bonusSummary.pctHp += src.pctHp;
      bonusSummary.critRate += src.critRate;
      bonusSummary.critDmg += src.critDmg;
      bonusSummary.evasion += src.evasion;
      bonusSummary.threat += src.threat;
    }
  }

  // === Special job mechanics ===

  // 경보병/근위병: shield's final defense → added to flat ATK
  const isPraetorian = jobName === '경보병' || jobName === '근위병';
  let shieldDefToAtk = 0;
  if (isPraetorian) {
    for (const slot of equipResult.slots) {
      if (slot.itemType === 'shield') {
        shieldDefToAtk += slot.finalDef;
      }
    }
    if (shieldDefToAtk > 0) {
      bonusSummary.flatAtk += shieldDefToAtk;
      bonusSummary.sources.push({
        name: `방패 방어력→공격력 (${jobName})`,
      type: 'unique' as const,
      flatAtk: shieldDefToAtk, flatDef: 0, flatHp: 0,
      pctAtk: 0, pctDef: 0, pctHp: 0,
      critRate: 0, critDmg: 0, evasion: 0, threat: 0,
      });
    }
  }

  // 풍수사/아스트라맨서: total element points × 1% added to common ATK %
  const isGeomancer = jobName === '풍수사' || jobName === '아스트라맨서';
  if (isGeomancer && totalElementPoints > 0) {
    const elementAtkPct = totalElementPoints; // 1% per point
    bonusSummary.pctAtk += elementAtkPct;
    bonusSummary.sources.push({
      name: `원소 포인트 ${totalElementPoints}pt → +${elementAtkPct}%`,
      type: 'unique' as const,
      flatAtk: 0, flatDef: 0, flatHp: 0,
      pctAtk: elementAtkPct, pctDef: 0, pctHp: 0,
      critRate: 0, critDmg: 0, evasion: 0, threat: 0,
    });
  }

  // Compute threat first (족장 needs it for ATK calculation)
  const totalThreat = baseThreat + bonusSummary.threat;

  // 족장: final threat × 40% → added to common ATK %
  const isChieftain = jobName === '족장';
  if (isChieftain && totalThreat > 0) {
    const threatAtkPct = Math.floor(totalThreat * 0.4 * 10) / 10;
    bonusSummary.pctAtk += threatAtkPct;
    bonusSummary.sources.push({
      name: `위협도 ${totalThreat}의 40% → +${threatAtkPct}%`,
      type: 'unique' as const,
      flatAtk: 0, flatDef: 0, flatHp: 0,
      pctAtk: threatAtkPct, pctDef: 0, pctHp: 0,
      critRate: 0, critDmg: 0, evasion: 0, threat: 0,
    });
  }

  // Final formula: (base + seed + Σequip + flat) × (1 + pct/100)
  const totalAtk = Math.round((baseAtk + seedAtk + equipResult.totalAtk + bonusSummary.flatAtk) * (1 + bonusSummary.pctAtk / 100));
  const totalDef = Math.round((baseDef + seedDef + equipResult.totalDef + bonusSummary.flatDef) * (1 + bonusSummary.pctDef / 100));
  const totalHp = Math.round((baseHp + seedHp + equipResult.totalHp + bonusSummary.flatHp) * (1 + bonusSummary.pctHp / 100));

  // Additive stats
  let totalCrit = baseCrit + equipResult.totalCrit + bonusSummary.critRate;
  let totalCritDmg = baseCritDmg + bonusSummary.critDmg;
  let totalEvasion = baseEvasion + equipResult.totalEvasion + bonusSummary.evasion;

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

  // Build detail stats from bonusSummary.detail
  const d = bonusSummary.detail;
  const detailStats: Record<string, number> = {};
  detailStats['공통 공격력 계수'] = bonusSummary.pctAtk;
  detailStats['공통 방어력 계수'] = bonusSummary.pctDef;
  detailStats['공통 체력 계수'] = bonusSummary.pctHp;
  if (d.hpRegenPerTurn) detailStats['매 턴 체력 재생'] = d.hpRegenPerTurn;
  if (d.survivalChance) detailStats['죽기 전 공격 한 번 버틸 확률'] = d.survivalChance;
  if (d.restReduction) detailStats['휴식시간 감소%'] = d.restReduction;

  // Conditional ATK bonuses — store % values only (actual ATK computed in simulation)
  if (d.sharkAtkPct) {
    detailStats['상어 - 적 HP 50% 미만 시 공격력 증가%'] = d.sharkAtkPct;
  }
  if (d.dinoAtkPct) {
    detailStats['공룡 - 첫 턴 공격력 증가%'] = d.dinoAtkPct;
  }
  if (d.mundraBosPct) {
    detailStats['문드라 - 보스 상대 공격력/방어력 증가%'] = d.mundraBosPct;
  }

  // Berserker: tier-aware thresholds and per-stage ATK/EVA bonuses
  const isBerserker = jobName === '광전사' || jobName === '잘';
  const berserkerLabel = jobName === '잘' ? '잘' : '광전사';
  if (isBerserker && d.berserkerAtkPct) {
    const isT4 = jobName === '잘';
    const t1 = isT4 ? 80 : 75;
    const t2 = isT4 ? 55 : 50;
    const t3 = isT4 ? 30 : 25;
    detailStats[`${berserkerLabel} - 1단계 (${t2}%<HP≤${t1}%) 공격력 증가%`] = d.berserkerAtkPct;
    detailStats[`${berserkerLabel} - 2단계 (${t3}%<HP≤${t2}%) 공격력 증가%`] = d.berserkerAtkPct * 2;
    detailStats[`${berserkerLabel} - 3단계 (HP≤${t3}%) 공격력 증가%`] = d.berserkerAtkPct * 3;
  }
  if (isBerserker && d.berserkerEvaPct) {
    const isT4 = jobName === '잘';
    const t1 = isT4 ? 80 : 75;
    const t2 = isT4 ? 55 : 50;
    const t3 = isT4 ? 30 : 25;
    detailStats[`${berserkerLabel} - 1단계 (${t2}%<HP≤${t1}%) 회피 증가%`] = d.berserkerEvaPct;
    detailStats[`${berserkerLabel} - 2단계 (${t3}%<HP≤${t2}%) 회피 증가%`] = d.berserkerEvaPct * 2;
    detailStats[`${berserkerLabel} - 3단계 (HP≤${t3}%) 회피 증가%`] = d.berserkerEvaPct * 3;
  }

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
    detailStats,
    jobName,
    jobElement: fixed.element,
  };
}
