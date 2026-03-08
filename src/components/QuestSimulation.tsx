import { useState, useEffect, useMemo } from 'react';
import { Hero } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { getHeroes } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Swords, Shield, Heart, Zap, Crown, Users, Play, Info, Plus, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import QuestConfigDialog from '@/components/QuestConfigDialog';

// Quest data types
interface QuestTime {
  base: number;
  additional: number;
  perMember: number;
  total: number;
  rest: number;
  recovery: number;
}

interface QuestBarrier {
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  hp: number;
}

interface QuestEntry {
  type: string;
  difficulty: string;
  stage?: number;
  minPower: number;
  hp: number;
  atk: number;
  aoe: number;
  aoeChance: number;
  time: QuestTime;
  def: { r0: number; r50: number; r70: number; r75: number };
  barrier: QuestBarrier | null;
  isBoss: boolean;
  isExtreme: boolean;
}

interface SubArea {
  name: string;
  key: string;
  image: string;
}

interface QuestRegion {
  name: string;
  key: string;
  areaImage: string;
  maxMembers: number;
  subAreas: SubArea[];
  boss?: { name: string; key: string; image: string };
  quests: QuestEntry[];
}

interface QuestData {
  questType: string;
  questTypeKey: string;
  regions: QuestRegion[];
}

interface QuestCommon {
  difficulties: Record<string, { key: string; image: string }>;
  elementalBarriers: Record<string, { key: string; image: string }>;
}

const QUEST_FILES = [
  { key: 'normal', file: 'normal_quest.json' },
  { key: 'flash', file: 'flash_quest.json' },
  { key: 'lcog', file: 'lcog_quest.json' },
  { key: 'tot', file: 'tot_quest.json' },
];

