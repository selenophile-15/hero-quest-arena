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
  slotCount?: number;
  currentEquipment: EquipmentSlotData[];
  onConfirm: (equipment: EquipmentSlotData[]) => void;
}

const QUALITY_OPTIONS = [
  { value: 'common', label: '일반', color: 'text-gray-400' },
  { value: 'uncommon', label: '고급', color: 'text-green-400' },
  { value: 'flawless', label: '최고급', color: 'text-blue-400' },
  { value: 'epic', label: '에픽', color: 'text-purple-400' },
  { value: 'legendary', label: '전설', color: 'text-yellow-400' },
];

const QUALITY_GLOW: Record<string, string> = {
  common: 'border-gray-400/50 shadow-[0_0_6px_rgba(156,163,175,0.3)]',
  uncommon: 'border-green-400/60 shadow-[0_0_8px_rgba(74,222,128,0.4)]',
  flawless: 'border-blue-400/60 shadow-[0_0_10px_rgba(96,165,250,0.5)]',
  epic: 'border-purple-400/70 shadow-[0_0_12px_rgba(192,132,252,0.6)]',
  legendary: 'border-yellow-400/80 shadow-[0_0_14px_rgba(250,204,21,0.7)]',
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

export default function EquipmentSelectDialog({
  open,
  onClose,
  jobName,
  slotCount = 6,
  currentEquipment,
  onConfirm,
}: EquipmentSelectDialogProps) {
  const [activeSlot, setActiveSlot] = useState(0);
  const [slots, setSlots] = useState<EquipmentSlotData[]>([...currentEquipment]);
  const [allItems, setAllItems] = useState<EquipmentItem[]>([]);
  const [slotAllowedTypes, setSlotAllowedTypes] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>('_all');
  const [filterStat, setFilterStat] = useState<string>('_all');
  const [filterTierMin, setFilterTierMin] = useState<number>(1);
  const [filterTierMax, setFilterTierMax] = useState<number>(15);

  // Batch quality/element/spirit
  const [batchQuality, setBatchQuality] = useState<string>('');

  // Load SID and equipment data
  useEffect(() => {
    if (!open || !jobName) return;

    const load = async () => {
      setLoading(true);
      const [sid, nameMap] = await Promise.all([loadSID(), loadEquipNameMap()]);

      // Get allowed types per slot
      const allowedPerSlot: string[][] = [];
      const allTypeSet = new Set<string>();
      for (let i = 0; i < slotCount; i++) {
        const types = getSlotTypes(sid, jobName, i);
        allowedPerSlot.push(types);
        types.forEach(t => allTypeSet.add(t));
      }
      setSlotAllowedTypes(allowedPerSlot);

      // Load all equipment for all allowed types
      const allTypes = Array.from(allTypeSet);
      const items = await loadEquipmentByTypes(allTypes, nameMap);
      setAllItems(items);
      setLoading(false);
    };

    load();
  }, [open, jobName, slotCount]);

  // Reset slots when opening
  useEffect(() => {
    if (open) {
      setSlots([...currentEquipment]);
      setActiveSlot(0);
    }
  }, [open, currentEquipment]);

  // Filtered items for current slot
  const filteredItems = useMemo(() => {
    const allowedTypes = slotAllowedTypes[activeSlot] || [];
    if (allowedTypes.length === 0) return [];

    // Map Korean type names to file type names
    const allowedFileTypes = new Set<string>();
    // Also track which weapon types are allowed for dual_wield matching
    const allowedWeaponTypes = new Set<string>();
    
    for (const typeKor of allowedTypes) {
      const info = EQUIP_TYPE_MAP[typeKor];
      if (info) {
        allowedFileTypes.add(info.file);
        if (info.category === 'weapon') {
          allowedWeaponTypes.add(typeKor);
        }
      }
    }

    return allItems.filter(item => {
      // Type filter
      if (!allowedFileTypes.has(item.type)) return false;

      // User type filter
      if (filterType !== '_all') {
        const filterInfo = EQUIP_TYPE_MAP[filterType];
        if (filterInfo && item.type !== filterInfo.file) return false;
      }

      // Stat filter
      if (filterStat !== '_all') {
        if (!item.stats.some(s => s.key === filterStat)) return false;
      }

      // Tier filter
      if (item.tier < filterTierMin || item.tier > filterTierMax) return false;

      return true;
    });
  }, [allItems, activeSlot, slotAllowedTypes, filterType, filterStat, filterTierMin, filterTierMax]);

  const handleSelectItem = (item: EquipmentItem) => {
    const newSlots = [...slots];
    newSlots[activeSlot] = {
      ...newSlots[activeSlot],
      item: { ...item },
    };
    setSlots(newSlots);
  };

  const handleClearSlot = () => {
    const newSlots = [...slots];
    newSlots[activeSlot] = { item: null, quality: 'common', element: null, spirit: null };
    setSlots(newSlots);
  };

  const handleBatchQuality = () => {
    if (!batchQuality) return;
    setSlots(prev => prev.map(s => ({ ...s, quality: batchQuality })));
  };

  const handleConfirm = () => {
    onConfirm(slots);
    onClose();
  };

  const currentAllowedTypes = slotAllowedTypes[activeSlot] || [];
  const currentSlotItem = slots[activeSlot]?.item;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>장비 선택</DialogTitle>
          <DialogDescription className="sr-only">슬롯별 장비를 선택하세요</DialogDescription>
        </DialogHeader>

        <Tabs value={`slot-${activeSlot}`} onValueChange={v => setActiveSlot(parseInt(v.replace('slot-', ''), 10))}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <TabsList className="flex-1">
              {Array.from({ length: slotCount }).map((_, i) => (
                <TabsTrigger key={i} value={`slot-${i}`} className="flex-1 text-xs">
                  <span className="flex items-center gap-1">
                    슬롯 {i + 1}
                    {slots[i]?.item && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Batch operations */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-xs text-muted-foreground">일괄 등급:</span>
            <Select value={batchQuality || '_none'} onValueChange={v => v !== '_none' && setBatchQuality(v)}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none" disabled>선택</SelectItem>
                {QUALITY_OPTIONS.map(q => (
                  <SelectItem key={q.value} value={q.value}>
                    <span className={q.color}>{q.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBatchQuality}>
              적용
            </Button>
            <div className="flex-1" />
            {/* Slot quality */}
            <span className="text-xs text-muted-foreground">이 슬롯 등급:</span>
            <Select
              value={slots[activeSlot]?.quality || 'common'}
              onValueChange={v => {
                const newSlots = [...slots];
                newSlots[activeSlot] = { ...newSlots[activeSlot], quality: v };
                setSlots(newSlots);
              }}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map(q => (
                  <SelectItem key={q.value} value={q.value}>
                    <span className={q.color}>{q.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
            <span className="text-xs text-muted-foreground">타입:</span>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                {currentAllowedTypes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground">스탯:</span>
            <Select value={filterStat} onValueChange={setFilterStat}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                {STAT_FILTER_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground">티어:</span>
            <input
              type="number"
              min={1}
              max={15}
              value={filterTierMin}
              onChange={e => setFilterTierMin(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-7 w-12 text-xs text-center rounded border border-border bg-background"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <input
              type="number"
              min={1}
              max={15}
              value={filterTierMax}
              onChange={e => setFilterTierMax(Math.min(15, parseInt(e.target.value) || 15))}
              className="h-7 w-12 text-xs text-center rounded border border-border bg-background"
            />

            {currentSlotItem && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive ml-auto" onClick={handleClearSlot}>
                해제
              </Button>
            )}
          </div>

          {/* Item grid */}
          {Array.from({ length: slotCount }).map((_, slotIdx) => (
            <TabsContent key={slotIdx} value={`slot-${slotIdx}`} className="mt-0">
              <div className="overflow-y-auto max-h-[45vh] border border-border rounded p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                    로딩 중...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                    장착 가능한 장비가 없습니다
                  </div>
                ) : (
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                    {filteredItems.map((item, idx) => {
                      const isSelected = currentSlotItem?.name === item.name && currentSlotItem?.tier === item.tier;
                      const quality = slots[activeSlot]?.quality || 'common';
                      const glowClass = isSelected ? (QUALITY_GLOW[quality] || '') : '';

                      return (
                        <button
                          key={`${item.name}-${item.tier}-${idx}`}
                          onClick={() => handleSelectItem(item)}
                          className={`relative flex flex-col items-center p-1 rounded-lg border-2 transition-all hover:border-primary/50 cursor-pointer ${
                            isSelected
                              ? `${glowClass} bg-accent/10`
                              : 'border-border/50 bg-secondary/20'
                          }`}
                          title={`${item.name} (${item.typeKor} T${item.tier})`}
                        >
                          {/* Tier badge */}
                          <span className="absolute top-0.5 left-0.5 text-[8px] font-bold text-muted-foreground bg-background/80 rounded px-0.5">
                            T{item.tier}
                          </span>

                          {/* Equipment image */}
                          <div className="w-12 h-12 flex items-center justify-center">
                            {item.imagePath ? (
                              <img
                                src={item.imagePath}
                                alt={item.name}
                                className="w-10 h-10 object-contain"
                                onError={e => {
                                  e.currentTarget.style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  if (parent) {
                                    const span = document.createElement('span');
                                    span.className = 'text-[8px] text-muted-foreground text-center';
                                    span.textContent = item.name.slice(0, 4);
                                    parent.appendChild(span);
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-[8px] text-muted-foreground text-center leading-tight">
                                {item.name.slice(0, 6)}
                              </span>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="flex gap-0.5 mt-0.5">
                            {item.stats.slice(0, 2).map((s, si) => (
                              <div key={si} className="flex items-center gap-px">
                                <img src={STAT_ICONS[s.key] || ''} alt="" className="w-3 h-3" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                <span className="text-[7px] tabular-nums">{s.value}</span>
                              </div>
                            ))}
                          </div>

                          {/* Name */}
                          <p className="text-[7px] text-foreground/70 truncate w-full text-center mt-0.5 leading-tight">
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

        {/* Selected summary */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
          <div className="flex gap-1 flex-1 overflow-x-auto">
            {slots.map((s, i) => (
              <div
                key={i}
                className={`flex flex-col items-center p-1 rounded border min-w-[60px] ${
                  s.item
                    ? `${QUALITY_GLOW[s.quality] || 'border-border'}`
                    : 'border-border/30 opacity-50'
                }`}
              >
                <span className="text-[8px] text-muted-foreground">슬롯 {i + 1}</span>
                {s.item ? (
                  <>
                    {s.item.imagePath ? (
                      <img src={s.item.imagePath} alt="" className="w-8 h-8 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span className="text-[7px] text-foreground w-8 h-8 flex items-center justify-center text-center">{s.item.name.slice(0, 4)}</span>
                    )}
                    <span className="text-[7px] text-foreground truncate max-w-[56px]">{s.item.name}</span>
                  </>
                ) : (
                  <span className="text-[8px] text-muted-foreground w-8 h-8 flex items-center justify-center">-</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" onClick={handleConfirm}>확인</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
