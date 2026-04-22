/**
 * Shop Titans Combat Simulation Engine
 * Based on the official combat mechanics and reference spreadsheet script.
 * 
 * Key references:
 * - PDF: shop_titans_combat_simulation_explanation_kr.pdf
 * - PDF: 정리용_은근_딥한_내용들_용병_헴마_몬스터_등_네이버_카페.pdf
 * - Google Apps Script combat simulator (1.txt)
 */

import { Hero } from '@/types/game';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuestMonster {
  hp: number;
  atk: number;          // Mob_Damage
  aoe: number;          // AoE damage base
  aoeChance: number;    // AoE chance (%)
  def: { r0: number; r50: number; r70: number; r75: number }; // Cap thresholds
  isBoss: boolean;
  isExtreme: boolean;
  barrier: {
    sub1: string | null;
    sub2: string | null;
    sub3: string | null;
    hp: number;
  } | null;
  barrierElement: string | null; // Resolved barrier element for this sub-area
}

export type MiniBossType = 'random' | 'none' | 'agile' | 'dire' | 'huge' | 'wealthy' | 'legendary';

export interface BoosterType {
  type: 'none' | 'normal' | 'super' | 'mega';
  // Extra flat bonuses stacked on top (e.g., Fateweaver retry adds +20%/+20%)
  extraAtkBonus?: number;
  extraDefBonus?: number;
  extraCritChance?: number;
  extraCritMult?: number;
}

export interface PrecomputedHeroStats {
  atk: number;
  def: number;
  hp: number;
  crit: number;      // % (e.g., 87)
  critDmg: number;   // % (e.g., 700)
  evasion: number;    // % (e.g., 62)
}

export interface SimulationConfig {
  heroes: Hero[];
  monster: QuestMonster;
  miniBoss: MiniBossType;
  booster: BoosterType;
  questTypeKey: string;      // 'normal' | 'flash' | 'lcog' | 'tot'
  regionName: string;        // e.g. '공포'
  isTerrorTower: boolean;    // 공포의 탑 (5% damage)
  precomputedStats?: PrecomputedHeroStats[];  // If provided, skip champion/aurasong computation
  simulationCount?: number;  // Default 50000
  _isRetry?: boolean;        // Internal: prevents Fateweaver recursion
  _disableRetry?: boolean;   // Internal: used for aggregated random miniboss runs
}

export interface HeroSimResult {
  heroId: string;
  heroName: string;
  survivalRate: number;      // %
  avgHpRemaining: number;
  maxHpRemaining: number;
  // Total damage
  avgDamageDealt: number;
  maxDamageDealt: number;
  minDamageDealt: number;
  // Normal vs Crit damage breakdown
  normalDmgDealtAvg: number;   // Average total normal damage
  critDmgDealtAvg: number;     // Average total crit damage
  // Per-turn damage
  avgDamagePerTurn: number;
  // Incoming damage stats (per hit, not total)
  normalDamageTaken: number;     // Single normal hit damage
  aoeDamageTaken: number;        // Single AoE hit damage
  critDamageTakenVal: number;    // Single crit hit damage
  // Total incoming damage (averaged across sims)
  totalDamageTakenAvg: number;
  avgDamageTakenPerHit: number;
  avgDamageTakenPerTurn: number; // Average damage taken per turn
  // Min/Max total damage taken across sims
  minDamageTaken?: number;
  maxDamageTaken?: number;
  // AoE-only / single-only damage taken (avg per sim)
  aoeDmgTakenTotal?: number;
  singleDmgTakenTotal?: number;
  // Shark stats
  sharkNormalDmg: number;        // Normal attack damage when shark active (+bonus)
  sharkCritDmg: number;          // Crit attack damage when shark active
  // Dinosaur (first turn) stats
  dinosaurNormalDmg: number;     // First turn normal damage with dinosaur
  dinosaurCritDmg: number;       // First turn crit damage with dinosaur
  // Spirit flags
  hasSharkSpirit: boolean;
  hasDinosaurSpirit: boolean;
  isSamuraiOrDaimyo: boolean;
  // Final stat snapshots used in simulation (ATK includes barrierMod)
  finalAtk: number;
  finalDef: number;
  finalHp: number;
  finalCritChance: number;       // %
  finalCritDmg: number;          // %
  finalCritAttack: number;       // ATK * CRIT.D (actual crit damage)
  finalEvasion: number;          // %
  // Damage application rate (% of raw damage applied after defense)
  damageApplicationRate: number;  // e.g., 25 means 25% of raw damage
  // Targeting
  targetingRate: number;         // % of times targeted (threat-based)
  evasionRate: number;           // % of attacks evaded among targeted
  // Single-target targeting rate (% of single-target hits this hero received)
  singleTargetRate?: number;
  // Monster crit chance against this hero (%)
  monsterCritChance: number;
  // Berserker thresholds
  berserkerThresholds?: { threshold: number; belowRate: number }[];
  // Berserker bonus values per stage
  berserkerAtkBonus?: number[];  // ATK % bonus per stage [stage1, stage2, stage3]
  berserkerEvaBonus?: number[];  // EVA % bonus per stage
  // Chronomancer
  chronomancerRetries?: number;
  chronomancerRetrySuccessRate?: number;
  // Healing
  totalHealingAvg: number;
  healPerTurn: number;
  // Lord protection
  lordProtectionAvg: number;
  // Lord protection split by attack type (avg per sim)
  lordProtectedSingleAvg?: number;
  lordProtectedAoeAvg?: number;
  // Damage absorbed by lord when protecting this hero (avg per sim, single & aoe)
  lordAbsorbedSingleDmg?: number;
  lordAbsorbedAoeDmg?: number;
  // Crit survival (armadillo, cleric/bishop)
  critSurvivalCount: number;     // avg applied count per sim
  critSurvivalChance?: number;   // % chance (configured)
  tankingRate: number;       // % of single-target hits absorbed (excluding AoE)
}

export interface PartyAggregate {
  min: number;
  avg: number;
  max: number;
}

export interface MiniBossResult {
  type: 'normal' | MiniBossType;
  encounters: number;
  wins: number;
  winRate: number;
  avgRounds: number;
  heroResults: HeroSimResult[];
  // Optional bucketed
  winHero?: HeroSimResult[];
  loseHero?: HeroSimResult[];
  winN?: number;
  loseN?: number;
  winRoundsSum?: number;
  loseRoundsSum?: number;
  // Round min/max breakdown (overall + per bucket)
  minRounds?: number;
  maxRounds?: number;
  winMinRounds?: number;
  winMaxRounds?: number;
  loseMinRounds?: number;
  loseMaxRounds?: number;
  // Party-level aggregates from this miniboss bucket
  partyDmgDealt?: PartyAggregate;
  partyDmgPerTurn?: PartyAggregate;
  partyDmgTaken?: PartyAggregate;
  partyDmgTakenPerTurn?: PartyAggregate;
  winPartyDmgDealt?: PartyAggregate;
  winPartyDmgPerTurn?: PartyAggregate;
  winPartyDmgTaken?: PartyAggregate;
  winPartyDmgTakenPerTurn?: PartyAggregate;
  losePartyDmgDealt?: PartyAggregate;
  losePartyDmgPerTurn?: PartyAggregate;
  losePartyDmgTaken?: PartyAggregate;
  losePartyDmgTakenPerTurn?: PartyAggregate;
}

export interface SimulationResult {
  winRate: number;           // % (after Fateweaver retry if applicable)
  rawWinRate: number;        // % (first attempt, before retry)
  retryWinRate?: number;     // % (second attempt with booster, if Fateweaver)
  avgRounds: number;
  minRounds: number;
  maxRounds: number;
  heroResults: HeroSimResult[];
  // Bucketed hero results (only damage/taken/rounds related fields are meaningful per-bucket;
  // other static stats fall back to the overall results)
  winHeroResults?: HeroSimResult[];
  loseHeroResults?: HeroSimResult[];
  winSimCount?: number;
  loseSimCount?: number;
  roundLimitRate: number;    // % of sims hitting 499 round limit
  totalSimulations: number;
  retrySimulations?: number; // Number of retry sims (if Fateweaver)
  // Per mini-boss breakdown (only for random mode)
  miniBossResults?: MiniBossResult[];
  // Win/loss round breakdown
  winRounds?: { avg: number; min: number; max: number };
  loseRounds?: { avg: number; min: number; max: number };
  // Party-level aggregates: per-sim party totals (sum across heroes per sim → distribution)
  partyDmgDealt?: PartyAggregate;
  partyDmgPerTurn?: PartyAggregate;
  partyDmgTaken?: PartyAggregate;
  partyDmgTakenPerTurn?: PartyAggregate;
  // Win/lose bucketed party aggregates
  winPartyDmgDealt?: PartyAggregate;
  winPartyDmgPerTurn?: PartyAggregate;
  winPartyDmgTaken?: PartyAggregate;
  winPartyDmgTakenPerTurn?: PartyAggregate;
  losePartyDmgDealt?: PartyAggregate;
  losePartyDmgPerTurn?: PartyAggregate;
  losePartyDmgTaken?: PartyAggregate;
  losePartyDmgTakenPerTurn?: PartyAggregate;
}

// ─── Class/Job mapping (Korean → English equivalent for logic) ───────────────

const CLASS_LINE_MAP: Record<string, 'fighter' | 'rogue' | 'spellcaster'> = {
  '전사': 'fighter',
  '로그': 'rogue',
  '주문술사': 'spellcaster',
};

// Fighter line (전사 계열): 병사~죽음의 기사
const FIGHTER_CLASSES = [
  '병사', '용병',
  '야만전사', '족장',
  '기사', '군주',
  '레인저', '관리인',
  '사무라이', '다이묘',
  '광전사', '잘',
  '어둠의 기사', '죽음의 기사',
  // English aliases (legacy / fallback only — primary matching is done via classLine)
  'Soldier', 'Mercenary',
  'Barbarian', 'Chieftain',
  'Knight', 'Lord',
  'Ranger', 'Warden',
  'Samurai', 'Daimyo',
  'Berserker', 'Jarl',
  'Dark Knight', 'Death Knight',
];
// Rogue line (로그 계열): 도둑~근위병
const ROGUE_CLASSES = [
  '도둑', '사기꾼',
  '수도승', '그랜드 마스터',
  '머스킷병', '정복자',
  '방랑자', '길잡이',
  '닌자', '센세',
  '무희', '곡예가',
  '경보병', '근위병',
  // English aliases (legacy / fallback only)
  'Thief', 'Trickster',
  'Monk', 'Grand Master',
  'Musketeer', 'Conquistador',
  'Wanderer', 'Pathfinder',
  'Ninja', 'Sensei',
  'Dancer', 'Acrobat',
  'Light Infantry', 'Royal Guard',
];
// Spellcaster line (주문술사 계열): 마법사~페이트위버
const SPELLCASTER_CLASSES = [
  '마법사', '대마법사',
  '성직자', '비숍',
  '드루이드', '아크 드루이드',
  '소서러', '워록',
  '마법검', '스펠나이트',
  '풍수사', '아스트라맨서',
  '크로노맨서', '페이트위버',
  // English aliases (legacy / fallback only)
  'Mage', 'Archmage',
  'Cleric', 'Bishop',
  'Druid', 'Archdruid',
  'Sorcerer', 'Warlock',
  'Spellblade', 'Spellknight',
  'Geomancer', 'Astramancer',
  'Chronomancer', 'Fateweaver',
];

// Champion names (Korean)
const CHAMPION_NAMES = ['아르곤', '애슐리', '비외른', '도노반', '헴마', '릴루', '맬러디', '폴로니아', '라인홀드', '루도', '시아', '야미', '타마스'];

function getClassLine(hero: Hero): 'fighter' | 'rogue' | 'spellcaster' | 'none' {
  if (hero.classLine) {
    return CLASS_LINE_MAP[hero.classLine] || 'none';
  }
  const cls = hero.heroClass || '';
  if (FIGHTER_CLASSES.some(c => cls.includes(c))) return 'fighter';
  if (ROGUE_CLASSES.some(c => cls.includes(c))) return 'rogue';
  if (SPELLCASTER_CLASSES.some(c => cls.includes(c))) return 'spellcaster';
  return 'none';
}

function isClass(hero: Hero, ...names: string[]): boolean {
  const cls = hero.heroClass || '';
  const champ = hero.championName || '';
  return names.some(n => cls === n || cls.includes(n) || champ === n || champ.includes(n));
}

function isChampion(hero: Hero): boolean {
  return hero.type === 'champion';
}

function isMercenary(hero: Hero): boolean {
  return isClass(hero, '용병', 'Mercenary');
}

function getHeroTier(hero: Hero): number {
  // Use cardLevel for champions, or infer from promoted status
  if (hero.cardLevel) return hero.cardLevel;
  return hero.promoted ? 4 : 1;
}

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

function getAurasongBonuses(champion: Hero | null): AurasongBonuses {
  const result: AurasongBonuses = {
    atkPct: 0, defPct: 0, hpPct: 0,
    critPct: 0, evaPct: 0, critDmgPct: 0,
    flatAtk: 0, flatDef: 0, flatHp: 0,
  };
  if (!champion) return result;

  const item: any = champion.equipmentSlots?.[1]?.item;
  const bonuses = item?.relicStatBonuses;
  if (!Array.isArray(bonuses)) return result;

  for (const b of bonuses) {
    const rawVal = typeof b?.value === 'number' ? b.value : 0;
    const val = b?.op === '감소' ? -rawVal : rawVal;
    switch (b?.stat) {
      case '오라_공격력%': result.atkPct += val / 100; break;
      case '오라_방어력%': result.defPct += val / 100; break;
      case '오라_체력%': result.hpPct += val / 100; break;
      case '오라_치명타확률%': result.critPct += val / 100; break;
      case '오라_회피%': result.evaPct += val / 100; break;
      case '오라_치명타데미지%': result.critDmgPct += val / 100; break;
      case '오라_깡공격력': result.flatAtk += val; break;
      case '오라_깡방어력': result.flatDef += val; break;
      case '오라_깡체력': result.flatHp += val; break;
    }
  }

  return result;
}

// ─── Flash quest (깜짝 퀘스트) Bjorn multiplier zones ─────────────────────────

const BJORN_DOUBLE_ZONES = [
  'Ancient Crustacean', 'Anubis Champion', 'Cyclops General', 'Cyclops Merchant',
  'Gold Golem', 'Moonstone Golem', 'Mushgoon Graverobber', 'Runestone Golem',
  'Scholarly Harpy', 'Sigil Ninja', 'Toad Sage', 'Training Instructor',
  'Troublin Blacksmith', 'Troublin Pirate',
];

// ─── Damage Calculation ──────────────────────────────────────────────────────

interface DefThresholds {
  r0: number;
  r50: number;
  r70: number;
  r75: number;
}

/**
 * Calculate damage taken using actual defense thresholds (r0/r50/r70/r75).
 * Piecewise linear interpolation between threshold points.
 * Defense thresholds map to damage multipliers:
 *   def=0 → 150% damage, def=r0 → 100%, def=r50 → 50%, def=r70 → 30%, def=r75 → 25%
 */
