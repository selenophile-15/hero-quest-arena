// Champion equipment utilities - familiar and aura song data loading

import { EquipmentItem } from './equipmentUtils';
import { formatNumber } from './format';

// Familiar name map (Korean → English image filename without extension)
export const FAMILIAR_NAME_MAP: Record<string, string> = {
  '트러블린': 'troublin',
  '설인': 'yeti',
  '두꺼비 마녀': 'toadwitch',
  '머시군': 'mushgoon',
  '아누비스': 'anubis',
  '기린': 'kirin',
  '키클롭스': 'cyclops',
  '독재자': 'tyrant',
  '인어': 'mermaid',
  '하피': 'harpy',
  '호화로운 골렘': 'opulent_golem',
  '크러쉬타션': 'crushtacean',
  '보이들링': 'voidling',
  '아바타': 'avatar',
  '플래티넘 골렘': 'platinum_golem',
  '티라노': 'rex',
  '춤추는 사자': 'dancing_lion',
};

// Aura song name map (Korean → English image filename without extension)
export const AURASONG_NAME_MAP: Record<string, string> = {
  '광휘의 오라': 'gleaming_aura',
  '비의 오라': 'aura_of_rains',
  '진동의 오라': 'aura_of_quakes',
  '성장의 오라': 'aura_of_growth',
  '화염의 오라': 'aura_of_flames',
  '모래의 오라': 'aura_of_sands',
  '악의의 오라': 'aura_of_malice',
  '불꽃의 오라': 'aura_of_sparks',
  '바람의 오라': 'aura_of_winds',
  '사랑의 오라': 'aura_of_love',
  '힘의 오라': 'aura_of_power',
  '프리즘 오라': 'prismatic_aura',
  '이상한 오라': 'aura_of_wonder',
  '폭풍의 오라': 'aura_of_storms',
  '승리의 오라': 'aura_of_victory',
  '변이의 오라': 'aura_of_transmutation',
  '영감의 오라': 'aura_of_inspiration',
  'A.U.R.A. 어시스턴트': 'a.u.r.a._assistant',
  '플래티넘 오라': 'platinum_aura',
};

// Aura song skill icon map (Korean aura name → skill icon file in sk_aurasong)
export const AURASONG_SKILL_ICON_MAP: Record<string, string> = {
  '광휘의 오라': 'gleaming',
  '비의 오라': 'rains',
  '진동의 오라': 'quakes',
  '성장의 오라': 'growth',
  '화염의 오라': 'flames',
  '모래의 오라': 'sand',
  '악의의 오라': 'malice',
  '불꽃의 오라': 'sparks',
  '바람의 오라': 'winds',
  '사랑의 오라': 'love',
  '힘의 오라': 'power',
  '프리즘 오라': 'prismatic',
  '이상한 오라': 'wonders',
  '폭풍의 오라': 'storms',
  '승리의 오라': 'victory',
  '변이의 오라': 'transmutation',
  '영감의 오라': 'inspiration',
  '플래티넘 오라': 'platinum',
  'A.U.R.A. 어시스턴트': 'a.u.r.a.',
};

export function getFamiliarImagePath(korName: string): string {
  const eng = FAMILIAR_NAME_MAP[korName];
  return eng ? `/images/equipment/champion/familiar/${eng}.webp` : '';
}

export function getAurasongImagePath(korName: string): string {
  const eng = AURASONG_NAME_MAP[korName];
  return eng ? `/images/equipment/champion/aurasong/${eng}.webp` : '';
}

export function getAurasongSkillIconPath(korName: string): string {
  const eng = AURASONG_SKILL_ICON_MAP[korName];
  return eng ? `/images/skills/sk_aurasong/${eng}.webp` : '';
}

// Cached data
let familiarCache: EquipmentItem[] | null = null;
let aurasongCache: EquipmentItem[] | null = null;
let aurasongRawCache: Record<string, any> | null = null;

export async function loadFamiliars(): Promise<EquipmentItem[]> {
  if (familiarCache) return familiarCache;
  try {
    const resp = await fetch('/data/equipment/champion/familiar.json');
    const data = await resp.json();
    const items: EquipmentItem[] = [];
    for (const [tierKey, tierItems] of Object.entries(data)) {
      const tierMatch = tierKey.match(/(\d+)/);
      if (!tierMatch) continue;
      const tier = parseInt(tierMatch[1], 10);
      for (const [korName, itemData] of Object.entries(tierItems as Record<string, any>)) {
        const stats: { key: string; value: number }[] = [];
        if (itemData['장비_공격력']) stats.push({ key: '장비_공격력', value: itemData['장비_공격력'] });
        if (itemData['장비_방어력']) stats.push({ key: '장비_방어력', value: itemData['장비_방어력'] });
        if (itemData['장비_체력']) stats.push({ key: '장비_체력', value: itemData['장비_체력'] });
        if (itemData['장비_치명타확률%']) stats.push({ key: '장비_치명타확률%', value: itemData['장비_치명타확률%'] });
        if (itemData['장비_회피%']) stats.push({ key: '장비_회피%', value: itemData['장비_회피%'] });
        items.push({
          name: korName,
          engName: FAMILIAR_NAME_MAP[korName] || '',
          type: 'familiar',
          typeKor: '퍼밀리어',
          category: 'champion',
          tier,
          imagePath: getFamiliarImagePath(korName),
          stats,
          quality: 'common',
          relic: itemData['유물'] != null && itemData['유물'] !== false && itemData['유물'] !== null,
          relicEffect: null,
          airshipPower: 0,
          elementAffinity: itemData['원소친밀감'] || null,
          spiritAffinity: itemData['영혼친밀감'] || null,
          uniqueElement: itemData['고유원소종류'] || null,
          uniqueElementTier: itemData['고유원소티어'] || null,
          uniqueSpirit: itemData['고유영혼'] || null,
          judgmentTypes: null,
        });
      }
    }
    items.sort((a, b) => b.tier - a.tier);
    familiarCache = items;
    return items;
  } catch {
    return [];
  }
}

