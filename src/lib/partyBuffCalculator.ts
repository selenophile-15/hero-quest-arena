/**
 * Party Buff Calculator
 * 
 * Computes per-hero buffed stats based on:
 * - Champion leader skill bonuses (ATK%, DEF%, HP%, Crit%, Eva%, CritDmg%)
 * - Aura song bonuses (from champion's equipment)
 * - Mercenary 1.25x multiplier on champion + aurasong bonuses
 * - Ashley boss double bonus
 * - Bjorn flash quest double bonus
 * - Donovan per-class-line bonuses
 * 
 * Does NOT include: boosters, Rudo (temporary), Tamas (random), Hemma (cumulative)
 */

import { Hero } from '@/types/game';
import { getChampionSkillsData } from '@/lib/gameData';
import { ensureAurasongDataLoaded } from '@/lib/championEquipUtils';

// ─── Types ───

export interface PartyBuffSummary {
  // Common party-wide % bonuses
  atkPct: number;
  defPct: number;
  hpPct: number;
  // Per-hero additive bonuses (indexed same as input heroes)
  perHeroCritPct: number[];
  perHeroEvaPct: number[];
  perHeroCritDmgPct: number[];
  // Aurasong flat bonuses
  flatAtk: number;
  flatDef: number;
  flatHp: number;
  // Sources for display
  sources: PartyBuffSource[];
}

export interface PartyBuffSource {
  name: string;
  type: 'champion' | 'aurasong';
  atkPct?: number;
  defPct?: number;
  hpPct?: number;
  critPct?: number;
  evaPct?: number;
  critDmgPct?: number;
  flatAtk?: number;
  flatDef?: number;
  flatHp?: number;
  note?: string; // e.g. "보스 2배", "깜짝 퀘스트 2배"
}

export interface BuffedHeroStats {
  hp: number;
  atk: number;
  def: number;
  crit: number;
  critDmg: number;
  evasion: number;
  threat: number;
  // Deltas for display
  deltaHp: number;
  deltaAtk: number;
  deltaDef: number;
  deltaCrit: number;
  deltaCritDmg: number;
  deltaEvasion: number;
}

// Class line detection (mirrored from combatSimulation.ts)
function getClassLine(hero: Hero): 'fighter' | 'rogue' | 'spellcaster' | 'none' {
  if (hero.classLine === '전사') return 'fighter';
  if (hero.classLine === '로그') return 'rogue';
  if (hero.classLine === '주문술사') return 'spellcaster';
  const cls = hero.heroClass || '';
  const FIGHTERS = ['용병', '기사', '사무라이', '다이묘', '광전사', '야를', '암흑기사', '데스나이트', '수도승', '그랜드 마스터', '경보병', '근위병', '족장'];
  const ROGUES = ['트릭스터', '정복자', '길잡이', '닌자', '센세이', '댄서', '아크로뱃'];
  const SPELLS = ['주교', '성직자', '크로노맨서', '운명직공', '비숍', '클레릭', '스펠나이트', '풍수사', '아스트라맨서'];
  if (FIGHTERS.some(c => cls.includes(c))) return 'fighter';
  if (ROGUES.some(c => cls.includes(c))) return 'rogue';
  if (SPELLS.some(c => cls.includes(c))) return 'spellcaster';
  return 'none';
}

function isMercenary(hero: Hero): boolean {
  const cls = hero.heroClass || '';
  return cls === '용병' || cls.includes('Mercenary');
}

function hasLoneWolfCowl(hero: Hero): boolean {
  return hero.equipmentSlots?.some(s => s.item?.name === '외로운 늑대 두건' || s.item?.name === '고독한 늑대 두건') || false;
}

function getChampionTier(champion: Hero, champSkillsData: Record<string, any>): number {
  const csd = champSkillsData[champion.championName || ''];
  if (!csd) return 1;
  for (let t = 4; t >= 1; t--) {
    const td = csd[`${t}티어`];
    if (td && (champion.rank || 1) >= (td['챔피언_랭크'] || 0)) return t;
  }
  return 1;
}

// ─── Aurasong bonus extraction ───

interface AurasongBonuses {
  atkPct: number;
  defPct: number;
  hpPct: number;
  critPct: number;
  evaPct: number;
  critDmgPct: number;
  flatAtk: number;
  flatDef: number;
  flatHp: number;
}