function calcDamageTakenWithThresholds(heroDef: number, mobDamage: number, thresholds: DefThresholds): number {
  const points = [
    { def: 0, mult: 1.5 },
    { def: thresholds.r0, mult: 1.0 },
    { def: thresholds.r50, mult: 0.5 },
    { def: thresholds.r70, mult: 0.3 },
    { def: thresholds.r75, mult: 0.25 },
  ];

  // Find the segment
  for (let i = points.length - 1; i >= 1; i--) {
    if (heroDef >= points[i - 1].def) {
      const lower = points[i - 1];
      const upper = points[i];
      const range = upper.def - lower.def;
      const t = range > 0 ? Math.min(1, (heroDef - lower.def) / range) : 0;
      const mult = lower.mult + t * (upper.mult - lower.mult);
      return Math.max(Math.round(mobDamage * mult), Math.round(0.25 * mobDamage));
    }
  }
  // Below 0 defense
  return Math.round(1.5 * mobDamage);
}

/**
 * Get damage application rate (%) for display.
 * Returns the multiplier as percentage: 150% at def=0, 100% at r0, 50% at r50, etc.
 */
function getDamageApplicationRate(heroDef: number, thresholds: DefThresholds): number {
  const points = [
    { def: 0, mult: 150 },
    { def: thresholds.r0, mult: 100 },
    { def: thresholds.r50, mult: 50 },
    { def: thresholds.r70, mult: 30 },
    { def: thresholds.r75, mult: 25 },
  ];
  for (let i = points.length - 1; i >= 1; i--) {
    if (heroDef >= points[i - 1].def) {
      const lower = points[i - 1];
      const upper = points[i];
      const range = upper.def - lower.def;
      const t = range > 0 ? Math.min(1, (heroDef - lower.def) / range) : 0;
      return Math.round((lower.mult + t * (upper.mult - lower.mult)) * 10) / 10;
    }
  }
  return 150;
}

// Legacy wrapper for combat log (uses r0 only)
function calcDamageTaken(heroDef: number, mobDamage: number, mobCap: number): number {
  return calcDamageTakenWithThresholds(heroDef, mobDamage, {
    r0: mobCap,
    r50: mobCap * 3,      // approximate
    r70: mobCap * 6,
    r75: mobCap * 10,
  });
}

function calcCritDamageTaken(normalDmg: number, mobDamage: number): number {
  // Crit damage = max(normal_damage, mob_damage) × 1.5
  return Math.round(Math.max(normalDmg, mobDamage) * 1.5);
}

// Keep old function for backward compat but unused now
function getDamageReductionForDef(def: number, mobCap: number): number {
  if (def <= 0) return -50;
  if (def >= mobCap) return 75;
  return -50 + (def / mobCap) * 50;
}

// ─── Main Simulation ─────────────────────────────────────────────────────────

