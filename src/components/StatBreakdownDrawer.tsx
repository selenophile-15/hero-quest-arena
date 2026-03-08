import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { STAT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { CalculatedStats, EquipSlotCalc, SkillBonusSummary, SkillBonusSource, SkillBonuses } from '@/lib/statCalculator';

interface StatBreakdownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calcStats: CalculatedStats | null;
}

type StatType = 'atk' | 'def' | 'hp';

const TAB_CONFIG: { key: StatType; label: string; icon: string; color: string; headerBg: string }[] = [
  { key: 'atk', label: '공격력', icon: STAT_ICON_MAP.atk, color: 'text-red-400', headerBg: 'bg-red-900/60' },
  { key: 'def', label: '방어력', icon: STAT_ICON_MAP.def, color: 'text-blue-400', headerBg: 'bg-blue-900/60' },
  { key: 'hp', label: '체력', icon: STAT_ICON_MAP.hp, color: 'text-orange-400', headerBg: 'bg-yellow-900/40' },
];

function getSlotStatDirect(slot: EquipSlotCalc, key: keyof EquipSlotCalc): number {
  return (slot[key] as number) || 0;
}

function getBonusField(source: SkillBonusSource, statType: StatType, field: 'flat' | 'pct'): number {
  if (field === 'flat') {
    return statType === 'atk' ? source.flatAtk : statType === 'def' ? source.flatDef : source.flatHp;
  }
  return statType === 'atk' ? source.pctAtk : statType === 'def' ? source.pctDef : source.pctHp;
}

function getSummaryField(summary: SkillBonusSummary, statType: StatType, field: 'flat' | 'pct'): number {
  if (field === 'flat') {
    return statType === 'atk' ? summary.flatAtk : statType === 'def' ? summary.flatDef : summary.flatHp;
  }
  return statType === 'atk' ? summary.pctAtk : statType === 'def' ? summary.pctDef : summary.pctHp;
}

