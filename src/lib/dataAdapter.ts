/**
 * Data adapter: normalizes the new English-keyed equipment/enchantment JSON
 * structure into the legacy Korean-keyed shape that downstream code expects.
 *
 * New per-item shape includes: name_ko, image_key, 이미지_경로, plus affinity
 * arrays in English ("Fire", "Wolf"...). We re-key items by their Korean
 * name (name_ko) and translate affinity arrays back to Korean so the rest
 * of the codebase keeps working unchanged.
 *
 * Extra fields (engName/imageKey/이미지_경로/장비_에어쉽파워보너스/천상 …)
 * are preserved on each item so future code can use them directly.
 */

// ─── Element / Spirit EN → KO maps ────────────────────────────────────────

export const ELEMENT_EN_TO_KO: Record<string, string> = {
  Fire: '불',
  Water: '물',
  Air: '공기',
  Earth: '대지',
  Light: '빛',
  Dark: '어둠',
  Gold: '골드',
  All: '모든 원소',
  AllElement: '모든 원소',
  '모든 원소': '모든 원소',
};

export const SPIRIT_EN_TO_KO: Record<string, string> = {
  Wolf: '늑대', Ram: '양', Eagle: '독수리', Lion: '사자', Owl: '부엉이',
  Cat: '고양이', Tiger: '호랑이', Bear: '곰', Squirrel: '다람쥐', Rabbit: '토끼',
  Horse: '말', Goose: '거위', Hippo: '하마', Walrus: '바다코끼리', Bull: '황소',
  Rhinoceros: '코뿔소', Rhino: '코뿔소', Mammoth: '매머드', Lizard: '도마뱀',
  Viper: '독사', Armadillo: '아르마딜로', Giraffe: '기린', Dinosaur: '공룡',
  Shark: '상어', Carbuncle: '카벙클', Phoenix: '불사조', Griffin: '그리핀',
  Kraken: '크라켄', Hydra: '하이드라', Chimera: '키메라', Tarasque: '타라스크',
  Behemoth: '베히모스', Leviathan: '레비아탄', Bahamut: '바하무트',
  Ouroboros: '우로보로스', Quetzalcoatl: '케찰코아틀', Krampus: '크람푸스',
  Christmas: '크리스마스', Xolotl: '졸로틀', Mundra: '문드라', Master: '명인',
  Ancestor: '조상',
};

export const WEAPON_TYPE_EN_TO_KO: Record<string, string> = {
  Sword: '검', Mace: '철퇴', Dagger: '단검', Spear: '창', Axe: '도끼',
  Bow: '활', Crossbow: '크로스보우', Gun: '총', Staff: '지팡이',
  Wand: '마법봉', Instrument: '악기', Catalyst: '촉매',
};

// ─── Affinity translation ────────────────────────────────────────────────

function toKoElement(v: string): string {
  return ELEMENT_EN_TO_KO[v] ?? v;
}
function toKoSpirit(v: string): string {
  return SPIRIT_EN_TO_KO[v] ?? v;
}
function toKoWeaponType(v: string): string {
  return WEAPON_TYPE_EN_TO_KO[v] ?? v;
}
function mapArr(arr: any, fn: (s: string) => string): any {
  if (!Array.isArray(arr)) return arr;
  return arr.map((x) => (typeof x === 'string' ? fn(x) : x));
}

// ─── Normalize one equipment item ────────────────────────────────────────

export function normalizeEquipItem(raw: any): { korName: string; item: any } | null {
  if (!raw || typeof raw !== 'object') return null;
  const korName: string = raw.name_ko || raw['name_ko'] || '';
  if (!korName) return null;

  const item: any = { ...raw };

  // Translate affinity arrays from English → Korean
  if (item['원소친밀감']) item['원소친밀감'] = mapArr(item['원소친밀감'], toKoElement);
  if (item['고유원소종류']) item['고유원소종류'] = mapArr(item['고유원소종류'], toKoElement);
  if (item['영혼친밀감']) item['영혼친밀감'] = mapArr(item['영혼친밀감'], toKoSpirit);
  if (item['고유영혼']) item['고유영혼'] = mapArr(item['고유영혼'], toKoSpirit);
  if (item['판정타입']) item['판정타입'] = mapArr(item['판정타입'], toKoWeaponType);

  // Preserve English handles for future i18n
  item.engName = (Object.keys(item).find((k) => k === 'name_en') ? item.name_en : null) || null;
  if (!item.engName) {
    // We don't have the English key inside the value; caller passes it instead
  }

  return { korName, item };
}

