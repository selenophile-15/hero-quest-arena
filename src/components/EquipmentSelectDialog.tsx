import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { SPIRIT_NAME_MAP } from '@/lib/nameMap';
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
  { value: 'epic', label: '에픽', color: 'text-fuchsia-400' },
  { value: 'legendary', label: '전설', color: 'text-yellow-400' },
];

const QUALITY_BORDER: Record<string, string> = {
  common: 'border-gray-300/50',
  uncommon: 'border-green-400/60',
  flawless: 'border-blue-400/60',
  epic: 'border-fuchsia-400/70',
  legendary: 'border-yellow-400/80',
};

const QUALITY_RADIAL: Record<string, string> = {
  common: 'rgba(220,220,220,0.18)',
  uncommon: 'rgba(74,222,128,0.2)',
  flawless: 'rgba(96,165,250,0.25)',
  epic: 'rgba(217,70,239,0.3)',
  legendary: 'rgba(250,204,21,0.35)',
};

const QUALITY_SHADOW: Record<string, string> = {
  common: '0 0 8px rgba(220,220,220,0.4)',
  uncommon: '0 0 10px rgba(74,222,128,0.5)',
  flawless: '0 0 12px rgba(96,165,250,0.5)',
  epic: '0 0 14px rgba(217,70,239,0.6)',
  legendary: '0 0 16px rgba(250,204,21,0.7)',
};

const STAT_FILTER_OPTIONS = [
  { value: '장비_공격력', label: '공격력' },
  { value: '장비_방어력', label: '방어력' },
  { value: '장비_체력', label: '체력' },
  { value: '장비_치명타확률%', label: '치명타 확률' },
  { value: '장비_회피%', label: '회피' },
];

// Stat label colors (no icons in tooltip)
const STAT_COLOR: Record<string, string> = {
  '장비_공격력': 'text-red-400',
  '장비_방어력': 'text-blue-400',
  '장비_체력': 'text-orange-400',
  '장비_치명타확률%': 'text-yellow-400',
  '장비_회피%': 'text-teal-400',
};

