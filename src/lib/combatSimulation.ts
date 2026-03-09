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

export type MiniBossType = 'none' | 'agile' | 'dire' | 'huge' | 'wealthy' | 'legendary';

export interface BoosterType {
  type: 'none' | 'normal' | 'super' | 'mega';
  // Extra flat bonuses stacked on top (e.g., Fateweaver retry adds +20%/+20%)
  extraAtkBonus?: number;
  extraDefBonus?: number;
  extraCritChance?: number;
  extraCritMult?: number;
}

export interface SimulationConfig {
  heroes: Hero[];
  monster: QuestMonster;
  miniBoss: MiniBossType;
  booster: BoosterType;
  questTypeKey: string;      // 'normal' | 'flash' | 'lcog' | 'tot'
  regionName: string;        // e.g. '공포'
  isTerrorTower: boolean;    // 공포의 탑 (5% damage)
  simulationCount?: number;  // Default 50000
  _isRetry?: boolean;        // Internal: prevents Fateweaver recursion
}

export interface HeroSimResult {
  heroId: string;
  heroName: string;
  survivalRate: number;      // %
  avgHpRemaining: number;
  maxHpRemaining: number;
  avgDamageDealt: number;
  maxDamageDealt: number;
  minDamageDealt: number;
  // Incoming damage stats (per hit, not total)
  normalDamageTaken: number;     // Single normal hit damage
  aoeDamageTaken: number;        // Single AoE hit damage
  critDamageTakenVal: number;    // Single crit hit damage
  // Shark stats
  sharkNormalDmg: number;        // Normal attack damage when shark active (+bonus)
  sharkCritDmg: number;          // Crit attack damage when shark active
  // Final stat snapshots used in simulation
  finalAtk: number;
  finalDef: number;
  finalHp: number;
  finalCritChance: number;       // %
  finalCritDmg: number;          // %
  finalEvasion: number;          // %
}

export interface SimulationResult {
  winRate: number;           // % (after Fateweaver retry if applicable)
  rawWinRate: number;        // % (first attempt, before retry)
  retryWinRate?: number;     // % (second attempt with booster, if Fateweaver)
  avgRounds: number;
  minRounds: number;
  maxRounds: number;
  heroResults: HeroSimResult[];
  roundLimitRate: number;    // % of sims hitting 499 round limit
  totalSimulations: number;
  retrySimulations?: number; // Number of retry sims (if Fateweaver)
}

// ─── Class/Job mapping (Korean → English equivalent for logic) ───────────────

const CLASS_LINE_MAP: Record<string, 'fighter' | 'rogue' | 'spellcaster'> = {
  '전사': 'fighter',
  '로그': 'rogue',
  '주문술사': 'spellcaster',
};

// Fighter classes
const FIGHTER_CLASSES = ['용병', '기사', '사무라이', '다이묘', '광전사', '야를', '암흑기사', '데스나이트', 'Mercenary', 'Lord', 'Samurai', 'Daimyo', 'Berserker/Jarl', 'Dark Knight', 'Death Knight'];
// Rogue classes
const ROGUE_CLASSES = ['트릭스터', '정복자', '길잡이', '닌자', '센세이', '댄서', '아크로뱃', 'Trickster', 'Conquistador', 'Pathfinder', 'Ninja', 'Sensei', 'Dancer/Acrobat'];
// Spellcaster classes
const SPELLCASTER_CLASSES = ['주교', '성직자', '크로노맨서', '운명직공', '비숍', '클레릭', 'Bishop', 'Cleric', 'Chronomancer', 'Fateweaver'];

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

// ─── Flash quest (깜짝 퀘스트) Bjorn multiplier zones ─────────────────────────

const BJORN_DOUBLE_ZONES = [
  'Ancient Crustacean', 'Anubis Champion', 'Cyclops General', 'Cyclops Merchant',
  'Gold Golem', 'Moonstone Golem', 'Mushgoon Graverobber', 'Runestone Golem',
  'Scholarly Harpy', 'Sigil Ninja', 'Toad Sage', 'Training Instructor',
  'Troublin Blacksmith', 'Troublin Pirate',
];

// ─── Damage Calculation ──────────────────────────────────────────────────────

