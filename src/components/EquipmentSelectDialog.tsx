import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { SPIRIT_NAME_MAP } from '@/lib/nameMap';
import { Wrench, LayoutGrid, List, RefreshCw } from 'lucide-react';
import ManualEquipmentForm, { ManualEquipmentFormRef } from './ManualEquipmentForm';
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
  element: { type: string; tier: number; affinity: boolean; allElementAffinity?: boolean } | null;
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
  { value: 'flawless', label: '최고급', color: 'text-cyan-300' },
  { value: 'epic', label: '에픽', color: 'text-fuchsia-400' },
  { value: 'legendary', label: '전설', color: 'text-yellow-400' },
];

const QUALITY_BORDER: Record<string, string> = {
  common: 'border-gray-300/60',
  uncommon: 'border-green-400/70',
  flawless: 'border-cyan-300/80',
  epic: 'border-fuchsia-400/90',
  legendary: 'border-yellow-400',
};

const QUALITY_RADIAL: Record<string, string> = {
  common: 'rgba(220,220,220,0.4)',
  uncommon: 'rgba(74,222,128,0.45)',
  flawless: 'rgba(103,232,249,0.5)',
  epic: 'rgba(217,70,239,0.55)',
  legendary: 'rgba(250,204,21,0.6)',
};

const QUALITY_SHADOW: Record<string, string> = {
  common: '0 0 6px rgba(220,220,220,0.5)',
  uncommon: '0 0 7px rgba(74,222,128,0.55)',
  flawless: '0 0 8px rgba(103,232,249,0.55)',
  epic: '0 0 10px rgba(217,70,239,0.6)',
  legendary: '0 0 12px rgba(250,204,21,0.7)',
};

const STAT_FILTER_OPTIONS = [
  { value: '장비_공격력', label: '공격력' },
  { value: '장비_방어력', label: '방어력' },
  { value: '장비_체력', label: '체력' },
  { value: '장비_치명타확률%', label: '치명타 확률' },
  { value: '장비_회피%', label: '회피' },
];

const STAT_COLOR: Record<string, string> = {
  '장비_공격력': 'text-red-400',
  '장비_방어력': 'text-blue-400',
  '장비_체력': 'text-orange-400',
  '장비_치명타확률%': 'text-yellow-400',
  '장비_회피%': 'text-teal-400',
};

const ELEMENT_COLORS: Record<string, string> = {
  '불': 'text-red-400', '물': 'text-blue-400', '공기': 'text-cyan-300',
  '대지': 'text-lime-400', '빛': 'text-yellow-200', '어둠': 'text-purple-400',
  '모든 원소': 'text-white', '골드': 'text-yellow-500',
};

const ELEMENT_ENG: Record<string, string> = {
  '불': 'fire', '물': 'water', '공기': 'air', '대지': 'earth', '빛': 'light', '어둠': 'dark',
  '모든 원소': 'all', '골드': 'gold',
};

const ELEMENT_FILTER_OPTIONS = [
  { value: '불', label: '불' },
  { value: '물', label: '물' },
  { value: '공기', label: '공기' },
  { value: '대지', label: '대지' },
  { value: '빛', label: '빛' },
  { value: '어둠', label: '어둠' },
  { value: '골드', label: '골드' },
];

const SPIRIT_TIER: Record<string, number> = {
  '바하무트': 14, '레비아탄': 14, '그리핀': 14, '명인': 14, '조상': 14, '베히모스': 14, '우로보로스': 14,
  '기린': 12, '크람푸스': 12, '크리스마스': 12,
  '크라켄': 12, '키메라': 12, '카벙클': 12, '타라스크': 12, '하이드라': 12, '불사조': 12,
  '케찰코아틀': 10,
  '호랑이': 9, '매머드': 9, '공룡': 9, '사자': 9, '곰': 9, '바다코끼리': 9, '상어': 9,
  '다람쥐': 7, '하마': 7, '말': 7, '도마뱀': 7, '아르마딜로': 7, '부엉이': 7, '코뿔소': 7,
  '졸로틀': 5,
  '독수리': 4, '황소': 4, '양': 4, '늑대': 4, '고양이': 4, '거위': 4, '독사': 4, '토끼': 4,
};

function getSpiritTier(name: string): number {
  return SPIRIT_TIER[name] || 0;
}

import { getTypeImagePath as getTypeImagePathUtil } from '@/lib/typeImageUtils';
// getTypeImagePath is now theme-aware, resolved inside component

function formatEquipStat(key: string, value: number): string {
  if (key === '장비_치명타확률%' || key === '장비_회피%') return `${value} %`;
  return formatNumber(value);
}

