/**
 * Equipment Stat Calculator
 * 
 * Computes per-slot and total equipment stats including:
 * - Quality multiplier (common=1, uncommon=1.25, flawless=1.5, epic=2, legendary=3)
 * - Enchantment (element + spirit) with capping rule
 * - Per-equipment skill bonuses (해당장비) and all-equipment bonuses (모든장비)
 */

export const QUALITY_MULTIPLIER: Record<string, number> = {
  common: 1, uncommon: 1.25, flawless: 1.5, epic: 2, legendary: 3,
};

export interface EnchantStats {
  atk: number;
  def: number;
  hp: number;
}

export interface EquipSlotCalc {
  slotIndex: number;
  itemName: string;
  itemType: string;       // file type (sword, shield, etc.)
  itemTypeKor: string;    // Korean type name
  category: string;       // weapon, armor, accessory
  judgmentTypes: string[]; // For dual wield: actual weapon types for matching

  // Base stats (common grade, after unique element/spirit adjustment)
  baseAtk: number;
  baseDef: number;
  baseHp: number;
  baseCrit: number;
  baseEvasion: number;

  // Quality-applied stats
  qualityAtk: number;
  qualityDef: number;
  qualityHp: number;

  // Enchantment raw stats (after affinity)
  elementRawAtk: number;
  elementRawDef: number;
  elementRawHp: number;
  spiritRawAtk: number;
  spiritRawDef: number;
  spiritRawHp: number;

  // Enchantment capped stats (min with base)
  elementCapAtk: number;
  elementCapDef: number;
  elementCapHp: number;
  spiritCapAtk: number;
  spiritCapDef: number;
  spiritCapHp: number;

  // Before bonus (quality + capped enchants)
  preBonusAtk: number;
  preBonusDef: number;
  preBonusHp: number;

  // Spellknight coefficient (1.0 normally, 1.5 for unique element items)
  spellknightMult: number;

  // Skill bonus multipliers applied to this slot
  bonusAtkPct: number;  // sum of all applicable % for atk
  bonusDefPct: number;
  bonusHpPct: number;

  // Quiver bonus (added last, 30% of pre-bonus)
  quiverBonusAtk: number;
  quiverBonusDef: number;
  quiverBonusHp: number;

  // Final slot stats
  finalAtk: number;
  finalDef: number;
  finalHp: number;
  finalCrit: number;
  finalEvasion: number;
}

export interface EquipCalcResult {
  slots: EquipSlotCalc[];
  totalAtk: number;
  totalDef: number;
  totalHp: number;
  totalCrit: number;
  totalEvasion: number;
  // Relic effects detected
  relicEffects: RelicEffect[];
}

export interface RelicEffect {
  itemName: string;
  slotIndex: number;
  type: 'crit_fixed' | 'evasion_fixed' | 'weapon_nullify' | 'self_double' | 'relic_bonus';
  description: string;
  // For fixed effects
  fixedValue?: number;
  // For relic bonuses
  bonuses?: { stat: string; op: string; value: number }[];
}

interface SlotInput {
  item: any | null;
  quality: string;
  element: { type: string; tier: number; affinity: boolean } | null;
  spirit: { name: string; affinity: boolean } | null;
}

export interface EquipBonusSource {
  skillName: string;
  skillType: 'unique' | 'common';
  bonusKey: string; // e.g. '해당장비공격력', '모든장비전체'
  equipType?: string; // Korean equip type name (for 해당장비 only)
  value: number;
}

export interface SkillBonuses {
  // Per equipment type Korean name → bonus %
  해당장비공격력: Record<string, number>;
  해당장비방어력: Record<string, number>;
  해당장비체력: Record<string, number>;
  해당장비전체: Record<string, number>;
  // All equipment bonuses
  모든장비공격력: number;
  모든장비방어력: number;
  모든장비체력: number;
  모든장비전체: number;
  // Source tracking for UI display
  sources: EquipBonusSource[];
}

// Cached data
let elementStatsCache: Record<string, any> | null = null;
let spiritStatsCache: Record<string, any> | null = null;

export async function loadElementStats(): Promise<Record<string, any>> {
  if (elementStatsCache) return elementStatsCache;
  try {
    const resp = await fetch('/data/STD3_element_stats.json');
    elementStatsCache = await resp.json();
    return elementStatsCache!;
  } catch {
    return {};
  }
}