function calcDamageTaken(heroDef: number, mobDamage: number, mobCap: number): number {
  // Piecewise linear damage reduction based on defense vs cap
  // Cap at 75% reduction (0.25x damage minimum)
  let dmg: number;
  if (heroDef <= mobCap / 6) {
    dmg = Math.round(1.5 * mobDamage + ((heroDef - 0) / (mobCap / 6 - 0)) * (0.5 * mobDamage - 1.5 * mobDamage));
  } else if (heroDef <= mobCap / 3) {
    dmg = Math.round(0.5 * mobDamage + ((heroDef - mobCap / 6) / (mobCap / 3 - mobCap / 6)) * (0.3 * mobDamage - 0.5 * mobDamage));
  } else {
    dmg = Math.round(0.3 * mobDamage + ((heroDef - mobCap / 3) / (mobCap - mobCap / 3)) * (0.25 * mobDamage - 0.3 * mobDamage));
  }
  // Floor at 25% of mob damage (75% max reduction)
  return Math.max(dmg, Math.round(0.25 * mobDamage));
}

function calcCritDamageTaken(normalDmg: number, mobDamage: number): number {
  // Crit damage = max(normal_damage, mob_damage) × 1.5
  return Math.round(Math.max(normalDmg, mobDamage) * 1.5);
}

// ─── Main Simulation ─────────────────────────────────────────────────────────

