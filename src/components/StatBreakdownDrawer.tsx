import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings } from 'lucide-react';
import { STAT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { CalculatedStats, EquipSlotCalc, SkillBonusSummary, SkillBonusSource, SkillBonuses, RelicEffect, EquipBonusSource } from '@/lib/statCalculator';

interface StatBreakdownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calcStats: CalculatedStats | null;
}

type MultStatType = 'atk' | 'def' | 'hp';
type AddStatType = 'crit' | 'evasion' | 'threat' | 'other';
type StatType = MultStatType | AddStatType;

const MULT_TABS: { key: MultStatType; label: string; icon: string; color: string; headerBg: string }[] = [
  { key: 'atk', label: '공격력', icon: STAT_ICON_MAP.atk, color: 'text-red-400', headerBg: 'bg-red-900/60' },
  { key: 'def', label: '방어력', icon: STAT_ICON_MAP.def, color: 'text-blue-400', headerBg: 'bg-blue-900/60' },
  { key: 'hp', label: '체력', icon: STAT_ICON_MAP.hp, color: 'text-orange-400', headerBg: 'bg-[#ff7f00]/40' },
];

const ADD_TABS: { key: AddStatType; label: string; icon: string; color: string; headerBg: string }[] = [
  { key: 'crit', label: '치명타', icon: STAT_ICON_MAP.crit, color: 'text-yellow-300', headerBg: 'bg-yellow-500/30' },
  { key: 'evasion', label: '회피', icon: STAT_ICON_MAP.evasion, color: 'text-teal-300', headerBg: 'bg-teal-600/30' },
  { key: 'threat', label: '위협도', icon: STAT_ICON_MAP.threat, color: 'text-purple-400', headerBg: 'bg-purple-900/60' },
  { key: 'other', label: '기타', icon: '', color: 'text-gray-400', headerBg: 'bg-gray-700/60' },
];

const ALL_TABS = [...MULT_TABS, ...ADD_TABS];

function getSlotStatDirect(slot: EquipSlotCalc, key: keyof EquipSlotCalc): number {
  return (slot[key] as number) || 0;
}

function getBonusField(source: SkillBonusSource, statType: MultStatType, field: 'flat' | 'pct'): number {
  if (field === 'flat') {
    return statType === 'atk' ? source.flatAtk : statType === 'def' ? source.flatDef : source.flatHp;
  }
  return statType === 'atk' ? source.pctAtk : statType === 'def' ? source.pctDef : source.pctHp;
}

function getAddBonusField(source: SkillBonusSource, statType: AddStatType): number {
  if (statType === 'crit') return source.critRate;
  if (statType === 'evasion') return source.evasion;
  if (statType === 'threat') return source.threat;
  return 0;
}

function getCritDmgField(source: SkillBonusSource): number {
  return source.critDmg;
}

function getSummaryField(summary: SkillBonusSummary, statType: MultStatType, field: 'flat' | 'pct'): number {
  if (field === 'flat') {
    return statType === 'atk' ? summary.flatAtk : statType === 'def' ? summary.flatDef : summary.flatHp;
  }
  return statType === 'atk' ? summary.pctAtk : statType === 'def' ? summary.pctDef : summary.pctHp;
}

function getEquipBonusForStat(equipBonuses: SkillBonuses, statType: MultStatType): {
  해당장비: Record<string, number>;
  모든장비: number;
  해당Sources: EquipBonusSource[];
  모든Sources: EquipBonusSource[];
} {
  const statSuffix = statType === 'atk' ? '공격력' : statType === 'def' ? '방어력' : '체력';
  const 해당Key = `해당장비${statSuffix}` as const;
  const 모든Key = `모든장비${statSuffix}` as const;

  // Merge stat-specific + 전체 for totals
  const merged: Record<string, number> = {};
  for (const [k, v] of Object.entries(equipBonuses[해당Key])) merged[k] = (merged[k] || 0) + v;
  for (const [k, v] of Object.entries(equipBonuses.해당장비전체)) merged[k] = (merged[k] || 0) + v;
  const 모든장비 = equipBonuses[모든Key] + equipBonuses.모든장비전체;

  // Filter sources relevant to this stat type
  const relevantKeys = new Set([해당Key, '해당장비전체']);
  const 해당Sources = equipBonuses.sources.filter(s => relevantKeys.has(s.bonusKey));
  const 모든Keys = new Set([모든Key, '모든장비전체']);
  const 모든Sources = equipBonuses.sources.filter(s => 모든Keys.has(s.bonusKey));

  return { 해당장비: merged, 모든장비, 해당Sources, 모든Sources };
}

