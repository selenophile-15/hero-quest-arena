export type HeroClassLine = '전사' | '로그' | '주문술사';

export type HeroClass = string; // Dynamic from JSON data

export interface Hero {
  id: string;
  name: string;
  classLine: HeroClassLine; // 계열
  heroClass: HeroClass; // 직업
  level: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  critDmg: number;
  evasion: number;
  threat: number;
  element: string;
  type: 'hero' | 'champion';
  // Hero-specific
  skills: string[];
  // Champion-specific
  championName?: string;
  rank?: number;
  createdAt: string;
}

export interface Quest {
  id: string;
  name: string;
  difficulty: number;
  recommendedLevel: number;
  enemyPower: number;
  rewards: string;
}

export interface SimulationResult {
  id: string;
  questId: string;
  questName: string;
  heroes: Hero[];
  score: number;
  success: boolean;
  details: string;
  timestamp: string;
  region?: string;
}

export const HERO_CLASS_LINES: HeroClassLine[] = ['전사', '로그', '주문술사'];

export const STAT_COLUMNS = [
  { key: 'name' as const, label: '이름' },
  { key: 'classLine' as const, label: '계열' },
  { key: 'heroClass' as const, label: '직업' },
  { key: 'type' as const, label: '유형' },
  { key: 'level' as const, label: 'Lv' },
  { key: 'hp' as const, label: 'HP' },
  { key: 'atk' as const, label: 'ATK' },
  { key: 'def' as const, label: 'DEF' },
  { key: 'crit' as const, label: 'CRIT' },
  { key: 'evasion' as const, label: '회피' },
  { key: 'element' as const, label: '원소' },
];

export const QUESTS: Quest[] = [
  { id: 'q1', name: '고블린 동굴', difficulty: 1, recommendedLevel: 5, enemyPower: 100, rewards: '경험치 100, 골드 50' },
  { id: 'q2', name: '어둠의 숲', difficulty: 2, recommendedLevel: 10, enemyPower: 250, rewards: '경험치 300, 골드 150' },
  { id: 'q3', name: '용의 둥지', difficulty: 3, recommendedLevel: 20, enemyPower: 500, rewards: '경험치 800, 골드 400' },
  { id: 'q4', name: '마왕의 성', difficulty: 4, recommendedLevel: 30, enemyPower: 1000, rewards: '경험치 2000, 골드 1000' },
  { id: 'q5', name: '심연의 균열', difficulty: 5, recommendedLevel: 50, enemyPower: 2500, rewards: '경험치 5000, 골드 3000' },
];
