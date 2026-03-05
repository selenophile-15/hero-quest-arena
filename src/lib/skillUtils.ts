// Skill slot calculation utilities
import { SKILL_NAME_MAP, SKILL_GRADE_MAP } from './nameMap';

// Job pair index (1-based) within each class line
const JOB_PAIR_INDEX: Record<string, number> = {
  // 전사
  '병사': 1, '용병': 1,
  '야만전사': 2, '족장': 2,
  '기사': 3, '군주': 3,
  '레인저': 4, '관리인': 4,
  '사무라이': 5, '다이묘': 5,
  '광전사': 6, '잘': 6,
  '어둠의 기사': 7, '죽음의 기사': 7,
  // 로그
  '도둑': 1, '사기꾼': 1,
  '수도승': 2, '그랜드 마스터': 2,
  '머스킷병': 3, '정복자': 3,
  '방랑자': 4, '길잡이': 4,
  '닌자': 5, '센세': 5,
  '무희': 6, '곡예가': 6,
  '경보병': 7, '근위병': 7,
  // 주문술사
  '마법사': 1, '대마법사': 1,
  '성직자': 2, '비숍': 2,
  '드루이드': 3, '아크 드루이드': 3,
  '소서러': 4, '워록': 4,
  '마법검': 5, '스펠나이트': 5,
  '풍수사': 6, '아스트라맨서': 6,
  '크로노맨서': 7, '페이트위버': 7,
};

// Is this a promoted job?
const PROMOTED_JOBS = new Set([
  '용병', '족장', '군주', '관리인', '다이묘', '잘', '죽음의 기사',
  '사기꾼', '그랜드 마스터', '정복자', '길잡이', '센세', '곡예가', '근위병',
  '대마법사', '비숍', '아크 드루이드', '워록', '스펠나이트', '아스트라맨서', '페이트위버',
]);

// 병사/용병 have special (earlier) unlock levels
const SOLDIER_UNLOCK_LEVELS = [4, 9, 19, 29];
const DEFAULT_UNLOCK_LEVELS = [5, 10, 23, 35];

/**
 * Get max number of common skill slots available.
 * @param jobName Korean job name
 * @param level Hero level
 * @param promoted Whether hero is promoted (명인의 혼)
 */
export function getMaxCommonSkillSlots(jobName: string, level: number, promoted: boolean): number {
  const pairIdx = JOB_PAIR_INDEX[jobName] || 1;
  const isSoldierLine = (jobName === '병사' || jobName === '용병');
  const unlockLevels = isSoldierLine ? SOLDIER_UNLOCK_LEVELS : DEFAULT_UNLOCK_LEVELS;

  // Count how many slots are unlocked by level
  let unlockedByLevel = 0;
  for (const lv of unlockLevels) {
    if (level >= lv) unlockedByLevel++;
  }

  // Max slots cap based on job position + promotion
  let maxCap: number;
  if (promoted) {
    maxCap = 4;
  } else {
    if (pairIdx <= 2) maxCap = 2;
    else if (pairIdx <= 4) maxCap = 3;
    else maxCap = 4;
  }

  return Math.min(unlockedByLevel, maxCap);
}

/**
 * Get the skill image path from Korean skill name
 */
export function getSkillImagePath(skillNameKor: string): string {
  const eng = SKILL_NAME_MAP[skillNameKor];
  if (!eng) return '';
  // Determine grade folder
  const grade = getSkillGrade(skillNameKor);
  const folder = grade === '희귀' ? 'rare' : grade === '에픽' ? 'epic' : 'normal';
  return `/images/skills/sk_hero/${folder}/${eng}.webp`;
}

// Reverse lookup for grade from SKILL_NAME_MAP keys grouped by grade
const SKILL_GRADES: Record<string, string> = {};

// We'll populate this from common skills data at runtime
let skillGradeCache: Record<string, string> | null = null;

export function setSkillGradeCache(commonSkills: Record<string, any>) {
  skillGradeCache = {};
  for (const [name, data] of Object.entries(commonSkills)) {
    if (data && typeof data === 'object' && '희귀도' in data) {
      skillGradeCache[name] = (data as any)['희귀도'];
    }
  }
}

export function getSkillGrade(skillNameKor: string): string {
  if (skillGradeCache && skillGradeCache[skillNameKor]) {
    return skillGradeCache[skillNameKor];
  }
  return '일반';
}

/**
 * Get unique skill image path for a job pair
 */
