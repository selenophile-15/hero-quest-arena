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
  hasEvasionPenalty?: boolean;
}

type StatTab = 'atk' | 'def' | 'hp' | 'hpRegen' | 'critChance' | 'critDmg' | 'evasion';

const STAT_TABS: { key: StatTab; label: string; icon: string; color: string; headerBg: string }[] = [
  { key: 'atk', label: '공격력', icon: STAT_ICON_MAP.atk, color: 'text-red-400', headerBg: 'bg-red-900/60' },
  { key: 'def', label: '방어력', icon: STAT_ICON_MAP.def, color: 'text-blue-400', headerBg: 'bg-blue-900/60' },
  { key: 'hp', label: '체력', icon: STAT_ICON_MAP.hp, color: 'text-orange-400', headerBg: 'bg-[#ff7f00]/40' },
  { key: 'hpRegen', label: '체력 재생', icon: STAT_ICON_MAP.hp, color: 'text-green-400', headerBg: 'bg-green-900/40' },
  { key: 'critChance', label: '치명타 확률', icon: STAT_ICON_MAP.crit, color: 'text-yellow-300', headerBg: 'bg-yellow-500/30' },
  { key: 'critDmg', label: '치명타 대미지', icon: STAT_ICON_MAP.critDmg, color: 'text-orange-300', headerBg: 'bg-orange-500/30' },
  { key: 'evasion', label: '회피', icon: STAT_ICON_MAP.evasion, color: 'text-teal-300', headerBg: 'bg-teal-600/30' },
];

// Spirit names that provide per-turn HP regen
const REGEN_SPIRIT_NAMES: Record<string, Record<string, number>> = {
  '도마뱀': { 'X': 3, 'O': 5 },
  '우로보로스': { 'X': 4, 'O': 6 },
};

function getHeroRegenSources(hero: Hero): { source: string; value: number }[] {
  const sources: { source: string; value: number }[] = [];
  
  // Check spirits on equipment
  hero.equipmentSlots?.forEach((slot: any) => {
    if (!slot.spirit?.name) return;
    const spiritName = slot.spirit.name;
    const regenData = REGEN_SPIRIT_NAMES[spiritName];
    if (regenData) {
      const affKey = slot.spirit.affinity ? 'O' : 'X';
      sources.push({ source: `${spiritName} 영혼${slot.spirit.affinity ? '(친밀)' : ''}`, value: regenData[affKey] || 0 });
    }
  });
  
  // Check class-based regen (cleric/bishop innate skill)
  const cls = hero.heroClass || '';
  if (cls.includes('성직자') || cls.includes('클레릭')) {
    // Cleric regen from innate: tier 2=5, tier 3=10
    const tier = hero.promoted ? 3 : hero.level >= 25 ? 2 : 1;
    const regen = Math.min(tier, 3) * 5 - 5;
    if (regen > 0) sources.push({ source: `${cls} 고유 스킬`, value: regen });
  } else if (cls.includes('비숍') || cls.includes('주교')) {
    const tier = hero.promoted ? 4 : hero.level >= 35 ? 3 : hero.level >= 25 ? 2 : 1;
    const regen = tier >= 3 ? 20 : tier >= 2 ? 5 : 0;
    if (regen > 0) sources.push({ source: `${cls} 고유 스킬`, value: regen });
  }
  
  // Check skills for 매턴체력회복
  // Skills are stored as string names; we'd need skill data lookup
  // For now, skills with regen are identified by the class skill having 스킬_매턴체력회복
  
  return sources;
}

function isMercenary(hero: Hero): boolean {
  return (hero.heroClass || '') === '용병';
}

function hasLoneWolfCowl(hero: Hero): boolean {
  return hero.equipmentSlots?.some(s => s.item?.name === '고독한 늑대 두건') || false;
}