export async function loadSpiritStats(): Promise<Record<string, any>> {
  if (spiritStatsCache) return spiritStatsCache;
  try {
    const resp = await fetch('/data/equipment/enchantment/spirit.json');
    spiritStatsCache = await resp.json();
    return spiritStatsCache!;
  } catch {
    return {};
  }
}

export function getElementEnchantStats(
  elementData: Record<string, any>,
  tier: number,
  affinity: boolean,
  isAllElementAffinity: boolean = false
): EnchantStats {
  const tierKey = `${tier}티어`;
  const entry = elementData[tierKey];
  if (!entry) return { atk: 0, def: 0, hp: 0 };

  // "모든 원소" affinity gets the same stat bonus as specific affinity (50%)
  // The only penalty for "모든 원소" is on element value (+5 instead of +10), handled elsewhere
  const sub = affinity ? entry['O'] : entry['X'];
  if (!sub) return { atk: 0, def: 0, hp: 0 };
  return {
    atk: sub['원소_공격력'] || 0,
    def: sub['원소_방어력'] || 0,
    hp: sub['원소_체력'] || 0,
  };
}

export function getSpiritEnchantStats(
  spiritData: Record<string, any>,
  spiritName: string,
  affinity: boolean
): EnchantStats {
  // Search all tiers dynamically instead of using a hardcoded tier map
  for (const [, tierGroup] of Object.entries(spiritData)) {
    if (typeof tierGroup !== 'object' || tierGroup === null) continue;
    const spiritEntry = tierGroup[spiritName];
    if (!spiritEntry) continue;
    const sub = affinity ? spiritEntry['O'] : spiritEntry['X'];
    if (!sub) return { atk: 0, def: 0, hp: 0 };
    return {
      atk: sub['영혼_공격력'] || 0,
      def: sub['영혼_방어력'] || 0,
      hp: sub['영혼_체력'] || 0,
    };
  }
  return { atk: 0, def: 0, hp: 0 };
}

export function capEnchant(enchantVal: number, baseVal: number): number {
  if (baseVal <= 0) return 0;
  return Math.min(enchantVal, baseVal);
}

/**
 * Reverse-engineer the true base stat from a displayed JSON stat value
 * that includes baked-in enchantment(s).
 * 
 * The game adds min(base, enchant) to base, so:
 *   displayedStat = base + min(base, enchant)
 * 
 * Solving for base:
 *   if displayedStat <= enchant * 2 → base = displayedStat / 2
 *   else → base = displayedStat - enchant
 * 
 * If displayedStat is 0, base is 0 (stat doesn't exist on item).
 */
export function reverseEnchantBase(jsonStat: number, enchantStat: number): number {
  if (jsonStat <= 0) return 0;
  if (enchantStat <= 0) return jsonStat;
  if (jsonStat <= enchantStat * 2) return jsonStat / 2;
  return jsonStat - enchantStat;
}

/**
 * Reverse-engineer base stat from displayed value with TWO baked-in enchantments.
 * displayedStat = base + min(base, e1) + min(base, e2)
 */
export function reverseEnchantBaseDual(jsonStat: number, enchant1: number, enchant2: number): number {
  if (jsonStat <= 0) return 0;
  if (enchant1 <= 0 && enchant2 <= 0) return jsonStat;
  if (enchant1 <= 0) return reverseEnchantBase(jsonStat, enchant2);
  if (enchant2 <= 0) return reverseEnchantBase(jsonStat, enchant1);

  const maxE = Math.max(enchant1, enchant2);
  const minE = Math.min(enchant1, enchant2);

  // Case 1: base >= max(e1, e2) → displayed = base + e1 + e2
  const baseCase1 = jsonStat - enchant1 - enchant2;
  if (baseCase1 >= maxE) return baseCase1;

  // Case 2: base < min(e1, e2) → displayed = 3 * base
  const baseCase2 = jsonStat / 3;
  if (baseCase2 < minE) return baseCase2;

  // Case 3: minE <= base < maxE → displayed = 2*base + minE
  return (jsonStat - minE) / 2;
}

function getItemBaseStat(item: any, key: string): number {
  if (!item?.stats) return 0;
  const found = item.stats.find((s: any) => s.key === key);
  return found?.value || 0;
}

// Reverse map: file type → Korean type names
import { EQUIP_TYPE_MAP } from './equipmentUtils';

const FILE_TO_KOR: Record<string, string[]> = {};
for (const [kor, { file }] of Object.entries(EQUIP_TYPE_MAP)) {
  if (!FILE_TO_KOR[file]) FILE_TO_KOR[file] = [];
  FILE_TO_KOR[file].push(kor);
}