function getElementIconPath(el: string): string {
  if (el === '모든 원소') return '/images/elements/all.webp';
  const eng = ELEMENT_ENG[el];
  return eng ? `/images/elements/${eng}.webp` : '';
}

function isAllElementAffinityOnly(elementAffinity: string[] | undefined, elType: string): boolean {
  if (!elementAffinity) return false;
  if (elementAffinity.includes(elType)) return false;
  if (elementAffinity.includes('모든 원소')) return true;
  return false;
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
  const [manualMode, setManualMode] = useState(false);
  const manualFormRef = useRef<ManualEquipmentFormRef>(null);
  const [viewMode, setViewMode] = useState<'album' | 'table'>('album');
  const [tableSortKey, setTableSortKey] = useState<string>('');
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('asc');

  const maxTier = getMaxTierForLevel(heroLevel || 1);
  const [filterType, setFilterType] = useState<string>('_all');
  const [filterStat, setFilterStat] = useState<string>('_all');
  const [filterTierMin, setFilterTierMin] = useState<number | ''>(Math.max(1, maxTier - 2));
  const [filterTierMax, setFilterTierMax] = useState<number | ''>(maxTier);
  const [filterElement, setFilterElement] = useState<string>('_all');
  const [filterSpirit, setFilterSpirit] = useState<string>('_all');
  const [slotQuality, setSlotQuality] = useState<string>('common');

  const visitedSlots = useRef<Set<number>>(new Set());

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
    return Array.from(set).sort((a, b) => getSpiritTier(b) - getSpiritTier(a));
  }, [allItems]);

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

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingTotal, setLoadingTotal] = useState(0);

  useEffect(() => {
    if (!open || !jobName) return;
    const load = async () => {
      setLoading(true);
      setLoadingProgress(0);
      setLoadingTotal(0);
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
      const typeArr = Array.from(allTypeSet);
      setLoadingTotal(typeArr.length);
      const items = await loadEquipmentByTypes(typeArr, nameMap, (loaded) => {
        setLoadingProgress(loaded);
      });
      setAllItems(items);
      setLoading(false);
      // Preload all equipment images so slot switching is instant
      items.forEach(item => {
        if (item.imagePath) {
          const img = new Image();
          img.src = item.imagePath;
        }
      });
    };
    load();
  }, [open, jobName, slotCount]);

  const resetAllFilters = useCallback(() => {
    const mt = getMaxTierForLevel(heroLevel || 1);
    setFilterType('_all');
    setFilterStat('_all');
    setFilterElement('_all');
    setFilterSpirit('_all');
    setFilterTierMin(Math.max(1, mt - 2));
    setFilterTierMax(mt);
    setTableSortKey('');
    setTableSortDir('asc');
  }, [heroLevel]);

  const handleTableSort = useCallback((key: string) => {
    if (tableSortKey === key) {
      setTableSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortKey(key);
      setTableSortDir('desc');
    }
  }, [tableSortKey]);

  useEffect(() => {
    if (open) {
      setSlots([...currentEquipment]);
      setActiveSlot(initialSlot);
      setSlotQuality(currentEquipment[initialSlot]?.quality || 'common');
      resetAllFilters();
      visitedSlots.current = new Set([initialSlot]);
      setManualMode(!!currentEquipment[initialSlot]?.item?.manual);
    }
  }, [open, currentEquipment, initialSlot, heroLevel, resetAllFilters]);

  useEffect(() => {
    setSlotQuality(slots[activeSlot]?.quality || 'common');
    setManualMode(!!slots[activeSlot]?.item?.manual);
    setFilterType('_all'); // Reset type filter on slot change
    visitedSlots.current.add(activeSlot);
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
      if (item.tier < (filterTierMin || 1) || item.tier > (filterTierMax || maxTier)) return false;
      if (item.tier > maxTier) return false;

      if (filterElement !== '_all') {
        const hasAffinity = item.elementAffinity?.includes(filterElement);
        const hasUnique = item.uniqueElement?.includes(filterElement);
        const hasAll = item.elementAffinity?.includes('모든 원소');
        if (!hasAffinity && !hasUnique && !hasAll) return false;
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
    if (item.relic && hasRelicEquipped) return;
    const newSlots = [...slots];
    const prevItem = newSlots[activeSlot]?.item;
    const prevHadUniqueElement = prevItem?.uniqueElement?.length > 0;
    const prevHadUniqueSpirit = prevItem?.uniqueSpirit?.length > 0;

    let newElement: EquipmentSlotData['element'];
    if (item.uniqueElement?.length) {
      newElement = { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true };
    } else if (prevHadUniqueElement) {
      newElement = null;
    } else {
      const existing = newSlots[activeSlot]?.element || null;
      if (existing) {
        const hasAffinity = item.elementAffinity?.includes(existing.type) || item.elementAffinity?.includes('모든 원소');
        const allElAff = isAllElementAffinityOnly(item.elementAffinity, existing.type);
        newElement = { ...existing, affinity: !!hasAffinity, allElementAffinity: allElAff };
      } else {
        newElement = null;
      }
    }

    let newSpirit: EquipmentSlotData['spirit'];
    if (item.uniqueSpirit?.length) {
      newSpirit = { name: item.uniqueSpirit[0], affinity: true };
    } else if (prevHadUniqueSpirit) {
      newSpirit = null;
    } else {
      const existing = newSlots[activeSlot]?.spirit || null;
      if (existing) {
        const hasAffinity = item.spiritAffinity?.includes(existing.name);
        newSpirit = { ...existing, affinity: !!hasAffinity };
      } else {
        newSpirit = null;
      }
    }

    newSlots[activeSlot] = { ...newSlots[activeSlot], item: { ...item }, quality: slotQuality, element: newElement, spirit: newSpirit };
    setSlots(newSlots);
  }, [slots, activeSlot, slotQuality, hasRelicEquipped]);

  const handleClearSlot = useCallback(() => {
    const newSlots = [...slots];
    // Preserve enchantments (element/spirit) when clearing equipment
    newSlots[activeSlot] = { item: null, quality: newSlots[activeSlot]?.quality || 'common', element: newSlots[activeSlot]?.element || null, spirit: newSlots[activeSlot]?.spirit || null };
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
      <DialogContent className="max-w-[95vw] h-[90vh] overflow-hidden flex flex-col p-5">
        <DialogHeader>
          <DialogTitle className="text-primary" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>장비 선택</DialogTitle>
          <DialogDescription className="sr-only">슬롯별 장비를 선택하세요</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 gap-4">
          {/* ═══ Left: Slot tabs, filters, item grid ═══ */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Slot tabs */}
            <div className="flex items-center gap-1 mb-1">
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

            {/* Filter row 1: [수동(tall)] [타입] [스탯] [티어] [원소] [영혼] [초기화] [앨범|테이블] */}
            <div className="flex items-center gap-2 px-1 text-xs mb-1">
              {manualMode ? (
                <div className="flex items-center gap-1.5 ml-auto">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setManualMode(false)}>취소</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => manualFormRef.current?.triggerConfirm()}>적용</Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-[58px] text-xs gap-1 px-3 bg-primary/30 hover:bg-primary/50 text-white border-primary/40"
                    onClick={() => setManualMode(true)}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    수동
                  </Button>

                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    {/* Sub-row 1: 타입 스탯 티어 원소 영혼 초기화 */}
                    <div className="flex items-center gap-2">
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
                        onChange={e => {
                          const raw = e.target.value;
                          if (raw === '') { setFilterTierMin(''); return; }
                          const v = parseInt(raw, 10);
                          if (!isNaN(v)) setFilterTierMin(Math.max(1, Math.min(maxTier, v)));
                        }}
                        className="h-7 w-12 text-xs text-center rounded border border-border bg-background" />
                      <span className="text-muted-foreground">~</span>
                      <input type="number" min={1} max={maxTier} value={filterTierMax}
                        onChange={e => {
                          const raw = e.target.value;
                          if (raw === '') { setFilterTierMax(''); return; }
                          const v = parseInt(raw, 10);
                          if (!isNaN(v)) setFilterTierMax(Math.max(1, Math.min(maxTier, v)));
                        }}
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
                              {gi > 0 && <div className="border-t border-border/30 my-1" />}
                              {group.spirits.map(sp => (
                                <SelectItem key={sp} value={sp}>
                                  <span className="text-muted-foreground text-[10px] mr-1">T{group.tier})</span>{sp}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>

                      <button
                        onClick={resetAllFilters}
                        className="w-7 h-7 flex items-center justify-center rounded border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors flex-shrink-0"
                        title="필터 초기화"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Sub-row 2: 등급 전체 ... [앨범|테이블] on right */}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">등급:</span>
                      <Select value={slotQuality} onValueChange={handleQualityChange}>
                        <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {QUALITY_OPTIONS.map(q => (
                            <SelectItem key={q.value} value={q.value}><span className={q.color}>{q.label}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="h-7 text-xs bg-primary/30 border-primary/40 text-white hover:bg-primary/50" onClick={handleBatchQuality}>
                        전체
                      </Button>

                      <div className="flex-1" />

                      <div className="flex rounded border border-border overflow-hidden flex-shrink-0" style={{ width: '62px' }}>
                        <button
                          onClick={() => setViewMode('album')}
                          className={`flex-1 px-1.5 py-1 ${viewMode === 'album' ? 'bg-primary text-primary-foreground' : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'}`}
                          title="앨범"
                        >
                          <LayoutGrid className="w-3.5 h-3.5 mx-auto" />
                        </button>
                        <button
                          onClick={() => setViewMode('table')}
                          className={`flex-1 px-1.5 py-1 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'}`}
                          title="테이블"
                        >
                          <List className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Item grid or Manual form */}
            <div className="flex-1 min-h-0">
              <div className="overflow-y-auto h-full border border-border rounded p-3">
                {manualMode ? (
                  <ManualEquipmentForm
                    ref={manualFormRef}
                    hideActions
                    initialData={slots[activeSlot]?.item?.manualData || null}
                    allowedTypes={currentAllowedTypes}
                    onConfirm={(item) => {
                      const newSlots = [...slots];
                      const existingSlot = newSlots[activeSlot];
                      const prevItem = existingSlot?.item;
                      const prevHadUniqueElement = !!prevItem?.uniqueElement?.length;
                      const prevHadUniqueSpirit = !!prevItem?.uniqueSpirit?.length;

                      let slotElement = existingSlot?.element || null;
                      let slotSpirit = existingSlot?.spirit || null;

                      if (item.uniqueElement?.length) {
                        slotElement = { type: item.uniqueElement[0], tier: item.uniqueElementTier || 4, affinity: true };
                      } else if (prevHadUniqueElement) {
                        slotElement = null;
                      } else if (slotElement) {
                        const hasAffinity = item.elementAffinity?.includes(slotElement.type) || item.elementAffinity?.includes('모든 원소');
                        const allElAff = isAllElementAffinityOnly(item.elementAffinity, slotElement.type);
                        slotElement = { ...slotElement, affinity: !!hasAffinity, allElementAffinity: allElAff };
                      }

                      if (item.uniqueSpirit?.length) {
                        slotSpirit = { name: item.uniqueSpirit[0], affinity: true };
                      } else if (prevHadUniqueSpirit) {
                        slotSpirit = null;
                      } else if (slotSpirit) {
                        const hasAffinity = item.spiritAffinity?.includes(slotSpirit.name);
                        slotSpirit = { ...slotSpirit, affinity: !!hasAffinity };
                      }

                      newSlots[activeSlot] = {
                        item: { ...item },
                        quality: existingSlot?.quality || slotQuality,
                        element: slotElement,
                        spirit: slotSpirit,
                      };
                      setSlots(newSlots);
                      setManualMode(false);
                    }}
                    onCancel={() => setManualMode(false)}
                  />
                ) : loading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 border-[3px] border-dashed border-primary/30 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
                      <div className="absolute inset-1 border-[3px] border-transparent border-t-primary rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
                    </div>
                    <span className="text-muted-foreground text-sm">장비 데이터 로딩 중...</span>
                    {loadingTotal > 0 && (
                      <div className="flex flex-col items-center gap-1.5 w-48">
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${Math.round((loadingProgress / loadingTotal) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {loadingProgress} / {loadingTotal} 타입 로드 완료
                        </span>
                      </div>
                    )}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">장착 가능한 장비가 없습니다</div>
                ) : viewMode === 'table' ? (
                  /* ─── Table View ─── */
                  <div className="overflow-x-auto h-full">
                    <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '160px' }} /> {/* 이름 */}
                        <col style={{ width: '60px' }} />  {/* 타입 */}
                        <col style={{ width: '36px' }} />  {/* T */}
                        <col style={{ width: '56px' }} />  {/* ATK */}
                        <col style={{ width: '56px' }} />  {/* DEF */}
                        <col style={{ width: '56px' }} />  {/* HP */}
                        <col style={{ width: '50px' }} />  {/* CRIT */}
                        <col style={{ width: '50px' }} />  {/* EVA */}
                        <col style={{ width: '90px' }} />  {/* 친밀 원소 */}
                        <col style={{ width: '80px' }} />  {/* 친밀 영혼 */}
                        <col style={{ width: '100px' }} /> {/* 고유 원소/영혼 */}
                      </colgroup>
                      <thead className="sticky top-0 bg-background z-10">
                        <tr className="border-b-2 border-border">
                          <th className="text-center py-2 px-2 text-foreground/60 font-semibold cursor-pointer hover:text-primary" onClick={() => handleTableSort('name')}>이름 {tableSortKey === 'name' && (tableSortDir === 'asc' ? '▲' : '▼')}</th>
                          <th className="text-center py-2 px-1.5 text-foreground/60 font-semibold cursor-pointer hover:text-primary" onClick={() => handleTableSort('type')}>타입 {tableSortKey === 'type' && (tableSortDir === 'asc' ? '▲' : '▼')}</th>
                          <th className="text-center py-2 px-1 text-foreground/60 font-semibold cursor-pointer hover:text-primary" onClick={() => handleTableSort('tier')}>T {tableSortKey === 'tier' && (tableSortDir === 'asc' ? '▲' : '▼')}</th>
                          <th className="text-center py-2 px-1.5 text-red-400/80 font-semibold cursor-pointer hover:text-primary" onClick={() => handleTableSort('atk')}>ATK {tableSortKey === 'atk' && (tableSortDir === 'asc' ? '▲' : '▼')}</th>
                          <th className="text-center py-2 px-1.5 text-blue-400/80 font-semibold cursor-pointer hover:text-primary" onClick={() => handleTableSort('def')}>DEF {tableSortKey === 'def' && (tableSortDir === 'asc' ? '▲' : '▼')}</th>
                          <th className="text-center py-2 px-1.5 text-orange-400/80 font-semibold cursor-pointer hover:text-primary" onClick={() => handleTableSort('hp')}>HP {tableSortKey === 'hp' && (tableSortDir === 'asc' ? '▲' : '▼')}</th>
                          <th className="text-center py-2 px-1 text-yellow-400/80 font-semibold cursor-pointer hover:text-primary" onClick={() => handleTableSort('crit')}>CRIT.C {tableSortKey === 'crit' && (tableSortDir === 'asc' ? '▲' : '▼')}</th>
                          <th className="text-center py-2 px-1 text-teal-400/80 font-semibold cursor-pointer hover:text-primary" onClick={() => handleTableSort('eva')}>EVA {tableSortKey === 'eva' && (tableSortDir === 'asc' ? '▲' : '▼')}</th>
                          <th className="text-center py-2 px-1.5 text-foreground/60 font-semibold">친밀 원소</th>
                          <th className="text-center py-2 px-1.5 text-foreground/60 font-semibold">친밀 영혼</th>
                          <th className="text-center py-2 px-1.5 text-foreground/60 font-semibold">고유 원소/영혼</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let sortedItems = [...filteredItems];
                          if (tableSortKey) {
                            sortedItems.sort((a, b) => {
                              let av: number | string = 0, bv: number | string = 0;
                              if (tableSortKey === 'name') { av = a.name; bv = b.name; }
                              else if (tableSortKey === 'type') { av = a.typeKor || ''; bv = b.typeKor || ''; }
                              else if (tableSortKey === 'tier') { av = a.tier; bv = b.tier; }
                              else if (tableSortKey === 'atk') { av = a.stats.find(s => s.key === '장비_공격력')?.value || 0; bv = b.stats.find(s => s.key === '장비_공격력')?.value || 0; }
                              else if (tableSortKey === 'def') { av = a.stats.find(s => s.key === '장비_방어력')?.value || 0; bv = b.stats.find(s => s.key === '장비_방어력')?.value || 0; }
                              else if (tableSortKey === 'hp') { av = a.stats.find(s => s.key === '장비_체력')?.value || 0; bv = b.stats.find(s => s.key === '장비_체력')?.value || 0; }
                              else if (tableSortKey === 'crit') { av = a.stats.find(s => s.key === '장비_치명타확률%')?.value || 0; bv = b.stats.find(s => s.key === '장비_치명타확률%')?.value || 0; }
                              else if (tableSortKey === 'eva') { av = a.stats.find(s => s.key === '장비_회피%')?.value || 0; bv = b.stats.find(s => s.key === '장비_회피%')?.value || 0; }
                              if (typeof av === 'string' && typeof bv === 'string') return tableSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                              return tableSortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
                            });
                          }
                          return sortedItems;
                        })().map((item, idx) => {
                          const isSelected = currentSlotItem?.name === item.name && currentSlotItem?.tier === item.tier;
                          const isRelicBlocked = item.relic && hasRelicEquipped && !currentSlotHasRelic;
                          const atkVal = item.stats.find(s => s.key === '장비_공격력')?.value || 0;
                          const defVal = item.stats.find(s => s.key === '장비_방어력')?.value || 0;
                          const hpVal = item.stats.find(s => s.key === '장비_체력')?.value || 0;
                          const critVal = item.stats.find(s => s.key === '장비_치명타확률%')?.value || 0;
                          const evaVal = item.stats.find(s => s.key === '장비_회피%')?.value || 0;
                          return (
                            <tr
                              key={`${item.name}-${item.tier}-${idx}`}
                              onClick={() => !isRelicBlocked && handleSelectItem(item)}
                              className={`border-b border-border/20 transition-colors ${
                                isRelicBlocked ? 'opacity-40 cursor-not-allowed' :
                                isSelected ? 'bg-primary/20 font-medium' : 'hover:bg-secondary/30 cursor-pointer'
                              }`}
                            >
                              <td className="py-1.5 px-2 text-center text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                                {item.relic && <span className="text-yellow-400 mr-1">⭐</span>}
                                {item.name}
                                {item.type === 'dual_wield' && item.judgmentTypes?.length > 0 && (
                                  <span className="text-muted-foreground ml-1">({item.judgmentTypes.join('+')})</span>
                                )}
                              </td>
                              <td className="py-1.5 px-1.5 text-center text-foreground whitespace-nowrap">{item.typeKor}</td>
                              <td className="py-1.5 px-1 text-center text-foreground tabular-nums">{item.tier}</td>
                              <td className={`py-1.5 px-1.5 text-center tabular-nums ${atkVal ? 'text-red-400' : 'text-muted-foreground/30'}`}>{atkVal ? formatNumber(atkVal) : '-'}</td>
                              <td className={`py-1.5 px-1.5 text-center tabular-nums ${defVal ? 'text-blue-400' : 'text-muted-foreground/30'}`}>{defVal ? formatNumber(defVal) : '-'}</td>
                              <td className={`py-1.5 px-1.5 text-center tabular-nums ${hpVal ? 'text-orange-400' : 'text-muted-foreground/30'}`}>{hpVal ? formatNumber(hpVal) : '-'}</td>
                              <td className={`py-1.5 px-1 text-center tabular-nums ${critVal ? 'text-yellow-400' : 'text-muted-foreground/30'}`}>{critVal ? `${critVal}%` : '-'}</td>
                              <td className={`py-1.5 px-1 text-center tabular-nums ${evaVal ? 'text-teal-400' : 'text-muted-foreground/30'}`}>{evaVal ? `${evaVal}%` : '-'}</td>
                              <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                                {item.elementAffinity?.length ? (
                                  <span>{item.elementAffinity.map((el, i) => (
                                    <span key={el}>
                                      {i > 0 && <span className="text-muted-foreground"> / </span>}
                                      <span className={ELEMENT_COLORS[el] || 'text-foreground'}>{el === '모든 원소' ? '모든 원소' : el}</span>
                                    </span>
                                  ))}</span>
                                ) : <span className="text-muted-foreground/30">-</span>}
                              </td>
                              <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                                {item.spiritAffinity?.length ? (
                                  <span className="text-foreground">{item.spiritAffinity.join(', ')}</span>
                                ) : <span className="text-muted-foreground/30">-</span>}
                              </td>
                              <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                                {item.uniqueElement?.length ? (
                                  <span>{item.uniqueElement.map(el => (
                                    <span key={el} className={`${ELEMENT_COLORS[el] || ''} font-semibold`}>{el} (T{item.uniqueElementTier})</span>
                                  ))}</span>
                                ) : item.uniqueSpirit?.length ? (
                                  <span className="text-purple-300 font-semibold">{item.uniqueSpirit.join(', ')}</span>
                                ) : <span className="text-muted-foreground/30">-</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <TooltipProvider delayDuration={200}>
                    <div className="grid grid-cols-6 gap-3">
                      {filteredItems.map((item, idx) => {
                        const isSelected = currentSlotItem?.name === item.name && currentSlotItem?.tier === item.tier;
                        const quality = slots[activeSlot]?.quality || 'common';
                        const isRelicBlocked = item.relic && hasRelicEquipped && !currentSlotHasRelic;

                        const elemAffs = item.elementAffinity || [];
                        const uniqueElems = item.uniqueElement || [];
                        const spiritAffs = item.spiritAffinity || [];
                        const uniqueSp = item.uniqueSpirit || [];
                        const hasAffinityIcons = elemAffs.length > 0 || uniqueElems.length > 0 || spiritAffs.length > 0 || uniqueSp.length > 0;

                        return (
                          <Tooltip key={`${item.name}-${item.tier}-${idx}`}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => !isRelicBlocked && handleSelectItem(item)}
                                disabled={isRelicBlocked}
                                className={`relative flex flex-col rounded-lg border-2 transition-all cursor-pointer aspect-square overflow-hidden ${
                                  isRelicBlocked ? 'opacity-40 cursor-not-allowed' :
                                  isSelected ? `${QUALITY_BORDER[quality]} bg-accent/10` : 'border-border/50 bg-secondary/20 hover:border-primary/50'
                                }`}
                                style={isSelected ? {
                                  background: `radial-gradient(circle, ${QUALITY_RADIAL[quality]} 0%, transparent 70%)`,
                                  boxShadow: QUALITY_SHADOW[quality],
                                } : {}}
                              >
                                {/* Top 3/4: Tier + Image + Name at fixed 75% */}
                                <div className="flex flex-col items-center w-full relative" style={{ height: '75%' }}>
                                  <span className="absolute top-1 left-1 text-[10px] font-bold text-muted-foreground bg-background/80 rounded px-1 z-10">
                                    T{item.tier}
                                  </span>
                                  {item.relic && (
                                    <img src="/images/special/icon_global_artifact.webp" alt="유물" className="absolute top-1 right-1 w-4 h-4 z-10"
                                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                                  )}
                                  {isRelicBlocked && (
                                    <span className="absolute top-5 right-0 text-[7px] text-red-400 bg-background/80 rounded px-0.5 z-10">유물 중복</span>
                                  )}
                                  <div className="flex-1 w-full flex items-center justify-center pt-3">
                                    {item.imagePath ? (
                                      <img src={item.imagePath} alt={item.name} className="w-16 h-16 object-contain"
                                        onError={e => {
                                          e.currentTarget.style.display = 'none';
                                          const p = e.currentTarget.parentElement;
                                          if (p) { const s = document.createElement('span'); s.className = 'text-[9px] text-muted-foreground text-center'; s.textContent = item.name.slice(0, 6); p.appendChild(s); }
                                        }} />
                                    ) : (
                                      <span className="text-[9px] text-muted-foreground text-center leading-tight">{item.name.slice(0, 8)}</span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-foreground/90 truncate w-full text-center leading-tight font-semibold px-1 pb-0.5">
                                    {item.name}
                                  </p>
                                </div>
                                <div className="flex items-center justify-center gap-2 w-full" style={{ height: '25%' }}>
                                  {hasAffinityIcons ? (
                                    <>
                                      <div className="flex items-center gap-0.5">
                                        {elemAffs.map(el => (
                                          <img key={el} src={getElementIconPath(el)} alt={el} className="w-6 h-6" title={`친밀 원소: ${el}`}
                                            onError={e => { e.currentTarget.style.display = 'none'; }} />
                                        ))}
                                        {uniqueElems.map(el => {
                                          const eng = ELEMENT_ENG[el];
                                          const tier = item.uniqueElementTier || 1;
                                          return (
                                            <img key={`u-${el}`} src={eng ? `/images/enchant/element/${eng}${tier}_2.webp` : ''} alt={el} className="w-6 h-6" title={`고유 원소: ${el} T${tier}`}
                                              onError={e => { e.currentTarget.style.display = 'none'; }} />
                                          );
                                        })}
                                      </div>
                                      {(spiritAffs.length > 0 || uniqueSp.length > 0) && (elemAffs.length > 0 || uniqueElems.length > 0) && (
                                        <div className="w-px h-5 bg-border/50" />
                                      )}
                                      <div className="flex items-center gap-0.5">
                                        {spiritAffs.map(sp => {
                                          const eng = SPIRIT_NAME_MAP[sp];
                                          return (
                                            <img key={sp} src={eng ? `/images/enchant/spirit/${eng}_1.webp` : ''} alt={sp} className="w-6 h-6" title={`친밀 영혼: ${sp}`}
                                              onError={e => { e.currentTarget.style.display = 'none'; }} />
                                          );
                                        })}
                                        {uniqueSp.map(sp => {
                                          const eng = SPIRIT_NAME_MAP[sp];
                                          return (
                                            <img key={`us-${sp}`} src={eng ? `/images/enchant/spirit/${eng}_2.webp` : ''} alt={sp} className="w-6 h-6" title={`고유 영혼: ${sp}`}
                                              onError={e => { e.currentTarget.style.display = 'none'; }} />
                                          );
                                        })}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-[7px] text-muted-foreground/30">-</span>
                                  )}
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              align="center"
                              sideOffset={8}
                              avoidCollisions={true}
                              collisionPadding={16}
                              className="max-w-xs p-3 space-y-1.5 z-50"
                            >
                              <p className="font-bold text-sm">{item.name} <span className="text-muted-foreground font-normal">(T{item.tier}, {item.typeKor})</span></p>
                              {item.type === 'dual_wield' && item.judgmentTypes?.length > 0 && (
                                <p className="text-xs text-muted-foreground">판정 타입: <span className="text-foreground font-medium">{item.judgmentTypes.join(', ')}</span></p>
                              )}
                              {item.relic && <p className="text-xs text-yellow-400 font-semibold">⭐ 유물</p>}
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
                              {item.uniqueElement && item.uniqueElement.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">고유 원소: </span>
                                  {item.uniqueElement.map((el, i) => (
                                    <span key={el} className={ELEMENT_COLORS[el] || 'text-foreground'}>
                                      {el} (T{item.uniqueElementTier || 1}){i < item.uniqueElement!.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {item.spiritAffinity && item.spiritAffinity.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">친밀 영혼: </span>
                                  {item.spiritAffinity.map((sp, i) => (
                                    <span key={sp} className="text-foreground font-semibold">
                                      {sp} (T{getSpiritTier(sp)}){i < item.spiritAffinity!.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {item.uniqueSpirit && item.uniqueSpirit.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">고유 영혼: </span>
                                  {item.uniqueSpirit.map((sp, i) => (
                                    <span key={sp} className="text-foreground font-semibold">{sp} (T{getSpiritTier(sp)}){i < item.uniqueSpirit!.length - 1 ? ', ' : ''}</span>
                                  ))}
                                </div>
                              )}
                              {item.relic && item.relicEffect && (
                                <div className="text-xs border-t border-border/50 pt-1 mt-1">
                                  <span className="text-yellow-400 font-semibold">유물 효과:</span>
                                  <p className="text-foreground/80 mt-0.5">{item.relicEffect.split(/\\n|\n/).map((line: string, li: number) => (
                                    <span key={li}>{li > 0 && <br />}{line}</span>
                                  ))}</p>
                                </div>
                              )}
                              {isRelicBlocked && (
                                <div className="text-xs text-red-400 border-t border-border/50 pt-1 mt-1">
                                  ⚠ 유물 중복 — 유물은 1개만 사용이 가능합니다.
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
          </div>

          {/* ═══ Right: Selected equipment + Confirm/Cancel ═══ */}
          <div className="w-60 flex flex-col border-l border-border pl-3 flex-shrink-0">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">선택한 장비</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {slots.map((s, i) => {
                const qualityColor: Record<string, string> = {
                  common: 'rgba(200,200,200,0.6)',
                  uncommon: 'rgba(74,255,128,0.75)',
                  flawless: 'rgba(80,240,255,0.8)',
                  epic: 'rgba(230,80,255,0.85)',
                  legendary: 'rgba(255,215,0,0.9)',
                };
                const hasAffinityEl = s.element?.affinity;
                const hasAffinitySp = s.spirit?.affinity;
                return (
                <div
                  key={i}
                  onClick={() => setActiveSlot(i)}
                  className={`flex items-stretch gap-0 rounded border-2 cursor-pointer transition-all overflow-hidden ${
                    s.item ? QUALITY_BORDER[s.quality] : 'border-border/30 opacity-60'
                  }`}
                  style={s.item ? { boxShadow: `0 0 4px ${QUALITY_RADIAL[s.quality]?.replace(/[\d.]+\)$/, '0.3)')}` } : {}}
                >
                  {/* Slot number with quality background */}
                  <div
                    className="w-5 flex items-center justify-center flex-shrink-0"
                    style={{ background: s.item ? qualityColor[s.quality] || 'transparent' : 'hsl(var(--secondary) / 0.3)' }}
                  >
                    <span className="text-[10px] font-bold text-black">{i + 1}</span>
                  </div>
                  {s.item ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 p-1.5">
                      {/* Equipment image */}
                      {s.item.imagePath ? (
                        <img src={s.item.imagePath} alt="" className="w-9 h-9 object-contain flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      ) : null}
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate font-bold">{s.item.name}</p>
                        <p className="text-[10px] text-foreground/70 font-medium">
                          T{s.item.tier} {s.item.typeKor}
                          {s.item.relic && <span className="text-yellow-400 ml-1">⭐</span>}
                          {s.item.manual && <Wrench className="w-2.5 h-2.5 inline ml-1 text-muted-foreground" />}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {s.element && (
                            <span className={`text-[9px] font-bold ${ELEMENT_COLORS[s.element.type] || 'text-foreground/70'}`}>
                              {hasAffinityEl && '★ '}{s.element.type} (T{s.element.tier})
                            </span>
                          )}
                          {s.element && s.spirit && <span className="text-[9px] text-muted-foreground">/</span>}
                          {s.spirit && (
                            <span className={`text-[9px] font-bold text-purple-400`}>
                              {hasAffinitySp && '★ '}{s.spirit.name} (T{getSpiritTier(s.spirit.name)})
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                      onClick={(e) => {
                          e.stopPropagation();
                          const newSlots = [...slots];
                          // Keep enchants (element/spirit) when removing equipment
                          newSlots[i] = { item: null, quality: newSlots[i].quality, element: newSlots[i].element, spirit: newSlots[i].spirit };
                          setSlots(newSlots);
                        }}
                        className="text-muted-foreground hover:text-destructive text-xs flex-shrink-0"
                        title="장비 해제"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center p-1.5">
                      <span className="text-xs text-muted-foreground">비어있음</span>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-3 mt-2 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
              <Button className="flex-1" onClick={handleConfirm}>확인</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
