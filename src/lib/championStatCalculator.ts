/**
 * Champion Stat Calculator
 * 
 * Calculates champion stats based on:
 * - Rank-based base stats + Level-based stats (from STD2_champion_stats.json)
 * - Champion Soul (promotion): rank+2 offset + 1.5x multiplier (rank stats only)
 * - Seeds: HP direct, ATK/DEF × 4
 * - Equipment stats (familiar + aurasong) with quality multiplier + element/spirit enchant
 * - Card level bonus (0=0%, 1=5%, 2=10%, 3=25%)
 * 
 * Formula: ROUND((rankStat × soulMult + levelStat + equipFinal + seedBonus) × (1 + cardLevelBonus%), 0)
 */

import {
  QUALITY_MULTIPLIER,
  loadElementStats,
  loadSpiritStats,
  getElementEnchantStats,
  getSpiritEnchantStats,
  capEnchant,
  type EnchantStats,
} from './equipStatCalculator';

export const CARD_LEVEL_BONUS: Record<number, number> = {
  0: 0,
  1: 5,
  2: 10,
  3: 25,
};

export interface ChampionEquipSlotCalc {
  slotName: string;         // '퍼밀리어' | '오라의 노래'
  itemName: string;
  tier: number;
  quality: string;
  qualityMult: number;
  // Base stats (common grade)
  baseAtk: number;
  baseDef: number;
  baseHp: number;
  baseCrit: number;
  baseEvasion: number;
  // Quality-applied stats
  qualityAtk: number;
  qualityDef: number;
  qualityHp: number;
  // Element enchant
  elementName: string;
  elementRawAtk: number;
  elementRawDef: number;
  elementRawHp: number;
  elementCapAtk: number;
  elementCapDef: number;
  elementCapHp: number;
  // Spirit enchant
  spiritName: string;
  spiritRawAtk: number;
  spiritRawDef: number;
  spiritRawHp: number;
  spiritCapAtk: number;
  spiritCapDef: number;
  spiritCapHp: number;
  // Final slot stats (quality + capped enchants)
  finalAtk: number;
  finalDef: number;
  finalHp: number;
  finalCrit: number;
  finalEvasion: number;
}

export interface ChampionCalcResult {
  // Champion info
  championName: string;
  rank: number;
  level: number;
  promoted: boolean;
  cardLevel: number;
  cardLevelBonusPct: number;

  // Level stats
  levelHp: number;
  levelAtk: number;
  levelDef: number;

  // Rank base stats (before promotion)
  rankBaseHp: number;
  rankBaseAtk: number;
  rankBaseDef: number;
  rankBaseElement: number;

  // Promoted rank stats (rank+2 lookup, raw — before 1.5x)
  promotedRankHp: number;
  promotedRankAtk: number;
  promotedRankDef: number;
  promotedRankElement: number;

  // After promotion multiplier (×1.5 or ×1.0)
  promotedHp: number;
  promotedAtk: number;
  promotedDef: number;

  // Seeds
  seedHp: number;
  seedAtk: number;
  seedDef: number;
  seedAtkMult: number;    // ×4
  seedDefMult: number;    // ×4

  // Equipment
  equipSlots: ChampionEquipSlotCalc[];
  totalEquipAtk: number;
  totalEquipDef: number;
  totalEquipHp: number;
  totalEquipCrit: number;
  totalEquipEvasion: number;

  // Subtotal (before card level bonus)
  subtotalHp: number;
  subtotalAtk: number;
  subtotalDef: number;

  // Final stats
  finalHp: number;
  finalAtk: number;
  finalDef: number;

  // Fixed stats (from champion data)
  fixedCrit: number;
  fixedCritDmg: number;
  fixedEvasion: number;
  fixedThreat: number;
  fixedElement: string;

  // Final with equipment bonuses
  totalCrit: number;
  totalEvasion: number;
  totalThreat: number;
  totalCritDmg: number;
  critAttack: number;

  // Non-promoted comparison
  nonPromotedHp: number;
  nonPromotedAtk: number;
  nonPromotedDef: number;
  nonPromotedFinalHp: number;
  nonPromotedFinalAtk: number;
  nonPromotedFinalDef: number;
}

interface RankData {
  '랭크': number;
  '기본_체력': number;
  '기본_공격력': number;
  '기본_방어력': number;
  '기본_원소': number;
}

interface LevelData {
  '레벨': number;
  '기본_체력': number;
  '기본_공격력': number;
  '기본_방어력': number;
}

