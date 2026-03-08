/**
 * Skill & Soul Bonus Parser
 * 
 * Parses 스탯_보너스 from skills (common + unique) and soul enchantments
 * into structured bonus categories for the stat calculator.
 * 
 * Bonus categories:
 * - Flat (깡): 스킬_깡공격력, 스킬_깡방어력, 스킬_깡체력
 * - Common %: 스킬_공격력%, 스킬_방어력%, 스킬_체력%
 * - Additive: 스킬_치명타확률%, 스킬_치명타데미지%, 스킬_회피%, 스킬_위협도
 * - Soul %: 영혼_공격력%, 영혼_방어력%, 영혼_체력%, 영혼_치명타확률%, 영혼_치명타데미지%, 영혼_회피%, 영혼_위협도
 */

export interface SkillBonusSummary {
  // Flat bonuses (깡)
  flatAtk: number;
  flatDef: number;
  flatHp: number;

  // Common % multipliers (applied to total before equipment)
  pctAtk: number;
  pctDef: number;
  pctHp: number;

  // Additive stats
  critRate: number;
  critDmg: number;
  evasion: number;
  threat: number;

  // Breakdown per source for UI display
  sources: SkillBonusSource[];
}

export interface SkillBonusSource {
  name: string;        // skill or soul name
  type: 'unique' | 'common' | 'soul';
  flatAtk: number;
  flatDef: number;
  flatHp: number;
  pctAtk: number;
  pctDef: number;
  pctHp: number;
  critRate: number;
  critDmg: number;
  evasion: number;
  threat: number;
}

export interface SkillBonusInput {
  name: string;
  type: 'unique' | 'common';
  bonusData: Record<string, number | number[]>;
  skillLevel: number;
}

export interface SoulBonusInput {
  slotIndex: number;
  spiritName: string;
  affinity: boolean;
}

function getValueAtLevel(val: number | number[], level: number): number {
  if (Array.isArray(val)) return val[level] ?? 0;
  return val;
}

function emptySource(name: string, type: 'unique' | 'common' | 'soul'): SkillBonusSource {
  return { name, type, flatAtk: 0, flatDef: 0, flatHp: 0, pctAtk: 0, pctDef: 0, pctHp: 0, critRate: 0, critDmg: 0, evasion: 0, threat: 0 };
}

// Spirit stats cache (reuse from equipStatCalculator)
let spiritStatsCache: Record<string, any> | null = null;

async function loadSpiritStats(): Promise<Record<string, any>> {
  if (spiritStatsCache) return spiritStatsCache;
  try {
    const resp = await fetch('/data/equipment/enchantment/spirit.json');
    spiritStatsCache = await resp.json();
    return spiritStatsCache!;
  } catch {
    return {};
  }
}

const SPIRIT_TIER: Record<string, number> = {
  '바하무트': 14, '레비아탄': 14, '그리핀': 14, '명인': 14, '조상': 14, '베히모스': 14, '우로보로스': 14,
  '기린': 12, '크람푸스': 12, '크리스마스': 12,
  '유니콘': 10, '피닉스': 10, '히드라': 10,
  '드래곤': 9,
  '곰': 7, '상어': 7, '공룡': 7, '거북이': 7, '해파리': 7,
  '늑대': 4, '양': 4, '독수리': 4, '황소': 4, '독사': 4, '고양이': 4, '토끼': 4, '문드라': 4,
};

function getSpiritBonusStats(
  spiritData: Record<string, any>,
  spiritName: string,
  affinity: boolean
): Record<string, number> {
  const tier = SPIRIT_TIER[spiritName];
  if (!tier) return {};
  const tierKey = `${tier}티어`;
  const tierGroup = spiritData[tierKey];
  if (!tierGroup) return {};
  const spiritEntry = tierGroup[spiritName];
  if (!spiritEntry) return {};
  const sub = affinity ? spiritEntry['O'] : spiritEntry['X'];
  if (!sub) return {};
  return sub['스탯_보너스'] || {};
}

/**
 * Parse all skill bonuses (unique + common) into a structured summary.
 */
