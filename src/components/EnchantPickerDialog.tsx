import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SPIRIT_NAME_MAP } from '@/lib/nameMap';

interface EnchantSlotData {
  element: { type: string; tier: number; affinity: boolean } | null;
  spirit: { name: string; affinity: boolean } | null;
}

interface ItemAffinityInfo {
  elementAffinity: string[] | null;
  spiritAffinity: string[] | null;
  uniqueElement: string[] | null;
  uniqueElementTier: number | null;
  uniqueSpirit: string[] | null;
}

interface EnchantPickerDialogProps {
  open: boolean;
  onClose: () => void;
  slotCount: number;
  slots: EnchantSlotData[];
  itemInfoPerSlot: (ItemAffinityInfo | null)[];
  itemNames: string[];
  onConfirm: (slots: EnchantSlotData[]) => void;
  initialTab?: 'element' | 'spirit';
}

const ELEMENT_OPTIONS = ['불', '물', '공기', '대지', '빛', '어둠'];
const ELEMENT_TIERS = [4, 7, 9, 12, 14];

const ELEMENT_ENG: Record<string, string> = {
  '불': 'fire', '물': 'water', '공기': 'air', '대지': 'earth', '빛': 'light', '어둠': 'dark',
};

const ELEMENT_COLORS: Record<string, string> = {
  '불': 'text-red-400', '물': 'text-blue-400', '공기': 'text-cyan-300',
  '대지': 'text-lime-400', '빛': 'text-yellow-200', '어둠': 'text-purple-400',
  '모든 원소': 'text-white',
};

// Element value calculation
const ELEMENT_VALUES: Record<number, { normal: number; affinity: number }> = {
  4: { normal: 5, affinity: 10 },
  5: { normal: 5, affinity: 10 },
  7: { normal: 10, affinity: 15 },
  9: { normal: 15, affinity: 20 },
  10: { normal: 15, affinity: 20 },
  12: { normal: 25, affinity: 35 },
  14: { normal: 35, affinity: 45 },
};

function getElementValue(tier: number, affinity: boolean): number {
  const entry = ELEMENT_VALUES[tier];
  if (!entry) return 0;
  return affinity ? entry.affinity : entry.normal;
}

// Spirit tier from data
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

const SPIRIT_LIST = Object.keys(SPIRIT_TIER).sort((a, b) => SPIRIT_TIER[b] - SPIRIT_TIER[a]);

function getSpiritGroups(): { tier: number; spirits: string[] }[] {
  const groups: { tier: number; spirits: string[] }[] = [];
  let lastTier = -1;
  for (const sp of SPIRIT_LIST) {
    const t = SPIRIT_TIER[sp];
    if (t !== lastTier) {
      groups.push({ tier: t, spirits: [sp] });
      lastTier = t;
    } else {
      groups[groups.length - 1].spirits.push(sp);
    }
  }
  return groups;
}

const SPIRIT_GROUPS = getSpiritGroups();

// Load spirit effects from JSON
let spiritDataCache: Record<string, any> | null = null;

async function loadSpiritData(): Promise<Record<string, any>> {
  if (spiritDataCache) return spiritDataCache;
  try {
    const resp = await fetch('/data/equipment/enchantment/spirit.json');
    spiritDataCache = await resp.json();
    return spiritDataCache!;
  } catch {
    return {};
  }
}

function getSpiritEffectFromData(data: Record<string, any>, spiritName: string, affinity: boolean): string {
  for (const [, tierSpirits] of Object.entries(data)) {
    if (typeof tierSpirits !== 'object') continue;
    const spiritEntry = tierSpirits[spiritName];
    if (spiritEntry) {
      const key = affinity ? 'O' : 'X';
      const variant = spiritEntry[key];
      if (variant?.['효과']) return variant['효과'];
    }
  }
  return '';
}

function hasElementAffinity(info: ItemAffinityInfo | null, elType: string): boolean {
  if (!info) return false;
  if (info.elementAffinity?.includes(elType)) return true;
  if (info.elementAffinity?.includes('모든 원소')) return true;
  return false;
}

function hasSpiritAffinity(info: ItemAffinityInfo | null, spName: string): boolean {
  if (!info) return false;
  return info.spiritAffinity?.includes(spName) || false;
}

