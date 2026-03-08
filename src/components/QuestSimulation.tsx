import { useState, useEffect, useMemo } from 'react';
import { Hero } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { getHeroes } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Swords, Shield, Heart, Zap, Crown, Users, ChevronRight, RotateCcw, Play, History, Trophy, XCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  const [showHistory, setShowHistory] = useState(false);

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
        setSelectedQuestType('normal');
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

  // Group quests by type (normal vs boss)
  const questGroups = useMemo(() => {
    if (!currentRegion) return { normal: [], boss: [] };
    const normal = currentRegion.quests.filter(q => q.type === 'normal').map((q, i) => ({ ...q, originalIdx: currentRegion.quests.indexOf(q) }));
    const boss = currentRegion.quests.filter(q => q.type === 'boss').map((q, i) => ({ ...q, originalIdx: currentRegion.quests.indexOf(q) }));
    return { normal, boss };
  }, [currentRegion]);

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

  const resetSelection = () => {
    setSelectedRegionIdx(-1);
    setSelectedSubAreaIdx(-1);
    setSelectedQuestIdx(-1);
    setSelectedHeroIds(new Set());
  };

  // Whether this quest type has meaningful sub-areas (normal quests have 3 sub-areas per region)
  const hasSubAreas = currentRegion && currentRegion.subAreas.length > 1;
  const selectedSubArea = currentRegion && selectedSubAreaIdx >= 0 ? currentRegion.subAreas[selectedSubAreaIdx] : null;

  // Get the barrier element for the selected sub-area
  const getSubAreaBarrierElement = (barrier: QuestBarrier | null) => {
    if (!barrier) return null;
    if (selectedSubAreaIdx === 0) return barrier.sub1;
    if (selectedSubAreaIdx === 1) return barrier.sub2;
    if (selectedSubAreaIdx === 2) return barrier.sub3;
    return barrier.sub1; // fallback
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

  const getDifficultyBorder = (diff: string) => {
    switch (diff) {
      case '쉬움': return 'border-green-400/30 hover:border-green-400/60';
      case '보통': return 'border-blue-400/30 hover:border-blue-400/60';
      case '어려움': return 'border-orange-400/30 hover:border-orange-400/60';
      case '익스트림': return 'border-red-400/30 hover:border-red-400/60';
      default: return 'border-border hover:border-primary/30';
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

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-primary">퀘스트 시뮬레이션</h2>
      </div>

      {/* Quest Type - always on top */}
      <div className="card-fantasy p-4">
        <label className="text-sm text-muted-foreground block mb-2">퀘스트 종류</label>
        <div className="flex gap-2 flex-wrap">
          {QUEST_FILES.map(f => {
            const data = questDataMap[f.key];
            if (!data) return null;
            return (
              <button
                key={f.key}
                onClick={() => { setSelectedQuestType(f.key); resetSelection(); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  selectedQuestType === f.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {data.questType}
              </button>
            );
          })}
        </div>
      </div>

      {/* Left-Right Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        {/* LEFT: Selection Panel */}
        <div className="space-y-4">
          {/* Region Select */}
          {currentQuestData && (
            <div className="card-fantasy p-4">
              <label className="text-sm text-muted-foreground block mb-3">
                지역 선택
                {selectedRegionIdx >= 0 && (
                  <button onClick={resetSelection} className="ml-2 text-xs text-primary hover:underline">
                    초기화
                  </button>
                )}
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {currentQuestData.regions.map((region, idx) => (
                  <button
                    key={`${region.key}-${idx}`}
                    onClick={() => { setSelectedRegionIdx(idx); setSelectedSubAreaIdx(-1); setSelectedQuestIdx(-1); setSelectedHeroIds(new Set()); }}
                    className={`relative rounded-lg overflow-hidden border transition-all group ${
                      selectedRegionIdx === idx
                        ? 'border-primary ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="bg-secondary/30 flex items-center justify-center p-2">
                      <img
                        src={region.areaImage}
                        alt={region.name}
                        className="w-full h-auto object-contain"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    <div className="p-1.5 text-center">
                      <span className="text-xs font-medium text-foreground">{region.name}</span>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{region.maxMembers}명</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sub-area Select */}
          {currentRegion && hasSubAreas && (
            <div className="card-fantasy p-4">
              <label className="text-sm text-muted-foreground block mb-3">세부 지역 선택</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {currentRegion.subAreas.map((sub, idx) => (
                  <button
                    key={sub.key}
                    onClick={() => { setSelectedSubAreaIdx(idx); setSelectedQuestIdx(-1); setSelectedHeroIds(new Set()); }}
                    className={`rounded-lg border overflow-hidden transition-all ${
                      selectedSubAreaIdx === idx
                        ? 'border-primary ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="bg-secondary/30 flex items-center justify-center p-1.5">
                      <img src={sub.image} alt={sub.name} className="w-full h-auto object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <div className="p-1.5 text-center">
                      <span className="text-xs font-medium text-foreground">{sub.name}</span>
                    </div>
                  </button>
                ))}
                {/* Boss option */}
                {currentRegion.boss && (
                  <button
                    onClick={() => { setSelectedSubAreaIdx(99); setSelectedQuestIdx(-1); setSelectedHeroIds(new Set()); }}
                    className={`rounded-lg border overflow-hidden transition-all ${
                      selectedSubAreaIdx === 99
                        ? 'border-primary ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="bg-red-500/10 flex items-center justify-center p-1.5">
                      <img src={currentRegion.boss.image} alt={currentRegion.boss.name} className="w-full h-auto object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <div className="p-1.5 text-center">
                      <span className="text-xs font-medium text-red-400 flex items-center justify-center gap-1">
                        <Crown className="w-3 h-3" /> {currentRegion.boss.name}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Difficulty Select */}
          {currentRegion && (!hasSubAreas || selectedSubAreaIdx >= 0) && (
            <div className="card-fantasy p-4">
              <div className="flex items-center gap-3 mb-3">
                {hasSubAreas && selectedSubAreaIdx === 99 && currentRegion.boss ? (
                  <img src={currentRegion.boss.image} alt="" className="w-10 h-10 rounded object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : hasSubAreas && selectedSubArea ? (
                  <img src={selectedSubArea.image} alt="" className="w-10 h-10 rounded object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : currentRegion.boss ? (
                  <img src={currentRegion.boss.image} alt="" className="w-10 h-10 rounded object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : null}
                <div>
                  <h3 className="font-display text-lg text-foreground">
                    {currentRegion.name}
                    {hasSubAreas && selectedSubAreaIdx === 99 && currentRegion.boss ? ` - ${currentRegion.boss.name}` : ''}
                    {hasSubAreas && selectedSubArea ? ` - ${selectedSubArea.name}` : ''}
                  </h3>
                  <span className="text-xs text-muted-foreground">최대 {currentRegion.maxMembers}명 파티</span>
                </div>
              </div>

              {((!hasSubAreas || (selectedSubAreaIdx >= 0 && selectedSubAreaIdx !== 99)) && questGroups.normal.length > 0) && (
                <div className="mb-3">
                  <span className="text-xs text-muted-foreground mb-1.5 block">일반</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {questGroups.normal.map(q => (
                      <button
                        key={q.originalIdx}
                        onClick={() => { setSelectedQuestIdx(q.originalIdx); setSelectedHeroIds(new Set()); }}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          selectedQuestIdx === q.originalIdx
                            ? 'border-primary bg-primary/10'
                            : getDifficultyBorder(q.difficulty)
                        }`}
                      >
                        <div className={`text-sm font-medium ${getDifficultyColor(q.difficulty)}`}>
                          {q.stage ? `${q.stage}단계` : q.difficulty}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          최소 {formatNumber(q.minPower)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {((!hasSubAreas || selectedSubAreaIdx === 99) && questGroups.boss.length > 0) && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                    <Crown className="w-3 h-3" /> 보스
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {questGroups.boss.map(q => (
                      <button
                        key={q.originalIdx}
                        onClick={() => { setSelectedQuestIdx(q.originalIdx); setSelectedHeroIds(new Set()); }}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          selectedQuestIdx === q.originalIdx
                            ? 'border-primary bg-primary/10'
                            : getDifficultyBorder(q.difficulty)
                        }`}
                      >
                        <div className={`text-sm font-medium ${getDifficultyColor(q.difficulty)}`}>
                          {q.stage ? `${q.stage}단계` : q.difficulty}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          최소 {formatNumber(q.minPower)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Monster Info + Party (sticky) */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
          {/* Monster Info - Game Style */}
          {currentQuest ? (
            <div className="card-quest-panel p-4">
              {/* Header with region name & difficulty */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg text-yellow-400 flex items-center gap-2">
                  {currentRegion?.name}
                  {hasSubAreas && selectedSubAreaIdx === 99 && currentRegion?.boss ? ` - ${currentRegion.boss.name}` : ''}
                  {hasSubAreas && selectedSubArea ? ` - ${selectedSubArea.name}` : ''}
                </h3>
                <div className="flex items-center gap-1.5">
                  {currentQuest.isBoss && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600/40 text-red-300 border border-red-500/40">BOSS</span>
                  )}
                  {currentQuest.difficulty !== '없음' && (() => {
                    const diffStyles: Record<string, string> = {
                      '쉬움': 'bg-green-600/30 text-green-300 border-green-500/40',
                      '보통': 'bg-blue-600/30 text-blue-300 border-blue-500/40',
                      '어려움': 'bg-orange-600/30 text-orange-300 border-orange-500/40',
                      '익스트림': 'bg-purple-600/30 text-purple-300 border-purple-500/40',
                    };
                    return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diffStyles[currentQuest.difficulty] || 'bg-secondary text-muted-foreground'}`}>
                        {commonData?.difficulties?.[currentQuest.difficulty] && (
                          <img src={commonData.difficulties[currentQuest.difficulty].image} alt="" className="w-3 h-3 inline mr-1 -mt-0.5" />
                        )}
                        {currentQuest.difficulty}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Boss/Sub-area image */}
              {(() => {
                const imgSrc = hasSubAreas && selectedSubAreaIdx === 99 && currentRegion?.boss
                  ? currentRegion.boss.image
                  : hasSubAreas && selectedSubArea
                  ? selectedSubArea.image
                  : currentRegion?.boss?.image || currentRegion?.areaImage;
                return imgSrc ? (
                  <div className="relative rounded-lg overflow-hidden mb-3 border border-red-900/30">
                    <div className="bg-gradient-to-b from-red-900/20 to-transparent absolute inset-0 z-10" />
                    <img src={imgSrc} alt="" className="w-full h-auto object-contain max-h-32 mx-auto" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                  </div>
                ) : null;
              })()}

              {/* Stat Grid - Game style rounded cards */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { icon: <Heart className="w-4 h-4 text-red-400" />, label: 'HP', value: formatNumber(currentQuest.hp), color: 'text-red-300' },
                  { icon: <Swords className="w-4 h-4 text-orange-400" />, label: '공격력', value: formatNumber(currentQuest.atk), color: 'text-orange-300' },
                  { icon: <Zap className="w-4 h-4 text-yellow-400" />, label: `광역 (${currentQuest.aoeChance}%)`, value: formatNumber(currentQuest.aoe), color: 'text-yellow-300' },
                  { icon: <Shield className="w-4 h-4 text-blue-400" />, label: '최소 전투력', value: formatNumber(currentQuest.minPower), color: 'text-blue-300' },
                ].map((stat, i) => (
                  <div key={i} className="card-quest-stat p-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-black/30 border border-white/10 flex items-center justify-center shrink-0">
                      {stat.icon}
                    </div>
                    <div>
                      <span className="text-[10px] text-white/50 block leading-tight">{stat.label}</span>
                      <span className={`text-sm font-bold ${stat.color}`}>{stat.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Defense thresholds - compact bar style */}
              <div className="card-quest-stat p-2.5 mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] text-white/50 font-medium">방어력 임계값</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-white/30" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">대미지 감소율에 따른 필요 방어력</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center">
                  {(['r0', 'r50', 'r70', 'r75'] as const).map(key => {
                    const labels: Record<string, string> = { r0: '0%', r50: '50%', r70: '70%', r75: '75%' };
                    const colors: Record<string, string> = { r0: 'text-white/60', r50: 'text-yellow-300', r70: 'text-orange-300', r75: 'text-red-300' };
                    return (
                      <div key={key} className="bg-black/20 rounded px-1 py-1">
                        <span className="text-[9px] text-white/40 block">{labels[key]}</span>
                        <span className={`text-xs font-mono font-bold ${colors[key]}`}>{formatNumber(currentQuest.def[key])}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Element Barrier */}
              {currentQuest.barrier && (() => {
                const barrierElement = hasSubAreas && selectedSubAreaIdx >= 0 && selectedSubAreaIdx !== 99
                  ? getSubAreaBarrierElement(currentQuest.barrier)
                  : null;
                const rawElements = barrierElement
                  ? [barrierElement]
                  : [currentQuest.barrier.sub1, currentQuest.barrier.sub2, currentQuest.barrier.sub3].filter(Boolean);
                const elements = [...new Set(rawElements)];
                if (elements.length === 0) return null;
                return (
                  <div className="card-quest-stat p-2.5 mb-3 border-purple-500/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-medium text-purple-300">⬡ 속성 장벽</span>
                      <span className="text-[10px] font-bold text-purple-200">HP: {currentQuest.barrier.hp}</span>
                    </div>
                    <div className="flex gap-2">
                      {elements.map((el, i) => {
                        if (!el) return null;
                        const iconPath = commonData?.elementalBarriers?.[el]?.image;
                        return (
                          <div key={i} className="flex items-center gap-1.5 bg-purple-900/30 border border-purple-500/30 rounded-full px-2.5 py-1">
                            {iconPath && <img src={iconPath} alt="" className="w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                            <span className="text-xs font-medium text-purple-200">{el}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Time info - compact */}
              <div className="card-quest-stat p-2.5">
                <span className="text-[10px] text-white/50 font-medium mb-1.5 block">⏱ 시간 정보</span>
                <div className="grid grid-cols-3 gap-1 text-center">
                  {[
                    { label: '기본', value: currentQuest.time.base },
                    { label: '추가', value: currentQuest.time.additional },
                    { label: '인당', value: currentQuest.time.perMember },
                    { label: '총합', value: currentQuest.time.total },
                    { label: '휴식', value: currentQuest.time.rest },
                    { label: '회복', value: currentQuest.time.recovery },
                  ].map(t => (
                    <div key={t.label} className="bg-black/20 rounded px-1 py-1">
                      <span className="text-[9px] text-white/40 block">{t.label}</span>
                      <span className="text-xs font-mono text-white/80">{formatTime(t.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : currentQuestData ? (
            <div className="card-quest-panel p-6 flex flex-col items-center justify-center text-white/40 text-sm min-h-[250px] gap-2">
              <Swords className="w-8 h-8 text-white/20" />
              <span>← 지역과 난이도를 선택하세요</span>
            </div>
          ) : null}

          {/* Party Selection - Game Style */}
          {currentQuest && currentRegion && (
            <div className="card-quest-panel p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-yellow-400">파티 구성</span>
                <span className="text-xs text-white/50">{selectedHeroIds.size} / {currentRegion.maxMembers}명</span>
              </div>
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-1.5">
                  {allHeroes.map(hero => {
                    const isSelected = selectedHeroIds.has(hero.id);
                    const isFull = selectedHeroIds.size >= currentRegion.maxMembers && !isSelected;
                    return (
                      <label
                        key={hero.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? 'border-yellow-500/40 bg-yellow-900/15'
                            : isFull
                            ? 'border-white/5 opacity-30 cursor-not-allowed'
                            : 'border-white/10 hover:border-yellow-500/20 hover:bg-white/5'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => !isFull && toggleHero(hero.id)}
                          disabled={isFull}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-white/90 truncate">{hero.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                              hero.type === 'champion'
                                ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                                : 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                            }`}>
                              {hero.type === 'champion' ? '챔피언' : '영웅'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {hero.heroClass && <span className="text-xs text-white/40">{hero.heroClass}</span>}
                            <span className="text-xs text-white/40">Lv.{hero.level}</span>
                            {hero.power > 0 && (
                              <span className="text-xs text-yellow-400">⚔ {formatNumber(hero.power)}</span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>

              <Button
                onClick={() => {
                  alert('시뮬레이션 로직은 추후 구현 예정입니다.');
                }}
                disabled={selectedHeroIds.size === 0}
                className="w-full mt-3 gap-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white border-0 font-bold"
                size="lg"
              >
                <Play className="w-4 h-4" /> 시뮬레이션 실행
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