function formatTime(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}분 ${s}초` : `${m}분`;
  }
  return `${seconds}초`;
}

export default function QuestSimulation() {
  const allHeroes = getHeroes();
  const [questDataMap, setQuestDataMap] = useState<Record<string, QuestData>>({});
  const [commonData, setCommonData] = useState<QuestCommon | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedQuestType, setSelectedQuestType] = useState<string>('');
  const [selectedRegionIdx, setSelectedRegionIdx] = useState<number>(-1);
  const [selectedSubAreaIdx, setSelectedSubAreaIdx] = useState<number>(-1);
  const [selectedQuestIdx, setSelectedQuestIdx] = useState<number>(-1);
  const [selectedHeroIds, setSelectedHeroIds] = useState<Set<string>>(new Set());

  // Dialog
  const [configOpen, setConfigOpen] = useState(false);

  // Load quest data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [commonRes, ...questResults] = await Promise.all([
          fetch('/data/quest/quest_common.json').then(r => r.json()),
          ...QUEST_FILES.map(f => fetch(`/data/quest/${f.file}`).then(r => r.json())),
        ]);
        setCommonData(commonRes);
        const map: Record<string, QuestData> = {};
        QUEST_FILES.forEach((f, i) => {
          map[f.key] = questResults[i];
        });
        setQuestDataMap(map);
      } catch (e) {
        console.error('Failed to load quest data', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const currentQuestData = selectedQuestType ? questDataMap[selectedQuestType] : null;
  const currentRegion = currentQuestData && selectedRegionIdx >= 0 ? currentQuestData.regions[selectedRegionIdx] : null;
  const currentQuest = currentRegion && selectedQuestIdx >= 0 ? currentRegion.quests[selectedQuestIdx] : null;
  const hasSubAreas = currentRegion && currentRegion.subAreas.length > 1;
  const selectedSubArea = currentRegion && selectedSubAreaIdx >= 0 && selectedSubAreaIdx !== 99 ? currentRegion.subAreas[selectedSubAreaIdx] : null;

  const getSubAreaBarrierElement = (barrier: QuestBarrier | null) => {
    if (!barrier) return null;
    if (selectedSubAreaIdx === 0) return barrier.sub1;
    if (selectedSubAreaIdx === 1) return barrier.sub2;
    if (selectedSubAreaIdx === 2) return barrier.sub3;
    return barrier.sub1;
  };

  const toggleHero = (id: string) => {
    if (!currentRegion) return;
    setSelectedHeroIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < currentRegion.maxMembers) {
        next.add(id);
      }
      return next;
    });
  };

  const clearQuest = () => {
    setSelectedQuestType('');
    setSelectedRegionIdx(-1);
    setSelectedSubAreaIdx(-1);
    setSelectedQuestIdx(-1);
    setSelectedHeroIds(new Set());
  };

  const handleQuestSelect = (sel: { questTypeKey: string; regionIdx: number; subAreaIdx: number; questIdx: number }) => {
    setSelectedQuestType(sel.questTypeKey);
    setSelectedRegionIdx(sel.regionIdx);
    setSelectedSubAreaIdx(sel.subAreaIdx);
    setSelectedQuestIdx(sel.questIdx);
    setSelectedHeroIds(new Set());
  };

  // Get display image for the quest slot
  const getQuestSlotImage = () => {
    if (!currentRegion) return null;
    if (selectedSubAreaIdx === 99 && currentRegion.boss) return currentRegion.boss.image;
    if (selectedSubArea) return selectedSubArea.image;
    return currentRegion.areaImage;
  };

  const getQuestSlotLabel = () => {
    if (!currentQuestData || !currentRegion) return null;
    let label = currentRegion.name;
    if (selectedSubAreaIdx === 99 && currentRegion.boss) label += ` - ${currentRegion.boss.name}`;
    else if (selectedSubArea) label += ` - ${selectedSubArea.name}`;
    return label;
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case '쉬움': return 'text-green-400';
      case '보통': return 'text-blue-400';
      case '어려움': return 'text-orange-400';
      case '익스트림': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in text-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">퀘스트 데이터 로딩 중...</p>
      </div>
    );
  }

  if (allHeroes.length === 0) {
    return (
      <div className="animate-fade-in text-center py-20">
        <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">먼저 리스트 관리에서 영웅을 추가해주세요</p>
      </div>
    );
  }

  const selectedHeroes = allHeroes.filter(h => selectedHeroIds.has(h.id));
  const maxMembers = currentRegion?.maxMembers || 5;

  return (
    <div className="animate-fade-in">
      {/* Lobby Layout */}
      <div className="max-w-5xl mx-auto">

        {/* Main Content: Monster Info (left) + Hero Panel (right) */}
        <div className="flex gap-4 flex-col lg:flex-row">
          {/* Left: Monster Info */}
          <div className="flex-1 min-w-0">
            <div className="card-fantasy p-4 relative">
              {/* Region icon - top left corner */}
              {currentRegion && (
                <div className="absolute top-3 left-3 w-12 h-12 rounded-full border-2 border-primary/40 overflow-hidden bg-secondary/50 z-10">
                  <img src={currentRegion.areaImage} alt={currentRegion.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}

              {/* Quest select button centered at top */}
              <div className="flex justify-center mb-3">
                <button
                  onClick={() => setConfigOpen(true)}
                  className={`relative w-24 h-24 rounded-full border-2 transition-all flex items-center justify-center overflow-hidden group ${
                    currentQuest
                      ? 'border-primary/60 glow-gold'
                      : 'border-dashed border-muted-foreground/40 hover:border-primary/50'
                  }`}
                >
                  {currentQuest ? (
                    <>
                      {(() => {
                        // Show sub-area or boss image in center, fallback to region
                        const centerImage = selectedSubAreaIdx === 99 && currentRegion?.boss
                          ? currentRegion.boss.image
                          : selectedSubArea
                          ? selectedSubArea.image
                          : currentRegion?.areaImage;
                        return centerImage ? (
                          <img src={centerImage} alt="" className="w-full h-full object-cover" />
                        ) : null;
                      })()}
                      <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[10px] text-foreground font-medium">변경</span>
                      </div>
                    </>
                  ) : (
                    <Plus className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </button>
              </div>

              {currentQuest ? (
                <>
                  {/* Quest info line: barrier name - boss name / difficulty / time */}
                  <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
                    {/* Barrier type name if exists */}
                    {currentQuest.barrier && (() => {
                      const barrierElement = hasSubAreas && selectedSubAreaIdx >= 0 && selectedSubAreaIdx !== 99
                        ? getSubAreaBarrierElement(currentQuest.barrier) : null;
                      const rawElements = barrierElement
                        ? [barrierElement]
                        : [currentQuest.barrier.sub1, currentQuest.barrier.sub2, currentQuest.barrier.sub3].filter(Boolean);
                      const elements = [...new Set(rawElements)] as string[];
                      if (elements.length === 0) return null;
                      return (
                        <span className="text-xs text-purple-300">
                          {elements.join(' ')}장벽
                        </span>
                      );
                    })()}
                    {currentQuest.barrier && <span className="text-xs text-muted-foreground/40">-</span>}
                    {/* Sub-area / boss name */}
                    <span className="text-sm text-foreground font-medium">
                      {selectedSubAreaIdx === 99 && currentRegion?.boss
                        ? currentRegion.boss.name
                        : selectedSubArea
                        ? selectedSubArea.name
                        : currentRegion?.name}
                    </span>
                    {/* Difficulty + Boss tag */}
                    {currentQuest.difficulty !== '없음' && (() => {
                      const diffColors: Record<string, string> = {
                        '쉬움': 'bg-green-500/20 text-green-400',
                        '보통': 'bg-blue-500/20 text-blue-400',
                        '어려움': 'bg-orange-500/20 text-orange-400',
                        '익스트림': 'bg-red-500/20 text-red-400',
                      };
                      return <span className={`text-xs px-1.5 py-0.5 rounded ${diffColors[currentQuest.difficulty] || 'bg-secondary text-muted-foreground'}`}>{currentQuest.difficulty}</span>;
                    })()}
                    {currentQuest.isBoss && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">보스</span>}
                    {/* Time - white */}
                    <span className="text-xs text-foreground">⏱ {formatTime(currentQuest.time.total)}</span>
                    <button onClick={clearQuest} className="ml-1">
                      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                    </button>
                  </div>

                  {/* Element Barrier with hero sums */}
                  {currentQuest.barrier && (() => {
                    const barrierElement = hasSubAreas && selectedSubAreaIdx >= 0 && selectedSubAreaIdx !== 99
                      ? getSubAreaBarrierElement(currentQuest.barrier) : null;
                    const rawElements = barrierElement
                      ? [barrierElement]
                      : [currentQuest.barrier.sub1, currentQuest.barrier.sub2, currentQuest.barrier.sub3].filter(Boolean);
                    const elements = [...new Set(rawElements)] as string[];
                    if (elements.length === 0) return null;

                    const heroElementSums: Record<string, number> = {};
                    elements.forEach(el => {
                      heroElementSums[el] = selectedHeroes.reduce((sum, h) => {
                        return sum + (h.equipmentElements?.[el] || 0);
                      }, 0);
                    });

                    return (
                      <div className="flex items-center justify-center gap-3 mb-3">
                        {elements.map((el, i) => {
                          const iconPath = commonData?.elementalBarriers?.[el]?.image;
                          const heroSum = heroElementSums[el] || 0;
                          const required = currentQuest.barrier!.hp;
                          const isMet = heroSum >= required;
                          return (
                            <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${isMet ? 'border-green-500/40 bg-green-500/10' : 'border-purple-500/30 bg-purple-500/10'}`}>
                              {iconPath && <img src={iconPath} alt="" className="w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                              <span className="text-xs text-foreground">{el}</span>
                              <span className={`text-xs font-mono font-bold ${isMet ? 'text-green-400' : 'text-purple-300'}`}>
                                {formatNumber(heroSum)} / {formatNumber(required)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div className="bg-secondary/30 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Heart className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-[10px] text-muted-foreground">HP</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{formatNumber(currentQuest.hp)}</span>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Swords className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-[10px] text-muted-foreground">공격력</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{formatNumber(currentQuest.atk)}</span>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-[10px] text-muted-foreground">광역 ({currentQuest.aoeChance}%)</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{formatNumber(currentQuest.aoe)}</span>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Shield className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] text-muted-foreground">최소 전투력</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{formatNumber(currentQuest.minPower)}</span>
                    </div>
                  </div>

                  {/* Defense thresholds - bar */}
                  <div className="bg-secondary/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs text-muted-foreground font-medium">방어력 기준치</span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">대미지 감소율에 따른 필요 방어력</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {(() => {
                      const thresholds = [
                        { key: 'r0' as const, label: '0%', dotColor: '#ef4444', textColor: 'text-red-400' },
                        { key: 'r50' as const, label: '50%', dotColor: '#eab308', textColor: 'text-yellow-400' },
                        { key: 'r70' as const, label: '70%', dotColor: '#84cc16', textColor: 'text-lime-400' },
                        { key: 'r75' as const, label: '75%', dotColor: '#ffffff', textColor: 'text-white' },
                      ];
                      const maxDef = currentQuest.def.r75 * 1.15;
                      const heroDefPositions = selectedHeroes.map(h => ({
                        name: h.name,
                        def: h.def || 0,
                        percent: maxDef > 0 ? Math.min(((h.def || 0) / maxDef) * 100, 96) : 0,
                      }));

                      return (
                        <div>
                          <div className="relative h-7 bg-secondary/80 rounded-full border border-border/50">
                            {thresholds.map(t => {
                              const pct = maxDef > 0 ? Math.min((currentQuest.def[t.key] / maxDef) * 100, 96) : 0;
                              return (
                                <div key={t.key} className="absolute top-0 bottom-0" style={{ left: `${pct}%` }}>
                                  <div className="w-px h-full opacity-50" style={{ backgroundColor: t.dotColor }} />
                                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-background/80" style={{ backgroundColor: t.dotColor }} />
                                </div>
                              );
                            })}
                            {heroDefPositions.map(h => (
                              <Tooltip key={h.name}>
                                <TooltipTrigger asChild>
                                  <div className="absolute top-1/2 -translate-y-1/2 z-10 cursor-pointer" style={{ left: `clamp(4px, calc(${h.percent}% - 8px), calc(100% - 20px))` }}>
                                    <Shield className="w-4 h-4 text-primary drop-shadow-md" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">{h.name}: {formatNumber(h.def)}</p></TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                          <div className="relative h-8 mt-1">
                            {thresholds.map(t => {
                              const pct = maxDef > 0 ? Math.min((currentQuest.def[t.key] / maxDef) * 100, 96) : 0;
                              return (
                                <div key={t.key} className="absolute flex flex-col items-center" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
                                  <span className={`text-[10px] font-medium ${t.textColor}`}>{t.label}</span>
                                  <span className="text-[9px] font-mono text-muted-foreground">{formatNumber(currentQuest.def[t.key])}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">퀘스트를 선택하세요</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">위의 + 버튼을 눌러 지역과 난이도를 설정합니다</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Hero Panel */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-display text-lg text-foreground">파티 구성</h3>
              <span className="text-xs text-muted-foreground ml-auto">{selectedHeroIds.size}/{maxMembers}</span>
            </div>
            <div className="card-fantasy p-4">
              <div className="flex gap-2 mb-3 flex-wrap">
                {Array.from({ length: maxMembers }).map((_, slotIdx) => {
                  const hero = selectedHeroes[slotIdx];
                  if (hero) {
                    return (
                      <button key={hero.id} onClick={() => toggleHero(hero.id)}
                        className="relative w-12 h-12 rounded-full border-2 border-primary/50 bg-secondary/50 flex flex-col items-center justify-center overflow-hidden group transition-all hover:border-destructive/50"
                        title={`${hero.name} (클릭하여 제거)`}>
                        <span className="text-sm">⚔</span>
                        <span className="text-[8px] text-foreground font-medium truncate max-w-[40px] leading-tight">{hero.name}</span>
                        <div className="absolute inset-0 bg-destructive/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                          <X className="w-4 h-4 text-destructive-foreground" />
                        </div>
                      </button>
                    );
                  }
                  return (
                    <div key={`empty-${slotIdx}`} className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-muted-foreground/30" />
                    </div>
                  );
                })}
              </div>
              {currentQuest && (
                <>
                  <div className="border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground mb-2 block">영웅 선택</span>
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-1.5">
                        {allHeroes.map(hero => {
                          const isSelected = selectedHeroIds.has(hero.id);
                          const isFull = selectedHeroIds.size >= maxMembers && !isSelected;
                          return (
                            <button key={hero.id} onClick={() => !isFull && toggleHero(hero.id)} disabled={isFull}
                              className={`flex items-center gap-2 p-2 rounded-lg transition-all border text-left w-full ${
                                isSelected ? 'border-primary/50 bg-primary/5' : isFull ? 'border-border/30 opacity-40 cursor-not-allowed' : 'border-border hover:border-primary/20'
                              }`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-primary/20 border border-primary/40' : 'bg-secondary/50 border border-border'
                              }`}>
                                <span className="text-xs">⚔</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-xs text-foreground truncate">{hero.name}</span>
                                  <span className={`text-[9px] px-1 py-0.5 rounded ${hero.type === 'champion' ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}`}>
                                    {hero.type === 'champion' ? '챔피언' : '영웅'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">Lv.{hero.level}</span>
                                  {hero.power > 0 && <span className="text-[10px] text-yellow-400">⚔ {formatNumber(hero.power)}</span>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                  <Button onClick={() => { alert('시뮬레이션 로직은 추후 구현 예정입니다.'); }} disabled={selectedHeroIds.size === 0} className="w-full mt-3 gap-2" size="sm">
                    <Play className="w-4 h-4" /> 시뮬레이션 실행
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Config Dialog */}
      <QuestConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        questDataMap={questDataMap}
        questFiles={QUEST_FILES}
        onSelect={handleQuestSelect}
      />
    </div>
  );
}
