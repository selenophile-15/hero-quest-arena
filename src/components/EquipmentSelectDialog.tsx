import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import {
  EquipmentItem,
  loadEquipmentByTypes,
  loadEquipNameMap,
  loadSID,
  getSlotTypes,
  getMaxTierForLevel,
  EQUIP_TYPE_MAP,
} from '@/lib/equipmentUtils';

interface EquipmentSlotData {
  item: EquipmentItem | null;
  quality: string;
  element: { type: string; tier: number; affinity: boolean } | null;
  spirit: { name: string; affinity: boolean } | null;
}

interface EquipmentSelectDialogProps {
  open: boolean;
  onClose: () => void;
  jobName: string;
  heroLevel: number;
  initialSlot?: number;
  slotCount?: number;
  currentEquipment: EquipmentSlotData[];
  onConfirm: (equipment: EquipmentSlotData[]) => void;
}

const QUALITY_OPTIONS = [
  { value: 'common', label: '일반', color: 'text-gray-300' },
  { value: 'uncommon', label: '고급', color: 'text-green-400' },
  { value: 'flawless', label: '최고급', color: 'text-blue-400' },
  { value: 'epic', label: '에픽', color: 'text-purple-400' },
  { value: 'legendary', label: '전설', color: 'text-yellow-400' },
];

const QUALITY_BORDER: Record<string, string> = {
  common: 'border-gray-300/50',
  uncommon: 'border-green-400/60',
  flawless: 'border-blue-400/60',
  epic: 'border-purple-400/70',
  legendary: 'border-yellow-400/80',
};

const QUALITY_RADIAL: Record<string, string> = {
  common: 'rgba(220,220,220,0.18)',
  uncommon: 'rgba(74,222,128,0.2)',
  flawless: 'rgba(96,165,250,0.25)',
  epic: 'rgba(192,132,252,0.3)',
  legendary: 'rgba(250,204,21,0.35)',
};

const QUALITY_SHADOW: Record<string, string> = {
  common: '0 0 8px rgba(220,220,220,0.4)',
  uncommon: '0 0 10px rgba(74,222,128,0.5)',
  flawless: '0 0 12px rgba(96,165,250,0.5)',
  epic: '0 0 14px rgba(192,132,252,0.6)',
  legendary: '0 0 16px rgba(250,204,21,0.7)',
};

const STAT_FILTER_OPTIONS = [
  { value: '장비_공격력', label: '공격력' },
  { value: '장비_방어력', label: '방어력' },
  { value: '장비_체력', label: '체력' },
  { value: '장비_치명타확률%', label: '치명타 확률' },
  { value: '장비_회피%', label: '회피' },
];

const STAT_ICONS: Record<string, string> = {
  '장비_공격력': '/images/stats/attack.png',
  '장비_방어력': '/images/stats/defense.png',
  '장비_체력': '/images/stats/health.png',
  '장비_치명타확률%': '/images/stats/critchance.png',
  '장비_회피%': '/images/stats/evasion.png',
};

const ELEMENT_ICONS: Record<string, string> = {
  '불': '/images/elements/fire.png',
  '물': '/images/elements/water.png',
  '공기': '/images/elements/air.png',
  '대지': '/images/elements/earth.png',
  '빛': '/images/elements/light.png',
  '어둠': '/images/elements/dark.png',
};

const ELEMENT_ENG: Record<string, string> = {
  '불': 'fire', '물': 'water', '공기': 'air', '대지': 'earth', '빛': 'light', '어둠': 'dark',
};

const ELEMENT_FILTER_OPTIONS = [
  { value: '불', label: '불' },
  { value: '물', label: '물' },
  { value: '공기', label: '공기' },
  { value: '대지', label: '대지' },
  { value: '빛', label: '빛' },
  { value: '어둠', label: '어둠' },
];

const TYPE_IMAGE_FIX: Record<string, string> = { staves: 'staff' };
function getTypeImagePath(typeFile: string) {
  return `/images/type/${TYPE_IMAGE_FIX[typeFile] || typeFile}.png`;
}

function formatEquipStat(key: string, value: number): string {
  if (key === '장비_치명타확률%' || key === '장비_회피%') return `${value} %`;
  return formatNumber(value);
}