/**
 * Parse skill bonuses from skills data into equipment-applicable bonuses.
 * 
 * skillBonuses: array of { bonusData: Record<string, number[]>, appliedEquip: string[][], skillLevel: number }
 */
export function parseEquipSkillBonuses(
  skills: Array<{
    bonusData: Record<string, number | number[]>;
    appliedEquip: string[][] | undefined;
    skillLevel: number;
    skillType: 'unique' | 'common';
    skillName: string;
  }>
): SkillBonuses {
  const result: SkillBonuses = {
    해당장비공격력: {},
    해당장비방어력: {},
    해당장비체력: {},
    해당장비전체: {},
    모든장비공격력: 0,
    모든장비방어력: 0,
    모든장비체력: 0,
    모든장비전체: 0,
    sources: [],
  };

  for (const skill of skills) {
    const { bonusData, appliedEquip, skillLevel, skillType, skillName } = skill;
    const lvl = skillLevel;

    for (const [key, rawVal] of Object.entries(bonusData)) {
      const val = Array.isArray(rawVal) ? (rawVal[lvl] ?? 0) : rawVal;
      if (val === 0) continue;

      const equipTypes = appliedEquip?.[lvl] || [];

      if (key === '스킬_해당장비공격력%') {
        for (const eq of equipTypes) {
          result.해당장비공격력[eq] = (result.해당장비공격력[eq] || 0) + val;
          result.sources.push({ skillName, skillType, bonusKey: '해당장비공격력', equipType: eq, value: val });
        }
      } else if (key === '스킬_해당장비방어력%') {
        for (const eq of equipTypes) {
          result.해당장비방어력[eq] = (result.해당장비방어력[eq] || 0) + val;
          result.sources.push({ skillName, skillType, bonusKey: '해당장비방어력', equipType: eq, value: val });
        }
      } else if (key === '스킬_해당장비체력%') {
        for (const eq of equipTypes) {
          result.해당장비체력[eq] = (result.해당장비체력[eq] || 0) + val;
          result.sources.push({ skillName, skillType, bonusKey: '해당장비체력', equipType: eq, value: val });
        }
      } else if (key === '스킬_해당장비전체%') {
        for (const eq of equipTypes) {
          result.해당장비전체[eq] = (result.해당장비전체[eq] || 0) + val;
          result.sources.push({ skillName, skillType, bonusKey: '해당장비전체', equipType: eq, value: val });
        }
      } else if (key === '스킬_모든장비공격력%') {
        result.모든장비공격력 += val;
        result.sources.push({ skillName, skillType, bonusKey: '모든장비공격력', value: val });
      } else if (key === '스킬_모든장비방어력%') {
        result.모든장비방어력 += val;
        result.sources.push({ skillName, skillType, bonusKey: '모든장비방어력', value: val });
      } else if (key === '스킬_모든장비체력%') {
        result.모든장비체력 += val;
        result.sources.push({ skillName, skillType, bonusKey: '모든장비체력', value: val });
      } else if (key === '스킬_모든장비전체%') {
        result.모든장비전체 += val;
        result.sources.push({ skillName, skillType, bonusKey: '모든장비전체', value: val });
      }
    }
  }

  return result;
}

/**
 * Check if a given equipment type (Korean) matches the slot's item
 */
function equipTypeMatchesSlot(equipTypeKor: string, itemTypeKor: string): boolean {
  return equipTypeKor === itemTypeKor;
}

/**
 * Calculate equipment stats for all 6 slots
 */