export function runCombatSimulation(config: SimulationConfig): SimulationResult {
  const { heroes, monster, miniBoss, booster, questTypeKey, isTerrorTower } = config;
  const simCount = config.simulationCount || 50000;

  // Filter out heroes with 0 HP (empty slots)
  const activeHeroes = heroes.filter(h => h.hp > 0);
  if (activeHeroes.length === 0) {
    return emptyResult(simCount);
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
      mobAoeChanceMod = 2.0;
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
    const tier = getHeroTier(h);
    heroTier.push(tier);

    // Base stats - these are already final display values from the hero data
    // In the original script, atk/def are un-modded then re-modded
    // Here we use the hero's stats directly as they represent the solo hero's final stats
    heroAtk.push(h.atk || 0);
    heroDef.push(h.def || 0);
    heroHpMax.push(h.hp || 0);
    heroCritChance.push((h.crit || 0) / 100);
    heroCritMult.push((h.critDmg || 0) / 100);
    heroEvasion.push((h.evasion || 0) / 100);
    heroThreat.push(h.threat || 1);

    // Evasion cap: Pathfinder = 78%, others = 75%
    heroEvaCap.push(isClass(h, '길잡이', 'Pathfinder') ? 0.78 : 0.75);

    // Equipment artifacts
    const hasRockStompers = h.equipmentSlots?.some(s => s.item?.name === '락 스톰퍼') || false;
    heroArtNoEvasion.push(hasRockStompers);
    
    const hasKiku = h.equipmentSlots?.some(s => s.item?.name === '키쿠이치몬지') || false;
    heroArtCritChanceMod.push(hasKiku ? 0 : 1);
    
    const hasLoneWolf = h.equipmentSlots?.some(s => s.item?.name === '고독한 늑대 두건') || false;
    heroArtChampionMod.push(hasLoneWolf ? 0 : 1);

    // Class flags
    heroIsNinja.push(isClass(h, '닌자', 'Ninja'));
    heroIsSensei.push(isClass(h, '센세이', 'Sensei'));
    heroIsSamurai.push(isClass(h, '사무라이', 'Samurai'));
    heroIsDaimyo.push(isClass(h, '다이묘', 'Daimyo'));
    heroIsDancer.push(isClass(h, '댄서', '아크로뱃', 'Dancer', 'Acrobat'));
    heroIsConquistador.push(isClass(h, '정복자', 'Conquistador'));
    heroIsDarkKnight.push(isClass(h, '암흑기사', '데스나이트', 'Dark Knight', 'Death Knight'));
    heroIsLord.push(isClass(h, '기사', 'Lord'));
    heroIsMercenary.push(isMercenary(h));
    heroIsCleric.push(isClass(h, '클레릭', '성직자', 'Cleric'));
    heroIsBishop.push(isClass(h, '비숍', '주교', 'Bishop'));

    // Berserker level
    heroBerserkerLevel.push(isClass(h, '광전사', '야를', 'Berserker', 'Jarl') ? Math.min(tier, 4) : 0);

    // Spirits - these would need to come from equipment; default 0
    // TODO: implement spirit reading from equipment
    heroMundra.push(0);
    heroShark.push(0);
    heroDinosaur.push(0);
    heroLizard.push(0);
    heroArmadillo.push(0);
  }

  // ─── Extreme: Apply -20% evasion penalty ───
  if (isExtreme) {
    for (let i = 0; i < numHeroes; i++) {
      if (!heroArtNoEvasion[i]) {
        heroEvasion[i] = heroEvasion[i] - 0.20;
      }
    }
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

  // Find Lord and Fateweaver
  for (let i = 0; i < numHeroes; i++) {
    if (heroIsLord[i]) { lordPresent = true; lordHero = i; }
    if (isClass(activeHeroes[i], '크로노맨서', '운명직공', 'Chronomancer', 'Fateweaver')) {
      fateweaverPresent = true;
    }
  }

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

  // ─── Apply champion + booster to base stats ───
  // Per Korean doc: final = base × (1 + (champ + aurasong) × mercMult + booster)
  // Mercenary: champion and aurasong bonuses are multiplied by 1.25
  const finalAtk: number[] = [];
  const finalDef: number[] = [];
  const finalHp: number[] = [];

  for (let i = 0; i < numHeroes; i++) {
    const mercMult = heroIsMercenary[i] ? 1.25 : 1.0;
    const champModI = heroArtChampionMod[i];
    // aurasong bonus would go here too (TODO: implement aurasong)
    const aurasongAtk = 0, aurasongDef = 0, aurasongHp = 0;

    finalAtk.push(heroAtk[i] * (1.0 + (champAtkBonus * champModI + aurasongAtk) * mercMult + boosterAtkBonus));
    finalDef.push(heroDef[i] * (1.0 + (champDefBonus * champModI + aurasongDef) * mercMult + boosterDefBonus));
    finalHp.push(heroHpMax[i] * (1.0 + (champHpBonus * champModI + aurasongHp) * mercMult));
  }

  // ─── Damage taken calculation ───
  const damageTaken: number[] = [];
  const critDamageTaken: number[] = [];

  for (let i = 0; i < numHeroes; i++) {
    const dmg = calcDamageTaken(finalDef[i], mobDamage, mobCap);
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
      const elVal = h.equipmentElements?.[barrierEl] || 0;
      // "Any" element = 50% effectiveness
      if (h.element === barrierEl || h.element === '모든 원소' || h.element === '전체') {
        totalBarrierDmg += elVal;
      } else if (barrierEl === '랜덤') {
        // Random barrier - use all element values at 100%
        totalBarrierDmg += elVal;
      } else {
        // Check if hero has matching element through equipment
        totalBarrierDmg += h.equipmentElements?.[barrierEl] || 0;
      }
    });

    // Rudo barrier bonus (tier 3+: 50% more barrier damage)
    if ((champName.includes('루도') || champName === 'Rudo') && champTier >= 3) {
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
    else if (champTier === 2) { rudoBonusBase = 0.4; rudoRounds = 2; }
    else if (champTier === 3) { rudoBonusBase = 0.5; rudoRounds = 3; }
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

  const timesSurvived = new Float64Array(numHeroes);
  const damageDealtAvg = new Float64Array(numHeroes);
  const damageDealtMax = new Float64Array(numHeroes);
  const damageDealtMin = new Float64Array(numHeroes).fill(1e9);
  const hpRemainingAvg = new Float64Array(numHeroes);
  const hpRemainingMax = new Float64Array(numHeroes);

  // Tamas random range
  const isTamas = champName.includes('타마스') || champName === 'Tamas';
  const tamasMin = isTamas ? (champTier < 3 ? 0.05 + 0.05 * champTier : 0.1 * champTier) : 0;
  const tamasMax = isTamas ? tamasMin * 2 : 0;

  let actualSimCount = simCount;

  for (let sim = 0; sim < actualSimCount; sim++) {
    // Per-simulation state
    const hp = new Float64Array(numHeroes);
    const damageFight = new Float64Array(numHeroes);
    const surviveChance = new Float64Array(numHeroes);
    const berserkerStage = new Int32Array(numHeroes);
    const guaranteedCrit = new Uint8Array(numHeroes);
    const guaranteedEvade = new Uint8Array(numHeroes);
    const ninjaBonus = new Float64Array(numHeroes);
    const ninjaEvasion = new Float64Array(numHeroes);
    const lostInnate = new Int32Array(numHeroes).fill(-5);
    const consecutiveCritBonus = new Float64Array(numHeroes);
    const hemmaBonus = new Float64Array(numHeroes);

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

          const totalEva = heroEvasion[i] + berserkerStage[i] * 0.1 + ninjaEvasion[i];
          const cappedEva = Math.min(totalEva, heroEvaCap[i]);

          if (guaranteedEvade[i] || (Math.random() < cappedEva && !heroArtNoEvasion[i])) {
            // Evaded
            if (heroIsDancer[i]) guaranteedCrit[i] = 1;
          } else {
            // Hit - AoE uses normal damage × aoe ratio
            const isCrit = Math.random() < baseMobCritChance * mobCritChanceMod + extremeCritBonus[i];
            const dmg = isCrit
              ? Math.ceil(critDamageTaken[i] * mobAoeDmgRatio)
              : Math.ceil(damageTaken[i] * mobAoeDmgRatio);
            hp[i] -= dmg;

            if (hp[i] <= 0) {
              const survived = handleFatalBlow(i);
              if (!survived) {
                // Lord save check
                if (lordPresent && lordSave && !heroIsLord[i] && hp[lordHero] > 0) {
                  lordSave = false;
                  hp[i] += dmg; // Restore this hero
                  const lordDmg = Math.ceil(damageTaken[lordHero] * mobAoeDmgRatio);
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

        const totalEva = heroEvasion[target] + berserkerStage[target] * 0.1 + ninjaEvasion[target];
        const cappedEva = Math.min(totalEva, heroEvaCap[target]);

        if (guaranteedEvade[target] || (Math.random() < cappedEva && !heroArtNoEvasion[target])) {
          if (heroIsDancer[target]) guaranteedCrit[target] = 1;
        } else {
          const isCrit = Math.random() < baseMobCritChance * mobCritChanceMod + extremeCritBonus[target];
          const dmg = isCrit ? critDamageTaken[target] : damageTaken[target];
          hp[target] -= dmg;

          if (hp[target] <= 0) {
            const survived = handleFatalBlow(target);
            if (!survived) {
              if (lordPresent && lordSave && !heroIsLord[target] && hp[lordHero] > 0) {
                lordSave = false;
                hp[target] += dmg;
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
        if (heroBerserkerLevel[i] > 0) {
          if (hp[i] >= berserkHp1[i] * finalHp[i]) berserkerStage[i] = 0;
          else if (hp[i] >= berserkHp2[i] * finalHp[i]) berserkerStage[i] = 1;
          else if (hp[i] >= berserkHp3[i] * finalHp[i]) berserkerStage[i] = 2;
          else if (hp[i] > 0) berserkerStage[i] = 3;
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
      if (mobHpCurrent <= 0) {
        contFight = false;
        timesQuestWon++;
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] > 0) timesSurvived[i]++;
          hpRemainingAvg[i] += Math.max(hp[i], 0);
          hpRemainingMax[i] = Math.max(hpRemainingMax[i], hp[i]);
        }
        roundsAvg += round;
        roundsMax = Math.max(roundsMax, round);
        roundsMin = Math.min(roundsMin, round);
      }

      if (heroesAlive === 0) contFight = false;

      if (contFight && round >= 499) {
        contFight = false;
        roundLimitTimes++;
      }

      if (!contFight) {
        for (let i = 0; i < numHeroes; i++) {
          damageDealtAvg[i] += damageFight[i];
          damageDealtMax[i] = Math.max(damageDealtMax[i], damageFight[i]);
          damageDealtMin[i] = Math.min(damageDealtMin[i], damageFight[i]);
        }
      }

      // ─── Healing (Lizard, Cleric, Bishop, Lilu) ───
      if (contFight) {
        for (let i = 0; i < numHeroes; i++) {
          if (hp[i] <= 0) continue;
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
  if (fateweaverPresent && rawWinRate < 100 && !config._isRetry) {
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

  const heroResults: HeroSimResult[] = activeHeroes.map((h, i) => ({
    heroId: h.id,
    heroName: h.name,
    survivalRate: (timesSurvived[i] / actualSimCount) * 100,
    avgHpRemaining: hpRemainingAvg[i] / actualSimCount,
    maxHpRemaining: hpRemainingMax[i],
    avgDamageDealt: damageDealtAvg[i] / actualSimCount,
    maxDamageDealt: damageDealtMax[i],
    minDamageDealt: damageDealtMin[i] >= 1e9 ? 0 : damageDealtMin[i],
  }));

  return {
    winRate: Math.round(winRate * 100) / 100,
    rawWinRate: Math.round(rawWinRate * 100) / 100,
    retryWinRate: retryWinRate !== undefined ? Math.round(retryWinRate * 100) / 100 : undefined,
    avgRounds: timesQuestWon > 0 ? Math.round((roundsAvg / timesQuestWon) * 100) / 100 : 0,
    minRounds: roundsMin >= 1000 ? 0 : roundsMin,
    maxRounds: roundsMax,
    heroResults,
    roundLimitRate: (roundLimitTimes / actualSimCount) * 100,
    totalSimulations: actualSimCount,
    retrySimulations,
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
  const { heroes, monster, miniBoss, booster, isTerrorTower } = config;
  const log: CombatLogEntry[] = [];
  const activeHeroes = heroes.filter(h => h.hp > 0);
  if (activeHeroes.length === 0) return [{ round: 0, type: 'result', actor: '시스템', detail: '활성 영웅 없음' }];

  const numHeroes = activeHeroes.length;
  const isExtreme = monster.isExtreme || isTerrorTower;

  // Mini boss modifiers
  let mobHpMod = 1.0, mobDamageMod = 1.0, mobCritChanceMod = 1.0;
  let mobEvasion = -1.0, mobAoeChanceMod = 1.0;
  switch (miniBoss) {
    case 'agile': mobEvasion = 0.4; break;
    case 'dire': mobHpMod = 1.5; mobCritChanceMod = 3.0; break;
    case 'huge': mobHpMod = 2.0; mobAoeChanceMod = 2.0; break;
    case 'wealthy': break; // No stat changes
    case 'legendary': mobHpMod = 1.5; mobDamageMod = 1.25; mobCritChanceMod = 1.5; mobEvasion = 0.1; break;
  }

  const mobCap = monster.def.r0;
  let mobDamage = Math.round(monster.atk * mobDamageMod);
  if (isTerrorTower) mobDamage = Math.round(mobDamage * 0.05);
  const mobAoeDmgRatio = monster.aoe / monster.atk;
  const mobAoeChance = (monster.aoeChance / 100) * mobAoeChanceMod;
  const baseMobCritChance = 0.10;

  // Barrier check
  let barrierMod = 1.0;
  if (monster.barrier && monster.barrier.hp > 0 && monster.barrierElement) {
    let totalEl = 0;
    activeHeroes.forEach(h => {
      totalEl += h.equipmentElements?.[monster.barrierElement!] || 0;
    });
    if (totalEl < monster.barrier.hp) {
      barrierMod = 0.2;
      log.push({ round: 0, type: 'event', actor: '시스템', detail: `원소 배리어 미돌파! 대미지 ${barrierMod * 100}%로 제한`, values: { heroSum: totalEl, required: monster.barrier.hp } });
    } else {
      log.push({ round: 0, type: 'event', actor: '시스템', detail: `원소 배리어 돌파! (${totalEl} ≥ ${monster.barrier.hp})` });
    }
  }

  if (miniBoss !== 'none') {
    log.push({ round: 0, type: 'event', actor: '시스템', detail: `미니보스: ${miniBoss} (HP ×${mobHpMod}, ATK ×${mobDamageMod}, 치확 ×${mobCritChanceMod})` });
  }

  // Setup hero stats
  const boosterAtkPct = booster.type === 'mega' ? 0.8 : booster.type === 'super' ? 0.4 : booster.type === 'normal' ? 0.2 : 0;
  const boosterDefPct = boosterAtkPct;

  const heroHp: number[] = [];
  const heroMaxHp: number[] = [];
  const heroAtkVal: number[] = [];
  const heroDefVal: number[] = [];
  const heroCrit: number[] = [];
  const heroCritMult: number[] = [];
  const heroEva: number[] = [];
  const heroThreatVal: number[] = [];
  const heroDmgDealt: number[] = [];

  for (let i = 0; i < numHeroes; i++) {
    const h = activeHeroes[i];
    const atkFinal = Math.floor((h.atk || 0) * (1 + boosterAtkPct));
    const defFinal = Math.floor((h.def || 0) * (1 + boosterDefPct));
    heroMaxHp.push(h.hp || 0);
    heroHp.push(h.hp || 0);
    heroAtkVal.push(atkFinal);
    heroDefVal.push(defFinal);
    heroCrit.push(Math.min((h.crit || 0) / 100, 1.0));
    heroCritMult.push((h.critDmg || 0) / 100);
    let eva = (h.evasion || 0) / 100;
    if (isExtreme) eva -= 0.2;
    const hasRockStompers = h.equipmentSlots?.some(s => s.item?.name === '락 스톰퍼') || false;
    if (hasRockStompers) eva = 0;
    heroEva.push(hasRockStompers ? 0 : Math.min(eva, 0.75));
    heroThreatVal.push(h.threat || 1);
    heroDmgDealt.push(0);
  }

  const totalMobHp = Math.round(monster.hp * mobHpMod);
  log.push({ round: 0, type: 'event', actor: '시스템', detail: `전투 시작! 몬스터 HP: ${formatNum(totalMobHp)}, 영웅 ${numHeroes}명` });

  let mobHpCurrent = totalMobHp;
  let heroesAlive = numHeroes;
  const MAX_ROUNDS = 100;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (mobHpCurrent <= 0 || heroesAlive <= 0) break;

    // Monster attack
    const totalThreat = heroThreatVal.reduce((s, t, i) => heroHp[i] > 0 ? s + t : s, 0);
    const isAoe = Math.random() < mobAoeChance && heroesAlive > 1;

    if (isAoe) {
      log.push({ round, type: 'monster_attack', actor: '몬스터', detail: `광역 공격!` });
      for (let i = 0; i < numHeroes; i++) {
        if (heroHp[i] <= 0) continue;
        if (Math.random() < heroEva[i]) {
          log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `회피 성공!` });
          continue;
        }
        // Negative evasion → increased monster crit chance
        const negEvaBonus = (heroEva[i] < 0 && isExtreme) ? -0.25 * heroEva[i] : 0;
        const isCrit = Math.random() < baseMobCritChance * mobCritChanceMod + negEvaBonus;
        const aoeDmg = Math.ceil(mobDamage * mobAoeDmgRatio);
        const normalDmg = calcDamageTaken(heroDefVal[i], aoeDmg, mobCap);
        const dmg = isCrit ? calcCritDamageTaken(normalDmg, aoeDmg) : normalDmg;
        heroHp[i] -= dmg;
        log.push({ round, type: 'monster_attack', actor: '몬스터', target: activeHeroes[i].name, detail: `${isCrit ? '치명타! ' : ''}${formatNum(dmg)} 피해 (잔여 HP: ${formatNum(Math.max(0, heroHp[i]))})` });
        if (heroHp[i] <= 0) { heroesAlive--; log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `사망!` }); }
      }
    } else {
      // Single target
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

      if (Math.random() < heroEva[target]) {
        log.push({ round, type: 'event', actor: activeHeroes[target].name, detail: `회피 성공!` });
      } else {
        const negEvaBonus = (heroEva[target] < 0 && isExtreme) ? -0.25 * heroEva[target] : 0;
        const isCrit = Math.random() < baseMobCritChance * mobCritChanceMod + negEvaBonus;
        const normalDmg = calcDamageTaken(heroDefVal[target], mobDamage, mobCap);
        const dmg = isCrit ? calcCritDamageTaken(normalDmg, mobDamage) : normalDmg;
        heroHp[target] -= dmg;
        log.push({ round, type: 'monster_attack', actor: '몬스터', target: activeHeroes[target].name, detail: `${isCrit ? '치명타! ' : ''}${formatNum(dmg)} 피해 (잔여 HP: ${formatNum(Math.max(0, heroHp[target]))})` });
        if (heroHp[target] <= 0) { heroesAlive--; log.push({ round, type: 'event', actor: activeHeroes[target].name, detail: `사망!` }); }
      }
    }

    if (heroesAlive <= 0) {
      log.push({ round, type: 'result', actor: '시스템', detail: `패배! (${round}라운드)` });
      break;
    }

    // Heroes attack
    for (let i = 0; i < numHeroes; i++) {
      if (heroHp[i] <= 0) continue;
      // Mob evasion check (mini boss: agile/legendary)
      if (mobEvasion >= 0 && Math.random() < mobEvasion) {
        log.push({ round, type: 'event', actor: activeHeroes[i].name, detail: `몬스터가 회피!` });
        continue;
      }
      const isCrit = Math.random() < heroCrit[i];
      const dmg = Math.floor(heroAtkVal[i] * (isCrit ? heroCritMult[i] : 1) * barrierMod);
      mobHpCurrent -= dmg;
      heroDmgDealt[i] += dmg;
      log.push({ round, type: 'hero_attack', actor: activeHeroes[i].name, detail: `${isCrit ? '치명타! ' : ''}${formatNum(dmg)} 대미지 (몬스터 잔여: ${formatNum(Math.max(0, mobHpCurrent))})` });
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
