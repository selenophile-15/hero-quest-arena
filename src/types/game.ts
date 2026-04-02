export type HeroClassLine = '전사' | '로그' | '주문술사';

export type HeroClass = string; // Dynamic from JSON data

export interface Hero {
  id: string;
  name: string;
  classLine: HeroClassLine | ''; // 계열 (챔피언은 빈값)
  heroClass: HeroClass; // 직업 (챔피언은 빈값)
  level: number;
  power: number;       // 전투력 (수동 입력)
  hp: number;
  atk: number;
  def: number;
  crit: number;       // 치명타 확률 (%)
  critDmg: number;    // 치명타 대미지 계수 (%)
  evasion: number;    // 회피 (%)
  threat: number;     // 위협도
  element: string;    // 원소 종류
  elementValue: number; // 원소 수치
  type: 'hero' | 'champion';
  promoted?: boolean;
  label?: string;     // 상태
  position?: string;  // 포지션
  seeds?: { hp: number; atk: number; def: number }; // 씨앗
  equipmentElements?: Record<string, number>; // 장비 원소 수치
  elementManual?: boolean; // 원소량 수동 모드 여부
  // Hero-specific
  skills: string[];
  // Champion-specific
  championName?: string;
  cardLevel?: number; // 챔피언 카드 레벨 (1-3)
  rank?: number;
  createdAt: string;
  // Equipment persistence
  equipmentSlots?: Array<{
    item: any | null;
    quality: string;
    element: any | null;
    spirit: any | null;
  }>;
  detailStats?: Record<string, number>; // 기타 상세 스탯 (광전사, 공룡, 상어, 문드라 등)
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

export const POSITIONS = [
  '퓨어 탱커', '회피 탱커', '딜탱', '치명 딜러', '일반 딜러', '회피 딜러', '좀비', '기타',
] as const;

export const STAT_ICON_MAP: Record<string, string> = {
  hp: '/images/stats/health.webp',
  atk: '/images/stats/attack.webp',
  def: '/images/stats/defense.webp',
  crit: '/images/stats/critchance.webp',
  critDmg: '/images/stats/critdamage.webp',
  critAttack: '/images/stats/icon_global_critattack.webp',
  evasion: '/images/stats/evasion.webp',
  threat: '/images/stats/threat.webp',
  power: '/images/stats/power.webp',
  airshipPower: '/images/stats/icon_global_dragoninvasion_airshippower.webp',
};

export const HERO_STAT_COLUMNS = [
  { key: 'type' as const, label: '유형' },
  { key: 'classLine' as const, label: '계열' },
  { key: 'heroClass' as const, label: '직업' },
  { key: 'name' as const, label: '이름' },
  { key: 'level' as const, label: 'Lv' },
  { key: 'element' as const, label: '원소' },
  { key: 'skills' as const, label: '스킬' },
  { key: 'power' as const, label: '전투력', icon: true },
  { key: 'airshipPower' as const, label: '에어쉽', icon: true },
  { key: 'hp' as const, label: 'HP', icon: true },
  { key: 'atk' as const, label: 'ATK', icon: true },
  { key: 'def' as const, label: 'DEF', icon: true },
  { key: 'crit' as const, label: 'CRIT.C', icon: true },
  { key: 'critDmg' as const, label: 'CRIT.D', icon: true },
  { key: 'critAttack' as const, label: 'CRIT.A', icon: true },
  { key: 'evasion' as const, label: 'EVA', icon: true },
  { key: 'threat' as const, label: 'THREAT', icon: true },
  { key: 'seeds' as const, label: '씨앗' },
  { key: 'position' as const, label: '포지션' },
  { key: 'label' as const, label: '상태' },
];

export const CHAMPION_STAT_COLUMNS = [
  { key: 'heroClass' as const, label: '직업' },
  { key: 'name' as const, label: '이름' },
  { key: 'level' as const, label: 'Lv' },
  { key: 'rank' as const, label: '랭크' },
  { key: 'element' as const, label: '원소' },
  { key: 'skills' as const, label: '스킬' },
  { key: 'equipment' as const, label: '장비' },
  { key: 'power' as const, label: '전투력', icon: true },
  { key: 'airshipPower' as const, label: '에어쉽', icon: true },
  { key: 'hp' as const, label: 'HP', icon: true },
  { key: 'atk' as const, label: 'ATK', icon: true },
  { key: 'def' as const, label: 'DEF', icon: true },
  { key: 'crit' as const, label: 'CRIT.C', icon: true },
  { key: 'critDmg' as const, label: 'CRIT.D', icon: true },
  { key: 'critAttack' as const, label: 'CRIT.A', icon: true },
  { key: 'evasion' as const, label: 'EVA', icon: true },
  { key: 'threat' as const, label: 'THREAT', icon: true },
  { key: 'seeds' as const, label: '씨앗' },
  { key: 'label' as const, label: '상태' },
];

// Backwards compat
export const STAT_COLUMNS = HERO_STAT_COLUMNS;

export const ELEMENT_ICON_MAP: Record<string, string> = {
  '불': '/images/elements/fire.webp',
  '화': '/images/elements/fire.webp',
  '물': '/images/elements/water.webp',
  '수': '/images/elements/water.webp',
  '공기': '/images/elements/air.webp',
  '풍': '/images/elements/air.webp',
  '대지': '/images/elements/earth.webp',
  '지': '/images/elements/earth.webp',
  '빛': '/images/elements/light.webp',
  '광': '/images/elements/light.webp',
  '어둠': '/images/elements/dark.webp',
  '암': '/images/elements/dark.webp',
  '골드': '/images/elements/gold.webp',
  '모든 원소': '/images/elements/all.webp',
  '전체': '/images/elements/all.webp',
};

export const QUESTS: Quest[] = [
  { id: 'q1', name: '고블린 동굴', difficulty: 1, recommendedLevel: 5, enemyPower: 100, rewards: '경험치 100, 골드 50' },
  { id: 'q2', name: '어둠의 숲', difficulty: 2, recommendedLevel: 10, enemyPower: 250, rewards: '경험치 300, 골드 150' },
  { id: 'q3', name: '용의 둥지', difficulty: 3, recommendedLevel: 20, enemyPower: 500, rewards: '경험치 800, 골드 400' },
  { id: 'q4', name: '마왕의 성', difficulty: 4, recommendedLevel: 30, enemyPower: 1000, rewards: '경험치 2000, 골드 1000' },
  { id: 'q5', name: '심연의 균열', difficulty: 5, recommendedLevel: 50, enemyPower: 2500, rewards: '경험치 5000, 골드 3000' },
];