export function runCombatSimulation(config: SimulationConfig): SimulationResult {
  const { heroes, monster, miniBoss, booster, questTypeKey, isTerrorTower, precomputedStats } = config;
  const simCount = config.simulationCount || 50000;

  // Filter out heroes with 0 HP (empty slots)
  const activeHeroes = heroes.filter(h => h.hp > 0);
  if (activeHeroes.length === 0) {
    return emptyResult(simCount);
  }

  // For random mode: run multiple simulations per mini-boss type
  if (miniBoss === 'random') {
    return runRandomMiniBossSimulation(config, activeHeroes, simCount);
  }

  const numHeroes = activeHeroes.length;
  const isLCoG = questTypeKey === 'lcog';
  const isFlash = questTypeKey === 'flash';
  const isExtreme = monster.isExtreme || isTerrorTower;

  // ─── Mini Boss modifiers ───
  let mobHpMod = 1.0;
  let mobDamageMod = 1.0;
  let mobCritChanceMod = 1.0;
  let mobEvasion = -1.0; // -1 = no evasion
  let mobAoeChanceMod = 1.0;

  switch (miniBoss) {
    case 'agile':
      mobEvasion = 0.4;
      break;
    case 'dire':
      mobHpMod = 1.5;
      mobCritChanceMod = 3.0; // 10% * 3 = 30%
      break;
    case 'huge':
      mobHpMod = 2.0;
      mobAoeChanceMod = 3.0;
      break;
    case 'wealthy':
      // No stat changes, only loot bonus
      break;
    case 'legendary':
      mobHpMod = 1.5;
      mobDamageMod = 1.25;
      mobCritChanceMod = 1.5; // 10% * 1.5 = 15%
      mobEvasion = 0.1;
      break;
  }

  const mobHp = Math.round(monster.hp * mobHpMod);
  let mobDamage = Math.round(monster.atk * mobDamageMod);
  const mobAoeDmgRatio = monster.aoe / monster.atk; // AoE as ratio of base damage
  const mobAoeChance = (monster.aoeChance / 100) * mobAoeChanceMod;
  const baseMobCritChance = 0.10; // Base 10%
  const mobCap = monster.def.r0; // r0 = Cap (defense value at 0% reduction)

  // Terror Tower: damage is 5% of original
  if (isTerrorTower) {
    mobDamage = Math.round(mobDamage * 0.05);
  }

  // ─── Count class lines ───
  let numFighters = 0, numRogues = 0, numSpellcasters = 0;
  activeHeroes.forEach(h => {
    const line = getClassLine(h);
    if (line === 'fighter') numFighters++;
    else if (line === 'rogue') numRogues++;
    else if (line === 'spellcaster') numSpellcasters++;
  });

  // ─── Identify champion ───
  let champion: Hero | null = null;
  let championIdx = -1;
  activeHeroes.forEach((h, i) => {
    if (isChampion(h) && h.hp > 0) {
      champion = h;
      championIdx = i;
    }
  });

  const champName = champion?.championName || champion?.name || '';
  const champTier = champion ? getHeroTier(champion) : 0;
  const aurasong = getAurasongBonuses(champion);

  // ─── Bjorn multiplier (flash quest zones) ───
  const bjornMult = isFlash ? 2.0 : 1.0;

  // ─── Initialize hero combat arrays ───
  const heroAtk: number[] = [];
  const heroDef: number[] = [];
  const heroHpMax: number[] = [];
  const heroCritChance: number[] = [];
  const heroCritMult: number[] = [];
  const heroEvasion: number[] = [];
  const heroThreat: number[] = [];
  const heroEvaCap: number[] = [];
  const heroArtNoEvasion: boolean[] = []; // Rock Stompers
  const heroArtCritChanceMod: number[] = []; // Kiku-Ichimonji
  const heroArtChampionMod: number[] = []; // Lone Wolf Cowl
  const heroBerserkerLevel: number[] = [];
  const heroIsNinja: boolean[] = [];
  const heroIsSensei: boolean[] = [];
  const heroIsSamurai: boolean[] = [];
  const heroIsDaimyo: boolean[] = [];
  const heroIsDancer: boolean[] = [];
  const heroIsConquistador: boolean[] = [];
  const heroIsDarkKnight: boolean[] = [];
  const heroIsLord: boolean[] = [];
  const heroIsMercenary: boolean[] = [];
  const heroIsCleric: boolean[] = [];
  const heroIsBishop: boolean[] = [];
  const heroTier: number[] = [];
  const heroMundra: number[] = []; // Mundra spirit bonus count
  const heroShark: number[] = [];
  const heroDinosaur: number[] = [];
  const heroLizard: number[] = [];
  const heroArmadillo: number[] = []; // Survive chance (%)

  for (let i = 0; i < numHeroes; i++) {
    const h = activeHeroes[i];
    const ps = precomputedStats?.[i];
    const tier = getHeroTier(h);
    heroTier.push(tier);

    // Use precomputed stats (from partyBuffCalculator with champion+aurasong+booster)
    // or fall back to raw hero stats
    heroAtk.push(ps ? ps.atk : (h.atk || 0));
    heroDef.push(ps ? ps.def : (h.def || 0));
    heroHpMax.push(ps ? ps.hp : (h.hp || 0));
    heroCritChance.push(ps ? ps.crit / 100 : (h.crit || 0) / 100);
    heroCritMult.push(ps ? ps.critDmg / 100 : (h.critDmg || 0) / 100);
    heroEvasion.push(ps ? ps.evasion / 100 : (h.evasion || 0) / 100);
    heroThreat.push(h.threat || 1);

    // Evasion cap: Pathfinder = 78%, others = 75%
    heroEvaCap.push(isClass(h, '길잡이', 'Pathfinder') ? 0.78 : 0.75);

    // Equipment artifacts
    const hasRockStompers = h.equipmentSlots?.some(s => s.item?.name === '락 스톰퍼') || false;
    heroArtNoEvasion.push(hasRockStompers);
    
    const hasKiku = h.equipmentSlots?.some(s => s.item?.name === '키쿠이치몬지') || false;
    heroArtCritChanceMod.push(hasKiku ? 0 : 1);
    
    const hasLoneWolf = h.equipmentSlots?.some(s => s.item?.name === '외로운 늑대 두건' || s.item?.name === '고독한 늑대 두건') || false;
    heroArtChampionMod.push(hasLoneWolf ? 0 : 1);

    // Class flags
    heroIsNinja.push(isClass(h, '닌자', 'Ninja'));
    heroIsSensei.push(isClass(h, '센세', '센세이', 'Sensei'));
    heroIsSamurai.push(isClass(h, '사무라이', 'Samurai'));
    heroIsDaimyo.push(isClass(h, '다이묘', 'Daimyo'));
    heroIsDancer.push(isClass(h, '무희', '곡예가', '댄서', '아크로뱃', 'Dancer', 'Acrobat'));
    heroIsConquistador.push(isClass(h, '정복자', 'Conquistador'));
    heroIsDarkKnight.push(isClass(h, '어둠의 기사', '죽음의 기사', '암흑기사', '데스나이트', 'Dark Knight', 'Death Knight'));
    heroIsLord.push(isClass(h, '기사', '군주', 'Lord', 'Knight'));
    heroIsMercenary.push(isMercenary(h));
    heroIsCleric.push(isClass(h, '성직자', '클레릭', 'Cleric'));
    heroIsBishop.push(isClass(h, '비숍', '주교', 'Bishop'));

    // Berserker level
    heroBerserkerLevel.push(isClass(h, '광전사', '잘', '야를', 'Berserker', 'Jarl') ? Math.min(tier, 4) : 0);

    // Spirits - read from equipment slots
    const spirits = (h.equipmentSlots || [])
      .map(s => s.spirit)
      .filter(Boolean);
    const spiritNames = spirits.map((sp: any) => typeof sp === 'string' ? sp : sp?.name || '').join(',');
    
    const mundraVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === 'string' ? sp : sp?.name || '';
      if (name.includes('문드라') || name.includes('Mundra')) {
        const val = typeof sp === 'object' ? (sp?.value || sp?.atk || 0) : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    heroMundra.push(mundraVal);
    
    const sharkVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === 'string' ? sp : sp?.name || '';
      if (name.includes('상어') || name.includes('Shark')) {
        const val = typeof sp === 'object' ? (sp?.value || sp?.atk || 0) : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    heroShark.push(sharkVal);
    
    const dinoVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === 'string' ? sp : sp?.name || '';
      if (name.includes('공룡') || name.includes('Dinosaur') || name.includes('T-Rex') || name.includes('티렉스')) {
        const val = typeof sp === 'object' ? (sp?.value || sp?.atk || 0) : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    heroDinosaur.push(dinoVal);
    
    const lizardVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === 'string' ? sp : sp?.name || '';
      if (name.includes('도마뱀') || name.includes('Lizard')) {
        const val = typeof sp === 'object' ? (sp?.value || 0) : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    heroLizard.push(lizardVal);
    
    const armadilloVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === 'string' ? sp : sp?.name || '';
      if (name.includes('아르마딜로') || name.includes('Armadillo')) {
        const val = typeof sp === 'object' ? (sp?.value || 0) : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    heroArmadillo.push(armadilloVal);
  }

  // ─── Mundra only works on bosses ───
  if (!monster.isBoss) {
    for (let i = 0; i < numHeroes; i++) heroMundra[i] = 0;
  }

  // ─── Champion bonuses ───
  let champAtkBonus = 0, champDefBonus = 0, champHpBonus = 0;
  let hemmaWho = -1;
  let hemmaMult = 0;
  let lordPresent = false;
  let lordHero = -1;
  let fateweaverPresent = false;

  // Find Lord and Fateweaver (always needed for combat logic)
  for (let i = 0; i < numHeroes; i++) {
    if (heroIsLord[i]) { lordPresent = true; lordHero = i; }
    if (isClass(activeHeroes[i], '크로노맨서', '페이트위버', '운명직공', 'Chronomancer', 'Fateweaver')) {
      fateweaverPresent = true;
    }
  }

  // When precomputedStats are provided, stats already include champion+aurasong+booster
  // Skip recomputation, just apply extreme penalty and use stats directly
  if (precomputedStats && precomputedStats.length === numHeroes) {
    // Hemma detection still needed for per-round cumulative bonus
    if (champName.includes('헴마') || champName === 'Hemma') {
      hemmaWho = championIdx;
      hemmaMult = 0.15 + champTier * 0.05;
    }

    // Extreme penalty on evasion
    if (isExtreme) {
      for (let i = 0; i < numHeroes; i++) {
        if (!heroArtNoEvasion[i]) {
          heroEvasion[i] = heroEvasion[i] - 0.20;
        }
      }
    }

    // Use precomputed ATK/DEF/HP directly (already includes champion+aurasong+booster)
    var finalAtk: number[] = heroAtk.map(v => v);
    var finalDef: number[] = heroDef.map(v => v);
    var finalHp: number[] = heroHpMax.map(v => v);
  } else {
    // ─── Full champion bonus computation (fallback when no precomputed stats) ───

  if (champName.includes('아르곤') || champName === 'Argon') {
    champAtkBonus = 0.1 * champTier;
    champDefBonus = 0.1 * champTier;
  } else if (champName.includes('애슐리') || champName === 'Ashley') {
    champAtkBonus = 0.05 + 0.05 * champTier;
    champDefBonus = 0.05 + 0.05 * champTier;
    if (monster.isBoss) { champAtkBonus *= 2; champDefBonus *= 2; }
  } else if (champName.includes('비외른') || champName === 'Bjorn') {
    for (let i = 0; i < numHeroes; i++) {
      const mult = heroIsMercenary[i] ? 1.25 * heroArtChampionMod[i] : heroArtChampionMod[i];
      heroCritMult[i] += (0.1 + 0.1 * champTier) * bjornMult * mult;
    }
    champHpBonus = 0.05 * champTier * bjornMult;
    champAtkBonus = champTier < 3
      ? (0.05 + 0.05 * champTier) * bjornMult
      : (0.1 * champTier - 0.1) * bjornMult;
  } else if (champName.includes('도노반') || champName === 'Donovan') {
    if (champTier === 1) champAtkBonus = 0.05 * numSpellcasters;
    else if (champTier === 2) champAtkBonus = 0.08 * numSpellcasters;
    else if (champTier === 3) champAtkBonus = 0.10 * numSpellcasters;
    else if (champTier === 4) champAtkBonus = 0.14 * numSpellcasters;
    champHpBonus = (0.04 + 0.01 * champTier + 0.02 * Math.max(champTier - 3, 0)) * numFighters;
    for (let i = 0; i < numHeroes; i++) {
      const mult = heroIsMercenary[i] ? 1.25 * heroArtChampionMod[i] : heroArtChampionMod[i];
      const bonus = (0.02 + 0.01 * champTier + 0.01 * Math.max(champTier - 3, 0)) * numRogues;
      heroCritChance[i] += bonus * mult;
      heroEvasion[i] += bonus * mult;
    }
  } else if (champName.includes('헴마') || champName === 'Hemma') {
    hemmaWho = championIdx;
    champHpBonus = 0.05 * champTier + 0.05 * Math.max(champTier - 3, 0);
    hemmaMult = 0.15 + champTier * 0.05;
  } else if (champName.includes('릴루') || champName === 'Lilu') {
    champHpBonus = 0.05 + 0.05 * champTier;
  } else if (champName.includes('맬러디') || champName === 'Malady') {
    const mTiers: Record<number, { atk: number; eva: number; crit: number }> = {
      1: { atk: 0.1, eva: 0.05, crit: 0.03 },
      2: { atk: 0.15, eva: 0.1, crit: 0.05 },
      3: { atk: 0.2, eva: 0.1, crit: 0.08 },
      4: { atk: 0.3, eva: 0.15, crit: 0.1 },
    };
    const mData = mTiers[champTier] || mTiers[1];
    champAtkBonus = mData.atk;
    for (let i = 0; i < numHeroes; i++) {
      const mult = heroIsMercenary[i] ? 1.25 * heroArtChampionMod[i] : heroArtChampionMod[i];
      heroEvasion[i] += mData.eva * mult;
      heroCritChance[i] += mData.crit * mult;
    }
  } else if (champName.includes('폴로니아') || champName === 'Polonia') {
    champDefBonus = 0.05 + 0.05 * champTier;
    for (let i = 0; i < numHeroes; i++) {
      const mult = heroIsMercenary[i] ? 1.25 * heroArtChampionMod[i] : heroArtChampionMod[i];
      heroEvasion[i] += (champTier < 3 ? 0.05 : 0.1) * mult;
    }
  } else if (champName.includes('라인홀드') || champName === 'Reinhold') {
    champAtkBonus = 0.05 + 0.05 * champTier + 0.05 * Math.max(champTier - 3, 0);
    champDefBonus = 0.05 + 0.05 * champTier + 0.05 * Math.max(champTier - 3, 0);
    champHpBonus = 0.05 + 0.05 * champTier + 0.05 * Math.max(champTier - 3, 0);
  } else if (champName.includes('시아') || champName === 'Sia') {
    champAtkBonus = 0.05 + 0.05 * champTier;
  } else if (champName.includes('야미') || champName === 'Yami') {
    for (let i = 0; i < numHeroes; i++) {
      const mult = heroIsMercenary[i] ? 1.25 * heroArtChampionMod[i] : heroArtChampionMod[i];
      heroCritChance[i] += 0.05 * champTier * mult;
      heroEvasion[i] += 0.05 * champTier * mult;
    }
  } else if (champName.includes('루도') || champName === 'Rudo') {
    // Rudo's crit bonus is handled per-round below
  } else if (champName.includes('타마스') || champName === 'Tamas') {
    // Random attack bonus applied per simulation
  }

  // ─── Apply aurasong bonuses ───
  if (aurasong.critPct || aurasong.evaPct || aurasong.critDmgPct) {
    for (let i = 0; i < numHeroes; i++) {
      const mercMult = heroIsMercenary[i] ? 1.25 : 1.0;
      heroCritChance[i] += aurasong.critPct * mercMult;
      heroEvasion[i] += aurasong.evaPct * mercMult;
      heroCritMult[i] += aurasong.critDmgPct * mercMult;
    }
  }

  // ─── Booster bonuses ───
  let boosterAtkBonus = 0, boosterDefBonus = 0;
  switch (booster.type) {
    case 'normal':
      boosterAtkBonus = 0.2; boosterDefBonus = 0.2;
      break;
    case 'super':
      boosterAtkBonus = 0.4; boosterDefBonus = 0.4;
      for (let i = 0; i < numHeroes; i++) heroCritChance[i] += 0.10;
      break;
    case 'mega':
      boosterAtkBonus = 0.8; boosterDefBonus = 0.8;
      for (let i = 0; i < numHeroes; i++) {
        heroCritChance[i] += 0.25;
        heroCritMult[i] += 0.5;
      }
      break;
  }
  // Stack extra bonuses (e.g., Fateweaver retry Normal booster: +20%/+20%)
  if (booster.extraAtkBonus) boosterAtkBonus += booster.extraAtkBonus;
  if (booster.extraDefBonus) boosterDefBonus += booster.extraDefBonus;
  if (booster.extraCritChance) {
    for (let i = 0; i < numHeroes; i++) heroCritChance[i] += booster.extraCritChance;
  }
  if (booster.extraCritMult) {
    for (let i = 0; i < numHeroes; i++) heroCritMult[i] += booster.extraCritMult;
  }

  // ─── Extreme: Apply -20% evasion penalty (after all champion/aurasong/booster bonuses) ───
  if (isExtreme) {
    for (let i = 0; i < numHeroes; i++) {
      if (!heroArtNoEvasion[i]) {
        heroEvasion[i] = heroEvasion[i] - 0.20;
      }
    }
  }

  // Per Korean doc: final = base × (1 + (champ + aurasong) × mercMult + booster)
  var finalAtk: number[] = [];
  var finalDef: number[] = [];
  var finalHp: number[] = [];

  for (let i = 0; i < numHeroes; i++) {
    const mercMult = heroIsMercenary[i] ? 1.25 : 1.0;
    const champModI = heroArtChampionMod[i];
    const loneWolfBonus = champModI === 0 ? 0.4 : 0;

    finalAtk.push(
      heroAtk[i] * (1.0 + (champAtkBonus * champModI + aurasong.atkPct) * mercMult + boosterAtkBonus + loneWolfBonus)
      + aurasong.flatAtk
    );
    finalDef.push(
      heroDef[i] * (1.0 + (champDefBonus * champModI + aurasong.defPct) * mercMult + boosterDefBonus + loneWolfBonus)
      + aurasong.flatDef
    );
    finalHp.push(
      heroHpMax[i] * (1.0 + (champHpBonus * champModI + aurasong.hpPct) * mercMult)
      + aurasong.flatHp
    );
  }
  } // end else (no precomputed stats)

  // ─── Damage taken calculation (using actual defense thresholds) ───
  const damageTaken: number[] = [];
  const critDamageTaken: number[] = [];
  const defThresholds: DefThresholds = monster.def;

  for (let i = 0; i < numHeroes; i++) {
    const dmg = calcDamageTakenWithThresholds(finalDef[i], mobDamage, defThresholds);
    damageTaken.push(dmg);
    critDamageTaken.push(calcCritDamageTaken(dmg, mobDamage));
  }

  // ─── Barrier check ───
  let barrierMod = 1.0;
  if (monster.barrier && monster.barrier.hp > 0) {
    let totalBarrierDmg = 0;
    const barrierEl = monster.barrierElement;
    
    activeHeroes.forEach(h => {
      if (!barrierEl) return;
      let elVal = h.equipmentElements?.[barrierEl] || 0;
      // Spell Knight / 마법검 / 스펠나이트: can use any element but at 50% effectiveness
      const isSpellKnight = isClass(h, '마법검', '스펠나이트', 'Spellblade', 'Spellknight');
      if (isSpellKnight) {
        // Sum all element values and apply 50%
        const allElements = h.equipmentElements || {};
        const totalElVal = Object.values(allElements).reduce((s: number, v: number) => s + (v || 0), 0);
        elVal = Math.floor(totalElVal * 0.5);
      } else if (h.element === barrierEl || h.element === '모든 원소' || h.element === '전체') {
        // Matching element uses full value
        totalBarrierDmg += elVal;
        return;
      } else if (barrierEl === '랜덤') {
        totalBarrierDmg += elVal;
        return;
      } else {
        totalBarrierDmg += h.equipmentElements?.[barrierEl] || 0;
        return;
      }
      totalBarrierDmg += elVal;
    });

    // Rudo barrier bonus: 50% more barrier damage (all tiers)
    if (champName.includes('루도') || champName === 'Rudo') {
      totalBarrierDmg = Math.round(totalBarrierDmg * 1.5);
    }

    if (totalBarrierDmg < monster.barrier.hp) {
      barrierMod = 0.2; // Can't break barrier, only 20% damage
    }
  }

  // ─── Berserker HP thresholds ───
  const berserkHp1: number[] = [];
  const berserkHp2: number[] = [];
  const berserkHp3: number[] = [];
  for (let i = 0; i < numHeroes; i++) {
    if (heroTier[i] === 4) {
      berserkHp1.push(0.8); berserkHp2.push(0.55); berserkHp3.push(0.3);
    } else {
      berserkHp1.push(0.75); berserkHp2.push(0.5); berserkHp3.push(0.25);
    }
  }

  // ─── Rudo initial crit bonus ───
  let rudoBonusBase = 0;
  let rudoRounds = 0;
  if (champName.includes('루도') || champName === 'Rudo') {
    if (champTier === 1) { rudoBonusBase = 0.3; rudoRounds = 2; }
    else if (champTier === 2) { rudoBonusBase = 0.4; rudoRounds = 3; }
    else if (champTier === 3) { rudoBonusBase = 0.4; rudoRounds = 3; }
    else if (champTier === 4) { rudoBonusBase = 0.5; rudoRounds = 4; }
    // Mercenary bonus
    if (heroIsMercenary[championIdx]) {
      rudoBonusBase *= 1.25;
    }
  }

  // ─── Lilu heal amount ───
  // Lilu heal: FLAT amount per hero per round (NOT percentage)
  let liluHealFlat = 0;
  if (champName.includes('릴루') || champName === 'Lilu') {
    if (champTier === 1) liluHealFlat = 3;
    else if (champTier === 2) liluHealFlat = 5;
    else if (champTier === 3) liluHealFlat = 10;
    else if (champTier === 4) liluHealFlat = 20;
  }

  // ─── Simulation ──────────────────────────────────────────────────────────

  let timesQuestWon = 0;
  let roundsAvg = 0, roundsMin = 1000, roundsMax = 0;
  let roundLimitTimes = 0;
  // Win/loss round tracking
  let winRoundsSum = 0, winRoundsMin = 1000, winRoundsMax = 0;
  let loseRoundsSum = 0, loseRoundsMin = 1000, loseRoundsMax = 0, loseCount = 0;

  const timesSurvived = new Float64Array(numHeroes);
  const damageDealtAvg = new Float64Array(numHeroes);
  const normalDmgDealtAccum = new Float64Array(numHeroes);
  const critDmgDealtAccum = new Float64Array(numHeroes);
  const damageDealtMax = new Float64Array(numHeroes);
  const damageDealtMin = new Float64Array(numHeroes).fill(1e9);
  const hpRemainingAvg = new Float64Array(numHeroes);
  const hpRemainingMax = new Float64Array(numHeroes);
  // Enhanced tracking
  const totalRoundsPerHero = new Float64Array(numHeroes);
  const timesTargeted = new Float64Array(numHeroes);
  const timesEvaded = new Float64Array(numHeroes);
  const totalHealing = new Float64Array(numHeroes);
  const lordProtections = new Float64Array(numHeroes);
  const lordProtectedSingle = new Float64Array(numHeroes);
  const lordProtectedAoe = new Float64Array(numHeroes);
  const lordAbsorbedSingle = new Float64Array(numHeroes);
  const lordAbsorbedAoe = new Float64Array(numHeroes);
  const critSurvivals = new Float64Array(numHeroes);
  const berserkerBelowT1 = new Float64Array(numHeroes);
  const berserkerBelowT2 = new Float64Array(numHeroes);
  const berserkerBelowT3 = new Float64Array(numHeroes);
  // Total damage taken tracking
  const totalDmgTakenAccum = new Float64Array(numHeroes);
  const totalTimesHitAccum = new Float64Array(numHeroes);
  const singleTargetHitsTotal = new Float64Array(numHeroes);
  const aoeDmgTakenAccum = new Float64Array(numHeroes);
  const singleDmgTakenAccum = new Float64Array(numHeroes);
  const dmgTakenMin = new Float64Array(numHeroes).fill(1e9);
  const dmgTakenMax = new Float64Array(numHeroes);

  // Per-sim party-level aggregates (sum across heroes per sim → distribution)
  // We'll track sums/min/max across sims for: party damage dealt, party damage taken
  let partyDmgSum = 0, partyDmgSqSum = 0;
  let partyDmgMin = Infinity, partyDmgMax = 0;
  let partyTakenSum = 0;
  let partyTakenMin = Infinity, partyTakenMax = 0;
  let partyDmgPerTurnSum = 0, partyDmgPerTurnMin = Infinity, partyDmgPerTurnMax = 0;
  let partyTakenPerTurnSum = 0, partyTakenPerTurnMin = Infinity, partyTakenPerTurnMax = 0;
  let partySimCount = 0;
  // Win/lose bucketed party aggregates
  let winPartyDmgSum = 0, winPartyDmgMin = Infinity, winPartyDmgMax = 0;
  let winPartyTakenSum = 0, winPartyTakenMin = Infinity, winPartyTakenMax = 0;
  let winPartyDmgPerTurnSum = 0, winPartyDmgPerTurnMin = Infinity, winPartyDmgPerTurnMax = 0;
  let winPartyTakenPerTurnSum = 0, winPartyTakenPerTurnMin = Infinity, winPartyTakenPerTurnMax = 0;
  let winPartyCount = 0;
  let losePartyDmgSum = 0, losePartyDmgMin = Infinity, losePartyDmgMax = 0;
  let losePartyTakenSum = 0, losePartyTakenMin = Infinity, losePartyTakenMax = 0;
  let losePartyDmgPerTurnSum = 0, losePartyDmgPerTurnMin = Infinity, losePartyDmgPerTurnMax = 0;
  let losePartyTakenPerTurnSum = 0, losePartyTakenPerTurnMin = Infinity, losePartyTakenPerTurnMax = 0;
  let losePartyCount = 0;

  // ─── Win/Lose bucket accumulators (per-hero, per-outcome) ───
  const winDmgDealt = new Float64Array(numHeroes);
  const winNormalDmg = new Float64Array(numHeroes);
  const winCritDmg = new Float64Array(numHeroes);
  const winDmgMax = new Float64Array(numHeroes);
  const winDmgMin = new Float64Array(numHeroes).fill(1e9);
  const winRoundsArr = new Float64Array(numHeroes);
  const winDmgTaken = new Float64Array(numHeroes);
  const winTimesHit = new Float64Array(numHeroes);
  const winSingleHits = new Float64Array(numHeroes);
  const winSurvived = new Float64Array(numHeroes);
  const winHpRemain = new Float64Array(numHeroes);
  const winTargeted = new Float64Array(numHeroes);
  const winEvaded = new Float64Array(numHeroes);

  const loseDmgDealt = new Float64Array(numHeroes);
  const loseNormalDmg = new Float64Array(numHeroes);
  const loseCritDmg = new Float64Array(numHeroes);
  const loseDmgMax = new Float64Array(numHeroes);
  const loseDmgMin = new Float64Array(numHeroes).fill(1e9);
  const loseRoundsArr = new Float64Array(numHeroes);
  const loseDmgTaken = new Float64Array(numHeroes);
  const loseTimesHit = new Float64Array(numHeroes);
  const loseSingleHits = new Float64Array(numHeroes);
  const loseHpRemain = new Float64Array(numHeroes);
  const loseTargeted = new Float64Array(numHeroes);
  const loseEvaded = new Float64Array(numHeroes);
  // Per-fight targeted/evaded snapshots
  const fightTargetedTmp = new Float64Array(numHeroes);
  const fightEvadedTmp = new Float64Array(numHeroes);

  // Tamas random range
  const isTamas = champName.includes('타마스') || champName === 'Tamas';
  const tamasMin = isTamas ? (champTier < 3 ? 0.05 + 0.05 * champTier : 0.1 * champTier) : 0;
  const tamasMax = isTamas ? tamasMin * 2 : 0;

  let actualSimCount = simCount;

  for (let sim = 0; sim < actualSimCount; sim++) {
    // Per-simulation state
    const hp = new Float64Array(numHeroes);
    const damageFight = new Float64Array(numHeroes);
    const normalDmgFight = new Float64Array(numHeroes);
    const critDmgFight = new Float64Array(numHeroes);
    const surviveChance = new Float64Array(numHeroes);
    const berserkerStage = new Int32Array(numHeroes);
    const guaranteedCrit = new Uint8Array(numHeroes);
    const guaranteedEvade = new Uint8Array(numHeroes);
    const ninjaBonus = new Float64Array(numHeroes);
    const ninjaEvasion = new Float64Array(numHeroes);
    const lostInnate = new Int32Array(numHeroes).fill(-5);
    const consecutiveCritBonus = new Float64Array(numHeroes);
    const hemmaBonus = new Float64Array(numHeroes);
    const simDmgTaken = new Float64Array(numHeroes);
    const simTimesHit = new Float64Array(numHeroes);
    const singleHitsTaken = new Float64Array(numHeroes);
    const simTargeted = new Float64Array(numHeroes);
    const simEvaded = new Float64Array(numHeroes);
    const simAoeDmgTaken = new Float64Array(numHeroes);
    const simSingleDmgTaken = new Float64Array(numHeroes);
    const simLordSingleSaved = new Float64Array(numHeroes);
    const simLordAoeSaved = new Float64Array(numHeroes);
    const simLordAbsorbedSingle = new Float64Array(numHeroes);
    const simLordAbsorbedAoe = new Float64Array(numHeroes);

    let rudoBonus = rudoBonusBase;
    let tamasBonus = isTamas ? tamasMin + Math.random() * (tamasMax - tamasMin) : 0;

    for (let i = 0; i < numHeroes; i++) {
      hp[i] = finalHp[i];
      
      // Backfire Hammer
      const hasBackfire = activeHeroes[i].equipmentSlots?.some(s => s.item?.name === '백파이어 해머') || false;
      if (hasBackfire) hp[i] = 0.75 * finalHp[i];

      surviveChance[i] = heroArmadillo[i] / 100;
      if (heroIsCleric[i] || heroIsBishop[i]) surviveChance[i] = 1.2; // Always survives first fatal blow

      if (heroIsNinja[i] || heroIsSensei[i]) {
        ninjaBonus[i] = 0.1 + Math.min(heroTier[i], 4) * 0.1;
        ninjaEvasion[i] = heroTier[i] >= 4 ? 0.25 : heroTier[i] >= 3 ? 0.20 : 0.15;
      }
      if (heroIsDaimyo[i]) guaranteedEvade[i] = 1;
    }

    let mobHpCurrent = mobHp;
    let heroesAlive = numHeroes;
    let updateTarget = true;
    let round = 0;
    let sharkActive = 0;
    let dinosaurActive = 1;
    let lordSave = true;
    let contFight = true;

    // Randomize attack order
    const attackOrder = Array.from({ length: numHeroes }, (_, i) => i);
    for (let i = numHeroes - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [attackOrder[i], attackOrder[j]] = [attackOrder[j], attackOrder[i]];
    }

    // Target probabilities
    let targetThresholds = new Float64Array(numHeroes);

    while (contFight) {
      round++;

      // ─── Update targeting ───
      if (updateTarget) {
        let totalThreat = 0;
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] > 0) totalThreat += heroThreat[i];
        }
        let cumulative = 0;
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] > 0) cumulative += heroThreat[i];
          targetThresholds[i] = cumulative / totalThreat;
        }
        updateTarget = false;
      }

      // ─── Sensei innate recovery ───
      for (let i = 0; i < numHeroes; i++) {
        if (heroIsSensei[i] && lostInnate[i] === round - 2) {
          ninjaBonus[i] = 0.1 + Math.min(heroTier[i], 4) * 0.1;
          ninjaEvasion[i] = heroTier[i] >= 4 ? 0.25 : heroTier[i] >= 3 ? 0.20 : 0.15;
        }
      }

      // ─── Extreme crit bonus from negative evasion ───
      const extremeCritBonus = new Float64Array(numHeroes);
      if (isExtreme) {
        for (let i = 0; i < numHeroes; i++) {
          const totalEva = heroEvasion[i] + berserkerStage[i] * 0.1 + ninjaEvasion[i];
          if (totalEva < 0 && !heroArtNoEvasion[i]) {
            extremeCritBonus[i] = -0.25 * totalEva; // Negative evasion → positive crit bonus
          }
        }
      }

      // ─── Monster attacks ───
      const isAoe = Math.random() < mobAoeChance && heroesAlive > 1;

      if (isAoe) {
        // AoE attack hits all alive heroes
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] <= 0) continue;
          timesTargeted[i]++;
          simTargeted[i]++;

          const totalEva = heroEvasion[i] + berserkerStage[i] * 0.1 + ninjaEvasion[i];
          const cappedEva = Math.min(totalEva, heroEvaCap[i]);

          if (guaranteedEvade[i] || (Math.random() < cappedEva && !heroArtNoEvasion[i])) {
            // Evaded
            timesEvaded[i]++;
            simEvaded[i]++;
            if (heroIsDancer[i]) guaranteedCrit[i] = 1;
          } else {
            // Hit - AoE uses normal damage × aoe ratio (AoE has NO crit)
            const dmg = Math.ceil(damageTaken[i] * mobAoeDmgRatio);
            hp[i] -= dmg;
            simDmgTaken[i] += dmg;
            simAoeDmgTaken[i] += dmg;
            simTimesHit[i]++;

            if (hp[i] <= 0) {
              const survived = handleFatalBlow(i);
              if (!survived) {
                // Lord save check
                if (lordPresent && lordSave && !heroIsLord[i] && hp[lordHero] > 0) {
                  lordSave = false;
                  lordProtections[i]++;
                  simLordAoeSaved[i]++;
                  hp[i] += dmg; // Restore this hero
                  const lordDmg = Math.ceil(damageTaken[lordHero] * mobAoeDmgRatio);
                  simLordAbsorbedAoe[lordHero] += lordDmg;
                  hp[lordHero] -= lordDmg;
                  if (hp[lordHero] <= 0) {
                    if (!handleFatalBlow(lordHero)) {
                      hp[lordHero] = 0;
                      heroesAlive--;
                      updateTarget = true;
                    }
                  }
                } else {
                  hp[i] = 0;
                  heroesAlive--;
                  updateTarget = true;
                }
              }
            }
            // Sensei loses innate when hit
            if (heroIsSensei[i] && lostInnate[i] !== round - 1) lostInnate[i] = round;
          }
        }
      } else {
        // Single target attack
        const rng = Math.random();
        let target = 0;
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] > 0 && rng <= targetThresholds[i]) {
            target = i;
            break;
          }
        }
        // Fallback to last alive
        if (hp[target] <= 0) {
          for (let i = numHeroes - 1; i >= 0; i--) {
            if (hp[i] > 0) { target = i; break; }
          }
        }

        timesTargeted[target]++;
        simTargeted[target]++;

        const totalEva = heroEvasion[target] + berserkerStage[target] * 0.1 + ninjaEvasion[target];
        const cappedEva = Math.min(totalEva, heroEvaCap[target]);

        if (guaranteedEvade[target] || (Math.random() < cappedEva && !heroArtNoEvasion[target])) {
          timesEvaded[target]++;
          simEvaded[target]++;
          if (heroIsDancer[target]) guaranteedCrit[target] = 1;
        } else {
          const isCrit = Math.random() < baseMobCritChance * mobCritChanceMod + extremeCritBonus[target];
          const dmg = isCrit ? critDamageTaken[target] : damageTaken[target];
          hp[target] -= dmg;
          simDmgTaken[target] += dmg;
          simSingleDmgTaken[target] += dmg;
          simTimesHit[target]++;
          singleHitsTaken[target]++;

          if (hp[target] <= 0) {
            const survived = handleFatalBlow(target);
            if (!survived) {
              if (lordPresent && lordSave && !heroIsLord[target] && hp[lordHero] > 0) {
                lordSave = false;
                lordProtections[target]++;
                simLordSingleSaved[target]++;
                singleHitsTaken[target]--;
                singleHitsTaken[lordHero]++;
                hp[target] += dmg;
                simLordAbsorbedSingle[lordHero] += damageTaken[lordHero];
                hp[lordHero] -= damageTaken[lordHero];
                if (hp[lordHero] <= 0) {
                  if (!handleFatalBlow(lordHero)) {
                    hp[lordHero] = 0;
                    heroesAlive--;
                    updateTarget = true;
                  }
                }
              } else {
                hp[target] = 0;
                heroesAlive--;
                updateTarget = true;
              }
            }
          }
          if (heroIsSensei[target] && lostInnate[target] !== round - 1) lostInnate[target] = round;
        }
      }

      // ─── Hemma drain ───
      if (hemmaWho >= 0 && hp[hemmaWho] > 0) {
        let drainTarget = -1;
        const drainThreshold = (0.11 - 0.01 * champTier);
        for (let i = 0; i < numHeroes; i++) {
          if (i !== hemmaWho && hp[i] > drainThreshold * finalHp[i]) {
            if (drainTarget === -1 || hp[i] / finalHp[i] > hp[drainTarget] / finalHp[drainTarget]) {
              drainTarget = i;
            }
          }
        }
        if (drainTarget >= 0) {
          hp[drainTarget] -= drainThreshold * finalHp[drainTarget];
          if (heroIsSensei[drainTarget] && lostInnate[drainTarget] !== round - 1) {
            lostInnate[drainTarget] = round;
          }
          // Hemma attack bonus: base_atk × hemmaMult (flat add per drain)
          hemmaBonus[hemmaWho] += heroAtk[hemmaWho] * hemmaMult;
          hp[hemmaWho] = Math.min(hp[hemmaWho] + (champTier + Math.min(champTier - 3, 0)) * 5, finalHp[hemmaWho]);
        }
      }

      // ─── Berserker stage update ───
      for (let i = 0; i < numHeroes; i++) {
        if (heroBerserkerLevel[i] > 0 && hp[i] > 0) {
          if (hp[i] >= berserkHp1[i] * finalHp[i]) berserkerStage[i] = 0;
          else if (hp[i] >= berserkHp2[i] * finalHp[i]) { berserkerStage[i] = 1; berserkerBelowT1[i]++; }
          else if (hp[i] >= berserkHp3[i] * finalHp[i]) { berserkerStage[i] = 2; berserkerBelowT1[i]++; berserkerBelowT2[i]++; }
          else { berserkerStage[i] = 3; berserkerBelowT1[i]++; berserkerBelowT2[i]++; berserkerBelowT3[i]++; }
        }

        // Ninja loses innate when hit
        if (heroIsNinja[i] && hp[i] < finalHp[i]) {
          ninjaBonus[i] = 0; ninjaEvasion[i] = 0;
        }
        if (heroIsSensei[i] && lostInnate[i] === round) {
          ninjaBonus[i] = 0; ninjaEvasion[i] = 0;
        }

        // Samurai/Daimyo: guaranteed crit round 1
        if (round === 1 && (heroIsSamurai[i] || heroIsDaimyo[i])) {
          guaranteedCrit[i] = 1;
          guaranteedEvade[i] = 0;
        }
      }

      // ─── Heroes Attack ───
      for (let ii = 0; ii < numHeroes; ii++) {
        const jj = attackOrder[ii];
        if (hp[jj] <= 0) continue;

        // Mob evasion check
        if (mobEvasion >= 0 && Math.random() < mobEvasion) continue;

        // Tamas bonus applied to attack
        const tamasAtkMult = (jj === championIdx && isTamas) ? (1 + tamasBonus) : 1;

        // Hero attack calculation
        const atkMod = 1.0 + 0.2 * heroMundra[jj] + sharkActive * 0.01 * heroShark[jj] 
          + dinosaurActive * heroDinosaur[jj] * 0.01 
          + 0.1 * (1 + heroBerserkerLevel[jj]) * berserkerStage[jj];
        
        const baseHeroDmg = finalAtk[jj] * atkMod * tamasAtkMult + hemmaBonus[jj];

        const totalCritChance = Math.min(1.0,
          (heroCritChance[jj] + ninjaBonus[jj] + rudoBonus) * heroArtCritChanceMod[jj]
          + (1 - heroArtCritChanceMod[jj]) * 0.2);

        const isCrit = Math.random() < totalCritChance || guaranteedCrit[jj];

        let damage: number;
        if (isCrit) {
          const critMult = heroCritMult[jj] + consecutiveCritBonus[jj];
          // Samurai/Daimyo round 1: ignore barrier
          if (round === 1 && (heroIsSamurai[jj] || heroIsDaimyo[jj])) {
            damage = baseHeroDmg * critMult;
          } else {
            damage = baseHeroDmg * critMult * barrierMod;
            if (heroIsConquistador[jj]) {
              consecutiveCritBonus[jj] = Math.min(consecutiveCritBonus[jj] + 0.25, 1);
            }
          }
        } else {
          damage = baseHeroDmg * barrierMod;
          if (heroIsConquistador[jj]) consecutiveCritBonus[jj] = 0;
        }

        mobHpCurrent -= damage;
        damageFight[jj] += damage;
        if (isCrit) critDmgFight[jj] += damage;
        else normalDmgFight[jj] += damage;

        // Dark Knight / Death Knight execute at 10% HP
        if (heroIsDarkKnight[jj] && mobHpCurrent < mobHp * 0.1) {
          mobHpCurrent = -1;
        }

        // Shark activates at 50% mob HP
        if (mobHpCurrent < mobHp / 2) sharkActive = 1;

        guaranteedCrit[jj] = 0;
      }

      dinosaurActive = 0; // Dinosaur only active round 1

      // ─── Rudo bonus expires ───
      if (round >= rudoRounds) rudoBonus = 0;

      // ─── Check win/lose ───
      let wasWin = false;
      let wasLose = false;
      if (mobHpCurrent <= 0) {
        contFight = false;
        wasWin = true;
        timesQuestWon++;
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] > 0) timesSurvived[i]++;
          hpRemainingAvg[i] += Math.max(hp[i], 0);
          hpRemainingMax[i] = Math.max(hpRemainingMax[i], hp[i]);
          if (hp[i] > 0) winSurvived[i]++;
          winHpRemain[i] += Math.max(hp[i], 0);
        }
        roundsAvg += round;
        roundsMax = Math.max(roundsMax, round);
        roundsMin = Math.min(roundsMin, round);
        winRoundsSum += round;
        winRoundsMin = Math.min(winRoundsMin, round);
        winRoundsMax = Math.max(winRoundsMax, round);
      }

      if (heroesAlive === 0) {
        contFight = false;
        wasLose = true;
        loseCount++;
        loseRoundsSum += round;
        loseRoundsMin = Math.min(loseRoundsMin, round);
        loseRoundsMax = Math.max(loseRoundsMax, round);
        // Include lose rounds in overall (전체) totals
        roundsAvg += round;
        roundsMax = Math.max(roundsMax, round);
        roundsMin = Math.min(roundsMin, round);
        for (let i = 0; i < numHeroes; i++) {
          loseHpRemain[i] += Math.max(hp[i], 0);
        }
      }

      if (contFight && round >= 499) {
        contFight = false;
        wasLose = true;
        roundLimitTimes++;
        loseCount++;
        loseRoundsSum += round;
        loseRoundsMin = Math.min(loseRoundsMin, round);
        loseRoundsMax = Math.max(loseRoundsMax, round);
        // Include lose rounds in overall (전체) totals
        roundsAvg += round;
        roundsMax = Math.max(roundsMax, round);
        roundsMin = Math.min(roundsMin, round);
        for (let i = 0; i < numHeroes; i++) {
          loseHpRemain[i] += Math.max(hp[i], 0);
        }
      }

      if (!contFight) {
        // Per-sim party totals
        let simPartyDmg = 0;
        let simPartyTaken = 0;
        for (let i = 0; i < numHeroes; i++) {
          damageDealtAvg[i] += damageFight[i];
          normalDmgDealtAccum[i] += normalDmgFight[i];
          critDmgDealtAccum[i] += critDmgFight[i];
          damageDealtMax[i] = Math.max(damageDealtMax[i], damageFight[i]);
          // Only update min damage if hero actually dealt damage (fought at least once)
          if (damageFight[i] > 0) {
            damageDealtMin[i] = Math.min(damageDealtMin[i], damageFight[i]);
          }
          totalRoundsPerHero[i] += round;
          totalDmgTakenAccum[i] += simDmgTaken[i];
          totalTimesHitAccum[i] += simTimesHit[i];
          singleTargetHitsTotal[i] += singleHitsTaken[i];
          aoeDmgTakenAccum[i] += simAoeDmgTaken[i];
          singleDmgTakenAccum[i] += simSingleDmgTaken[i];
          if (simDmgTaken[i] > 0) {
            dmgTakenMin[i] = Math.min(dmgTakenMin[i], simDmgTaken[i]);
          }
          dmgTakenMax[i] = Math.max(dmgTakenMax[i], simDmgTaken[i]);
          lordProtectedSingle[i] += simLordSingleSaved[i];
          lordProtectedAoe[i] += simLordAoeSaved[i];
          lordAbsorbedSingle[i] += simLordAbsorbedSingle[i];
          lordAbsorbedAoe[i] += simLordAbsorbedAoe[i];

          simPartyDmg += damageFight[i];
          simPartyTaken += simDmgTaken[i];

          // Bucket per-fight values into win or lose
          if (wasWin) {
            winDmgDealt[i] += damageFight[i];
            winNormalDmg[i] += normalDmgFight[i];
            winCritDmg[i] += critDmgFight[i];
            winDmgMax[i] = Math.max(winDmgMax[i], damageFight[i]);
            if (damageFight[i] > 0) winDmgMin[i] = Math.min(winDmgMin[i], damageFight[i]);
            winRoundsArr[i] += round;
            winDmgTaken[i] += simDmgTaken[i];
            winTimesHit[i] += simTimesHit[i];
            winSingleHits[i] += singleHitsTaken[i];
            winTargeted[i] += simTargeted[i];
            winEvaded[i] += simEvaded[i];
          } else if (wasLose) {
            loseDmgDealt[i] += damageFight[i];
            loseNormalDmg[i] += normalDmgFight[i];
            loseCritDmg[i] += critDmgFight[i];
            loseDmgMax[i] = Math.max(loseDmgMax[i], damageFight[i]);
            if (damageFight[i] > 0) loseDmgMin[i] = Math.min(loseDmgMin[i], damageFight[i]);
            loseRoundsArr[i] += round;
            loseDmgTaken[i] += simDmgTaken[i];
            loseTimesHit[i] += simTimesHit[i];
            loseSingleHits[i] += singleHitsTaken[i];
            loseTargeted[i] += simTargeted[i];
            loseEvaded[i] += simEvaded[i];
          }
        }
        // Aggregate party-per-sim distributions
        const simPartyDmgPerTurn = round > 0 ? simPartyDmg / round : 0;
        const simPartyTakenPerTurn = round > 0 ? simPartyTaken / round : 0;
        partyDmgSum += simPartyDmg;
        if (simPartyDmg < partyDmgMin) partyDmgMin = simPartyDmg;
        if (simPartyDmg > partyDmgMax) partyDmgMax = simPartyDmg;
        partyDmgPerTurnSum += simPartyDmgPerTurn;
        if (simPartyDmgPerTurn < partyDmgPerTurnMin) partyDmgPerTurnMin = simPartyDmgPerTurn;
        if (simPartyDmgPerTurn > partyDmgPerTurnMax) partyDmgPerTurnMax = simPartyDmgPerTurn;
        partyTakenSum += simPartyTaken;
        if (simPartyTaken < partyTakenMin) partyTakenMin = simPartyTaken;
        if (simPartyTaken > partyTakenMax) partyTakenMax = simPartyTaken;
        partyTakenPerTurnSum += simPartyTakenPerTurn;
        if (simPartyTakenPerTurn < partyTakenPerTurnMin) partyTakenPerTurnMin = simPartyTakenPerTurn;
        if (simPartyTakenPerTurn > partyTakenPerTurnMax) partyTakenPerTurnMax = simPartyTakenPerTurn;
        partySimCount++;
        if (wasWin) {
          winPartyDmgSum += simPartyDmg;
          if (simPartyDmg < winPartyDmgMin) winPartyDmgMin = simPartyDmg;
          if (simPartyDmg > winPartyDmgMax) winPartyDmgMax = simPartyDmg;
          winPartyDmgPerTurnSum += simPartyDmgPerTurn;
          if (simPartyDmgPerTurn < winPartyDmgPerTurnMin) winPartyDmgPerTurnMin = simPartyDmgPerTurn;
          if (simPartyDmgPerTurn > winPartyDmgPerTurnMax) winPartyDmgPerTurnMax = simPartyDmgPerTurn;
          winPartyTakenSum += simPartyTaken;
          if (simPartyTaken < winPartyTakenMin) winPartyTakenMin = simPartyTaken;
          if (simPartyTaken > winPartyTakenMax) winPartyTakenMax = simPartyTaken;
          winPartyTakenPerTurnSum += simPartyTakenPerTurn;
          if (simPartyTakenPerTurn < winPartyTakenPerTurnMin) winPartyTakenPerTurnMin = simPartyTakenPerTurn;
          if (simPartyTakenPerTurn > winPartyTakenPerTurnMax) winPartyTakenPerTurnMax = simPartyTakenPerTurn;
          winPartyCount++;
        } else if (wasLose) {
          losePartyDmgSum += simPartyDmg;
          if (simPartyDmg < losePartyDmgMin) losePartyDmgMin = simPartyDmg;
          if (simPartyDmg > losePartyDmgMax) losePartyDmgMax = simPartyDmg;
          losePartyDmgPerTurnSum += simPartyDmgPerTurn;
          if (simPartyDmgPerTurn < losePartyDmgPerTurnMin) losePartyDmgPerTurnMin = simPartyDmgPerTurn;
          if (simPartyDmgPerTurn > losePartyDmgPerTurnMax) losePartyDmgPerTurnMax = simPartyDmgPerTurn;
          losePartyTakenSum += simPartyTaken;
          if (simPartyTaken < losePartyTakenMin) losePartyTakenMin = simPartyTaken;
          if (simPartyTaken > losePartyTakenMax) losePartyTakenMax = simPartyTaken;
          losePartyTakenPerTurnSum += simPartyTakenPerTurn;
          if (simPartyTakenPerTurn < losePartyTakenPerTurnMin) losePartyTakenPerTurnMin = simPartyTakenPerTurn;
          if (simPartyTakenPerTurn > losePartyTakenPerTurnMax) losePartyTakenPerTurnMax = simPartyTakenPerTurn;
          losePartyCount++;
        }
      }

      // ─── Healing (Lizard, Cleric, Bishop, Lilu) ───
      if (contFight) {
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] <= 0) continue;
          const hpBefore = hp[i];
          hp[i] = Math.min(hp[i] + heroLizard[i], finalHp[i]);
          
          if (heroIsCleric[i]) {
            hp[i] = Math.min(hp[i] + Math.min(heroTier[i], 3) * 5 - 5, finalHp[i]);
          } else if (heroIsBishop[i]) {
            const bHeal = heroTier[i] >= 3 ? 20 : heroTier[i] >= 2 ? 5 : 0;
            hp[i] = Math.min(hp[i] + bHeal, finalHp[i]);
          }

          if (liluHealFlat > 0) {
            hp[i] = Math.min(hp[i] + liluHealFlat * heroArtChampionMod[i], finalHp[i]);
          }
          totalHealing[i] += hp[i] - hpBefore;
        }
      }

      // After 5000 sims, check if avg rounds > 200 → cap at 5000
      if (sim === 4999 && roundsAvg / 5000 > 200) {
        actualSimCount = 5000;
      }
    } // end while

    function handleFatalBlow(idx: number): boolean {
      if (Math.random() < surviveChance[idx]) {
        hp[idx] = 1;
        surviveChance[idx] = 0;
        critSurvivals[idx]++;
        return true;
      }
      return false;
    }
  } // end simulation loop

  // ─── Compute results ───
  const rawWinRate = (timesQuestWon / actualSimCount) * 100;
  let winRate = rawWinRate;
  let retryWinRate: number | undefined;
  let retrySimulations: number | undefined;

  // Fateweaver/Chronomancer retry: re-run simulation with added Normal booster
  if (fateweaverPresent && rawWinRate < 100 && !config._isRetry && !config._disableRetry) {
    const retryResult = runCombatSimulation({
      ...config,
      booster: getRetryBooster(booster),
      simulationCount: Math.min(actualSimCount, 25000),
      _isRetry: true,
    });

    retryWinRate = retryResult.rawWinRate;
    retrySimulations = retryResult.totalSimulations;

    // Combined win rate: win on first try OR (lose first try AND win on retry)
    // P(win) = P1 + (1 - P1) × P2
    winRate = rawWinRate + (100 - rawWinRate) * (retryWinRate / 100);
  }

  // Compute incoming damage stats (single hit, not per-sim averages)
  // Calculate threat-based targeting rates
  const totalThreat = activeHeroes.reduce((s, h) => s + (h.threat || 1), 0);
  const totalAllSingleHits = Array.from(singleTargetHitsTotal).reduce((s, v) => s + v, 0);

  const heroResults: HeroSimResult[] = activeHeroes.map((h, i) => {
    const normalHit = damageTaken[i];
    const aoeHit = Math.ceil(normalHit * (monster.aoe / monster.atk));
    const critHit = critDamageTaken[i];
    const sharkBonus = heroShark[i] * 0.01;
    const sharkNormal = Math.floor(finalAtk[i] * (1 + sharkBonus) * barrierMod);
    const sharkCrit = Math.floor(finalAtk[i] * (1 + sharkBonus) * heroCritMult[i] * barrierMod);
    // Dinosaur first turn damage
    const dinoBonus = heroDinosaur[i] * 0.01;
    const dinoNormal = Math.floor(finalAtk[i] * (1 + dinoBonus) * barrierMod);
    const dinoCrit = Math.floor(finalAtk[i] * (1 + dinoBonus) * heroCritMult[i] * barrierMod);
    // Damage application rate using actual thresholds
    const dmgAppRate = getDamageApplicationRate(finalDef[i], defThresholds);
    // Per-turn damage
    const avgRoundsForHero = totalRoundsPerHero[i] / actualSimCount;
    const avgDmgPerTurn = avgRoundsForHero > 0 ? (damageDealtAvg[i] / actualSimCount) / avgRoundsForHero : 0;
    // Berserker thresholds
    let berserkerThresholds: { threshold: number; belowRate: number }[] | undefined;
    if (heroBerserkerLevel[i] > 0) {
      berserkerThresholds = [
        { threshold: Math.round(berserkHp1[i] * 100), belowRate: Math.round((berserkerBelowT1[i] / actualSimCount) * 100 * 10) / 10 },
        { threshold: Math.round(berserkHp2[i] * 100), belowRate: Math.round((berserkerBelowT2[i] / actualSimCount) * 100 * 10) / 10 },
        { threshold: Math.round(berserkHp3[i] * 100), belowRate: Math.round((berserkerBelowT3[i] / actualSimCount) * 100 * 10) / 10 },
      ];
    }

    const effectiveAtk = Math.round(finalAtk[i] * barrierMod);
    const effectiveCritAttack = Math.round(finalAtk[i] * heroCritMult[i] * barrierMod);
    const avgTotalDmgTaken = totalDmgTakenAccum[i] / actualSimCount;
    const avgTimesHit = totalTimesHitAccum[i] / actualSimCount;

    // Monster crit chance against this hero (accounts for negative evasion)
    const heroFinalEva = heroArtNoEvasion[i] ? 0 : heroEvasion[i];
    let monsterCritBase = baseMobCritChance * mobCritChanceMod;
    if (isExtreme && heroFinalEva < 0 && !heroArtNoEvasion[i]) {
      monsterCritBase += -0.25 * heroFinalEva;
    }
    const monsterCritChance = Math.round(Math.min(monsterCritBase, 1) * 100 * 10) / 10;

    // Berserker ATK/EVA bonus per stage
    let berserkerAtkBonus: number[] | undefined;
    let berserkerEvaBonus: number[] | undefined;
    if (heroBerserkerLevel[i] > 0) {
      const lvl = heroBerserkerLevel[i];
      berserkerAtkBonus = [
        Math.round(0.1 * (1 + lvl) * 1 * 100),
        Math.round(0.1 * (1 + lvl) * 2 * 100),
        Math.round(0.1 * (1 + lvl) * 3 * 100),
      ];
      berserkerEvaBonus = [10, 20, 30];
    }

    return {
      heroId: h.id,
      heroName: h.name,
      survivalRate: (timesSurvived[i] / actualSimCount) * 100,
      avgHpRemaining: hpRemainingAvg[i] / actualSimCount,
      maxHpRemaining: hpRemainingMax[i],
      avgDamageDealt: damageDealtAvg[i] / actualSimCount,
      maxDamageDealt: damageDealtMax[i],
      minDamageDealt: damageDealtMin[i] >= 1e9 ? 0 : damageDealtMin[i],
      normalDmgDealtAvg: normalDmgDealtAccum[i] / actualSimCount,
      critDmgDealtAvg: critDmgDealtAccum[i] / actualSimCount,
      avgDamagePerTurn: avgDmgPerTurn,
      normalDamageTaken: normalHit,
      aoeDamageTaken: aoeHit,
      critDamageTakenVal: critHit,
      totalDamageTakenAvg: Math.round(avgTotalDmgTaken),
      avgDamageTakenPerHit: avgTimesHit > 0 ? Math.round(avgTotalDmgTaken / avgTimesHit) : 0,
      avgDamageTakenPerTurn: avgRoundsForHero > 0 ? Math.round(avgTotalDmgTaken / avgRoundsForHero) : 0,
      sharkNormalDmg: sharkNormal,
      sharkCritDmg: sharkCrit,
      dinosaurNormalDmg: dinoNormal,
      dinosaurCritDmg: dinoCrit,
      hasSharkSpirit: heroShark[i] > 0,
      hasDinosaurSpirit: heroDinosaur[i] > 0,
      isSamuraiOrDaimyo: heroIsSamurai[i] || heroIsDaimyo[i],
      finalAtk: effectiveAtk,
      finalDef: Math.round(finalDef[i]),
      finalHp: Math.round(finalHp[i]),
      finalCritChance: Math.round(Math.min(heroCritChance[i], 1) * 100 * 10) / 10,
      finalCritDmg: Math.round(heroCritMult[i] * 100 * 10) / 10,
      finalCritAttack: effectiveCritAttack,
      finalEvasion: heroArtNoEvasion[i] ? 0 : Math.round(Math.min(Math.max(heroEvasion[i], 0), heroEvaCap[i]) * 100 * 10) / 10,
      damageApplicationRate: dmgAppRate,
      targetingRate: Math.round(((h.threat || 1) / totalThreat) * 100 * 10) / 10,
      evasionRate: timesTargeted[i] > 0 ? Math.round((timesEvaded[i] / timesTargeted[i]) * 100 * 10) / 10 : 0,
      monsterCritChance,
      berserkerThresholds,
      berserkerAtkBonus,
      berserkerEvaBonus,
      chronomancerRetries: fateweaverPresent && isClass(h, '크로노맨서', '페이트위버', '운명직공', 'Chronomancer', 'Fateweaver')
        ? Math.round((actualSimCount - timesQuestWon) / actualSimCount * 100 * 10) / 10
        : undefined,
      chronomancerRetrySuccessRate: retryWinRate,
      totalHealingAvg: totalHealing[i] / actualSimCount,
      healPerTurn: avgRoundsForHero > 0 ? (totalHealing[i] / actualSimCount) / avgRoundsForHero : 0,
      lordProtectionAvg: lordProtections[i] / actualSimCount,
      lordProtectedSingleAvg: lordProtectedSingle[i] / actualSimCount,
      lordProtectedAoeAvg: lordProtectedAoe[i] / actualSimCount,
      lordAbsorbedSingleDmg: lordAbsorbedSingle[i] / actualSimCount,
      lordAbsorbedAoeDmg: lordAbsorbedAoe[i] / actualSimCount,
      critSurvivalCount: critSurvivals[i] / actualSimCount,
      critSurvivalChance: Math.round((heroArmadillo[i] || (heroIsCleric[i] || heroIsBishop[i] ? 100 : 0)) * 10) / 10,
      tankingRate: totalAllSingleHits > 0 ? Math.round((singleTargetHitsTotal[i] / totalAllSingleHits) * 1000) / 10 : 0,
      singleTargetRate: totalAllSingleHits > 0 ? Math.round((singleTargetHitsTotal[i] / totalAllSingleHits) * 1000) / 10 : 0,
      minDamageTaken: dmgTakenMin[i] >= 1e9 ? 0 : Math.round(dmgTakenMin[i]),
      maxDamageTaken: Math.round(dmgTakenMax[i]),
      aoeDmgTakenTotal: aoeDmgTakenAccum[i] / actualSimCount,
      singleDmgTakenTotal: singleDmgTakenAccum[i] / actualSimCount,
    };
  });

  // Build win/lose hero result variants
  const buildBucketResult = (i: number, base: HeroSimResult, bucketCount: number, bucket: 'win' | 'lose'): HeroSimResult => {
    if (bucketCount <= 0) return base;
    const dDealt = bucket === 'win' ? winDmgDealt[i] : loseDmgDealt[i];
    const dNorm = bucket === 'win' ? winNormalDmg[i] : loseNormalDmg[i];
    const dCrit = bucket === 'win' ? winCritDmg[i] : loseCritDmg[i];
    const dMax = bucket === 'win' ? winDmgMax[i] : loseDmgMax[i];
    const dMin = bucket === 'win' ? winDmgMin[i] : loseDmgMin[i];
    const r = bucket === 'win' ? winRoundsArr[i] : loseRoundsArr[i];
    const dTaken = bucket === 'win' ? winDmgTaken[i] : loseDmgTaken[i];
    const tHit = bucket === 'win' ? winTimesHit[i] : loseTimesHit[i];
    const sHit = bucket === 'win' ? winSingleHits[i] : loseSingleHits[i];
    const surv = bucket === 'win' ? winSurvived[i] : 0;
    const hpRem = bucket === 'win' ? winHpRemain[i] : loseHpRemain[i];
    const tgt = bucket === 'win' ? winTargeted[i] : loseTargeted[i];
    const ev = bucket === 'win' ? winEvaded[i] : loseEvaded[i];
    const avgR = r / bucketCount;
    const totalSingle = bucket === 'win'
      ? Array.from(winSingleHits).reduce((s, v) => s + v, 0)
      : Array.from(loseSingleHits).reduce((s, v) => s + v, 0);
    return {
      ...base,
      survivalRate: bucket === 'win' ? (surv / bucketCount) * 100 : 0,
      avgHpRemaining: hpRem / bucketCount,
      avgDamageDealt: dDealt / bucketCount,
      maxDamageDealt: dMax,
      minDamageDealt: dMin >= 1e9 ? 0 : dMin,
      normalDmgDealtAvg: dNorm / bucketCount,
      critDmgDealtAvg: dCrit / bucketCount,
      avgDamagePerTurn: avgR > 0 ? (dDealt / bucketCount) / avgR : 0,
      totalDamageTakenAvg: Math.round(dTaken / bucketCount),
      avgDamageTakenPerHit: tHit > 0 ? Math.round(dTaken / tHit) : 0,
      avgDamageTakenPerTurn: avgR > 0 ? Math.round(dTaken / bucketCount / avgR) : 0,
      evasionRate: tgt > 0 ? Math.round((ev / tgt) * 100 * 10) / 10 : 0,
      tankingRate: totalSingle > 0 ? Math.round((sHit / totalSingle) * 1000) / 10 : 0,
    };
  };

  const winHeroResults = timesQuestWon > 0
    ? heroResults.map((b, i) => buildBucketResult(i, b, timesQuestWon, 'win'))
    : undefined;
  const loseHeroResults = loseCount > 0
    ? heroResults.map((b, i) => buildBucketResult(i, b, loseCount, 'lose'))
    : undefined;

  return {
    winRate: Math.round(winRate * 100) / 100,
    rawWinRate: Math.round(rawWinRate * 100) / 100,
    retryWinRate: retryWinRate !== undefined ? Math.round(retryWinRate * 100) / 100 : undefined,
    avgRounds: actualSimCount > 0 ? Math.round((roundsAvg / actualSimCount) * 100) / 100 : 0,
    minRounds: roundsMin >= 1000 ? 0 : roundsMin,
    maxRounds: roundsMax,
    heroResults,
    winHeroResults,
    loseHeroResults,
    winSimCount: timesQuestWon,
    loseSimCount: loseCount,
    roundLimitRate: (roundLimitTimes / actualSimCount) * 100,
    totalSimulations: actualSimCount,
    retrySimulations,
    winRounds: timesQuestWon > 0 ? {
      avg: Math.round((winRoundsSum / timesQuestWon) * 100) / 100,
      min: winRoundsMin >= 1000 ? 0 : winRoundsMin,
      max: winRoundsMax,
    } : undefined,
    loseRounds: loseCount > 0 ? {
      avg: Math.round((loseRoundsSum / loseCount) * 100) / 100,
      min: loseRoundsMin >= 1000 ? 0 : loseRoundsMin,
      max: loseRoundsMax,
    } : undefined,
    partyDmgDealt: partySimCount > 0 ? {
      min: partyDmgMin === Infinity ? 0 : Math.round(partyDmgMin),
      avg: Math.round(partyDmgSum / partySimCount),
      max: Math.round(partyDmgMax),
    } : undefined,
    partyDmgPerTurn: partySimCount > 0 ? {
      min: partyDmgPerTurnMin === Infinity ? 0 : Math.round(partyDmgPerTurnMin),
      avg: Math.round(partyDmgPerTurnSum / partySimCount),
      max: Math.round(partyDmgPerTurnMax),
    } : undefined,
    partyDmgTaken: partySimCount > 0 ? {
      min: partyTakenMin === Infinity ? 0 : Math.round(partyTakenMin),
      avg: Math.round(partyTakenSum / partySimCount),
      max: Math.round(partyTakenMax),
    } : undefined,
    partyDmgTakenPerTurn: partySimCount > 0 ? {
      min: partyTakenPerTurnMin === Infinity ? 0 : Math.round(partyTakenPerTurnMin),
      avg: Math.round(partyTakenPerTurnSum / partySimCount),
      max: Math.round(partyTakenPerTurnMax),
    } : undefined,
    winPartyDmgDealt: winPartyCount > 0 ? {
      min: winPartyDmgMin === Infinity ? 0 : Math.round(winPartyDmgMin),
      avg: Math.round(winPartyDmgSum / winPartyCount),
      max: Math.round(winPartyDmgMax),
    } : undefined,
    winPartyDmgPerTurn: winPartyCount > 0 ? {
      min: winPartyDmgPerTurnMin === Infinity ? 0 : Math.round(winPartyDmgPerTurnMin),
      avg: Math.round(winPartyDmgPerTurnSum / winPartyCount),
      max: Math.round(winPartyDmgPerTurnMax),
    } : undefined,
    winPartyDmgTaken: winPartyCount > 0 ? {
      min: winPartyTakenMin === Infinity ? 0 : Math.round(winPartyTakenMin),
      avg: Math.round(winPartyTakenSum / winPartyCount),
      max: Math.round(winPartyTakenMax),
    } : undefined,
    winPartyDmgTakenPerTurn: winPartyCount > 0 ? {
      min: winPartyTakenPerTurnMin === Infinity ? 0 : Math.round(winPartyTakenPerTurnMin),
      avg: Math.round(winPartyTakenPerTurnSum / winPartyCount),
      max: Math.round(winPartyTakenPerTurnMax),
    } : undefined,
    losePartyDmgDealt: losePartyCount > 0 ? {
      min: losePartyDmgMin === Infinity ? 0 : Math.round(losePartyDmgMin),
      avg: Math.round(losePartyDmgSum / losePartyCount),
      max: Math.round(losePartyDmgMax),
    } : undefined,
    losePartyDmgPerTurn: losePartyCount > 0 ? {
      min: losePartyDmgPerTurnMin === Infinity ? 0 : Math.round(losePartyDmgPerTurnMin),
      avg: Math.round(losePartyDmgPerTurnSum / losePartyCount),
      max: Math.round(losePartyDmgPerTurnMax),
    } : undefined,
    losePartyDmgTaken: losePartyCount > 0 ? {
      min: losePartyTakenMin === Infinity ? 0 : Math.round(losePartyTakenMin),
      avg: Math.round(losePartyTakenSum / losePartyCount),
      max: Math.round(losePartyTakenMax),
    } : undefined,
    losePartyDmgTakenPerTurn: losePartyCount > 0 ? {
      min: losePartyTakenPerTurnMin === Infinity ? 0 : Math.round(losePartyTakenPerTurnMin),
      avg: Math.round(losePartyTakenPerTurnSum / losePartyCount),
      max: Math.round(losePartyTakenPerTurnMax),
    } : undefined,
  };
}

