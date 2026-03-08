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

      {/* Step 1: Quest Type */}
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

      {/* Step 2: Region Select */}
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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
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

      {/* Step 3: Sub-area Select (for regions with multiple sub-areas) */}
      {currentRegion && hasSubAreas && (
        <div className="card-fantasy p-4">
          <label className="text-sm text-muted-foreground block mb-3">세부 지역 선택</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
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

      {/* Step 4: Quest/Difficulty Select */}
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

          {/* Show normal quests only for sub-areas (not boss), or when no sub-area system */}
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
                      권장 {formatNumber(q.minPower)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Boss quests - show for boss sub-area selection or when no sub-area system */}
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
                      권장 {formatNumber(q.minPower)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Monster Info */}
      {currentQuest && (
        <div className="card-fantasy p-4">
          <h3 className="font-display text-base text-foreground mb-3 flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" />
            몬스터 정보
            {currentQuest.isBoss && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">BOSS</span>}
            {currentQuest.isExtreme && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">EXTREME</span>}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* HP */}
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-muted-foreground">HP</span>
              </div>
              <span className="text-sm font-bold text-foreground">{formatNumber(currentQuest.hp)}</span>
            </div>

            {/* ATK */}
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Swords className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-muted-foreground">공격력</span>
              </div>
              <span className="text-sm font-bold text-foreground">{formatNumber(currentQuest.atk)}</span>
            </div>

            {/* AOE */}
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs text-muted-foreground">광역 ({currentQuest.aoeChance}%)</span>
              </div>
              <span className="text-sm font-bold text-foreground">{formatNumber(currentQuest.aoe)}</span>
            </div>

            {/* Min Power */}
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-muted-foreground">최소 전투력</span>
              </div>
              <span className="text-sm font-bold text-foreground">{formatNumber(currentQuest.minPower)}</span>
            </div>
          </div>

          {/* Defense thresholds */}
          <div className="mt-3 bg-secondary/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-muted-foreground font-medium">방어력 임계값</span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">대미지 감소율에 따른 필요 방어력</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {(['r0', 'r50', 'r70', 'r75'] as const).map(key => {
                const labels: Record<string, string> = { r0: '0%', r50: '50%', r70: '70%', r75: '75%' };
                return (
                  <div key={key}>
                    <span className="text-[10px] text-muted-foreground block">{labels[key]}</span>
                    <span className="text-xs font-mono font-bold text-foreground">{formatNumber(currentQuest.def[key])}</span>
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
            // For sub-area mode, show only the relevant element; for boss/no-sub-area, show all unique
            const rawElements = barrierElement
              ? [barrierElement]
              : [currentQuest.barrier.sub1, currentQuest.barrier.sub2, currentQuest.barrier.sub3].filter(Boolean);
            const elements = [...new Set(rawElements)];
            if (elements.length === 0) return null;
            return (
              <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs font-medium text-purple-300">속성 장벽</span>
                  <span className="text-xs text-purple-400">HP: {currentQuest.barrier.hp}</span>
                </div>
                <div className="flex gap-2">
                  {elements.map((el, i) => {
                    if (!el) return null;
                    const iconPath = commonData?.elementalBarriers?.[el]?.image;
                    return (
                      <div key={i} className="flex items-center gap-1 bg-secondary/40 rounded px-2 py-1">
                        {iconPath && <img src={iconPath} alt="" className="w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                        <span className="text-xs text-foreground">{el}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Time info */}
          <div className="mt-3 bg-secondary/20 rounded-lg p-3">
            <span className="text-xs text-muted-foreground font-medium mb-2 block">시간 정보</span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {[
                { label: '기본', value: currentQuest.time.base },
                { label: '추가', value: currentQuest.time.additional },
                { label: '인당', value: currentQuest.time.perMember },
                { label: '총합', value: currentQuest.time.total },
                { label: '휴식', value: currentQuest.time.rest },
                { label: '회복', value: currentQuest.time.recovery },
              ].map(t => (
                <div key={t.label}>
                  <span className="text-[10px] text-muted-foreground block">{t.label}</span>
                  <span className="text-xs font-mono text-foreground">{formatTime(t.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Hero Selection */}
      {currentQuest && currentRegion && (
        <div className="card-fantasy p-4">
          <label className="text-sm text-muted-foreground block mb-3">
            파티 구성 ({selectedHeroIds.size} / {currentRegion.maxMembers}명)
          </label>
          <ScrollArea className="max-h-[300px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {allHeroes.map(hero => {
                const isSelected = selectedHeroIds.has(hero.id);
                const isFull = selectedHeroIds.size >= currentRegion.maxMembers && !isSelected;
                return (
                  <label
                    key={hero.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                      isSelected
                        ? 'border-primary/50 bg-primary/5'
                        : isFull
                        ? 'border-border/30 opacity-40 cursor-not-allowed'
                        : 'border-border hover:border-primary/20'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => !isFull && toggleHero(hero.id)}
                      disabled={isFull}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate">{hero.name}</span>
                        <span className={`text-[10px] px-1 py-0.5 rounded ${hero.type === 'champion' ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}`}>
                          {hero.type === 'champion' ? '챔피언' : '영웅'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {hero.heroClass && <span className="text-xs text-muted-foreground">{hero.heroClass}</span>}
                        <span className="text-xs text-muted-foreground">Lv.{hero.level}</span>
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

          {/* Run button */}
          <Button
            onClick={() => {
              // Placeholder - simulation logic will be added later
              alert('시뮬레이션 로직은 추후 구현 예정입니다.');
            }}
            disabled={selectedHeroIds.size === 0}
            className="w-full mt-4 gap-2"
            size="lg"
          >
            <Play className="w-4 h-4" /> 시뮬레이션 실행
          </Button>
        </div>
      )}
    </div>
  );
}
