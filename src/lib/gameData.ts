// Game data loader - fetches and parses the JSON data files with syntax fixing

// ===== Static Mappings =====

export const HERO_CLASS_MAP: Record<string, string[]> = {
  '전사': ['병사', '용병', '야만전사', '족장', '기사', '군주', '레인저', '관리인', '사무라이', '다이묘', '광전사', '잘', '어둠의 기사', '죽음의 기사'],
  '로그': ['도둑', '사기꾼', '수도승', '그랜드 마스터', '머스킷병', '정복자', '방랑자', '길잡이', '닌자', '센세', '무희', '곡예가', '경보병', '근위병'],
  '주문술사': ['마법사', '대마법사', '성직자', '비숍', '드루이드', '아크 드루이드', '소서러', '워록', '마법검', '스펠나이트', '풍수사', '아스트라맨서', '크로노맨서', '페이트위버'],
};

export const HERO_CLASSES_ALL = Object.keys(HERO_CLASS_MAP);

export const CHAMPION_NAMES = ['아르곤', '릴루', '시아', '야미', '루도', '폴로니아', '도노반', '헴마', '애쉴리', '비외른', '맬러디', '라인홀드', '타마스'];

// ===== JSON Fixer =====

function fixJsonText(text: string): string {
  // Remove BOM
  text = text.replace(/^\uFEFF/, '');
  // Fix double commas
  text = text.replace(/,,/g, ',');
  // Fix empty values: "key": , → "key": 0,
  text = text.replace(/"([^"]+)":\s*,/g, '"$1": 0,');
  text = text.replace(/"([^"]+)":\s*}/g, '"$1": 0}');
  // Fix trailing commas before ] or }
  text = text.replace(/,\s*([\]}])/g, '$1');
  // Fix missing commas between properties (e.g., "key": value\n  "key2":)
  text = text.replace(/(\d+)\s*\n(\s*")/g, '$1,\n$2');
  text = text.replace(/("})\s*\n(\s*")/g, '$1,\n$2');
  // Fix tab characters in keys
  text = text.replace(/\t/g, '  ');
  return text;
}

function parseMultiJson(text: string): Record<string, any> {
  const fixed = fixJsonText(text);
  // Try parsing as single JSON first
  try {
    return JSON.parse(fixed);
  } catch {
    // Split by }{ pattern (multiple JSON objects)
    const parts = fixed.split(/\}\s*\n*\s*\{/);
    const result: Record<string, any> = {};
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      if (i > 0) part = '{' + part;
      if (i < parts.length - 1) part = part + '}';
      try {
        const parsed = JSON.parse(part);
        Object.assign(result, parsed);
      } catch (e) {
        console.warn('Failed to parse JSON part:', (e as Error).message);
      }
    }
    return result;
  }
}

// ===== Cached Data =====

let heroStatsCache: Record<string, any> | null = null;
let championStatsCache: Record<string, any> | null = null;
let jobSkillsCache: Record<string, any> | null = null;
let commonSkillsCache: Record<string, any> | null = null;
let uniqueSkillsCache: Record<string, any> | null = null;
let championSkillsCache: Record<string, any> | null = null;

async function fetchAndParse(path: string): Promise<Record<string, any>> {
  const resp = await fetch(path);
  const text = await resp.text();
  return parseMultiJson(text);
}

export async function getHeroStats(): Promise<Record<string, any>> {
  if (!heroStatsCache) {
    heroStatsCache = await fetchAndParse('/data/STD1_hero_stats.json');
  }
  return heroStatsCache;
}

export async function getChampionStats(): Promise<Record<string, any>> {
  if (!championStatsCache) {
    championStatsCache = await fetchAndParse('/data/STD2_champion_stats.json');
  }
  return championStatsCache;
}

export async function getJobSkills(): Promise<Record<string, any>> {
  if (!jobSkillsCache) {
    jobSkillsCache = await fetchAndParse('/data/SKD1_job_skills.json');
  }
  return jobSkillsCache;
}

export async function getCommonSkills(): Promise<Record<string, any>> {
  if (!commonSkillsCache) {
    commonSkillsCache = await fetchAndParse('/data/SKD2_common_skills.json');
  }
  return commonSkillsCache;
}

export async function getUniqueSkills(): Promise<Record<string, any>> {
  if (!uniqueSkillsCache) {
    uniqueSkillsCache = await fetchAndParse('/data/SKD3_class_skills.json');
  }
  return uniqueSkillsCache;
}

export async function getChampionSkillsData(): Promise<Record<string, any>> {
  if (!championSkillsCache) {
    championSkillsCache = await fetchAndParse('/data/SKD4_champion_skills.json');
  }
  return championSkillsCache;
}

// ===== Lookup Helpers =====