async function getAurasongBonuses(champion: Hero): Promise<AurasongBonuses> {
  const result: AurasongBonuses = { atkPct: 0, defPct: 0, hpPct: 0, critPct: 0, evaPct: 0, critDmgPct: 0, flatAtk: 0, flatDef: 0, flatHp: 0 };
  
  // Aurasong is in equipmentSlots[1] for champions
  const aurasongSlot = champion.equipmentSlots?.[1];
  if (!aurasongSlot?.item) return result;
  
  const item = aurasongSlot.item;
  
  // Check manual aurasong with relicStatBonuses
  if (item.relicStatBonuses?.length) {
    for (const b of item.relicStatBonuses) {
      const val = b.op === '감소' ? -b.value : b.value;
      switch (b.stat) {
        case '오라_공격력%': result.atkPct += val; break;
        case '오라_방어력%': result.defPct += val; break;
        case '오라_체력%': result.hpPct += val; break;
        case '오라_치명타확률%': result.critPct += val; break;
        case '오라_회피%': result.evaPct += val; break;
        case '오라_치명타데미지%': result.critDmgPct += val; break;
        case '오라_깡공격력': result.flatAtk += val; break;
        case '오라_깡방어력': result.flatDef += val; break;
        case '오라_깡체력': result.flatHp += val; break;
      }
    }
    return result;
  }
  
  // Look up from aurasong JSON data
  await ensureAurasongDataLoaded();
  const aurasongName = item.name;
  if (!aurasongName) return result;
  
  try {
    const resp = await fetch('/data/equipment/champion/aurasong.json');
    const data = await resp.json();
    for (const tierItems of Object.values(data)) {
      if (typeof tierItems !== 'object') continue;
      const aData = (tierItems as Record<string, any>)[aurasongName];
      if (aData?.['스탯_보너스']) {
        const bonuses = aData['스탯_보너스'];
        if (bonuses['오라_공격력%']) result.atkPct += bonuses['오라_공격력%'];
        if (bonuses['오라_방어력%']) result.defPct += bonuses['오라_방어력%'];
        if (bonuses['오라_체력%']) result.hpPct += bonuses['오라_체력%'];
        if (bonuses['오라_치명타확률%']) result.critPct += bonuses['오라_치명타확률%'];
        if (bonuses['오라_회피%']) result.evaPct += bonuses['오라_회피%'];
        if (bonuses['오라_치명타데미지%']) result.critDmgPct += bonuses['오라_치명타데미지%'];
        if (bonuses['오라_깡공격력']) result.flatAtk += bonuses['오라_깡공격력'];
        if (bonuses['오라_깡방어력']) result.flatDef += bonuses['오라_깡방어력'];
        if (bonuses['오라_깡체력']) result.flatHp += bonuses['오라_깡체력'];
        return result;
      }
    }
  } catch { /* ignore */ }
  
  return result;
}

// ─── Main Calculator ───

export interface PartyBuffInput {
  heroes: Hero[];
  isBoss?: boolean;
  isFlashQuest?: boolean;
}