// ─── Random Mini-Boss Simulation ────────────────────────────────────────────

function runRandomMiniBossSimulation(config: SimulationConfig, activeHeroes: Hero[], simCount: number): SimulationResult {
  // 2% chance mini-boss appears, 20% chance each type
  const MINI_BOSS_SPAWN_CHANCE = 0.02;
  const MINI_BOSS_TYPES: MiniBossType[] = ['huge', 'agile', 'dire', 'wealthy', 'legendary'];
  const MINI_BOSS_TYPE_CHANCE = 0.2; // 20% each

  // Run simulations for 'none' and each mini-boss type with weighted counts
  const normalSimCount = Math.round(simCount * (1 - MINI_BOSS_SPAWN_CHANCE));
  const miniBossSimCountTotal = simCount - normalSimCount;
  const perTypeSimCount = Math.round(miniBossSimCountTotal * MINI_BOSS_TYPE_CHANCE);

  // Run normal simulation
  const normalResult = runCombatSimulation({
    ...config,
    miniBoss: 'none',
    simulationCount: normalSimCount,
    _disableRetry: true,
  });

  // Run each mini-boss type simulation
  const miniBossResults: MiniBossResult[] = [
    {
      type: 'normal',
      encounters: normalSimCount,
      wins: Math.round(normalResult.winRate / 100 * normalSimCount),
      winRate: normalResult.winRate,
      avgRounds: normalResult.avgRounds,
      heroResults: normalResult.heroResults,
      winHero: normalResult.winHeroResults,
      loseHero: normalResult.loseHeroResults,
      winN: normalResult.winSimCount || 0,
      loseN: normalResult.loseSimCount || 0,
      winRoundsSum: (normalResult.winRounds?.avg || 0) * (normalResult.winSimCount || 0),
      loseRoundsSum: (normalResult.loseRounds?.avg || 0) * (normalResult.loseSimCount || 0),
      minRounds: normalResult.minRounds,
      maxRounds: normalResult.maxRounds,
      winMinRounds: normalResult.winRounds?.min,
      winMaxRounds: normalResult.winRounds?.max,
      loseMinRounds: normalResult.loseRounds?.min,
      loseMaxRounds: normalResult.loseRounds?.max,
    },
  ];

  let totalWins = Math.round(normalResult.winRate / 100 * normalSimCount);
  let totalRounds = normalResult.avgRounds * normalSimCount;
  let totalSims = normalSimCount;

  for (const mbType of MINI_BOSS_TYPES) {
    const mbResult = runCombatSimulation({
      ...config,
      miniBoss: mbType,
      simulationCount: perTypeSimCount,
      _disableRetry: true,
    });

    const wins = Math.round(mbResult.winRate / 100 * perTypeSimCount);
    miniBossResults.push({
      type: mbType,
      encounters: perTypeSimCount,
      wins,
      winRate: mbResult.winRate,
      avgRounds: mbResult.avgRounds,
      heroResults: mbResult.heroResults,
      winHero: mbResult.winHeroResults,
      loseHero: mbResult.loseHeroResults,
      winN: mbResult.winSimCount || 0,
      loseN: mbResult.loseSimCount || 0,
      winRoundsSum: (mbResult.winRounds?.avg || 0) * (mbResult.winSimCount || 0),
      loseRoundsSum: (mbResult.loseRounds?.avg || 0) * (mbResult.loseSimCount || 0),
      minRounds: mbResult.minRounds,
      maxRounds: mbResult.maxRounds,
      winMinRounds: mbResult.winRounds?.min,
      winMaxRounds: mbResult.winRounds?.max,
      loseMinRounds: mbResult.loseRounds?.min,
      loseMaxRounds: mbResult.loseRounds?.max,
    });

    totalWins += wins;
    totalRounds += mbResult.avgRounds * perTypeSimCount;
    totalSims += perTypeSimCount;
  }

  // Calculate weighted averages
  const combinedWinRate = (totalWins / totalSims) * 100;
  const combinedAvgRounds = totalRounds / totalSims;

  // Aggregate hero results (weighted average) — overall (all)
  const aggregatedHeroResults: HeroSimResult[] = normalResult.heroResults.map((hr, idx) => {
    let survivalSum = hr.survivalRate * normalSimCount;
    let dmgSum = hr.avgDamageDealt * normalSimCount;
    let maxDmg = hr.maxDamageDealt;
    let minDmg = hr.minDamageDealt;

    // tankingRate aggregation across miniboss types (each subResult sums to 100%)
    let tankWeightedSum = hr.tankingRate * normalSimCount;
    let tankTotalWeight = normalSimCount;

    for (const mbr of miniBossResults.slice(1)) {
      const mbHr = mbr.heroResults[idx];
      if (mbHr) {
        survivalSum += mbHr.survivalRate * mbr.encounters;
        dmgSum += mbHr.avgDamageDealt * mbr.encounters;
        maxDmg = Math.max(maxDmg, mbHr.maxDamageDealt);
        minDmg = Math.min(minDmg, mbHr.minDamageDealt);
        tankWeightedSum += mbHr.tankingRate * mbr.encounters;
        tankTotalWeight += mbr.encounters;
      }
    }

    return {
      ...hr,
      survivalRate: survivalSum / totalSims,
      avgDamageDealt: dmgSum / totalSims,
      maxDamageDealt: maxDmg,
      minDamageDealt: minDmg,
      tankingRate: tankTotalWeight > 0
        ? Math.round((tankWeightedSum / tankTotalWeight) * 10) / 10
        : hr.tankingRate,
    };
  });

  // Aggregate win-only / lose-only hero results
  const aggregateBucket = (bucket: 'win' | 'lose'): { results: HeroSimResult[]; count: number; roundsSum: number } | undefined => {
    let totalCount = 0;
    let roundsSum = 0;
    for (const mbr of miniBossResults) {
      const n = bucket === 'win' ? (mbr.winN || 0) : (mbr.loseN || 0);
      totalCount += n;
      roundsSum += bucket === 'win' ? (mbr.winRoundsSum || 0) : (mbr.loseRoundsSum || 0);
    }
    if (totalCount === 0) return undefined;
    // Compute total single-target hits per hero across all miniboss types in this bucket
    // (weighted by encounter count) so tankingRate reflects the chosen bucket.
    const singleHitsAgg = normalResult.heroResults.map(() => 0);
    let totalSingleAgg = 0;
    for (const mbr of miniBossResults) {
      const n = bucket === 'win' ? (mbr.winN || 0) : (mbr.loseN || 0);
      const arr = bucket === 'win' ? mbr.winHero : mbr.loseHero;
      if (!arr || n === 0) continue;
      // Recover sHit per hero by inverting tankingRate stored on bucket entry.
      // (tankingRate already = sHit / totalSingleInBucket * 100). We sum sHit shares
      // by weighting each hero's tankingRate by encounter count. Result is a relative
      // weighted share across heroes.
      arr.forEach((r, idx) => {
        singleHitsAgg[idx] += (r.tankingRate || 0) * n;
      });
      totalSingleAgg += 100 * n; // each bucket sums to 100% × n
    }
    const results = normalResult.heroResults.map((hr, idx) => {
      let dmgSum = 0, normSum = 0, critSum = 0, takenSum = 0;
      let maxDmg = 0, minDmg = 1e9;
      for (const mbr of miniBossResults) {
        const n = bucket === 'win' ? (mbr.winN || 0) : (mbr.loseN || 0);
        const arr = bucket === 'win' ? mbr.winHero : mbr.loseHero;
        if (!arr || !arr[idx] || n === 0) continue;
        const r = arr[idx];
        dmgSum += r.avgDamageDealt * n;
        normSum += r.normalDmgDealtAvg * n;
        critSum += r.critDmgDealtAvg * n;
        takenSum += r.totalDamageTakenAvg * n;
        maxDmg = Math.max(maxDmg, r.maxDamageDealt);
        if (r.minDamageDealt > 0) minDmg = Math.min(minDmg, r.minDamageDealt);
      }
      const tankingRate = totalSingleAgg > 0
        ? Math.round((singleHitsAgg[idx] / totalSingleAgg) * 1000) / 10
        : 0;
      return {
        ...hr,
        avgDamageDealt: dmgSum / totalCount,
        normalDmgDealtAvg: normSum / totalCount,
        critDmgDealtAvg: critSum / totalCount,
        totalDamageTakenAvg: Math.round(takenSum / totalCount),
        maxDamageDealt: maxDmg,
        minDamageDealt: minDmg >= 1e9 ? 0 : minDmg,
        tankingRate,
      };
    });
    return { results, count: totalCount, roundsSum };
  };

  const winAgg = aggregateBucket('win');
  const loseAgg = aggregateBucket('lose');

  // Aggregate min/max across all sub-simulations (overall, win, lose)
  const allMins = miniBossResults.map(m => m.minRounds).filter((v): v is number => v != null && v > 0);
  const allMaxs = miniBossResults.map(m => m.maxRounds).filter((v): v is number => v != null);
  const winMins = miniBossResults.map(m => m.winMinRounds).filter((v): v is number => v != null && v > 0);
  const winMaxs = miniBossResults.map(m => m.winMaxRounds).filter((v): v is number => v != null);
  const loseMins = miniBossResults.map(m => m.loseMinRounds).filter((v): v is number => v != null && v > 0);
  const loseMaxs = miniBossResults.map(m => m.loseMaxRounds).filter((v): v is number => v != null);

  return {
    winRate: Math.round(combinedWinRate * 100) / 100,
    rawWinRate: Math.round(combinedWinRate * 100) / 100,
    avgRounds: Math.round(combinedAvgRounds * 100) / 100,
    minRounds: allMins.length > 0 ? Math.min(...allMins) : 0,
    maxRounds: allMaxs.length > 0 ? Math.max(...allMaxs) : 0,
    heroResults: aggregatedHeroResults,
    winHeroResults: winAgg?.results,
    loseHeroResults: loseAgg?.results,
    winSimCount: winAgg?.count,
    loseSimCount: loseAgg?.count,
    winRounds: winAgg && winAgg.count > 0 ? {
      avg: Math.round((winAgg.roundsSum / winAgg.count) * 100) / 100,
      min: winMins.length > 0 ? Math.min(...winMins) : 0,
      max: winMaxs.length > 0 ? Math.max(...winMaxs) : 0,
    } : undefined,
    loseRounds: loseAgg && loseAgg.count > 0 ? {
      avg: Math.round((loseAgg.roundsSum / loseAgg.count) * 100) / 100,
      min: loseMins.length > 0 ? Math.min(...loseMins) : 0,
      max: loseMaxs.length > 0 ? Math.max(...loseMaxs) : 0,
    } : undefined,
    roundLimitRate: normalResult.roundLimitRate,
    totalSimulations: totalSims,
    miniBossResults,
  };
}

