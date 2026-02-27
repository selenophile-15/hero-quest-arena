// Centralized Korean ↔ English name mappings for all game assets
// Keys: Korean display names, Values: English file/id names

// ===== Class Lines =====
export const CLASS_LINE_MAP: Record<string, string> = {
  '전사': 'fighter',
  '로그': 'rogue',
  '주문술사': 'spellcaster',
};

// ===== Job Classes =====
export const JOB_NAME_MAP: Record<string, string> = {
  // 전사
  '병사': 'soldier', '용병': 'mercenary',
  '야만전사': 'barbarian', '족장': 'chieftain',
  '기사': 'knight', '군주': 'lord',
  '레인저': 'ranger', '관리인': 'warden',
  '사무라이': 'samurai', '다이묘': 'daimyo',
  '광전사': 'berserker', '잘': 'jarl',
  '어둠의 기사': 'darkknight', '죽음의 기사': 'deathknight',
  // 로그
  '도둑': 'thief', '사기꾼': 'trickster',
  '수도승': 'monk', '그랜드 마스터': 'grandmaster',
  '머스킷병': 'musketeer', '정복자': 'conquistador',
  '방랑자': 'wanderer', '길잡이': 'pathfinder',
  '닌자': 'ninja', '센세': 'sensei',
  '무희': 'dancer', '곡예가': 'acrobat',
  '경보병': 'velite', '근위병': 'praetorian',
  // 주문술사
  '마법사': 'mage', '대마법사': 'archmage',
  '성직자': 'cleric', '비숍': 'bishop',
  '드루이드': 'druid', '아크 드루이드': 'archdruid',
  '소서러': 'sorcerer', '워록': 'warlock',
  '마법검': 'spellblade', '스펠나이트': 'spellknight',
  '풍수사': 'geomancer', '아스트라맨서': 'astramancer',
  '크로노맨서': 'chronomancer', '페이트위버': 'fateweaver',
};

// ===== Skills =====
export const SKILL_NAME_MAP: Record<string, string> = {
  // Normal
  '곡예': 'acrobatics',
  '아케인 블래스트': 'arcane_blast',
  '아케인 블라스트': 'arcane_blast',
  '뒤에서 찌르기': 'backstab',
  '쪼개기': 'cleave',
  '독수리의 눈': 'eagle_eyes',
  '영재': 'fast_learner',
  '방어': 'on_guard',
  '정비': 'maintenance',
  '마법 다트': 'magic_darts',
  '마법사 갑옷': 'mage_armor',
  '방패의 제왕': 'shield_master',
  '견고함': 'sturdy',
  '강타': 'smite',
  '흘리기': 'parry',
  '꿰뚫기': 'perforate',
  '생명 흡수': 'life_drain',
  '저주': 'hex',
  '검 마스터': 'sword_master',
  '단검 마스터': 'dagger_master',
  '도끼 마스터': 'axe_master',
  '철퇴 마스터': 'mace_master',
  '창 마스터': 'spear_master',
  '활 마스터': 'bow_master',
  '크로스보우 마스터': 'crossbow_master',
  '총 마스터': 'gun_master',
  '지팡이 마스터': 'staff_master',
  '마법봉 마스터': 'wand_master',
  '악기 마스터': 'instrument_master',
  '촉매 마스터': 'catalyst_master',
  // Rare
  '천부적인 힘': 'all_natural',
  '치명적인 치명타': 'deadly_criticals',
  '마름쇠': 'caltrops',
  '안티매직 그물': 'antimagic_net',
  '숙련': 'finesse',
  '비껴치기': 'glancing_blows',
  '강력한 공격': 'power_attack',
  '단검 던지기': 'throw_daggers',
  '샤이닝 블레이드': 'shining_blade',
  '상당한 타격': 'telling_blows',
  '산산조각': 'sunder',
  '불꽃 낙인': 'flame_brand',
  '파이어볼': 'fireball',
  '악마 소환': 'summon_demon',
  '방해하기': 'hinder',
  '욕설': 'curse',
  '기만': 'deception',
  '저거너트': 'juggernaut',
  '특별 훈련': 'extra_conditioning',
  '그림자의 포옹': 'shadow_embrace',
  '단단함': 'toughness',
  '두꺼운 피부': 'thick_skin',
  '힘의 장막': 'wall_of_force',
  '빠른 치유': 'fast_healer',
  '전기 아크': 'electric_arc',
  '드래곤 브레스': 'dragon_breath',
  '붕괴': 'disintegrate',
  // Epic
  '대마법사(스킬)': 'adept', // 직업명과 구분 (nameMap용)
  '대마법사': 'adept', // SKD2에서 사용하는 키
  '초 천재': 'super_genius',
  '완벽한 형태': 'perfect_form',
  '더블 캐스팅': 'double_cast',
  '회오리 공격': 'whirlwind_attack',
  '전쟁 마스터': 'warlord',
  '생존자': 'survivor',
  '독 구름': 'poison_cloud',
  '경직': 'petrify',
  '공성 강타': 'battering_blows',
  '암살': 'assassinate',
  '칼날의 춤': 'dance_of_blades',
  '죽음의 중개인': 'death_dealer',
  '망토와 단검': 'cloak&dagger',
  '저격수': 'marksman',
  '마나 방패': 'mana_shield',
  '흐릿한 잔상': 'blurred_movement',
  '불침': 'impervious',
  '추가 도금': 'extra_plating',
  '추가 품질 보증': 'extended_warranty',
  '파괴의 일격': 'destructive_strikes',
};