export default function EnchantPickerDialog({
  open, onClose, slotCount, slots, itemInfoPerSlot, itemNames, onConfirm, initialTab,
}: EnchantPickerDialogProps) {
  const [localSlots, setLocalSlots] = useState<EnchantSlotData[]>([...slots]);
  const [bulkElement, setBulkElement] = useState<string>('');
  const [bulkElementTier, setBulkElementTier] = useState<number>(14);
  const [bulkSpirit, setBulkSpirit] = useState<string>('');
  const [spiritData, setSpiritData] = useState<Record<string, any>>({});

  useEffect(() => {
    loadSpiritData().then(setSpiritData);
  }, []);

  useEffect(() => {
    if (open) {
      setLocalSlots([...slots]);
    }
  }, [open, slots]);

  const handleElementChange = (slotIdx: number, elType: string, tier: number) => {
    const info = itemInfoPerSlot[slotIdx];
    if (info?.uniqueElement && info.uniqueElement.length > 0) return;
    const affinity = hasElementAffinity(info, elType);
    const newSlots = [...localSlots];
    newSlots[slotIdx] = { ...newSlots[slotIdx], element: { type: elType, tier, affinity } };
    setLocalSlots(newSlots);
  };

  const handleSpiritChange = (slotIdx: number, spName: string) => {
    const info = itemInfoPerSlot[slotIdx];
    if (info?.uniqueSpirit && info.uniqueSpirit.length > 0) return;
    const affinity = hasSpiritAffinity(info, spName);
    const newSlots = [...localSlots];
    newSlots[slotIdx] = { ...newSlots[slotIdx], spirit: { name: spName, affinity } };
    setLocalSlots(newSlots);
  };

  const handleClearElement = (slotIdx: number) => {
    const info = itemInfoPerSlot[slotIdx];
    if (info?.uniqueElement && info.uniqueElement.length > 0) return;
    const newSlots = [...localSlots];
    newSlots[slotIdx] = { ...newSlots[slotIdx], element: null };
    setLocalSlots(newSlots);
  };

  const handleClearSpirit = (slotIdx: number) => {
    const info = itemInfoPerSlot[slotIdx];
    if (info?.uniqueSpirit && info.uniqueSpirit.length > 0) return;
    const newSlots = [...localSlots];
    newSlots[slotIdx] = { ...newSlots[slotIdx], spirit: null };
    setLocalSlots(newSlots);
  };

  const handleBulkElement = () => {
    if (!bulkElement) return;
    const newSlots = localSlots.map((s, i) => {
      const info = itemInfoPerSlot[i];
      if (info?.uniqueElement && info.uniqueElement.length > 0) return s;
      if (!info) return s;
      const affinity = hasElementAffinity(info, bulkElement);
      return { ...s, element: { type: bulkElement, tier: bulkElementTier, affinity } };
    });
    setLocalSlots(newSlots);
  };

  const handleBulkSpirit = () => {
    if (!bulkSpirit) return;
    const newSlots = localSlots.map((s, i) => {
      const info = itemInfoPerSlot[i];
      if (!info) return s;
      if (info.uniqueSpirit && info.uniqueSpirit.length > 0) return s;
      const affinity = hasSpiritAffinity(info, bulkSpirit);
      return { ...s, spirit: { name: bulkSpirit, affinity } };
    });
    setLocalSlots(newSlots);
  };

  const titanCount = useMemo(() => {
    return localSlots.filter(s => s.spirit?.name === '명인').length;
  }, [localSlots]);

  const elementTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    localSlots.forEach((s) => {
      if (s.element) {
        const val = getElementValue(s.element.tier, s.element.affinity);
        totals[s.element.type] = (totals[s.element.type] || 0) + val;
      }
    });
    return totals;
  }, [localSlots]);

  const handleConfirm = () => {
    const finalSlots = localSlots.map((s, i) => {
      const info = itemInfoPerSlot[i];
      let result = { ...s };
      if (info?.uniqueElement && info.uniqueElement.length > 0) {
        result.element = { type: info.uniqueElement[0], tier: info.uniqueElementTier || 1, affinity: true };
      }
      if (info?.uniqueSpirit && info.uniqueSpirit.length > 0) {
        result.spirit = { name: info.uniqueSpirit[0], affinity: true };
      }
      return result;
    });
    onConfirm(finalSlots);
    onClose();
  };

  const renderSpiritSelect = (value: string, onChange: (v: string) => void, className?: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 text-sm ${className || 'w-48'}`}><SelectValue placeholder="영혼" /></SelectTrigger>
      <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="max-h-[240px] overflow-y-auto z-[100]">
        <SelectItem value="_none">없음</SelectItem>
        {SPIRIT_GROUPS.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="border-t border-border/30 my-1.5" />}
            {group.spirits.map(sp => (
              <SelectItem key={sp} value={sp}>
                <span className="text-muted-foreground text-xs mr-1">T{group.tier})</span>
                <span>{sp}</span>
              </SelectItem>
            ))}
          </div>
        ))}
        <div className="border-t border-border/30 my-1.5" />
        <SelectItem value="문드라">문드라</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>마법 부여 (원소 / 영혼)</DialogTitle>
          <DialogDescription className="sr-only">각 슬롯의 원소와 영혼을 선택하세요</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={initialTab || 'element'} key={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="element" className="text-sm gap-2">
              <img src="/images/type/element.webp" alt="" className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
              원소 인챈트
            </TabsTrigger>
            <TabsTrigger value="spirit" className="text-sm gap-2">
              <img src="/images/type/spirit.webp" alt="" className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
              영혼 인챈트
            </TabsTrigger>
          </TabsList>

          {/* ─── Element Tab ─── */}
          <TabsContent value="element" className="space-y-3 mt-3">
            {/* Bulk apply */}
            <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded border border-border">
              <span className="text-sm font-semibold text-primary">일괄 적용</span>
              <Select value={bulkElement || '_none'} onValueChange={v => setBulkElement(v === '_none' ? '' : v)}>
                <SelectTrigger className="h-9 w-28 text-sm"><SelectValue placeholder="원소" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">없음</SelectItem>
                  {ELEMENT_OPTIONS.map(el => (
                    <SelectItem key={el} value={el}><span className={ELEMENT_COLORS[el]}>{el}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(bulkElementTier)} onValueChange={v => setBulkElementTier(Number(v))}>
                <SelectTrigger className="h-9 w-20 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ELEMENT_TIERS.map(t => <SelectItem key={t} value={String(t)}>T{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-9 text-sm" onClick={handleBulkElement}>적용</Button>
            </div>

            {/* Element totals */}
            <div className="flex items-center gap-4 p-2 bg-secondary/10 rounded border border-border/50">
              <span className="text-sm font-semibold text-foreground">원소 합계:</span>
              {ELEMENT_OPTIONS.map(el => {
                const val = elementTotals[el] || 0;
                return (
                  <div key={el} className="flex items-center gap-1">
                    <img src={`/images/elements/${ELEMENT_ENG[el]}.webp`} alt={el} className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    <span className={`text-sm font-bold tabular-nums ${val > 0 ? ELEMENT_COLORS[el] : 'text-muted-foreground'}`}>{val}</span>
                  </div>
                );
              })}
            </div>

            {/* Per-slot element */}
            <div className="space-y-2">
              {Array.from({ length: slotCount }).map((_, i) => {
                const info = itemInfoPerSlot[i];
                const slot = localSlots[i];
                const hasUniqueEl = info?.uniqueElement && info.uniqueElement.length > 0;
                const hasItem = !!info;
                const elValue = slot?.element ? getElementValue(slot.element.tier, slot.element.affinity) : 0;

                return (
                  <div key={i} className={`grid grid-cols-[80px_1fr_220px_60px_80px] gap-3 items-center p-3 border border-border/50 rounded bg-secondary/10 min-h-[56px] ${!hasItem ? 'opacity-40' : ''}`}>
                    <div className="text-center">
                      <span className="text-sm font-bold text-primary">슬롯 {i + 1}</span>
                      <p className="text-xs text-foreground truncate">{itemNames[i] || '-'}</p>
                    </div>

                    <div className="text-sm text-foreground">
                      <span className="text-foreground/70">친밀 원소: </span>
                      {info?.elementAffinity?.map((el, ei) => (
                        <span key={el} className={ELEMENT_COLORS[el] || 'text-foreground'}>
                          {el}{ei < (info.elementAffinity?.length || 0) - 1 ? ', ' : ''}
                        </span>
                      )) || <span className="text-muted-foreground">없음</span>}
                    </div>

                    <div className="flex items-center gap-2 justify-center">
                      {hasUniqueEl ? (
                        <div className="flex items-center gap-2">
                          <img src={`/images/enchant/element/${ELEMENT_ENG[info!.uniqueElement![0]] || ''}${info!.uniqueElementTier || 1}_2.webp`}
                            className="w-8 h-8" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          <span className={`text-sm font-semibold ${ELEMENT_COLORS[info!.uniqueElement![0]] || 'text-foreground'}`}>
                            {info!.uniqueElement![0]} T{info!.uniqueElementTier} (고유)
                          </span>
                        </div>
                      ) : hasItem ? (
                        <div className="flex items-center gap-2 justify-center">
                          <Select value={slot?.element?.type || '_none'} onValueChange={v => {
                            if (v === '_none') handleClearElement(i);
                            else handleElementChange(i, v, slot?.element?.tier || 14);
                          }}>
                            <SelectTrigger className="h-9 w-24 text-sm"><SelectValue placeholder="원소" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">없음</SelectItem>
                              {ELEMENT_OPTIONS.map(el => (
                                <SelectItem key={el} value={el}><span className={ELEMENT_COLORS[el]}>{el}</span></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {slot?.element && (
                            <Select value={String(slot.element.tier)} onValueChange={v => handleElementChange(i, slot.element!.type, Number(v))}>
                              <SelectTrigger className="h-9 w-20 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ELEMENT_TIERS.map(t => <SelectItem key={t} value={String(t)}>T{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ) : <span className="text-sm text-muted-foreground">장비 없음</span>}
                    </div>

                    <div className="flex items-center justify-center">
                      {slot?.element && (
                        <img
                          src={`/images/enchant/element/${ELEMENT_ENG[slot.element.type] || slot.element.type}${slot.element.tier}_${slot.element.affinity ? '2' : '1'}.webp`}
                          className="w-8 h-8" alt="" onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>

                    <div className="text-center">
                      {elValue > 0 && (
                        <span className={`text-sm font-bold tabular-nums ${slot?.element?.affinity ? 'text-green-400' : 'text-foreground'}`}>
                          +{elValue}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ─── Spirit Tab ─── */}
          <TabsContent value="spirit" className="space-y-3 mt-3">
            <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded border border-border">
              <span className="text-sm font-semibold text-primary">일괄 적용</span>
              {renderSpiritSelect(bulkSpirit || '_none', v => setBulkSpirit(v === '_none' ? '' : v), 'w-48')}
              <Button size="sm" variant="outline" className="h-9 text-sm" onClick={handleBulkSpirit}>적용</Button>
            </div>

            {titanCount >= 2 && (
              <div className="p-2 bg-yellow-400/10 border border-yellow-400/30 rounded text-sm text-yellow-400">
                ⚠ 명인 영혼이 {titanCount}개 장착됨 — 명인 스킬 효과(체력 증가)는 1개만 적용됩니다.
              </div>
            )}

            <div className="space-y-2">
              {Array.from({ length: slotCount }).map((_, i) => {
                const info = itemInfoPerSlot[i];
                const slot = localSlots[i];
                const hasItem = !!info;
                const hasUniqueSp = info?.uniqueSpirit && info.uniqueSpirit.length > 0;
                const spiritName = slot?.spirit?.name || (hasUniqueSp ? info!.uniqueSpirit![0] : '');
                const spiritAffinity = slot?.spirit?.affinity || (hasUniqueSp ? true : false);
                const spiritEffect = spiritName ? getSpiritEffectFromData(spiritData, spiritName, spiritAffinity) : '';

                return (
                  <div key={i} className={`grid grid-cols-[80px_1fr_220px_60px_1fr] gap-3 items-center p-3 border border-border/50 rounded bg-secondary/10 min-h-[56px] ${!hasItem ? 'opacity-40' : ''}`}>
                    <div className="text-center">
                      <span className="text-sm font-bold text-primary">슬롯 {i + 1}</span>
                      <p className="text-xs text-foreground truncate">{itemNames[i] || '-'}</p>
                    </div>

                    <div className="text-sm text-foreground">
                      <span className="text-foreground/70">친밀 영혼: </span>
                      {info?.spiritAffinity?.map((sp, si) => (
                        <span key={sp} className="text-foreground">
                          {sp} (T{SPIRIT_TIER[sp] || '?'}){si < (info.spiritAffinity?.length || 0) - 1 ? ', ' : ''}
                        </span>
                      )) || <span className="text-muted-foreground">없음</span>}
                    </div>

                    <div className="flex items-center gap-2 justify-center">
                      {hasUniqueSp ? (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const eng = SPIRIT_NAME_MAP[info!.uniqueSpirit![0]];
                            return eng ? <img src={`/images/enchant/spirit/${eng}_2.webp`} className="w-8 h-8" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                          })()}
                          <span className="text-sm font-semibold text-foreground">
                            {info!.uniqueSpirit![0]} (고유)
                          </span>
                        </div>
                      ) : hasItem ? (
                        renderSpiritSelect(slot?.spirit?.name || '_none', v => {
                          if (v === '_none') handleClearSpirit(i);
                          else handleSpiritChange(i, v);
                        }, 'w-48')
                      ) : <span className="text-sm text-muted-foreground">장비 없음</span>}
                    </div>

                    <div className="flex items-center justify-center">
                      {slot?.spirit && (() => {
                        const eng = SPIRIT_NAME_MAP[slot.spirit.name];
                        if (slot.spirit.name === '문드라') {
                          return <img src="/images/enchant/spirit/mundra.webp" className="w-8 h-8" alt="문드라" onError={e => { e.currentTarget.style.display = 'none'; }} />;
                        }
                        return eng ? <img src={`/images/enchant/spirit/${eng}_${slot.spirit.affinity ? '2' : '1'}.webp`} className="w-8 h-8" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                      })()}
                    </div>

                    <div className="text-xs text-foreground/80 min-h-[32px] min-w-[200px] flex items-center whitespace-pre-line leading-relaxed">
                      {spiritEffect && (
                        <span className={spiritName === '명인' && titanCount >= 2 ? 'text-yellow-400' : ''}>
                          {spiritEffect}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleConfirm}>확인</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { getElementValue, ELEMENT_VALUES };