/** Get the booster config for Fateweaver retry: original booster + Normal booster stacked */
function getRetryBooster(original: BoosterType): BoosterType {
  // Normal booster = +20% atk, +20% def. Just add these on top of whatever was used.
  return {
    ...original,
    extraAtkBonus: (original.extraAtkBonus || 0) + 0.2,
    extraDefBonus: (original.extraDefBonus || 0) + 0.2,
  };
}

// ─── Single Combat Log ──────────────────────────────────────────────────────

export interface CombatLogEntry {
  round: number;
  type: 'monster_attack' | 'hero_attack' | 'heal' | 'event' | 'result';
  actor: string;
  target?: string;
  detail: string;
  values?: Record<string, number | string>;
}

export function runSingleCombatLog(config: SimulationConfig): CombatLogEntry[] {
  const { heroes, monster, miniBoss, booster, isTerrorTower, precomputedStats } = config;
  const log: CombatLogEntry[] = [];
  const activeHeroes = heroes.filter(h => h.hp > 0);
  if (activeHeroes.length === 0) return [{ round: 0, type: 'result', actor: '시스템', detail: '활성 영웅 없음' }];

  const numHeroes = activeHeroes.length;
  const isExtreme = monster.isExtreme || isTerrorTower;

  // Mini boss modifiers
  let mobHpMod = 1.0, mobDamageMod = 1.0, mobCritChanceMod = 1.0;
  let mobEvasion = -1.0, mobAoeChanceMod = 1.0;
  let miniBossLabel = '';
  switch (miniBoss) {
    case 'agile': mobEvasion = 0.4; miniBossLabel = '민첩한'; break;
    case 'dire': mobHpMod = 1.5; mobCritChanceMod = 3.0; miniBossLabel = '흉포한'; break;
    case 'huge': mobHpMod = 2.0; mobAoeChanceMod = 3.0; miniBossLabel = '거대한'; break;
    case 'wealthy': miniBossLabel = '부유한'; break;
    case 'legendary': mobHpMod = 1.5; mobDamageMod = 1.25; mobCritChanceMod = 1.5; mobEvasion = 0.1; miniBossLabel = '전설적인'; break;
  }

  const mobDisplayName = miniBossLabel ? `${miniBossLabel} 몬스터` : '몬스터';
  const mobCap = monster.def.r0;
  let mobDamage = Math.round(monster.atk * mobDamageMod);
  if (isTerrorTower) mobDamage = Math.round(mobDamage * 0.05);
  const mobAoeDmgRatio = monster.aoe / monster.atk;
  const mobAoeChance = (monster.aoeChance / 100) * mobAoeChanceMod;
  const baseMobCritChance = 0.10;

  // Barrier check (with spell knight support)
  let barrierMod = 1.0;
  if (monster.barrier && monster.barrier.hp > 0 && monster.barrierElement) {
    let totalEl = 0;
    activeHeroes.forEach(h => {
      const isSpellKnight = isClass(h, '마법검', '스펠나이트', 'Spellblade', 'Spellknight');
      if (isSpellKnight) {
        const allElements = h.equipmentElements || {};
        const totalElVal = Object.values(allElements).reduce((s: number, v: number) => s + (v || 0), 0);
        totalEl += Math.floor(totalElVal * 0.5);
      } else {
        totalEl += h.equipmentElements?.[monster.barrierElement!] || 0;
      }
    });
    if (totalEl < monster.barrier.hp) {
      barrierMod = 0.2;
      log.push({ round: 0, type: 'event', actor: '시스템', detail: `원소 배리어 미돌파! 대미지 ${barrierMod * 100}%로 제한`, values: { heroSum: totalEl, required: monster.barrier.hp } });
    } else {
      log.push({ round: 0, type: 'event', actor: '시스템', detail: `원소 배리어 돌파! (${totalEl} ≥ ${monster.barrier.hp})` });
    }
  }

  if (miniBoss !== 'none') {
    log.push({ round: 0, type: 'event', actor: '시스템', detail: `미니보스: ${miniBossLabel} (HP ×${mobHpMod}, ATK ×${mobDamageMod}, 치확 ×${mobCritChanceMod})` });
  }

  // Setup hero stats - use precomputed if available
  const heroHp: number[] = [];
  const heroMaxHp: number[] = [];
  const heroAtkVal: number[] = [];
  const heroDefVal: number[] = [];
  const heroCrit: number[] = [];
  const heroCritMult: number[] = [];
  const heroEva: number[] = [];
  const heroThreatVal: number[] = [];
  const heroDmgDealt: number[] = [];

  // Class/skill flags
  const heroIsNinjaFlag: boolean[] = [];
  const heroIsSenseiFlag: boolean[] = [];
  const heroIsBerserker: boolean[] = [];
  const heroIsConquistadorFlag: boolean[] = [];
  const heroIsLordFlag: boolean[] = [];
  const heroIsSamuraiFlag: boolean[] = [];
  const heroIsDaimyoFlag: boolean[] = [];
  const heroSharkVal: number[] = [];
  const heroDinoVal: number[] = [];
  const heroArmadilloVal: number[] = [];
  const heroIsClericFlag: boolean[] = [];
  const heroIsBishopFlag: boolean[] = [];
  const heroTier: number[] = [];

  for (let i = 0; i < numHeroes; i++) {
    const h = activeHeroes[i];
    const ps = precomputedStats?.[i];
    const tier = h.cardLevel || (h.promoted ? 4 : 1);
    heroTier.push(tier);

    if (ps) {
      heroAtkVal.push(ps.atk);
      heroDefVal.push(ps.def);
      heroMaxHp.push(ps.hp);
      heroHp.push(ps.hp);
      heroCrit.push(Math.min(ps.crit / 100, 1.0));
      heroCritMult.push(ps.critDmg / 100);
      let eva = ps.evasion / 100;
      const hasRockStompers = h.equipmentSlots?.some(s => s.item?.name === '락 스톰퍼') || false;
      if (hasRockStompers) eva = 0;
      else eva = Math.min(eva, isClass(h, '길잡이', 'Pathfinder') ? 0.78 : 0.75);
      heroEva.push(eva);
    } else {
      const boosterAtkPct = booster.type === 'mega' ? 0.8 : booster.type === 'super' ? 0.4 : booster.type === 'normal' ? 0.2 : 0;
      heroAtkVal.push(Math.floor((h.atk || 0) * (1 + boosterAtkPct)));
      heroDefVal.push(Math.floor((h.def || 0) * (1 + boosterAtkPct)));
      heroMaxHp.push(h.hp || 0);
      heroHp.push(h.hp || 0);
      heroCrit.push(Math.min((h.crit || 0) / 100, 1.0));
      heroCritMult.push((h.critDmg || 0) / 100);
      let eva = (h.evasion || 0) / 100;
      if (isExtreme) eva -= 0.2;
      const hasRockStompers = h.equipmentSlots?.some(s => s.item?.name === '락 스톰퍼') || false;
      if (hasRockStompers) eva = 0;
      heroEva.push(hasRockStompers ? 0 : Math.min(eva, 0.75));
    }

    heroThreatVal.push(h.threat || 1);
    heroDmgDealt.push(0);

    // Class flags
    heroIsNinjaFlag.push(isClass(h, '닌자', 'Ninja'));
    heroIsSenseiFlag.push(isClass(h, '센세', '센세이', 'Sensei'));
    heroIsBerserker.push(isClass(h, '광전사', '잘', '야를', 'Berserker', 'Jarl'));
    heroIsConquistadorFlag.push(isClass(h, '정복자', 'Conquistador'));
    heroIsLordFlag.push(isClass(h, '기사', '군주', 'Lord', 'Knight'));
    heroIsSamuraiFlag.push(isClass(h, '사무라이', 'Samurai'));
    heroIsDaimyoFlag.push(isClass(h, '다이묘', 'Daimyo'));

    // Spirits
    const spirits = (h.equipmentSlots || []).map(s => s.spirit).filter(Boolean);
    const sharkV = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === 'string' ? sp : sp?.name || '';
      return name.includes('상어') || name.includes('Shark') ? sum + (typeof sp === 'object' ? (sp?.value || sp?.atk || 0) : 0) : sum;
    }, 0);
    heroSharkVal.push(sharkV);
    const dinoV = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === 'string' ? sp : sp?.name || '';
      return name.includes('공룡') || name.includes('Dinosaur') || name.includes('T-Rex') || name.includes('티렉스') ? sum + (typeof sp === 'object' ? (sp?.value || sp?.atk || 0) : 0) : sum;
    }, 0);
    heroDinoVal.push(dinoV);

    // Armadillo spirit (crit survival)
    const armadilloV = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === 'string' ? sp : sp?.name || '';
      return name.includes('아르마딜로') || name.includes('Armadillo') ? sum + (typeof sp === 'object' ? (sp?.value || 15) : 15) : sum;
    }, 0);
    heroArmadilloVal.push(armadilloV);

    // Class flags for crit survival
    heroIsClericFlag.push(isClass(h, '성직자', '클레릭', 'Cleric'));
    heroIsBishopFlag.push(isClass(h, '비숍', '주교', 'Bishop'));
  }

  // Berserker HP thresholds
  const berserkThresholds = heroTier.map(t => t === 4 ? [0.8, 0.55, 0.3] : [0.75, 0.5, 0.25]);
  const berserkerStage: number[] = new Array(numHeroes).fill(0);

  // Conqueror crit stacks (max 4)
  const conquStacks: number[] = new Array(numHeroes).fill(0);

  // Ninja/Sensei innate tracking
  const ninjaBaseAtk: number[] = heroAtkVal.slice();
  const ninjaBaseEva: number[] = heroEva.slice();
  const lostInnateRound: number[] = new Array(numHeroes).fill(-99);
  // Apply initial ninja/sensei bonuses
  for (let i = 0; i < numHeroes; i++) {
    if (heroIsNinjaFlag[i] || heroIsSenseiFlag[i]) {
      const bonusAtk = heroAtkVal[i] * 0.3;
      const bonusEva = 0.15;
      heroAtkVal[i] += bonusAtk;
      heroEva[i] += bonusEva;
      log.push({ round: 0, type: 'event', actor: activeHeroes[i].name, detail: `고유 스킬 적용: ATK +30%, EVA +15%` });
    }
  }

  // Shark spirit initial log
  for (let i = 0; i < numHeroes; i++) {
    if (heroSharkVal[i] > 0) {
      log.push({ round: 0, type: 'event', actor: activeHeroes[i].name, detail: `상어 영혼 장착 (ATK +${heroSharkVal[i]})` });
    }
    if (heroDinoVal[i] > 0) {
      log.push({ round: 0, type: 'event', actor: activeHeroes[i].name, detail: `공룡 영혼 장착 (첫 턴 ATK +${heroDinoVal[i]})` });
    }
  }

  // Lord detection
  let lordIdx = -1;
  for (let i = 0; i < numHeroes; i++) {
    if (heroIsLordFlag[i]) lordIdx = i;
  }

  // Kiku-ichimonji
  for (let i = 0; i < numHeroes; i++) {
    const hasKiku = activeHeroes[i].equipmentSlots?.some(s => s.item?.name === '키쿠이치몬지') || false;
    if (hasKiku) {
      heroCrit[i] = 0.20;
      log.push({ round: 0, type: 'event', actor: activeHeroes[i].name, detail: `키쿠이치몬지 고정 효과: 치확 20%` });
    }
  }

  const totalMobHp = Math.round(monster.hp * mobHpMod);
  log.push({ round: 0, type: 'event', actor: '시스템', detail: `전투 시작! ${mobDisplayName} HP: ${formatNum(totalMobHp)}, 파티원 ${numHeroes}명` });

  let mobHpCurrent = totalMobHp;
  let heroesAlive = numHeroes;
  const MAX_ROUNDS = 100;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (mobHpCurrent <= 0 || heroesAlive <= 0) break;

    // ─── Berserker stage check ───
    for (let i = 0; i < numHeroes; i++) {
      if (!heroIsBerserker[i] || heroHp[i] <= 0) continue;
      const hpPct = heroHp[i] / heroMaxHp[i];
      const thresholds = berserkThresholds[i];
      let newStage = 0;
      if (hpPct <= thresholds[2]) newStage = 3;
      else if (hpPct <= thresholds[1]) newStage = 2;
      else if (hpPct <= thresholds[0]) newStage = 1;
      if (newStage !== berserkerStage[i]) {
        berserkerStage[i] = newStage;
        if (newStage > 0) {
          log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `광전사 ${newStage}단계 발동! (HP ${(hpPct * 100).toFixed(0)}%)` });
        }
      }
    }

    // ─── Shark spirit activation (monster HP <= 50%) ───
    const mobHpPctNow = mobHpCurrent / totalMobHp;
    for (let i = 0; i < numHeroes; i++) {
      if (heroSharkVal[i] <= 0 || heroHp[i] <= 0) continue;
      if (mobHpPctNow <= 0.5) {
        log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `상어 영혼 발동! (적 HP ${(mobHpPctNow * 100).toFixed(0)}%)` });
      }
    }

    // ─── Sensei innate recovery check (ninja loses permanently, sensei recovers after 2 turns) ───
    for (let i = 0; i < numHeroes; i++) {
      if (!heroIsSenseiFlag[i] || heroHp[i] <= 0) continue;
      if (lostInnateRound[i] > 0 && round >= lostInnateRound[i] + 2) {
        heroAtkVal[i] = ninjaBaseAtk[i] * 1.3;
        heroEva[i] = ninjaBaseEva[i] + 0.15;
        lostInnateRound[i] = -99;
        log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `센세이 고유 스킬 회복! ATK/EVA 복구 (2턴 경과)` });
      }
    }

    // ─── Monster attack ───
    const totalThreat = heroThreatVal.reduce((s, t, i) => heroHp[i] > 0 ? s + t : s, 0);
    const isAoe = Math.random() < mobAoeChance && heroesAlive > 1;

    if (isAoe) {
      const aoeDmgBase = Math.ceil(mobDamage * mobAoeDmgRatio);
      log.push({ round, type: 'monster_attack', actor: mobDisplayName, detail: `광역 공격! (기본 ${formatNum(aoeDmgBase)} 피해)` });
      for (let i = 0; i < numHeroes; i++) {
        if (heroHp[i] <= 0) continue;
        if (Math.random() < Math.max(0, heroEva[i])) {
          log.push({ round, type: 'event', actor: mobDisplayName, target: activeHeroes[i].name, detail: `회피` });
          continue;
        }
        // Ninja/Sensei lose innate on hit
        if ((heroIsNinjaFlag[i] || heroIsSenseiFlag[i]) && lostInnateRound[i] < 0) {
          heroAtkVal[i] = ninjaBaseAtk[i];
          heroEva[i] = ninjaBaseEva[i];
          lostInnateRound[i] = round;
          log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `피격! 고유 스킬 소실 (ATK -30%, EVA -15%)` });
        }
        // Lord protection (single target only, skip for AOE)
        const negEvaBonus = (heroEva[i] < 0 && isExtreme) ? -0.25 * heroEva[i] : 0;
        const isCrit = Math.random() < baseMobCritChance * mobCritChanceMod + negEvaBonus;
        const normalDmg = calcDamageTaken(heroDefVal[i], aoeDmgBase, mobCap);
        const dmg = isCrit ? calcCritDamageTaken(normalDmg, aoeDmgBase) : normalDmg;
        heroHp[i] -= dmg;
        // Fatal blow survival check (armadillo spirit, cleric, bishop)
        if (heroHp[i] <= 0) {
          let survived = false;
          if (heroIsClericFlag[i] || heroIsBishopFlag[i]) {
            heroHp[i] = 1;
            survived = true;
            log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `${heroIsClericFlag[i] ? '클레릭' : '비숍'} 치명타 생존 발동! HP 1로 생존` });
            // Disable further survival for this hero
            heroIsClericFlag[i] = false;
            heroIsBishopFlag[i] = false;
          } else if (heroArmadilloVal[i] > 0) {
            const armadilloChance = heroArmadilloVal[i] / 100;
            if (Math.random() < armadilloChance) {
              heroHp[i] = 1;
              survived = true;
              log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `아르마딜로 치명타 생존 발동! HP 1로 생존` });
            }
          }
        }
        const hpPct = Math.max(0, heroHp[i] / heroMaxHp[i] * 100);
        log.push({ round, type: 'monster_attack', actor: mobDisplayName, target: activeHeroes[i].name, detail: `${isCrit ? '치명타 ' : ''}${formatNum(dmg)} 피해 (${activeHeroes[i].name} HP: ${formatNum(Math.max(0, heroHp[i]))} (${hpPct.toFixed(0)}%))` });
        if (heroHp[i] <= 0) { heroesAlive--; log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `사망!` }); }
      }
    } else {
      // Single target selection
      let target = 0;
      const rng = Math.random() * totalThreat;
      let cum = 0;
      for (let i = 0; i < numHeroes; i++) {
        if (heroHp[i] <= 0) continue;
        cum += heroThreatVal[i];
        if (rng <= cum) { target = i; break; }
      }
      if (heroHp[target] <= 0) {
        for (let i = numHeroes - 1; i >= 0; i--) { if (heroHp[i] > 0) { target = i; break; } }
      }

      // Lord protection
      if (lordIdx >= 0 && lordIdx !== target && heroHp[lordIdx] > 0) {
        const lordTier = heroTier[lordIdx];
        const protectChance = lordTier >= 4 ? 0.35 : lordTier >= 3 ? 0.25 : 0.15;
        if (Math.random() < protectChance) {
          log.push({ round, type: 'event', actor: activeHeroes[lordIdx].name, detail: `군주 고유 스킬 발동! ${activeHeroes[target].name} 대신 피해 흡수` });
          target = lordIdx;
        }
      }

      if (Math.random() < Math.max(0, heroEva[target])) {
        log.push({ round, type: 'event', actor: mobDisplayName, target: activeHeroes[target].name, detail: `회피` });
      } else {
        // Ninja/Sensei lose innate on hit
        if ((heroIsNinjaFlag[target] || heroIsSenseiFlag[target]) && lostInnateRound[target] < 0) {
          heroAtkVal[target] = ninjaBaseAtk[target];
          heroEva[target] = ninjaBaseEva[target];
          lostInnateRound[target] = round;
          log.push({ round, type: 'event', actor: activeHeroes[target].name, detail: `피격! 고유 스킬 소실 (ATK -30%, EVA -15%)` });
        }
        const negEvaBonus = (heroEva[target] < 0 && isExtreme) ? -0.25 * heroEva[target] : 0;
        const isCrit = Math.random() < baseMobCritChance * mobCritChanceMod + negEvaBonus;
        const normalDmg = calcDamageTaken(heroDefVal[target], mobDamage, mobCap);
        const dmg = isCrit ? calcCritDamageTaken(normalDmg, mobDamage) : normalDmg;
        heroHp[target] -= dmg;
        // Fatal blow survival check (cleric/bishop, armadillo)
        if (heroHp[target] <= 0) {
          let survived = false;
          if (heroIsClericFlag[target] || heroIsBishopFlag[target]) {
            heroHp[target] = 1;
            survived = true;
            log.push({ round, type: 'event', actor: activeHeroes[target].name, detail: `${heroIsClericFlag[target] ? '클레릭' : '비숍'} 치명타 생존 발동! HP 1로 생존` });
            heroIsClericFlag[target] = false;
            heroIsBishopFlag[target] = false;
          } else if (heroArmadilloVal[target] > 0) {
            const armadilloChance = heroArmadilloVal[target] / 100;
            if (Math.random() < armadilloChance) {
              heroHp[target] = 1;
              survived = true;
              log.push({ round, type: 'event', actor: activeHeroes[target].name, detail: `아르마딜로 치명타 생존 발동! HP 1로 생존` });
            }
          }
        }
        const hpPct = Math.max(0, heroHp[target] / heroMaxHp[target] * 100);
        log.push({ round, type: 'monster_attack', actor: mobDisplayName, target: activeHeroes[target].name, detail: `${isCrit ? '치명타 ' : ''}${formatNum(dmg)} 피해 (${activeHeroes[target].name} HP: ${formatNum(Math.max(0, heroHp[target]))} (${hpPct.toFixed(0)}%))` });
        if (heroHp[target] <= 0) { heroesAlive--; log.push({ round, type: 'event', actor: activeHeroes[target].name, detail: `사망!` }); }
      }
    }

    if (heroesAlive <= 0) {
      log.push({ round, type: 'result', actor: '시스템', detail: `패배! (${round}라운드)` });
      break;
    }

    // ─── Heroes attack ───
    for (let i = 0; i < numHeroes; i++) {
      if (heroHp[i] <= 0) continue;

      // Mob evasion (agile/legendary)
      if (mobEvasion >= 0 && Math.random() < mobEvasion) {
        log.push({ round, type: 'event', actor: activeHeroes[i].name, target: mobDisplayName, detail: `${mobDisplayName} 회피!` });
        continue;
      }

      // Calculate effective crit chance with conqueror stacks
      let effectiveCrit = heroCrit[i];
      if (heroIsConquistadorFlag[i] && conquStacks[i] > 0) {
        effectiveCrit += conquStacks[i] * 0.05; // +5% per stack
      }

      // Dinosaur bonus (first round only)
      let dinoBonus = 0;
      if (round === 1 && heroDinoVal[i] > 0) {
        dinoBonus = heroDinoVal[i];
      }

      // Shark bonus (monster HP <= 50%)
      let sharkBonus = 0;
      if (heroSharkVal[i] > 0 && mobHpCurrent / totalMobHp <= 0.5) {
        sharkBonus = heroSharkVal[i];
      }

      const effectiveAtk = heroAtkVal[i] + dinoBonus + sharkBonus;
      const isCrit = Math.random() < Math.min(effectiveCrit, 1.0);
      const dmg = Math.floor(effectiveAtk * (isCrit ? heroCritMult[i] : 1) * barrierMod);
      mobHpCurrent -= dmg;
      heroDmgDealt[i] += dmg;

      // Conqueror: track crit stacks
      if (heroIsConquistadorFlag[i]) {
        if (isCrit) {
          const oldStacks = conquStacks[i];
          conquStacks[i] = Math.min(conquStacks[i] + 1, 4);
          if (conquStacks[i] !== oldStacks) {
            log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `정복자 치명타 중첩 ${conquStacks[i]}/4` });
          }
        }
      }

      const mobPct = Math.max(0, mobHpCurrent / totalMobHp * 100);
      log.push({ round, type: 'hero_attack', actor: activeHeroes[i].name, target: mobDisplayName, detail: `${isCrit ? '치명타 ' : ''}${formatNum(dmg)} 피해 (${mobDisplayName} HP: ${formatNum(Math.max(0, mobHpCurrent))} (${mobPct.toFixed(0)}%))` });
      if (mobHpCurrent <= 0) break;
    }

    if (mobHpCurrent <= 0) {
      log.push({ round, type: 'result', actor: '시스템', detail: `승리! (${round}라운드)` });
      break;
    }

    if (round >= MAX_ROUNDS) {
      log.push({ round, type: 'result', actor: '시스템', detail: `라운드 제한 도달 (${MAX_ROUNDS}라운드)` });
    }
  }

  return log;
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString();
}

function emptyResult(simCount: number): SimulationResult {
  return {
    winRate: 0, rawWinRate: 0,
    avgRounds: 0, minRounds: 0, maxRounds: 0,
    heroResults: [], roundLimitRate: 0, totalSimulations: simCount,
  };
}
