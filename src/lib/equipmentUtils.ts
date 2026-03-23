// Equipment utility: type mappings, image path resolution, data loading

// SID Korean type name → file type name + category
export const EQUIP_TYPE_MAP: Record<string, { file: string; category: string }> = {
  // Weapons
  '검': { file: 'sword', category: 'weapon' },
  '철퇴': { file: 'mace', category: 'weapon' },
  '단검': { file: 'dagger', category: 'weapon' },
  '창': { file: 'spear', category: 'weapon' },
  '도끼': { file: 'axe', category: 'weapon' },
  '활': { file: 'bow', category: 'weapon' },
  '크로스보우': { file: 'crossbow', category: 'weapon' },
  '총': { file: 'gun', category: 'weapon' },
  '지팡이': { file: 'staff', category: 'weapon' },
  '마법봉': { file: 'wand', category: 'weapon' },
  '악기': { file: 'instrument', category: 'weapon' },
  '촉매': { file: 'catalyst', category: 'weapon' },
  '쌍수': { file: 'dual_wield', category: 'weapon' },
  // Armor
  '중갑옷': { file: 'heavy_armor', category: 'armor' },
  '경갑옷': { file: 'light_armor', category: 'armor' },
  '의상': { file: 'clothes', category: 'armor' },
  '머리보호대': { file: 'helmet', category: 'armor' },
  '로그 모자': { file: 'rogue_hat', category: 'armor' },
  '마법사 모자': { file: 'magician_hat', category: 'armor' },
  '건틀렛': { file: 'gauntlets', category: 'armor' },
  '팔 보호구': { file: 'gloves', category: 'armor' },
  '중량 신발': { file: 'heavy_footwear', category: 'armor' },
  '경량 신발': { file: 'light_footwear', category: 'armor' },
  // Accessories
  '방패': { file: 'shield', category: 'accessory' },
  '화살통': { file: 'quiver', category: 'accessory' },
  '망토': { file: 'cloak', category: 'accessory' },
  '우상': { file: 'idol', category: 'accessory' },
  '반지': { file: 'ring', category: 'accessory' },
  '애뮬릿': { file: 'amulet', category: 'accessory' },
  '허브 약초': { file: 'herbal_medicine', category: 'accessory' },
  '물약': { file: 'potion', category: 'accessory' },
  '주문': { file: 'spell', category: 'accessory' },
  '식사': { file: 'meal', category: 'accessory' },
  '디저트': { file: 'dessert', category: 'accessory' },
};

// Reverse: file name → Korean type name
export const EQUIP_TYPE_REVERSE: Record<string, string> = {};
for (const [kor, { file }] of Object.entries(EQUIP_TYPE_MAP)) {
  EQUIP_TYPE_REVERSE[file] = kor;
}

// Cached equip name map (Korean → English)
let equipNameMapCache: Record<string, Record<string, string>> | null = null;

export async function loadEquipNameMap(): Promise<Record<string, Record<string, string>>> {
  if (equipNameMapCache) return equipNameMapCache;
  try {
    const resp = await fetch('/data/equipment/equip_name_map.json');
    const data = await resp.json();
    // Remove metadata keys
    const { _설명, ...rest } = data;
    equipNameMapCache = rest;
    return rest;
  } catch {
    return {};
  }
}

/**
 * Get equipment image path from Korean name and type file name
 */
export function getEquipImagePath(korName: string, typeFile: string, category: string, nameMap: Record<string, Record<string, string>>): string {
  const typeMap = nameMap[typeFile];
  if (!typeMap) return '';
  const engName = typeMap[korName];
  if (!engName) return '';
  return `/images/equipment/${category}/${typeFile}/${engName}.webp`;
}

// Equipment item with metadata
export interface EquipmentItem {
  name: string;
  engName: string;
  type: string;
  typeKor: string;
  category: string;
  tier: number;
  imagePath: string;
  stats: { key: string; value: number }[];
  quality: string;
  relic: boolean;
  relicEffect: string | null;
  airshipPower: number;
  elementAffinity: string[] | null;
  spiritAffinity: string[] | null;
  uniqueElement: string[] | null;
  uniqueElementTier: number | null;
  uniqueSpirit: string[] | null;
  judgmentTypes: string[] | null;
  manual?: boolean;
  manualData?: any;
  relicStatBonuses?: { stat: string; op: string; value: number }[];
}

// Level → max equippable tier
export function getMaxTierForLevel(level: number): number {
  if (level >= 38) return 15;
  if (level >= 36) return 14;
  if (level >= 34) return 13;
  if (level >= 32) return 12;
  if (level >= 29) return 11;
  if (level >= 27) return 10;
  if (level >= 25) return 9;
  if (level >= 22) return 8;
  if (level >= 19) return 7;
  if (level >= 16) return 6;
  if (level >= 12) return 5;
  if (level >= 9) return 4;
  if (level >= 6) return 3;
  if (level >= 3) return 2;
  return 1;
}

// Cached equipment data by type
const equipDataCache: Record<string, EquipmentItem[]> = {};