/**
 * Normalize an equipment file:
 *   { "n티어": { "<English>": { name_ko, ... } } }
 * into the legacy shape:
 *   { "n티어": { "<Korean>": { ... + engName } } }
 */
export function normalizeEquipFile(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const out: any = {};
  for (const [tierKey, tierBlock] of Object.entries(raw)) {
    if (!tierBlock || typeof tierBlock !== 'object') {
      out[tierKey] = tierBlock;
      continue;
    }
    const newBlock: Record<string, any> = {};
    for (const [enKey, raw2] of Object.entries(tierBlock as Record<string, any>)) {
      const norm = normalizeEquipItem(raw2);
      if (!norm) continue;
      norm.item.engName = enKey;
      // Avoid clobbering when two items share the same Korean name
      const key = newBlock[norm.korName] ? `${norm.korName}__${enKey}` : norm.korName;
      newBlock[key] = norm.item;
    }
    out[tierKey] = newBlock;
  }
  return out;
}

/**
 * Normalize element enchant file:
 *   { "n티어": { "Fire": { name_ko, 이미지_기본, 이미지_친화, ... } } }
 * → { "n티어": { "불": { ... } } }
 */
export function normalizeElementEnchantFile(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const out: any = {};
  for (const [tierKey, tierBlock] of Object.entries(raw)) {
    if (!tierBlock || typeof tierBlock !== 'object') { out[tierKey] = tierBlock; continue; }
    const newBlock: Record<string, any> = {};
    for (const [enKey, value] of Object.entries(tierBlock as Record<string, any>)) {
      const ko = (value && (value as any).name_ko) || ELEMENT_EN_TO_KO[enKey] || enKey;
      newBlock[ko] = { ...(value as any), engName: enKey };
    }
    out[tierKey] = newBlock;
  }
  return out;
}

/**
 * Normalize spirit enchant file. Spirit data has X/O variants and a top-level
 * 영혼_에어쉽파워. We re-key by Korean name only.
 */
export function normalizeSpiritEnchantFile(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const out: any = {};
  for (const [tierKey, tierBlock] of Object.entries(raw)) {
    if (!tierBlock || typeof tierBlock !== 'object') { out[tierKey] = tierBlock; continue; }
    const newBlock: Record<string, any> = {};
    for (const [enKey, value] of Object.entries(tierBlock as Record<string, any>)) {
      const ko = (value && (value as any).name_ko) || SPIRIT_EN_TO_KO[enKey] || enKey;
      newBlock[ko] = { ...(value as any), engName: enKey };
    }
    out[tierKey] = newBlock;
  }
  return out;
}

// ─── Cached fetch helpers ────────────────────────────────────────────────

const fileCache: Record<string, any> = {};

async function fetchJson(url: string): Promise<any> {
  if (fileCache[url] !== undefined) return fileCache[url];
  const resp = await fetch(url);
  const data = await resp.json();
  fileCache[url] = data;
  return data;
}

export async function fetchEquipFileNormalized(url: string): Promise<any> {
  const cacheKey = `__norm:${url}`;
  if (fileCache[cacheKey]) return fileCache[cacheKey];
  const raw = await fetchJson(url);
  const normalized = normalizeEquipFile(raw);
  fileCache[cacheKey] = normalized;
  return normalized;
}

export async function fetchSpiritEnchantNormalized(): Promise<any> {
  const url = '/data/equipment/enchantment/spirit.json';
  const cacheKey = `__norm:${url}`;
  if (fileCache[cacheKey]) return fileCache[cacheKey];
  const raw = await fetchJson(url);
  const normalized = normalizeSpiritEnchantFile(raw);
  fileCache[cacheKey] = normalized;
  return normalized;
}

export async function fetchElementEnchantNormalized(): Promise<any> {
  const url = '/data/equipment/enchantment/element.json';
  const cacheKey = `__norm:${url}`;
  if (fileCache[cacheKey]) return fileCache[cacheKey];
  const raw = await fetchJson(url);
  const normalized = normalizeElementEnchantFile(raw);
  fileCache[cacheKey] = normalized;
  return normalized;
}