export async function calculateEquipmentStats(
  slots: SlotInput[],
  skillBonuses: SkillBonuses,
  hasRangedWeapon: boolean,
  isSpellknight: boolean = false,
  isWeaponlessJob: boolean = false,
): Promise<EquipCalcResult> {
  const [elementData, spiritData] = await Promise.all([
    loadElementStats(),
    loadSpiritStats(),
  ]);

  const slotResults: EquipSlotCalc[] = [];
  const relicEffects: RelicEffect[] = [];

  // First pass: detect relics and their effects
  // 평화의 목걸이 weapon nullify doesn't apply to weaponless jobs
  const hasWeaponNullify = !isWeaponlessJob && slots.some(s => s?.item?.name === '평화의 목걸이');
  
  // 화살통 보너스: 활/크로스보우/총에 30% 보너스 적용
  const hasQuiver = slots.some(s => s?.item?.type === 'quiver');
  
  for (let i = 0; i < 6; i++) {
    const slot = slots[i];
    const item = slot?.item;

    if (!item) {
      slotResults.push(emptySlotCalc(i));
      continue;
    }

    // Detect named relic effects
    if (item.name === '키쿠 이치몬지') {
      relicEffects.push({
        itemName: item.name, slotIndex: i, type: 'crit_fixed',
        description: '치명타 확률 20%로 고정', fixedValue: 20,
      });
    }
    if (item.name === '락 스톰퍼') {
      relicEffects.push({
        itemName: item.name, slotIndex: i, type: 'evasion_fixed',
        description: '회피 0%로 고정', fixedValue: 0,
      });
    }
    if (item.name === '평화의 목걸이') {
      relicEffects.push({
        itemName: item.name, slotIndex: i, type: 'weapon_nullify',
        description: '장착한 무기의 스탯 무효화',
      });
    }
    if (item.name === '역효과 해머') {
      relicEffects.push({
        itemName: item.name, slotIndex: i, type: 'self_double',
        description: '이 장비 스탯 +100% (2배 적용)',
      });
    }

    // Detect manual relic bonuses
    if (item.relicStatBonuses?.length) {
      relicEffects.push({
        itemName: item.name, slotIndex: i, type: 'relic_bonus',
        description: '유물 보너스', bonuses: item.relicStatBonuses,
      });
    }

    const isQuiverZero = item.type === 'quiver' && !hasRangedWeapon;
    const quality = slot.quality || 'common';
    const qualityMult = QUALITY_MULTIPLIER[quality] || 1;

    // Base stats from JSON (may include baked-in unique element/spirit stats)
    const jsonAtk = getItemBaseStat(item, '장비_공격력');
    const jsonDef = getItemBaseStat(item, '장비_방어력');
    const jsonHp = getItemBaseStat(item, '장비_체력');
    const baseCrit = getItemBaseStat(item, '장비_치명타확률%');
    const baseEvasion = getItemBaseStat(item, '장비_회피%');

    // Adjust base for unique element (JSON stats include affinity-applied element baked in)
    const hasUniqueElement = item.uniqueElement?.length > 0 && item.uniqueElementTier;
    let uniqueElXStats: EnchantStats = { atk: 0, def: 0, hp: 0 };
    if (hasUniqueElement) {
      // Unique element items always have affinity applied in data, so use affinity=true (O column)
      uniqueElXStats = getElementEnchantStats(elementData, item.uniqueElementTier, true);
    }

    // Adjust base for unique spirit (JSON stats include spirit with affinity baked in)
    const hasUniqueSpirit = item.uniqueSpirit?.length > 0;
    let uniqueSpXStats: EnchantStats = { atk: 0, def: 0, hp: 0 };
    if (hasUniqueSpirit) {
      // Unique spirit items (like Mundra) have affinity-applied stats baked into JSON data
      uniqueSpXStats = getSpiritEnchantStats(spiritData, item.uniqueSpirit[0], true);
    }

    // True base = reverse-engineer from JSON stats that include baked-in enchantment(s)
    // Uses the formula: displayedStat = base + min(base, enchant)
    let baseAtk: number, baseDef: number, baseHp: number;
    if (hasUniqueElement && hasUniqueSpirit) {
      baseAtk = reverseEnchantBaseDual(jsonAtk, uniqueElXStats.atk, uniqueSpXStats.atk);
      baseDef = reverseEnchantBaseDual(jsonDef, uniqueElXStats.def, uniqueSpXStats.def);
      baseHp = reverseEnchantBaseDual(jsonHp, uniqueElXStats.hp, uniqueSpXStats.hp);
    } else if (hasUniqueElement) {
      baseAtk = reverseEnchantBase(jsonAtk, uniqueElXStats.atk);
      baseDef = reverseEnchantBase(jsonDef, uniqueElXStats.def);
      baseHp = reverseEnchantBase(jsonHp, uniqueElXStats.hp);
    } else if (hasUniqueSpirit) {
      baseAtk = reverseEnchantBase(jsonAtk, uniqueSpXStats.atk);
      baseDef = reverseEnchantBase(jsonDef, uniqueSpXStats.def);
      baseHp = reverseEnchantBase(jsonHp, uniqueSpXStats.hp);
    } else {
      baseAtk = jsonAtk;
      baseDef = jsonDef;
      baseHp = jsonHp;
    }

    // Quality-applied stats (based on true base only)
    const qualityAtk = Math.round(baseAtk * qualityMult);
    const qualityDef = Math.round(baseDef * qualityMult);
    const qualityHp = Math.round(baseHp * qualityMult);

    // Element enchantment
    let elementRaw: EnchantStats = { atk: 0, def: 0, hp: 0 };
    if (slot.element) {
      const isAllElAff = !!(slot.element as any).allElementAffinity;
      elementRaw = getElementEnchantStats(elementData, slot.element.tier, slot.element.affinity, isAllElAff);
    }

    // Spirit enchantment
    let spiritRaw: EnchantStats = { atk: 0, def: 0, hp: 0 };
    if (slot.spirit) {
      spiritRaw = getSpiritEnchantStats(spiritData, slot.spirit.name, slot.spirit.affinity);
    }

    // Cap enchantments against true BASE stats (always cap, even for unique items)
    // If base stat is 0, no enchantment bonus is added for that stat
    const elementCapAtk = capEnchant(elementRaw.atk, baseAtk);
    const elementCapDef = capEnchant(elementRaw.def, baseDef);
    const elementCapHp = capEnchant(elementRaw.hp, baseHp);
    const spiritCapAtk = capEnchant(spiritRaw.atk, baseAtk);
    const spiritCapDef = capEnchant(spiritRaw.def, baseDef);
    const spiritCapHp = capEnchant(spiritRaw.hp, baseHp);

    // Pre-bonus stats (before spellknight multiplier)
    const preBonusAtk = qualityAtk + elementCapAtk + spiritCapAtk;
    const preBonusDef = qualityDef + elementCapDef + spiritCapDef;
    const preBonusHp = qualityHp + elementCapHp + spiritCapHp;

    // 스펠나이트 계수: equipment with unique element gets ×1.5
    const spellknightMult = (isSpellknight && item.uniqueElement?.length > 0) ? 1.5 : 1.0;
    const afterSpellknight = {
      atk: Math.floor(preBonusAtk * spellknightMult),
      def: Math.floor(preBonusDef * spellknightMult),
      hp: Math.floor(preBonusHp * spellknightMult),
    };

    // Calculate skill bonus % for this slot
    // For dual wield (쌍수), use judgmentTypes for matching 해당장비 bonuses
    const typeKor = item.typeKor || '';
    const matchTypes = item.judgmentTypes?.length ? item.judgmentTypes : [typeKor];
    const isDualWield = matchTypes.length > 1;

    let specificAtkPct = 0, specificDefPct = 0, specificHpPct = 0;

    if (isDualWield) {
      // Dual wield: use source-based dedup so each skill applies at most once
      const appliedSourceKeys = new Set<string>();
      for (const src of skillBonuses.sources) {
        if (!src.equipType) continue;
        if (!matchTypes.includes(src.equipType)) continue;
        const dedupeKey = `${src.skillName}|${src.bonusKey}`;
        if (appliedSourceKeys.has(dedupeKey)) continue;
        appliedSourceKeys.add(dedupeKey);
        switch (src.bonusKey) {
          case '해당장비공격력': specificAtkPct += src.value; break;
          case '해당장비방어력': specificDefPct += src.value; break;
          case '해당장비체력': specificHpPct += src.value; break;
          case '해당장비전체':
            specificAtkPct += src.value;
            specificDefPct += src.value;
            specificHpPct += src.value;
            break;
        }
      }
    } else {
      // Normal slot: direct dictionary lookup (pre-aggregated)
      const t = matchTypes[0];
      specificAtkPct = (skillBonuses.해당장비공격력[t] || 0) + (skillBonuses.해당장비전체[t] || 0);
      specificDefPct = (skillBonuses.해당장비방어력[t] || 0) + (skillBonuses.해당장비전체[t] || 0);
      specificHpPct = (skillBonuses.해당장비체력[t] || 0) + (skillBonuses.해당장비전체[t] || 0);
    }

    let bonusAtkPct = specificAtkPct + skillBonuses.모든장비공격력 + skillBonuses.모든장비전체;
    let bonusDefPct = specificDefPct + skillBonuses.모든장비방어력 + skillBonuses.모든장비전체;
    let bonusHpPct = specificHpPct + skillBonuses.모든장비체력 + skillBonuses.모든장비전체;

    // 역효과 해머: +100% to self (added to bonus pool, not multiplied separately)
    if (item.name === '역효과 해머') {
      bonusAtkPct += 100;
      bonusDefPct += 100;
      bonusHpPct += 100;
    }

    // Final slot stats: afterSpellknight × (1 + bonus%)
    let finalAtk = afterSpellknight.atk * (1 + bonusAtkPct / 100);
    let finalDef = afterSpellknight.def * (1 + bonusDefPct / 100);
    let finalHp = afterSpellknight.hp * (1 + bonusHpPct / 100);

    // 화살통 보너스: 활에만 적용 (30% of pre-bonus stats)
    let quiverBonusAtk = 0, quiverBonusDef = 0, quiverBonusHp = 0;
    if (hasQuiver && item.type === 'bow') {
      quiverBonusAtk = afterSpellknight.atk * 0.3;
      quiverBonusDef = afterSpellknight.def * 0.3;
      quiverBonusHp = afterSpellknight.hp * 0.3;
      finalAtk += quiverBonusAtk;
      finalDef += quiverBonusDef;
      finalHp += quiverBonusHp;
    }

    // 모든 보너스 적용 후 반올림하여 정수화
    quiverBonusAtk = Math.round(quiverBonusAtk);
    quiverBonusDef = Math.round(quiverBonusDef);
    quiverBonusHp = Math.round(quiverBonusHp);
    finalAtk = Math.round(finalAtk);
    finalDef = Math.round(finalDef);
    finalHp = Math.round(finalHp);
    const finalCrit = baseCrit;
    const finalEvasion = baseEvasion;

    // Quiver zeroing
    if (isQuiverZero) {
      finalAtk = 0;
      finalDef = 0;
      finalHp = 0;
    }

    // 평화의 목걸이: weapon stats → 0
    if (hasWeaponNullify && item.category === 'weapon') {
      finalAtk = 0;
      finalDef = 0;
      finalHp = 0;
    }

    slotResults.push({
      slotIndex: i,
      itemName: item.name || '',
      itemType: item.type || '',
      itemTypeKor: typeKor,
      category: item.category || '',
      judgmentTypes: matchTypes,
      baseAtk, baseDef, baseHp, baseCrit, baseEvasion,
      qualityAtk, qualityDef, qualityHp,
      elementRawAtk: elementRaw.atk, elementRawDef: elementRaw.def, elementRawHp: elementRaw.hp,
      spiritRawAtk: spiritRaw.atk, spiritRawDef: spiritRaw.def, spiritRawHp: spiritRaw.hp,
      elementCapAtk, elementCapDef, elementCapHp,
      spiritCapAtk, spiritCapDef, spiritCapHp,
      preBonusAtk, preBonusDef, preBonusHp,
      spellknightMult,
      bonusAtkPct, bonusDefPct, bonusHpPct,
      quiverBonusAtk, quiverBonusDef, quiverBonusHp,
      finalAtk, finalDef, finalHp, finalCrit, finalEvasion,
    });
  }

  return {
    slots: slotResults,
    totalAtk: slotResults.reduce((sum, s) => sum + s.finalAtk, 0),
    totalDef: slotResults.reduce((sum, s) => sum + s.finalDef, 0),
    totalHp: slotResults.reduce((sum, s) => sum + s.finalHp, 0),
    totalCrit: slotResults.reduce((sum, s) => sum + s.finalCrit, 0),
    totalEvasion: slotResults.reduce((sum, s) => sum + s.finalEvasion, 0),
    relicEffects,
  };
}

function emptySlotCalc(index: number): EquipSlotCalc {
  return {
    slotIndex: index, itemName: '', itemType: '', itemTypeKor: '', category: '',
    judgmentTypes: [],
    baseAtk: 0, baseDef: 0, baseHp: 0, baseCrit: 0, baseEvasion: 0,
    qualityAtk: 0, qualityDef: 0, qualityHp: 0,
    elementRawAtk: 0, elementRawDef: 0, elementRawHp: 0,
    spiritRawAtk: 0, spiritRawDef: 0, spiritRawHp: 0,
    elementCapAtk: 0, elementCapDef: 0, elementCapHp: 0,
    spiritCapAtk: 0, spiritCapDef: 0, spiritCapHp: 0,
    preBonusAtk: 0, preBonusDef: 0, preBonusHp: 0,
    spellknightMult: 1.0,
    bonusAtkPct: 0, bonusDefPct: 0, bonusHpPct: 0,
    quiverBonusAtk: 0, quiverBonusDef: 0, quiverBonusHp: 0,
    finalAtk: 0, finalDef: 0, finalHp: 0, finalCrit: 0, finalEvasion: 0,
  };
}