// Skill grade mapping
export const SKILL_GRADE_MAP: Record<string, string> = {
  '일반': 'normal',
  '희귀': 'rare',
  '에픽': 'epic',
};

// ===== Elements =====
export const ELEMENT_NAME_MAP: Record<string, string> = {
  '불': 'fire', '화': 'fire',
  '물': 'water', '수': 'water',
  '공기': 'air', '풍': 'air',
  '대지': 'earth', '지': 'earth',
  '빛': 'light', '광': 'light',
  '어둠': 'dark', '암': 'dark',
  '골드': 'gold',
};

// ===== Spirits =====
export const SPIRIT_NAME_MAP: Record<string, string> = {
  '고양이': 'cat', '거위': 'goose', '양': 'ram', '늑대': 'wolf',
  '황소': 'ox', '독수리': 'eagle', '독사': 'viper', '토끼': 'bunny',
  '졸로틀': 'xolotl', '코뿔소': 'rhino', '부엉이': 'owl',
  '아르마딜로': 'armadillo', '도마뱀': 'lizard', '말': 'horse',
  '하마': 'hippo', '다람쥐': 'squirrel', '상어': 'shark',
  '바다코끼리': 'walrus', '사자': 'lion', '곰': 'bear',
  '매머드': 'mammoth', '공룡': 'dinosaur', '호랑이': 'tiger',
  '케찰코아틀': 'quetzalcoatl', '불사조': 'phoenix', '하이드라': 'hydra',
  '타라스크': 'tarrasque', '카벙클': 'carbuncle', '키메라': 'chimera',
  '크라켄': 'kraken', '크리스마스': 'christmas', '크람푸스': 'krampus',
  '기린': 'kirin', '베히모스': 'behemoth', '우로보로스': 'ouroboros',
  '바하무트': 'bahamut', '레비아탄': 'leviathan', '그리핀': 'griffin',
  '명인': 'titan', '조상': 'ancestor',
};

// ===== Champions =====
export const CHAMPION_NAME_MAP: Record<string, string> = {
  '아르곤': 'argon', '애쉴리': 'ashley', '비외른': 'bjorn',
  '도노반': 'donovan', '헴마': 'hemma', '릴루': 'lilu',
  '맬러디': 'malady', '폴로니아': 'polonia', '라인홀드': 'reinhold',
  '루도': 'rudo', '시아': 'sia', '타마스': 'tamas', '야미': 'yami',
};

// ===== Reverse maps (English → Korean) =====
function reverseMap(map: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    result[v] = k; // last Korean name wins for duplicates (e.g. 불/화 → fire)
  }
  return result;
}

export const JOB_NAME_REVERSE = reverseMap(JOB_NAME_MAP);
export const SKILL_NAME_REVERSE = reverseMap(SKILL_NAME_MAP);
export const ELEMENT_NAME_REVERSE = reverseMap(ELEMENT_NAME_MAP);
export const SPIRIT_NAME_REVERSE = reverseMap(SPIRIT_NAME_MAP);
export const CHAMPION_NAME_REVERSE = reverseMap(CHAMPION_NAME_MAP);

// ===== Path helpers =====
export function getJobImagePath(korName: string): string {
  const eng = JOB_NAME_MAP[korName];
  return `/images/classes/${eng || korName}.png`;
}

export function getJobIllustPath(korName: string): string {
  const eng = JOB_NAME_MAP[korName];
  return `/images/classillust/${eng || korName}.png`;
}

export function getSkillImagePath(korName: string): string {
  const eng = SKILL_NAME_MAP[korName];
  return `/images/skills/sk_hero/${eng || korName}.png`;
}

export function getChampionImagePath(korName: string): string {
  const eng = CHAMPION_NAME_MAP[korName];
  return `/images/champion/${eng || korName}.png`;
}

export function getChampionSkillImagePath(korName: string, rank: number): string {
  const eng = CHAMPION_NAME_MAP[korName];
  return `/images/skills/sk_champion/${eng || korName}_${rank}.png`;
}

/**
 * Element enchantment image path
 * @param elementKor - Korean element name (e.g. '불')
 * @param tier - Tier number (e.g. 9)
 * @param affinity - true if affinity matches, false otherwise
 */
export function getElementEnchantPath(elementKor: string, tier: number, affinity: boolean): string {
  const eng = ELEMENT_NAME_MAP[elementKor];
  const suffix = affinity ? '2' : '1';
  return `/images/enchant/element/${eng || elementKor}${tier}_${suffix}.png`;
}

/**
 * Spirit enchantment image path
 * @param spiritKor - Korean spirit name (e.g. '고양이')
 * @param affinity - true if affinity matches, false otherwise
 */
export function getSpiritEnchantPath(spiritKor: string, affinity: boolean): string {
  const eng = SPIRIT_NAME_MAP[spiritKor];
  const suffix = affinity ? '2' : '1';
  return `/images/enchant/spirit/${eng || spiritKor}_${suffix}.png`;
}