export function getUniqueSkillImagePath(jobName: string): string {
  // sk_class images are named as base_promoted pairs
  const JOB_PAIR_FILES: Record<string, string> = {
    '병사': 'soldier_mercenary', '용병': 'soldier_mercenary',
    '야만전사': 'barbarian_chieftain', '족장': 'barbarian_chieftain',
    '기사': 'knight_lord', '군주': 'knight_lord',
    '레인저': 'ranger_warden', '관리인': 'ranger_warden',
    '사무라이': 'samurai_daimyo', '다이묘': 'samurai_daimyo',
    '광전사': 'berserker_jarl', '잘': 'berserker_jarl',
    '어둠의 기사': 'darkknight_deathknight', '죽음의 기사': 'darkknight_deathknight',
    '도둑': 'thief_trickster', '사기꾼': 'thief_trickster',
    '수도승': 'monk_grandmaster', '그랜드 마스터': 'monk_grandmaster',
    '머스킷병': 'musketeer_conquistador', '정복자': 'musketeer_conquistador',
    '방랑자': 'wanderer_pathfinder', '길잡이': 'wanderer_pathfinder',
    '닌자': 'ninja_sensei', '센세': 'ninja_sensei',
    '무희': 'dancer_acrobat', '곡예가': 'dancer_acrobat',
    '경보병': 'velite_praetorian', '근위병': 'velite_praetorian',
    '마법사': 'mage_archmage', '대마법사': 'mage_archmage',
    '성직자': 'cleric_bishop', '비숍': 'cleric_bishop',
    '드루이드': 'druid_archdruid', '아크 드루이드': 'druid_archdruid',
    '소서러': 'sorcerer_warlock', '워록': 'sorcerer_warlock',
    '마법검': 'spellblade_spellknight', '스펠나이트': 'spellblade_spellknight',
    '풍수사': 'geomancer_astramancer', '아스트라맨서': 'geomancer_astramancer',
    '크로노맨서': 'chronomancer_fateweaver', '페이트위버': 'chronomancer_fateweaver',
  };
  const file = JOB_PAIR_FILES[jobName];
  if (!file) return '';
  return `/images/skills/sk_class/${file}.webp`;
}

/**
 * Check if two skills are incompatible
 */
export function areSkillsIncompatible(
  skillA: string,
  skillB: string,
  commonSkillsData: Record<string, any>
): boolean {
  const dataA = commonSkillsData[skillA];
  const dataB = commonSkillsData[skillB];
  if (dataA?.['호환_불가능_스킬']?.includes(skillB)) return true;
  if (dataB?.['호환_불가능_스킬']?.includes(skillA)) return true;
  return false;
}

/**
 * Get all stat bonus types from common skills for filter options
 */
export function getAllStatBonusTypes(commonSkillsData: Record<string, any>): string[] {
  const types = new Set<string>();
  for (const data of Object.values(commonSkillsData)) {
    if (data && typeof data === 'object' && '스탯_보너스' in data) {
      for (const key of Object.keys((data as any)['스탯_보너스'])) {
        types.add(key);
      }
    }
  }
  return Array.from(types).sort();
}

// Readable stat names
export const STAT_BONUS_LABELS: Record<string, string> = {
  '스킬_공격력%': '공격력',
  '스킬_깡공격력': '공격력',
  '스킬_체력%': '체력',
  '스킬_깡체력': '체력',
  '스킬_방어력%': '방어력',
  '스킬_깡방어력': '방어력',
  '스킬_치명타확률%': '치명타 확률',
  '스킬_치명타대미지%': '치명타 대미지',
  '스킬_치명타데미지%': '치명타 대미지',
  '스킬_회피%': '회피',
  '스킬_모든장비전체%': '모든 장비 보너스',
  '스킬_해당장비공격력%': '무기 공격력',
  '스킬_해당장비방어력%': '방패 방어력',
  '스킬_휴식시간감소%': '휴식시간 감소',
  '스킬_치명타생존%': '치명타 생존 확률',
  '스킬_장비파괴방지%': '장비 파괴 확률 감소',
  '스킬_경험치%': '경험치',
  '스킬_위협도': '위협도',
  '스킬_체력비례스킬_공격력%': '체력비례 공격력',
  '스킬_체력비례회피%': '체력비례 회피',
};

// Stat filter categories - groups related stat keys under user-friendly labels
export const STAT_FILTER_OPTIONS: { label: string; keys: string[] }[] = [
  { label: '공격력', keys: ['스킬_공격력%', '스킬_깡공격력', '스킬_해당장비공격력%'] },
  { label: '체력', keys: ['스킬_체력%', '스킬_깡체력'] },
  { label: '방어력', keys: ['스킬_방어력%', '스킬_깡방어력', '스킬_해당장비방어력%'] },
  { label: '치명타 확률', keys: ['스킬_치명타확률%'] },
  { label: '치명타 대미지', keys: ['스킬_치명타대미지%', '스킬_치명타데미지%'] },
  { label: '회피', keys: ['스킬_회피%', '스킬_체력비례회피%'] },
  { label: '모든 장비 보너스', keys: ['스킬_모든장비전체%'] },
  { label: '무기 공격력', keys: ['스킬_해당장비공격력%'] },
  { label: '방패 방어력', keys: ['스킬_해당장비방어력%'] },
  { label: '휴식시간 감소', keys: ['스킬_휴식시간감소%'] },
  { label: '치명타 생존 확률', keys: ['스킬_치명타생존%'] },
  { label: '장비 파괴 확률 감소', keys: ['스킬_장비파괴방지%'] },
  { label: '경험치', keys: ['스킬_경험치%'] },
];