export async function loadAurasongs(): Promise<EquipmentItem[]> {
  if (aurasongCache) return aurasongCache;
  try {
    const resp = await fetch('/data/equipment/champion/aurasong.json');
    const data = await resp.json();
    aurasongRawCache = data;
    const items: EquipmentItem[] = [];
    for (const [tierKey, tierItems] of Object.entries(data)) {
      const tierMatch = tierKey.match(/(\d+)/);
      if (!tierMatch) continue;
      const tier = parseInt(tierMatch[1], 10);
      for (const [korName, itemData] of Object.entries(tierItems as Record<string, any>)) {
        const stats: { key: string; value: number }[] = [];
        if (itemData['장비_공격력']) stats.push({ key: '장비_공격력', value: itemData['장비_공격력'] });
        if (itemData['장비_방어력']) stats.push({ key: '장비_방어력', value: itemData['장비_방어력'] });
        if (itemData['장비_체력']) stats.push({ key: '장비_체력', value: itemData['장비_체력'] });
        if (itemData['장비_치명타확률%']) stats.push({ key: '장비_치명타확률%', value: itemData['장비_치명타확률%'] });
        if (itemData['장비_회피%']) stats.push({ key: '장비_회피%', value: itemData['장비_회피%'] });
        items.push({
          name: korName,
          engName: AURASONG_NAME_MAP[korName] || '',
          type: 'aurasong',
          typeKor: '오라의 노래',
          category: 'champion',
          tier,
          imagePath: getAurasongImagePath(korName),
          stats,
          quality: 'common',
          relic: false,
          relicEffect: null,
          airshipPower: 0,
          elementAffinity: itemData['원소친밀감'] || null,
          spiritAffinity: itemData['영혼친밀감'] || null,
          uniqueElement: itemData['고유원소종류'] || null,
          uniqueElementTier: itemData['고유원소티어'] || null,
          uniqueSpirit: itemData['고유영혼'] || null,
          judgmentTypes: null,
        });
      }
    }
    items.sort((a, b) => b.tier - a.tier);
    aurasongCache = items;
    return items;
  } catch {
    return [];
  }
}

export function getAurasongSkillEffect(aurasongName: string): string {
  if (!aurasongRawCache) return '';
  for (const tierItems of Object.values(aurasongRawCache)) {
    if (typeof tierItems !== 'object') continue;
    const item = (tierItems as Record<string, any>)[aurasongName];
    if (item?.['스탯_보너스']?.['효과']) {
      return item['스탯_보너스']['효과'];
    }
  }
  return '';
}

export async function ensureAurasongDataLoaded(): Promise<void> {
  if (!aurasongRawCache) {
    await loadAurasongs();
  }
}

export const LEADER_SKILL_TIER_NAMES: Record<string, string[]> = {
  '아르곤': ['용기의 오라', '결의의 오라', '영웅의 오오라', '성전사의 오라'],
  '릴루': ['상처의 치료', '성스러운 힘', '활력화', '성스러운 영역'],
  '시아': ['전리품을 찾는 눈', '숙련된 눈', '스타일을 보는 눈', '장인의 눈'],
  '야미': ['기습', '협동 기습', '에테르 기습', '완벽한 기습'],
  '루도': ['루도 블릿츠', '고집 센 공격', '광전사의 광란', '완전한 파괴'],
  '폴로니아': ['해적의 임무', '데이비 존스의 약탈', '사나운 바다의 날강도', '선장의 몫'],
  '도노반': ['연금술사 토닉', '변화의 정수', '변이의 마스터', '현자의 돌'],
  '헴마': ['강화 흡수', '섬뜩한 일격', '강령술 창', '정수 소모'],
  '애쉴리': ['아이주쓰 전술', '애쉴리의 한 수', '위대한 적 격퇴', '부시도의 힘'],
  '비외른': ['더블 트러블', '섬광 공격팀', '본 투 비 와일드', '엄니 듀오'],
  '라인홀드': ['라인홀드의 산책', '왕에게 걸맞은 여정', '돈을 부르는 돈', '세상의 부'],
  '타마스': ['가죽의 각성', '가죽의 힘', '가죽의 수준', '궁극의 가죽 작업자'],
};

export function getLeaderSkillTierName(championName: string, tier: number): string {
  const names = LEADER_SKILL_TIER_NAMES[championName];
  if (!names || tier < 1 || tier > 4) return `${tier}티어`;
  return names[tier - 1];
}
