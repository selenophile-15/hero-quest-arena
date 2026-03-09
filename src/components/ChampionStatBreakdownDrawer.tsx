import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { STAT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { ChampionCalcResult, CARD_LEVEL_BONUS } from '@/lib/championStatCalculator';

interface ChampionStatBreakdownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calcResult: ChampionCalcResult | null;
  championName: string;
}

type StatTab = 'atk' | 'def' | 'hp' | 'other';

const STAT_TABS: { key: StatTab; label: string; icon: string; color: string; headerBg: string }[] = [
  { key: 'atk', label: '공격력', icon: STAT_ICON_MAP.atk, color: 'text-red-400', headerBg: 'bg-red-900/60' },
  { key: 'def', label: '방어력', icon: STAT_ICON_MAP.def, color: 'text-blue-400', headerBg: 'bg-blue-900/60' },
  { key: 'hp', label: '체력', icon: STAT_ICON_MAP.hp, color: 'text-orange-400', headerBg: 'bg-[#ff7f00]/40' },
  { key: 'other', label: '기타', icon: '', color: 'text-gray-400', headerBg: 'bg-gray-700/60' },
];

function DiffBadge({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return null;
  const isPos = value > 0;
  return (
    <span className={`text-[10px] font-semibold ml-1 ${isPos ? 'text-green-400' : 'text-red-400'}`}>
      ({isPos ? '+' : ''}{formatNumber(Math.round(value))}{suffix})
    </span>
  );
}

export default function ChampionStatBreakdownDrawer({ open, onOpenChange, calcResult, championName }: ChampionStatBreakdownDrawerProps) {
  const [activeTab, setActiveTab] = useState<StatTab>('atk');

  if (!calcResult) return null;
  const r = calcResult;

  const renderMultBreakdown = (statType: 'atk' | 'def' | 'hp') => {
    const config = STAT_TABS.find(t => t.key === statType)!;

    const rankBase = statType === 'atk' ? r.rankBaseAtk : statType === 'def' ? r.rankBaseDef : r.rankBaseHp;
    const promotedRankVal = statType === 'atk' ? r.promotedRankAtk : statType === 'def' ? r.promotedRankDef : r.promotedRankHp;
    const afterSoulMult = statType === 'atk' ? r.promotedAtk : statType === 'def' ? r.promotedDef : r.promotedHp;
    const nonPromotedBase = statType === 'atk' ? r.nonPromotedAtk : statType === 'def' ? r.nonPromotedDef : r.nonPromotedHp;

    const levelVal = statType === 'atk' ? r.levelAtk : statType === 'def' ? r.levelDef : r.levelHp;

    const seedRaw = statType === 'atk' ? r.seedAtk : statType === 'def' ? r.seedDef : r.seedHp;
    const seedFinal = statType === 'atk' ? r.seedAtkMult : statType === 'def' ? r.seedDefMult : r.seedHp;
    const seedMultLabel = statType === 'hp' ? '' : ' × 4';

    const equipTotal = statType === 'atk' ? r.totalEquipAtk : statType === 'def' ? r.totalEquipDef : r.totalEquipHp;
    const subtotal = statType === 'atk' ? r.subtotalAtk : statType === 'def' ? r.subtotalDef : r.subtotalHp;
    const final = statType === 'atk' ? r.finalAtk : statType === 'def' ? r.finalDef : r.finalHp;
    const nonPromotedFinal = statType === 'atk' ? r.nonPromotedFinalAtk : statType === 'def' ? r.nonPromotedFinalDef : r.nonPromotedFinalHp;

    const promotedDiff = r.promoted ? final - nonPromotedFinal : 0;

    return (
      <div className="flex flex-col gap-4 h-full overflow-y-auto">
        {/* Calculation steps */}
        <div className={`rounded-t ${config.headerBg} px-4 py-2`}>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <img src={config.icon} alt="" className="w-5 h-5" />
            {config.label} 계산 과정
          </h4>
        </div>

        <div className="px-4 space-y-4">
          {/* Step 1: Rank + Level base stat */}
          <div>
            <h5 className="text-xs font-semibold text-primary mb-1.5">① 기본 스탯 (랭크 + 레벨)</h5>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">랭크 {r.rank} {config.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-medium">{formatNumber(rankBase)}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">레벨 {r.level} {config.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-medium">{formatNumber(levelVal)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 text-foreground/70 font-medium">합계 (랭크 + 레벨)</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-bold">{formatNumber(rankBase + levelVal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Step 2: Champion Soul */}
          <div>
            <h5 className="text-xs font-semibold text-primary mb-1.5">
              ② 승급 (Champion Soul)
              {r.promoted && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-600/60 text-yellow-200">적용됨</span>}
              {!r.promoted && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-600/40 text-gray-400">미적용</span>}
            </h5>
            <table className="w-full text-xs">
              <tbody>
                {r.promoted ? (
                  <>
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 text-foreground/70">랭크 {r.rank}+2 = {r.rank + 2} 스탯</td>
                      <td className="py-1.5 text-right tabular-nums text-foreground">{formatNumber(promotedRankVal)}</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="py-1.5 text-foreground/70">× 1.5 배율</td>
                      <td className="py-1.5 text-right tabular-nums text-yellow-300 font-bold">{formatNumber(Math.round(afterSoulMult))}</td>
                    </tr>
                    <tr className="border-b border-yellow-500/30 bg-yellow-900/10">
                      <td className="py-1.5 text-yellow-300/80 font-medium">승급 효과</td>
                      <td className="py-1.5 text-right tabular-nums">
                        <DiffBadge value={afterSoulMult - nonPromotedBase} />
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-muted-foreground">승급 미적용 → {config.label} = {formatNumber(rankBase)}</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">{formatNumber(rankBase)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Promotion comparison */}
            {r.promoted && (
              <div className="mt-2 p-2 rounded border border-yellow-500/20 bg-yellow-900/10">
                <p className="text-[11px] text-yellow-200/80">
                  🏆 승급 전 기본 {config.label}: <span className="tabular-nums font-medium">{formatNumber(nonPromotedBase)}</span>
                  → 승급 후: <span className="tabular-nums font-bold text-yellow-300">{formatNumber(Math.round(afterSoulMult))}</span>
                  <DiffBadge value={afterSoulMult - nonPromotedBase} />
                </p>
              </div>
            )}
          </div>

          {/* Step 3: Equipment */}
          <div>
            <h5 className="text-xs font-semibold text-primary mb-1.5">③ 장비 스탯</h5>
            <table className="w-full text-xs">
              <tbody>
                {r.equipSlots.map((slot, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/70">
                      {slot.slotName}
                      {slot.itemName && (
                        <span className="text-muted-foreground ml-1">
                          ({slot.itemName} T{slot.tier}
                          {slot.qualityMult !== 1 && ` × ${slot.qualityMult}`})
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">
                      {slot.itemName ? (
                        <>
                          {statType === 'atk' ? formatNumber(slot.finalAtk) :
                           statType === 'def' ? formatNumber(slot.finalDef) :
                           formatNumber(slot.finalHp)}
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-border/50">
                  <td className="py-1.5 text-foreground/70 font-medium">장비 합계</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-bold">{formatNumber(equipTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Step 4: Seeds */}
          <div>
            <h5 className="text-xs font-semibold text-primary mb-1.5">④ 씨앗 보너스</h5>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">
                    씨앗 {config.label}
                    {seedMultLabel && <span className="text-muted-foreground">{seedMultLabel}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">
                    {seedRaw > 0 ? (
                      <>
                        {formatNumber(seedRaw)}{seedMultLabel ? ` = ${formatNumber(seedFinal)}` : ''}
                      </>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Step 5: Subtotal */}
          <div className="border-t-2 border-border/60 pt-2">
            <h5 className="text-xs font-semibold text-primary mb-1.5">⑤ 소계 (카드 보너스 적용 전)</h5>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70 text-[10px]">
                    승급스탯({formatNumber(Math.round(afterSoulMult))}) + 레벨({formatNumber(levelVal)}) + 장비({formatNumber(equipTotal)}) + 씨앗({formatNumber(seedFinal)})
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-bold">{formatNumber(Math.round(subtotal))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Step 6: Card level bonus */}
          <div>
            <h5 className="text-xs font-semibold text-primary mb-1.5">⑥ 카드 레벨 보너스</h5>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">
                    카드 LV {r.cardLevel} → +{r.cardLevelBonusPct}%
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">
                    × {(1 + r.cardLevelBonusPct / 100).toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-[10px] text-muted-foreground" colSpan={2}>
                    LV0: 0% | LV1: 5% | LV2: 10% | LV3: 25%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Final result */}
          <div className={`rounded ${config.headerBg} px-4 py-3`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                <img src={config.icon} alt="" className="w-5 h-5" />
                최종 {config.label}
              </span>
              <span className={`text-lg font-black tabular-nums ${config.color}`}>
                {formatNumber(final)}
              </span>
            </div>
            {r.promoted && (
              <div className="mt-1 text-[11px] text-yellow-200/70 flex items-center justify-between">
                <span>승급 미적용 시:</span>
                <span className="tabular-nums">
                  {formatNumber(nonPromotedFinal)}
                  <DiffBadge value={promotedDiff} />
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderOtherBreakdown = () => (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      <div className="rounded-t bg-gray-700/60 px-4 py-2">
        <h4 className="text-sm font-bold text-foreground">기타 스탯</h4>
      </div>
      <div className="px-4 space-y-4">
        {/* Crit */}
        <div>
          <h5 className="text-xs font-semibold text-yellow-300 mb-1.5 flex items-center gap-1">
            <img src={STAT_ICON_MAP.crit} alt="" className="w-4 h-4" /> 치명타 확률
          </h5>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1.5 text-foreground/70">기본 치명타 확률</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{r.fixedCrit}%</td>
              </tr>
              {r.totalEquipCrit > 0 && (
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">장비 치명타 확률</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">+{r.totalEquipCrit}%</td>
                </tr>
              )}
              <tr className="border-b border-primary/30">
                <td className="py-1.5 text-foreground font-medium">최종</td>
                <td className="py-1.5 text-right tabular-nums text-yellow-300 font-bold">{r.totalCrit}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Crit Dmg */}
        <div>
          <h5 className="text-xs font-semibold text-yellow-300 mb-1.5 flex items-center gap-1">
            <img src={STAT_ICON_MAP.critDmg} alt="" className="w-4 h-4" /> 치명타 대미지
          </h5>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1.5 text-foreground/70">치명타 대미지 계수</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{r.totalCritDmg}%</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5 text-foreground/70">치명타 공격력 (ATK × {r.totalCritDmg}%)</td>
                <td className="py-1.5 text-right tabular-nums text-yellow-300 font-bold">{formatNumber(r.critAttack)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Evasion */}
        <div>
          <h5 className="text-xs font-semibold text-teal-300 mb-1.5 flex items-center gap-1">
            <img src={STAT_ICON_MAP.evasion} alt="" className="w-4 h-4" /> 회피
          </h5>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1.5 text-foreground/70">기본 회피</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{r.fixedEvasion}%</td>
              </tr>
              {r.totalEquipEvasion > 0 && (
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">장비 회피</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">+{r.totalEquipEvasion}%</td>
                </tr>
              )}
              <tr className="border-b border-primary/30">
                <td className="py-1.5 text-foreground font-medium">최종</td>
                <td className="py-1.5 text-right tabular-nums text-teal-300 font-bold">{r.totalEvasion}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Threat */}
        <div>
          <h5 className="text-xs font-semibold text-purple-400 mb-1.5 flex items-center gap-1">
            <img src={STAT_ICON_MAP.threat} alt="" className="w-4 h-4" /> 위협도
          </h5>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-primary/30">
                <td className="py-1.5 text-foreground/70">기본 위협도 (고정)</td>
                <td className="py-1.5 text-right tabular-nums text-purple-400 font-bold">{r.totalThreat}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Element */}
        <div>
          <h5 className="text-xs font-semibold text-cyan-300 mb-1.5">원소</h5>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1.5 text-foreground/70">원소 종류</td>
                <td className="py-1.5 text-right text-foreground">{r.fixedElement || '-'}</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1.5 text-foreground/70">랭크 {r.rank} 원소량</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{r.rankBaseElement}</td>
              </tr>
              {r.promoted && (
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">승급 랭크 {r.rank + 2} 원소량</td>
                  <td className="py-1.5 text-right tabular-nums text-yellow-300">{r.promotedRankElement}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Promotion comparison summary */}
        {r.promoted && (
          <div className="rounded border border-yellow-500/30 bg-yellow-900/15 p-3">
            <h5 className="text-xs font-bold text-yellow-300 mb-2">🏆 승급 효과 요약</h5>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-yellow-500/30">
                  <th className="py-1 text-left text-yellow-200/60">스탯</th>
                  <th className="py-1 text-right text-yellow-200/60">승급 전</th>
                  <th className="py-1 text-right text-yellow-200/60">승급 후</th>
                  <th className="py-1 text-right text-yellow-200/60">차이</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'HP', before: r.nonPromotedFinalHp, after: r.finalHp },
                  { label: 'ATK', before: r.nonPromotedFinalAtk, after: r.finalAtk },
                  { label: 'DEF', before: r.nonPromotedFinalDef, after: r.finalDef },
                ].map(row => (
                  <tr key={row.label} className="border-b border-border/20">
                    <td className="py-1.5 text-foreground/80 font-medium">{row.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground/60">{formatNumber(row.before)}</td>
                    <td className="py-1.5 text-right tabular-nums text-yellow-300 font-bold">{formatNumber(row.after)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      <DiffBadge value={row.after - row.before} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle className="text-foreground flex items-center gap-2 text-lg">
            📊 챔피언 스탯 계산표 — {championName}
            {r.promoted && <span className="text-xs px-2 py-0.5 rounded bg-yellow-600/60 text-yellow-200">승급</span>}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm">
            랭크 {r.rank} | 레벨 {r.level} | 카드 LV {r.cardLevel} (+{r.cardLevelBonusPct}%)
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as StatTab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start shrink-0">
            {STAT_TABS.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 text-xs">
                {tab.icon && <img src={tab.icon} alt="" className="w-4 h-4" />}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto mt-2">
            {activeTab === 'atk' && renderMultBreakdown('atk')}
            {activeTab === 'def' && renderMultBreakdown('def')}
            {activeTab === 'hp' && renderMultBreakdown('hp')}
            {activeTab === 'other' && renderOtherBreakdown()}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
