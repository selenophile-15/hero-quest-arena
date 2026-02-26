import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SPIRIT_NAME_MAP, ELEMENT_NAME_MAP } from '@/lib/nameMap';

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
  onConfirm: (slots: EnchantSlotData[]) => void;
}

const ELEMENT_OPTIONS = ['불', '물', '공기', '대지', '빛', '어둠'];
const ELEMENT_TIERS = [4, 7, 9, 12, 14];

const ELEMENT_ENG: Record<string, string> = {
  '불': 'fire', '물': 'water', '공기': 'air', '대지': 'earth', '빛': 'light', '어둠': 'dark',
};

const ELEMENT_COLORS: Record<string, string> = {
  '불': 'text-red-400', '물': 'text-blue-400', '공기': 'text-cyan-300',
  '대지': 'text-lime-400', '빛': 'text-amber-200', '어둠': 'text-purple-400',
};

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
  open, onClose, slotCount, slots, itemInfoPerSlot, onConfirm,
}: EnchantPickerDialogProps) {
  const [localSlots, setLocalSlots] = useState<EnchantSlotData[]>([...slots]);

  // Bulk apply state
  const [bulkElement, setBulkElement] = useState<string>('');
  const [bulkElementTier, setBulkElementTier] = useState<number>(14);
  const [bulkSpirit, setBulkSpirit] = useState<string>('');

  const handleElementChange = (slotIdx: number, elType: string, tier: number) => {
    const info = itemInfoPerSlot[slotIdx];
    // Check if unique element exists - can't change
    if (info?.uniqueElement && info.uniqueElement.length > 0) return;
    const affinity = hasElementAffinity(info, elType);
    const newSlots = [...localSlots];
    newSlots[slotIdx] = {
      ...newSlots[slotIdx],
      element: { type: elType, tier, affinity },
    };
    setLocalSlots(newSlots);
  };

  const handleSpiritChange = (slotIdx: number, spName: string) => {
    const info = itemInfoPerSlot[slotIdx];
    const affinity = hasSpiritAffinity(info, spName);
    const newSlots = [...localSlots];
    newSlots[slotIdx] = {
      ...newSlots[slotIdx],
      spirit: { name: spName, affinity },
    };
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
    const newSlots = [...localSlots];
    newSlots[slotIdx] = { ...newSlots[slotIdx], spirit: null };
    setLocalSlots(newSlots);
  };

  const handleBulkElement = () => {
    if (!bulkElement) return;
    const newSlots = localSlots.map((s, i) => {
      const info = itemInfoPerSlot[i];
      if (info?.uniqueElement && info.uniqueElement.length > 0) return s;
      if (!info) return s; // no item in slot
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
      const affinity = hasSpiritAffinity(info, bulkSpirit);
      return { ...s, spirit: { name: bulkSpirit, affinity } };
    });
    setLocalSlots(newSlots);
  };

  const handleConfirm = () => {
    // For unique elements, ensure they're set correctly
    const finalSlots = localSlots.map((s, i) => {
      const info = itemInfoPerSlot[i];
      if (info?.uniqueElement && info.uniqueElement.length > 0) {
        return {
          ...s,
          element: {
            type: info.uniqueElement[0],
            tier: info.uniqueElementTier || 1,
            affinity: true,
          },
        };
      }
      return s;
    });
    onConfirm(finalSlots);
    onClose();
  };

  // Reset on open
  useState(() => {
    setLocalSlots([...slots]);
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>원소 / 영혼 인챈트</DialogTitle>
          <DialogDescription className="sr-only">각 슬롯의 원소와 영혼을 선택하세요</DialogDescription>
        </DialogHeader>

        {/* Bulk apply */}
        <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded border border-border mb-3">
          <span className="text-xs font-semibold text-primary">일괄 적용</span>
          <div className="flex items-center gap-1">
            <Select value={bulkElement || '_none'} onValueChange={v => setBulkElement(v === '_none' ? '' : v)}>
              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue placeholder="원소" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">없음</SelectItem>
                {ELEMENT_OPTIONS.map(el => (
                  <SelectItem key={el} value={el}>
                    <span className={ELEMENT_COLORS[el]}>{el}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(bulkElementTier)} onValueChange={v => setBulkElementTier(Number(v))}>
              <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ELEMENT_TIERS.map(t => <SelectItem key={t} value={String(t)}>T{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkElement}>적용</Button>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-1">
            <Select value={bulkSpirit || '_none'} onValueChange={v => setBulkSpirit(v === '_none' ? '' : v)}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="영혼" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">없음</SelectItem>
                {SPIRIT_LIST.map(sp => (
                  <SelectItem key={sp} value={sp}>
                    <span className="text-muted-foreground text-[10px] mr-1">T{SPIRIT_TIER[sp]})</span>{sp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkSpirit}>적용</Button>
          </div>
        </div>

        {/* Per-slot enchant */}
        <div className="space-y-2">
          {Array.from({ length: slotCount }).map((_, i) => {
            const info = itemInfoPerSlot[i];
            const slot = localSlots[i];
            const hasUniqueEl = info?.uniqueElement && info.uniqueElement.length > 0;
            const elAffText = info?.elementAffinity?.join(', ') || '';
            const spAffText = info?.spiritAffinity?.join(', ') || '';

            return (
              <div key={i} className="flex items-center gap-3 p-2 border border-border/50 rounded bg-secondary/10">
                <span className="text-xs font-bold text-primary w-12 text-center">슬롯 {i + 1}</span>

                {/* Affinity info */}
                <div className="text-[10px] text-muted-foreground w-32 truncate" title={`친밀: ${elAffText} / ${spAffText}`}>
                  {elAffText && <span>원소: {elAffText}</span>}
                  {spAffText && <span className="ml-1">영혼: {spAffText}</span>}
                </div>

                {/* Element picker */}
                <div className="flex items-center gap-1">
                  {hasUniqueEl ? (
                    <div className="flex items-center gap-1">
                      <img src={`/images/enchant/element/${ELEMENT_ENG[info!.uniqueElement![0]] || ''}${info!.uniqueElementTier || 1}_2.png`}
                        className="w-6 h-6" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      <span className="text-xs text-foreground">{info!.uniqueElement![0]} T{info!.uniqueElementTier} (고유)</span>
                    </div>
                  ) : (
                    <>
                      <Select value={slot?.element?.type || '_none'} onValueChange={v => {
                        if (v === '_none') handleClearElement(i);
                        else handleElementChange(i, v, slot?.element?.tier || 14);
                      }}>
                        <SelectTrigger className="h-7 w-20 text-xs"><SelectValue placeholder="원소" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">없음</SelectItem>
                          {ELEMENT_OPTIONS.map(el => (
                            <SelectItem key={el} value={el}>
                              <span className={ELEMENT_COLORS[el]}>{el}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {slot?.element && (
                        <Select value={String(slot.element.tier)} onValueChange={v => handleElementChange(i, slot.element!.type, Number(v))}>
                          <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ELEMENT_TIERS.map(t => <SelectItem key={t} value={String(t)}>T{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}
                </div>

                {/* Element preview icon */}
                {slot?.element && (
                  <img
                    src={`/images/enchant/element/${ELEMENT_ENG[slot.element.type] || slot.element.type}${slot.element.tier}_${slot.element.affinity ? '2' : '1'}.png`}
                    className="w-6 h-6" alt="" onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                )}

                <div className="w-px h-6 bg-border/50" />

                {/* Spirit picker */}
                <Select value={slot?.spirit?.name || '_none'} onValueChange={v => {
                  if (v === '_none') handleClearSpirit(i);
                  else handleSpiritChange(i, v);
                }}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="영혼" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">없음</SelectItem>
                    {SPIRIT_LIST.map(sp => (
                      <SelectItem key={sp} value={sp}>
                        <span className="text-muted-foreground text-[10px] mr-1">T{SPIRIT_TIER[sp]})</span>{sp}
                      </SelectItem>
                    ))}
                    <SelectItem value="문드라">문드라</SelectItem>
                  </SelectContent>
                </Select>

                {/* Spirit preview icon */}
                {slot?.spirit && (() => {
                  const eng = SPIRIT_NAME_MAP[slot.spirit.name];
                  if (slot.spirit.name === '문드라') {
                    return <img src="/images/enchant/spirit/mundra.png" className="w-6 h-6" alt="문드라" onError={e => { e.currentTarget.style.display = 'none'; }} />;
                  }
                  return eng ? (
                    <img src={`/images/enchant/spirit/${eng}_${slot.spirit.affinity ? '2' : '1'}.png`} className="w-6 h-6" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  ) : null;
                })()}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleConfirm}>확인</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