export async function calculateChampionStats(params: {
  championData: any;
  rank: number;
  level: number;
  promoted: boolean;
  cardLevel: number;
  seeds: { hp: number; atk: number; def: number };
  equipmentSlots: Array<{
    item: any | null;
    quality: string;
    element: any | null;
    spirit: any | null;
  }>;
}): Promise<ChampionCalcResult | null> {
  const { championData, rank, level, promoted, cardLevel, seeds, equipmentSlots } = params;
  if (!championData) return null;

  const fixed = championData['고정_능력치'] || {};
  const rankArray: RankData[] = championData['랭크별_능력치'] || [];
  const levelArray: LevelData[] = championData['레벨별_능력치'] || [];

  // Find rank data
  const currentRankData = rankArray.find(r => r['랭크'] === rank);
  if (!currentRankData) return null;

  const rankBaseHp = currentRankData['기본_체력'] || 0;
  const rankBaseAtk = currentRankData['기본_공격력'] || 0;
  const rankBaseDef = currentRankData['기본_방어력'] || 0;
  const rankBaseElement = currentRankData['기본_원소'] || 0;

  // Find level data
  const currentLevelData = levelArray.find(l => l['레벨'] === level);
  const levelHp = currentLevelData ? (currentLevelData['기본_체력'] || 0) : 0;
  const levelAtk = currentLevelData ? (currentLevelData['기본_공격력'] || 0) : 0;
  const levelDef = currentLevelData ? (currentLevelData['기본_방어력'] || 0) : 0;

  // Promoted: lookup rank+2
  const promotedRankData = promoted ? rankArray.find(r => r['랭크'] === rank + 2) : null;
  const promotedRankHp = promotedRankData ? promotedRankData['기본_체력'] : rankBaseHp;
  const promotedRankAtk = promotedRankData ? promotedRankData['기본_공격력'] : rankBaseAtk;
  const promotedRankDef = promotedRankData ? promotedRankData['기본_방어력'] : rankBaseDef;
  const promotedRankElement = promotedRankData ? promotedRankData['기본_원소'] : rankBaseElement;

  // Apply promotion multiplier to rank stats only (level stats NOT affected)
  const soulMult = promoted ? 1.5 : 1.0;
  const promotedHp = promotedRankHp * soulMult;
  const promotedAtk = promotedRankAtk * soulMult;
  const promotedDef = promotedRankDef * soulMult;

  // Non-promoted stats (for comparison)
  const nonPromotedHp = rankBaseHp;
  const nonPromotedAtk = rankBaseAtk;
  const nonPromotedDef = rankBaseDef;

  // Load enchant data
  const [elementData, spiritData] = await Promise.all([
    loadElementStats(),
    loadSpiritStats(),
  ]);

  // Equipment calculation with enchant
  const SLOT_NAMES = ['퍼밀리어', '오라의 노래'];
  const equipSlots: ChampionEquipSlotCalc[] = [];
  let totalEquipAtk = 0, totalEquipDef = 0, totalEquipHp = 0, totalEquipCrit = 0, totalEquipEvasion = 0;

  for (let i = 0; i < 2; i++) {
    const slot = equipmentSlots[i];
    const item = slot?.item;
    if (!item) {
      equipSlots.push({
        slotName: SLOT_NAMES[i],
        itemName: '', tier: 0, quality: 'common', qualityMult: 1,
        baseAtk: 0, baseDef: 0, baseHp: 0, baseCrit: 0, baseEvasion: 0,
        qualityAtk: 0, qualityDef: 0, qualityHp: 0,
        elementName: '', elementRawAtk: 0, elementRawDef: 0, elementRawHp: 0,
        elementCapAtk: 0, elementCapDef: 0, elementCapHp: 0,
        spiritName: '', spiritRawAtk: 0, spiritRawDef: 0, spiritRawHp: 0,
        spiritCapAtk: 0, spiritCapDef: 0, spiritCapHp: 0,
        finalAtk: 0, finalDef: 0, finalHp: 0, finalCrit: 0, finalEvasion: 0,
      });
      continue;
    }

    const quality = slot.quality || 'common';
    const qualityMult = QUALITY_MULTIPLIER[quality] || 1;

    // Base stats (common grade)
    const getStatVal = (key: string) => {
      const found = item.stats?.find((s: any) => s.key === key);
      return found ? found.value : 0;
    };

    const baseAtk = getStatVal('장비_공격력');
    const baseDef = getStatVal('장비_방어력');
    const baseHp = getStatVal('장비_체력');
    const baseCrit = getStatVal('장비_치명타확률%');
    const baseEvasion = getStatVal('장비_회피%');

    // Quality-applied stats
    const qualityAtk = Math.floor(baseAtk * qualityMult);
    const qualityDef = Math.floor(baseDef * qualityMult);
    const qualityHp = Math.floor(baseHp * qualityMult);

    // Element enchantment
    let elementRaw: EnchantStats = { atk: 0, def: 0, hp: 0 };
    let elementName = '';
    if (slot.element) {
      elementRaw = getElementEnchantStats(elementData, slot.element.tier, slot.element.affinity);
      elementName = `${slot.element.tier}티어 ${slot.element.affinity ? '(친밀)' : ''}`;
    }

    // Spirit enchantment
    let spiritRaw: EnchantStats = { atk: 0, def: 0, hp: 0 };
    let spiritName = '';
    if (slot.spirit) {
      spiritRaw = getSpiritEnchantStats(spiritData, slot.spirit.name, slot.spirit.affinity);
      spiritName = `${slot.spirit.name} ${slot.spirit.affinity ? '(친밀)' : ''}`;
    }

    // Cap enchantments against BASE (common grade) stats
    const elementCapAtk = capEnchant(elementRaw.atk, baseAtk);
    const elementCapDef = capEnchant(elementRaw.def, baseDef);
    const elementCapHp = capEnchant(elementRaw.hp, baseHp);
    const spiritCapAtk = capEnchant(spiritRaw.atk, baseAtk);
    const spiritCapDef = capEnchant(spiritRaw.def, baseDef);
    const spiritCapHp = capEnchant(spiritRaw.hp, baseHp);

    // Final = quality + capped enchants
    const finalAtk = qualityAtk + elementCapAtk + spiritCapAtk;
    const finalDef = qualityDef + elementCapDef + spiritCapDef;
    const finalHp = qualityHp + elementCapHp + spiritCapHp;
    const finalCrit = baseCrit;
    const finalEvasion = baseEvasion;

    equipSlots.push({
      slotName: SLOT_NAMES[i],
      itemName: item.name || '',
      tier: item.tier || 0,
      quality, qualityMult,
      baseAtk, baseDef, baseHp, baseCrit, baseEvasion,
      qualityAtk, qualityDef, qualityHp,
      elementName, elementRawAtk: elementRaw.atk, elementRawDef: elementRaw.def, elementRawHp: elementRaw.hp,
      elementCapAtk, elementCapDef, elementCapHp,
      spiritName, spiritRawAtk: spiritRaw.atk, spiritRawDef: spiritRaw.def, spiritRawHp: spiritRaw.hp,
      spiritCapAtk, spiritCapDef, spiritCapHp,
      finalAtk, finalDef, finalHp, finalCrit, finalEvasion,
    });

    totalEquipAtk += finalAtk;
    totalEquipDef += finalDef;
    totalEquipHp += finalHp;
    totalEquipCrit += finalCrit;
    totalEquipEvasion += finalEvasion;
  }

  // Seeds
  const seedHp = seeds.hp || 0;
  const seedAtk = seeds.atk || 0;
  const seedDef = seeds.def || 0;
  const seedAtkMult = seedAtk * 4;
  const seedDefMult = seedDef * 4;

  // Subtotal (before card level bonus)
  const subtotalHp = promotedHp + levelHp + totalEquipHp + seedHp;
  const subtotalAtk = promotedAtk + levelAtk + totalEquipAtk + seedAtkMult;
  const subtotalDef = promotedDef + levelDef + totalEquipDef + seedDefMult;

  // Non-promoted subtotals
  const nonPromotedSubHp = nonPromotedHp + levelHp + totalEquipHp + seedHp;
  const nonPromotedSubAtk = nonPromotedAtk + levelAtk + totalEquipAtk + seedAtkMult;
  const nonPromotedSubDef = nonPromotedDef + levelDef + totalEquipDef + seedDefMult;

  // Card level bonus
  const cardLevelBonusPct = CARD_LEVEL_BONUS[cardLevel] || 0;
  const cardMult = 1 + cardLevelBonusPct / 100;

  // Final
  const finalHp = Math.round(subtotalHp * cardMult);
  const finalAtk = Math.round(subtotalAtk * cardMult);
  const finalDef = Math.round(subtotalDef * cardMult);

  const nonPromotedFinalHp = Math.round(nonPromotedSubHp * cardMult);
  const nonPromotedFinalAtk = Math.round(nonPromotedSubAtk * cardMult);
  const nonPromotedFinalDef = Math.round(nonPromotedSubDef * cardMult);

  // Fixed stats
  const fixedCrit = fixed['기본_치명타확률%'] || 5;
  const fixedCritDmg = fixed['기본_치명타데미지%'] || 200;
  const fixedEvasion = fixed['기본_회피%'] || 0;
  const fixedThreat = fixed['기본_위협도'] || 90;
  const fixedElement = fixed['직업_원소'] || '';

  const totalCrit = fixedCrit + totalEquipCrit;
  const totalEvasion = fixedEvasion + totalEquipEvasion;
  const totalThreat = fixedThreat;
  const totalCritDmg = fixedCritDmg;
  const critAttack = finalAtk && totalCritDmg ? Math.floor(finalAtk * totalCritDmg / 100) : 0;

  return {
    championName: '',
    rank, level, promoted, cardLevel, cardLevelBonusPct,
    levelHp, levelAtk, levelDef,
    rankBaseHp, rankBaseAtk, rankBaseDef, rankBaseElement,
    promotedRankHp, promotedRankAtk, promotedRankDef, promotedRankElement,
    promotedHp, promotedAtk, promotedDef,
    seedHp, seedAtk, seedDef, seedAtkMult, seedDefMult,
    equipSlots,
    totalEquipAtk, totalEquipDef, totalEquipHp, totalEquipCrit, totalEquipEvasion,
    subtotalHp, subtotalAtk, subtotalDef,
    finalHp, finalAtk, finalDef,
    fixedCrit, fixedCritDmg, fixedEvasion, fixedThreat, fixedElement,
    totalCrit, totalEvasion, totalThreat, totalCritDmg, critAttack,
    nonPromotedHp, nonPromotedAtk, nonPromotedDef,
    nonPromotedFinalHp, nonPromotedFinalAtk, nonPromotedFinalDef,
  };
}