export default function EquipmentSelectDialog({
  open, onClose, jobName, heroLevel, initialSlot = 0, slotCount = 6,
  currentEquipment, onConfirm,
}: EquipmentSelectDialogProps) {
  const [activeSlot, setActiveSlot] = useState(initialSlot);
  const [slots, setSlots] = useState<EquipmentSlotData[]>([...currentEquipment]);
  const [allItems, setAllItems] = useState<EquipmentItem[]>([]);
  const [slotAllowedTypes, setSlotAllowedTypes] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);

  const maxTier = getMaxTierForLevel(heroLevel || 1);
  const [filterType, setFilterType] = useState<string>('_all');
  const [filterStat, setFilterStat] = useState<string>('_all');
  const [filterTierMin, setFilterTierMin] = useState<number>(Math.max(1, maxTier - 2));
  const [filterTierMax, setFilterTierMax] = useState<number>(maxTier);
  const [filterElement, setFilterElement] = useState<string>('_all');
  const [filterSpirit, setFilterSpirit] = useState<string>('_all');
  const [slotQuality, setSlotQuality] = useState<string>('common');

  // Collect unique spirit names for filter
  const spiritNames = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach(item => {
      item.spiritAffinity?.forEach(s => set.add(s));
      if (item.uniqueSpirit) set.add(item.uniqueSpirit);
    });
    return Array.from(set).sort();
  }, [allItems]);

  // Load data
  useEffect(() => {
    if (!open || !jobName) return;
    const load = async () => {
      setLoading(true);
      const [sid, nameMap] = await Promise.all([loadSID(), loadEquipNameMap()]);
      const allowedPerSlot: string[][] = [];
      const allTypeSet = new Set<string>();
      let hasWeapon = false;
      for (let i = 0; i < slotCount; i++) {
        const types = getSlotTypes(sid, jobName, i);
        allowedPerSlot.push(types);
        types.forEach(t => {
          allTypeSet.add(t);
          if (EQUIP_TYPE_MAP[t]?.category === 'weapon') hasWeapon = true;
        });
      }
      // Always load dual_wield if any weapon type present
      if (hasWeapon && !allTypeSet.has('쌍수')) {
        allTypeSet.add('쌍수');
      }
      setSlotAllowedTypes(allowedPerSlot);
      const items = await loadEquipmentByTypes(Array.from(allTypeSet), nameMap);
      setAllItems(items);
      setLoading(false);
    };
    load();
  }, [open, jobName, slotCount]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSlots([...currentEquipment]);
      setActiveSlot(initialSlot);
      const mt = getMaxTierForLevel(heroLevel || 1);
      setFilterTierMax(mt);
      setFilterTierMin(Math.max(1, mt - 2));
      setSlotQuality(currentEquipment[initialSlot]?.quality || 'common');
    }
  }, [open, currentEquipment, initialSlot, heroLevel]);

  // Sync quality when switching slot
  useEffect(() => {
    setSlotQuality(slots[activeSlot]?.quality || 'common');
  }, [activeSlot]);

  // Filtered items for current slot
  const filteredItems = useMemo(() => {
    const allowedTypes = slotAllowedTypes[activeSlot] || [];
    if (allowedTypes.length === 0) return [];

    const allowedFileTypes = new Set<string>();
    const allowedWeaponKorTypes = new Set<string>();
    for (const typeKor of allowedTypes) {
      const info = EQUIP_TYPE_MAP[typeKor];
      if (info) {
        allowedFileTypes.add(info.file);
        if (info.category === 'weapon') allowedWeaponKorTypes.add(typeKor);
      }
    }
    // Also allow dual_wield if weapon types exist
    if (allowedWeaponKorTypes.size > 0) {
      allowedFileTypes.add('dual_wield');
    }

    return allItems.filter(item => {
      // Dual wield special: check 판정타입
      if (item.type === 'dual_wield') {
        if (!item.judgmentTypes || item.judgmentTypes.length === 0) return false;
        const hasMatch = item.judgmentTypes.some(jt => allowedWeaponKorTypes.has(jt));
        if (!hasMatch) return false;
        // User type filter for dual_wield
        if (filterType !== '_all' && filterType !== '쌍수') {
          if (!item.judgmentTypes.includes(filterType)) return false;
        }
      } else {
        if (!allowedFileTypes.has(item.type)) return false;
        if (filterType !== '_all') {
          if (filterType === '쌍수') return false; // only dual_wield
          const filterInfo = EQUIP_TYPE_MAP[filterType];
          if (filterInfo && item.type !== filterInfo.file) return false;
        }
      }

      if (filterStat !== '_all' && !item.stats.some(s => s.key === filterStat)) return false;
      if (item.tier < filterTierMin || item.tier > filterTierMax) return false;
      if (item.tier > maxTier) return false;

      // Element affinity filter
      if (filterElement !== '_all') {
        const hasAffinity = item.elementAffinity?.includes(filterElement);
        const hasUnique = item.uniqueElement?.includes(filterElement);
        if (!hasAffinity && !hasUnique) return false;
      }

      // Spirit affinity filter
      if (filterSpirit !== '_all') {
        const hasAffinity = item.spiritAffinity?.includes(filterSpirit);
        const hasUnique = item.uniqueSpirit === filterSpirit;
        if (!hasAffinity && !hasUnique) return false;
      }

      return true;
    });
  }, [allItems, activeSlot, slotAllowedTypes, filterType, filterStat, filterTierMin, filterTierMax, filterElement, filterSpirit, maxTier]);

  const handleSelectItem = (item: EquipmentItem) => {
    const currentItem = slots[activeSlot]?.item;
    // Toggle: if same item selected, deselect
    if (currentItem?.name === item.name && currentItem?.tier === item.tier) {
      handleClearSlot();
      return;
    }
    const newSlots = [...slots];
    newSlots[activeSlot] = { ...newSlots[activeSlot], item: { ...item }, quality: slotQuality };
    setSlots(newSlots);
  };

  const handleClearSlot = () => {
    const newSlots = [...slots];
    newSlots[activeSlot] = { item: null, quality: 'common', element: null, spirit: null };
    setSlots(newSlots);
  };

  const handleQualityChange = (q: string) => {
    setSlotQuality(q);
    const newSlots = [...slots];
    newSlots[activeSlot] = { ...newSlots[activeSlot], quality: q };
    setSlots(newSlots);
  };

  const handleBatchQuality = () => {
    setSlots(prev => prev.map(s => ({ ...s, quality: slotQuality })));
  };

  const handleConfirm = () => {
    onConfirm(slots);
    onClose();
  };

  const currentAllowedTypes = slotAllowedTypes[activeSlot] || [];
  // Add 쌍수 to filter options if any weapon type
  const hasWeaponInSlot = currentAllowedTypes.some(t => EQUIP_TYPE_MAP[t]?.category === 'weapon');
  const filterTypeOptions = hasWeaponInSlot
    ? [...currentAllowedTypes, ...(currentAllowedTypes.includes('쌍수') ? [] : ['쌍수'])]
    : currentAllowedTypes;

  const currentSlotItem = slots[activeSlot]?.item;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-6xl h-[85vh] overflow-hidden flex flex-col p-5">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>장비 선택</DialogTitle>
          <DialogDescription className="sr-only">슬롯별 장비를 선택하세요</DialogDescription>
        </DialogHeader>

        {/* Selected item preview */}
        <div
          className={`flex items-center gap-4 p-3 rounded-lg border min-h-[72px] mb-2 ${
            currentSlotItem ? 'cursor-pointer hover:bg-secondary/40' : ''
          } ${currentSlotItem ? QUALITY_BORDER[slots[activeSlot]?.quality || 'common'] : 'border-border/50'}`}
          style={currentSlotItem ? {
            background: `radial-gradient(circle at center, ${QUALITY_RADIAL[slots[activeSlot]?.quality || 'common']} 0%, transparent 70%)`,
            boxShadow: QUALITY_SHADOW[slots[activeSlot]?.quality || 'common'],
          } : {}}
          onClick={() => currentSlotItem && handleClearSlot()}
        >
          {currentSlotItem ? (
            <>
              {currentSlotItem.imagePath ? (
                <img src={currentSlotItem.imagePath} alt="" className="w-14 h-14 object-contain flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-14 h-14 flex items-center justify-center text-sm text-muted-foreground">{currentSlotItem.name.slice(0, 4)}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{currentSlotItem.name}</p>
                <p className="text-xs text-muted-foreground">{currentSlotItem.typeKor} · T{currentSlotItem.tier}</p>
              </div>
              <div className="flex gap-3 items-center flex-shrink-0">
                {currentSlotItem.stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <img src={STAT_ICONS[s.key] || ''} alt="" className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    <span className="text-sm font-medium tabular-nums">{formatEquipStat(s.key, s.value)}</span>
                  </div>
                ))}
              </div>
              <span className="text-xs text-destructive/70 flex-shrink-0 ml-2">클릭하여 해제</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">장비를 선택하세요</span>
          )}
        </div>

        <Tabs value={`slot-${activeSlot}`} onValueChange={v => setActiveSlot(parseInt(v.replace('slot-', ''), 10))} className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-full">
            {Array.from({ length: slotCount }).map((_, i) => (
              <TabsTrigger key={i} value={`slot-${i}`} className={`flex-1 text-xs ${slots[i]?.item ? 'text-accent font-bold' : ''}`}>
                슬롯 {i + 1}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Filters */}
          <div className="flex items-center gap-2 my-2 px-1 flex-wrap text-xs">
            <span className="text-muted-foreground">타입:</span>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                {filterTypeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">스탯:</span>
            <Select value={filterStat} onValueChange={setFilterStat}>
              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                {STAT_FILTER_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">티어:</span>
            <input type="number" min={1} max={maxTier} value={filterTierMin}
              onChange={e => setFilterTierMin(Math.max(1, Math.min(maxTier, parseInt(e.target.value) || 1)))}
              className="h-7 w-12 text-xs text-center rounded border border-border bg-background" />
            <span className="text-muted-foreground">~</span>
            <input type="number" min={1} max={maxTier} value={filterTierMax}
              onChange={e => setFilterTierMax(Math.min(maxTier, parseInt(e.target.value) || maxTier))}
              className="h-7 w-12 text-xs text-center rounded border border-border bg-background" />

            <span className="text-muted-foreground">원소:</span>
            <Select value={filterElement} onValueChange={setFilterElement}>
              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                {ELEMENT_FILTER_OPTIONS.map(e => (
                  <SelectItem key={e.value} value={e.value}>
                    <span className="flex items-center gap-1">
                      <img src={ELEMENT_ICONS[e.value]} className="w-3.5 h-3.5" alt="" />
                      {e.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">영혼:</span>
            <Select value={filterSpirit} onValueChange={setFilterSpirit}>
              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                {spiritNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <span className="text-muted-foreground">아이템 등급:</span>
            <Select value={slotQuality} onValueChange={handleQualityChange}>
              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map(q => (
                  <SelectItem key={q.value} value={q.value}><span className={q.color}>{q.label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBatchQuality}>
              일괄 적용
            </Button>
          </div>

          {/* Item grid */}
          {Array.from({ length: slotCount }).map((_, slotIdx) => (
            <TabsContent key={slotIdx} value={`slot-${slotIdx}`} className="mt-0 flex-1 min-h-0">
              <div className="overflow-y-auto h-full border border-border rounded p-3">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">로딩 중...</div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">장착 가능한 장비가 없습니다</div>
                ) : (
                  <div className="grid grid-cols-6 gap-3">
                    {filteredItems.map((item, idx) => {
                      const isSelected = currentSlotItem?.name === item.name && currentSlotItem?.tier === item.tier;
                      const quality = slots[activeSlot]?.quality || 'common';

                      return (
                        <button
                          key={`${item.name}-${item.tier}-${idx}`}
                          onClick={() => handleSelectItem(item)}
                          className={`relative flex flex-col items-center p-2 rounded-lg border-2 transition-all hover:border-primary/50 cursor-pointer ${
                            isSelected ? `${QUALITY_BORDER[quality]} bg-accent/10` : 'border-border/50 bg-secondary/20'
                          }`}
                          style={isSelected ? {
                            background: `radial-gradient(circle, ${QUALITY_RADIAL[quality]} 0%, transparent 70%)`,
                            boxShadow: QUALITY_SHADOW[quality],
                          } : {}}
                          title={`${item.name} (${item.typeKor} T${item.tier})`}
                        >
                          {/* Tier badge */}
                          <span className="absolute top-1 left-1 text-[9px] font-bold text-muted-foreground bg-background/80 rounded px-1">
                            T{item.tier}
                          </span>

                          {/* Relic */}
                          {item.relic && (
                            <img src="/images/special/relic_mark.png" alt="유물" className="absolute top-1 right-1 w-4 h-4"
                              onError={e => { e.currentTarget.style.display = 'none'; }} />
                          )}

                          {/* Image */}
                          <div className="w-16 h-16 flex items-center justify-center my-1">
                            {item.imagePath ? (
                              <img src={item.imagePath} alt={item.name} className="w-14 h-14 object-contain"
                                onError={e => {
                                  e.currentTarget.style.display = 'none';
                                  const p = e.currentTarget.parentElement;
                                  if (p) { const s = document.createElement('span'); s.className = 'text-[9px] text-muted-foreground text-center'; s.textContent = item.name.slice(0, 6); p.appendChild(s); }
                                }} />
                            ) : (
                              <span className="text-[9px] text-muted-foreground text-center leading-tight">{item.name.slice(0, 8)}</span>
                            )}
                          </div>

                          {/* Affinity icons row */}
                          <div className="flex gap-0.5 items-center justify-center min-h-[16px] my-0.5">
                            {item.elementAffinity?.map(el => (
                              <img key={el} src={ELEMENT_ICONS[el] || ''} alt={el} title={`원소 친밀: ${el}`} className="w-3.5 h-3.5"
                                onError={e => { e.currentTarget.style.display = 'none'; }} />
                            ))}
                            {item.uniqueElement?.map(el => {
                              const eng = ELEMENT_ENG[el];
                              const tier = item.uniqueElementTier || 1;
                              return (
                                <img key={`u-${el}`} src={eng ? `/images/enchant/element/${eng}${tier}_2.png` : ''} alt={el}
                                  title={`고유 원소: ${el} T${tier}`} className="w-3.5 h-3.5"
                                  onError={e => { e.currentTarget.style.display = 'none'; }} />
                              );
                            })}
                            {item.spiritAffinity?.map(sp => (
                              <span key={sp} className="text-[7px] text-muted-foreground bg-secondary/50 rounded px-0.5" title={`영혼 친밀: ${sp}`}>{sp}</span>
                            ))}
                            {item.uniqueSpirit && (
                              <span className="text-[7px] text-accent bg-accent/10 rounded px-0.5" title={`고유 영혼: ${item.uniqueSpirit}`}>{item.uniqueSpirit}</span>
                            )}
                          </div>

                          {/* Stats row */}
                          <div className="flex gap-1 items-center justify-center">
                            {item.stats.slice(0, 3).map((s, si) => (
                              <div key={si} className="flex items-center gap-0.5">
                                <img src={STAT_ICONS[s.key] || ''} alt="" className="w-3.5 h-3.5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                <span className="text-[9px] tabular-nums">{formatEquipStat(s.key, s.value)}</span>
                              </div>
                            ))}
                          </div>

                          {/* Name */}
                          <p className="text-[10px] text-foreground/80 truncate w-full text-center mt-0.5 leading-tight font-medium">
                            {item.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Bottom summary */}
        <div className="flex items-center gap-2 pt-2 border-t border-border mt-2">
          <div className="flex gap-1 flex-1 overflow-x-auto">
            {slots.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSlot(i)}
                className={`flex flex-col items-center p-1.5 rounded border min-w-[64px] transition-all ${
                  activeSlot === i ? 'border-primary ring-1 ring-primary/30' : ''
                } ${s.item ? QUALITY_BORDER[s.quality] : 'border-border/30 opacity-50'}`}
                style={s.item ? {
                  background: `radial-gradient(circle, ${QUALITY_RADIAL[s.quality]} 0%, transparent 70%)`,
                  boxShadow: QUALITY_SHADOW[s.quality],
                } : {}}
              >
                <span className={`text-[8px] ${s.item ? 'text-accent font-bold' : 'text-muted-foreground'}`}>슬롯 {i + 1}</span>
                {s.item ? (
                  <>
                    {s.item.imagePath ? (
                      <img src={s.item.imagePath} alt="" className="w-9 h-9 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span className="text-[8px] text-foreground w-9 h-9 flex items-center justify-center">{s.item.name.slice(0, 4)}</span>
                    )}
                    <span className="text-[8px] text-foreground truncate max-w-[58px]">{s.item.name}</span>
                  </>
                ) : (
                  <span className="text-[9px] text-muted-foreground w-9 h-9 flex items-center justify-center">-</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" onClick={handleConfirm}>확인</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