/**
 * Load all equipment items for given types, sorted by tier descending
 */
export async function loadEquipmentByTypes(
  typeKorNames: string[],
  nameMap: Record<string, Record<string, string>>,
  onProgress?: (loaded: number) => void
): Promise<EquipmentItem[]> {
  const results: EquipmentItem[] = [];
  let loadedCount = 0;

  // Separate cached vs uncached types
  const uncachedTypes: { typeKor: string; file: string; category: string }[] = [];
  for (const typeKor of typeKorNames) {
    const typeInfo = EQUIP_TYPE_MAP[typeKor];
    if (!typeInfo) { loadedCount++; onProgress?.(loadedCount); continue; }
    const { file, category } = typeInfo;
    if (equipDataCache[file]) {
      results.push(...equipDataCache[file]);
      loadedCount++;
      onProgress?.(loadedCount);
    } else {
      uncachedTypes.push({ typeKor, file, category });
    }
  }

  // Fetch all uncached types in parallel
  if (uncachedTypes.length > 0) {
    const fetchPromises = uncachedTypes.map(async ({ typeKor, file, category }) => {
      try {
        const resp = await fetch(`/data/equipment/${category}/${file}.json`);
        const data = await resp.json();
        const items: EquipmentItem[] = [];

        for (const [tierKey, tierItems] of Object.entries(data)) {
          const tierMatch = tierKey.match(/(\d+)/);
          if (!tierMatch) continue;
          const tier = parseInt(tierMatch[1], 10);

          for (const [korName, itemData] of Object.entries(tierItems as Record<string, any>)) {
            const engName = nameMap[file]?.[korName] || '';
            const imagePath = engName ? `/images/equipment/${category}/${file}/${engName}.webp` : '';

            const stats: { key: string; value: number }[] = [];
            if (itemData['장비_공격력']) stats.push({ key: '장비_공격력', value: itemData['장비_공격력'] });
            if (itemData['장비_방어력']) stats.push({ key: '장비_방어력', value: itemData['장비_방어력'] });
            if (itemData['장비_체력']) stats.push({ key: '장비_체력', value: itemData['장비_체력'] });
            if (itemData['장비_치명타확률%']) stats.push({ key: '장비_치명타확률%', value: itemData['장비_치명타확률%'] });
            if (itemData['장비_회피%']) stats.push({ key: '장비_회피%', value: itemData['장비_회피%'] });

            items.push({
              name: korName,
              engName,
              type: file,
              typeKor,
              category,
              tier,
              imagePath,
              stats,
              quality: 'common',
              relic: itemData['유물'] != null && itemData['유물'] !== false,
              relicEffect: typeof itemData['유물'] === 'object' && itemData['유물']?.['효과'] ? itemData['유물']['효과'] : null,
              airshipPower: itemData['장비_에어쉽파워'] || 0,
              elementAffinity: itemData['원소친밀감'] || null,
              spiritAffinity: itemData['영혼친밀감'] || null,
              uniqueElement: itemData['고유원소종류'] || null,
              uniqueElementTier: itemData['고유원소티어'] || null,
              uniqueSpirit: itemData['고유영혼'] || null,
              judgmentTypes: itemData['판정타입'] || null,
            });
          }
        }

        equipDataCache[file] = items;
        return items;
      } catch (e) {
        console.warn(`Failed to load equipment: ${file}`, e);
        return [];
      }
    });

    const allResults = await Promise.all(fetchPromises);
    for (const items of allResults) {
      results.push(...items);
      loadedCount++;
      onProgress?.(loadedCount);
    }
  }

  // Sort by tier descending
  results.sort((a, b) => b.tier - a.tier);
  return results;
}

// SID data cache
let sidCache: Record<string, Record<string, string[]>> | null = null;

export async function loadSID(): Promise<Record<string, Record<string, string[]>>> {
  if (sidCache) return sidCache;
  try {
    const resp = await fetch('/data/SID.json');
    sidCache = await resp.json();
    return sidCache!;
  } catch {
    return {};
  }
}

/**
 * Get allowed equipment types for a job and slot
 */
export function getSlotTypes(sid: Record<string, Record<string, string[]>>, jobName: string, slotIndex: number): string[] {
  const jobData = sid[jobName];
  if (!jobData) return [];
  const slotKey = `슬롯${slotIndex + 1}`;
  return jobData[slotKey] || [];
}

// Dual wield special logic
let dualWieldDataCache: any[] | null = null;

export async function loadDualWieldData(): Promise<any[]> {
  if (dualWieldDataCache) return dualWieldDataCache;
  try {
    const resp = await fetch('/data/equipment/weapon/dual_wield.json');
    const data = await resp.json();
    const items: any[] = [];
    for (const [tierKey, tierItems] of Object.entries(data)) {
      for (const [korName, itemData] of Object.entries(tierItems as Record<string, any>)) {
        items.push({ name: korName, ...itemData });
      }
    }
    dualWieldDataCache = items;
    return items;
  } catch {
    return [];
  }
}
