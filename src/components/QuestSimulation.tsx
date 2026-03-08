import { useState, useEffect, useMemo } from 'react';
import { Hero } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { getHeroes } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Swords, Shield, Heart, Zap, Crown, Users, Play, Info, Plus, Clock, Coffee } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import QuestConfigDialog from '@/components/QuestConfigDialog';
import HeroSelectDialog from '@/components/HeroSelectDialog';

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

// Time reduction setting items
interface TimeSettingItem {
  id: string;
  label: string;
  category: 'quest' | 'rest';
  color?: string;
  enabled: boolean;
  value: number | null; // null = not yet implemented
}

const DEFAULT_TIME_SETTINGS: TimeSettingItem[] = [
  { id: 'region_level', label: '퀘스트) 지역 레벨 효과', category: 'quest', enabled: false, value: null },
  { id: 'skill_boss_time', label: '재능) 보스 시간 감소', category: 'quest', color: 'text-red-400', enabled: false, value: null },
  { id: 'skill_airship_time', label: '재능) 에어쉽 시간 감소', category: 'quest', enabled: false, value: null },
  { id: 'skill_blackquest_time', label: '재능) 깜깜퀘스트 시간 감소', category: 'quest', enabled: false, value: null },
  { id: 'champion_ami', label: '챔피언) 아미', category: 'quest', enabled: false, value: null },
  { id: 'champion_emily', label: '챔피언) 에밀리', category: 'quest', enabled: false, value: null },
  { id: 'booster_compass', label: '부스터) 나침반 효과', category: 'quest', enabled: false, value: null },
  { id: 'equip_song', label: '장비) 오라의 노래 효과', category: 'quest', enabled: false, value: null },
  { id: 'event_quest', label: '이벤트) 퀘스트, 휴식 감소', category: 'quest', enabled: false, value: null },
  { id: 'guild_quest', label: '길드) 퀘스트, 휴식 부스트', category: 'quest', enabled: false, value: null },
  // Rest
  { id: 'rest_region_level', label: '퀘스트) 지역 레벨 효과', category: 'rest', enabled: false, value: null },
  { id: 'rest_guild_emerald', label: '길드) 에메랄드 여관 효과', category: 'rest', color: 'text-green-400', enabled: false, value: null },
  { id: 'rest_skill_hero_champ', label: '재능) 영웅, 챔피언 시간 감소', category: 'rest', enabled: false, value: null },
  { id: 'rest_skill_airship', label: '재능) 에어쉽 시간 감소', category: 'rest', enabled: false, value: null },
  { id: 'rest_champion_pillow', label: '챔피언) 필루', category: 'rest', enabled: false, value: null },
  { id: 'rest_booster_compass', label: '부스터) 나침반 효과', category: 'rest', enabled: false, value: null },
  { id: 'rest_equip_song', label: '장비) 오라의 노래 효과', category: 'rest', enabled: false, value: null },
  { id: 'rest_event', label: '이벤트) 퀘스트, 휴식 감소', category: 'rest', enabled: false, value: null },
  { id: 'rest_guild_boost', label: '길드) 퀘스트, 휴식 부스트', category: 'rest', enabled: false, value: null },
];

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

  // Dialogs
  const [configOpen, setConfigOpen] = useState(false);
  const [heroSelectOpen, setHeroSelectOpen] = useState(false);

  // Time settings
  const [timeSettings, setTimeSettings] = useState<TimeSettingItem[]>(DEFAULT_TIME_SETTINGS);

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
        // Preload all region/sub-area images
        Object.values(map).forEach((qd: QuestData) => {
          qd.regions.forEach(r => {
            if (r.areaImage) { const img = new Image(); img.src = r.areaImage; }
            r.subAreas.forEach(s => { if (s.image) { const img = new Image(); img.src = s.image; } });
            if (r.boss?.image) { const img = new Image(); img.src = r.boss.image; }
          });
        });
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

  // Get barrier elements for display
  const barrierElements = currentQuest?.barrier ? (() => {
    const barrierElement = hasSubAreas && selectedSubAreaIdx >= 0 && selectedSubAreaIdx !== 99
      ? getSubAreaBarrierElement(currentQuest.barrier) : null;
    const rawElements = barrierElement
      ? [barrierElement]
      : [currentQuest.barrier.sub1, currentQuest.barrier.sub2, currentQuest.barrier.sub3].filter(Boolean);
    return [...new Set(rawElements)] as string[];
  })() : [];


  // Sub-area or boss display name - use stage if available
  const locationName = selectedSubAreaIdx === 99 && currentRegion?.boss
    ? currentRegion.boss.name
    : currentQuest?.stage
    ? `${selectedSubArea?.name ? currentRegion?.name + ' ' : ''}${currentQuest.stage}단계`
    : selectedSubArea
    ? selectedSubArea.name
    : currentRegion?.name || '';

  // Center image
  const centerImage = currentQuest
    ? (selectedSubAreaIdx === 99 && currentRegion?.boss
      ? currentRegion.boss.image
      : selectedSubArea
      ? selectedSubArea.image
      : currentRegion?.areaImage) || null
    : null;

  // Defense thresholds (from -50%=0 to 75%)
  const defThresholds = [
    { key: 'neg50' as const, label: '-50%', color: '#a855f7', textClass: 'text-purple-400', value: 0 },
    { key: 'r0' as const, label: '0%', color: '#ef4444', textClass: 'text-red-400', value: currentQuest?.def.r0 || 0 },
    { key: 'r50' as const, label: '50%', color: '#eab308', textClass: 'text-yellow-400', value: currentQuest?.def.r50 || 0 },
    { key: 'r70' as const, label: '70%', color: '#84cc16', textClass: 'text-lime-400', value: currentQuest?.def.r70 || 0 },
    { key: 'r75' as const, label: '75%', color: '#ffffff', textClass: 'text-white', value: currentQuest?.def.r75 || 0 },
  ];

  const questTimeSettings = timeSettings.filter(s => s.category === 'quest');
  const restTimeSettings = timeSettings.filter(s => s.category === 'rest');

  return (
    <div className="animate-fade-in">
      {/* Full-width 3-column layout */}
      <div className="flex gap-4 flex-col lg:flex-row">

        {/* LEFT: Monster Info */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-primary" />
            <h3 className="font-display text-lg text-foreground">몬스터 정보</h3>
          </div>
          <div className="card-fantasy p-4 relative min-h-[400px]">
            {/* Region icon - top left, bigger */}
            {currentRegion && (
              <div className="absolute top-3 left-3 w-16 h-16 rounded-full border-2 border-primary/40 overflow-hidden bg-secondary/50 z-10">
                <img src={currentRegion.areaImage} alt={currentRegion.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
              </div>
            )}

            {/* Quest select button - centered */}
            <div className="flex justify-center pt-2 mb-4">
              <button
                onClick={() => setConfigOpen(true)}
                className={`relative w-28 h-28 rounded-full border-2 transition-all flex items-center justify-center overflow-hidden group ${
                  currentQuest
                    ? 'border-primary/60 glow-gold'
                    : 'border-dashed border-muted-foreground/40 hover:border-primary/50'
                }`}
              >
                {currentQuest && centerImage ? (
                  <>
                    <img src={centerImage} alt="" className="w-full h-full object-cover" />
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
              <div className="space-y-2">
                {/* Line 1: Location */}
                <div className="text-center">
                  <span className="text-sm text-foreground font-medium">{locationName}</span>
                </div>

                {/* Line 2: Difficulty */}
                {currentQuest.difficulty !== '없음' && (
                  <div className="text-center text-sm">
                    <span className={`font-medium ${
                      currentQuest.difficulty === '쉬움' ? 'text-green-400' :
                      currentQuest.difficulty === '보통' ? 'text-blue-400' :
                      currentQuest.difficulty === '어려움' ? 'text-orange-400' :
                      currentQuest.difficulty === '익스트림' ? 'text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]' : 'text-muted-foreground'
                    }`}>{currentQuest.difficulty}</span>
                  </div>
                )}

                {/* Line 3: Boss (below difficulty) */}
                {currentQuest.isBoss && (
                  <div className="text-center text-sm">
                    <span className="text-red-400">
                      <Crown className="w-3.5 h-3.5 inline mr-0.5" />보스
                    </span>
                  </div>
                )}

                {/* Line 3: Total time (white) */}
                <div className="text-center">
                  <span className="text-sm text-foreground">⏱ {formatTime(currentQuest.time.total)}</span>
                </div>

                {/* Line 4: Element Barrier */}
                {barrierElements.length > 0 && currentQuest.barrier && (
                  <div className="flex items-center justify-center gap-3">
                    {barrierElements.map((el, i) => {
                      const iconPath = commonData?.elementalBarriers?.[el]?.image;
                      const heroSum = selectedHeroes.reduce((sum, h) => sum + (h.equipmentElements?.[el] || 0), 0);
                      const required = currentQuest.barrier!.hp;
                      const isMet = heroSum >= required;
                      return (
                        <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${isMet ? 'border-green-500/40 bg-green-500/10' : 'border-purple-500/30 bg-purple-500/10'}`}>
                          {iconPath && <img src={iconPath} alt="" className="w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                          <span className={`text-xs font-mono font-bold ${isMet ? 'text-green-400' : 'text-purple-300'}`}>
                            {formatNumber(heroSum)} / {formatNumber(required)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Stats: vertical list */}
                <div className="space-y-1.5 pt-2 border-t border-border/30">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs text-foreground">체력</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-foreground">{formatNumber(currentQuest.hp)}</span>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs text-foreground">공격력</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-foreground">{formatNumber(currentQuest.atk)}</span>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-xs text-foreground">광역 공격 ({currentQuest.aoeChance}%)</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-foreground">{formatNumber(currentQuest.aoe)}</span>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs text-foreground">치명타 확률</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-foreground">{currentQuest.aoeChance}%</span>
                  </div>
                </div>

                {/* Defense Reference - vertical bar */}
                <div className="pt-2 border-t border-border/30">
                  <div className="flex items-center gap-1.5 mb-3 px-1">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs text-foreground font-medium">방어력 기준치</span>
                  </div>
                  {(() => {
                    // Map defense value to bar % using threshold interpolation
                    const defToBarPct = (def: number) => {
                      // thresholds are at evenly spaced visual positions: 0%, 25%, 50%, 75%, 100%
                      for (let i = defThresholds.length - 1; i >= 1; i--) {
                        const upper = defThresholds[i];
                        const lower = defThresholds[i - 1];
                        if (def >= lower.value) {
                          const segPct = upper.value > lower.value
                            ? (def - lower.value) / (upper.value - lower.value)
                            : 0;
                          const lowerPos = ((i - 1) / (defThresholds.length - 1)) * 100;
                          const upperPos = (i / (defThresholds.length - 1)) * 100;
                          return Math.min(100, lowerPos + segPct * (upperPos - lowerPos));
                        }
                      }
                      return 0;
                    };

                    const barH = 256; // h-64 = 16rem = 256px

                    return (
                      <div className="relative px-1">
                        <div className="flex gap-2">
                          {/* Left: % labels */}
                          <div className="flex flex-col justify-between h-64 text-right shrink-0 w-8">
                            {[...defThresholds].reverse().map(t => (
                              <span key={t.key} className={`text-[10px] font-mono ${t.textClass}`}>{t.label}</span>
                            ))}
                          </div>
                          {/* Center: vertical bar */}
                          <div className="relative w-3 h-64 flex-shrink-0">
                            <div className="absolute inset-0 rounded-full overflow-hidden bg-gradient-to-t from-red-900/60 via-yellow-900/30 to-white/20 border border-border/50" />
                            {/* Threshold markers */}
                            {[...defThresholds].reverse().map((t, i) => {
                              const pct = (i / (defThresholds.length - 1)) * 100;
                              return (
                                <div key={t.key} className="absolute left-0 right-0" style={{ bottom: `${pct}%`, transform: 'translateY(50%)' }}>
                                  <div className="w-full h-px" style={{ backgroundColor: t.color, opacity: 0.5 }} />
                                </div>
                              );
                            })}
                            {/* Hero pins as dots on the bar */}
                            {selectedHeroes.map((h) => {
                              const heroDef = h.def || 0;
                              const pct = defToBarPct(heroDef);
                              let pinColor = '#ef4444';
                              for (const t of defThresholds) {
                                if (heroDef >= t.value) pinColor = t.color;
                              }
                              return (
                                <div
                                  key={h.id}
                                  className="absolute"
                                  style={{ bottom: `${pct}%`, left: '50%', transform: 'translate(-50%, 50%)' }}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full border shadow-md"
                                    style={{ borderColor: pinColor, backgroundColor: pinColor }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          {/* Right: defense values */}
                          <div className="flex flex-col justify-between h-64 shrink-0">
                            {[...defThresholds].reverse().map(t => (
                              <span key={t.key} className={`text-[10px] font-mono ${t.textClass}`}>{formatNumber(t.value)}</span>
                            ))}
                          </div>
                        </div>

                        {/* Hero labels via SVG - lines start past defense values */}
                        {selectedHeroes.length > 0 && (
                          <svg className="absolute top-0 left-0 pointer-events-none" style={{ overflow: 'visible', width: '100%', height: `${barH}px` }}>
                            {(() => {
                              // Sort heroes by def descending so highest is at top
                              const sorted = selectedHeroes
                                .map((h, hi) => ({ h, hi, def: h.def || 0 }))
                                .sort((a, b) => b.def - a.def);
                              // Line starts after defense value column: left(32 w-8) + gap(8) + bar(12) + gap(8) + defValues(~55) = ~115px
                              const startX = 115;
                              const lineLen = 50;
                              // Distribute labels evenly across the bar height to avoid overlap
                              const labelH = 14; // approx text height
                              const totalSlots = sorted.length;
                              
                              return sorted.map((item, sortIdx) => {
                                const pct = defToBarPct(item.def);
                                let pinColor = '#ef4444';
                                for (const t of defThresholds) {
                                  if (item.def >= t.value) pinColor = t.color;
                                }
                                const dotY = barH - (pct / 100) * barH;
                                // Evenly space label Y positions across available height
                                const labelY = totalSlots > 1
                                  ? (sortIdx / (totalSlots - 1)) * (barH - labelH) + labelH / 2
                                  : dotY;
                                const endX = startX + lineLen;
                                return (
                                  <g key={item.h.id}>
                                    {/* Horizontal line from after def values to label */}
                                    <line x1={startX} y1={dotY} x2={startX + 10} y2={dotY} stroke={pinColor} strokeWidth="1" opacity="0.4" />
                                    <line x1={startX + 10} y1={dotY} x2={endX} y2={labelY} stroke={pinColor} strokeWidth="1" opacity="0.4" />
                                    <line x1={endX} y1={labelY} x2={endX + 8} y2={labelY} stroke={pinColor} strokeWidth="1" opacity="0.4" />
                                    <text x={endX + 12} y={labelY + 3} fill={pinColor} fontSize="9" fontFamily="monospace">
                                      {item.h.name} ({formatNumber(item.def)})
                                    </text>
                                  </g>
                                );
                              });
                            })()}
                          </svg>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm">퀘스트를 선택하세요</p>
                <p className="text-muted-foreground/60 text-xs mt-1">위의 + 버튼을 눌러 설정</p>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Hero Slots */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-display text-lg text-foreground">파티 구성</h3>
            <span className="text-xs text-muted-foreground ml-auto">{selectedHeroIds.size}/{maxMembers}</span>
          </div>
          <div className="card-fantasy p-4">
            {/* Hero slots row */}
            <div className="flex gap-3 flex-wrap mb-3">
              {Array.from({ length: maxMembers }).map((_, slotIdx) => {
                const hero = selectedHeroes[slotIdx];
                const belowMin = hero && currentQuest && hero.power > 0 && hero.power < currentQuest.minPower;
                if (hero) {
                  return (
                    <div key={hero.id} className="flex flex-col items-center gap-1">
                      {/* Power indicator above head */}
                      {belowMin && (
                        <span className="text-[9px] font-mono text-red-400 font-bold">⚠ {formatNumber(hero.power)}</span>
                      )}
                      <button onClick={() => toggleHero(hero.id)}
                        className={`relative w-14 h-14 rounded-full border-2 bg-secondary/50 flex flex-col items-center justify-center overflow-hidden group transition-all ${
                          belowMin ? 'border-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'border-primary/50'
                        } hover:border-destructive/50`}
                        title={`${hero.name} (클릭하여 제거)`}>
                        {/* Future: face icon here */}
                        <span className="text-lg">⚔</span>
                        <div className="absolute inset-0 bg-destructive/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                          <span className="text-destructive-foreground text-xs font-bold">✕</span>
                        </div>
                      </button>
                      <span className="text-[10px] text-foreground font-medium truncate max-w-[56px]">{hero.name}</span>
                      <span className="text-[9px] text-muted-foreground">{hero.heroClass || hero.championName || ''}</span>
                    </div>
                  );
                }
                return (
                  <button key={`empty-${slotIdx}`}
                    onClick={() => currentQuest && setHeroSelectOpen(true)}
                    className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                      currentQuest ? 'border-muted-foreground/30 hover:border-primary/50 cursor-pointer' : 'border-muted-foreground/15 cursor-not-allowed'
                    }`}>
                    <Plus className="w-5 h-5 text-muted-foreground/30" />
                  </button>
                );
              })}
            </div>

            {currentQuest && selectedHeroes.length > 0 && (
              <Button onClick={() => { alert('시뮬레이션 로직은 추후 구현 예정입니다.'); }} className="w-full mt-2 gap-2" size="sm">
                <Play className="w-4 h-4" /> 시뮬레이션 실행
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT: Time & Rest Settings */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-display text-lg text-foreground">시간 설정</h3>
          </div>
          <div className="card-fantasy p-3">
            {/* Quest Time Reduction */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-medium text-foreground">퀘스트 시간 감소</span>
              </div>
              <div className="space-y-1">
                {questTimeSettings.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-[11px]">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      item.enabled ? 'border-primary bg-primary/20' : 'border-border bg-secondary/30'
                    }`}>
                      {item.enabled && <span className="text-primary text-[10px]">✓</span>}
                    </div>
                    <span className={`flex-1 ${item.color || 'text-foreground/80'}`}>{item.label}</span>
                    <span className="text-muted-foreground/50 text-[10px]">-</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rest Time Reduction */}
            <div className="border-t border-border/30 pt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Coffee className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-foreground">휴식 시간 감소</span>
              </div>
              <div className="space-y-1">
                {restTimeSettings.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-[11px]">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      item.enabled ? 'border-primary bg-primary/20' : 'border-border bg-secondary/30'
                    }`}>
                      {item.enabled && <span className="text-primary text-[10px]">✓</span>}
                    </div>
                    <span className={`flex-1 ${item.color || 'text-foreground/80'}`}>{item.label}</span>
                    <span className="text-muted-foreground/50 text-[10px]">-</span>
                  </div>
                ))}
              </div>
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

      {/* Hero Select Dialog */}
      <HeroSelectDialog
        open={heroSelectOpen}
        onOpenChange={setHeroSelectOpen}
        heroes={allHeroes}
        selectedIds={selectedHeroIds}
        maxMembers={maxMembers}
        minPower={currentQuest?.minPower || 0}
        onSelect={toggleHero}
      />
    </div>
  );
}
