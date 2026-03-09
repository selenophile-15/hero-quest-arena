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
  affinity: boolean
): EnchantStats {
  const tierKey = `${tier}티어`;
  const entry = elementData[tierKey];
  if (!entry) return { atk: 0, def: 0, hp: 0 };
  const sub = affinity ? entry['O'] : entry['X'];
  if (!sub) return { atk: 0, def: 0, hp: 0 };
  return {
    atk: sub['원소_공격력'] || 0,
    def: sub['원소_방어력'] || 0,
    hp: sub['원소_체력'] || 0,
  };
}

const SPIRIT_TIER: Record<string, number> = {
  '바하무트': 14, '레비아탄': 14, '그리핀': 14, '명인': 14, '조상': 14, '베히모스': 14, '우로보로스': 14,
  '기린': 12, '크람푸스': 12, '크리스마스': 12,
  '유니콘': 10, '피닉스': 10, '히드라': 10,
  '드래곤': 9,
  '곰': 7, '상어': 7, '공룡': 7, '거북이': 7, '해파리': 7,
  '늑대': 4, '양': 4, '독수리': 4, '황소': 4, '독사': 4, '고양이': 4, '토끼': 4, '문드라': 4,
};

function getSpiritEnchantStats(
  spiritData: Record<string, any>,
  spiritName: string,
  affinity: boolean
): EnchantStats {
  const tier = SPIRIT_TIER[spiritName];
  if (!tier) return { atk: 0, def: 0, hp: 0 };
  const tierKey = `${tier}티어`;
  const tierGroup = spiritData[tierKey];
  if (!tierGroup) return { atk: 0, def: 0, hp: 0 };
  const spiritEntry = tierGroup[spiritName];
  if (!spiritEntry) return { atk: 0, def: 0, hp: 0 };
  const sub = affinity ? spiritEntry['O'] : spiritEntry['X'];
  if (!sub) return { atk: 0, def: 0, hp: 0 };
  return {
    atk: sub['영혼_공격력'] || 0,
    def: sub['영혼_방어력'] || 0,
    hp: sub['영혼_체력'] || 0,
  };
}

function capEnchant(enchantVal: number, baseVal: number): number {
  if (baseVal <= 0) return 0;
  return Math.min(enchantVal, baseVal);
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

    // Base stats (common grade)
    const baseAtk = getItemBaseStat(item, '장비_공격력');
    const baseDef = getItemBaseStat(item, '장비_방어력');
    const baseHp = getItemBaseStat(item, '장비_체력');
    const baseCrit = getItemBaseStat(item, '장비_치명타확률%');
    const baseEvasion = getItemBaseStat(item, '장비_회피%');

    // Quality-applied stats
    const qualityAtk = Math.floor(baseAtk * qualityMult);
    const qualityDef = Math.floor(baseDef * qualityMult);
    const qualityHp = Math.floor(baseHp * qualityMult);

    // Element enchantment
    let elementRaw: EnchantStats = { atk: 0, def: 0, hp: 0 };
    if (slot.element) {
      const raw = getElementEnchantStats(elementData, slot.element.tier, slot.element.affinity);
      elementRaw = raw;
    }

    // Spirit enchantment
    let spiritRaw: EnchantStats = { atk: 0, def: 0, hp: 0 };
    if (slot.spirit) {
      spiritRaw = getSpiritEnchantStats(spiritData, slot.spirit.name, slot.spirit.affinity);
    }

    // Cap enchantments against BASE (common grade) stats
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
    
    let specificAtkPct = 0, specificDefPct = 0, specificHpPct = 0, specificAllPct = 0;
    for (const mt of matchTypes) {
      specificAtkPct += (skillBonuses.해당장비공격력[mt] || 0);
      specificDefPct += (skillBonuses.해당장비방어력[mt] || 0);
      specificHpPct += (skillBonuses.해당장비체력[mt] || 0);
      specificAllPct += (skillBonuses.해당장비전체[mt] || 0);
    }

    let bonusAtkPct = specificAtkPct + specificAllPct + skillBonuses.모든장비공격력 + skillBonuses.모든장비전체;
    let bonusDefPct = specificDefPct + specificAllPct + skillBonuses.모든장비방어력 + skillBonuses.모든장비전체;
    let bonusHpPct = specificHpPct + specificAllPct + skillBonuses.모든장비체력 + skillBonuses.모든장비전체;

    // 역효과 해머: +100% to self (added to bonus pool, not multiplied separately)
    if (item.name === '역효과 해머') {
      bonusAtkPct += 100;
      bonusDefPct += 100;
      bonusHpPct += 100;
    }

    // Final slot stats: afterSpellknight × (1 + bonus%)
    let finalAtk = Math.floor(afterSpellknight.atk * (1 + bonusAtkPct / 100));
    let finalDef = Math.floor(afterSpellknight.def * (1 + bonusDefPct / 100));
    let finalHp = Math.floor(afterSpellknight.hp * (1 + bonusHpPct / 100));

    // 화살통 보너스: 보너스 적용 후 마지막에 보너스 전 값의 30%를 더함
    let quiverBonusAtk = 0, quiverBonusDef = 0, quiverBonusHp = 0;
    if (hasQuiver && ['bow', 'crossbow', 'gun'].includes(item.type)) {
      quiverBonusAtk = Math.floor(afterSpellknight.atk * 0.3);
      quiverBonusDef = Math.floor(afterSpellknight.def * 0.3);
      quiverBonusHp = Math.floor(afterSpellknight.hp * 0.3);
      finalAtk += quiverBonusAtk;
      finalDef += quiverBonusDef;
      finalHp += quiverBonusHp;
    }
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