const ELEMENT_COLORS: Record<string, string> = {
  '불': 'text-red-400', '물': 'text-blue-400', '공기': 'text-cyan-300',
  '대지': 'text-amber-600', '빛': 'text-yellow-300', '어둠': 'text-purple-400',
  '모든 원소': 'text-white', '골드': 'text-yellow-500',
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

// Spirit tier ordering (descending)
const SPIRIT_TIER: Record<string, number> = {
  '바하무트': 15, '레비아탄': 15, '그리핀': 15,
  '명인': 14, '조상': 14,
  '베히모스': 14, '우로보로스': 14,
  '기린': 13, '크람푸스': 13, '크리스마스': 13,
  '크라켄': 12, '키메라': 12, '카벙클': 12,
  '타라스크': 11, '하이드라': 11, '불사조': 11,
  '케찰코아틀': 10, '호랑이': 10,
  '매머드': 9, '공룡': 9,
  '사자': 8, '곰': 8,
  '바다코끼리': 7, '상어': 7,
  '다람쥐': 6, '하마': 6,
  '말': 5, '도마뱀': 5,
  '아르마딜로': 4, '부엉이': 4,
  '졸로틀': 3, '코뿔소': 3,
  '독수리': 2, '독사': 2, '토끼': 2,
  '황소': 1, '늑대': 1, '양': 1, '거위': 1, '고양이': 1,
};

function getSpiritTier(name: string): number {
  return SPIRIT_TIER[name] || 0;
}

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

  // Check if any slot already has a relic
  const hasRelicEquipped = useMemo(() => {
    return slots.some((s, i) => i !== activeSlot && s.item?.relic);
  }, [slots, activeSlot]);

  const currentSlotHasRelic = slots[activeSlot]?.item?.relic || false;

  const spiritNames = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach(item => {
      item.spiritAffinity?.forEach(s => set.add(s));
      if (item.uniqueSpirit) item.uniqueSpirit.forEach(s => set.add(s));
    });
    // Sort by tier descending
    return Array.from(set).sort((a, b) => getSpiritTier(b) - getSpiritTier(a));
  }, [allItems]);

  // Group spirits by tier for rendering with dividers
  const spiritGroups = useMemo(() => {
    const groups: { tier: number; spirits: string[] }[] = [];
    let lastTier = -1;
    for (const sp of spiritNames) {
      const t = getSpiritTier(sp);
      if (t !== lastTier) {
        groups.push({ tier: t, spirits: [sp] });
        lastTier = t;
      } else {
        groups[groups.length - 1].spirits.push(sp);
      }
    }
    return groups;
  }, [spiritNames]);

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

  // Reset filters + state on open
  useEffect(() => {
    if (open) {
      setSlots([...currentEquipment]);
      setActiveSlot(initialSlot);
      const mt = getMaxTierForLevel(heroLevel || 1);
      setFilterTierMax(mt);
      setFilterTierMin(Math.max(1, mt - 2));
      setSlotQuality(currentEquipment[initialSlot]?.quality || 'common');
      // Reset filters
      setFilterType('_all');
      setFilterStat('_all');
      setFilterElement('_all');
      setFilterSpirit('_all');
    }
  }, [open, currentEquipment, initialSlot, heroLevel]);

  useEffect(() => {
    setSlotQuality(slots[activeSlot]?.quality || 'common');
  }, [activeSlot]);

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
    if (allowedWeaponKorTypes.size > 0) {
      allowedFileTypes.add('dual_wield');
    }

    return allItems.filter(item => {
      if (item.type === 'dual_wield') {
        if (!item.judgmentTypes || item.judgmentTypes.length === 0) return false;
        const hasMatch = item.judgmentTypes.some(jt => allowedWeaponKorTypes.has(jt));
        if (!hasMatch) return false;
        // Dual wield only shows when filter is 쌍수 or _all
        if (filterType !== '_all' && filterType !== '쌍수') return false;
      } else {
        if (!allowedFileTypes.has(item.type)) return false;
        if (filterType !== '_all') {
          if (filterType === '쌍수') return false;
          const filterInfo = EQUIP_TYPE_MAP[filterType];
          if (filterInfo && item.type !== filterInfo.file) return false;
        }
      }

      if (filterStat !== '_all' && !item.stats.some(s => s.key === filterStat)) return false;
      if (item.tier < filterTierMin || item.tier > filterTierMax) return false;
      if (item.tier > maxTier) return false;

      if (filterElement !== '_all') {
        const hasAffinity = item.elementAffinity?.includes(filterElement);
        const hasUnique = item.uniqueElement?.includes(filterElement);
        if (!hasAffinity && !hasUnique) return false;
      }

      if (filterSpirit !== '_all') {
        const hasAffinity = item.spiritAffinity?.includes(filterSpirit);
        const hasUnique = item.uniqueSpirit?.includes(filterSpirit);
        if (!hasAffinity && !hasUnique) return false;
      }

      return true;
    });
  }, [allItems, activeSlot, slotAllowedTypes, filterType, filterStat, filterTierMin, filterTierMax, filterElement, filterSpirit, maxTier]);

  const handleSelectItem = useCallback((item: EquipmentItem) => {
    const currentItem = slots[activeSlot]?.item;
    if (currentItem?.name === item.name && currentItem?.tier === item.tier) {
      handleClearSlot();
      return;
    }
    // Block if relic and already have one in another slot
    if (item.relic && hasRelicEquipped) return;
    const newSlots = [...slots];
    newSlots[activeSlot] = { ...newSlots[activeSlot], item: { ...item }, quality: slotQuality };
    setSlots(newSlots);
  }, [slots, activeSlot, slotQuality, hasRelicEquipped]);

  const handleClearSlot = useCallback(() => {
    const newSlots = [...slots];
    newSlots[activeSlot] = { item: null, quality: 'common', element: null, spirit: null };
    setSlots(newSlots);
  }, [slots, activeSlot]);

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
  const hasWeaponInSlot = currentAllowedTypes.some(t => EQUIP_TYPE_MAP[t]?.category === 'weapon');
  const filterTypeOptions = hasWeaponInSlot
    ? [...currentAllowedTypes, ...(currentAllowedTypes.includes('쌍수') ? [] : ['쌍수'])]
    : currentAllowedTypes;

  const currentSlotItem = slots[activeSlot]?.item;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] overflow-hidden flex flex-col p-5">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>장비 선택</DialogTitle>
          <DialogDescription className="sr-only">슬롯별 장비를 선택하세요</DialogDescription>
        </DialogHeader>

        {/* Top: Slot summary + confirm/cancel */}
        <div className="flex items-center gap-2 pb-2 border-b border-border">
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
                    {s.item.relic && <img src="/images/special/icon_global_artifact.png" alt="유물" className="w-3 h-3" onError={e => { e.currentTarget.style.display = 'none'; }} />}
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

        {/* Slot tabs */}
        <div className="flex items-center gap-1 my-1">
          {Array.from({ length: slotCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlot(i)}
              className={`flex-1 text-xs py-1.5 rounded transition-all ${
                activeSlot === i ? 'bg-primary text-primary-foreground font-bold' : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'
              } ${slots[i]?.item ? 'text-accent font-bold' : ''}`}
            >
              슬롯 {i + 1}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-1 flex-wrap text-xs">
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
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-muted-foreground">영혼:</span>
          <Select value={filterSpirit} onValueChange={setFilterSpirit}>
            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">전체</SelectItem>
              {spiritGroups.map((group, gi) => (
                <div key={gi}>
                  {gi > 0 && <div className="border-t border-border/30 my-0.5" />}
                  {group.spirits.map(sp => (
                    <SelectItem key={sp} value={sp}>
                      <span className="text-muted-foreground text-[10px] mr-1">T{group.tier}</span>{sp}
                    </SelectItem>
                  ))}
                </div>
              ))}
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

        {/* Item grid - single content area, no Tabs re-rendering */}
        <div className="flex-1 min-h-0 mt-1">
          <div className="overflow-y-auto h-full border border-border rounded p-3">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">로딩 중...</div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">장착 가능한 장비가 없습니다</div>
            ) : (
              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-6 gap-3">
                  {filteredItems.map((item, idx) => {
                    const isSelected = currentSlotItem?.name === item.name && currentSlotItem?.tier === item.tier;
                    const quality = slots[activeSlot]?.quality || 'common';
                    const isRelicBlocked = item.relic && hasRelicEquipped && !currentSlotHasRelic;

                    // Element/spirit affinity icons for card
                    const elemIcons = item.elementAffinity?.filter(e => e !== '모든 원소') || [];
                    const uniqueElems = item.uniqueElement || [];
                    const spiritAffs = item.spiritAffinity || [];
                    const uniqueSp = item.uniqueSpirit;
                    const hasAffinityIcons = elemIcons.length > 0 || uniqueElems.length > 0 || spiritAffs.length > 0 || (uniqueSp && uniqueSp.length > 0);

                    return (
                      <Tooltip key={`${item.name}-${item.tier}-${idx}`}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => !isRelicBlocked && handleSelectItem(item)}
                            disabled={isRelicBlocked}
                            className={`relative flex flex-col items-center p-2 rounded-lg border-2 transition-all cursor-pointer ${
                              isRelicBlocked ? 'opacity-40 cursor-not-allowed' :
                              isSelected ? `${QUALITY_BORDER[quality]} bg-accent/10` : 'border-border/50 bg-secondary/20 hover:border-primary/50'
                            }`}
                            style={isSelected ? {
                              background: `radial-gradient(circle, ${QUALITY_RADIAL[quality]} 0%, transparent 70%)`,
                              boxShadow: QUALITY_SHADOW[quality],
                            } : {}}
                          >
                            {/* Tier badge */}
                            <span className="absolute top-1 left-1 text-[9px] font-bold text-muted-foreground bg-background/80 rounded px-1">
                              T{item.tier}
                            </span>

                            {/* Relic icon */}
                            {item.relic && (
                              <img src="/images/special/icon_global_artifact.png" alt="유물" className="absolute top-1 right-1 w-4 h-4"
                                onError={e => { e.currentTarget.style.display = 'none'; }} />
                            )}

                            {/* Relic blocked indicator */}
                            {isRelicBlocked && (
                              <span className="absolute top-5 right-0 text-[7px] text-red-400 bg-background/80 rounded px-0.5">유물 중복</span>
                            )}

                            {/* Item image */}
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

                            {/* Affinity icons row below image */}
                            {hasAffinityIcons && (
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {elemIcons.map(el => (
                                  <img key={el} src="/images/elements/all.png" alt={el} className="w-3.5 h-3.5" title={`친밀 원소: ${el}`}
                                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                                ))}
                                {uniqueElems.map(el => {
                                  const eng = ELEMENT_ENG[el];
                                  const tier = item.uniqueElementTier || 1;
                                  return (
                                    <img key={`u-${el}`} src={eng ? `/images/enchant/element/${eng}${tier}_2.png` : ''} alt={el} className="w-3.5 h-3.5" title={`고유 원소: ${el} T${tier}`}
                                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                                  );
                                })}
                                {spiritAffs.map(sp => {
                                  const eng = SPIRIT_NAME_MAP[sp];
                                  return (
                                    <img key={sp} src={eng ? `/images/enchant/spirit/${eng}_1.png` : ''} alt={sp} className="w-3.5 h-3.5" title={`친밀 영혼: ${sp}`}
                                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                                  );
                                })}
                                {uniqueSp && uniqueSp.map(sp => {
                                  const eng = SPIRIT_NAME_MAP[sp];
                                  return (
                                    <img key={`us-${sp}`} src={eng ? `/images/enchant/spirit/${eng}_2.png` : ''} alt={sp} className="w-3.5 h-3.5" title={`고유 영혼: ${sp}`}
                                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                                  );
                                })}
                              </div>
                            )}

                            {/* Item name */}
                            <p className="text-[10px] text-foreground/80 truncate w-full text-center mt-0.5 leading-tight font-medium">
                              {item.name}
                            </p>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs p-3 space-y-1.5">
                          <p className="font-bold text-sm">{item.name} <span className="text-muted-foreground font-normal">(T{item.tier}, {item.typeKor})</span></p>
                          {item.relic && <p className="text-xs text-yellow-400 font-semibold">⭐ 유물</p>}

                          {/* Stats - colored text, no icons */}
                          {item.stats.length > 0 && (
                            <div className="space-y-0.5">
                              {item.stats.map((s, si) => (
                                <div key={si} className="flex items-center gap-1 text-xs">
                                  <span className={`font-medium ${STAT_COLOR[s.key] || 'text-foreground'}`}>
                                    {STAT_FILTER_OPTIONS.find(o => o.value === s.key)?.label || s.key}:
                                  </span>
                                  <span className="tabular-nums">{formatEquipStat(s.key, s.value)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Element affinity - text only with color */}
                          {item.elementAffinity && item.elementAffinity.length > 0 && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">친밀 원소: </span>
                              {item.elementAffinity.map((el, i) => (
                                <span key={el} className={ELEMENT_COLORS[el] || 'text-foreground'}>
                                  {el}{i < item.elementAffinity!.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Unique element - icon */}
                          {item.uniqueElement && item.uniqueElement.length > 0 && (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground">고유 원소:</span>
                              {item.uniqueElement.map(el => {
                                const eng = ELEMENT_ENG[el];
                                const tier = item.uniqueElementTier || 1;
                                return (
                                  <span key={el} className="flex items-center gap-0.5">
                                    <img src={eng ? `/images/enchant/element/${eng}${tier}_2.png` : ''} alt={el} className="w-3.5 h-3.5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                    <span className={ELEMENT_COLORS[el] || ''}>{el} T{tier}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Spirit affinity - text only */}
                          {item.spiritAffinity && item.spiritAffinity.length > 0 && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">친밀 영혼: </span>
                              {item.spiritAffinity.map((sp, i) => (
                                <span key={sp} className="text-foreground">
                                  {sp} (T{getSpiritTier(sp)}){i < item.spiritAffinity!.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Unique spirit */}
                          {item.uniqueSpirit && item.uniqueSpirit.length > 0 && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">고유 영혼: </span>
                              {item.uniqueSpirit.map((sp, i) => (
                                <span key={sp} className="text-foreground">{sp} (T{getSpiritTier(sp)}){i < item.uniqueSpirit!.length - 1 ? ', ' : ''}</span>
                              ))}
                            </div>
                          )}

                          {/* Relic effect */}
                          {item.relic && item.relicEffect && (
                            <div className="text-xs border-t border-border/50 pt-1 mt-1">
                              <span className="text-yellow-400 font-semibold">유물 효과:</span>
                              <p className="text-foreground/80 whitespace-pre-line mt-0.5">{item.relicEffect}</p>
                            </div>
                          )}

                          {item.airshipPower > 0 && (
                            <p className="text-xs text-muted-foreground">에어쉽파워: {formatNumber(item.airshipPower)}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