function getSourcePctForStat(src: PartyBuffSource, stat: StatTab): number {
  switch (stat) {
    case 'atk': return src.atkPct || 0;
    case 'def': return src.defPct || 0;
    case 'hp': return src.hpPct || 0;
    case 'critChance': return src.critPct || 0;
    case 'critDmg': return src.critDmgPct || 0;
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

function isBoosterSource(src: PartyBuffSource): boolean {
  return src.note === '부스터';
}

export default function PartyBuffBreakdownDrawer({ open, onOpenChange, heroes, buffSummary, buffedStats, hasEvasionPenalty }: PartyBuffBreakdownDrawerProps) {
  const [activeTab, setActiveTab] = useState<StatTab>('atk');

  if (!buffSummary || heroes.length === 0) return null;

  const config = STAT_TABS.find(t => t.key === activeTab)!;
  const isMultStat = activeTab === 'atk' || activeTab === 'def' || activeTab === 'hp';

  const getBaseVal = (hero: Hero): number => {
    switch (activeTab) {
      case 'atk': return hero.atk || 0;
      case 'def': return hero.def || 0;
      case 'hp': return hero.hp || 0;
      case 'critChance': return hero.crit || 0;
      case 'critDmg': return hero.critDmg || 0;
      case 'evasion': return hero.evasion || 0;
      default: return 0;
    }
  };

  const getBuffedVal = (bs: BuffedHeroStats): number => {
    switch (activeTab) {
      case 'atk': return bs.atk;
      case 'def': return bs.def;
      case 'hp': return bs.hp;
      case 'critChance': return bs.crit;
      case 'critDmg': return bs.critDmg;
      case 'evasion': return bs.evasion;
      default: return 0;
    }
  };

  const getDelta = (bs: BuffedHeroStats): number => {
    switch (activeTab) {
      case 'atk': return bs.deltaAtk;
      case 'def': return bs.deltaDef;
      case 'hp': return bs.deltaHp;
      case 'critChance': return bs.deltaCrit;
      case 'critDmg': return bs.deltaCritDmg;
      case 'evasion': return bs.deltaEvasion;
      default: return 0;
    }
  };

  // Sources that affect this stat
  const relevantSources = buffSummary.sources.filter(src => {
    const pct = getSourcePctForStat(src, activeTab);
    const flat = getSourceFlatForStat(src, activeTab);
    return pct !== 0 || flat !== 0;
  });

  // HP Regen detection
  const liluChampion = heroes.find(h => h.type === 'champion' && (h.championName?.includes('릴루') || h.name?.includes('릴루')));
  const liluTier = liluChampion ? (liluChampion.cardLevel || 1) : 0;
  const liluHealPct = liluTier === 4 ? 20 : liluTier === 3 ? 10 : liluTier === 2 ? 5 : liluTier === 1 ? 3 : 0;
  const healerHeroes = heroes.filter(h => {
    const cls = h.heroClass || '';
    return cls.includes('클레릭') || cls.includes('성직자') || cls.includes('비숍') || cls.includes('주교');
  });

  // HP Regen tab content
  if (activeTab === 'hpRegen') {
    const liluChampion = heroes.find(h => h.type === 'champion' && (h.championName?.includes('릴루') || h.name?.includes('릴루')));
    const liluTier = liluChampion ? (liluChampion.cardLevel || 1) : 0;
    const liluHealPct = liluTier === 4 ? 20 : liluTier === 3 ? 10 : liluTier === 2 ? 5 : liluTier === 1 ? 3 : 0;

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col bg-card border-t border-primary/30">
          <SheetHeader className="shrink-0 pb-2">
            <SheetTitle className="text-foreground flex items-center gap-2 text-lg">
              📊 파티 버프 스탯 계산표
            </SheetTitle>
            <SheetDescription className="text-muted-foreground text-sm">
              파티 버프(챔피언 리더스킬, 오라의 노래, 부스터) 적용 전후 스탯 비교
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as StatTab)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="shrink-0 mb-3 bg-secondary/50 p-1 flex gap-0.5 overflow-x-auto">
              {STAT_TABS.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 text-sm px-3 py-2 data-[state=active]:bg-primary/20">
                  {tab.icon && <img src={tab.icon} alt="" className="w-5 h-5" />}
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <div className={`${config.headerBg} rounded-t-lg px-4 py-3 flex items-center gap-2`}>
                {config.icon && <img src={config.icon} alt="" className="w-6 h-6" />}
                <span className={`font-bold text-base ${config.color}`}>{config.label} - 전투 중 회복</span>
              </div>
              <div className="bg-secondary/30 rounded-b-lg p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-2 text-muted-foreground font-normal w-36">소스</th>
                      {heroes.map(h => (
                        <th key={h.id} className="text-center py-2">
                          <div className="text-foreground font-medium text-sm">{h.name}</div>
                          <div className="text-muted-foreground text-xs">{h.heroClass || h.championName || ''}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Lilu row */}
                    {liluChampion && (
                      <tr className="border-b border-border/20">
                        <td className="py-2 px-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-yellow-400">👑</span>
                            <span className="text-foreground font-medium">릴루 (LV.{liluTier})</span>
                          </div>
                          <div className="text-xs text-green-400">매턴 최대HP {liluHealPct}%</div>
                        </td>
                        {heroes.map((h, hi) => {
                          const bs = buffedStats[hi];
                          const maxHp = bs ? bs.hp : (h.hp || 0);
                          const hasLW = hasLoneWolfCowl(h);
                          const healPerRound = hasLW ? 0 : Math.floor(maxHp * liluHealPct / 100);
                          return (
                            <td key={h.id} className="py-2 text-center font-mono">
                              {hasLW ? (
                                <span className="text-red-400 text-xs">무효</span>
                              ) : (
                                <span className="text-green-400">+{formatNumber(healPerRound)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )}
                    
                    {/* Per-hero regen sources (spirits, class skills) */}
                    {(() => {
                      const allSources = heroes.map(h => getHeroRegenSources(h));
                      const uniqueSourceNames = [...new Set(allSources.flat().map(s => s.source))];
                      
                      return uniqueSourceNames.map(srcName => (
                        <tr key={srcName} className="border-b border-border/20">
                          <td className="py-2 px-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-purple-400">🔮</span>
                              <span className="text-foreground font-medium text-sm">{srcName}</span>
                            </div>
                          </td>
                          {heroes.map((h, hi) => {
                            const heroSources = allSources[hi];
                            const match = heroSources.find(s => s.source === srcName);
                            return (
                              <td key={h.id} className="py-2 text-center font-mono">
                                {match ? (
                                  <span className="text-green-400">+{match.value}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}

                    {/* Total row */}
                    <tr className={`${config.headerBg} border-t border-border/40`}>
                      <td className="py-2.5 px-1 font-bold text-foreground">총 매턴 회복</td>
                      {heroes.map((h, hi) => {
                        const bs = buffedStats[hi];
                        const maxHp = bs ? bs.hp : (h.hp || 0);
                        const hasLW = hasLoneWolfCowl(h);
                        let total = 0;
                        if (liluChampion && !hasLW) total += Math.floor(maxHp * liluHealPct / 100);
                        const heroSources = getHeroRegenSources(h);
                        heroSources.forEach(s => total += s.value);
                        return (
                          <td key={h.id} className="py-2.5 text-center font-mono font-bold text-green-400 text-lg">
                            +{formatNumber(total)}
                          </td>
                        );
                      })}
                    </tr>

                    {!liluChampion && heroes.every(h => getHeroRegenSources(h).length === 0) && (
                      <tr>
                        <td colSpan={heroes.length + 1} className="py-6 text-center text-muted-foreground text-sm">
                          체력 재생 소스가 파티에 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col bg-card border-t border-primary/30">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle className="text-foreground flex items-center gap-2 text-lg">
            📊 파티 버프 스탯 계산표
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm">
            파티 버프(챔피언 리더스킬, 오라의 노래, 부스터) 적용 전후 스탯 비교
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as StatTab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0 mb-3 bg-secondary/50 p-1 flex gap-0.5 overflow-x-auto">
            {STAT_TABS.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 text-sm px-3 py-2 data-[state=active]:bg-primary/20">
                {tab.icon && <img src={tab.icon} alt="" className="w-5 h-5" />}
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Header: stat color bar */}
            <div className={`${config.headerBg} rounded-t-lg px-4 py-3 flex items-center gap-2`}>
              {config.icon && <img src={config.icon} alt="" className="w-6 h-6" />}
              <span className={`font-bold text-base ${config.color}`}>{config.label} 파티 버프 상세</span>
            </div>

            <div className="bg-secondary/30 rounded-b-lg overflow-x-auto">
              <table className="w-full text-sm">
                <colgroup>
                  <col className="w-36" />
                  {heroes.map(h => <col key={h.id} />)}
                </colgroup>
                {/* Hero names header */}
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="py-2.5 px-3 text-left text-muted-foreground font-normal">항목</th>
                    {heroes.map(h => (
                      <th key={h.id} className="py-2.5 px-2 text-center">
                        <div className="text-foreground font-medium text-sm">{h.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {h.heroClass || h.championName || ''}
                          {isMercenary(h) && <span className="text-yellow-400 ml-1">(용병)</span>}
                          {hasLoneWolfCowl(h) && <span className="text-red-400 ml-1">(고독)</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Base stat */}
                  <tr className="border-b border-border/20">
                    <td className="py-2 px-3 text-muted-foreground">
                      개인 스탯
                      <span className="text-xs text-muted-foreground/60 block">
                        (장비/스킬/영혼 포함)
                      </span>
                    </td>
                    {heroes.map(h => (
                      <td key={h.id} className={`py-2 px-2 text-center font-mono text-sm ${config.color}`}>
                        {isMultStat
                          ? formatNumber(getBaseVal(h))
                          : `${getBaseVal(h)}%`
                        }
                      </td>
                    ))}
                  </tr>

                  {/* Buff source rows */}
                  {relevantSources.map((src, srcIdx) => {
                    const isChamp = src.type === 'champion';
                    const isBooster = isBoosterSource(src);
                    const icon = isBooster ? '⚡' : isChamp ? '👑' : '🎵';
                    const tagClass = isBooster ? 'bg-green-600/60' : isChamp ? 'bg-yellow-600/60' : 'bg-purple-600/60';
                    const tagLabel = isBooster ? '부스터' : isChamp ? '챔피언' : '오라';
                    const pctVal = getSourcePctForStat(src, activeTab);
                    const flatVal = getSourceFlatForStat(src, activeTab);

                    return (
                      <tr key={srcIdx} className="border-b border-border/20 bg-primary/5">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${tagClass} text-foreground`}>
                              {icon} {tagLabel}
                            </span>
                          </div>
                          <div className="text-xs text-foreground/70 mt-1 leading-tight">{src.name}</div>
                          {src.note && !isBooster && <div className="text-xs text-muted-foreground">{src.note}</div>}
                        </td>
                        {heroes.map((h) => {
                          const hasLW = hasLoneWolfCowl(h);
                          const champMod = hasLW ? 0 : 1;
                          const effectivePct = isChamp ? pctVal * champMod : pctVal;

                          if (isMultStat) {
                            return (
                              <td key={h.id} className="py-2 px-2 text-center">
                                {hasLW && isChamp ? (
                                  <span className="text-red-400 text-xs">무효</span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {effectivePct !== 0 && (
                                      <div className="text-green-400/80 text-sm font-mono">
                                        +{effectivePct.toFixed(1)}%
                                      </div>
                                    )}
                                    {flatVal !== 0 && (
                                      <div className="text-green-400/70 text-xs font-mono">
                                        +{formatNumber(flatVal)} (깡)
                                      </div>
                                    )}
                                    {effectivePct === 0 && flatVal === 0 && (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          } else {
                            return (
                              <td key={h.id} className="py-2 px-2 text-center">
                                {hasLW && isChamp ? (
                                  <span className="text-red-400 text-xs">무효</span>
                                ) : effectivePct !== 0 ? (
                                  <div className="text-green-400/80 text-sm font-mono">
                                    +{effectivePct.toFixed(1)}%
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </td>
                            );
                          }
                        })}
                      </tr>
                    );
                  })}

                  {/* Combined multiplier row for mult stats */}
                  {isMultStat && relevantSources.length > 0 && (
                    <tr className="border-b border-border/20 bg-green-900/20">
                      <td className="py-2 px-3">
                        <div className="text-foreground text-sm font-semibold">합산 배율</div>
                        <div className="text-xs text-muted-foreground">(1 + Σ버프%)</div>
                      </td>
                      {heroes.map((h) => {
                        const hasLW = hasLoneWolfCowl(h);
                        const isMerc = isMercenary(h);
                        const mercMult = isMerc ? 1.25 : 1.0;
                        const champMod = hasLW ? 0 : 1;

                        let champAuraPct = 0;
                        let boosterPct = 0;
                        let totalFlat = 0;
                        relevantSources.forEach(src => {
                          const pct = getSourcePctForStat(src, activeTab);
                          const flat = getSourceFlatForStat(src, activeTab);
                          if (isBoosterSource(src)) {
                            boosterPct += pct;
                          } else {
                            champAuraPct += src.type === 'champion' ? pct * champMod : pct;
                          }
                          totalFlat += flat;
                        });
                        const effectiveTotalPct = champAuraPct * mercMult + boosterPct;
                        const baseVal = getBaseVal(h);
                        const addedFromPct = Math.floor(baseVal * effectiveTotalPct / 100);

                        return (
                          <td key={h.id} className="py-2 px-2 text-center">
                            <div className="space-y-0.5">
                              <div className="text-green-400 text-base font-mono font-bold">
                                ×{(1 + effectiveTotalPct / 100).toFixed(3)}
                              </div>
                              <div className="text-muted-foreground text-xs font-mono">
                                (+{effectiveTotalPct.toFixed(1)}%)
                              </div>
                              {isMerc && (
                                <div className="text-yellow-400 text-xs">용병 ×1.25 적용</div>
                              )}
                              {isMerc && boosterPct > 0 && (
                                <div className="text-green-300 text-xs">부스터 {boosterPct}% (용병 미적용)</div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* Combined additive row for crit/eva */}
                  {!isMultStat && relevantSources.length > 0 && (
                    <tr className="border-b border-border/20 bg-green-900/20">
                      <td className="py-2 px-3">
                        <div className="text-foreground text-sm font-semibold">합산 보너스</div>
                      </td>
                      {heroes.map((h) => {
                        const hasLW = hasLoneWolfCowl(h);
                        const isMerc = isMercenary(h);
                        const mercMult = isMerc ? 1.25 : 1.0;
                        const champMod = hasLW ? 0 : 1;

                        let champAuraPct = 0;
                        let boosterPct = 0;
                        relevantSources.forEach(src => {
                          const pct = getSourcePctForStat(src, activeTab);
                          if (isBoosterSource(src)) {
                            boosterPct += pct;
                          } else {
                            champAuraPct += src.type === 'champion' ? pct * champMod : pct;
                          }
                        });
                        const effectiveTotal = champAuraPct * mercMult + boosterPct;

                        return (
                          <td key={h.id} className="py-2 px-2 text-center">
                            <div className="text-green-400 text-base font-mono font-bold">
                              +{effectiveTotal.toFixed(1)}%
                            </div>
                            {isMerc && (
                              <div className="text-yellow-400 text-xs">용병 ×1.25 적용</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* No buffs message */}
                  {relevantSources.length === 0 && (
                    <tr>
                      <td colSpan={heroes.length + 1} className="py-6 text-center text-muted-foreground text-sm">
                        이 스탯에 대한 파티 버프가 없습니다
                      </td>
                    </tr>
                  )}

                  {/* Separator */}
                  <tr><td colSpan={heroes.length + 1} className="h-1" /></tr>

                  {/* Final buffed stat */}
                  <tr className={`${config.headerBg} border-t border-border/40`}>
                    <td className="py-2.5 px-3 font-bold text-foreground text-sm">
                      최종 (버프 적용)
                    </td>
                    {heroes.map((h, hi) => {
                      const bs = buffedStats[hi];
                      if (!bs) return <td key={h.id} />;
                      const finalVal = getBuffedVal(bs);
                      const delta = getDelta(bs);
                      const suffix = isMultStat ? '' : '%';

                      return (
                        <td key={h.id} className="py-2.5 px-2 text-center">
                          <div className={`font-bold font-mono text-lg ${config.color}`}>
                            {suffix ? `${finalVal}${suffix}` : formatNumber(finalVal)}
                          </div>
                          {delta !== 0 && (
                            <div className={`text-xs font-mono ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {delta > 0 ? '+' : ''}{suffix ? `${delta}${suffix}` : formatNumber(delta)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Crit attack row (only on critDmg tab) */}
                  {activeTab === 'critDmg' && (
                    <tr className="border-t border-border/20 bg-yellow-900/20">
                      <td className="py-2.5 px-3 text-foreground text-sm">
                        <div className="flex items-center gap-1.5">
                          <img src={STAT_ICON_MAP.critAttack} alt="" className="w-5 h-5" />
                          <span className="font-medium">치명타 공격력</span>
                        </div>
                        <span className="text-xs text-muted-foreground">(ATK × 치댐%)</span>
                      </td>
                      {heroes.map((h, hi) => {
                        const bs = buffedStats[hi];
                        if (!bs) return <td key={h.id} />;
                        const critAtk = Math.floor(bs.atk * bs.critDmg / 100);
                        const baseCritAtk = Math.floor((h.atk || 0) * (h.critDmg || 0) / 100);
                        const delta = critAtk - baseCritAtk;
                        return (
                          <td key={h.id} className="py-2.5 px-2 text-center">
                            <div className="font-bold font-mono text-lg text-yellow-300">{formatNumber(critAtk)}</div>
                            {delta !== 0 && (
                              <div className="text-xs text-green-400 font-mono">+{formatNumber(delta)}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Evasion notes */}
            {activeTab === 'evasion' && (
              <div className="mt-3 px-3 space-y-1.5">
                <div className="text-sm text-muted-foreground font-medium">📋 회피 관련 규칙</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• 회피 캡: 길잡이 <span className="text-teal-300 font-mono">78%</span>, 그 외 <span className="text-teal-300 font-mono">75%</span></div>
                  <div>• 익스트림 / 공포의 탑: 회피 <span className="text-red-400 font-mono">-20%</span> 페널티 적용</div>
                  <div>• 락 스톰퍼: 회피 <span className="text-amber-400 font-mono">0%</span> 고정 (페널티 무시)</div>
                  {hasEvasionPenalty && (
                    <div className="text-amber-400 font-medium mt-1">⚠ 현재 퀘스트에 회피 페널티가 적용됩니다</div>
                  )}
                </div>
              </div>
            )}

            {/* Buff sources summary */}
            <div className="mt-4 px-3">
              <div className="text-sm text-muted-foreground font-medium mb-2">적용된 파티 버프 소스</div>
              <div className="flex flex-wrap gap-2">
                {buffSummary.sources.map((src, i) => {
                  const isChamp = src.type === 'champion';
                  const isBooster = isBoosterSource(src);
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
                    <div key={i} className="bg-secondary/50 border border-border/30 rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={isBooster ? 'text-green-400' : isChamp ? 'text-yellow-400' : 'text-purple-400'}>
                          {isBooster ? '⚡' : isChamp ? '👑' : '🎵'}
                        </span>
                        <span className="text-foreground font-medium">{src.name}</span>
                      </div>
                      <div className="text-muted-foreground text-xs leading-relaxed">
                        {parts.join(', ')}
                        {src.note && !isBooster && <span className="text-primary/60 ml-1">({src.note})</span>}
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
