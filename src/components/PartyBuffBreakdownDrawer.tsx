import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { STAT_ICON_MAP } from '@/types/game';
import { Hero } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { type PartyBuffSummary, type PartyBuffSource, type BuffedHeroStats } from '@/lib/partyBuffCalculator';

interface PartyBuffBreakdownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroes: Hero[];
  buffSummary: PartyBuffSummary | null;
  buffedStats: BuffedHeroStats[];
}

type StatTab = 'atk' | 'def' | 'hp' | 'crit' | 'evasion' | 'threat';

const STAT_TABS: { key: StatTab; label: string; icon: string; color: string; headerBg: string }[] = [
  { key: 'atk', label: '공격력', icon: STAT_ICON_MAP.atk, color: 'text-red-400', headerBg: 'bg-red-900/60' },
  { key: 'def', label: '방어력', icon: STAT_ICON_MAP.def, color: 'text-blue-400', headerBg: 'bg-blue-900/60' },
  { key: 'hp', label: '체력', icon: STAT_ICON_MAP.hp, color: 'text-orange-400', headerBg: 'bg-[#ff7f00]/40' },
  { key: 'crit', label: '치명타', icon: STAT_ICON_MAP.crit, color: 'text-yellow-300', headerBg: 'bg-yellow-500/30' },
  { key: 'evasion', label: '회피', icon: STAT_ICON_MAP.evasion, color: 'text-teal-300', headerBg: 'bg-teal-600/30' },
  { key: 'threat', label: '위협도', icon: STAT_ICON_MAP.threat, color: 'text-purple-400', headerBg: 'bg-purple-900/60' },
];

function isMercenary(hero: Hero): boolean {
  return (hero.heroClass || '') === '용병';
}

function hasLoneWolfCowl(hero: Hero): boolean {
  return hero.equipmentSlots?.some(s => s.item?.name === '고독한 늑대 두건') || false;
}

function getClassLineKor(hero: Hero): string {
  if (hero.classLine) return hero.classLine;
  return '';
}

function getSourcePctForStat(src: PartyBuffSource, stat: StatTab): number {
  switch (stat) {
    case 'atk': return src.atkPct || 0;
    case 'def': return src.defPct || 0;
    case 'hp': return src.hpPct || 0;
    case 'crit': return src.critPct || 0;
    case 'evasion': return src.evaPct || 0;
    default: return 0;
  }
}

function getSourceFlatForStat(src: PartyBuffSource, stat: StatTab): number {
  switch (stat) {
    case 'atk': return src.flatAtk || 0;
    case 'def': return src.flatDef || 0;
    case 'hp': return src.flatHp || 0;
    default: return 0;
  }
}