export function parseSkillBonuses(skills: SkillBonusInput[]): { summary: Omit<SkillBonusSummary, 'sources'>, sources: SkillBonusSource[] } {
  const sources: SkillBonusSource[] = [];
  const totals = { flatAtk: 0, flatDef: 0, flatHp: 0, pctAtk: 0, pctDef: 0, pctHp: 0, critRate: 0, critDmg: 0, evasion: 0, threat: 0 };

  for (const skill of skills) {
    const src = emptySource(skill.name, skill.type);
    
    for (const [key, rawVal] of Object.entries(skill.bonusData)) {
      const val = getValueAtLevel(rawVal, skill.skillLevel);
      if (val === 0) continue;

      // Skip equipment-specific bonuses (handled by equipStatCalculator)
      if (key.startsWith('스킬_해당장비') || key.startsWith('스킬_모든장비')) continue;

      switch (key) {
        case '스킬_깡공격력': src.flatAtk += val; totals.flatAtk += val; break;
        case '스킬_깡방어력': src.flatDef += val; totals.flatDef += val; break;
        case '스킬_깡체력': src.flatHp += val; totals.flatHp += val; break;
        case '스킬_공격력%': src.pctAtk += val; totals.pctAtk += val; break;
        case '스킬_방어력%': src.pctDef += val; totals.pctDef += val; break;
        case '스킬_체력%': src.pctHp += val; totals.pctHp += val; break;
        case '스킬_치명타확률%': src.critRate += val; totals.critRate += val; break;
        case '스킬_치명타데미지%': src.critDmg += val; totals.critDmg += val; break;
        case '스킬_회피%': src.evasion += val; totals.evasion += val; break;
        case '스킬_위협도': src.threat += val; totals.threat += val; break;
        // Special/detail stats are ignored for now (경험치, 휴식시간, etc.)
      }
    }

    sources.push(src);
  }

  return { summary: totals, sources };
}

/**
 * Parse soul enchantment bonuses from all equipped spirits.
 */
export async function parseSoulBonuses(souls: SoulBonusInput[]): Promise<{ summary: Omit<SkillBonusSummary, 'sources'>, sources: SkillBonusSource[] }> {
  const spiritData = await loadSpiritStats();
  const sources: SkillBonusSource[] = [];
  const totals = { flatAtk: 0, flatDef: 0, flatHp: 0, pctAtk: 0, pctDef: 0, pctHp: 0, critRate: 0, critDmg: 0, evasion: 0, threat: 0 };

  for (const soul of souls) {
    if (!soul.spiritName) continue;
    const bonusStats = getSpiritBonusStats(spiritData, soul.spiritName, soul.affinity);
    const src = emptySource(soul.spiritName, 'soul');

    for (const [key, val] of Object.entries(bonusStats)) {
      if (typeof val !== 'number' || val === 0) continue;

      switch (key) {
        case '영혼_공격력%': src.pctAtk += val; totals.pctAtk += val; break;
        case '영혼_방어력%': src.pctDef += val; totals.pctDef += val; break;
        case '영혼_체력%': src.pctHp += val; totals.pctHp += val; break;
        case '영혼_깡공격력': src.flatAtk += val; totals.flatAtk += val; break;
        case '영혼_깡방어력': src.flatDef += val; totals.flatDef += val; break;
        case '영혼_깡체력': src.flatHp += val; totals.flatHp += val; break;
        case '영혼_치명타확률%': src.critRate += val; totals.critRate += val; break;
        case '영혼_치명타데미지%': src.critDmg += val; totals.critDmg += val; break;
        case '영혼_회피%': src.evasion += val; totals.evasion += val; break;
        case '영혼_위협도': src.threat += val; totals.threat += val; break;
      }
    }

    sources.push(src);
  }

  return { summary: totals, sources };
}

/**
 * Combine skill and soul bonuses into a single summary.
 */
export function combineBonuses(
  skillResult: { summary: Omit<SkillBonusSummary, 'sources'>, sources: SkillBonusSource[] },
  soulResult: { summary: Omit<SkillBonusSummary, 'sources'>, sources: SkillBonusSource[] },
): SkillBonusSummary {
  return {
    flatAtk: skillResult.summary.flatAtk + soulResult.summary.flatAtk,
    flatDef: skillResult.summary.flatDef + soulResult.summary.flatDef,
    flatHp: skillResult.summary.flatHp + soulResult.summary.flatHp,
    pctAtk: skillResult.summary.pctAtk + soulResult.summary.pctAtk,
    pctDef: skillResult.summary.pctDef + soulResult.summary.pctDef,
    pctHp: skillResult.summary.pctHp + soulResult.summary.pctHp,
    critRate: skillResult.summary.critRate + soulResult.summary.critRate,
    critDmg: skillResult.summary.critDmg + soulResult.summary.critDmg,
    evasion: skillResult.summary.evasion + soulResult.summary.evasion,
    threat: skillResult.summary.threat + soulResult.summary.threat,
    sources: [...skillResult.sources, ...soulResult.sources],
  };
}