function getEquipBonusForStat(equipBonuses: SkillBonuses, statType: StatType): {
  해당장비: Record<string, number>;
  모든장비: number;
} {
  if (statType === 'atk') {
    // 해당장비공격력 + 해당장비전체
    const merged: Record<string, number> = {};
    for (const [k, v] of Object.entries(equipBonuses.해당장비공격력)) {
      merged[k] = (merged[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(equipBonuses.해당장비전체)) {
      merged[k] = (merged[k] || 0) + v;
    }
    return { 해당장비: merged, 모든장비: equipBonuses.모든장비공격력 + equipBonuses.모든장비전체 };
  } else if (statType === 'def') {
    const merged: Record<string, number> = {};
    for (const [k, v] of Object.entries(equipBonuses.해당장비방어력)) {
      merged[k] = (merged[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(equipBonuses.해당장비전체)) {
      merged[k] = (merged[k] || 0) + v;
    }
    return { 해당장비: merged, 모든장비: equipBonuses.모든장비방어력 + equipBonuses.모든장비전체 };
  } else {
    const merged: Record<string, number> = {};
    for (const [k, v] of Object.entries(equipBonuses.해당장비체력)) {
      merged[k] = (merged[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(equipBonuses.해당장비전체)) {
      merged[k] = (merged[k] || 0) + v;
    }
    return { 해당장비: merged, 모든장비: equipBonuses.모든장비체력 + equipBonuses.모든장비전체 };
  }
}

export default function StatBreakdownDrawer({ open, onOpenChange, calcStats }: StatBreakdownDrawerProps) {
  const [activeTab, setActiveTab] = useState<StatType>('atk');

  const renderBreakdownTable = (statType: StatType) => {
    const config = TAB_CONFIG.find(t => t.key === statType)!;
    const baseStat = calcStats
      ? statType === 'atk' ? calcStats.baseAtk : statType === 'def' ? calcStats.baseDef : calcStats.baseHp
      : 0;
    const seedStat = calcStats
      ? statType === 'atk' ? calcStats.seedAtk : statType === 'def' ? calcStats.seedDef : calcStats.seedHp
      : 0;
    const equipSlots = calcStats?.equipResult?.slots || [];
    const equipTotal = calcStats
      ? statType === 'atk' ? calcStats.equipResult.totalAtk : statType === 'def' ? calcStats.equipResult.totalDef : calcStats.equipResult.totalHp
      : 0;
    const totalStat = calcStats
      ? statType === 'atk' ? calcStats.totalAtk : statType === 'def' ? calcStats.totalDef : calcStats.totalHp
      : 0;

    const bonus = calcStats?.bonusSummary;
    const flatBonus = bonus ? getSummaryField(bonus, statType, 'flat') : 0;
    const pctBonus = bonus ? getSummaryField(bonus, statType, 'pct') : 0;

    // Sources breakdown
    const skillSources = bonus?.sources.filter(s => s.type === 'unique' || s.type === 'common') || [];
    const soulSources = bonus?.sources.filter(s => s.type === 'soul') || [];

    // Equipment bonuses
    const equipBonusData = calcStats?.equipBonuses ? getEquipBonusForStat(calcStats.equipBonuses, statType) : { 해당장비: {}, 모든장비: 0 };
    const 해당장비Entries = Object.entries(equipBonusData.해당장비).filter(([, v]) => v !== 0);

    // Field keys for equipment slots
    const baseKey = statType === 'atk' ? 'baseAtk' : statType === 'def' ? 'baseDef' : 'baseHp';
    const qualityKey = statType === 'atk' ? 'qualityAtk' : statType === 'def' ? 'qualityDef' : 'qualityHp';
    const elementRawKey = statType === 'atk' ? 'elementRawAtk' : statType === 'def' ? 'elementRawDef' : 'elementRawHp';
    const spiritRawKey = statType === 'atk' ? 'spiritRawAtk' : statType === 'def' ? 'spiritRawDef' : 'spiritRawHp';
    const elementCapKey = statType === 'atk' ? 'elementCapAtk' : statType === 'def' ? 'elementCapDef' : 'elementCapHp';
    const spiritCapKey = statType === 'atk' ? 'spiritCapAtk' : statType === 'def' ? 'spiritCapDef' : 'spiritCapHp';
    const preBonusKey = statType === 'atk' ? 'preBonusAtk' : statType === 'def' ? 'preBonusDef' : 'preBonusHp';
    const bonusPctKey = statType === 'atk' ? 'bonusAtkPct' : statType === 'def' ? 'bonusDefPct' : 'bonusHpPct';
    const finalKey = statType === 'atk' ? 'finalAtk' : statType === 'def' ? 'finalDef' : 'finalHp';

    return (
      <div className="grid grid-cols-[1fr_2fr] gap-4 h-full">
        {/* Left: Skill & Soul bonuses */}
        <div className="space-y-3 overflow-y-auto">
          <div className={`rounded-t ${config.headerBg} px-3 py-2`}>
            <h4 className="text-sm font-bold text-foreground">스킬 & 영혼 보너스</h4>
          </div>

          <div className="px-3">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">기본 {config.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-medium">{formatNumber(baseStat)}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">씨앗 {config.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-medium">{formatNumber(seedStat)}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">장비 {config.label} 합</td>
                  <td className="py-1.5 text-right tabular-nums font-bold text-foreground">{formatNumber(equipTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Skill & Soul bonuses combined */}
          <div className="px-3">
            <h5 className="text-xs font-semibold text-primary mb-1">스킬 보너스 ({config.label})</h5>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-1 text-left text-foreground/60">스킬/영혼명</th>
                  <th className="py-1 text-center text-foreground/60">깡</th>
                  <th className="py-1 text-right text-foreground/60">%</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const allSources = [...skillSources, ...soulSources];
                  const filtered = allSources.filter(src => {
                    const flat = getBonusField(src, statType, 'flat');
                    const pct = getBonusField(src, statType, 'pct');
                    return flat !== 0 || pct !== 0;
                  });
                  if (filtered.length === 0) {
                    return (
                      <tr className="border-b border-border/20">
                        <td colSpan={3} className="py-1 text-center text-muted-foreground">보너스 없음</td>
                      </tr>
                    );
                  }
                  return filtered.map((src, i) => {
                    const flat = getBonusField(src, statType, 'flat');
                    const pct = getBonusField(src, statType, 'pct');
                    const tagClass = src.type === 'unique' ? 'bg-purple-700/60' : src.type === 'soul' ? 'bg-teal-700/60' : 'bg-amber-800/40';
                    const tagLabel = src.type === 'unique' ? '고유' : src.type === 'soul' ? '영혼' : '공용';
                    return (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1 text-foreground/70">
                          <span className={`text-[9px] mr-1 px-1 rounded ${tagClass}`}>
                            {tagLabel}
                          </span>
                          {src.name}
                        </td>
                        <td className={`py-1 text-center tabular-nums ${flat ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {flat ? `+${formatNumber(flat)}` : '-'}
                        </td>
                        <td className={`py-1 text-right tabular-nums ${pct ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {pct ? `+${pct}%` : '-'}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Equipment-specific bonuses */}
          <div className="px-3">
            <h5 className="text-xs font-semibold text-primary mb-1">장비 보너스 스킬 ({config.label})</h5>
            {/* 해당 장비 보너스 */}
            {(() => {
              // Filter to only show equipment types that match currently equipped items
              const equippedTypes = new Set(
                (calcStats?.equipResult?.slots || [])
                  .filter(s => s.itemName)
                  .map(s => s.itemTypeKor || s.itemType)
              );
              const matchedEntries = 해당장비Entries.filter(([equipType]) => equippedTypes.has(equipType));
              
              return (
                <table className="w-full text-xs mb-2">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="py-1 text-left text-foreground/60">해당 장비 {config.label} 보너스</th>
                      <th className="py-1 text-right text-foreground/60">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedEntries.length === 0 ? (
                      <tr className="border-b border-border/20">
                        <td colSpan={2} className="py-1 text-center text-muted-foreground">해당 없음</td>
                      </tr>
                    ) : matchedEntries.map(([equipType, pct], i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1 text-foreground/70">
                          <span className="text-[9px] mr-1 px-1 rounded bg-cyan-800/40">해당</span>
                          {equipType}
                        </td>
                        <td className="py-1 text-right tabular-nums text-foreground">+{pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
            {/* 모든 장비 보너스 */}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-1 text-left text-foreground/60">모든 장비 보너스</th>
                  <th className="py-1 text-right text-foreground/60">%</th>
                </tr>
              </thead>
              <tbody>
                {equipBonusData.모든장비 === 0 ? (
                  <tr className="border-b border-border/20">
                    <td colSpan={2} className="py-1 text-center text-muted-foreground">해당 없음</td>
                  </tr>
                ) : (
                  <tr className="border-b border-border/20">
                    <td className="py-1 text-foreground/70">
                      <span className="text-[9px] mr-1 px-1 rounded bg-green-800/40">전체</span>
                      모든 장비
                    </td>
                    <td className="py-1 text-right tabular-nums text-foreground">+{equipBonusData.모든장비}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="px-3">
            <h5 className="text-xs font-semibold text-primary mb-1">통합 보너스 요약</h5>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">총 깡 보너스</td>
                  <td className={`py-1.5 text-right tabular-nums font-medium ${flatBonus ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {flatBonus ? `+${formatNumber(flatBonus)}` : '0'}
                  </td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">총 공통 % 계수</td>
                  <td className={`py-1.5 text-right tabular-nums font-medium ${pctBonus ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {pctBonus ? `+${pctBonus}%` : '0%'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Equipment breakdown */}
        <div className="space-y-3 overflow-y-auto">
          <div className={`rounded-t ${config.headerBg} px-3 py-2`}>
            <h4 className="text-sm font-bold text-foreground">무기, 장비 {config.label}</h4>
          </div>

          <div className="grid grid-cols-2 gap-3 px-3">
            {Array.from({ length: 6 }).map((_, i) => {
              const slot = equipSlots[i] || null;
              const hasItem = slot && slot.itemName;

              return (
                <div key={i} className="border border-border/40 rounded overflow-hidden">
                  <div className="bg-yellow-900/50 px-2 py-1 flex items-center justify-between border-b border-yellow-700/30">
                    <span className="text-xs font-semibold text-yellow-400">장비 {i + 1}</span>
                    <span className="text-[10px] text-foreground truncate ml-1">
                      {hasItem ? slot.itemName : '비어있음'}
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">유형</td>
                        <td className="px-2 py-1 text-right text-foreground">{hasItem ? slot.itemTypeKor || slot.itemType : '-'}</td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">기본 {config.label}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-foreground">
                          {formatNumber(slot ? getSlotStatDirect(slot, baseKey as keyof EquipSlotCalc) : 0)}
                        </td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">등급 적용</td>
                        <td className="px-2 py-1 text-right tabular-nums font-medium text-foreground">
                          {formatNumber(slot ? getSlotStatDirect(slot, qualityKey as keyof EquipSlotCalc) : 0)}
                        </td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">원소 {config.label}</td>
                        <td className={`px-2 py-1 text-right tabular-nums ${slot && getSlotStatDirect(slot, elementCapKey as keyof EquipSlotCalc) < getSlotStatDirect(slot, elementRawKey as keyof EquipSlotCalc) ? 'text-yellow-400' : 'text-foreground'}`}>
                          {formatNumber(slot ? getSlotStatDirect(slot, elementCapKey as keyof EquipSlotCalc) : 0)}
                          {slot && getSlotStatDirect(slot, elementCapKey as keyof EquipSlotCalc) < getSlotStatDirect(slot, elementRawKey as keyof EquipSlotCalc) && (
                            <span className="text-[9px] text-muted-foreground ml-0.5">(보정)</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">영혼 {config.label}</td>
                        <td className={`px-2 py-1 text-right tabular-nums ${slot && getSlotStatDirect(slot, spiritCapKey as keyof EquipSlotCalc) < getSlotStatDirect(slot, spiritRawKey as keyof EquipSlotCalc) ? 'text-yellow-400' : 'text-foreground'}`}>
                          {formatNumber(slot ? getSlotStatDirect(slot, spiritCapKey as keyof EquipSlotCalc) : 0)}
                          {slot && getSlotStatDirect(slot, spiritCapKey as keyof EquipSlotCalc) < getSlotStatDirect(slot, spiritRawKey as keyof EquipSlotCalc) && (
                            <span className="text-[9px] text-muted-foreground ml-0.5">(보정)</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">보너스 전</td>
                        <td className="px-2 py-1 text-right tabular-nums text-foreground">
                          {formatNumber(slot ? getSlotStatDirect(slot, preBonusKey as keyof EquipSlotCalc) : 0)}
                        </td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">장비 보너스 %</td>
                        <td className="px-2 py-1 text-right tabular-nums text-foreground">
                          {slot ? `${getSlotStatDirect(slot, bonusPctKey as keyof EquipSlotCalc)}%` : '0%'}
                        </td>
                      </tr>
                      <tr className={hasItem ? 'bg-secondary/30' : ''}>
                        <td className="px-2 py-1 font-semibold text-foreground">최종</td>
                        <td className={`px-2 py-1 text-right tabular-nums font-bold ${config.color}`}>
                          {formatNumber(slot ? getSlotStatDirect(slot, finalKey as keyof EquipSlotCalc) : 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Final calculation summary */}
          <div className={`mx-3 rounded ${config.headerBg} overflow-hidden`}>
            <div className="px-3 py-2">
              <h5 className="text-xs font-bold text-foreground mb-2">최종 계산식</h5>
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">기본 스탯</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">{formatNumber(baseStat)}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">씨앗</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">{formatNumber(seedStat)}</td>
                  </tr>
                  {equipSlots.map((slot, n) => (
                    <tr key={n} className="border-b border-border/20">
                      <td className="py-1 text-foreground/70">장비 {n + 1} {slot.itemName && <span className="text-foreground">({slot.itemName})</span>}</td>
                      <td className="py-1 text-right tabular-nums text-foreground">
                        {formatNumber(getSlotStatDirect(slot, finalKey as keyof EquipSlotCalc))}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">깡 보너스</td>
                    <td className={`py-1.5 text-right tabular-nums font-medium ${flatBonus ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {flatBonus ? `+${formatNumber(flatBonus)}` : '0'}
                    </td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">× (1 + 공통%)</td>
                    <td className={`py-1.5 text-right tabular-nums font-medium ${pctBonus ? 'text-foreground' : 'text-muted-foreground'}`}>
                      ×{(1 + pctBonus / 100).toFixed(2)} ({pctBonus}%)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-3 py-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">최종 {config.label}</span>
              <span className={`text-xl font-bold tabular-nums ${config.color}`}>
                {formatNumber(totalStat)}
              </span>
            </div>
          </div>

          <div className="px-3 pb-3">
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              ※ {config.label} = (기본 + 씨앗 + Σ장비최종 + 깡 보너스) × (1 + 공통%/100)
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right-wide" className="p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border flex-shrink-0">
          <SheetTitle className="text-lg font-display text-primary">
            공격력, 방어력, 체력 상세 수치 및 계산 방식
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            각 스탯의 구성 요소와 계산 과정을 확인할 수 있습니다
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden p-4">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as StatType)} className="h-full flex flex-col">
            <TabsList className="w-full grid grid-cols-3 mb-3 flex-shrink-0">
              {TAB_CONFIG.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 text-sm">
                  <img src={tab.icon} alt="" className="w-4 h-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {TAB_CONFIG.map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="flex-1 overflow-y-auto mt-0">
                {renderBreakdownTable(tab.key)}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
