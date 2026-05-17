/**
 * 사라진 황금의 도시 (Lost City of Gold) equipment set.
 *
 * 미다스의 반지(Ring of Midas, +50%) / 미다스의 애뮬릿(Amulet of Midas, +25%)
 * 유물은 장착 영웅이 착용한 "사라진 황금의 도시" 장비 슬롯의
 * 공격력/방어력/체력 보너스% 계산식 `(1 + Σbonus%)` 단계에
 * 해당 보너스를 더해준다. 두 유물 자체도 이 세트에 포함된다.
 *
 * 매칭은 영문 이름(engName) 기준으로 수행한다.
 */
export const LOST_CITY_OF_GOLD_ITEMS: ReadonlySet<string> = new Set([
  // Weapons
  "Luxurious Macuahuitl", "Opulent Brand", "Platinum Greatsword",
  "Opulent Grandaxe", "Platinum War Axe",
  "Luxurious Poignard", "Opulent Tecpatl", "Platinum Katar",
  "Opulent Maul", "Platinum Maul",
  "Luxurious Spear", "Opulent Halberd", "Platinum Lance",
  "Opulent Longbow", "Platinum Sniper",
  "Luxurious Stick", "Opulent Staff", "Platinum Scepter",
  "Opulent Wand", "Platinum Wand",
  "Opulent Crossbow", "Platinum Crossbow",
  "Opulent Pistol", "Platinum Grenadier",
  "Platinum Bell", "Platinum Pair", "Platinum Orb",
  // Consumables / spell
  "Luxurious Panacea", "Opulent Decoction", "Platinum Moss",
  "Opulent Elixir", "Platinum Tankard",
  "Luxurious Tablet", "Opulent Incantation", "Platinum Secret Map",
  "Opulent Tamales", "Platinum Steak Dinner",
  "Opulent Churros", "Platinum Strudel",
  // Armor
  "Opulent Breastplate", "Platinum Full Plate",
  "Opulent Armor", "Platinum Gambeson",
  "Luxurious Attire", "Opulent Vestment", "Platinum Robe",
  "Opulent Heaume", "Platinum Helm",
  "Opulent Sallet", "Platinum Beret",
  "Luxurious Headdress", "Opulent Headdress", "Platinum Winter Hat",
  "Luxurious Gauntlets", "Opulent Dracofists", "Platinum Gauntlets",
  "Opulent Grasp", "Platinum Gloves",
  "Luxurious Boots", "Opulent Greaves", "Platinum Greaves",
  "Opulent Footwraps", "Platinum Shoes",
  // Shields / accessories
  "Luxurious Aegis", "Opulent Buckler", "Platinum Ward",
  "Platinum Quiver",
  "Opulent Cloak", "Platinum Cloak",
  "Platinum Ancestor",
  "Luxurious Signet", "Opulent Signet", "Platinum Rings",
  "Luxurious Charm", "Opulent Carcanet", "Platinum Insignia",
  // The Midas relics themselves are part of the set
  "Ring of Midas", "Amulet of Midas",
]);

/** True if the given equipment item belongs to the Lost City of Gold set. */
export function isLostCityItem(item: any): boolean {
  if (!item) return false;
  const en: string | undefined = item.engName || item.name_en;
  return !!en && LOST_CITY_OF_GOLD_ITEMS.has(en);
}

/** Detect Midas relic and return its bonus % (0 if not Midas). */
export function midasBonusPctFor(item: any): number {
  if (!item) return 0;
  const en: string | undefined = item.engName || item.name_en;
  if (en === "Ring of Midas") return 50;
  if (en === "Amulet of Midas") return 25;
  return 0;
}
