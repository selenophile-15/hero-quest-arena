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

export interface DetailStatsSummary {
  hpRegenPerTurn: number;        // 매 턴 체력 재생
  survivalChance: number;        // 죽기 전 공격 한 번 버틸 확률
  restReduction: number;         // 휴식시간 감소%
  sharkAtkPct: number;           // 상어) 공격력 증가%
  dinoAtkPct: number;            // 공룡) 공격력 증가%
  berserkerAtkPct: number;       // 광전사) 체력 비례 공격력 증가% (per threshold)
  berserkerEvaPct: number;       // 광전사) 체력 비례 회피 증가% (per threshold)
  mundraBosPct: number;          // 문드라) 보스 상대 공격력/방어력 증가%
}

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

  // Detail/special stats
  detail: DetailStatsSummary;

  // Breakdown per source for UI display
  sources: SkillBonusSource[];
}

export interface SkillBonusSource {
  name: string;        // skill or soul name
  type: 'unique' | 'common' | 'soul' | 'relic' | 'job';
  isIdol?: boolean;    // 우상 장비로 인한 2배 적용 여부
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
  isIdol: boolean;  // 우상 장비 여부 — 스킬 효과 2배
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

function getSpiritBonusStats(
  spiritData: Record<string, any>,
  spiritName: string,
  affinity: boolean
): Record<string, number> {
  // Iterate through all tiers to find the spirit (no hardcoded tier map needed)
  for (const [, tierGroup] of Object.entries(spiritData)) {
    if (typeof tierGroup !== 'object' || tierGroup === null) continue;
    const spiritEntry = tierGroup[spiritName];
    if (!spiritEntry) continue;
    const sub = affinity ? spiritEntry['O'] : spiritEntry['X'];
    if (!sub) continue;
    return sub['스탯_보너스'] || {};
  }
  return {};
}

/**
 * Parse all skill bonuses (unique + common) into a structured summary.
 */
export function parseSkillBonuses(skills: SkillBonusInput[]): { summary: Omit<SkillBonusSummary, 'sources'>, sources: SkillBonusSource[] } {
  const sources: SkillBonusSource[] = [];
  const totals = { flatAtk: 0, flatDef: 0, flatHp: 0, pctAtk: 0, pctDef: 0, pctHp: 0, critRate: 0, critDmg: 0, evasion: 0, threat: 0 };
  const detail: DetailStatsSummary = { hpRegenPerTurn: 0, survivalChance: 0, restReduction: 0, sharkAtkPct: 0, dinoAtkPct: 0, berserkerAtkPct: 0, berserkerEvaPct: 0, mundraBosPct: 0 };

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
        // Detail stats
        case '스킬_매턴체력회복': detail.hpRegenPerTurn += val; break;
        case '스킬_치명타생존%': detail.survivalChance += val; break;
        case '스킬_휴식시간감소%': detail.restReduction += val; break;
        case '스킬_체력비례스킬_공격력%': detail.berserkerAtkPct += val; break;
        case '스킬_체력비례회피%': detail.berserkerEvaPct += val; break;
      }
    }

    sources.push(src);
  }

  return { summary: { ...totals, detail }, sources };
}

/**
 * Parse soul enchantment bonuses from all equipped spirits.
 * - Idol (우상) equipment doubles soul skill bonuses.
 * - Same spirit on multiple slots: only the highest bonus applies (dedup).
 */
export async function parseSoulBonuses(souls: SoulBonusInput[]): Promise<{ summary: Omit<SkillBonusSummary, 'sources'>, sources: SkillBonusSource[] }> {
  const spiritData = await loadSpiritStats();
  const sources: SkillBonusSource[] = [];
  const totals = { flatAtk: 0, flatDef: 0, flatHp: 0, pctAtk: 0, pctDef: 0, pctHp: 0, critRate: 0, critDmg: 0, evasion: 0, threat: 0 };

  // Build per-spirit candidates with multiplier applied
  // Only spirits with 중복불가 flag get deduped (e.g. 명인)
  const noDupCandidates: Map<string, { src: SkillBonusSource; mult: number }[]> = new Map();
  const normalSources: SkillBonusSource[] = [];

  for (const soul of souls) {
    if (!soul.spiritName) continue;
    const bonusStats = getSpiritBonusStats(spiritData, soul.spiritName, soul.affinity);
    const mult = soul.isIdol ? 2 : 1;
    const src = emptySource(soul.spiritName, 'soul');
    if (soul.isIdol) {
      src.name = `${soul.spiritName} (우상)`;
      src.isIdol = true;
    }

    for (const [key, val] of Object.entries(bonusStats)) {
      if (typeof val !== 'number' || val === 0) continue;
      const adjusted = val * mult;

      switch (key) {
        case '영혼_공격력%': src.pctAtk += adjusted; break;
        case '영혼_방어력%': src.pctDef += adjusted; break;
        case '영혼_체력%': src.pctHp += adjusted; break;
        case '영혼_깡공격력': src.flatAtk += adjusted; break;
        case '영혼_깡방어력': src.flatDef += adjusted; break;
        case '영혼_깡체력': src.flatHp += adjusted; break;
        case '영혼_치명타확률%': src.critRate += adjusted; break;
        case '영혼_치명타데미지%': src.critDmg += adjusted; break;
        case '영혼_회피%': src.evasion += adjusted; break;
        case '영혼_위협도': src.threat += adjusted; break;
      }
    }

    // Check if this spirit has 중복불가 flag
    const hasNoDup = !!(bonusStats as any)['중복불가'];
    if (hasNoDup) {
      if (!noDupCandidates.has(soul.spiritName)) {
        noDupCandidates.set(soul.spiritName, []);
      }
      noDupCandidates.get(soul.spiritName)!.push({ src, mult });
    } else {
      normalSources.push(src);
    }
  }

  // Normal spirits: all stack
  for (const s of normalSources) {
    totals.flatAtk += s.flatAtk; totals.flatDef += s.flatDef; totals.flatHp += s.flatHp;
    totals.pctAtk += s.pctAtk; totals.pctDef += s.pctDef; totals.pctHp += s.pctHp;
    totals.critRate += s.critRate; totals.critDmg += s.critDmg; totals.evasion += s.evasion; totals.threat += s.threat;
    sources.push(s);
  }

  // 중복불가 spirits: pick highest magnitude only
  for (const [, candidates] of noDupCandidates) {
    let best = candidates[0];
    if (candidates.length > 1) {
      const magnitude = (s: SkillBonusSource) =>
        Math.abs(s.flatAtk) + Math.abs(s.flatDef) + Math.abs(s.flatHp) +
        Math.abs(s.pctAtk) + Math.abs(s.pctDef) + Math.abs(s.pctHp) +
        Math.abs(s.critRate) + Math.abs(s.critDmg) + Math.abs(s.evasion) + Math.abs(s.threat);
      best = candidates.reduce((a, b) => magnitude(a.src) >= magnitude(b.src) ? a : b);
    }
    const s = best.src;
    totals.flatAtk += s.flatAtk; totals.flatDef += s.flatDef; totals.flatHp += s.flatHp;
    totals.pctAtk += s.pctAtk; totals.pctDef += s.pctDef; totals.pctHp += s.pctHp;
    totals.critRate += s.critRate; totals.critDmg += s.critDmg; totals.evasion += s.evasion; totals.threat += s.threat;
    sources.push(s);
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