export async function calculatePartyBuffs(input: PartyBuffInput): Promise<{
  summary: PartyBuffSummary;
  buffedStats: BuffedHeroStats[];
}> {
  const { heroes, isBoss = false, isFlashQuest = false } = input;
  const n = heroes.length;
  
  const summary: PartyBuffSummary = {
    atkPct: 0, defPct: 0, hpPct: 0,
    perHeroCritPct: new Array(n).fill(0),
    perHeroEvaPct: new Array(n).fill(0),
    perHeroCritDmgPct: new Array(n).fill(0),
    flatAtk: 0, flatDef: 0, flatHp: 0,
    sources: [],
  };
  
  // Find champion
  const champion = heroes.find(h => h.type === 'champion');
  if (!champion) {
    // No champion = no party buffs, return raw stats
    return {
      summary,
      buffedStats: heroes.map(h => ({
        hp: h.hp, atk: h.atk, def: h.def,
        crit: h.crit, critDmg: h.critDmg, evasion: h.evasion, threat: h.threat,
        deltaHp: 0, deltaAtk: 0, deltaDef: 0, deltaCrit: 0, deltaCritDmg: 0, deltaEvasion: 0,
      })),
    };
  }
  
  // Count class lines
  let numFighters = 0, numRogues = 0, numSpellcasters = 0;
  heroes.forEach(h => {
    const line = getClassLine(h);
    if (line === 'fighter') numFighters++;
    else if (line === 'rogue') numRogues++;
    else if (line === 'spellcaster') numSpellcasters++;
  });
  
  const champSkillsData = await getChampionSkillsData();
  const champTier = getChampionTier(champion, champSkillsData);
  const champName = champion.championName || '';
  const bjornMult = isFlashQuest ? 2.0 : 1.0;
  
  // Champion leader skill bonuses
  let champAtkPct = 0, champDefPct = 0, champHpPct = 0;
  const perHeroCrit = new Array(n).fill(0);
  const perHeroEva = new Array(n).fill(0);
  const perHeroCritDmg = new Array(n).fill(0);
  let champNote = '';
  
  if (champName.includes('아르곤')) {
    champAtkPct = 10 * champTier;
    champDefPct = 10 * champTier;
  } else if (champName.includes('애슐리') || champName.includes('애쉴리')) {
    champAtkPct = 5 + 5 * champTier;
    champDefPct = 5 + 5 * champTier;
    if (isBoss) {
      champAtkPct *= 2;
      champDefPct *= 2;
      champNote = '보스 2배 적용';
    }
  } else if (champName.includes('비외른')) {
    champAtkPct = (champTier < 3 ? 5 + 5 * champTier : 10 * champTier - 10) * bjornMult;
    champHpPct = 5 * champTier * bjornMult;
    for (let i = 0; i < n; i++) {
      perHeroCritDmg[i] = (10 + 10 * champTier) * bjornMult;
    }
    if (isFlashQuest) champNote = '깜짝 퀘스트 2배 적용';
  } else if (champName.includes('도노반')) {
    const atkPerSpell = champTier === 1 ? 5 : champTier === 2 ? 8 : champTier === 3 ? 10 : 14;
    champAtkPct = atkPerSpell * numSpellcasters;
    const hpPerFighter = 4 + champTier + 2 * Math.max(champTier - 3, 0);
    champHpPct = hpPerFighter * numFighters;
    const critEvaPerRogue = 2 + champTier + Math.max(champTier - 3, 0);
    for (let i = 0; i < n; i++) {
      perHeroCrit[i] = critEvaPerRogue * numRogues;
      perHeroEva[i] = critEvaPerRogue * numRogues;
    }
    champNote = `전사${numFighters} 로그${numRogues} 주문${numSpellcasters}`;
  } else if (champName.includes('헴마')) {
    champHpPct = 5 * champTier + 5 * Math.max(champTier - 3, 0);
    champNote = '전투 중 공격력 누적 별도';
  } else if (champName.includes('릴루')) {
    champHpPct = 5 + 5 * champTier;
  } else if (champName.includes('맬러디')) {
    const mData: Record<number, { atk: number; eva: number; crit: number }> = {
      1: { atk: 10, eva: 5, crit: 3 },
      2: { atk: 15, eva: 10, crit: 5 },
      3: { atk: 20, eva: 10, crit: 8 },
      4: { atk: 30, eva: 15, crit: 10 },
    };
    const m = mData[champTier] || mData[1];
    champAtkPct = m.atk;
    for (let i = 0; i < n; i++) {
      perHeroEva[i] = m.eva;
      perHeroCrit[i] = m.crit;
    }
  } else if (champName.includes('폴로니아')) {
    champDefPct = 5 + 5 * champTier;
    for (let i = 0; i < n; i++) {
      perHeroEva[i] = champTier < 3 ? 5 : 10;
    }
  } else if (champName.includes('라인홀드')) {
    const pct = 5 + 5 * champTier + 5 * Math.max(champTier - 3, 0);
    champAtkPct = pct;
    champDefPct = pct;
    champHpPct = pct;
  } else if (champName.includes('시아')) {
    champAtkPct = 5 + 5 * champTier;
  } else if (champName.includes('야미')) {
    for (let i = 0; i < n; i++) {
      perHeroCrit[i] = 5 * champTier;
      perHeroEva[i] = 5 * champTier;
    }
  } else if (champName.includes('루도')) {
    // Rudo's crit bonus is temporary (N rounds), shown as note
    const rudoCrit = champTier <= 2 ? 20 + 10 * champTier : 50;
    const rudoRounds = champTier <= 2 ? 2 : champTier === 3 ? 3 : 4;
    champNote = `치명타 +${rudoCrit}% (${rudoRounds}라운드)`;
  } else if (champName.includes('타마스')) {
    const tamasMax = champTier < 3 ? (5 + 5 * champTier) * 2 : 10 * champTier * 2;
    champNote = `공격력 0~${tamasMax}% (랜덤)`;
  }
  
  // Add champion source
  if (champAtkPct || champDefPct || champHpPct || perHeroCrit.some(v => v) || perHeroEva.some(v => v) || perHeroCritDmg.some(v => v) || champNote) {
    summary.sources.push({
      name: `${champName} 리더스킬 (${champTier}티어)`,
      type: 'champion',
      atkPct: champAtkPct || undefined,
      defPct: champDefPct || undefined,
      hpPct: champHpPct || undefined,
      critPct: perHeroCrit[0] || undefined,
      evaPct: perHeroEva[0] || undefined,
      critDmgPct: perHeroCritDmg[0] || undefined,
      note: champNote || undefined,
    });
  }
  
  summary.atkPct += champAtkPct;
  summary.defPct += champDefPct;
  summary.hpPct += champHpPct;
  
  // Aurasong bonuses
  const aura = await getAurasongBonuses(champion);
  if (aura.atkPct || aura.defPct || aura.hpPct || aura.critPct || aura.evaPct || aura.critDmgPct || aura.flatAtk || aura.flatDef || aura.flatHp) {
    const aurasongName = champion.equipmentSlots?.[1]?.item?.name || '오라의 노래';
    summary.sources.push({
      name: aurasongName,
      type: 'aurasong',
      atkPct: aura.atkPct || undefined,
      defPct: aura.defPct || undefined,
      hpPct: aura.hpPct || undefined,
      critPct: aura.critPct || undefined,
      evaPct: aura.evaPct || undefined,
      critDmgPct: aura.critDmgPct || undefined,
      flatAtk: aura.flatAtk || undefined,
      flatDef: aura.flatDef || undefined,
      flatHp: aura.flatHp || undefined,
    });
  }
  
  summary.flatAtk += aura.flatAtk;
  summary.flatDef += aura.flatDef;
  summary.flatHp += aura.flatHp;
  
  // Compute per-hero buffed stats
  const buffedStats: BuffedHeroStats[] = heroes.map((h, i) => {
    const isMerc = isMercenary(h);
    const hasLW = hasLoneWolfCowl(h);
    const champMod = hasLW ? 0 : 1;
    const mercMult = isMerc ? 1.25 : 1.0;
    
    // ATK/DEF/HP: base × (1 + (champPct/100 × champMod + auraPct/100) × mercMult)
    const atkMult = 1 + ((champAtkPct / 100) * champMod + aura.atkPct / 100) * mercMult;
    const defMult = 1 + ((champDefPct / 100) * champMod + aura.defPct / 100) * mercMult;
    const hpMult = 1 + ((champHpPct / 100) * champMod + aura.hpPct / 100) * mercMult;
    
    const newAtk = Math.floor(h.atk * atkMult) + aura.flatAtk;
    const newDef = Math.floor(h.def * defMult) + aura.flatDef;
    const newHp = Math.floor(h.hp * hpMult) + aura.flatHp;
    
    // Crit/Eva/CritDmg: additive
    const critAdd = (perHeroCrit[i] * champMod + aura.critPct) * mercMult;
    const evaAdd = (perHeroEva[i] * champMod + aura.evaPct) * mercMult;
    const critDmgAdd = (perHeroCritDmg[i] * champMod + aura.critDmgPct) * mercMult;
    
    const newCrit = h.crit + critAdd;
    const newEvasion = h.evasion + evaAdd;
    const newCritDmg = h.critDmg + critDmgAdd;
    
    return {
      hp: newHp,
      atk: newAtk,
      def: newDef,
      crit: Math.round(newCrit * 10) / 10,
      critDmg: Math.round(newCritDmg * 10) / 10,
      evasion: Math.round(newEvasion * 10) / 10,
      threat: h.threat,
      deltaHp: newHp - h.hp,
      deltaAtk: newAtk - h.atk,
      deltaDef: newDef - h.def,
      deltaCrit: Math.round(critAdd * 10) / 10,
      deltaCritDmg: Math.round(critDmgAdd * 10) / 10,
      deltaEvasion: Math.round(evaAdd * 10) / 10,
    };
  });
  
  // Update summary per-hero arrays
  for (let i = 0; i < n; i++) {
    const isMerc = isMercenary(heroes[i]);
    const hasLW = hasLoneWolfCowl(heroes[i]);
    const champMod = hasLW ? 0 : 1;
    const mercMult = isMerc ? 1.25 : 1.0;
    summary.perHeroCritPct[i] = (perHeroCrit[i] * champMod + aura.critPct) * mercMult;
    summary.perHeroEvaPct[i] = (perHeroEva[i] * champMod + aura.evaPct) * mercMult;
    summary.perHeroCritDmgPct[i] = (perHeroCritDmg[i] * champMod + aura.critDmgPct) * mercMult;
  }
  
  return { summary, buffedStats };
}
