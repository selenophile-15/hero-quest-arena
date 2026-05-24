/**
 * Shop Titans Combat Simulation Engine
 * Based on the official combat mechanics and reference spreadsheet script.
 *
 * Key references:
 * - PDF: shop_titans_combat_simulation_explanation_kr.pdf
 * - PDF: 정리용_은근_딥한_내용들_용병_헴마_몬스터_등_네이버_카페.pdf
 * - Google Apps Script combat simulator (1.txt)
 */

import { Hero } from "@/types/game";
import { getChampionLeaderSkillTier, getCombatSkillTier } from "@/lib/championTier";
import { getAurasongBonusStatsSync } from "@/lib/championEquipUtils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuestMonster {
  hp: number;
  atk: number; // Mob_Damage
  aoe: number; // AoE damage base
  aoeChance: number; // AoE chance (%)
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

export type MiniBossType = "random" | "none" | "agile" | "dire" | "huge" | "wealthy" | "legendary";

export interface BoosterType {
  type: "none" | "normal" | "super" | "mega" | "xp_normal" | "xp_super" | "xp_mega";
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
  crit: number; // % (e.g., 87)
  critDmg: number; // % (e.g., 700)
  evasion: number; // % (e.g., 62)
  // PDF damage formula fields — used to apply conditional bonuses (shark/dino/mundra/berserker)
  // as additive entries to the common ATK% sum rather than as an outer multiplier.
  // standalone(t) = atkConstant * (1 + commonAtkPct + condPct(t))
  // effective(t)  = standalone(t) * partyAtkMult  (+ flat additions baked in)
  atkConstant?: number; // pre-common% constant (base + seed + equip + flat)
  defConstant?: number;
  commonAtkPct?: number; // decimal, e.g. 1.85 means +185%
  commonDefPct?: number;
  partyAtkMult?: number; // decimal, party-level multiplier (champion+aurasong+booster+lone wolf)
  partyDefMult?: number;
}

export interface SimulationConfig {
  heroes: Hero[];
  monster: QuestMonster;
  miniBoss: MiniBossType;
  booster: BoosterType;
  questTypeKey: string; // 'normal' | 'flash' | 'lcog' | 'tot'
  regionName: string; // e.g. '공포'
  isTerrorTower: boolean; // 공포의 탑 (5% damage)
  precomputedStats?: PrecomputedHeroStats[]; // If provided, skip champion/aurasong computation
  simulationCount?: number; // Default 50000
  _isRetry?: boolean; // Internal: prevents Fateweaver recursion
  _disableRetry?: boolean; // Internal: used for aggregated random miniboss runs
  // When true: forces simulationCount=1 and attaches an eventLog to the result.
  // Existing callers leave this undefined → behavior is identical to before.
  recordEvents?: boolean;
}

export interface HeroSimResult {
  heroId: string;
  heroName: string;
  survivalRate: number; // %
  avgHpRemaining: number;
  maxHpRemaining: number;
  // Total damage
  avgDamageDealt: number;
  maxDamageDealt: number;
  minDamageDealt: number;
  // Normal vs Crit damage breakdown
  normalDmgDealtAvg: number; // Average total normal damage
  critDmgDealtAvg: number; // Average total crit damage
  // Per-turn damage
  avgDamagePerTurn: number;
  // Per-turn damage min/max (across sims; per-sim = damageFight/round)
  minDamagePerTurn?: number;
  maxDamagePerTurn?: number;
  // Incoming damage stats (per hit, not total)
  normalDamageTaken: number; // Single normal hit damage
  aoeDamageTaken: number; // Single AoE hit damage
  critDamageTakenVal: number; // Single crit hit damage
  // Total incoming damage (averaged across sims)
  totalDamageTakenAvg: number;
  avgDamageTakenPerHit: number;
  avgDamageTakenPerTurn: number; // Average damage taken per turn
  // Avg-when-hit (only sims where this hero actually took damage of that kind)
  totalDamageTakenAvgWhenHit?: number;
  singleDmgTakenAvgWhenHit?: number;
  aoeDmgTakenAvgWhenHit?: number;
  // Min/Max total damage taken across sims
  minDamageTaken?: number;
  maxDamageTaken?: number;
  // AoE-only / single-only damage taken (avg per sim)
  aoeDmgTakenTotal?: number;
  singleDmgTakenTotal?: number;
  // Min/Max single-only and aoe-only damage taken (across sims where any was taken)
  singleDmgTakenMin?: number;
  singleDmgTakenMax?: number;
  singleDmgTakenAvg?: number;
  aoeDmgTakenMin?: number;
  aoeDmgTakenMax?: number;
  aoeDmgTakenAvg?: number;
  // Shark stats
  sharkNormalDmg: number; // Normal attack damage when shark active (+bonus)
  sharkCritDmg: number; // Crit attack damage when shark active
  // Dinosaur (first turn) stats
  dinosaurNormalDmg: number; // First turn normal damage with dinosaur
  dinosaurCritDmg: number; // First turn crit damage with dinosaur
  // Spirit flags
  hasSharkSpirit: boolean;
  hasDinosaurSpirit: boolean;
  isSamuraiOrDaimyo: boolean;
  // Final stat snapshots used in simulation (ATK includes barrierMod)
  finalAtk: number;
  finalDef: number;
  finalHp: number;
  finalCritChance: number; // %
  finalCritDmg: number; // %
  finalCritAttack: number; // ATK * CRIT.D (actual crit damage)
  finalEvasion: number; // %
  // Damage application rate (% of raw damage applied after defense)
  damageApplicationRate: number; // e.g., 25 means 25% of raw damage
  // Targeting
  targetingRate: number; // % of times targeted (threat-based)
  evasionRate: number; // % of attacks evaded among targeted
  // Single-target targeting rate (% of single-target hits this hero received)
  singleTargetRate?: number;
  // Monster crit chance against this hero (%)
  monsterCritChance: number;
  // Berserker thresholds
  berserkerThresholds?: { threshold: number; belowRate: number }[];
  // Berserker bonus values per stage
  berserkerAtkBonus?: number[]; // ATK % bonus per stage [stage1, stage2, stage3]
  berserkerEvaBonus?: number[]; // EVA % bonus per stage
  // Chronomancer
  chronomancerRetries?: number;
  chronomancerRetrySuccessRate?: number;
  // Healing
  totalHealingAvg: number;
  healPerTurn: number;
  // Lord protection
  lordProtectionAvg: number;
  // % of sims where this hero was protected at least once
  lordProtectionSimRate?: number;
  // Lord protection split by attack type (avg per sim)
  lordProtectedSingleAvg?: number;
  lordProtectedAoeAvg?: number;
  // Damage absorbed by lord when protecting this hero (avg per sim, single & aoe)
  lordAbsorbedSingleDmg?: number;
  lordAbsorbedAoeDmg?: number;
  // Crit survival (armadillo, cleric/bishop)
  critSurvivalCount: number; // avg applied count per sim
  critSurvivalChance?: number; // % chance (configured)
  // % of sims where crit survival actually triggered (>=1 trigger)
  critSurvivalApplyRate?: number;
  // Per-turn taken min/max
  minDamageTakenPerTurn?: number;
  maxDamageTakenPerTurn?: number;
  // Single-attack hit-type ratios (% of single attacks that were normal vs crit)
  singleNormalHitShare?: number;
  singleCritHitShare?: number;
  // Win-only HP remaining (min/avg/max)
  winHpRemainMin?: number;
  winHpRemainAvg?: number;
  winHpRemainMax?: number;
  // Lose-only HP remaining (min/avg/max)
  loseHpRemainMin?: number;
  loseHpRemainAvg?: number;
  loseHpRemainMax?: number;
  // Overall HP remaining min/max (across all sims)
  overallHpRemainMin?: number;
  overallHpRemainMax?: number;
  overallHpRemainAvg?: number;
  // Win-only HP remaining by bucket (alias used by UI)
  // Berserker per-stage actual evasion rate (%) (stage1, 2, 3)
  berserkerStageEvaRate?: number[];
  // Berserker per-stage actual damage dealt (avg per sim, [normal, crit, total])
  berserkerStageDmg?: { normal: number; crit: number; avg: number; total: number }[];
  tankingRate: number; // % of single-target hits absorbed (excluding AoE)
  // Alive turn distribution (overall / win / lose)
  aliveTurnsMin?: number;
  aliveTurnsAvg?: number;
  aliveTurnsMax?: number;
  winAliveTurnsMin?: number;
  winAliveTurnsAvg?: number;
  winAliveTurnsMax?: number;
  loseAliveTurnsMin?: number;
  loseAliveTurnsAvg?: number;
  loseAliveTurnsMax?: number;
  // % of sims where this hero was alive when round-limit reached
  roundLimitAliveRate?: number;
  // Hemma drain absorbed from this ally (avg dmg per sim, only non-hemma allies)
  hemmaAbsorbedDmg?: number;
  hemmaAbsorbedCount?: number; // avg drain count from this ally per sim
  // Hemma attack-bonus gain (per sim) — set only on hemma hero row
  hemmaAtkGainAvg?: number;
  // Rudo bonus tracking
  rudoCritBonusPct?: number; // Rudo crit-chance bonus (%)
  rudoFinalCritChance?: number; // hero's final crit chance (%) with rudo bonus
  rudoBonusDmgAvg?: number; // avg dmg dealt during rudo bonus rounds (per sim)
  isRudoInParty?: boolean;
  // Lord absorbed damage breakdown — when THIS hero was the protected ally
  lordSavedSingleAvgDmg?: number; // avg single dmg absorbed by lord saving this hero per sim
  lordSavedAoeAvgDmg?: number; // avg aoe dmg absorbed by lord saving this hero per sim
  // Conqueror per-stack metrics (index 0..4 = stack count)
  conquerorStackTurnRate?: number[]; // % of attack-turns spent at each stack (0..4)
  conquerorStackCritDmg?: number[]; // theoretical crit damage at each stack (avgBaseAtk × (critMult + s*0.25))
  conquerorStackAvgDmg?: number[]; // per-battle avg damage contribution at stack s (sum across all sims ÷ sim count)
  conquerorStackResetRate?: number[]; // (deprecated) % of attacks at this stack that ended in reset
  conquerorAvgStack?: number; // overall avg stack count when attacking
  conquerorAvgCritBonus?: number; // overall avg crit% bonus from stacks (0..100)
  conquerorBaseCritMult?: number; // base crit-damage multiplier (e.g. 4.0 for 400%)
  // Ninja/Sensei innate bonus tracking
  innateLossCount?: number; // avg # of times innate bonus was lost (per sim)
  innateRegenCount?: number; // avg # of times sensei regenerated bonus (per sim)
  withInnateAvgDmg?: number; // avg dmg dealt while bonus active (per sim total)
  withoutInnateAvgDmg?: number; // avg dmg dealt while bonus inactive (per sim total)
  // Class/spirit flags for special-info table rendering
  isLordHero?: boolean;
  isHemmaHero?: boolean;
  isConquerorHero?: boolean;
  isNinjaHero?: boolean;
  isSenseiHero?: boolean;
  isBerserkerHero?: boolean;
  berserkerStageNum?: number; // 1..3
  // Polonia loot — per hero (avg # of items stolen per sim by this hero)
  poloniaStolenAvg?: number;
  // Trickster flag (for Polonia loot UI)
  isTricksterHero?: boolean;
}

// Polonia loot summary
export interface PoloniaLootInfo {
  hasPolonia: boolean;
  baseChance: number; // % per attack (final, after trickster bonus)
  capMax: number; // max items per sim (after trickster bonus)
  numTricksters: number; // # of trickster heroes (excluding champion)
  avgPerSim: number; // avg items stolen per sim (after cap)
  minPerSim: number;
  maxPerSim: number;
  capHitRate: number; // % of sims that hit the cap
}

export interface PartyAggregate {
  min: number;
  avg: number;
  max: number;
}

export interface MiniBossResult {
  type: "normal" | MiniBossType;
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
  winRate: number; // % (after Fateweaver retry if applicable)
  rawWinRate: number; // % (first attempt, before retry)
  retryWinRate?: number; // % (second attempt with booster, if Fateweaver)
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
  roundLimitRate: number; // % of sims hitting 499 round limit
  totalSimulations: number;
  retrySimulations?: number; // Number of retry sims (if Fateweaver)
  retryResult?: SimulationResult; // Full retry sim result (only on first-pass result)
  combinedResult?: SimulationResult; // 모래시계 OFF 전용: firstWin + retry(win+lose) 병합 결과
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
  // Polonia loot summary
  poloniaLoot?: PoloniaLootInfo;
  // Populated only when SimulationConfig.recordEvents === true
  eventLog?: CombatLogEntry[];
}

// ─── Class/Job mapping (Korean → English equivalent for logic) ───────────────

const CLASS_LINE_MAP: Record<string, "fighter" | "rogue" | "spellcaster"> = {
  전사: "fighter",
  로그: "rogue",
  주문술사: "spellcaster",
};

// Fighter line (전사 계열): 병사~죽음의 기사
const FIGHTER_CLASSES = [
  "병사",
  "용병",
  "야만전사",
  "족장",
  "기사",
  "군주",
  "레인저",
  "관리인",
  "사무라이",
  "다이묘",
  "광전사",
  "잘",
  "어둠의 기사",
  "죽음의 기사",
  // English aliases (legacy / fallback only — primary matching is done via classLine)
  "Soldier",
  "Mercenary",
  "Barbarian",
  "Chieftain",
  "Knight",
  "Lord",
  "Ranger",
  "Warden",
  "Samurai",
  "Daimyo",
  "Berserker",
  "Jarl",
  "Dark Knight",
  "Death Knight",
];
// Rogue line (로그 계열): 도둑~근위병
const ROGUE_CLASSES = [
  "도둑",
  "사기꾼",
  "수도승",
  "그랜드 마스터",
  "머스킷병",
  "정복자",
  "방랑자",
  "길잡이",
  "닌자",
  "센세",
  "무희",
  "곡예가",
  "경보병",
  "근위병",
  // English aliases (legacy / fallback only)
  "Thief",
  "Trickster",
  "Monk",
  "Grand Master",
  "Musketeer",
  "Conquistador",
  "Wanderer",
  "Pathfinder",
  "Ninja",
  "Sensei",
  "Dancer",
  "Acrobat",
  "Light Infantry",
  "Royal Guard",
];
// Spellcaster line (주문술사 계열): 마법사~페이트위버
const SPELLCASTER_CLASSES = [
  "마법사",
  "대마법사",
  "성직자",
  "비숍",
  "드루이드",
  "아크 드루이드",
  "소서러",
  "워록",
  "마법검",
  "스펠나이트",
  "풍수사",
  "아스트라맨서",
  "크로노맨서",
  "페이트위버",
  // English aliases (legacy / fallback only)
  "Mage",
  "Archmage",
  "Cleric",
  "Bishop",
  "Druid",
  "Archdruid",
  "Sorcerer",
  "Warlock",
  "Spellblade",
  "Spellknight",
  "Geomancer",
  "Astramancer",
  "Chronomancer",
  "Fateweaver",
];

// Champion names (Korean)
const CHAMPION_NAMES = [
  "아르곤",
  "애슐리",
  "비외른",
  "도노반",
  "헴마",
  "릴루",
  "맬러디",
  "폴로니아",
  "라인홀드",
  "루도",
  "시아",
  "야미",
  "타마스",
];

function getClassLine(hero: Hero): "fighter" | "rogue" | "spellcaster" | "none" {
  if (hero.classLine) {
    return CLASS_LINE_MAP[hero.classLine] || "none";
  }
  const cls = hero.heroClass || "";
  if (FIGHTER_CLASSES.some((c) => cls.includes(c))) return "fighter";
  if (ROGUE_CLASSES.some((c) => cls.includes(c))) return "rogue";
  if (SPELLCASTER_CLASSES.some((c) => cls.includes(c))) return "spellcaster";
  return "none";
}

function isClass(hero: Hero, ...names: string[]): boolean {
  const cls = hero.heroClass || "";
  const champ = hero.championName || "";
  return names.some((n) => cls === n || cls.includes(n) || champ === n || champ.includes(n));
}

function isChampion(hero: Hero): boolean {
  return hero.type === "champion";
}