// Map job group keys to job names
const JOB_GROUP_MAP: Record<string, [string, string]> = {
  '병사_용병': ['병사', '용병'],
  '야만전사_족장': ['야만전사', '족장'],
  '기사_군주': ['기사', '군주'],
  '레인저_관리인': ['레인저', '관리인'],
  '사무라이_다이묘': ['사무라이', '다이묘'],
  '광전사_잘': ['광전사', '잘'],
  '어둠의기사_죽음의기사': ['어둠의 기사', '죽음의 기사'],
  '도둑_사기꾼': ['도둑', '사기꾼'],
  '수도승_그랜드마스터': ['수도승', '그랜드 마스터'],
  '머스킷병_정복자': ['머스킷병', '정복자'],
  '방랑자_길잡이': ['방랑자', '길잡이'],
  '닌자_센세': ['닌자', '센세'],
  '무희_곡예가': ['무희', '곡예가'],
  '경보병_근위병': ['경보병', '근위병'],
  '마법사_대마법사': ['마법사', '대마법사'],
  '성직자_비숍': ['성직자', '비숍'],
  '드루이드_아크드루이드': ['드루이드', '아크 드루이드'],
  '소서러_워록': ['소서러', '워록'],
  '마법검_스펠나이트': ['마법검', '스펠나이트'],
  '풍수사_아스트라맨서': ['풍수사', '아스트라맨서'],
  '크로노맨서_페이트위버': ['크로노맨서', '페이트위버'],
};

export interface HeroLevelStats {
  hp: number;
  atk: number;
  def: number;
}

export interface HeroFixedStats {
  evasion: number;
  critRate: number;
  critDmg: number;
  threat: number;
  element: string;
}

export async function lookupHeroStats(jobName: string, level: number): Promise<{ level: HeroLevelStats; fixed: HeroFixedStats } | null> {
  const data = await getHeroStats();
  
  // Search through all 계열
  for (const gyeyeolKey of Object.keys(data)) {
    const gyeyeol = data[gyeyeolKey];
    for (const groupKey of Object.keys(gyeyeol)) {
      const group = gyeyeol[groupKey];
      // Check 기본_직업
      if (group['기본_직업']?.['직업명'] === jobName) {
        return extractStats(group['기본_직업'], level);
      }
      // Check 승급_직업
      if (group['승급_직업']?.['직업명'] === jobName) {
        return extractStats(group['승급_직업'], level);
      }
    }
  }
  return null;
}

function extractStats(jobData: any, level: number): { level: HeroLevelStats; fixed: HeroFixedStats } | null {
  const fixed = jobData['고정_능력치'] || {};
  const levelData = (jobData['레벨별_능력치'] || []).find((l: any) => l['레벨'] === level);
  
  return {
    level: {
      hp: levelData?.['기본_체력'] || 0,
      atk: levelData?.['기본_공격력'] || 0,
      def: levelData?.['기본_방어력'] || 0,
    },
    fixed: {
      evasion: fixed['기본_회피%'] || 0,
      critRate: fixed['기본_치명타확률%'] || 5,
      critDmg: fixed['기본_치명타데미지%'] || 200,
      threat: fixed['기본_위협도'] || 90,
      element: fixed['직업_원소'] || '',
    },
  };
}

export async function lookupChampionStats(name: string, rank: number): Promise<{ hp: number; atk: number; def: number; element: number; fixed: HeroFixedStats } | null> {
  const data = await getChampionStats();
  const champion = data[name];
  if (!champion) return null;
  
  const fixed = champion['고정_능력치'] || {};
  const rankData = (champion['랭크별_능력치'] || []).find((r: any) => r['랭크'] === rank);
  
  if (!rankData) return null;
  
  return {
    hp: rankData['기본_체력'] || 0,
    atk: rankData['기본_공격력'] || 0,
    def: rankData['기본_방어력'] || 0,
    element: rankData['기본_원소'] || 0,
    fixed: {
      evasion: fixed['기본_회피%'] || 0,
      critRate: fixed['기본_치명타확률%'] || 5,
      critDmg: fixed['기본_치명타데미지%'] || 200,
      threat: fixed['기본_위협도'] || 90,
      element: fixed['직업_원소'] || '',
    },
  };
}

export async function getAvailableSkills(jobName: string): Promise<string[]> {
  const data = await getJobSkills();
  // Search through all 계열
  for (const gyeyeolKey of Object.keys(data)) {
    const gyeyeol = data[gyeyeolKey];
    if (gyeyeol[jobName]) {
      return gyeyeol[jobName]['선택_스킬'] || [];
    }
  }
  return [];
}

export async function getUniqueSkill(jobName: string): Promise<{ name: string; description: string } | null> {
  const data = await getUniqueSkills();
  const skill = data[jobName];
  if (!skill) return null;
  return {
    name: skill['레벨별_스킬명']?.[0] || jobName,
    description: skill['스킬_설명']?.[0] || '',
  };
}