export default function PartyBuffBreakdownDrawer({ open, onOpenChange, heroes, buffSummary, buffedStats }: PartyBuffBreakdownDrawerProps) {
  const [activeTab, setActiveTab] = useState<StatTab>('atk');

  if (!buffSummary || heroes.length === 0) return null;

  const config = STAT_TABS.find(t => t.key === activeTab)!;
  const isMultStat = activeTab === 'atk' || activeTab === 'def' || activeTab === 'hp';

  const getBaseVal = (hero: Hero): number => {
    switch (activeTab) {
      case 'atk': return hero.atk || 0;
      case 'def': return hero.def || 0;
      case 'hp': return hero.hp || 0;
      case 'crit': return hero.crit || 0;
      case 'evasion': return hero.evasion || 0;
      case 'threat': return hero.threat || 0;
    }
  };

  const getBuffedVal = (bs: BuffedHeroStats): number => {
    switch (activeTab) {
      case 'atk': return bs.atk;
      case 'def': return bs.def;
      case 'hp': return bs.hp;
      case 'crit': return bs.crit;
      case 'evasion': return bs.evasion;
      case 'threat': return bs.threat;
    }
  };

  const getDelta = (bs: BuffedHeroStats): number => {
    switch (activeTab) {
      case 'atk': return bs.deltaAtk;
      case 'def': return bs.deltaDef;
      case 'hp': return bs.deltaHp;
      case 'crit': return bs.deltaCrit;
      case 'evasion': return bs.deltaEvasion;
      default: return 0;
    }
  };

  // Sources that affect this stat
  const relevantSources = buffSummary.sources.filter(src => {
    const pct = getSourcePctForStat(src, activeTab);
    const flat = getSourceFlatForStat(src, activeTab);
    if (activeTab === 'crit' && src.critDmgPct) return true;
    return pct !== 0 || flat !== 0;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col bg-card border-t border-primary/30">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle className="text-foreground flex items-center gap-2">
            📊 파티 버프 스탯 계산표
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-xs">
            파티 버프(챔피언 리더스킬, 오라의 노래) 적용 전후 스탯 비교
          </SheetDescription>
        </SheetHeader>

        {/* Stat tabs */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as StatTab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0 mb-3 bg-secondary/50 p-1 flex gap-0.5 overflow-x-auto">
            {STAT_TABS.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1 text-xs px-2 py-1.5 data-[state=active]:bg-primary/20">
                {tab.icon && <img src={tab.icon} alt="" className="w-4 h-4" />}
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Header: stat color bar */}
            <div className={`${config.headerBg} rounded-t-lg px-3 py-2 flex items-center gap-2`}>
              {config.icon && <img src={config.icon} alt="" className="w-5 h-5" />}
              <span className={`font-bold text-sm ${config.color}`}>{config.label} 파티 버프 상세</span>
            </div>

            <div className="bg-secondary/30 rounded-b-lg overflow-x-auto">
              <table className="w-full text-xs">
                <colgroup>
                  <col className="w-32" />
                  {heroes.map(h => <col key={h.id} />)}
                </colgroup>
                {/* Hero names header */}
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="py-2 px-2 text-left text-muted-foreground font-normal">항목</th>
                    {heroes.map(h => (
                      <th key={h.id} className="py-2 px-2 text-center">
                        <div className="text-foreground font-medium text-[11px]">{h.name}</div>
                        <div className="text-muted-foreground text-[9px]">
                          {h.heroClass || h.championName || ''}
                          {isMercenary(h) && <span className="text-yellow-400 ml-0.5">(용병)</span>}
                          {hasLoneWolfCowl(h) && <span className="text-red-400 ml-0.5">(고독)</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Base stat (개인 스탯) */}
                  <tr className="border-b border-border/20">
                    <td className="py-1.5 px-2 text-muted-foreground">
                      개인 스탯
                      <span className="text-[9px] text-muted-foreground/60 block">
                        (장비/스킬/영혼 포함)
                      </span>
                    </td>
                    {heroes.map(h => (
                      <td key={h.id} className={`py-1.5 px-2 text-center font-mono ${config.color}`}>
                        {isMultStat || activeTab === 'threat'
                          ? formatNumber(getBaseVal(h))
                          : `${getBaseVal(h)}%`
                        }
                      </td>
                    ))}
                  </tr>

                  {/* Buff source rows - show each source's raw % contribution */}
                  {relevantSources.map((src, srcIdx) => {
                    const isChamp = src.type === 'champion';
                    const icon = isChamp ? '👑' : '🎵';
                    const tagClass = isChamp ? 'bg-yellow-600/60' : 'bg-purple-600/60';
                    const pctVal = getSourcePctForStat(src, activeTab);
                    const flatVal = getSourceFlatForStat(src, activeTab);

                    return (
                      <tr key={srcIdx} className="border-b border-border/20 bg-primary/5">
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1">
                            <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${tagClass} text-foreground`}>
                              {icon} {isChamp ? '챔피언' : '오라'}
                            </span>
                          </div>
                          <div className="text-[9px] text-foreground/70 mt-0.5 leading-tight">{src.name}</div>
                          {src.note && <div className="text-[8px] text-muted-foreground">{src.note}</div>}
                        </td>
                        {heroes.map((h) => {
                          const hasLW = hasLoneWolfCowl(h);
                          const isMerc = isMercenary(h);
                          const champMod = hasLW ? 0 : 1;
                          const effectivePct = isChamp ? pctVal * champMod : pctVal;

                          if (isMultStat) {
                            return (
                              <td key={h.id} className="py-1.5 px-2 text-center">
                                {hasLW && isChamp ? (
                                  <span className="text-red-400 text-[9px]">무효</span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {effectivePct !== 0 && (
                                      <div className="text-green-400/80 text-[10px] font-mono">
                                        +{effectivePct.toFixed(1)}%
                                      </div>
                                    )}
                                    {flatVal !== 0 && (
                                      <div className="text-green-400/70 text-[9px] font-mono">
                                        +{formatNumber(flatVal)} (깡)
                                      </div>
                                    )}
                                    {effectivePct === 0 && flatVal === 0 && (
                                      <span className="text-muted-foreground text-[9px]">-</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          } else {
                            return (
                              <td key={h.id} className="py-1.5 px-2 text-center">
                                {hasLW && isChamp ? (
                                  <span className="text-red-400 text-[9px]">무효</span>
                                ) : effectivePct !== 0 ? (
                                  <div className="text-green-400/80 text-[10px] font-mono">
                                    +{effectivePct.toFixed(1)}%
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-[9px]">-</span>
                                )}
                              </td>
                            );
                          }
                        })}
                      </tr>
                    );
                  })}

                  {/* Combined multiplier row - shows total additive % and final multiplier */}
                  {isMultStat && relevantSources.length > 0 && (
                    <tr className="border-b border-border/20 bg-green-900/20">
                      <td className="py-1.5 px-2">
                        <div className="text-foreground text-[10px] font-semibold">합산 배율</div>
                        <div className="text-[8px] text-muted-foreground">(1 + Σ버프%)</div>
                      </td>
                      {heroes.map((h) => {
                        const hasLW = hasLoneWolfCowl(h);
                        const isMerc = isMercenary(h);
                        const mercMult = isMerc ? 1.25 : 1.0;
                        const champMod = hasLW ? 0 : 1;

                        let totalPct = 0;
                        let totalFlat = 0;
                        relevantSources.forEach(src => {
                          const pct = getSourcePctForStat(src, activeTab);
                          const flat = getSourceFlatForStat(src, activeTab);
                          totalPct += src.type === 'champion' ? pct * champMod : pct;
                          totalFlat += flat;
                        });
                        const effectiveTotalPct = totalPct * mercMult;
                        const baseVal = getBaseVal(h);
                        const addedFromPct = Math.floor(baseVal * effectiveTotalPct / 100);

                        return (
                          <td key={h.id} className="py-1.5 px-2 text-center">
                            <div className="space-y-0.5">
                              <div className="text-green-400 text-[11px] font-mono font-bold">
                                ×{(1 + effectiveTotalPct / 100).toFixed(3)}
                              </div>
                              <div className="text-muted-foreground text-[9px] font-mono">
                                (+{effectiveTotalPct.toFixed(1)}%)
                              </div>
                              <div className="text-green-400/70 text-[9px] font-mono">
                                +{formatNumber(addedFromPct)}
                                {totalFlat !== 0 && <span> +{formatNumber(totalFlat)}깡</span>}
                              </div>
                              {isMerc && (
                                <div className="text-yellow-400 text-[8px]">용병 ×1.25 적용</div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* Combined additive row for crit/eva */}
                  {!isMultStat && activeTab !== 'threat' && relevantSources.length > 0 && (
                    <tr className="border-b border-border/20 bg-green-900/20">
                      <td className="py-1.5 px-2">
                        <div className="text-foreground text-[10px] font-semibold">합산 보너스</div>
                      </td>
                      {heroes.map((h) => {
                        const hasLW = hasLoneWolfCowl(h);
                        const isMerc = isMercenary(h);
                        const mercMult = isMerc ? 1.25 : 1.0;
                        const champMod = hasLW ? 0 : 1;

                        let totalPct = 0;
                        relevantSources.forEach(src => {
                          const pct = getSourcePctForStat(src, activeTab);
                          totalPct += src.type === 'champion' ? pct * champMod : pct;
                        });
                        const effectiveTotal = totalPct * mercMult;

                        return (
                          <td key={h.id} className="py-1.5 px-2 text-center">
                            <div className="text-green-400 text-[11px] font-mono font-bold">
                              +{effectiveTotal.toFixed(1)}%
                            </div>
                            {isMerc && (
                              <div className="text-yellow-400 text-[8px]">용병 ×1.25 적용</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* Crit damage row (only on crit tab) */}
                  {activeTab === 'crit' && buffSummary.sources.some(s => s.critDmgPct) && (
                    <tr className="border-b border-border/20 bg-primary/5">
                      <td className="py-1.5 px-2">
                        <div className="text-muted-foreground text-[10px]">치명타 대미지</div>
                      </td>
                      {heroes.map((h, hi) => {
                        const bs = buffedStats[hi];
                        const critDmgDelta = bs ? bs.deltaCritDmg : 0;
                        return (
                          <td key={h.id} className="py-1.5 px-2 text-center">
                            {critDmgDelta !== 0 ? (
                              <div className="space-y-0.5">
                                <div className="text-[9px] text-muted-foreground font-mono">{h.critDmg}%</div>
                                <div className="text-green-400 text-[10px] font-mono">+{critDmgDelta}%</div>
                                <div className="text-yellow-300 text-[10px] font-mono font-bold">{bs!.critDmg}%</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[9px]">{h.critDmg}%</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* No buffs message for this stat */}
                  {relevantSources.length === 0 && activeTab !== 'crit' && (
                    <tr>
                      <td colSpan={heroes.length + 1} className="py-4 text-center text-muted-foreground text-xs">
                        이 스탯에 대한 파티 버프가 없습니다
                      </td>
                    </tr>
                  )}

                  {/* Separator */}
                  <tr><td colSpan={heroes.length + 1} className="h-1" /></tr>

                  {/* Final buffed stat */}
                  <tr className={`${config.headerBg} border-t border-border/40`}>
                    <td className="py-2 px-2 font-bold text-foreground text-[11px]">
                      최종 (버프 적용)
                    </td>
                    {heroes.map((h, hi) => {
                      const bs = buffedStats[hi];
                      if (!bs) return <td key={h.id} />;
                      const finalVal = getBuffedVal(bs);
                      const delta = getDelta(bs);
                      const suffix = isMultStat || activeTab === 'threat' ? '' : '%';

                      return (
                        <td key={h.id} className="py-2 px-2 text-center">
                          <div className={`font-bold font-mono text-sm ${config.color}`}>
                            {suffix ? `${finalVal}${suffix}` : formatNumber(finalVal)}
                          </div>
                          {delta !== 0 && (
                            <div className={`text-[9px] font-mono ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {delta > 0 ? '+' : ''}{suffix ? `${delta}${suffix}` : formatNumber(delta)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Crit attack row (only on crit tab) */}
                  {activeTab === 'crit' && (
                    <tr className="border-t border-border/20 bg-yellow-900/20">
                      <td className="py-2 px-2 text-foreground text-[11px]">
                        <div className="flex items-center gap-1">
                          <img src={STAT_ICON_MAP.critAttack} alt="" className="w-4 h-4" />
                          <span className="font-medium">치명타 공격력</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground">(ATK × 치댐%)</span>
                      </td>
                      {heroes.map((h, hi) => {
                        const bs = buffedStats[hi];
                        if (!bs) return <td key={h.id} />;
                        const critAtk = Math.floor(bs.atk * bs.critDmg / 100);
                        const baseCritAtk = Math.floor((h.atk || 0) * (h.critDmg || 0) / 100);
                        const delta = critAtk - baseCritAtk;
                        return (
                          <td key={h.id} className="py-2 px-2 text-center">
                            <div className="font-bold font-mono text-sm text-yellow-300">{formatNumber(critAtk)}</div>
                            {delta !== 0 && (
                              <div className="text-[9px] text-green-400 font-mono">+{formatNumber(delta)}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Buff sources summary */}
            <div className="mt-4 px-2">
              <div className="text-[10px] text-muted-foreground font-medium mb-2">적용된 파티 버프 소스</div>
              <div className="flex flex-wrap gap-2">
                {buffSummary.sources.map((src, i) => {
                  const isChamp = src.type === 'champion';
                  const parts: string[] = [];
                  if (src.atkPct) parts.push(`공격력 +${src.atkPct}%`);
                  if (src.defPct) parts.push(`방어력 +${src.defPct}%`);
                  if (src.hpPct) parts.push(`체력 +${src.hpPct}%`);
                  if (src.critPct) parts.push(`치확 +${src.critPct}%`);
                  if (src.evaPct) parts.push(`회피 +${src.evaPct}%`);
                  if (src.critDmgPct) parts.push(`치댐 +${src.critDmgPct}%`);
                  if (src.flatAtk) parts.push(`깡공 +${src.flatAtk}`);
                  if (src.flatDef) parts.push(`깡방 +${src.flatDef}`);
                  if (src.flatHp) parts.push(`깡체 +${src.flatHp}`);

                  return (
                    <div key={i} className="bg-secondary/50 border border-border/30 rounded-lg px-3 py-2 text-[10px]">
                      <div className="flex items-center gap-1 mb-1">
                        <span className={isChamp ? 'text-yellow-400' : 'text-purple-400'}>
                          {isChamp ? '👑' : '🎵'}
                        </span>
                        <span className="text-foreground font-medium">{src.name}</span>
                      </div>
                      <div className="text-muted-foreground leading-relaxed">
                        {parts.join(', ')}
                        {src.note && <span className="text-primary/60 ml-1">({src.note})</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