function isMercenary(hero: Hero): boolean {
  return isClass(hero, "용병", "Mercenary");
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

function getAurasongBonuses(champion: Hero | null): AurasongBonuses & { regenPerTurn: number } {
  const result: AurasongBonuses & { regenPerTurn: number } = {
    atkPct: 0,
    defPct: 0,
    hpPct: 0,
    critPct: 0,
    evaPct: 0,
    critDmgPct: 0,
    flatAtk: 0,
    flatDef: 0,
    flatHp: 0,
    regenPerTurn: 0,
  };
  if (!champion) return result;

  const item: any = champion.equipmentSlots?.[1]?.item;
  const bonuses = item?.relicStatBonuses;
  if (Array.isArray(bonuses)) {
    for (const b of bonuses) {
      const rawVal = typeof b?.value === "number" ? b.value : 0;
      const val = b?.op === "감소" ? -rawVal : rawVal;
      switch (b?.stat) {
        case "오라_공격력%":
          result.atkPct += val / 100;
          break;
        case "오라_방어력%":
          result.defPct += val / 100;
          break;
        case "오라_체력%":
          result.hpPct += val / 100;
          break;
        case "오라_치명타확률%":
          result.critPct += val / 100;
          break;
        case "오라_회피%":
          result.evaPct += val / 100;
          break;
        case "오라_치명타데미지%":
          result.critDmgPct += val / 100;
          break;
        case "오라_깡공격력":
          result.flatAtk += val;
          break;
        case "오라_깡방어력":
          result.flatDef += val;
          break;
        case "오라_깡체력":
          result.flatHp += val;
          break;
        case "오라_매턴체력회복":
          result.regenPerTurn += val;
          break;
      }
    }
  }

  // Preset aurasong lookup (for items without relicStatBonuses, like "광휘의 오라")
  if (item?.name) {
    try {
      const presetBonuses = getAurasongBonusStatsSync(item.name);
      if (presetBonuses && typeof presetBonuses === "object") {
        for (const [k, v] of Object.entries(presetBonuses)) {
          if (typeof v !== "number") continue;
          switch (k) {
            case "오라_매턴체력회복":
              result.regenPerTurn += v;
              break;
            // Other 오라_ bonuses for preset aurasongs are intentionally NOT added here
            // because they are already applied via partyBuffCalculator/precomputedStats.
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return result;
}

// ─── Flash quest (깜짝 퀘스트) Bjorn multiplier zones ─────────────────────────

const BJORN_DOUBLE_ZONES = [
  "Ancient Crustacean",
  "Anubis Champion",
  "Cyclops General",
  "Cyclops Merchant",
  "Gold Golem",
  "Moonstone Golem",
  "Mushgoon Graverobber",
  "Runestone Golem",
  "Scholarly Harpy",
  "Sigil Ninja",
  "Toad Sage",
  "Training Instructor",
  "Troublin Blacksmith",
  "Troublin Pirate",
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
    r50: mobCap * 3, // approximate
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
  // When recordEvents=true: force exactly one simulation and prepare an event log buffer.
  // pushEv() is a no-op unless recordEvents=true, so this addition does not affect any
  // existing call site (which leaves recordEvents undefined).
  const recordEvents = config.recordEvents === true;
  const simCount = recordEvents ? 1 : (config.simulationCount ?? 50000);
  const eventLog: CombatLogEntry[] = [];
  const pushEv = recordEvents
    ? (entry: CombatLogEntry) => {
        eventLog.push(entry);
      }
    : (_entry: CombatLogEntry) => {
        /* no-op */
      };

  // Filter out heroes with 0 HP (empty slots)
  const activeHeroes = heroes.filter((h) => h.hp > 0);
  if (activeHeroes.length === 0) {
    const r = emptyResult(simCount);
    if (recordEvents) r.eventLog = [{ round: 0, type: "result", actor: "시스템", detail: "활성 영웅 없음" }];
    return r;
  }

  // For random mode: run multiple simulations per mini-boss type
  // (recordEvents mode bypasses random to keep the log linear.)
  if (miniBoss === "random" && !recordEvents) {
    return runRandomMiniBossSimulation(config, activeHeroes, simCount);
  }

  const numHeroes = activeHeroes.length;
  const isLCoG = questTypeKey === "lcog";
  const isFlash = questTypeKey === "flash";
  const isExtreme = monster.isExtreme || isTerrorTower;

  // ─── Mini Boss modifiers ───
  let mobHpMod = 1.0;
  let mobDamageMod = 1.0;
  let mobCritChanceMod = 1.0;
  let mobEvasion = -1.0; // -1 = no evasion
  let mobAoeChanceMod = 1.0;
  let miniBossLabel = "";

  switch (miniBoss) {
    case "agile":
      mobEvasion = 0.4;
      miniBossLabel = "민첩한";
      break;
    case "dire":
      mobHpMod = 1.5;
      mobCritChanceMod = 3.0; // 10% * 3 = 30%
      miniBossLabel = "흉포한";
      break;
    case "huge":
      mobHpMod = 2.0;
      mobAoeChanceMod = 3.0;
      miniBossLabel = "거대한";
      break;
    case "wealthy":
      // No stat changes, only loot bonus
      miniBossLabel = "부유한";
      break;
    case "legendary":
      mobHpMod = 1.5;
      mobDamageMod = 1.25;
      mobCritChanceMod = 1.5; // 10% * 1.5 = 15%
      mobEvasion = 0.1;
      miniBossLabel = "전설적인";
      break;
  }
  const mobDisplayName = miniBossLabel ? `${miniBossLabel} 몬스터` : "몬스터";

  const mobHp = Math.round(monster.hp * mobHpMod);
  let mobDamage = Math.round(monster.atk * mobDamageMod);
  const mobAoeDmgRatio = monster.aoe / monster.atk; // AoE as ratio of base damage
  const mobAoeChance = (monster.aoeChance / 100) * mobAoeChanceMod;
  const baseMobCritChance = 0.1; // Base 10%
  const mobCap = monster.def.r0; // r0 = Cap (defense value at 0% reduction)

  // Terror Tower: damage is 5% of original
  if (isTerrorTower) {
    mobDamage = Math.round(mobDamage * 0.05);
  }

  // ─── Count class lines ───
  let numFighters = 0,
    numRogues = 0,
    numSpellcasters = 0;
  activeHeroes.forEach((h) => {
    const line = getClassLine(h);
    if (line === "fighter") numFighters++;
    else if (line === "rogue") numRogues++;
    else if (line === "spellcaster") numSpellcasters++;
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

  const champName = champion?.championName || champion?.name || "";
  const champTier = champion ? getChampionLeaderSkillTier(champion) : 0;
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

  // PDF damage formula: per-hero standalone-ATK fields
  const heroAtkRaw: number[] = []; // pre-party hero ATK (Hero.atk before party buffs)
  const heroAtkConst: number[] = []; // atkConstant: (base+seed+equip+flat) before common%
  const heroDefConst: number[] = [];
  const heroCommonAtkPct: number[] = []; // decimal
  const heroCommonDefPct: number[] = [];
  const heroPartyAtkMult: number[] = []; // decimal multiplier from party+booster
  const heroPartyDefMult: number[] = [];

  for (let i = 0; i < numHeroes; i++) {
    const h = activeHeroes[i];
    const ps = precomputedStats?.[i];
    const tier = getCombatSkillTier(h);
    heroTier.push(tier);

    // Use precomputed stats (from partyBuffCalculator with champion+aurasong+booster)
    // or fall back to raw hero stats
    heroAtk.push(ps ? ps.atk : h.atk || 0);
    heroDef.push(ps ? ps.def : h.def || 0);
    heroHpMax.push(ps ? ps.hp : h.hp || 0);
    heroCritChance.push(ps ? ps.crit / 100 : (h.crit || 0) / 100);
    heroCritMult.push(ps ? ps.critDmg / 100 : (h.critDmg || 0) / 100);
    heroEvasion.push(ps ? ps.evasion / 100 : (h.evasion || 0) / 100);
    heroThreat.push(h.threat || 1);

    // PDF formula fields — read pre-pct constants directly from detailStats.
    // Inversion is only a legacy fallback for heroes computed before the field existed.
    heroAtkRaw.push(h.atk || 0);
    const cAtk = ps?.commonAtkPct ?? ((h as any).detailStats?.["공통 공격력 계수"] ?? 0) / 100;
    const cDef = ps?.commonDefPct ?? ((h as any).detailStats?.["공통 방어력 계수"] ?? 0) / 100;
    heroCommonAtkPct.push(cAtk);
    heroCommonDefPct.push(cDef);
    const storedAtkConst = (h as any).detailStats?.["공격력 상수"];
    const storedDefConst = (h as any).detailStats?.["방어력 상수"];
    heroAtkConst.push(ps?.atkConstant ?? storedAtkConst ?? (1 + cAtk > 0 ? (h.atk || 0) / (1 + cAtk) : 0));
    heroDefConst.push(ps?.defConstant ?? storedDefConst ?? (1 + cDef > 0 ? (h.def || 0) / (1 + cDef) : 0));
    heroPartyAtkMult.push(ps?.partyAtkMult ?? 1);
    heroPartyDefMult.push(ps?.partyDefMult ?? 1);

    // Evasion cap: Pathfinder = 78%, others = 75%
    heroEvaCap.push(isClass(h, "길잡이", "Pathfinder") ? 0.78 : 0.75);

    // Equipment artifacts
    const hasRockStompers = h.equipmentSlots?.some((s) => s.item?.name === "락 스톰퍼") || false;
    heroArtNoEvasion.push(hasRockStompers);

    const hasKiku = h.equipmentSlots?.some((s) => s.item?.name === "키쿠이치몬지") || false;
    heroArtCritChanceMod.push(hasKiku ? 0 : 1);

    const hasLoneWolf =
      h.equipmentSlots?.some((s) => s.item?.name === "외로운 늑대 두건" || s.item?.name === "고독한 늑대 두건") ||
      false;
    heroArtChampionMod.push(hasLoneWolf ? 0 : 1);

    // Class flags
    heroIsNinja.push(isClass(h, "닌자", "Ninja"));
    heroIsSensei.push(isClass(h, "센세", "Sensei"));
    heroIsSamurai.push(isClass(h, "사무라이", "Samurai"));
    heroIsDaimyo.push(isClass(h, "다이묘", "Daimyo"));
    heroIsDancer.push(isClass(h, "무희", "곡예가", "Dancer", "Acrobat"));
    heroIsConquistador.push(isClass(h, "정복자", "Conquistador"));
    heroIsDarkKnight.push(isClass(h, "어둠의 기사", "죽음의 기사", "Dark Knight", "Death Knight"));
    heroIsLord.push(isClass(h, "기사", "군주", "Lord", "Knight"));
    heroIsMercenary.push(isMercenary(h));
    heroIsCleric.push(isClass(h, "성직자", "Cleric"));
    heroIsBishop.push(isClass(h, "비숍", "Bishop"));

    // Berserker level
    heroBerserkerLevel.push(isClass(h, "광전사", "잘", "Berserker", "Jarl") ? Math.min(tier, 4) : 0);

    // Spirits - read from equipment slots
    const spirits = (h.equipmentSlots || []).map((s) => s.spirit).filter(Boolean);
    const spiritNames = spirits.map((sp: any) => (typeof sp === "string" ? sp : sp?.name || "")).join(",");

    const mundraVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === "string" ? sp : sp?.name || "";
      if (name.includes("문드라") || name.includes("Mundra")) {
        const val = typeof sp === "object" ? sp?.value || sp?.atk || 0 : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    heroMundra.push(mundraVal);

    const sharkVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === "string" ? sp : sp?.name || "";
      if (name.includes("상어") || name.includes("Shark")) {
        const val = typeof sp === "object" ? sp?.value || sp?.atk || 0 : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    heroShark.push(sharkVal);

    const dinoVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === "string" ? sp : sp?.name || "";
      if (name.includes("공룡") || name.includes("Dinosaur") || name.includes("T-Rex") || name.includes("티렉스")) {
        const val = typeof sp === "object" ? sp?.value || sp?.atk || 0 : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    heroDinosaur.push(dinoVal);

    const lizardVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === "string" ? sp : sp?.name || "";
      if (name.includes("도마뱀") || name.includes("Lizard")) {
        const val = typeof sp === "object" ? sp?.value || 0 : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    heroLizard.push(lizardVal);

    const armadilloVal = spirits.reduce((sum: number, sp: any) => {
      const name = typeof sp === "string" ? sp : sp?.name || "";
      if (name.includes("아르마딜로") || name.includes("Armadillo")) {
        const val = typeof sp === "object" ? sp?.value || 0 : 0;
        return sum + val;
      }
      return sum;
    }, 0);
    // Use unified detailStats survival chance if available (skill+soul aggregated, clamped to 100, cleric/bishop forced 100)
    const detailSurvival = (h as any).detailStats?.["치명타 생존 확률%"] || 0;
    heroArmadillo.push(Math.min(100, Math.max(armadilloVal, detailSurvival)));
  }

  // ─── Mundra only works on bosses ───
  if (!monster.isBoss) {
    for (let i = 0; i < numHeroes; i++) heroMundra[i] = 0;
  }

  // ─── Champion bonuses ───
  let champAtkBonus = 0,
    champDefBonus = 0,
    champHpBonus = 0;
  let hemmaWho = -1;
  let hemmaMult = 0;
  let lordPresent = false;
  let lordHero = -1;
  let fateweaverPresent = false;
  let chronoRetryPresent = false; // 재시도만, 보너스 없음
  // Polonia loot state
  let poloniaActive = false;
  let poloniaBaseChance = 0;
  let poloniaLootChance = 0;
  let poloniaLootCap = 20;
  let poloniaNumTricksters = 0;

  // Find Lord and Fateweaver (always needed for combat logic)
  for (let i = 0; i < numHeroes; i++) {
    if (heroIsLord[i]) {
      lordPresent = true;
      lordHero = i;
    }
    if (isClass(activeHeroes[i], "페이트위버", "Fateweaver")) {
      fateweaverPresent = true;
    } else if (isClass(activeHeroes[i], "크로노맨서", "Chronomancer")) {
      chronoRetryPresent = true;
    }
  }

  // When precomputedStats are provided, stats already include champion+aurasong+booster
  // Skip recomputation, just apply extreme penalty and use stats directly
  if (precomputedStats && precomputedStats.length === numHeroes) {
    // Hemma detection still needed for per-round cumulative bonus
    if (champName.includes("헴마") || champName === "Hemma") {
      hemmaWho = championIdx;
      hemmaMult = 0.15 + champTier * 0.05;
    }
    // Polonia detection still needed for loot tracking
    if (champName.includes("폴로니아") || champName === "Polonia") {
      poloniaActive = true;
      poloniaBaseChance = champTier === 1 ? 0.3 : champTier === 2 ? 0.35 : champTier === 3 ? 0.4 : 0.5;
      let numTricksters = 0;
      for (let i = 0; i < numHeroes; i++) {
        if (activeHeroes[i].heroClass === "사기꾼" || activeHeroes[i].heroClass === "Trickster") numTricksters++;
      }
      poloniaNumTricksters = numTricksters;
      poloniaLootChance = poloniaBaseChance + numTricksters * 0.02;
      poloniaLootCap = 20 + numTricksters * 2;
    }

    // Extreme penalty on evasion
    if (isExtreme) {
      for (let i = 0; i < numHeroes; i++) {
        if (!heroArtNoEvasion[i]) {
          heroEvasion[i] = heroEvasion[i] - 0.2;
        }
      }
    }

    // Use precomputed ATK/DEF/HP directly (already includes champion+aurasong+booster)
    // Extra retry bonuses (e.g. Fateweaver +20%) must still be applied on top
    const _extraAtk = booster.extraAtkBonus || 0;
    const _extraDef = booster.extraDefBonus || 0;
    var finalAtk: number[] = heroAtk.map((v) => (_extraAtk > 0 ? v * (1 + _extraAtk) : v));
    var finalDef: number[] = heroDef.map((v) => (_extraDef > 0 ? v * (1 + _extraDef) : v));
    var finalHp: number[] = heroHpMax.map((v) => v);
  } else {
    // ─── Full champion bonus computation (fallback when no precomputed stats) ───

    if (champName.includes("아르곤") || champName === "Argon") {
      champAtkBonus = 0.1 * champTier;
      champDefBonus = 0.1 * champTier;
    } else if (champName.includes("애슐리") || champName === "Ashley") {
      champAtkBonus = 0.05 + 0.05 * champTier;
      champDefBonus = 0.05 + 0.05 * champTier;
      if (monster.isBoss) {
        champAtkBonus *= 2;
        champDefBonus *= 2;
      }
    } else if (champName.includes("비외른") || champName === "Bjorn") {
      for (let i = 0; i < numHeroes; i++) {
        const mult = heroIsMercenary[i] ? 1.25 * heroArtChampionMod[i] : heroArtChampionMod[i];
        heroCritMult[i] += (0.1 + 0.1 * champTier) * bjornMult * mult;
      }
      champHpBonus = 0.05 * champTier * bjornMult;
      champAtkBonus = champTier < 3 ? (0.05 + 0.05 * champTier) * bjornMult : (0.1 * champTier - 0.1) * bjornMult;
    } else if (champName.includes("도노반") || champName === "Donovan") {
      // Donovan himself counts as a spellcaster
      const donovanCountedAsSpell = champion ? getClassLine(champion) === "spellcaster" : false;
      const effSpellcasters = donovanCountedAsSpell ? numSpellcasters : numSpellcasters + 1;
      if (champTier === 1) champAtkBonus = 0.05 * effSpellcasters;
      else if (champTier === 2) champAtkBonus = 0.08 * effSpellcasters;
      else if (champTier === 3) champAtkBonus = 0.1 * effSpellcasters;
      else if (champTier === 4) champAtkBonus = 0.14 * effSpellcasters;
      champHpBonus = (0.04 + 0.01 * champTier + 0.02 * Math.max(champTier - 3, 0)) * numFighters;
      for (let i = 0; i < numHeroes; i++) {
        const mult = heroIsMercenary[i] ? 1.25 * heroArtChampionMod[i] : heroArtChampionMod[i];
        const bonus = (0.02 + 0.01 * champTier + 0.01 * Math.max(champTier - 3, 0)) * numRogues;
        heroCritChance[i] += bonus * mult;
        heroEvasion[i] += bonus * mult;
      }
    } else if (champName.includes("헴마") || champName === "Hemma") {
      hemmaWho = championIdx;
      champHpBonus = 0.05 * champTier + 0.05 * Math.max(champTier - 3, 0);
      hemmaMult = 0.15 + champTier * 0.05;
    } else if (champName.includes("릴루") || champName === "Lilu") {
      champHpBonus = 0.05 + 0.05 * champTier;
    } else if (champName.includes("맬러디") || champName === "Malady") {
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
    } else if (champName.includes("폴로니아") || champName === "Polonia") {
      champDefBonus = 0.05 + 0.05 * champTier;
      for (let i = 0; i < numHeroes; i++) {
        const mult = heroIsMercenary[i] ? 1.25 * heroArtChampionMod[i] : heroArtChampionMod[i];
        heroEvasion[i] += (champTier < 3 ? 0.05 : 0.1) * mult;
      }
      // Polonia loot setup
      poloniaActive = true;
      poloniaBaseChance = champTier === 1 ? 0.3 : champTier === 2 ? 0.35 : champTier === 3 ? 0.4 : 0.5;
      let numTricksters = 0;
      for (let i = 0; i < numHeroes; i++) {
        if (activeHeroes[i].heroClass === "사기꾼" || activeHeroes[i].heroClass === "Trickster") numTricksters++;
      }
      poloniaNumTricksters = numTricksters;
      poloniaLootChance = poloniaBaseChance + numTricksters * 0.02;
      poloniaLootCap = 20 + numTricksters * 2;
    } else if (champName.includes("라인홀드") || champName === "Reinhold") {
      champAtkBonus = 0.05 + 0.05 * champTier + 0.05 * Math.max(champTier - 3, 0);
      champDefBonus = 0.05 + 0.05 * champTier + 0.05 * Math.max(champTier - 3, 0);
      champHpBonus = 0.05 + 0.05 * champTier + 0.05 * Math.max(champTier - 3, 0);
    } else if (champName.includes("시아") || champName === "Sia") {
      champAtkBonus = 0.05 + 0.05 * champTier;
    } else if (champName.includes("야미") || champName === "Yami") {
      for (let i = 0; i < numHeroes; i++) {
        const mult = heroIsMercenary[i] ? 1.25 * heroArtChampionMod[i] : heroArtChampionMod[i];
        heroCritChance[i] += 0.05 * champTier * mult;
        heroEvasion[i] += 0.05 * champTier * mult;
      }
    } else if (champName.includes("루도") || champName === "Rudo") {
      // Rudo's crit bonus is handled per-round below
    } else if (champName.includes("타마스") || champName === "Tamas") {
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
    let boosterAtkBonus = 0,
      boosterDefBonus = 0;
    switch (booster.type) {
      case "normal":
        boosterAtkBonus = 0.2;
        boosterDefBonus = 0.2;
        break;
      case "super":
        boosterAtkBonus = 0.4;
        boosterDefBonus = 0.4;
        for (let i = 0; i < numHeroes; i++) heroCritChance[i] += 0.1;
        break;
      case "mega":
        boosterAtkBonus = 0.8;
        boosterDefBonus = 0.8;
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
          heroEvasion[i] = heroEvasion[i] - 0.2;
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
        heroAtk[i] *
          (1.0 + (champAtkBonus * champModI + aurasong.atkPct) * mercMult + boosterAtkBonus + loneWolfBonus) +
          aurasong.flatAtk,
      );
      finalDef.push(
        heroDef[i] *
          (1.0 + (champDefBonus * champModI + aurasong.defPct) * mercMult + boosterDefBonus + loneWolfBonus) +
          aurasong.flatDef,
      );
      finalHp.push(heroHpMax[i] * (1.0 + (champHpBonus * champModI + aurasong.hpPct) * mercMult) + aurasong.flatHp);
    }
  } // end else (no precomputed stats)

  // ─── Mundra fold-in (one-time, boss only) ───
  // Mundra's +20%×stack ATK/DEF stays active for the entire boss fight, so we fold it
  // into finalAtk/finalDef once instead of re-computing every turn. This also makes the
  // displayed stat table reflect the buffed value (which is what the user expects for
  // a permanent boss-fight buff, in contrast to Shark/Dino/Berserker/Hemma which are
  // conditional/cumulative and stay excluded from the table).
  if (monster.isBoss) {
    for (let i = 0; i < numHeroes; i++) {
      if (heroMundra[i] > 0) {
        const atkAdd = heroAtkConst[i] * 0.2 * heroMundra[i] * (heroPartyAtkMult[i] || 1);
        const defAdd = heroDefConst[i] * 0.2 * heroMundra[i] * (heroPartyDefMult[i] || 1);
        finalAtk[i] += atkAdd;
        finalDef[i] += defAdd;
      }
    }
  }

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

    activeHeroes.forEach((h) => {
      if (!barrierEl) return;
      let elVal = h.equipmentElements?.[barrierEl] || 0;
      // Spell Knight / 마법검 / 스펠나이트: can use any element but at 50% effectiveness
      const isSpellKnight = isClass(h, "마법검", "스펠나이트", "Spellblade", "Spellknight");
      if (isSpellKnight) {
        // Sum all element values and apply 50%
        const allElements = (h.equipmentElements || {}) as Record<string, number>;
        const totalElVal = Object.values(allElements).reduce((s, v) => s + (Number(v) || 0), 0);
        elVal = Math.floor(totalElVal * 0.5);
      } else if (h.element === barrierEl || h.element === "모든 원소" || h.element === "전체") {
        // Matching element uses full value
        totalBarrierDmg += elVal;
        return;
      } else if (barrierEl === "랜덤") {
        totalBarrierDmg += elVal;
        return;
      } else {
        totalBarrierDmg += h.equipmentElements?.[barrierEl] || 0;
        return;
      }
      totalBarrierDmg += elVal;
    });

    // Rudo barrier bonus starts at tier 3.
    if ((champName.includes("루도") || champName === "Rudo") && champTier >= 3) {
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
      berserkHp1.push(0.8);
      berserkHp2.push(0.55);
      berserkHp3.push(0.3);
    } else {
      berserkHp1.push(0.75);
      berserkHp2.push(0.5);
      berserkHp3.push(0.25);
    }
  }

  // ─── Rudo initial crit bonus ───
  let rudoBonusBase = 0;
  let rudoRounds = 0;
  if (champName.includes("루도") || champName === "Rudo") {
    if (champTier === 1) {
      rudoBonusBase = 0.3;
      rudoRounds = 2;
    } else if (champTier === 2) {
      rudoBonusBase = 0.4;
      rudoRounds = 2;
    } else if (champTier === 3) {
      rudoBonusBase = 0.5;
      rudoRounds = 3;
    } else if (champTier === 4) {
      rudoBonusBase = 0.5;
      rudoRounds = 4;
    }
    // Mercenary bonus
    if (heroIsMercenary[championIdx]) {
      rudoBonusBase *= 1.25;
    }
  }

  // ─── Lilu heal amount ───
  // Lilu heal: FLAT amount per hero per round (NOT percentage)
  let liluHealFlat = 0;
  if (champName.includes("릴루") || champName === "Lilu") {
    if (champTier === 1) liluHealFlat = 3;
    else if (champTier === 2) liluHealFlat = 5;
    else if (champTier === 3) liluHealFlat = 10;
    else if (champTier === 4) liluHealFlat = 20;
  }

  // ─── Hemma self heal amount (per drain) ───
  // T1=5, T2=10, T3=15, T4=25
  let hemmaSelfHealFlat = 0;
  if (champName.includes("헴마") || champName === "Hemma") {
    if (champTier === 1) hemmaSelfHealFlat = 5;
    else if (champTier === 2) hemmaSelfHealFlat = 10;
    else if (champTier === 3) hemmaSelfHealFlat = 15;
    else if (champTier === 4) hemmaSelfHealFlat = 25;
  }

  // ─── Simulation ──────────────────────────────────────────────────────────

  // ─── recordEvents: setup events (emitted once, before any sim loop) ───
  if (recordEvents) {
    // Barrier result
    if (monster.barrier && monster.barrier.hp > 0 && monster.barrierElement) {
      let totalEl = 0;
      activeHeroes.forEach((h) => {
        const isSpellKnight = isClass(h, "마법검", "스펠나이트", "Spellblade", "Spellknight");
        if (isSpellKnight) {
          const allElements = (h.equipmentElements || {}) as Record<string, number>;
          const totalElVal = Object.values(allElements).reduce((s, v) => s + (Number(v) || 0), 0);
          totalEl += Math.floor(totalElVal * 0.5);
        } else {
          totalEl += h.equipmentElements?.[monster.barrierElement!] || 0;
        }
      });
      if ((champName.includes("루도") || champName === "Rudo") && champTier >= 3) totalEl = Math.round(totalEl * 1.5);
      if (totalEl < monster.barrier.hp) {
        pushEv({
          round: 0,
          type: "event",
          actor: "시스템",
          detail: `원소 배리어 미돌파! 대미지 ${barrierMod * 100}%로 제한 (아군 ${totalEl.toLocaleString()} / 필요 ${monster.barrier.hp.toLocaleString()})`,
          values: { heroSum: totalEl, required: monster.barrier.hp },
        });
      } else {
        pushEv({
          round: 0,
          type: "event",
          actor: "시스템",
          detail: `원소 배리어 돌파! (아군 ${totalEl.toLocaleString()} ≥ 필요 ${monster.barrier.hp.toLocaleString()})`,
        });
      }
    }
    // Mini boss label
    if (miniBoss && miniBoss !== "none") {
      // 미니보스별 실제 효과만 표시
      const miniBossEffects: string[] = [];
      if (mobHpMod !== 1) miniBossEffects.push(`HP ×${mobHpMod} (→ ${formatNum(mobHp)})`);
      if (mobDamageMod !== 1) miniBossEffects.push(`ATK ×${mobDamageMod}`);
      if (mobCritChanceMod !== 1)
        miniBossEffects.push(
          `치확 ×${mobCritChanceMod} (→ ${Math.round(baseMobCritChance * mobCritChanceMod * 100)}%)`,
        );
      if (mobEvasion >= 0) miniBossEffects.push(`회피 ${Math.round(mobEvasion * 100)}%`);
      if (mobAoeChanceMod !== 1) miniBossEffects.push(`광역 확률 ×${mobAoeChanceMod}`);
      pushEv({
        round: 0,
        type: "event",
        actor: "시스템",
        detail: `미니보스 [${miniBossLabel}]: ${miniBossEffects.join(", ")}`,
        values: { miniBossLabel: miniBossLabel as any, mobHpMod, mobDamageMod },
      });
    }
    // Hero initial stats
    for (let i = 0; i < numHeroes; i++) {
      const h = activeHeroes[i];
      pushEv({
        round: 0,
        type: "stat",
        actor: h.name || `영웅 ${i + 1}`,
        detail: `초기 스탯: ATK ${Math.round(finalAtk[i]).toLocaleString()} / DEF ${Math.round(finalDef[i]).toLocaleString()} / HP ${Math.round(finalHp[i]).toLocaleString()} / 치확 ${Math.round(heroCritChance[i] * 100)}% / 치댐 ${Math.round(finalAtk[i] * heroCritMult[i]).toLocaleString()} / 회피 ${Math.round(heroEvasion[i] * 100)}%`,
        values: { atk: Math.round(finalAtk[i]), def: Math.round(finalDef[i]), hp: Math.round(finalHp[i]) },
      });
    }
    // Monster stats
    pushEv({
      round: 0,
      type: "stat",
      actor: mobDisplayName,
      detail: `몬스터 스탯: HP ${mobHp.toLocaleString()} / ATK ${mobDamage.toLocaleString()} / 치확 ${Math.round(baseMobCritChance * mobCritChanceMod * 100)}% / AoE확 ${Math.round(mobAoeChance * 100)}%`,
      values: { hp: mobHp, atk: mobDamage },
    });
  }

  let timesQuestWon = 0;
  let roundsAvg = 0,
    roundsMin = 1000,
    roundsMax = 0;
  let roundLimitTimes = 0;
  // Win/loss round tracking
  let winRoundsSum = 0,
    winRoundsMin = 1000,
    winRoundsMax = 0;
  let loseRoundsSum = 0,
    loseRoundsMin = 1000,
    loseRoundsMax = 0,
    loseCount = 0;

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
  // Per-sim min/max for single-only and aoe-only taken (across all sims)
  const singleDmgTakenMin = new Float64Array(numHeroes).fill(1e9);
  const singleDmgTakenMax = new Float64Array(numHeroes);
  const singleDmgTakenSimCount = new Float64Array(numHeroes); // sims hero took at least one single hit
  const aoeDmgTakenMin = new Float64Array(numHeroes).fill(1e9);
  const aoeDmgTakenMax = new Float64Array(numHeroes);
  const aoeDmgTakenSimCount = new Float64Array(numHeroes);
  // Per-turn taken min/max across sims
  const dmgTakenPerTurnMin = new Float64Array(numHeroes).fill(1e9);
  const dmgTakenPerTurnMax = new Float64Array(numHeroes);
  // Per-hit damage DEALT min/max across all attack logs (one entry per attack action)
  const dmgPerHitMin = new Float64Array(numHeroes).fill(1e18);
  const dmgPerHitMax = new Float64Array(numHeroes);
  const winDmgPerHitMin = new Float64Array(numHeroes).fill(1e18);
  const winDmgPerHitMax = new Float64Array(numHeroes);
  const loseDmgPerHitMin = new Float64Array(numHeroes).fill(1e18);
  const loseDmgPerHitMax = new Float64Array(numHeroes);
  // Per-hero attack-action count (overall + per-fight for win/lose bucketing)
  const attackCountTotal = new Float64Array(numHeroes);
  const winAttackCount = new Float64Array(numHeroes);
  const loseAttackCount = new Float64Array(numHeroes);
  // Avg-when-hit counters (sims where this hero took damage of that kind)
  const totalDmgTakenHitSims = new Float64Array(numHeroes);
  const singleDmgTakenHitSims = new Float64Array(numHeroes);
  const aoeDmgTakenHitSims = new Float64Array(numHeroes);
  const winTotalDmgTakenHitSims = new Float64Array(numHeroes);
  const winSingleDmgTakenHitSims = new Float64Array(numHeroes);
  const winAoeDmgTakenHitSims = new Float64Array(numHeroes);
  const loseTotalDmgTakenHitSims = new Float64Array(numHeroes);
  const loseSingleDmgTakenHitSims = new Float64Array(numHeroes);
  const loseAoeDmgTakenHitSims = new Float64Array(numHeroes);
  // Single-attack hit type counts (across all sims)
  const singleNormalHitsTotal = new Float64Array(numHeroes);
  const singleCritHitsTotal = new Float64Array(numHeroes);
  // Sims where lord protected this hero at least once
  const lordProtectedSims = new Float64Array(numHeroes);
  // Win-only HP remaining distribution (per-sim per-hero, win sims only)
  const winHpRemainMin = new Float64Array(numHeroes).fill(1e9);
  const winHpRemainMax = new Float64Array(numHeroes);
  // Lose-only & overall HP remaining tracking
  const loseHpRemainMin = new Float64Array(numHeroes).fill(1e9);
  const loseHpRemainMax = new Float64Array(numHeroes);
  const overallHpRemainMin = new Float64Array(numHeroes).fill(1e9);
  const overallHpRemainMax = new Float64Array(numHeroes);
  const overallHpRemainSum = new Float64Array(numHeroes);
  const overallHpRemainCount = new Float64Array(numHeroes);
  // Berserker per-stage attack/evade counts (single+aoe targeting) — stages 0..3
  const brkStageTargeted = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  const brkStageEvaded = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  // Berserker per-stage damage dealt (normal/crit) accumulators — stages 0..3
  const brkStageNormalDmg = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  const brkStageCritDmg = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  // Per-stage round count (across all sims) — used for stage rate% (sums to 100%)
  const brkStageRounds = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  const brkTotalRounds = new Float64Array(numHeroes);
  // Per-stage attack counts (normal/crit) for averaging dmg per hit
  const brkStageNormalCount = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  const brkStageCritCount = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  // Alive-turns tracking (overall/win/lose) per-sim per-hero
  const aliveTurnsSum = new Float64Array(numHeroes);
  const aliveTurnsMin = new Float64Array(numHeroes).fill(1e9);
  const aliveTurnsMax = new Float64Array(numHeroes);
  const winAliveTurnsSum = new Float64Array(numHeroes);
  const winAliveTurnsMin = new Float64Array(numHeroes).fill(1e9);
  const winAliveTurnsMax = new Float64Array(numHeroes);
  const loseAliveTurnsSum = new Float64Array(numHeroes);
  const loseAliveTurnsMin = new Float64Array(numHeroes).fill(1e9);
  const loseAliveTurnsMax = new Float64Array(numHeroes);
  // Round-limit-alive count (per hero)
  const roundLimitAliveCount = new Float64Array(numHeroes);
  // Hemma drain tracking per-ally (drained by hemma)
  const hemmaAbsorbedDmgAccum = new Float64Array(numHeroes);
  const hemmaAbsorbedCountAccum = new Float64Array(numHeroes);
  // Lord-saved tracking per protected ally (single/aoe)
  const lordSavedSingleDmgAccum = new Float64Array(numHeroes);
  const lordSavedAoeDmgAccum = new Float64Array(numHeroes);
  // Conqueror stack accumulators (stacks 0..4) — per attacking turn
  const conqStackTurns = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  const conqStackCritDmgAccum = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  const conqStackCritCount = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  const conqStackResetCount = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  const conqStackAttackCount = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  const conqStackTotalDmgAccum = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  // # of sims in which this hero made at least one attack at stack s — used as
  // the per-stack avg-damage denominator so stacks the hero never reached are
  // not diluted by sims they never participated in.
  const conqStackSimsWithStack = [
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
    new Float64Array(numHeroes),
  ];
  // Sum of baseHeroDmg (pre-crit, pre-barrier) per attack, used for theoretical crit reference
  const baseAtkSumTotal = new Float64Array(numHeroes);
  // Ninja/Sensei innate tracking
  const innateLossAccum = new Float64Array(numHeroes);
  const innateRegenAccum = new Float64Array(numHeroes);
  const withInnateDmgAccum = new Float64Array(numHeroes);
  const withoutInnateDmgAccum = new Float64Array(numHeroes);
  // Polonia loot accumulators
  const poloniaStolenAccum = new Float64Array(numHeroes); // per-hero across sims
  let poloniaTotAcrossSims = 0;
  let poloniaMinPerSim = Infinity;
  let poloniaMaxPerSim = 0;
  let poloniaCapHits = 0;

  // Per-sim party-level aggregates (sum across heroes per sim → distribution)
  // We'll track sums/min/max across sims for: party damage dealt, party damage taken
  let partyDmgSum = 0,
    partyDmgSqSum = 0;
  let partyDmgMin = Infinity,
    partyDmgMax = 0;
  let partyTakenSum = 0;
  let partyTakenMin = Infinity,
    partyTakenMax = 0;
  let partyDmgPerTurnSum = 0,
    partyDmgPerTurnMin = Infinity,
    partyDmgPerTurnMax = 0;
  let partyTakenPerTurnSum = 0,
    partyTakenPerTurnMin = Infinity,
    partyTakenPerTurnMax = 0;
  let partySimCount = 0;
  // Win/lose bucketed party aggregates
  let winPartyDmgSum = 0,
    winPartyDmgMin = Infinity,
    winPartyDmgMax = 0;
  let winPartyTakenSum = 0,
    winPartyTakenMin = Infinity,
    winPartyTakenMax = 0;
  let winPartyDmgPerTurnSum = 0,
    winPartyDmgPerTurnMin = Infinity,
    winPartyDmgPerTurnMax = 0;
  let winPartyTakenPerTurnSum = 0,
    winPartyTakenPerTurnMin = Infinity,
    winPartyTakenPerTurnMax = 0;
  let winPartyCount = 0;
  let losePartyDmgSum = 0,
    losePartyDmgMin = Infinity,
    losePartyDmgMax = 0;
  let losePartyTakenSum = 0,
    losePartyTakenMin = Infinity,
    losePartyTakenMax = 0;
  let losePartyDmgPerTurnSum = 0,
    losePartyDmgPerTurnMin = Infinity,
    losePartyDmgPerTurnMax = 0;
  let losePartyTakenPerTurnSum = 0,
    losePartyTakenPerTurnMin = Infinity,
    losePartyTakenPerTurnMax = 0;
  let losePartyCount = 0;

  // ─── Win/Lose bucket accumulators (per-hero, per-outcome) ───
  const winDmgDealt = new Float64Array(numHeroes);
  const winNormalDmg = new Float64Array(numHeroes);
  const winCritDmg = new Float64Array(numHeroes);
  const winDmgMax = new Float64Array(numHeroes);
  const winDmgMin = new Float64Array(numHeroes).fill(1e9);
  const winRoundsArr = new Float64Array(numHeroes);
  const winDmgTaken = new Float64Array(numHeroes);
  const winDmgTakenMin = new Float64Array(numHeroes).fill(1e9);
  const winDmgTakenMax = new Float64Array(numHeroes);
  const winSingleDmgTakenAccum = new Float64Array(numHeroes);
  const winSingleDmgTakenMin = new Float64Array(numHeroes).fill(1e9);
  const winSingleDmgTakenMax = new Float64Array(numHeroes);
  const winSingleDmgTakenSimCount = new Float64Array(numHeroes);
  const winAoeDmgTakenAccum = new Float64Array(numHeroes);
  const winAoeDmgTakenMin = new Float64Array(numHeroes).fill(1e9);
  const winAoeDmgTakenMax = new Float64Array(numHeroes);
  const winAoeDmgTakenSimCount = new Float64Array(numHeroes);
  const winTimesHit = new Float64Array(numHeroes);
  const winSingleHits = new Float64Array(numHeroes);
  const winSurvived = new Float64Array(numHeroes);
  const winHpRemain = new Float64Array(numHeroes);
  const winTargeted = new Float64Array(numHeroes);
  const winEvaded = new Float64Array(numHeroes);
  const winHealingAccum = new Float64Array(numHeroes);
  const winCritSurvivals = new Float64Array(numHeroes);
  const winHemmaAbsorbedDmgAccum = new Float64Array(numHeroes);
  const winHemmaAbsorbedCountAccum = new Float64Array(numHeroes);
  let winSimCountForHero = 0;

  const loseDmgDealt = new Float64Array(numHeroes);
  const loseNormalDmg = new Float64Array(numHeroes);
  const loseCritDmg = new Float64Array(numHeroes);
  const loseDmgMax = new Float64Array(numHeroes);
  const loseDmgMin = new Float64Array(numHeroes).fill(1e9);
  const loseRoundsArr = new Float64Array(numHeroes);
  const loseDmgTaken = new Float64Array(numHeroes);
  const loseDmgTakenMin = new Float64Array(numHeroes).fill(1e9);
  const loseDmgTakenMax = new Float64Array(numHeroes);
  const loseSingleDmgTakenAccum = new Float64Array(numHeroes);
  const loseSingleDmgTakenMin = new Float64Array(numHeroes).fill(1e9);
  const loseSingleDmgTakenMax = new Float64Array(numHeroes);
  const loseSingleDmgTakenSimCount = new Float64Array(numHeroes);
  const loseAoeDmgTakenAccum = new Float64Array(numHeroes);
  const loseAoeDmgTakenMin = new Float64Array(numHeroes).fill(1e9);
  const loseAoeDmgTakenMax = new Float64Array(numHeroes);
  const loseAoeDmgTakenSimCount = new Float64Array(numHeroes);
  const loseTimesHit = new Float64Array(numHeroes);
  const loseSingleHits = new Float64Array(numHeroes);
  const loseHpRemain = new Float64Array(numHeroes);
  const loseTargeted = new Float64Array(numHeroes);
  const loseEvaded = new Float64Array(numHeroes);
  const loseHealingAccum = new Float64Array(numHeroes);
  const loseCritSurvivals = new Float64Array(numHeroes);
  const loseHemmaAbsorbedDmgAccum = new Float64Array(numHeroes);
  const loseHemmaAbsorbedCountAccum = new Float64Array(numHeroes);
  // Hemma attack-bonus gain accumulator (per hero, only hemma index is non-zero)
  const hemmaAtkGainAccum = new Float64Array(numHeroes);
  const winHemmaAtkGainAccum = new Float64Array(numHeroes);
  const loseHemmaAtkGainAccum = new Float64Array(numHeroes);
  // Rudo bonus-round damage accumulators (per hero)
  const rudoBonusDmgAccum = new Float64Array(numHeroes);
  const winRudoBonusDmgAccum = new Float64Array(numHeroes);
  const loseRudoBonusDmgAccum = new Float64Array(numHeroes);
  // Per-fight targeted/evaded snapshots
  const fightTargetedTmp = new Float64Array(numHeroes);
  const fightEvadedTmp = new Float64Array(numHeroes);

  // Tamas random range
  const isTamas = champName.includes("타마스") || champName === "Tamas";
  const tamasMin = isTamas ? (champTier < 3 ? 0.05 + 0.05 * champTier : 0.1 * champTier) : 0;
  const tamasMax = isTamas ? tamasMin * 2 : 0;

  let actualSimCount = simCount;

  for (let sim = 0; sim < actualSimCount; sim++) {
    // Per-simulation state
    const hp = new Float64Array(numHeroes);
    const damageFight = new Float64Array(numHeroes);
    const normalDmgFight = new Float64Array(numHeroes);
    const critDmgFight = new Float64Array(numHeroes);
    const simAttackCount = new Float64Array(numHeroes);
    const simBaseAtkSum = new Float64Array(numHeroes);
    const simHitMin = new Float64Array(numHeroes).fill(1e18);
    const simHitMax = new Float64Array(numHeroes);
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
    // Per-sim per-protected-ally lord saved damage (indexed by SAVED hero, not lord)
    const simLordSavedSingleDmg = new Float64Array(numHeroes);
    const simLordSavedAoeDmg = new Float64Array(numHeroes);
    // Per-sim single-attack hit type counts
    const simSingleNormalHits = new Float64Array(numHeroes);
    const simSingleCritHits = new Float64Array(numHeroes);
    // Per-sim berserker stage targeting/evasion (stage 0..3)
    const simBrkStageTargeted = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    const simBrkStageEvaded = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    // Per-sim berserker stage damage dealt (normal/crit) per hero — stages 0..3
    const simBrkStageNormalDmg = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    const simBrkStageCritDmg = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    // Per-sim berserker round counts per stage (0..3)
    const simBrkStageRounds = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    // Per-sim alive turns (last round this hero was alive)
    const simAliveTurns = new Float64Array(numHeroes);
    // Per-sim hemma drain absorbed from each ally (dmg + count)
    const simHemmaAbsorbedDmg = new Float64Array(numHeroes);
    const simHemmaAbsorbedCount = new Float64Array(numHeroes);
    // Per-sim healing accum (per hero) and crit-survival firings
    const simHealing = new Float64Array(numHeroes);
    const simCritSurvivals = new Float64Array(numHeroes);
    // Per-sim hemma atk-bonus gain (only hemma index used)
    const simHemmaAtkGain = new Float64Array(numHeroes);
    const simRudoBonusDmg = new Float64Array(numHeroes);
    // Per-sim conqueror stack metrics
    const simConqStackTurns = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    const simConqStackCritDmgAccum = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    const simConqStackCritCount = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    const simConqStackResetCount = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    const simConqStackAttackCount = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    const simConqStackTotalDmgAccum = [
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
      new Float64Array(numHeroes),
    ];
    // Per-sim innate (ninja/sensei) tracking
    const simInnateLossCount = new Float64Array(numHeroes);
    const simInnateRegenCount = new Float64Array(numHeroes);
    const simWithInnateDmg = new Float64Array(numHeroes);
    const simWithoutInnateDmg = new Float64Array(numHeroes);
    // Track previous-round innate state per hero (1 if had bonus at start of round)
    const prevInnateActive = new Uint8Array(numHeroes);
    // Per-sim Polonia loot tracking (per attacker)
    const simPoloniaStolen = new Float64Array(numHeroes);

    let rudoBonus = rudoBonusBase;
    let tamasBonus = isTamas ? tamasMin + Math.random() * (tamasMax - tamasMin) : 0;

    for (let i = 0; i < numHeroes; i++) {
      hp[i] = finalHp[i];

      // Backfire Hammer
      const hasBackfire = activeHeroes[i].equipmentSlots?.some((s) => s.item?.name === "백파이어 해머") || false;
      if (hasBackfire) hp[i] = 0.75 * finalHp[i];

      surviveChance[i] = heroArmadillo[i] / 100;
      if (heroIsCleric[i] || heroIsBishop[i]) surviveChance[i] = 1.2; // Always survives first fatal blow

      if (heroIsNinja[i] || heroIsSensei[i]) {
        ninjaBonus[i] = 0.1 + Math.min(heroTier[i], 4) * 0.1;
        ninjaEvasion[i] = heroTier[i] >= 4 ? 0.25 : heroTier[i] >= 3 ? 0.2 : 0.15;
        prevInnateActive[i] = 1;
      }
      if (heroIsDaimyo[i]) guaranteedEvade[i] = 1;
      if (hp[i] > 0) simAliveTurns[i] = 0; // will be incremented per round below
    }

    let mobHpCurrent = mobHp;
    let heroesAlive = numHeroes;
    let updateTarget = true;
    let round = 0;
    let sharkActive = 0;
    let dinosaurActive = 1;
    let lordSave = true;
    let contFight = true;
    // prevBerserkerStage: only needed when recording events
    const prevBerserkerStage = recordEvents ? new Int8Array(numHeroes) : null;

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
          ninjaEvasion[i] = heroTier[i] >= 4 ? 0.25 : heroTier[i] >= 3 ? 0.2 : 0.15;
          simInnateRegenCount[i]++;
          if (recordEvents) {
            pushEv({
              round,
              type: "event",
              actor: activeHeroes[i].name || `영웅 ${i + 1}`,
              detail: `센세 고유 스킬 회복! 치확/회피 복구 (2턴 경과)`,
            });
          }
        }
      }
      // Snapshot innate state for hero-attack damage attribution
      for (let i = 0; i < numHeroes; i++) {
        if (heroIsNinja[i] || heroIsSensei[i]) {
          prevInnateActive[i] = ninjaBonus[i] > 0 ? 1 : 0;
        }
      }
      // Increment alive turns for any hero alive at start of this round
      for (let i = 0; i < numHeroes; i++) {
        if (hp[i] > 0) simAliveTurns[i] = round;
      }

      // ─── Negative-evasion crit bonus ───
      // External script applies this ONLY in Extreme mode (Extreme difficulty / Terror Tower scary zones).
      const extremeCritBonus = new Float64Array(numHeroes);
      if (isExtreme) {
        for (let i = 0; i < numHeroes; i++) {
          const totalEva = heroEvasion[i] + berserkerStage[i] * 0.1 + ninjaEvasion[i];
          if (totalEva < 0 && !heroArtNoEvasion[i]) {
            extremeCritBonus[i] = Math.min(-0.25 * totalEva, 0.05);
          }
        }
      }

      // ─── 선행 이벤트: 다이묘/사무라이 확정 회피+치명타, 공룡 보너스 (몬스터 공격 전) ───
      if (round === 1) {
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] <= 0) continue;
          if (heroIsSamurai[i] || heroIsDaimyo[i]) {
            if (recordEvents) {
              pushEv({
                round,
                type: "event",
                actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                detail: `${heroIsDaimyo[i] ? "다이묘" : "사무라이"} 고유 스킬: 첫 턴 확정 회피 + 확정 치명타`,
              });
            }
          }
          if (heroDinosaur[i] > 0) {
            if (recordEvents) {
              pushEv({
                round,
                type: "event",
                actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                detail: `공룡 영혼: 첫 턴 +${heroDinosaur[i]}% 공격력 보너스 적용`,
              });
            }
          }
        }
      }

      // ─── Monster attacks ───
      const isAoe = Math.random() < mobAoeChance && heroesAlive > 1;

      if (isAoe) {
        if (recordEvents) {
          pushEv({
            round,
            type: "monster_attack",
            actor: "몬스터",
            detail: `광역 공격 발동! (확률 ${Math.round(mobAoeChance * 100)}%)`,
          });
        }

        // AoE attack hits all alive heroes
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] <= 0) continue;
          timesTargeted[i]++;
          simTargeted[i]++;
          // Berserker stage targeting (0..3)
          const bStage = berserkerStage[i];
          if (heroBerserkerLevel[i] > 0) simBrkStageTargeted[bStage][i]++;

          const totalEva = heroEvasion[i] + berserkerStage[i] * 0.1 + ninjaEvasion[i];
          const cappedEva = Math.min(totalEva, heroEvaCap[i]);

          if (guaranteedEvade[i] || (Math.random() < cappedEva && !heroArtNoEvasion[i])) {
            // Evaded
            timesEvaded[i]++;
            simEvaded[i]++;
            if (heroBerserkerLevel[i] > 0) simBrkStageEvaded[bStage][i]++;
            if (heroIsDancer[i]) guaranteedCrit[i] = 1;
            if (recordEvents) {
              pushEv({
                round,
                type: "dodge",
                actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                detail: `[광역] 회피`,
                values: { hp: Math.round(hp[i]), maxHp: Math.round(finalHp[i]) },
              });
            }
          } else {
            // Hit - AoE uses normal damage × aoe ratio (AoE has NO crit)
            const dmg = Math.ceil(damageTaken[i] * mobAoeDmgRatio);
            hp[i] -= dmg;
            simDmgTaken[i] += dmg;
            simAoeDmgTaken[i] += dmg;
            simTimesHit[i]++;

            if (hp[i] <= 0) {
              const survived = handleFatalBlow(i, dmg);
              if (survived) {
                // Damage nullified by crit survival — reverse received-damage tracking
                simDmgTaken[i] -= dmg;
                simAoeDmgTaken[i] -= dmg;
                if (recordEvents) {
                  pushEv({
                    round,
                    type: "survive",
                    actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                    detail: `치명타 생존 발동! 대미지 무시`,
                    values: { dmg, hp: Math.round(hp[i]), maxHp: Math.round(finalHp[i]) },
                  });
                }
              } else {
                // Lord save check (lords cannot protect lords)
                if (lordPresent && lordSave && !heroIsLord[i] && hp[lordHero] > 0) {
                  lordSave = false;
                  lordProtections[i]++;
                  simLordAoeSaved[i]++;
                  hp[i] += dmg; // Restore this hero
                  // Lord save absorbed the hit — reverse received-damage tracking for the saved hero
                  simDmgTaken[i] -= dmg;
                  simAoeDmgTaken[i] -= dmg;
                  // New lord absorb: random pick between monster raw aoe atk and ally's actual taken (non-crit) dmg, never below monster raw
                  const monRaw = Math.round(mobDamage * mobAoeDmgRatio);
                  const allyDmg = Math.ceil(damageTaken[i] * mobAoeDmgRatio); // ally non-crit (AoE has no crit)
                  const randPick = Math.random() < 0.5 ? monRaw : allyDmg;
                  const lordDmg = Math.max(monRaw, randPick);
                  simLordAbsorbedAoe[lordHero] += lordDmg;
                  simLordSavedAoeDmg[i] += lordDmg;
                  hp[lordHero] -= lordDmg;
                  if (recordEvents) {
                    pushEv({
                      round,
                      type: "lord_save",
                      actor: activeHeroes[lordHero].name || `영웅 ${lordHero + 1}`,
                      target: activeHeroes[i].name,
                      detail: `군주 ${activeHeroes[i].name} 대신 맞음! ${formatNum(lordDmg)} 피해 흡수 (군주 HP: ${formatNum(Math.max(0, hp[lordHero]))})`,
                      values: {
                        dmg: Math.round(lordDmg),
                        hp: Math.round(Math.max(0, hp[lordHero])),
                        maxHp: Math.round(finalHp[lordHero]),
                      },
                    });
                  }

                  if (hp[lordHero] <= 0) {
                    if (!handleFatalBlow(lordHero, lordDmg)) {
                      hp[lordHero] = 0;
                      heroesAlive--;
                      updateTarget = true;
                      if (recordEvents) {
                        pushEv({
                          round,
                          type: "death",
                          actor: activeHeroes[lordHero].name || `영웅 ${lordHero + 1}`,
                          detail: `사망 (군주 희생)`,
                          values: { hp: 0, maxHp: Math.round(finalHp[lordHero]) },
                        });
                      }
                    }
                  }
                } else {
                  // Cap received damage to remaining HP (no overkill counted)
                  const overkill = -hp[i];
                  if (overkill > 0) {
                    simDmgTaken[i] -= overkill;
                    simAoeDmgTaken[i] -= overkill;
                  }
                  hp[i] = 0;
                  heroesAlive--;
                  updateTarget = true;
                  if (recordEvents) {
                    pushEv({
                      round,
                      type: "death",
                      actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                      detail: `사망 [광역] (${Math.round(dmg).toLocaleString()} 피해)`,
                      values: { dmg, hp: 0, maxHp: Math.round(finalHp[i]) },
                    });
                  }
                }
              }
            } else {
              if (recordEvents) {
                pushEv({
                  round,
                  type: "damage",
                  actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                  detail: `[광역] ${Math.round(dmg).toLocaleString()} 피해`,
                  values: { dmg, hp: Math.round(hp[i]), maxHp: Math.round(finalHp[i]) },
                });
              }
            }
            // Sensei loses innate when hit
            if (heroIsSensei[i] && lostInnate[i] !== round - 1) {
              lostInnate[i] = round;
              if (recordEvents) {
                const nB = 0.1 + Math.min(heroTier[i], 4) * 0.1;
                const nE = heroTier[i] >= 4 ? 0.25 : heroTier[i] >= 3 ? 0.2 : 0.15;
                pushEv({
                  round,
                  type: "event",
                  actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                  detail: `피격! 센세 고유 스킬 소실 (치확 -${Math.round(nB * 100)}%, 회피 -${Math.round(nE * 100)}%) — 2턴 후 회복`,
                });
              }
            }
            if (heroIsNinja[i] && hp[i] < finalHp[i] && ninjaBonus[i] > 0) {
              if (recordEvents) {
                const nB = ninjaBonus[i];
                const nE = ninjaEvasion[i];
                pushEv({
                  round,
                  type: "event",
                  actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                  detail: `피격! 닌자 고유 스킬 소실 (치확 -${Math.round(nB * 100)}%, 회피 -${Math.round(nE * 100)}%)`,
                });
              }
            }
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
            if (hp[i] > 0) {
              target = i;
              break;
            }
          }
        }

        timesTargeted[target]++;
        simTargeted[target]++;
        // Berserker stage targeting (0..3)
        const bStageT = berserkerStage[target];
        if (heroBerserkerLevel[target] > 0) simBrkStageTargeted[bStageT][target]++;

        const totalEva = heroEvasion[target] + berserkerStage[target] * 0.1 + ninjaEvasion[target];
        const cappedEva = Math.min(totalEva, heroEvaCap[target]);

        if (guaranteedEvade[target] || (Math.random() < cappedEva && !heroArtNoEvasion[target])) {
          timesEvaded[target]++;
          simEvaded[target]++;
          if (heroBerserkerLevel[target] > 0) simBrkStageEvaded[bStageT][target]++;
          if (heroIsDancer[target]) guaranteedCrit[target] = 1;
          if (recordEvents) {
            pushEv({
              round,
              type: "dodge",
              actor: activeHeroes[target].name || `영웅 ${target + 1}`,
              detail: `[단일] 회피`,
              values: { hp: Math.round(hp[target]), maxHp: Math.round(finalHp[target]) },
            });
          }
        } else {
          const isCrit = Math.random() < baseMobCritChance * mobCritChanceMod + extremeCritBonus[target];
          const dmg = isCrit ? critDamageTaken[target] : damageTaken[target];
          hp[target] -= dmg;
          simDmgTaken[target] += dmg;
          simSingleDmgTaken[target] += dmg;
          simTimesHit[target]++;
          singleHitsTaken[target]++;
          // Track single-attack hit type counts
          if (isCrit) simSingleCritHits[target]++;
          else simSingleNormalHits[target]++;

          if (hp[target] <= 0) {
            const survived = handleFatalBlow(target, dmg);
            if (survived) {
              // Damage nullified by crit survival — reverse received-damage tracking
              simDmgTaken[target] -= dmg;
              simSingleDmgTaken[target] -= dmg;
              if (recordEvents) {
                pushEv({
                  round,
                  type: "survive",
                  actor: activeHeroes[target].name || `영웅 ${target + 1}`,
                  detail: `치명타 생존 발동! 대미지 무시`,
                  values: { dmg, hp: Math.round(hp[target]), maxHp: Math.round(finalHp[target]) },
                });
              }
            } else {
              if (lordPresent && lordSave && !heroIsLord[target] && hp[lordHero] > 0) {
                lordSave = false;
                lordProtections[target]++;
                simLordSingleSaved[target]++;
                singleHitsTaken[target]--;
                singleHitsTaken[lordHero]++;
                hp[target] += dmg;
                // Lord save absorbed the hit — reverse received-damage tracking for the saved hero
                simDmgTaken[target] -= dmg;
                simSingleDmgTaken[target] -= dmg;
                // New lord absorb: random pick between monster raw atk and ally's actual taken (non-crit) dmg, never below monster raw
                const monRaw = mobDamage;
                const allyDmg = damageTaken[target]; // ally normal (non-crit) taken
                const randPick = Math.random() < 0.5 ? monRaw : allyDmg;
                const lordDmg = Math.max(monRaw, randPick);
                simLordAbsorbedSingle[lordHero] += lordDmg;
                simLordSavedSingleDmg[target] += lordDmg;
                hp[lordHero] -= lordDmg;
                if (recordEvents) {
                  pushEv({
                    round,
                    type: "lord_save",
                    actor: activeHeroes[lordHero].name || `영웅 ${lordHero + 1}`,
                    target: activeHeroes[target].name,
                    detail: `군주 ${activeHeroes[target].name} 대신 맞음! ${formatNum(lordDmg)} 피해 흡수 (군주 HP: ${formatNum(Math.max(0, hp[lordHero]))})`,
                    values: {
                      dmg: Math.round(lordDmg),
                      hp: Math.round(Math.max(0, hp[lordHero])),
                      maxHp: Math.round(finalHp[lordHero]),
                    },
                  });
                }

                if (hp[lordHero] <= 0) {
                  if (!handleFatalBlow(lordHero, lordDmg)) {
                    hp[lordHero] = 0;
                    heroesAlive--;
                    updateTarget = true;
                    if (recordEvents) {
                      pushEv({
                        round,
                        type: "death",
                        actor: activeHeroes[lordHero].name || `영웅 ${lordHero + 1}`,
                        detail: `사망 (군주 희생)`,
                        values: { hp: 0, maxHp: Math.round(finalHp[lordHero]) },
                      });
                    }
                  }
                }
              } else {
                // Cap received damage to remaining HP (no overkill counted)
                const overkill = -hp[target];
                if (overkill > 0) {
                  simDmgTaken[target] -= overkill;
                  simSingleDmgTaken[target] -= overkill;
                }
                hp[target] = 0;
                heroesAlive--;
                updateTarget = true;
                if (recordEvents) {
                  pushEv({
                    round,
                    type: "death",
                    actor: activeHeroes[target].name || `영웅 ${target + 1}`,
                    detail: `사망 [단일${isCrit ? " 치명" : ""}] (${Math.round(dmg).toLocaleString()} 피해)`,
                    values: { dmg, hp: 0, maxHp: Math.round(finalHp[target]) },
                  });
                }
              }
            }
          } else {
            if (recordEvents) {
              pushEv({
                round,
                type: "damage",
                actor: activeHeroes[target].name || `영웅 ${target + 1}`,
                detail: `[단일${isCrit ? " 치명" : ""}] ${Math.round(dmg).toLocaleString()} 피해`,
                values: { dmg, hp: Math.round(hp[target]), maxHp: Math.round(finalHp[target]) },
              });
            }
          }
          if (heroIsSensei[target] && lostInnate[target] !== round - 1) {
            lostInnate[target] = round;
            if (recordEvents) {
              const nB = 0.1 + Math.min(heroTier[target], 4) * 0.1;
              const nE = heroTier[target] >= 4 ? 0.25 : heroTier[target] >= 3 ? 0.2 : 0.15;
              pushEv({
                round,
                type: "event",
                actor: activeHeroes[target].name || `영웅 ${target + 1}`,
                detail: `피격! 센세 고유 스킬 소실 (치확 -${Math.round(nB * 100)}%, 회피 -${Math.round(nE * 100)}%) — 2턴 후 회복`,
              });
            }
          }
          if (heroIsNinja[target] && hp[target] < finalHp[target] && ninjaBonus[target] > 0) {
            if (recordEvents) {
              const nB = ninjaBonus[target];
              const nE = ninjaEvasion[target];
              pushEv({
                round,
                type: "event",
                actor: activeHeroes[target].name || `영웅 ${target + 1}`,
                detail: `피격! 닌자 고유 스킬 소실 (치확 -${Math.round(nB * 100)}%, 회피 -${Math.round(nE * 100)}%)`,
              });
            }
          }
        }
      }

      // ─── Hemma drain ───
      if (hemmaWho >= 0 && hp[hemmaWho] > 0) {
        let drainTarget = -1;
        const drainThreshold = 0.11 - 0.01 * champTier;
        for (let i = 0; i < numHeroes; i++) {
          if (i !== hemmaWho && hp[i] > drainThreshold * finalHp[i]) {
            if (drainTarget === -1 || hp[i] / finalHp[i] > hp[drainTarget] / finalHp[drainTarget]) {
              drainTarget = i;
            }
          }
        }
        if (drainTarget >= 0) {
          const drainAmt = drainThreshold * finalHp[drainTarget];
          hp[drainTarget] -= drainAmt;
          // Track per-ally drain absorbed
          simHemmaAbsorbedDmg[drainTarget] += drainAmt;
          simHemmaAbsorbedCount[drainTarget]++;
          if (recordEvents) {
            pushEv({
              round,
              type: "damage",
              actor: activeHeroes[drainTarget].name || `영웅 ${drainTarget + 1}`,
              detail: `헴마 드레인 ${Math.round(drainAmt)} HP 흡수`,
              values: {
                dmg: Math.round(drainAmt),
                hp: Math.round(hp[drainTarget]),
                maxHp: Math.round(finalHp[drainTarget]),
              },
            });
          }

          if (heroIsSensei[drainTarget] && lostInnate[drainTarget] !== round - 1) {
            lostInnate[drainTarget] = round;
          }
          // Hemma attack bonus: standalone ATK (with current condPct) × hemmaMult per drain.
          {
            const standaloneNoCond =
              (heroPartyAtkMult[hemmaWho] || 1) > 0
                ? finalAtk[hemmaWho] / (heroPartyAtkMult[hemmaWho] || 1)
                : heroAtkRaw[hemmaWho];
            const hCondPct =
              sharkActive * 0.01 * heroShark[hemmaWho] +
              dinosaurActive * heroDinosaur[hemmaWho] * 0.01 +
              0.1 * (1 + heroBerserkerLevel[hemmaWho]) * berserkerStage[hemmaWho];
            const standalone = standaloneNoCond + heroAtkConst[hemmaWho] * hCondPct;
            const gain = standalone * hemmaMult;
            hemmaBonus[hemmaWho] += gain;
            simHemmaAtkGain[hemmaWho] += gain;
            if (recordEvents) {
              pushEv({
                round,
                type: "event",
                actor: activeHeroes[hemmaWho].name || `영웅 ${hemmaWho + 1}`,
                detail: `헴마 ATK +${formatNum(gain)} (누적 +${formatNum(hemmaBonus[hemmaWho])})`,
              });
            }
          }
          if (hemmaSelfHealFlat > 0) {
            const hemmaHpBefore = hp[hemmaWho];
            hp[hemmaWho] = Math.min(hp[hemmaWho] + hemmaSelfHealFlat, finalHp[hemmaWho]);
            const hemmaHealed = hp[hemmaWho] - hemmaHpBefore;
            totalHealing[hemmaWho] += hemmaHealed;
            simHealing[hemmaWho] += hemmaHealed;
            if (hemmaHealed > 0) {
              if (recordEvents) {
                pushEv({
                  round,
                  type: "heal",
                  actor: activeHeroes[hemmaWho].name || `영웅 ${hemmaWho + 1}`,
                  detail: `헴마 자기 회복`,
                  values: {
                    heal: Math.round(hemmaHealed),
                    hp: Math.round(hp[hemmaWho]),
                    maxHp: Math.round(finalHp[hemmaWho]),
                  },
                });
              }
            }
          }
        }
      }

      // ─── Berserker stage update ───
      for (let i = 0; i < numHeroes; i++) {
        if (heroBerserkerLevel[i] > 0 && hp[i] > 0) {
          if (hp[i] >= berserkHp1[i] * finalHp[i]) berserkerStage[i] = 0;
          else if (hp[i] >= berserkHp2[i] * finalHp[i]) {
            berserkerStage[i] = 1;
            berserkerBelowT1[i]++;
          } else if (hp[i] >= berserkHp3[i] * finalHp[i]) {
            berserkerStage[i] = 2;
            berserkerBelowT1[i]++;
            berserkerBelowT2[i]++;
          } else {
            berserkerStage[i] = 3;
            berserkerBelowT1[i]++;
            berserkerBelowT2[i]++;
            berserkerBelowT3[i]++;
          }
          // Count one round at this stage (for stage-time distribution)
          simBrkStageRounds[berserkerStage[i]][i]++;
          // Emit event on stage transition (increase only) — recordEvents only
          if (recordEvents && prevBerserkerStage && berserkerStage[i] > prevBerserkerStage[i]) {
            pushEv({
              round,
              type: "event",
              actor: activeHeroes[i].name || `영웅 ${i + 1}`,
              detail: `광전사/잘 ${berserkerStage[i]}단계 진입 (ATK/EVA 보너스 증가)`,
            });
            prevBerserkerStage[i] = berserkerStage[i];
          }
        }

        // Ninja loses innate when hit
        if (heroIsNinja[i] && hp[i] < finalHp[i]) {
          ninjaBonus[i] = 0;
          ninjaEvasion[i] = 0;
        }
        if (heroIsSensei[i] && lostInnate[i] === round) {
          ninjaBonus[i] = 0;
          ninjaEvasion[i] = 0;
        }

        // Samurai/Daimyo: guaranteed crit round 1 (이벤트는 몬스터 공격 전에 별도 출력)
        if (round === 1 && (heroIsSamurai[i] || heroIsDaimyo[i])) {
          guaranteedCrit[i] = 1;
          guaranteedEvade[i] = 0;
        }
      }

      // ─── Heroes Attack ───
      for (let ii = 0; ii < numHeroes; ii++) {
        const jj = attackOrder[ii];
        if (hp[jj] <= 0) continue;

        // Track ninja/sensei innate loss event (state transition active→inactive)
        if ((heroIsNinja[jj] || heroIsSensei[jj]) && prevInnateActive[jj] === 1 && ninjaBonus[jj] === 0) {
          simInnateLossCount[jj]++;
          prevInnateActive[jj] = 0;
        }

        // Mob evasion check
        if (mobEvasion >= 0 && Math.random() < mobEvasion) continue;

        // Tamas bonus applied to attack
        const tamasAtkMult = jj === championIdx && isTamas ? 1 + tamasBonus : 1;

        // Hero attack calculation (PDF formula)
        // Mundra is pre-folded into finalAtk for boss fights. condPct here only includes
        // turn-conditional bonuses (Shark<50%HP, Dinosaur round 1, Berserker stage).
        const condPct =
          sharkActive * 0.01 * heroShark[jj] +
          dinosaurActive * heroDinosaur[jj] * 0.01 +
          0.1 * (1 + heroBerserkerLevel[jj]) * berserkerStage[jj];
        const condBonus = heroAtkConst[jj] * condPct * (heroPartyAtkMult[jj] || 1);
        const baseHeroDmg = (finalAtk[jj] + condBonus) * tamasAtkMult + hemmaBonus[jj];

        const totalCritChance = Math.min(
          1.0,
          (heroCritChance[jj] + ninjaBonus[jj] + rudoBonus) * heroArtCritChanceMod[jj] +
            (1 - heroArtCritChanceMod[jj]) * 0.2,
        );

        const isCrit = Math.random() < totalCritChance || guaranteedCrit[jj];

        // Snapshot conqueror stack for this attack (0..4) — recordEvents only
        const preStacks =
          recordEvents && heroIsConquistador[jj] ? Math.min(4, Math.round(consecutiveCritBonus[jj] / 0.25)) : 0;
        // 정복자: 공격 전 현재 스택 표시 — recordEvents only
        if (recordEvents && heroIsConquistador[jj] && preStacks > 0) {
          pushEv({
            round,
            type: "event",
            actor: activeHeroes[jj].name || `영웅 ${jj + 1}`,
            detail: `정복자 현재 스택: ${preStacks}/4 (치명타 대미지 +${preStacks * 25}%)`,
          });
        }

        let damage: number;
        if (isCrit) {
          // 정복자: 스택을 먼저 올리고 올라간 스택 보너스로 대미지 계산
          if (heroIsConquistador[jj]) {
            consecutiveCritBonus[jj] = Math.min(consecutiveCritBonus[jj] + 0.25, 1);
          }
          const critMult = heroCritMult[jj] + consecutiveCritBonus[jj];
          // Samurai/Daimyo round 1: ignore barrier
          if (round === 1 && (heroIsSamurai[jj] || heroIsDaimyo[jj])) {
            damage = baseHeroDmg * critMult;
          } else {
            damage = baseHeroDmg * critMult * barrierMod;
          }
        } else {
          damage = baseHeroDmg * barrierMod;
          if (heroIsConquistador[jj]) {
            // Reset event at this stack
            if (preStacks > 0) simConqStackResetCount[preStacks][jj]++;
            consecutiveCritBonus[jj] = 0;
          }
        }

        mobHpCurrent -= damage;
        damageFight[jj] += damage;
        if (rudoBonus > 0) simRudoBonusDmg[jj] += damage;
        if (isCrit) critDmgFight[jj] += damage;
        else normalDmgFight[jj] += damage;
        // Per-hit (per-attack-action) tracking for min/max
        simAttackCount[jj]++;
        simBaseAtkSum[jj] += baseHeroDmg;
        if (damage > 0) {
          if (damage < dmgPerHitMin[jj]) dmgPerHitMin[jj] = damage;
          if (damage > dmgPerHitMax[jj]) dmgPerHitMax[jj] = damage;
          if (damage < simHitMin[jj]) simHitMin[jj] = damage;
          if (damage > simHitMax[jj]) simHitMax[jj] = damage;
        }
        if (recordEvents) {
          pushEv({
            round,
            type: isCrit ? "crit" : "attack",
            actor: activeHeroes[jj].name || `영웅 ${jj + 1}`,
            detail: `${isCrit ? "치명타" : "공격"} ${Math.round(damage).toLocaleString()} 피해 (몬스터 잔여 HP: ${Math.round(Math.max(mobHpCurrent, 0)).toLocaleString()})`,
            values: { dmg: Math.round(damage), mobHp: Math.round(Math.max(mobHpCurrent, 0)), mobMaxHp: mobHp },
          });
        }

        // Conqueror per-stack tracking
        // 치명타 → 스택 증가 후 값(post-increment)으로 기록, 일반 공격 → 항상 스택 0
        if (heroIsConquistador[jj]) {
          const effectiveStacks = isCrit ? Math.min(4, Math.round(consecutiveCritBonus[jj] / 0.25)) : 0;
          simConqStackTurns[effectiveStacks][jj]++;
          simConqStackAttackCount[effectiveStacks][jj]++;
          simConqStackTotalDmgAccum[effectiveStacks][jj] += damage;
          if (isCrit) {
            simConqStackCritDmgAccum[effectiveStacks][jj] += damage;
            simConqStackCritCount[effectiveStacks][jj]++;
          }
        }

        // Berserker per-stage damage tracking (stage 0..3)
        const bSt = berserkerStage[jj];
        if (heroBerserkerLevel[jj] > 0) {
          if (isCrit) {
            brkStageCritDmg[bSt][jj] += damage;
            brkStageCritCount[bSt][jj]++;
          } else {
            brkStageNormalDmg[bSt][jj] += damage;
            brkStageNormalCount[bSt][jj]++;
          }
        }

        // Ninja/Sensei with/without innate damage attribution
        if (heroIsNinja[jj] || heroIsSensei[jj]) {
          if (ninjaBonus[jj] > 0) simWithInnateDmg[jj] += damage;
          else simWithoutInnateDmg[jj] += damage;
        }

        // Dark Knight / Death Knight execute at 10% HP
        // Execution adds the monster's remaining HP (just before execute) as bonus damage to this hero's contribution.
        if (heroIsDarkKnight[jj] && mobHpCurrent > 0 && mobHpCurrent < mobHp * 0.1) {
          const execBonus = mobHpCurrent;
          mobHpCurrent = 0;
          damageFight[jj] += execBonus;
          if (isCrit) critDmgFight[jj] += execBonus;
          else normalDmgFight[jj] += execBonus;
          if (recordEvents) {
            pushEv({
              round,
              type: "execute",
              actor: activeHeroes[jj].name || `영웅 ${jj + 1}`,
              detail: `${activeHeroes[jj].heroClass ?? "죽음의기사"} 처형 발동! 잔여 HP ${formatNum(execBonus)} 즉결 처치`,
              values: { dmg: Math.round(execBonus), mobHp: 0, mobMaxHp: mobHp },
            });
          }
        }

        // Shark activates at 50% mob HP
        if (mobHpCurrent < mobHp / 2) {
          if (recordEvents && !sharkActive) {
            for (let s = 0; s < numHeroes; s++) {
              if (heroShark[s] > 0 && hp[s] > 0) {
                pushEv({
                  round,
                  type: "event",
                  actor: activeHeroes[s].name || `영웅 ${s + 1}`,
                  detail: `상어 영혼 활성화 (몬스터 HP 50% 이하, +${heroShark[s]}% 공격력)`,
                });
              }
            }
          }
          sharkActive = 1;
        }

        // Polonia loot attempt — each hero attack is a chance to steal
        if (poloniaActive && Math.random() < poloniaLootChance) {
          simPoloniaStolen[jj]++;
          if (recordEvents) {
            const totalStolen = simPoloniaStolen.reduce((s, v) => s + v, 0);
            if (recordEvents) {
              pushEv({
                round,
                type: "event",
                actor: activeHeroes[jj].name || `영웅 ${jj + 1}`,
                detail: `폴로니아 훔치기 성공! 아이템 누적 ${totalStolen}/${poloniaLootCap}`,
              });
            }
          }
        }

        // Conqueror stack change event (공격 후) — recordEvents only
        if (recordEvents && heroIsConquistador[jj]) {
          const postStacks = Math.min(4, Math.round(consecutiveCritBonus[jj] / 0.25));
          if (isCrit && postStacks > preStacks) {
            pushEv({
              round,
              type: "event",
              actor: activeHeroes[jj].name || `영웅 ${jj + 1}`,
              detail: `정복자 치명타 중첩 ${postStacks}/4 (치명타 대미지 +${postStacks * 25}%)`,
            });
          } else if (!isCrit && preStacks > 0) {
            pushEv({
              round,
              type: "event",
              actor: activeHeroes[jj].name || `영웅 ${jj + 1}`,
              detail: `정복자 스택 초기화 (${preStacks}중첩 → 0)`,
            });
          }
        }

        guaranteedCrit[jj] = 0;

        // Stop further hero attacks once the monster is dead (e.g., Dark Knight execute)
      }

      if (dinosaurActive) {
        for (let i = 0; i < numHeroes; i++) {
          if (heroDinosaur[i] > 0 && hp[i] > 0) {
            if (recordEvents) {
              pushEv({
                round,
                type: "event",
                actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                detail: `공룡 영혼 보너스 종료 (ATK -${heroDinosaur[i]}%)`,
              });
            }
          }
        }
      }
      dinosaurActive = 0; // Dinosaur only active round 1

      // ─── Rudo bonus expires ───
      if (round === rudoRounds && rudoBonus > 0) {
        if (recordEvents) {
          pushEv({
            round,
            type: "event",
            actor: champName,
            detail: `루도 리더 스킬 만료: 파티 치확 보너스 +${Math.round(rudoBonusBase * 100)}% 종료`,
          });
        }
      }
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
        if (recordEvents) {
          pushEv({ round, type: "result", actor: "시스템", detail: `승리! (${round}라운드)`, values: { round } });
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
        if (recordEvents) {
          pushEv({ round, type: "result", actor: "시스템", detail: `패배! (${round}라운드)`, values: { round } });
        }
      }

      let wasRoundLimit = false;
      if (contFight && round >= 499) {
        contFight = false;
        wasLose = true;
        wasRoundLimit = true;
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
          // Track which heroes were still alive at round limit
          if (hp[i] > 0) roundLimitAliveCount[i]++;
        }
        if (recordEvents) {
          pushEv({
            round,
            type: "result",
            actor: "시스템",
            detail: `패배 — 턴 한도 초과 (${round}턴)`,
            values: { round },
          });
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
          // Aggregate per-hit attack count
          attackCountTotal[i] += simAttackCount[i];
          baseAtkSumTotal[i] += simBaseAtkSum[i];
          totalRoundsPerHero[i] += round;
          totalDmgTakenAccum[i] += simDmgTaken[i];
          totalTimesHitAccum[i] += simTimesHit[i];
          singleTargetHitsTotal[i] += singleHitsTaken[i];
          aoeDmgTakenAccum[i] += simAoeDmgTaken[i];
          singleDmgTakenAccum[i] += simSingleDmgTaken[i];
          // Max damage taken can exceed HP when healing/regen sustains the hero across multiple hits
          const cappedDmg = simDmgTaken[i];
          const cappedSingle = simSingleDmgTaken[i];
          const cappedAoe = simAoeDmgTaken[i];
          // Include all sims (even 0-damage) in min/max distribution
          dmgTakenMin[i] = Math.min(dmgTakenMin[i], cappedDmg);
          dmgTakenMax[i] = Math.max(dmgTakenMax[i], cappedDmg);
          singleDmgTakenMin[i] = Math.min(singleDmgTakenMin[i], cappedSingle);
          singleDmgTakenMax[i] = Math.max(singleDmgTakenMax[i], cappedSingle);
          singleDmgTakenSimCount[i]++;
          aoeDmgTakenMin[i] = Math.min(aoeDmgTakenMin[i], cappedAoe);
          aoeDmgTakenMax[i] = Math.max(aoeDmgTakenMax[i], cappedAoe);
          aoeDmgTakenSimCount[i]++;
          // Per-turn dmg taken min/max (across sims)
          const perTurnTaken = round > 0 ? simDmgTaken[i] / round : 0;
          if (perTurnTaken > 0) dmgTakenPerTurnMin[i] = Math.min(dmgTakenPerTurnMin[i], perTurnTaken);
          dmgTakenPerTurnMax[i] = Math.max(dmgTakenPerTurnMax[i], perTurnTaken);
          // Avg-when-hit: count sims where this hero took damage of that kind
          if (simDmgTaken[i] > 0) totalDmgTakenHitSims[i]++;
          if (simSingleDmgTaken[i] > 0) singleDmgTakenHitSims[i]++;
          if (simAoeDmgTaken[i] > 0) aoeDmgTakenHitSims[i]++;
          lordProtectedSingle[i] += simLordSingleSaved[i];
          lordProtectedAoe[i] += simLordAoeSaved[i];
          lordAbsorbedSingle[i] += simLordAbsorbedSingle[i];
          lordAbsorbedAoe[i] += simLordAbsorbedAoe[i];
          // Sims where lord protected this hero at least once
          if (simLordSingleSaved[i] + simLordAoeSaved[i] > 0) lordProtectedSims[i]++;
          // Single-attack hit type counts (per sim)
          singleNormalHitsTotal[i] += simSingleNormalHits[i];
          singleCritHitsTotal[i] += simSingleCritHits[i];
          // Berserker stage targeting/evasion + round count (stages 0..3)
          for (let s = 0; s < 4; s++) {
            brkStageTargeted[s][i] += simBrkStageTargeted[s][i];
            brkStageEvaded[s][i] += simBrkStageEvaded[s][i];
            brkStageRounds[s][i] += simBrkStageRounds[s][i];
            brkTotalRounds[i] += simBrkStageRounds[s][i];
          }
          // Win/lose/overall HP remaining min/max (per-sim)
          const hpEnd = Math.max(hp[i], 0);
          if (hpEnd < overallHpRemainMin[i]) overallHpRemainMin[i] = hpEnd;
          if (hpEnd > overallHpRemainMax[i]) overallHpRemainMax[i] = hpEnd;
          overallHpRemainSum[i] += hpEnd;
          overallHpRemainCount[i]++;
          if (wasWin) {
            if (hpEnd < winHpRemainMin[i]) winHpRemainMin[i] = hpEnd;
            if (hpEnd > winHpRemainMax[i]) winHpRemainMax[i] = hpEnd;
          } else if (wasLose) {
            if (hpEnd < loseHpRemainMin[i]) loseHpRemainMin[i] = hpEnd;
            if (hpEnd > loseHpRemainMax[i]) loseHpRemainMax[i] = hpEnd;
          }

          // Alive turns aggregation
          const at = simAliveTurns[i];
          aliveTurnsSum[i] += at;
          if (at < aliveTurnsMin[i]) aliveTurnsMin[i] = at;
          if (at > aliveTurnsMax[i]) aliveTurnsMax[i] = at;
          if (wasWin) {
            winAliveTurnsSum[i] += at;
            if (at < winAliveTurnsMin[i]) winAliveTurnsMin[i] = at;
            if (at > winAliveTurnsMax[i]) winAliveTurnsMax[i] = at;
          } else if (wasLose) {
            loseAliveTurnsSum[i] += at;
            if (at < loseAliveTurnsMin[i]) loseAliveTurnsMin[i] = at;
            if (at > loseAliveTurnsMax[i]) loseAliveTurnsMax[i] = at;
          }

          // Hemma drain absorbed (from this ally)
          hemmaAbsorbedDmgAccum[i] += simHemmaAbsorbedDmg[i];
          hemmaAbsorbedCountAccum[i] += simHemmaAbsorbedCount[i];
          // Hemma attack-bonus gain (per-sim → cumulative)
          hemmaAtkGainAccum[i] += simHemmaAtkGain[i];
          rudoBonusDmgAccum[i] += simRudoBonusDmg[i];

          // Lord saved damage applied to this ally (when this hero was the protected one)
          lordSavedSingleDmgAccum[i] += simLordSavedSingleDmg[i];
          lordSavedAoeDmgAccum[i] += simLordSavedAoeDmg[i];

          // Conqueror per-stack
          for (let s = 0; s < 5; s++) {
            conqStackTurns[s][i] += simConqStackTurns[s][i];
            conqStackCritDmgAccum[s][i] += simConqStackCritDmgAccum[s][i];
            conqStackCritCount[s][i] += simConqStackCritCount[s][i];
            conqStackResetCount[s][i] += simConqStackResetCount[s][i];
            conqStackAttackCount[s][i] += simConqStackAttackCount[s][i];
            conqStackTotalDmgAccum[s][i] += simConqStackTotalDmgAccum[s][i];
            if (simConqStackAttackCount[s][i] > 0) conqStackSimsWithStack[s][i] += 1;
          }

          // Berserker per-stage damage is tracked directly on global accumulators

          // Innate (ninja/sensei)
          innateLossAccum[i] += simInnateLossCount[i];
          innateRegenAccum[i] += simInnateRegenCount[i];
          withInnateDmgAccum[i] += simWithInnateDmg[i];
          withoutInnateDmgAccum[i] += simWithoutInnateDmg[i];

          simPartyDmg += damageFight[i];
          simPartyTaken += simDmgTaken[i];

          // Bucket per-fight values into win or lose
          if (wasWin) {
            winDmgDealt[i] += damageFight[i];
            winNormalDmg[i] += normalDmgFight[i];
            winCritDmg[i] += critDmgFight[i];
            winDmgMax[i] = Math.max(winDmgMax[i], damageFight[i]);
            if (damageFight[i] > 0) winDmgMin[i] = Math.min(winDmgMin[i], damageFight[i]);
            // Per-hit min/max bucketed to win
            if (simHitMin[i] < 1e18 && simHitMin[i] < winDmgPerHitMin[i]) winDmgPerHitMin[i] = simHitMin[i];
            if (simHitMax[i] > winDmgPerHitMax[i]) winDmgPerHitMax[i] = simHitMax[i];
            winAttackCount[i] += simAttackCount[i];
            winRoundsArr[i] += round;
            winDmgTaken[i] += simDmgTaken[i];
            winDmgTakenMin[i] = Math.min(winDmgTakenMin[i], cappedDmg);
            winDmgTakenMax[i] = Math.max(winDmgTakenMax[i], cappedDmg);
            if (simDmgTaken[i] > 0) winTotalDmgTakenHitSims[i]++;
            winSingleDmgTakenAccum[i] += simSingleDmgTaken[i];
            winSingleDmgTakenMin[i] = Math.min(winSingleDmgTakenMin[i], cappedSingle);
            winSingleDmgTakenMax[i] = Math.max(winSingleDmgTakenMax[i], cappedSingle);
            winSingleDmgTakenSimCount[i]++;
            if (simSingleDmgTaken[i] > 0) winSingleDmgTakenHitSims[i]++;
            winAoeDmgTakenAccum[i] += simAoeDmgTaken[i];
            winAoeDmgTakenMin[i] = Math.min(winAoeDmgTakenMin[i], cappedAoe);
            winAoeDmgTakenMax[i] = Math.max(winAoeDmgTakenMax[i], cappedAoe);
            winAoeDmgTakenSimCount[i]++;
            if (simAoeDmgTaken[i] > 0) winAoeDmgTakenHitSims[i]++;
            winTimesHit[i] += simTimesHit[i];
            winSingleHits[i] += singleHitsTaken[i];
            winTargeted[i] += simTargeted[i];
            winEvaded[i] += simEvaded[i];
            winHealingAccum[i] += simHealing[i];
            winCritSurvivals[i] += simCritSurvivals[i];
            winHemmaAbsorbedDmgAccum[i] += simHemmaAbsorbedDmg[i];
            winHemmaAbsorbedCountAccum[i] += simHemmaAbsorbedCount[i];
            winHemmaAtkGainAccum[i] += simHemmaAtkGain[i];
            winRudoBonusDmgAccum[i] += simRudoBonusDmg[i];
          } else if (wasLose) {
            loseDmgDealt[i] += damageFight[i];
            loseNormalDmg[i] += normalDmgFight[i];
            loseCritDmg[i] += critDmgFight[i];
            loseDmgMax[i] = Math.max(loseDmgMax[i], damageFight[i]);
            if (damageFight[i] > 0) loseDmgMin[i] = Math.min(loseDmgMin[i], damageFight[i]);
            if (simHitMin[i] < 1e18 && simHitMin[i] < loseDmgPerHitMin[i]) loseDmgPerHitMin[i] = simHitMin[i];
            if (simHitMax[i] > loseDmgPerHitMax[i]) loseDmgPerHitMax[i] = simHitMax[i];
            loseAttackCount[i] += simAttackCount[i];
            loseRoundsArr[i] += round;
            loseDmgTaken[i] += simDmgTaken[i];
            loseDmgTakenMin[i] = Math.min(loseDmgTakenMin[i], cappedDmg);
            loseDmgTakenMax[i] = Math.max(loseDmgTakenMax[i], cappedDmg);
            if (simDmgTaken[i] > 0) loseTotalDmgTakenHitSims[i]++;
            loseSingleDmgTakenAccum[i] += simSingleDmgTaken[i];
            loseSingleDmgTakenMin[i] = Math.min(loseSingleDmgTakenMin[i], cappedSingle);
            loseSingleDmgTakenMax[i] = Math.max(loseSingleDmgTakenMax[i], cappedSingle);
            loseSingleDmgTakenSimCount[i]++;
            if (simSingleDmgTaken[i] > 0) loseSingleDmgTakenHitSims[i]++;
            loseAoeDmgTakenAccum[i] += simAoeDmgTaken[i];
            loseAoeDmgTakenMin[i] = Math.min(loseAoeDmgTakenMin[i], cappedAoe);
            loseAoeDmgTakenMax[i] = Math.max(loseAoeDmgTakenMax[i], cappedAoe);
            loseAoeDmgTakenSimCount[i]++;
            if (simAoeDmgTaken[i] > 0) loseAoeDmgTakenHitSims[i]++;
            loseTimesHit[i] += simTimesHit[i];
            loseSingleHits[i] += singleHitsTaken[i];
            loseTargeted[i] += simTargeted[i];
            loseEvaded[i] += simEvaded[i];
            loseHealingAccum[i] += simHealing[i];
            loseCritSurvivals[i] += simCritSurvivals[i];
            loseHemmaAbsorbedDmgAccum[i] += simHemmaAbsorbedDmg[i];
            loseHemmaAbsorbedCountAccum[i] += simHemmaAbsorbedCount[i];
            loseHemmaAtkGainAccum[i] += simHemmaAtkGain[i];
            loseRudoBonusDmgAccum[i] += simRudoBonusDmg[i];
          }
        }
        // Polonia loot — apply per-sim cap on the party total, distribute proportionally for per-hero accum
        if (poloniaActive) {
          let simStolenTotal = 0;
          for (let i = 0; i < numHeroes; i++) simStolenTotal += simPoloniaStolen[i];
          const cappedTotal = Math.min(simStolenTotal, poloniaLootCap);
          // Distribute cap proportionally so per-hero shares sum to cappedTotal
          if (simStolenTotal > 0) {
            const ratio = cappedTotal / simStolenTotal;
            for (let i = 0; i < numHeroes; i++) {
              poloniaStolenAccum[i] += simPoloniaStolen[i] * ratio;
            }
          }
          poloniaTotAcrossSims += cappedTotal;
          if (cappedTotal < poloniaMinPerSim) poloniaMinPerSim = cappedTotal;
          if (cappedTotal > poloniaMaxPerSim) poloniaMaxPerSim = cappedTotal;
          if (simStolenTotal >= poloniaLootCap) poloniaCapHits++;
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

      // ─── Healing (per-turn regen from spirits/skills + champion party heal + aurasong) ───
      // Per-hero spirit/skill regen comes from precomputed detailStats['매 턴 체력 재생'],
      // which aggregates 도마뱀/불사조/우로보로스 등 all spirits + 클레릭/비숍 class skills.
      if (contFight) {
        const aurasongRegen = aurasong.regenPerTurn || 0;
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] <= 0) continue;
          const hpBefore = hp[i];
          const personalRegen = (activeHeroes[i] as any).detailStats?.["매 턴 체력 재생"] || 0;
          hp[i] = Math.min(hp[i] + personalRegen + aurasongRegen, finalHp[i]);

          if (liluHealFlat > 0) {
            hp[i] = Math.min(hp[i] + liluHealFlat * heroArtChampionMod[i], finalHp[i]);
          }
          {
            const healed = hp[i] - hpBefore;
            totalHealing[i] += healed;
            simHealing[i] += healed;
            if (healed > 0) {
              if (recordEvents) {
                pushEv({
                  round,
                  type: "heal",
                  actor: activeHeroes[i].name || `영웅 ${i + 1}`,
                  detail: `회복 ${Math.round(healed).toLocaleString()} HP`,
                  values: { heal: Math.round(healed), hp: Math.round(hp[i]), maxHp: Math.round(finalHp[i]) },
                });
              }
            }
          }
        }
      }

      // After 5000 sims, check if avg rounds > 200 → cap at 5000
      if (sim === 4999 && roundsAvg / 5000 > 200) {
        actualSimCount = 5000;
      }
    } // end while

    function handleFatalBlow(idx: number, dmg: number = 0): boolean {
      if (Math.random() < surviveChance[idx]) {
        // Crit survival = ignore this damage entirely (HP unchanged, not set to 1)
        hp[idx] += dmg;
        surviveChance[idx] = 0;
        critSurvivals[idx]++;
        simCritSurvivals[idx]++;
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
  let retryResultFull: SimulationResult | undefined;

  // Fateweaver/Chronomancer retry: re-simulate ONLY the actually-failed plays
  // with the +20%/+20% retry booster stacked. Same miniBoss config is inherited via spread.
  const failedCount = actualSimCount - timesQuestWon;
  if (
    (fateweaverPresent || chronoRetryPresent) &&
    rawWinRate < 100 &&
    failedCount > 0 &&
    !config._isRetry &&
    !config._disableRetry
  ) {
    const retryResult = runCombatSimulation({
      ...config,
      booster: fateweaverPresent ? getRetryBooster(booster) : booster,
      simulationCount: failedCount,
      _isRetry: true,
    });

    retryWinRate = retryResult.rawWinRate;
    retrySimulations = retryResult.totalSimulations;
    retryResultFull = retryResult;

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
    // Shark / Dinosaur display damage — PDF-additive form:
    //   atk_with_cond = finalAtk + atkConstant * condPct * partyAtkMult
    // This avoids the double-multiplication that `finalAtk * (1 + condPct)` would cause
    // when commonAtkPct ≠ 0. Mundra is already folded into finalAtk for boss fights.
    const partyMultI = heroPartyAtkMult[i] || 1;
    const sharkAdd = heroAtkConst[i] * (heroShark[i] * 0.01) * partyMultI;
    const sharkNormal = Math.floor((finalAtk[i] + sharkAdd) * barrierMod);
    const sharkCrit = Math.floor((finalAtk[i] + sharkAdd) * heroCritMult[i] * barrierMod);
    // Dinosaur first turn damage
    const dinoAdd = heroAtkConst[i] * (heroDinosaur[i] * 0.01) * partyMultI;
    const dinoNormal = Math.floor((finalAtk[i] + dinoAdd) * barrierMod);
    const dinoCrit = Math.floor((finalAtk[i] + dinoAdd) * heroCritMult[i] * barrierMod);
    // Damage application rate using actual thresholds
    const dmgAppRate = getDamageApplicationRate(finalDef[i], defThresholds);
    // Per-turn damage: total damage dealt / total attack actions (excludes stunned/dead turns)
    const avgRoundsForHero = totalRoundsPerHero[i] / actualSimCount;
    const avgDmgPerTurn = attackCountTotal[i] > 0 ? damageDealtAvg[i] / attackCountTotal[i] : 0;
    // Berserker thresholds — 4 stages (0..3)
    // stage 0: HP >= Hp1 (no penalty), threshold = 100
    // stage 1: HP >= Hp2, threshold = Hp1*100
    // stage 2: HP >= Hp3, threshold = Hp2*100
    // stage 3: HP <  Hp3, threshold = Hp3*100
    let berserkerThresholds: { threshold: number; belowRate: number }[] | undefined;
    if (heroBerserkerLevel[i] > 0) {
      const totRounds = brkTotalRounds[i] || 1;
      berserkerThresholds = [
        { threshold: 100, belowRate: Math.round((brkStageRounds[0][i] / totRounds) * 100 * 10) / 10 },
        {
          threshold: Math.round(berserkHp1[i] * 100),
          belowRate: Math.round((brkStageRounds[1][i] / totRounds) * 100 * 10) / 10,
        },
        {
          threshold: Math.round(berserkHp2[i] * 100),
          belowRate: Math.round((brkStageRounds[2][i] / totRounds) * 100 * 10) / 10,
        },
        {
          threshold: Math.round(berserkHp3[i] * 100),
          belowRate: Math.round((brkStageRounds[3][i] / totRounds) * 100 * 10) / 10,
        },
      ];
    }

    const effectiveAtk = Math.round(finalAtk[i] * barrierMod);
    const effectiveCritAttack = Math.round(finalAtk[i] * heroCritMult[i] * barrierMod);
    const avgTotalDmgTaken = totalDmgTakenAccum[i] / actualSimCount;
    const avgTimesHit = totalTimesHitAccum[i] / actualSimCount;

    // Monster crit chance against this hero (accounts for negative evasion, capped at +5%)
    const heroFinalEva = heroArtNoEvasion[i] ? 0 : heroEvasion[i];
    let monsterCritBase = baseMobCritChance * mobCritChanceMod;
    if (heroFinalEva < 0 && !heroArtNoEvasion[i]) {
      monsterCritBase += Math.min(-0.25 * heroFinalEva, 0.05);
    }
    const monsterCritChance = Math.round(Math.min(monsterCritBase, 1) * 100 * 10) / 10;

    // Berserker ATK/EVA bonus per stage (0..3)
    let berserkerAtkBonus: number[] | undefined;
    let berserkerEvaBonus: number[] | undefined;
    if (heroBerserkerLevel[i] > 0) {
      const lvl = heroBerserkerLevel[i];
      berserkerAtkBonus = [0, 1, 2, 3].map((s) => Math.round(0.1 * (1 + lvl) * s * 100));
      berserkerEvaBonus = [0, 10, 20, 30];
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
      minDamagePerTurn: dmgPerHitMin[i] >= 1e18 ? 0 : Math.round(dmgPerHitMin[i]),
      maxDamagePerTurn: Math.round(dmgPerHitMax[i]),
      normalDamageTaken: normalHit,
      aoeDamageTaken: aoeHit,
      critDamageTakenVal: critHit,
      totalDamageTakenAvg: Math.round(avgTotalDmgTaken),
      avgDamageTakenPerHit: avgTimesHit > 0 ? Math.round(avgTotalDmgTaken / avgTimesHit) : 0,
      avgDamageTakenPerTurn: avgRoundsForHero > 0 ? Math.round(avgTotalDmgTaken / avgRoundsForHero) : 0,
      totalDamageTakenAvgWhenHit:
        totalDmgTakenHitSims[i] > 0 ? Math.round(totalDmgTakenAccum[i] / totalDmgTakenHitSims[i]) : 0,
      singleDmgTakenAvgWhenHit:
        singleDmgTakenHitSims[i] > 0 ? Math.round(singleDmgTakenAccum[i] / singleDmgTakenHitSims[i]) : 0,
      aoeDmgTakenAvgWhenHit: aoeDmgTakenHitSims[i] > 0 ? Math.round(aoeDmgTakenAccum[i] / aoeDmgTakenHitSims[i]) : 0,
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
      finalEvasion: heroArtNoEvasion[i] ? 0 : Math.round(Math.min(heroEvasion[i], heroEvaCap[i]) * 100 * 10) / 10,
      damageApplicationRate: dmgAppRate,
      targetingRate: Math.round(((h.threat || 1) / totalThreat) * 100 * 10) / 10,
      evasionRate: timesTargeted[i] > 0 ? Math.round((timesEvaded[i] / timesTargeted[i]) * 100 * 10) / 10 : 0,
      monsterCritChance,
      berserkerThresholds,
      berserkerAtkBonus,
      berserkerEvaBonus,
      chronomancerRetries:
        (fateweaverPresent || chronoRetryPresent) &&
        isClass(h, "크로노맨서", "페이트위버", "운명직공", "Chronomancer", "Fateweaver")
          ? Math.round(((actualSimCount - timesQuestWon) / actualSimCount) * 100 * 10) / 10
          : undefined,
      chronomancerRetrySuccessRate: retryWinRate,
      totalHealingAvg: totalHealing[i] / actualSimCount,
      healPerTurn: (() => {
        // 실제 매턴 체력 재생 수치 = detailStats(영혼+스킬, 도마뱀/불사조/우로보로스/클레릭/비숍 포함)
        //                          + 오라의 노래 매턴회복 + 챔피언 파티 회복(릴루 등)
        const personal = (activeHeroes[i] as any).detailStats?.["매 턴 체력 재생"] || 0;
        let v = personal + (aurasong.regenPerTurn || 0);
        if (liluHealFlat > 0) v += liluHealFlat * heroArtChampionMod[i];
        if (hemmaSelfHealFlat > 0 && i === hemmaWho) v += hemmaSelfHealFlat;
        return v;
      })(),
      lordProtectionAvg: lordProtections[i] / actualSimCount,
      lordProtectionSimRate: Math.round((lordProtectedSims[i] / actualSimCount) * 100 * 10) / 10,
      lordProtectedSingleAvg: lordProtectedSingle[i] / actualSimCount,
      lordProtectedAoeAvg: lordProtectedAoe[i] / actualSimCount,
      lordAbsorbedSingleDmg: lordAbsorbedSingle[i] / actualSimCount,
      lordAbsorbedAoeDmg: lordAbsorbedAoe[i] / actualSimCount,
      critSurvivalCount: critSurvivals[i] / actualSimCount,
      critSurvivalChance: Math.round((heroArmadillo[i] || (heroIsCleric[i] || heroIsBishop[i] ? 100 : 0)) * 10) / 10,
      critSurvivalApplyRate: Math.round((critSurvivals[i] / actualSimCount) * 100 * 10) / 10,
      tankingRate: totalAllSingleHits > 0 ? Math.round((singleTargetHitsTotal[i] / totalAllSingleHits) * 1000) / 10 : 0,
      singleTargetRate:
        totalAllSingleHits > 0 ? Math.round((singleTargetHitsTotal[i] / totalAllSingleHits) * 1000) / 10 : 0,
      minDamageTaken: dmgTakenMin[i] >= 1e9 ? 0 : Math.round(dmgTakenMin[i]),
      maxDamageTaken: Math.round(dmgTakenMax[i]),
      minDamageTakenPerTurn: dmgTakenPerTurnMin[i] >= 1e9 ? 0 : Math.round(dmgTakenPerTurnMin[i]),
      maxDamageTakenPerTurn: Math.round(dmgTakenPerTurnMax[i]),
      aoeDmgTakenTotal: aoeDmgTakenAccum[i] / actualSimCount,
      singleDmgTakenTotal: singleDmgTakenAccum[i] / actualSimCount,
      singleDmgTakenAvg: actualSimCount > 0 ? Math.round(singleDmgTakenAccum[i] / actualSimCount) : 0,
      singleDmgTakenMin: singleDmgTakenMin[i] >= 1e9 ? 0 : Math.round(singleDmgTakenMin[i]),
      singleDmgTakenMax: Math.round(singleDmgTakenMax[i]),
      aoeDmgTakenAvg: actualSimCount > 0 ? Math.round(aoeDmgTakenAccum[i] / actualSimCount) : 0,
      aoeDmgTakenMin: aoeDmgTakenMin[i] >= 1e9 ? 0 : Math.round(aoeDmgTakenMin[i]),
      aoeDmgTakenMax: Math.round(aoeDmgTakenMax[i]),
      singleNormalHitShare:
        singleNormalHitsTotal[i] + singleCritHitsTotal[i] > 0
          ? Math.round((singleNormalHitsTotal[i] / (singleNormalHitsTotal[i] + singleCritHitsTotal[i])) * 100 * 10) / 10
          : 0,
      singleCritHitShare:
        singleNormalHitsTotal[i] + singleCritHitsTotal[i] > 0
          ? Math.round((singleCritHitsTotal[i] / (singleNormalHitsTotal[i] + singleCritHitsTotal[i])) * 100 * 10) / 10
          : 0,
      winHpRemainMin: timesQuestWon > 0 && winHpRemainMin[i] < 1e9 ? Math.round(winHpRemainMin[i]) : 0,
      winHpRemainAvg: timesQuestWon > 0 ? Math.round(winHpRemain[i] / timesQuestWon) : 0,
      winHpRemainMax: timesQuestWon > 0 ? Math.round(winHpRemainMax[i]) : 0,
      loseHpRemainMin: loseCount > 0 && loseHpRemainMin[i] < 1e9 ? Math.round(loseHpRemainMin[i]) : 0,
      loseHpRemainAvg: loseCount > 0 ? Math.round(loseHpRemain[i] / loseCount) : 0,
      loseHpRemainMax: loseCount > 0 ? Math.round(loseHpRemainMax[i]) : 0,
      overallHpRemainMin: overallHpRemainMin[i] < 1e9 ? Math.round(overallHpRemainMin[i]) : 0,
      overallHpRemainMax: Math.round(overallHpRemainMax[i]),
      overallHpRemainAvg: overallHpRemainCount[i] > 0 ? Math.round(overallHpRemainSum[i] / overallHpRemainCount[i]) : 0,
      berserkerStageEvaRate:
        heroBerserkerLevel[i] > 0
          ? [0, 1, 2, 3].map((s) =>
              brkStageTargeted[s][i] > 0
                ? Math.round((brkStageEvaded[s][i] / brkStageTargeted[s][i]) * 100 * 10) / 10
                : 0,
            )
          : undefined,
      berserkerStageDmg:
        heroBerserkerLevel[i] > 0
          ? [0, 1, 2, 3].map((s) => {
              const nC = brkStageNormalCount[s][i];
              const cC = brkStageCritCount[s][i];
              const nSum = brkStageNormalDmg[s][i];
              const cSum = brkStageCritDmg[s][i];
              const totalCount = nC + cC;
              return {
                normal: nC > 0 ? Math.round(nSum / nC) : 0,
                crit: cC > 0 ? Math.round(cSum / cC) : 0,
                // avg dmg per attack at this stage
                avg: totalCount > 0 ? Math.round((nSum + cSum) / totalCount) : 0,
                // total dmg dealt at this stage per sim (for stage-share bar)
                total: Math.round((nSum + cSum) / actualSimCount),
              };
            })
          : undefined,
      // Alive turns
      aliveTurnsMin: aliveTurnsMin[i] >= 1e9 ? 0 : Math.round(aliveTurnsMin[i]),
      aliveTurnsAvg: actualSimCount > 0 ? Math.round((aliveTurnsSum[i] / actualSimCount) * 10) / 10 : 0,
      aliveTurnsMax: Math.round(aliveTurnsMax[i]),
      winAliveTurnsMin: timesQuestWon > 0 && winAliveTurnsMin[i] < 1e9 ? Math.round(winAliveTurnsMin[i]) : 0,
      winAliveTurnsAvg: timesQuestWon > 0 ? Math.round((winAliveTurnsSum[i] / timesQuestWon) * 10) / 10 : 0,
      winAliveTurnsMax: timesQuestWon > 0 ? Math.round(winAliveTurnsMax[i]) : 0,
      loseAliveTurnsMin: loseCount > 0 && loseAliveTurnsMin[i] < 1e9 ? Math.round(loseAliveTurnsMin[i]) : 0,
      loseAliveTurnsAvg: loseCount > 0 ? Math.round((loseAliveTurnsSum[i] / loseCount) * 10) / 10 : 0,
      loseAliveTurnsMax: loseCount > 0 ? Math.round(loseAliveTurnsMax[i]) : 0,
      roundLimitAliveRate:
        actualSimCount > 0 ? Math.round((roundLimitAliveCount[i] / actualSimCount) * 100 * 10) / 10 : 0,
      // Hemma drain absorbed (avg per sim)
      hemmaAbsorbedDmg: actualSimCount > 0 ? Math.round(hemmaAbsorbedDmgAccum[i] / actualSimCount) : 0,
      hemmaAbsorbedCount: actualSimCount > 0 ? Math.round(hemmaAbsorbedCountAccum[i] / actualSimCount) : 0,
      hemmaAtkGainAvg: actualSimCount > 0 ? Math.round(hemmaAtkGainAccum[i] / actualSimCount) : 0,
      rudoCritBonusPct: rudoBonusBase > 0 ? Math.round(rudoBonusBase * 1000) / 10 : 0,
      rudoFinalCritChance:
        rudoBonusBase > 0 ? Math.round(Math.min(heroCritChance[i] + rudoBonusBase, 1) * 1000) / 10 : 0,
      rudoBonusDmgAvg: actualSimCount > 0 ? Math.round(rudoBonusDmgAccum[i] / actualSimCount) : 0,
      isRudoInParty: rudoBonusBase > 0,
      // Lord saved damage (when this hero was protected)
      lordSavedSingleAvgDmg:
        lordProtectedSingle[i] > 0 ? Math.round(lordSavedSingleDmgAccum[i] / lordProtectedSingle[i]) : 0,
      lordSavedAoeAvgDmg: lordProtectedAoe[i] > 0 ? Math.round(lordSavedAoeDmgAccum[i] / lordProtectedAoe[i]) : 0,
      // Conqueror per-stack metrics
      conquerorStackTurnRate: heroIsConquistador[i]
        ? (() => {
            const totalTurns = conqStackTurns.reduce((s, arr) => s + arr[i], 0);
            return totalTurns > 0
              ? [0, 1, 2, 3, 4].map((s) => Math.round((conqStackTurns[s][i] / totalTurns) * 100 * 10) / 10)
              : [0, 0, 0, 0, 0];
          })()
        : undefined,
      conquerorStackCritDmg: heroIsConquistador[i]
        ? (() => {
            const avgBaseAtk = attackCountTotal[i] > 0 ? baseAtkSumTotal[i] / attackCountTotal[i] : 0;
            return [0, 1, 2, 3, 4].map((s) =>
              s === 0 ? Math.round(avgBaseAtk) : Math.round(avgBaseAtk * (heroCritMult[i] + s * 0.25)),
            );
          })()
        : undefined,
      conquerorStackAvgDmg: heroIsConquistador[i]
        ? [0, 1, 2, 3, 4].map((s) => {
            // Per-sim average: sum of damage dealt at this stack across all sims,
            // divided by the number of sims where the hero actually hit at this stack.
            // This naturally weights by attack frequency — stacks the hero attacks at
            // more often will show higher per-sim totals.
            const sims = conqStackSimsWithStack[s][i];
            return sims > 0 ? Math.round(conqStackTotalDmgAccum[s][i] / sims) : 0;
          })
        : undefined,
      conquerorStackResetRate: heroIsConquistador[i]
        ? [0, 1, 2, 3, 4].map((s) =>
            conqStackAttackCount[s][i] > 0
              ? Math.round((conqStackResetCount[s][i] / conqStackAttackCount[s][i]) * 100 * 10) / 10
              : 0,
          )
        : undefined,
      conquerorBaseCritMult: heroIsConquistador[i] ? heroCritMult[i] : undefined,
      conquerorAvgStack: heroIsConquistador[i]
        ? (() => {
            const totalTurns = conqStackTurns.reduce((s, arr) => s + arr[i], 0);
            if (totalTurns === 0) return 0;
            const sum = [0, 1, 2, 3, 4].reduce((acc, s) => acc + s * conqStackTurns[s][i], 0);
            return Math.round((sum / totalTurns) * 100) / 100;
          })()
        : undefined,
      conquerorAvgCritBonus: heroIsConquistador[i]
        ? (() => {
            const totalTurns = conqStackTurns.reduce((s, arr) => s + arr[i], 0);
            if (totalTurns === 0) return 0;
            const sum = [0, 1, 2, 3, 4].reduce((acc, s) => acc + s * 25 * conqStackTurns[s][i], 0);
            return Math.round((sum / totalTurns) * 10) / 10;
          })()
        : undefined,
      // Innate (ninja/sensei)
      innateLossCount:
        (heroIsNinja[i] || heroIsSensei[i]) && actualSimCount > 0
          ? Math.round((innateLossAccum[i] / actualSimCount) * 10) / 10
          : undefined,
      innateRegenCount:
        heroIsSensei[i] && actualSimCount > 0
          ? Math.round((innateRegenAccum[i] / actualSimCount) * 10) / 10
          : undefined,
      withInnateAvgDmg:
        (heroIsNinja[i] || heroIsSensei[i]) && actualSimCount > 0
          ? Math.round(withInnateDmgAccum[i] / actualSimCount)
          : undefined,
      withoutInnateAvgDmg:
        (heroIsNinja[i] || heroIsSensei[i]) && actualSimCount > 0
          ? Math.round(withoutInnateDmgAccum[i] / actualSimCount)
          : undefined,
      // Class flags
      isLordHero: heroIsLord[i],
      isHemmaHero: hemmaWho === i,
      isConquerorHero: heroIsConquistador[i],
      isNinjaHero: heroIsNinja[i],
      isSenseiHero: heroIsSensei[i],
      isBerserkerHero: heroBerserkerLevel[i] > 0,
      berserkerStageNum: heroBerserkerLevel[i] > 0 ? 3 : undefined,
      isTricksterHero: activeHeroes[i].heroClass === "사기꾼" || activeHeroes[i].heroClass === "Trickster",
      poloniaStolenAvg:
        poloniaActive && actualSimCount > 0
          ? Math.round((poloniaStolenAccum[i] / actualSimCount) * 100) / 100
          : undefined,
    };
  });

  // Build win/lose hero result variants
  const buildBucketResult = (
    i: number,
    base: HeroSimResult,
    bucketCount: number,
    bucket: "win" | "lose",
  ): HeroSimResult => {
    if (bucketCount <= 0) return base;
    const dDealt = bucket === "win" ? winDmgDealt[i] : loseDmgDealt[i];
    const dNorm = bucket === "win" ? winNormalDmg[i] : loseNormalDmg[i];
    const dCrit = bucket === "win" ? winCritDmg[i] : loseCritDmg[i];
    const dMax = bucket === "win" ? winDmgMax[i] : loseDmgMax[i];
    const dMin = bucket === "win" ? winDmgMin[i] : loseDmgMin[i];
    const r = bucket === "win" ? winRoundsArr[i] : loseRoundsArr[i];
    const dTaken = bucket === "win" ? winDmgTaken[i] : loseDmgTaken[i];
    const tHit = bucket === "win" ? winTimesHit[i] : loseTimesHit[i];
    const sHit = bucket === "win" ? winSingleHits[i] : loseSingleHits[i];
    const surv = bucket === "win" ? winSurvived[i] : 0;
    const hpRem = bucket === "win" ? winHpRemain[i] : loseHpRemain[i];
    const tgt = bucket === "win" ? winTargeted[i] : loseTargeted[i];
    const ev = bucket === "win" ? winEvaded[i] : loseEvaded[i];
    const avgR = r / bucketCount;
    const totalSingle =
      bucket === "win"
        ? Array.from(winSingleHits).reduce((s, v) => s + v, 0)
        : Array.from(loseSingleHits).reduce((s, v) => s + v, 0);
    return {
      ...base,
      survivalRate: bucket === "win" ? (surv / bucketCount) * 100 : 0,
      avgHpRemaining: hpRem / bucketCount,
      avgDamageDealt: dDealt / bucketCount,
      maxDamageDealt: dMax,
      minDamageDealt: dMin >= 1e9 ? 0 : dMin,
      normalDmgDealtAvg: dNorm / bucketCount,
      critDmgDealtAvg: dCrit / bucketCount,
      avgDamagePerTurn: (() => {
        const ac = bucket === "win" ? winAttackCount[i] : loseAttackCount[i];
        return ac > 0 ? dDealt / ac : 0;
      })(),
      minDamagePerTurn:
        bucket === "win"
          ? winDmgPerHitMin[i] >= 1e18
            ? 0
            : Math.round(winDmgPerHitMin[i])
          : loseDmgPerHitMin[i] >= 1e18
            ? 0
            : Math.round(loseDmgPerHitMin[i]),
      maxDamagePerTurn: bucket === "win" ? Math.round(winDmgPerHitMax[i]) : Math.round(loseDmgPerHitMax[i]),
      totalDamageTakenAvg: Math.round(dTaken / bucketCount),
      totalDamageTakenAvgWhenHit: (() => {
        const hits = bucket === "win" ? winTotalDmgTakenHitSims[i] : loseTotalDmgTakenHitSims[i];
        return hits > 0 ? Math.round(dTaken / hits) : 0;
      })(),
      minDamageTaken:
        bucket === "win"
          ? winDmgTakenMin[i] >= 1e9
            ? 0
            : Math.round(winDmgTakenMin[i])
          : loseDmgTakenMin[i] >= 1e9
            ? 0
            : Math.round(loseDmgTakenMin[i]),
      maxDamageTaken: bucket === "win" ? Math.round(winDmgTakenMax[i]) : Math.round(loseDmgTakenMax[i]),
      avgDamageTakenPerHit: tHit > 0 ? Math.round(dTaken / tHit) : 0,
      avgDamageTakenPerTurn: avgR > 0 ? Math.round(dTaken / bucketCount / avgR) : 0,
      singleDmgTakenAvg:
        bucket === "win"
          ? Math.round(winSingleDmgTakenAccum[i] / bucketCount)
          : Math.round(loseSingleDmgTakenAccum[i] / bucketCount),
      singleDmgTakenAvgWhenHit: (() => {
        const hits = bucket === "win" ? winSingleDmgTakenHitSims[i] : loseSingleDmgTakenHitSims[i];
        const accum = bucket === "win" ? winSingleDmgTakenAccum[i] : loseSingleDmgTakenAccum[i];
        return hits > 0 ? Math.round(accum / hits) : 0;
      })(),
      singleDmgTakenMin:
        bucket === "win"
          ? winSingleDmgTakenMin[i] >= 1e9
            ? 0
            : Math.round(winSingleDmgTakenMin[i])
          : loseSingleDmgTakenMin[i] >= 1e9
            ? 0
            : Math.round(loseSingleDmgTakenMin[i]),
      singleDmgTakenMax: bucket === "win" ? Math.round(winSingleDmgTakenMax[i]) : Math.round(loseSingleDmgTakenMax[i]),
      singleDmgTakenTotal:
        bucket === "win" ? winSingleDmgTakenAccum[i] / bucketCount : loseSingleDmgTakenAccum[i] / bucketCount,
      aoeDmgTakenAvg:
        bucket === "win"
          ? Math.round(winAoeDmgTakenAccum[i] / bucketCount)
          : Math.round(loseAoeDmgTakenAccum[i] / bucketCount),
      aoeDmgTakenAvgWhenHit: (() => {
        const hits = bucket === "win" ? winAoeDmgTakenHitSims[i] : loseAoeDmgTakenHitSims[i];
        const accum = bucket === "win" ? winAoeDmgTakenAccum[i] : loseAoeDmgTakenAccum[i];
        return hits > 0 ? Math.round(accum / hits) : 0;
      })(),
      aoeDmgTakenMin:
        bucket === "win"
          ? winAoeDmgTakenMin[i] >= 1e9
            ? 0
            : Math.round(winAoeDmgTakenMin[i])
          : loseAoeDmgTakenMin[i] >= 1e9
            ? 0
            : Math.round(loseAoeDmgTakenMin[i]),
      aoeDmgTakenMax: bucket === "win" ? Math.round(winAoeDmgTakenMax[i]) : Math.round(loseAoeDmgTakenMax[i]),
      aoeDmgTakenTotal: bucket === "win" ? winAoeDmgTakenAccum[i] / bucketCount : loseAoeDmgTakenAccum[i] / bucketCount,
      evasionRate: tgt > 0 ? Math.round((ev / tgt) * 100 * 10) / 10 : 0,
      tankingRate: totalSingle > 0 ? Math.round((sHit / totalSingle) * 1000) / 10 : 0,
      singleTargetRate: totalSingle > 0 ? Math.round((sHit / totalSingle) * 1000) / 10 : 0,
      totalHealingAvg: (bucket === "win" ? winHealingAccum[i] : loseHealingAccum[i]) / bucketCount,
      critSurvivalApplyRate:
        Math.round(((bucket === "win" ? winCritSurvivals[i] : loseCritSurvivals[i]) / bucketCount) * 100 * 10) / 10,
      critSurvivalCount: (bucket === "win" ? winCritSurvivals[i] : loseCritSurvivals[i]) / bucketCount,
      hemmaAbsorbedDmg: Math.round(
        (bucket === "win" ? winHemmaAbsorbedDmgAccum[i] : loseHemmaAbsorbedDmgAccum[i]) / bucketCount,
      ),
      hemmaAbsorbedCount: Math.round(
        (bucket === "win" ? winHemmaAbsorbedCountAccum[i] : loseHemmaAbsorbedCountAccum[i]) / bucketCount,
      ),
      hemmaAtkGainAvg: Math.round(
        (bucket === "win" ? winHemmaAtkGainAccum[i] : loseHemmaAtkGainAccum[i]) / bucketCount,
      ),
      rudoCritBonusPct: rudoBonusBase > 0 ? Math.round(rudoBonusBase * 1000) / 10 : 0,
      rudoFinalCritChance:
        rudoBonusBase > 0 ? Math.round(Math.min(heroCritChance[i] + rudoBonusBase, 1) * 1000) / 10 : 0,
      rudoBonusDmgAvg: Math.round(
        (bucket === "win" ? winRudoBonusDmgAccum[i] : loseRudoBonusDmgAccum[i]) / bucketCount,
      ),
      isRudoInParty: rudoBonusBase > 0,
      aliveTurnsMin:
        bucket === "win"
          ? winAliveTurnsMin[i] < 1e9
            ? Math.round(winAliveTurnsMin[i])
            : 0
          : loseAliveTurnsMin[i] < 1e9
            ? Math.round(loseAliveTurnsMin[i])
            : 0,
      aliveTurnsAvg:
        bucket === "win"
          ? Math.round((winAliveTurnsSum[i] / bucketCount) * 10) / 10
          : Math.round((loseAliveTurnsSum[i] / bucketCount) * 10) / 10,
      aliveTurnsMax: bucket === "win" ? Math.round(winAliveTurnsMax[i]) : Math.round(loseAliveTurnsMax[i]),
    };
  };

  const winHeroResults =
    timesQuestWon > 0 ? heroResults.map((b, i) => buildBucketResult(i, b, timesQuestWon, "win")) : undefined;
  const loseHeroResults =
    loseCount > 0 ? heroResults.map((b, i) => buildBucketResult(i, b, loseCount, "lose")) : undefined;

  const result: SimulationResult = {
    winRate: loseCount > 0 ? Math.floor(winRate * 100) / 100 : Math.round(winRate * 100) / 100,
    rawWinRate: loseCount > 0 ? Math.floor(rawWinRate * 100) / 100 : Math.round(rawWinRate * 100) / 100,
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
    retryResult: retryResultFull,
    winRounds:
      timesQuestWon > 0
        ? {
            avg: Math.round((winRoundsSum / timesQuestWon) * 100) / 100,
            min: winRoundsMin >= 1000 ? 0 : winRoundsMin,
            max: winRoundsMax,
          }
        : undefined,
    loseRounds:
      loseCount > 0
        ? {
            avg: Math.round((loseRoundsSum / loseCount) * 100) / 100,
            min: loseRoundsMin >= 1000 ? 0 : loseRoundsMin,
            max: loseRoundsMax,
          }
        : undefined,
    partyDmgDealt:
      partySimCount > 0
        ? {
            min: partyDmgMin === Infinity ? 0 : Math.round(partyDmgMin),
            avg: Math.round(partyDmgSum / partySimCount),
            max: Math.round(partyDmgMax),
          }
        : undefined,
    partyDmgPerTurn:
      partySimCount > 0
        ? {
            min: partyDmgPerTurnMin === Infinity ? 0 : Math.round(partyDmgPerTurnMin),
            avg: Math.round(partyDmgPerTurnSum / partySimCount),
            max: Math.round(partyDmgPerTurnMax),
          }
        : undefined,
    partyDmgTaken:
      partySimCount > 0
        ? {
            min: partyTakenMin === Infinity ? 0 : Math.round(partyTakenMin),
            avg: Math.round(partyTakenSum / partySimCount),
            max: Math.round(partyTakenMax),
          }
        : undefined,
    partyDmgTakenPerTurn:
      partySimCount > 0
        ? {
            min: partyTakenPerTurnMin === Infinity ? 0 : Math.round(partyTakenPerTurnMin),
            avg: Math.round(partyTakenPerTurnSum / partySimCount),
            max: Math.round(partyTakenPerTurnMax),
          }
        : undefined,
    winPartyDmgDealt:
      winPartyCount > 0
        ? {
            min: winPartyDmgMin === Infinity ? 0 : Math.round(winPartyDmgMin),
            avg: Math.round(winPartyDmgSum / winPartyCount),
            max: Math.round(winPartyDmgMax),
          }
        : undefined,
    winPartyDmgPerTurn:
      winPartyCount > 0
        ? {
            min: winPartyDmgPerTurnMin === Infinity ? 0 : Math.round(winPartyDmgPerTurnMin),
            avg: Math.round(winPartyDmgPerTurnSum / winPartyCount),
            max: Math.round(winPartyDmgPerTurnMax),
          }
        : undefined,
    winPartyDmgTaken:
      winPartyCount > 0
        ? {
            min: winPartyTakenMin === Infinity ? 0 : Math.round(winPartyTakenMin),
            avg: Math.round(winPartyTakenSum / winPartyCount),
            max: Math.round(winPartyTakenMax),
          }
        : undefined,
    winPartyDmgTakenPerTurn:
      winPartyCount > 0
        ? {
            min: winPartyTakenPerTurnMin === Infinity ? 0 : Math.round(winPartyTakenPerTurnMin),
            avg: Math.round(winPartyTakenPerTurnSum / winPartyCount),
            max: Math.round(winPartyTakenPerTurnMax),
          }
        : undefined,
    losePartyDmgDealt:
      losePartyCount > 0
        ? {
            min: losePartyDmgMin === Infinity ? 0 : Math.round(losePartyDmgMin),
            avg: Math.round(losePartyDmgSum / losePartyCount),
            max: Math.round(losePartyDmgMax),
          }
        : undefined,
    losePartyDmgPerTurn:
      losePartyCount > 0
        ? {
            min: losePartyDmgPerTurnMin === Infinity ? 0 : Math.round(losePartyDmgPerTurnMin),
            avg: Math.round(losePartyDmgPerTurnSum / losePartyCount),
            max: Math.round(losePartyDmgPerTurnMax),
          }
        : undefined,
    losePartyDmgTaken:
      losePartyCount > 0
        ? {
            min: losePartyTakenMin === Infinity ? 0 : Math.round(losePartyTakenMin),
            avg: Math.round(losePartyTakenSum / losePartyCount),
            max: Math.round(losePartyTakenMax),
          }
        : undefined,
    losePartyDmgTakenPerTurn:
      losePartyCount > 0
        ? {
            min: losePartyTakenPerTurnMin === Infinity ? 0 : Math.round(losePartyTakenPerTurnMin),
            avg: Math.round(losePartyTakenPerTurnSum / losePartyCount),
            max: Math.round(losePartyTakenPerTurnMax),
          }
        : undefined,
    poloniaLoot: poloniaActive
      ? {
          hasPolonia: true,
          baseChance: Math.round(poloniaLootChance * 100 * 10) / 10,
          capMax: poloniaLootCap,
          numTricksters: poloniaNumTricksters,
          avgPerSim: actualSimCount > 0 ? Math.round((poloniaTotAcrossSims / actualSimCount) * 100) / 100 : 0,
          minPerSim: poloniaMinPerSim === Infinity ? 0 : Math.round(poloniaMinPerSim),
          maxPerSim: Math.round(poloniaMaxPerSim),
          capHitRate: actualSimCount > 0 ? Math.round((poloniaCapHits / actualSimCount) * 100 * 10) / 10 : 0,
        }
      : undefined,
    eventLog: recordEvents ? eventLog : undefined,
    combinedResult: undefined,
  };

  if (retryResultFull) {
    result.combinedResult = mergeSimResults(result, retryResultFull);
  }

  return result;
}

// ─── Random Mini-Boss Simulation ────────────────────────────────────────────

function runRandomMiniBossSimulation(
  config: SimulationConfig,
  activeHeroes: Hero[],
  simCount: number,
): SimulationResult {
  // 2% chance mini-boss appears, 20% chance each type
  const MINI_BOSS_SPAWN_CHANCE = 0.02;
  const MINI_BOSS_TYPES: MiniBossType[] = ["huge", "agile", "dire", "wealthy", "legendary"];
  const MINI_BOSS_TYPE_CHANCE = 0.2; // 20% each

  // Run simulations for 'none' and each mini-boss type with weighted counts.
  // Ensure no sims are lost to rounding: normalSimCount absorbs any remainder so
  // normalSimCount + 5 * perTypeSimCount === simCount exactly.
  const perTypeSimCount = Math.round(simCount * MINI_BOSS_SPAWN_CHANCE * MINI_BOSS_TYPE_CHANCE);
  const normalSimCount = Math.max(0, simCount - perTypeSimCount * 5);

  // Run normal simulation
  const normalResult = runCombatSimulation({
    ...config,
    miniBoss: "none",
    simulationCount: normalSimCount,
    _disableRetry: true,
  });

  // Run each mini-boss type simulation
  const miniBossResults: MiniBossResult[] = [
    {
      type: "normal",
      encounters: normalSimCount,
      wins: Math.round((normalResult.winRate / 100) * normalSimCount),
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

  let totalWins = Math.round((normalResult.winRate / 100) * normalSimCount);
  let totalRounds = normalResult.avgRounds * normalSimCount;
  let totalSims = normalSimCount;

  for (const mbType of MINI_BOSS_TYPES) {
    if (perTypeSimCount <= 0) {
      // Skip empty buckets — pushing a zero-count placeholder so indices stay aligned isn't needed
      // because aggregateBucket iterates over miniBossResults and respects (winN || 0) / (loseN || 0).
      miniBossResults.push({
        type: mbType,
        encounters: 0,
        wins: 0,
        winRate: 0,
        avgRounds: 0,
        heroResults: normalResult.heroResults,
        winHero: undefined,
        loseHero: undefined,
        winN: 0,
        loseN: 0,
        winRoundsSum: 0,
        loseRoundsSum: 0,
        minRounds: undefined,
        maxRounds: undefined,
        winMinRounds: undefined,
        winMaxRounds: undefined,
        loseMinRounds: undefined,
        loseMaxRounds: undefined,
      });
      continue;
    }
    const mbResult = runCombatSimulation({
      ...config,
      miniBoss: mbType,
      simulationCount: perTypeSimCount,
      _disableRetry: true,
    });

    const wins = Math.round((mbResult.winRate / 100) * perTypeSimCount);
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
      tankingRate: tankTotalWeight > 0 ? Math.round((tankWeightedSum / tankTotalWeight) * 10) / 10 : hr.tankingRate,
    };
  });

  // Aggregate win-only / lose-only hero results
  const aggregateBucket = (
    bucket: "win" | "lose",
  ): { results: HeroSimResult[]; count: number; roundsSum: number } | undefined => {
    let totalCount = 0;
    let roundsSum = 0;
    for (const mbr of miniBossResults) {
      const n = bucket === "win" ? mbr.winN || 0 : mbr.loseN || 0;
      totalCount += n;
      roundsSum += bucket === "win" ? mbr.winRoundsSum || 0 : mbr.loseRoundsSum || 0;
    }
    if (totalCount === 0) return undefined;
    // Compute total single-target hits per hero across all miniboss types in this bucket
    // (weighted by encounter count) so tankingRate reflects the chosen bucket.
    const singleHitsAgg = normalResult.heroResults.map(() => 0);
    let totalSingleAgg = 0;
    for (const mbr of miniBossResults) {
      const n = bucket === "win" ? mbr.winN || 0 : mbr.loseN || 0;
      const arr = bucket === "win" ? mbr.winHero : mbr.loseHero;
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
      let dmgSum = 0,
        normSum = 0,
        critSum = 0,
        takenSum = 0;
      let maxDmg = 0,
        minDmg = 1e9;
      for (const mbr of miniBossResults) {
        const n = bucket === "win" ? mbr.winN || 0 : mbr.loseN || 0;
        const arr = bucket === "win" ? mbr.winHero : mbr.loseHero;
        if (!arr || !arr[idx] || n === 0) continue;
        const r = arr[idx];
        dmgSum += r.avgDamageDealt * n;
        normSum += r.normalDmgDealtAvg * n;
        critSum += r.critDmgDealtAvg * n;
        takenSum += r.totalDamageTakenAvg * n;
        maxDmg = Math.max(maxDmg, r.maxDamageDealt);
        if (r.minDamageDealt > 0) minDmg = Math.min(minDmg, r.minDamageDealt);
      }
      const tankingRate = totalSingleAgg > 0 ? Math.round((singleHitsAgg[idx] / totalSingleAgg) * 1000) / 10 : 0;
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

  const winAgg = aggregateBucket("win");
  const loseAgg = aggregateBucket("lose");

  // Aggregate min/max across all sub-simulations (overall, win, lose)
  const allMins = miniBossResults.map((m) => m.minRounds).filter((v): v is number => v != null && v > 0);
  const allMaxs = miniBossResults.map((m) => m.maxRounds).filter((v): v is number => v != null);
  const winMins = miniBossResults.map((m) => m.winMinRounds).filter((v): v is number => v != null && v > 0);
  const winMaxs = miniBossResults.map((m) => m.winMaxRounds).filter((v): v is number => v != null);
  const loseMins = miniBossResults.map((m) => m.loseMinRounds).filter((v): v is number => v != null && v > 0);
  const loseMaxs = miniBossResults.map((m) => m.loseMaxRounds).filter((v): v is number => v != null);

  // ─── Fateweaver/Chronomancer retry on aggregated random-miniboss runs ───
  let finalWinRate = combinedWinRate;
  let retryResultFull: SimulationResult | undefined;
  const fateweaverPresent = activeHeroes.some((h) => isClass(h, "페이트위버", "운명직공", "Fateweaver"));
  const chronoRetryPresent = !fateweaverPresent && activeHeroes.some((h) => isClass(h, "크로노맨서", "Chronomancer"));
  const failedCount = totalSims - totalWins;
  if ((fateweaverPresent || chronoRetryPresent) && failedCount > 0 && !config._isRetry && !config._disableRetry) {
    const retryResult = runCombatSimulation({
      ...config,
      booster: fateweaverPresent ? getRetryBooster(config.booster) : config.booster,
      simulationCount: failedCount,
      _isRetry: true,
    });
    retryResultFull = retryResult;
    const retryWinRate = retryResult.rawWinRate;
    finalWinRate = combinedWinRate + (100 - combinedWinRate) * (retryWinRate / 100);
  }

  const randomResult: SimulationResult = {
    winRate: loseAgg && loseAgg.count > 0 ? Math.floor(finalWinRate * 100) / 100 : Math.round(finalWinRate * 100) / 100,
    rawWinRate:
      loseAgg && loseAgg.count > 0 ? Math.floor(finalWinRate * 100) / 100 : Math.round(finalWinRate * 100) / 100,
    avgRounds: Math.round(combinedAvgRounds * 100) / 100,
    minRounds: allMins.length > 0 ? Math.min(...allMins) : 0,
    maxRounds: allMaxs.length > 0 ? Math.max(...allMaxs) : 0,
    heroResults: aggregatedHeroResults,
    winHeroResults: winAgg?.results,
    loseHeroResults: loseAgg?.results,
    winSimCount: winAgg?.count,
    loseSimCount: loseAgg?.count,
    winRounds:
      winAgg && winAgg.count > 0
        ? {
            avg: Math.round((winAgg.roundsSum / winAgg.count) * 100) / 100,
            min: winMins.length > 0 ? Math.min(...winMins) : 0,
            max: winMaxs.length > 0 ? Math.max(...winMaxs) : 0,
          }
        : undefined,
    loseRounds:
      loseAgg && loseAgg.count > 0
        ? {
            avg: Math.round((loseAgg.roundsSum / loseAgg.count) * 100) / 100,
            min: loseMins.length > 0 ? Math.min(...loseMins) : 0,
            max: loseMaxs.length > 0 ? Math.max(...loseMaxs) : 0,
          }
        : undefined,
    roundLimitRate: normalResult.roundLimitRate,
    totalSimulations: totalSims,
    miniBossResults,
    retryResult: retryResultFull,
    combinedResult: undefined,
  };

  if (retryResultFull) {
    randomResult.combinedResult = mergeSimResults(randomResult, retryResultFull);
  }

  return randomResult;
}

/**
 * mergeSimResults — 모래시계 OFF 상태의 "올바른 전체 결과"를 만든다.
 *
 * 모집단 정의:
 *   전체(heroResults)      = firstWin판 + retry 전체(성공+실패)
 *   성공(winHeroResults)   = firstWin판 + retry 성공
 *   실패(loseHeroResults)  = retry 실패만
 *
 * "첫 시도 실패 판(첫판x)"은 의도적으로 제외한다 — 재시도로 성공할 수 있는
 * 판이므로 실패 bucket을 오염시키기 때문이다.
 */
function mergeSimResults(first: SimulationResult, retry: SimulationResult): SimulationResult {
  const firstWin = first.winSimCount ?? 0;
  const retryWin = retry.winSimCount ?? 0;
  const retryLose = retry.loseSimCount ?? 0;

  const totalAll = firstWin + retryWin + retryLose;
  const totalWin = firstWin + retryWin;
  const totalLose = retryLose;

  const wAvg = (aVal: number, aW: number, bVal: number, bW: number): number => {
    const w = aW + bW;
    return w > 0 ? (aVal * aW + bVal * bW) / w : 0;
  };
  const safeMin = (a: number | undefined, b: number | undefined): number | undefined => {
    if (a === undefined && b === undefined) return undefined;
    const m = Math.min(a ?? Infinity, b ?? Infinity);
    return m === Infinity ? 0 : m;
  };
  const safeMax = (a: number | undefined, b: number | undefined): number | undefined => {
    if (a === undefined && b === undefined) return undefined;
    return Math.max(a ?? 0, b ?? 0);
  };

  const mergeHero = (a: HeroSimResult, nA: number, b: HeroSimResult, nB: number): HeroSimResult => {
    const w = (av: number, bv: number) => wAvg(av, nA, bv, nB);
    return {
      ...a,
      survivalRate: nA + nB > 0 ? (((a.survivalRate / 100) * nA + (b.survivalRate / 100) * nB) / (nA + nB)) * 100 : 0,
      avgHpRemaining: w(a.avgHpRemaining, b.avgHpRemaining),
      avgDamageDealt: w(a.avgDamageDealt, b.avgDamageDealt),
      normalDmgDealtAvg: w(a.normalDmgDealtAvg, b.normalDmgDealtAvg),
      critDmgDealtAvg: w(a.critDmgDealtAvg, b.critDmgDealtAvg),
      avgDamagePerTurn: w(a.avgDamagePerTurn, b.avgDamagePerTurn),
      minDamageDealt: Math.min(a.minDamageDealt, b.minDamageDealt),
      maxDamageDealt: Math.max(a.maxDamageDealt, b.maxDamageDealt),
      minDamagePerTurn: safeMin(a.minDamagePerTurn, b.minDamagePerTurn),
      maxDamagePerTurn: safeMax(a.maxDamagePerTurn, b.maxDamagePerTurn),
      totalDamageTakenAvg: Math.round(w(a.totalDamageTakenAvg, b.totalDamageTakenAvg)),
      avgDamageTakenPerHit: Math.round(w(a.avgDamageTakenPerHit, b.avgDamageTakenPerHit)),
      avgDamageTakenPerTurn: Math.round(w(a.avgDamageTakenPerTurn, b.avgDamageTakenPerTurn)),
      totalDamageTakenAvgWhenHit: Math.round(w(a.totalDamageTakenAvgWhenHit ?? 0, b.totalDamageTakenAvgWhenHit ?? 0)),
      minDamageTaken: safeMin(a.minDamageTaken, b.minDamageTaken),
      maxDamageTaken: safeMax(a.maxDamageTaken, b.maxDamageTaken),
      minDamageTakenPerTurn: safeMin(a.minDamageTakenPerTurn, b.minDamageTakenPerTurn),
      maxDamageTakenPerTurn: safeMax(a.maxDamageTakenPerTurn, b.maxDamageTakenPerTurn),
      singleDmgTakenAvg: Math.round(w(a.singleDmgTakenAvg ?? 0, b.singleDmgTakenAvg ?? 0)),
      singleDmgTakenMin: safeMin(a.singleDmgTakenMin, b.singleDmgTakenMin),
      singleDmgTakenMax: safeMax(a.singleDmgTakenMax, b.singleDmgTakenMax),
      singleDmgTakenTotal: w(a.singleDmgTakenTotal ?? 0, b.singleDmgTakenTotal ?? 0),
      singleDmgTakenAvgWhenHit: Math.round(w(a.singleDmgTakenAvgWhenHit ?? 0, b.singleDmgTakenAvgWhenHit ?? 0)),
      aoeDmgTakenAvg: Math.round(w(a.aoeDmgTakenAvg ?? 0, b.aoeDmgTakenAvg ?? 0)),
      aoeDmgTakenMin: safeMin(a.aoeDmgTakenMin, b.aoeDmgTakenMin),
      aoeDmgTakenMax: safeMax(a.aoeDmgTakenMax, b.aoeDmgTakenMax),
      aoeDmgTakenTotal: w(a.aoeDmgTakenTotal ?? 0, b.aoeDmgTakenTotal ?? 0),
      aoeDmgTakenAvgWhenHit: Math.round(w(a.aoeDmgTakenAvgWhenHit ?? 0, b.aoeDmgTakenAvgWhenHit ?? 0)),
      evasionRate: w(a.evasionRate, b.evasionRate),
      tankingRate: w(a.tankingRate, b.tankingRate),
      singleTargetRate: w(a.singleTargetRate ?? 0, b.singleTargetRate ?? 0),
      aliveTurnsAvg: w(a.aliveTurnsAvg ?? 0, b.aliveTurnsAvg ?? 0),
      aliveTurnsMin: safeMin(a.aliveTurnsMin, b.aliveTurnsMin),
      aliveTurnsMax: safeMax(a.aliveTurnsMax, b.aliveTurnsMax),
      overallHpRemainAvg: Math.round(w(a.overallHpRemainAvg ?? 0, b.overallHpRemainAvg ?? 0)),
      overallHpRemainMin: safeMin(a.overallHpRemainMin, b.overallHpRemainMin),
      overallHpRemainMax: safeMax(a.overallHpRemainMax, b.overallHpRemainMax),
      totalHealingAvg: w(a.totalHealingAvg, b.totalHealingAvg),
      lordProtectionAvg: w(a.lordProtectionAvg, b.lordProtectionAvg),
      lordProtectionSimRate: w(a.lordProtectionSimRate ?? 0, b.lordProtectionSimRate ?? 0),
      lordProtectedSingleAvg: w(a.lordProtectedSingleAvg ?? 0, b.lordProtectedSingleAvg ?? 0),
      lordProtectedAoeAvg: w(a.lordProtectedAoeAvg ?? 0, b.lordProtectedAoeAvg ?? 0),
      lordAbsorbedSingleDmg: w(a.lordAbsorbedSingleDmg ?? 0, b.lordAbsorbedSingleDmg ?? 0),
      lordAbsorbedAoeDmg: w(a.lordAbsorbedAoeDmg ?? 0, b.lordAbsorbedAoeDmg ?? 0),
      critSurvivalCount: w(a.critSurvivalCount, b.critSurvivalCount),
      critSurvivalApplyRate: w(a.critSurvivalApplyRate ?? 0, b.critSurvivalApplyRate ?? 0),
      roundLimitAliveRate: w(a.roundLimitAliveRate ?? 0, b.roundLimitAliveRate ?? 0),
      hemmaAbsorbedDmg: Math.round(w(a.hemmaAbsorbedDmg ?? 0, b.hemmaAbsorbedDmg ?? 0)),
      hemmaAbsorbedCount: Math.round(w(a.hemmaAbsorbedCount ?? 0, b.hemmaAbsorbedCount ?? 0)),
      hemmaAtkGainAvg: Math.round(w(a.hemmaAtkGainAvg ?? 0, b.hemmaAtkGainAvg ?? 0)),
      rudoBonusDmgAvg: Math.round(w(a.rudoBonusDmgAvg ?? 0, b.rudoBonusDmgAvg ?? 0)),
      lordSavedSingleAvgDmg: Math.round(w(a.lordSavedSingleAvgDmg ?? 0, b.lordSavedSingleAvgDmg ?? 0)),
      lordSavedAoeAvgDmg: Math.round(w(a.lordSavedAoeAvgDmg ?? 0, b.lordSavedAoeAvgDmg ?? 0)),
      poloniaStolenAvg: w(a.poloniaStolenAvg ?? 0, b.poloniaStolenAvg ?? 0),
      innateLossCount:
        a.innateLossCount !== undefined || b.innateLossCount !== undefined
          ? w(a.innateLossCount ?? 0, b.innateLossCount ?? 0)
          : undefined,
      innateRegenCount:
        a.innateRegenCount !== undefined || b.innateRegenCount !== undefined
          ? w(a.innateRegenCount ?? 0, b.innateRegenCount ?? 0)
          : undefined,
      withInnateAvgDmg:
        a.withInnateAvgDmg !== undefined || b.withInnateAvgDmg !== undefined
          ? Math.round(w(a.withInnateAvgDmg ?? 0, b.withInnateAvgDmg ?? 0))
          : undefined,
      withoutInnateAvgDmg:
        a.withoutInnateAvgDmg !== undefined || b.withoutInnateAvgDmg !== undefined
          ? Math.round(w(a.withoutInnateAvgDmg ?? 0, b.withoutInnateAvgDmg ?? 0))
          : undefined,
    };
  };

  const firstWinHeroes = first.winHeroResults ?? first.heroResults;
  const retryAllHeroes = retry.heroResults;
  const retryWinHeroes = retry.winHeroResults;
  const retryLoseHeroes = retry.loseHeroResults;

  const mergedHeroResults: HeroSimResult[] = firstWinHeroes.map((fh, i) =>
    mergeHero(fh, firstWin, retryAllHeroes[i] ?? fh, retryWin + retryLose),
  );

  const mergedWinHeroResults: HeroSimResult[] | undefined =
    totalWin > 0 && retryWinHeroes
      ? firstWinHeroes.map((fh, i) => {
          const merged = mergeHero(fh, firstWin, retryWinHeroes[i] ?? fh, retryWin);
          const rw = retryWinHeroes[i];
          merged.winHpRemainAvg =
            firstWin + retryWin > 0
              ? Math.round(
                  ((fh.winHpRemainAvg ?? 0) * firstWin + (rw?.winHpRemainAvg ?? 0) * retryWin) / (firstWin + retryWin),
                )
              : 0;
          merged.winHpRemainMin = safeMin(fh.winHpRemainMin, rw?.winHpRemainMin);
          merged.winHpRemainMax = safeMax(fh.winHpRemainMax, rw?.winHpRemainMax);
          return merged;
        })
      : totalWin > 0
        ? firstWinHeroes
        : undefined;

  const mergedLoseHeroResults: HeroSimResult[] | undefined = totalLose > 0 ? retryLoseHeroes : undefined;

  const mergeAgg = (
    a: PartyAggregate | undefined,
    nA: number,
    b: PartyAggregate | undefined,
    nB: number,
  ): PartyAggregate | undefined => {
    if (!a && !b) return undefined;
    const w = nA + nB;
    const mn = Math.min(a?.min ?? Infinity, b?.min ?? Infinity);
    return {
      min: mn === Infinity ? 0 : mn,
      avg: w > 0 ? Math.round(((a?.avg ?? 0) * nA + (b?.avg ?? 0) * nB) / w) : 0,
      max: Math.max(a?.max ?? 0, b?.max ?? 0),
    };
  };

  const mergeRounds = (
    a: { avg: number; min: number; max: number } | undefined,
    nA: number,
    b: { avg: number; min: number; max: number } | undefined,
    nB: number,
  ) => {
    if (!a && !b) return undefined;
    const w = nA + nB;
    const mn = Math.min(a?.min ?? Infinity, b?.min ?? Infinity);
    return {
      avg: w > 0 ? Math.round((((a?.avg ?? 0) * nA + (b?.avg ?? 0) * nB) / w) * 100) / 100 : 0,
      min: mn === Infinity ? 0 : mn,
      max: Math.max(a?.max ?? 0, b?.max ?? 0),
    };
  };

  // For 모래시계 OFF 전체: first-win sims contribute their win-rounds (not first.avgRounds which includes
  // first-fail rounds that were superseded by retry). Retry sims contribute all their rounds (win + lose).
  const firstWinAvgR = first.winRounds?.avg ?? 0;
  const firstWinMinR = first.winRounds?.min ?? Infinity;
  const firstWinMaxR = first.winRounds?.max ?? 0;
  const mergedAvgRounds =
    totalAll > 0
      ? Math.round(((firstWinAvgR * firstWin + retry.avgRounds * (retryWin + retryLose)) / totalAll) * 100) / 100
      : 0;
  const mergedMinR = Math.min(firstWinMinR, retry.minRounds ?? Infinity);

  return {
    winRate: first.winRate,
    rawWinRate: first.rawWinRate,
    retryWinRate: first.retryWinRate,
    avgRounds: mergedAvgRounds,
    minRounds: mergedMinR === Infinity ? 0 : mergedMinR,
    maxRounds: Math.max(firstWinMaxR, retry.maxRounds ?? 0),
    heroResults: mergedHeroResults,
    winHeroResults: mergedWinHeroResults,
    loseHeroResults: mergedLoseHeroResults,
    winSimCount: totalWin,
    loseSimCount: totalLose,
    roundLimitRate:
      totalAll > 0
        ? (((first.roundLimitRate / 100) * firstWin + (retry.roundLimitRate / 100) * (retryWin + retryLose)) /
            totalAll) *
          100
        : 0,
    totalSimulations: totalAll,
    retrySimulations: first.retrySimulations,
    retryResult: undefined,
    combinedResult: undefined,
    winRounds: mergeRounds(first.winRounds, firstWin, retry.winRounds, retryWin),
    loseRounds: totalLose > 0 ? retry.loseRounds : undefined,
    partyDmgDealt: mergeAgg(first.winPartyDmgDealt, firstWin, retry.partyDmgDealt, retryWin + retryLose),
    partyDmgPerTurn: mergeAgg(first.winPartyDmgPerTurn, firstWin, retry.partyDmgPerTurn, retryWin + retryLose),
    partyDmgTaken: mergeAgg(first.winPartyDmgTaken, firstWin, retry.partyDmgTaken, retryWin + retryLose),
    partyDmgTakenPerTurn: mergeAgg(
      first.winPartyDmgTakenPerTurn,
      firstWin,
      retry.partyDmgTakenPerTurn,
      retryWin + retryLose,
    ),
    winPartyDmgDealt: mergeAgg(first.winPartyDmgDealt, firstWin, retry.winPartyDmgDealt, retryWin),
    winPartyDmgPerTurn: mergeAgg(first.winPartyDmgPerTurn, firstWin, retry.winPartyDmgPerTurn, retryWin),
    winPartyDmgTaken: mergeAgg(first.winPartyDmgTaken, firstWin, retry.winPartyDmgTaken, retryWin),
    winPartyDmgTakenPerTurn: mergeAgg(first.winPartyDmgTakenPerTurn, firstWin, retry.winPartyDmgTakenPerTurn, retryWin),
    losePartyDmgDealt: retry.losePartyDmgDealt,
    losePartyDmgPerTurn: retry.losePartyDmgPerTurn,
    losePartyDmgTaken: retry.losePartyDmgTaken,
    losePartyDmgTakenPerTurn: retry.losePartyDmgTakenPerTurn,
    poloniaLoot: first.poloniaLoot,
    eventLog: undefined,
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
  type:
    | "attack"
    | "crit"
    | "damage"
    | "dodge"
    | "heal"
    | "death"
    | "stat"
    | "event"
    | "result"
    | "retry"
    | "monster_attack"
    | "hero_attack"
    | "execute"
    | "survive"
    | "lord_save";
  actor: string;
  target?: string;
  detail: string;
  values?: Record<string, number | string>;
}

function toLegacyCombatLog(
  entries: CombatLogEntry[],
  config: SimulationConfig,
  mobDisplayName?: string,
): CombatLogEntry[] {
  // 로그에는 항상 "몬스터"로 표시 (미니보스 이름은 setup 이벤트 values에만 전달)
  const monsterName = "몬스터";

  const pct = (hp: number, maxHp: number): number => {
    if (!maxHp || maxHp <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
  };
  const hpText = (name: string, hp: number, maxHp: number): string =>
    `${name} HP: ${formatNum(Math.max(0, hp))} (${pct(hp, maxHp)}%)`;

  const legacy: CombatLogEntry[] = [];
  let actualMonsterMaxHp = config.monster.hp;
  // HP map for hero HP tracking (for heal display)
  const heroMaxHp: Record<string, number> = {};

  for (const entry of entries) {
    const values = entry.values ?? {};

    // ── 몬스터 스탯 이벤트 → 전투 시작 이벤트
    if (entry.type === "stat" && entry.detail.includes("몬스터 스탯")) {
      const hp = typeof values.hp === "number" ? values.hp : config.monster.hp;
      actualMonsterMaxHp = hp;
      legacy.push({
        round: entry.round,
        type: "event",
        actor: "시스템",
        detail: `전투 시작! ${monsterName} HP: ${formatNum(hp)}`,
        values,
      });
      continue;
    }

    // ── 영웅 초기 스탯 이벤트 → maxHp 추출 후 event 표시
    if (entry.type === "stat") {
      if (typeof values.hp === "number") heroMaxHp[entry.actor] = values.hp as number;
      legacy.push({ ...entry, type: "event" });
      continue;
    }

    // ── 영웅 공격: attack/crit → hero_attack
    if (entry.type === "attack" || entry.type === "crit") {
      const dmg = typeof values.dmg === "number" ? values.dmg : 0;
      const mobHpCur = typeof values.mobHp === "number" ? values.mobHp : actualMonsterMaxHp;
      const mobMaxHp2 = typeof values.mobMaxHp === "number" ? values.mobMaxHp : actualMonsterMaxHp;
      legacy.push({
        round: entry.round,
        type: "hero_attack",
        actor: entry.actor,
        target: monsterName,
        detail: `${entry.type === "crit" ? "치명타 " : ""}${formatNum(dmg)} 피해 (${hpText(monsterName, mobHpCur, mobMaxHp2)})`,
        values,
      });
      continue;
    }

    // ── 처형: execute → hero_attack (처형 문구 포함)
    if (entry.type === "execute") {
      const dmg = typeof values.dmg === "number" ? values.dmg : 0;
      legacy.push({
        round: entry.round,
        type: "hero_attack",
        actor: entry.actor,
        target: monsterName,
        detail: entry.detail,
        values,
      });
      continue;
    }

    // ── 몬스터 피해: damage → monster_attack
    if (entry.type === "damage") {
      const targetName = entry.target ?? entry.actor;
      const dmg = typeof values.dmg === "number" ? values.dmg : 0;
      const hp = typeof values.hp === "number" ? values.hp : 0;
      const maxHp = typeof values.maxHp === "number" ? values.maxHp : heroMaxHp[targetName] || 0;
      const isAoe = entry.detail.includes("[광역]");
      const isCrit2 = entry.detail.includes("치명");
      legacy.push({
        round: entry.round,
        type: "monster_attack",
        actor: monsterName,
        target: targetName,
        detail: `${isAoe ? "광역 공격 " : ""}${isCrit2 ? "치명타 " : ""}${formatNum(dmg)} 피해 (${hpText(targetName, hp, maxHp)})`,
        values,
      });
      continue;
    }

    // ── 회피: dodge → event (회피)
    if (entry.type === "dodge") {
      legacy.push({
        round: entry.round,
        type: "event",
        actor: monsterName,
        target: entry.actor,
        detail: "회피",
        values,
      });
      continue;
    }

    // ── 치명타 생존: survive → event (survive 아이콘용)
    if (entry.type === "survive") {
      legacy.push({
        round: entry.round,
        type: "survive" as any,
        actor: entry.actor,
        detail: "치명타 생존 발동! 대미지 무시",
        values,
      });
      continue;
    }

    // ── 군주 보호: lord_save → event (군주 actor)
    if (entry.type === "lord_save") {
      legacy.push({ round: entry.round, type: "event", actor: entry.actor, detail: entry.detail, values });
      continue;
    }

    // ── 사망: death → event (사망!)
    if (entry.type === "death") {
      legacy.push({ round: entry.round, type: "event", actor: entry.actor, detail: "사망!", values });
      continue;
    }

    // ── 회복: heal → heal (원본 포맷)
    if (entry.type === "heal") {
      const heal = typeof values.heal === "number" ? values.heal : 0;
      const hp = typeof values.hp === "number" ? values.hp : 0;
      const maxHp = typeof values.maxHp === "number" ? values.maxHp : heroMaxHp[entry.actor] || 0;
      legacy.push({
        round: entry.round,
        type: "heal",
        actor: entry.actor,
        detail: `체력 ${formatNum(heal)} 회복 (${hpText(entry.actor, hp, maxHp)})`,
        values,
      });
      continue;
    }

    // ── AoE 광역공격 시작 이벤트: "광역 공격 발동!" → monster_attack (아이콘 맞춤)
    if (entry.type === "event" && entry.actor === "몬스터" && entry.detail.includes("광역 공격 발동")) {
      legacy.push({ round: entry.round, type: "monster_attack", actor: monsterName, detail: entry.detail, values });
      continue;
    }

    // ── 헴마 드레인: damage detail에 "헴마 드레인" 포함 → 이미 damage로 처리됨
    // 헴마 ATK 증가: event 그대로 통과
    // 나머지: 그대로 통과
    legacy.push(entry);
  }

  return legacy;
}

export function runSingleCombatLog(config: SimulationConfig): CombatLogEntry[] {
  // 1회 전투 로그는 메인 시뮬레이션 엔진을 그대로 사용한다.
  // 단, UI는 원본 CombatBattlefield가 기대하는 legacy log 포맷을 유지한다.

  // recordEvents 모드는 simulationCount=1을 강제하며, retry는 별도 처리한다.
  const firstResult = runCombatSimulation({
    ...config,
    recordEvents: true,
    simulationCount: 1,
    _disableRetry: true, // 내부 retry를 막고 여기서 직접 관리
  });
  const firstRawLog = firstResult.eventLog ?? [
    { round: 0, type: "result" as const, actor: "시스템", detail: "이벤트 로그 없음" },
  ];

  // mobDisplayName: 몬스터 스탯 이벤트의 actor에서 추출
  const mobDisplayName = firstRawLog.find((e) => e.type === "stat" && e.detail.includes("몬스터 스탯"))?.actor;

  const firstLegacy = toLegacyCombatLog(firstRawLog, config, mobDisplayName);

  // 1회전 패배 + 페이트위버 or 크로노맨서 → retry 배틀 로그 추가
  const firstWon = firstRawLog.some((e) => e.type === "result" && e.detail.includes("승리"));
  const activeHeroes = config.heroes.filter((h) => h.hp > 0);
  const hasFateweaver = activeHeroes.some((h) => isClass(h, "페이트위버", "운명직공", "Fateweaver"));
  const hasChronos = !hasFateweaver && activeHeroes.some((h) => isClass(h, "크로노맨서", "Chronomancer"));

  if (!firstWon && (hasFateweaver || hasChronos)) {
    const retryConfig = {
      ...config,
      recordEvents: true,
      simulationCount: 1,
      _isRetry: true,
      _disableRetry: true,
      booster: hasFateweaver ? getRetryBooster(config.booster) : config.booster,
    };
    const retryResult = runCombatSimulation(retryConfig);
    const retryRawLog = retryResult.eventLog ?? [];

    // 재시도 구분선 삽입
    const lastRound = firstRawLog.length > 0 ? firstRawLog[firstRawLog.length - 1].round : 0;
    const retryBanner: CombatLogEntry = {
      round: lastRound,
      type: "retry",
      actor: hasFateweaver ? "페이트위버" : "크로노맨서",
      detail: hasFateweaver ? "페이트위버: 재시도 (+20% 보너스 적용)" : "크로노맨서: 재시도",
    };

    const retryLegacy = toLegacyCombatLog(retryRawLog, retryConfig, mobDisplayName);
    return [...firstLegacy, retryBanner, ...retryLegacy];
  }

  return firstLegacy;
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString();
}

function emptyResult(simCount: number): SimulationResult {
  return {
    winRate: 0,
    rawWinRate: 0,
    avgRounds: 0,
    minRounds: 0,
    maxRounds: 0,
    heroResults: [],
    roundLimitRate: 0,
    totalSimulations: simCount,
  };
}