export default function StatBreakdownDrawer({ open, onOpenChange, calcStats }: StatBreakdownDrawerProps) {
  const [activeTab, setActiveTab] = useState<StatType>('atk');

  // ========== Multiplicative stat breakdown (ATK/DEF/HP) ==========
  const renderMultBreakdown = (statType: MultStatType) => {
    const config = MULT_TABS.find(t => t.key === statType)!;
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

    const relicEffects = calcStats?.relicEffects || [];
    const hasWeaponNullify = relicEffects.some(e => e.type === 'weapon_nullify');

    const skillSources = bonus?.sources.filter(s => s.type === 'unique' || s.type === 'common') || [];
    const soulSources = bonus?.sources.filter(s => s.type === 'soul') || [];
    const relicSources = bonus?.sources.filter(s => s.type === 'relic') || [];
    const jobSources = bonus?.sources.filter(s => s.type === 'job') || [];

    // Get equipped item types to filter 해당 장비 bonuses
    // Include judgmentTypes for dual wield items
    const equippedItemTypes = new Set(
      (calcStats?.equipResult?.slots || [])
        .filter(s => s.itemName)
        .flatMap(s => s.judgmentTypes?.length ? s.judgmentTypes : [s.itemTypeKor])
    );
    const equipBonusDataRaw = calcStats?.equipBonuses ? getEquipBonusForStat(calcStats.equipBonuses, statType) : { 해당장비: {}, 모든장비: 0, 해당Sources: [], 모든Sources: [] };
    // Only show 해당 장비 sources for equipment types that are actually equipped
    const equipBonusData = {
      ...equipBonusDataRaw,
      해당Sources: equipBonusDataRaw.해당Sources.filter(s => !s.equipType || equippedItemTypes.has(s.equipType)),
    };
    

    const baseKey = statType === 'atk' ? 'baseAtk' : statType === 'def' ? 'baseDef' : 'baseHp';
    const qualityKey = statType === 'atk' ? 'qualityAtk' : statType === 'def' ? 'qualityDef' : 'qualityHp';
    const elementRawKey = statType === 'atk' ? 'elementRawAtk' : statType === 'def' ? 'elementRawDef' : 'elementRawHp';
    const spiritRawKey = statType === 'atk' ? 'spiritRawAtk' : statType === 'def' ? 'spiritRawDef' : 'spiritRawHp';
    const elementCapKey = statType === 'atk' ? 'elementCapAtk' : statType === 'def' ? 'elementCapDef' : 'elementCapHp';
    const spiritCapKey = statType === 'atk' ? 'spiritCapAtk' : statType === 'def' ? 'spiritCapDef' : 'spiritCapHp';
    const preBonusKey = statType === 'atk' ? 'preBonusAtk' : statType === 'def' ? 'preBonusDef' : 'preBonusHp';
    const bonusPctKey = statType === 'atk' ? 'bonusAtkPct' : statType === 'def' ? 'bonusDefPct' : 'bonusHpPct';
    const finalKey = statType === 'atk' ? 'finalAtk' : statType === 'def' ? 'finalDef' : 'finalHp';
    const quiverBonusKey = statType === 'atk' ? 'quiverBonusAtk' : statType === 'def' ? 'quiverBonusDef' : 'quiverBonusHp';

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
                  const allSources = [...skillSources, ...soulSources, ...relicSources, ...jobSources];
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
                    const tagClass = src.type === 'unique' ? 'bg-purple-700/60' : src.type === 'soul' ? 'bg-teal-700/60' : src.type === 'relic' ? 'bg-yellow-700/60' : src.type === 'job' ? 'bg-blue-700/60' : 'bg-amber-800/40';
                    const tagLabel = src.type === 'unique' ? '고유' : src.type === 'soul' ? '영혼' : src.type === 'relic' ? '유물' : src.type === 'job' ? '직업' : '공용';
                    const isIdolSrc = !!(src as any).isIdol;
                    const valColor = isIdolSrc ? 'text-red-400 font-semibold' : 'text-foreground';
                    return (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1 text-foreground/70">
                          <span className={`text-[9px] mr-1 px-1 rounded ${tagClass}`}>{tagLabel}</span>
                          {src.name}
                        </td>
                        <td className={`py-1 text-center tabular-nums ${flat ? valColor : 'text-muted-foreground'}`}>
                          {flat ? `+${formatNumber(flat)}` : '-'}
                        </td>
                        <td className={`py-1 text-right tabular-nums ${pct ? valColor : 'text-muted-foreground'}`}>
                          {pct ? `+${pct}%` : '-'}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          <div className="px-3">
            <h5 className="text-xs font-semibold text-primary mb-1">장비 보너스 스킬 ({config.label})</h5>
            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-1 text-left text-foreground/60">해당 장비 {config.label} 보너스</th>
                  <th className="py-1 text-right text-foreground/60">%</th>
                </tr>
              </thead>
              <tbody>
                {equipBonusData.해당Sources.length === 0 ? (
                  <tr className="border-b border-border/20">
                    <td colSpan={2} className="py-1 text-center text-muted-foreground">해당 없음</td>
                  </tr>
                ) : equipBonusData.해당Sources.map((src, i) => {
                  const tagClass = src.skillType === 'unique' ? 'bg-purple-700/60' : 'bg-amber-800/40';
                  const tagLabel = src.skillType === 'unique' ? '고유' : '공용';
                  return (
                    <tr key={i} className="border-b border-border/20">
                      <td className="py-1 text-foreground/70">
                        <span className={`text-[9px] mr-1 px-1 rounded ${tagClass}`}>{tagLabel}</span>
                        {src.skillName} → {src.equipType}
                      </td>
                      <td className="py-1 text-right tabular-nums text-foreground">+{src.value}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-1 text-left text-foreground/60">모든 장비 보너스</th>
                  <th className="py-1 text-right text-foreground/60">%</th>
                </tr>
              </thead>
              <tbody>
                {equipBonusData.모든Sources.length === 0 ? (
                  <tr className="border-b border-border/20">
                    <td colSpan={2} className="py-1 text-center text-muted-foreground">해당 없음</td>
                  </tr>
                ) : equipBonusData.모든Sources.map((src, i) => {
                  const tagClass = src.skillType === 'unique' ? 'bg-purple-700/60' : 'bg-amber-800/40';
                  const tagLabel = src.skillType === 'unique' ? '고유' : '공용';
                  return (
                    <tr key={i} className="border-b border-border/20">
                      <td className="py-1 text-foreground/70">
                        <span className={`text-[9px] mr-1 px-1 rounded ${tagClass}`}>{tagLabel}</span>
                        {src.skillName}
                      </td>
                      <td className="py-1 text-right tabular-nums text-foreground">+{src.value}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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

          {/* Relic effects info */}
          {relicEffects.length > 0 && (
            <div className="px-3">
              <h5 className="text-xs font-semibold text-yellow-400 mb-1">⭐ 유물 효과</h5>
              <div className="space-y-1">
                {relicEffects.map((e, i) => (
                  <div key={i} className="text-[10px] bg-yellow-900/20 border border-yellow-500/20 rounded px-2 py-1">
                    <span className="text-yellow-300 font-semibold">{e.itemName}</span>
                    <span className="text-foreground/70 ml-1">— {e.description}</span>
                    {e.type === 'weapon_nullify' && (
                      <span className="text-red-400 ml-1">(무기 스탯 → 0)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
                      {slot && slot.spellknightMult > 1 && (
                        <tr className="border-b border-border/20">
                          <td className="px-2 py-1 text-blue-400">스펠나이트 계수</td>
                          <td className="px-2 py-1 text-right tabular-nums text-blue-400 font-medium">
                            ×{slot.spellknightMult}
                          </td>
                        </tr>
                      )}
                      {/* 역효과 해머 +100% 표시 */}
                      {slot && slot.itemName === '역효과 해머' && (
                        <tr className="border-b border-border/20">
                          <td className="px-2 py-1 text-red-400 text-[11px]">
                            <span className="text-[9px] mr-1 px-1 rounded bg-red-700/40">유물</span>
                            역효과 해머 자체 보너스
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-red-400">+100%</td>
                        </tr>
                      )}
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">장비 보너스 %</td>
                        <td className="px-2 py-1 text-right tabular-nums text-foreground">
                          {slot ? `${getSlotStatDirect(slot, bonusPctKey as keyof EquipSlotCalc)}%` : '0%'}
                        </td>
                      </tr>
                      {/* 화살통 보너스: 보너스 적용 후 마지막에 추가 */}
                      {slot && slot.itemType === 'bow' && 
                        calcStats?.equipResult?.slots?.some((s: any) => s.itemType === 'quiver') && (
                        <tr className="border-b border-border/20">
                          <td className="px-2 py-1 text-green-400 text-[11px]">
                            <span className="text-[9px] mr-1 px-1 rounded bg-green-700/40">화살통</span>
                            화살통 보너스 (보너스 전 ×30%)
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-green-400">
                            +{formatNumber(slot ? getSlotStatDirect(slot, quiverBonusKey as keyof EquipSlotCalc) : 0)}
                          </td>
                        </tr>
                      )}
                      {/* 화살통 스탯 0 안내 */}
                      {slot && slot.itemType === 'quiver' && getSlotStatDirect(slot, finalKey as keyof EquipSlotCalc) === 0 && hasItem && (
                        <tr className="border-b border-border/20">
                          <td colSpan={2} className="px-2 py-1 text-[10px] text-yellow-400/80">
                            ⚠ 활/석궁/총 미장착 시 화살통 스탯 0
                          </td>
                        </tr>
                      )}
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
                  <tr className="border-b border-border/50 bg-secondary/30">
                    <td className="py-1.5 text-foreground font-semibold">소계 (공통% 적용 전)</td>
                    <td className="py-1.5 text-right tabular-nums font-bold text-foreground">
                      {formatNumber(Math.round(baseStat + seedStat + equipSlots.reduce((sum, slot, n) => sum + getSlotStatDirect(slot, finalKey as keyof EquipSlotCalc), 0) + flatBonus))}
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

  // ========== Additive stat breakdown (Crit, Evasion, Threat) ==========
  const renderAddBreakdown = (statType: AddStatType) => {
    const config = ADD_TABS.find(t => t.key === statType)!;
    const bonus = calcStats?.bonusSummary;
    const equipSlots = calcStats?.equipResult?.slots || [];
    const allSources = bonus?.sources || [];
    const relicEffects = calcStats?.relicEffects || [];
    

    if (statType === 'other') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3 py-12">
          <Settings className="w-10 h-10" />
          <p className="text-sm">준비 중입니다</p>
          <p className="text-xs text-muted-foreground/70">매턴 체력 회복, 기타 특수 효과 등이 추가될 예정입니다.</p>
        </div>
      );
    }

    const isCrit = statType === 'crit';
    const isEvasion = statType === 'evasion';

    // Relic effects for this stat
    let hasCritFixed = relicEffects.find(e => e.type === 'crit_fixed') || null;
    let hasEvasionFixed = relicEffects.find(e => e.type === 'evasion_fixed') || null;

    // Also detect manual relic fixed effects (op === '고정')
    for (const effect of relicEffects) {
      if (effect.type === 'relic_bonus' && effect.bonuses) {
        for (const b of effect.bonuses) {
          if (b.op !== '고정') continue;
          if (b.stat === '치명타확률%' && !hasCritFixed) {
            hasCritFixed = { itemName: effect.itemName, slotIndex: effect.slotIndex, type: 'crit_fixed', fixedValue: b.value, description: `치명타 확률 ${b.value}%로 고정` };
          }
          if (b.stat === '회피%' && !hasEvasionFixed) {
            hasEvasionFixed = { itemName: effect.itemName, slotIndex: effect.slotIndex, type: 'evasion_fixed', fixedValue: b.value, description: `회피 ${b.value}%로 고정` };
          }
        }
      }
    }


    // Base values
    const baseVal = calcStats
      ? statType === 'crit' ? calcStats.baseCrit
        : statType === 'evasion' ? calcStats.baseEvasion
          : calcStats.baseThreat
      : 0;
    const baseCritDmgVal = calcStats?.baseCritDmg || 0;

    // Equipment contributions
    const equipCrit = calcStats?.equipResult?.totalCrit || 0;
    const equipEvasion = calcStats?.equipResult?.totalEvasion || 0;

    // Per-slot equipment contributions
    const slotStatKey = statType === 'crit' ? 'finalCrit' : statType === 'evasion' ? 'finalEvasion' : null;

    // Bonus totals
    const bonusVal = bonus
      ? statType === 'crit' ? bonus.critRate
        : statType === 'evasion' ? bonus.evasion
          : bonus.threat
      : 0;
    const bonusCritDmg = bonus?.critDmg || 0;

    // Final totals
    const totalVal = calcStats
      ? statType === 'crit' ? calcStats.totalCrit
        : statType === 'evasion' ? calcStats.totalEvasion
          : calcStats.totalThreat
      : 0;
    const preRelicCrit = calcStats?.preRelicCrit || 0;
    const preRelicEvasion = calcStats?.preRelicEvasion || 0;
    const totalCritDmg = calcStats?.totalCritDmg || 0;
    const totalCritAttack = calcStats?.totalCritAttack || 0;

    // Evasion cap logic (only 길잡이 gets 78%, all others including 방랑자 get 75%)
    const isPathfinder = calcStats?.jobName === '길잡이';
    const evasionCap = isPathfinder ? 78 : 75;
    const cappedEvasion = isEvasion && totalVal > evasionCap ? evasionCap : totalVal;
    const isEvasionCapped = isEvasion && totalVal > evasionCap;

    // Unit
    const unit = statType === 'threat' ? '' : '%';

    // Filter sources with relevant bonuses
    const filteredSources = allSources.filter(src => {
      const val = getAddBonusField(src, statType);
      const critDmg = isCrit ? getCritDmgField(src) : 0;
      return val !== 0 || critDmg !== 0;
    });

    // For crit: separate sources for rate vs dmg
    const critRateSources = isCrit ? allSources.filter(src => getAddBonusField(src, 'crit') !== 0) : [];
    const critDmgSources = isCrit ? allSources.filter(src => getCritDmgField(src) !== 0) : [];

    // ===== CRIT: Left = rate, Right = dmg =====
    if (isCrit) {
      return (
        <div className="grid grid-cols-[1fr_1fr] gap-4 h-full">
          {/* Left: Crit Rate */}
          <div className="space-y-3 overflow-y-auto">
            <div className={`rounded-t ${config.headerBg} px-3 py-2`}>
              <h4 className="text-sm font-bold text-foreground">치명타 확률</h4>
            </div>

            <div className="px-3">
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/70">기본 치명타 확률</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground font-medium">{baseVal}%</td>
                  </tr>
                  {slotStatKey && (
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 text-foreground/70">장비 치명타 확률 합</td>
                      <td className="py-1.5 text-right tabular-nums font-bold text-foreground">{equipCrit}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Per-slot crit */}
            {slotStatKey && (
              <div className="px-3">
                <h5 className="text-xs font-semibold text-primary mb-1">장비별 치명타 확률</h5>
                <table className="w-full text-xs">
                  <tbody>
                    {equipSlots.map((slot, i) => {
                      const val = getSlotStatDirect(slot, slotStatKey as keyof EquipSlotCalc);
                      return (
                        <tr key={i} className="border-b border-border/20">
                          <td className="py-1 text-foreground/70">
                            장비 {i + 1}
                            {slot.itemName && <span className="text-foreground/50 ml-1 text-[10px]">({slot.itemName})</span>}
                          </td>
                          <td className={`py-1 text-right tabular-nums ${val ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {val ? `+${val}%` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Skill/Soul bonuses for rate */}
            <div className="px-3">
              <h5 className="text-xs font-semibold text-primary mb-1">스킬 & 영혼 보너스 (확률)</h5>
              <table className="w-full text-xs">
                <tbody>
                  {critRateSources.length === 0 ? (
                    <tr className="border-b border-border/20">
                      <td colSpan={2} className="py-1 text-center text-muted-foreground">보너스 없음</td>
                    </tr>
                  ) : critRateSources.map((src, i) => {
                    const val = getAddBonusField(src, 'crit');
                    const tagClass = src.type === 'unique' ? 'bg-purple-700/60' : src.type === 'soul' ? 'bg-teal-700/60' : src.type === 'relic' ? 'bg-yellow-700/60' : src.type === 'job' ? 'bg-blue-700/60' : 'bg-amber-800/40';
                    const tagLabel = src.type === 'unique' ? '고유' : src.type === 'soul' ? '영혼' : src.type === 'relic' ? '유물' : src.type === 'job' ? '직업' : '공용';
                    const isIdolSrc = !!(src as any).isIdol;
                    return (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1 text-foreground/70">
                          <span className={`text-[9px] mr-1 px-1 rounded ${tagClass}`}>{tagLabel}</span>
                          {src.name}
                        </td>
                        <td className={`py-1 text-right tabular-nums ${isIdolSrc ? 'text-red-400 font-semibold' : 'text-foreground'}`}>+{val}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Final crit rate summary */}
            <div className={`mx-0 rounded ${config.headerBg} overflow-hidden`}>
              <div className="px-3 py-2">
                <h5 className="text-xs font-bold text-foreground mb-2">최종 계산식</h5>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 text-foreground/80">기본 치명타 확률</td>
                      <td className="py-1.5 text-right tabular-nums text-foreground">{baseVal}%</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 text-foreground/80">장비 합</td>
                      <td className="py-1.5 text-right tabular-nums text-foreground">+{equipCrit}%</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 text-foreground/80">스킬/영혼 보너스</td>
                      <td className="py-1.5 text-right tabular-nums text-foreground">+{bonusVal}%</td>
                    </tr>
                    {hasCritFixed && (
                      <tr className="border-b border-border/30 bg-red-900/20">
                        <td className="py-1.5 text-red-400 font-semibold">⚠ {hasCritFixed.itemName}</td>
                        <td className="py-1.5 text-right tabular-nums text-red-400 font-bold">→ {hasCritFixed.fixedValue}% 고정</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">최종 치명타 확률</span>
                <span className={`text-xl font-bold tabular-nums ${config.color}`}>
                  {totalVal}%
                  {hasCritFixed && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">({preRelicCrit}%→고정)</span>
                  )}
                </span>
              </div>
            </div>

            {(calcStats?.jobName === '닌자' || calcStats?.jobName === '센세') && (
              <div className="px-3">
                <div className="rounded bg-purple-900/20 border border-purple-500/20 px-3 py-2">
                  <p className="text-[10px] text-purple-300/80 leading-relaxed">
                    🥷 닌자 고유 스킬의 치확/회피 보너스는 <span className="font-bold text-purple-200">피격 시 해제</span>됩니다.
                    {calcStats?.jobName === '센세' && <span className="text-purple-200"> (센세는 2라운드 후 재획득)</span>}
                  </p>
                </div>
              </div>
            )}

            <div className="px-3 pb-3">
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                {hasCritFixed
                  ? `※ ${hasCritFixed.itemName}: 치명타 확률 ${hasCritFixed.fixedValue}%로 고정`
                  : '※ 치명타 확률 = 기본 + 장비 합 + 스킬/영혼 보너스'}
              </p>
            </div>
          </div>

          {/* Right: Crit Damage */}
          <div className="space-y-3 overflow-y-auto">
            <div className={`rounded-t ${config.headerBg} px-3 py-2`}>
              <h4 className="text-sm font-bold text-foreground">치명타 대미지</h4>
            </div>

            <div className="px-3">
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/70">기본 치명타 대미지</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground font-medium">{baseCritDmgVal}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Skill/Soul bonuses for dmg */}
            <div className="px-3">
              <h5 className="text-xs font-semibold text-primary mb-1">스킬 & 영혼 보너스 (대미지)</h5>
              <table className="w-full text-xs">
                <tbody>
                  {critDmgSources.length === 0 ? (
                    <tr className="border-b border-border/20">
                      <td colSpan={2} className="py-1 text-center text-muted-foreground">보너스 없음</td>
                    </tr>
                  ) : critDmgSources.map((src, i) => {
                    const val = getCritDmgField(src);
                    const tagClass = src.type === 'unique' ? 'bg-purple-700/60' : src.type === 'soul' ? 'bg-teal-700/60' : src.type === 'relic' ? 'bg-yellow-700/60' : src.type === 'job' ? 'bg-blue-700/60' : 'bg-amber-800/40';
                    const tagLabel = src.type === 'unique' ? '고유' : src.type === 'soul' ? '영혼' : src.type === 'relic' ? '유물' : src.type === 'job' ? '직업' : '공용';
                    const isIdolSrc = !!(src as any).isIdol;
                    return (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1 text-foreground/70">
                          <span className={`text-[9px] mr-1 px-1 rounded ${tagClass}`}>{tagLabel}</span>
                          {src.name}
                        </td>
                        <td className={`py-1 text-right tabular-nums ${isIdolSrc ? 'text-red-400 font-semibold' : 'text-foreground'}`}>+{val}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Final crit damage summary */}
            <div className={`mx-0 rounded ${config.headerBg} overflow-hidden`}>
              <div className="px-3 py-2">
                <h5 className="text-xs font-bold text-foreground mb-2">최종 계산식</h5>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 text-foreground/80">기본 치명타 대미지</td>
                      <td className="py-1.5 text-right tabular-nums text-foreground">{baseCritDmgVal}%</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 text-foreground/80">스킬/영혼 보너스</td>
                      <td className="py-1.5 text-right tabular-nums text-foreground">+{bonusCritDmg}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">최종 치명타 대미지 계수</span>
                <span className={`text-xl font-bold tabular-nums ${config.color}`}>
                  {totalCritDmg}% <span className="text-base text-foreground/70">→ x{(totalCritDmg / 100).toFixed(1)}</span>
                </span>
              </div>
              <div className="px-3 py-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">최종 치명타 대미지</span>
                <span className="text-xl font-bold tabular-nums text-red-400">
                  {formatNumber(totalCritAttack)}
                </span>
              </div>
            </div>

            <div className="px-3 pb-3">
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                ※ 치명타 대미지 계수 = 기본 + 스킬/영혼 보너스
              </p>
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed mt-1">
                ※ 최종 치명타 대미지 = 최종 공격력 × 치명타 대미지 계수
              </p>
            </div>
          </div>
        </div>
      );
    }

    // ===== EVASION / THREAT =====
    return (
      <div className="grid grid-cols-[1fr_1fr] gap-4 h-full">
        {/* Left: Breakdown */}
        <div className="space-y-3 overflow-y-auto">
          <div className={`rounded-t ${config.headerBg} px-3 py-2`}>
            <h4 className="text-sm font-bold text-foreground">{config.label} 상세</h4>
          </div>

          <div className="px-3">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">기본 {config.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-medium">{baseVal}{unit}</td>
                </tr>
                {slotStatKey && (
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/70">장비 {config.label} 합</td>
                    <td className="py-1.5 text-right tabular-nums font-bold text-foreground">
                      {equipEvasion}{unit}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Per-slot equipment breakdown */}
          {slotStatKey && (
            <div className="px-3">
              <h5 className="text-xs font-semibold text-primary mb-1">장비별 {config.label}</h5>
              <table className="w-full text-xs">
                <tbody>
                  {equipSlots.map((slot, i) => {
                    const val = getSlotStatDirect(slot, slotStatKey as keyof EquipSlotCalc);
                    return (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1 text-foreground/70">
                          장비 {i + 1}
                          {slot.itemName && <span className="text-foreground/50 ml-1 text-[10px]">({slot.itemName})</span>}
                        </td>
                        <td className={`py-1 text-right tabular-nums ${val ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {val ? `+${val}${unit}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Skill & Soul bonuses */}
          <div className="px-3">
            <h5 className="text-xs font-semibold text-primary mb-1">스킬 & 영혼 보너스</h5>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-1 text-left text-foreground/60">스킬/영혼명</th>
                  <th className="py-1 text-right text-foreground/60">{config.label}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.length === 0 ? (
                  <tr className="border-b border-border/20">
                    <td colSpan={2} className="py-1 text-center text-muted-foreground">보너스 없음</td>
                  </tr>
                ) : filteredSources.map((src, i) => {
                  const val = getAddBonusField(src, statType);
                  const tagClass = src.type === 'unique' ? 'bg-purple-700/60' : src.type === 'soul' ? 'bg-teal-700/60' : src.type === 'relic' ? 'bg-yellow-700/60' : src.type === 'job' ? 'bg-blue-700/60' : 'bg-amber-800/40';
                  const tagLabel = src.type === 'unique' ? '고유' : src.type === 'soul' ? '영혼' : src.type === 'relic' ? '유물' : src.type === 'job' ? '직업' : '공용';
                  const isIdolSrc = !!(src as any).isIdol;
                  const valColor = isIdolSrc ? 'text-red-400 font-semibold' : 'text-foreground';
                  return (
                    <tr key={i} className="border-b border-border/20">
                      <td className="py-1 text-foreground/70">
                        <span className={`text-[9px] mr-1 px-1 rounded ${tagClass}`}>{tagLabel}</span>
                        {src.name}
                      </td>
                      <td className={`py-1 text-right tabular-nums ${val ? valColor : 'text-muted-foreground'}`}>
                        {val ? `+${val}${unit}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Summary */}
        <div className="space-y-3 overflow-y-auto">
          <div className={`rounded-t ${config.headerBg} px-3 py-2`}>
            <h4 className="text-sm font-bold text-foreground">보너스 합산</h4>
          </div>

          <div className="px-3">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">총 {config.label} 보너스</td>
                  <td className={`py-1.5 text-right tabular-nums font-medium ${bonusVal ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {bonusVal ? `+${bonusVal}${unit}` : `0${unit}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Final summary box */}
          <div className={`mx-0 rounded ${config.headerBg} overflow-hidden`}>
            <div className="px-3 py-2">
              <h5 className="text-xs font-bold text-foreground mb-2">최종 계산식</h5>
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">기본 {config.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">{baseVal}{unit}</td>
                  </tr>
                  {slotStatKey && (
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 text-foreground/80">장비 합</td>
                      <td className="py-1.5 text-right tabular-nums text-foreground">
                        +{statType === 'evasion' ? equipEvasion : 0}{unit}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">스킬/영혼 보너스</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">+{bonusVal}{unit}</td>
                  </tr>
                  {isEvasion && hasEvasionFixed && (
                    <tr className="border-b border-border/30 bg-red-900/20">
                      <td className="py-1.5 text-red-400 font-semibold">⚠ {hasEvasionFixed.itemName}</td>
                      <td className="py-1.5 text-right tabular-nums text-red-400 font-bold">→ {hasEvasionFixed.fixedValue}% 고정</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">최종 {config.label}</span>
              {isEvasion && hasEvasionFixed ? (
                <span className="text-xl font-bold tabular-nums text-red-400">
                  {totalVal}%
                  <span className="text-sm font-normal text-muted-foreground ml-1">({preRelicEvasion}%→고정)</span>
                </span>
              ) : isEvasion ? (
                <span className={`text-xl font-bold tabular-nums ${config.color}`}>
                  {totalVal}%
                  {isEvasionCapped && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">({evasionCap}%)</span>
                  )}
                </span>
              ) : (
                <span className={`text-xl font-bold tabular-nums ${config.color}`}>
                  {totalVal}{unit}
                </span>
              )}
            </div>
          </div>

          {isEvasion && !hasEvasionFixed && (
            <div className="px-3">
              <div className="rounded bg-teal-900/20 border border-teal-500/20 px-3 py-2">
                <p className="text-[10px] text-teal-300/80 leading-relaxed">
                  ⚠️ 던전에서 회피율은 최대 <span className="font-bold text-teal-200">{evasionCap}%</span>까지만 적용됩니다.
                  {isPathfinder && ' (길잡이만 78%까지 적용)'}
                  {!isPathfinder && ' (길잡이만 78%까지 적용 가능)'}
                </p>
              </div>
            </div>
          )}

          {isEvasion && hasEvasionFixed && (
            <div className="px-3">
              <div className="rounded bg-red-900/20 border border-red-500/20 px-3 py-2">
                <p className="text-[10px] text-red-300/80 leading-relaxed">
                  ⚠ <span className="font-bold text-red-200">{hasEvasionFixed.itemName}</span> 장착으로 회피가 {hasEvasionFixed.fixedValue}%로 고정됩니다.
                </p>
              </div>
            </div>
          )}

          {isEvasion && (calcStats?.jobName === '닌자' || calcStats?.jobName === '센세') && (
            <div className="px-3">
              <div className="rounded bg-purple-900/20 border border-purple-500/20 px-3 py-2">
                <p className="text-[10px] text-purple-300/80 leading-relaxed">
                  🥷 닌자 고유 스킬의 회피 보너스는 <span className="font-bold text-purple-200">피격 시 해제</span>됩니다.
                  {calcStats?.jobName === '센세' && <span className="text-purple-200"> (센세는 2라운드 후 재획득)</span>}
                </p>
              </div>
            </div>
          )}

          <div className="px-3 pb-3">
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              {isEvasion && hasEvasionFixed
                ? `※ ${hasEvasionFixed.itemName}: 회피 ${hasEvasionFixed.fixedValue}%로 고정`
                : isEvasion
                  ? '※ 회피 = 기본 + 장비 합 + 스킬/영혼 보너스 (합산, 최대 75% / 길잡이 78%)'
                  : '※ 위협도 = 기본 + 스킬/영혼 보너스 (합산)'}
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
          <SheetTitle className="text-lg font-bold text-primary">
            스탯 상세 계산표
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            각 스탯의 구성 요소와 계산 과정을 확인할 수 있습니다
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden p-4">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as StatType)} className="h-full flex flex-col">
            <TabsList className="w-full grid grid-cols-7 mb-3 flex-shrink-0">
              {ALL_TABS.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1 text-xs px-1.5">
                  {tab.key === 'other' ? (
                    <Settings className="w-3.5 h-3.5" />
                  ) : (
                    <img src={tab.icon} alt="" className="w-3.5 h-3.5" />
                  )}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {MULT_TABS.map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="flex-1 overflow-y-auto mt-0">
                {renderMultBreakdown(tab.key)}
              </TabsContent>
            ))}
            {ADD_TABS.map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="flex-1 overflow-y-auto mt-0">
                {renderAddBreakdown(tab.key)}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
