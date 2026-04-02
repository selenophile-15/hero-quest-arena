import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { Hero, ELEMENT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { getHeroes } from '@/lib/storage';
import { getJobImagePath, getChampionImagePath, getJobIllustPath } from '@/lib/nameMap';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Swords, Shield, Heart, Zap, Crown, Users, Info, Plus, Clock, Coffee, Loader2, Save, ListChecks, GitCompare, RotateCcw, AlertTriangle, Camera, Dices, Flame, Target, Crosshair, Wind } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import QuestConfigDialog from '@/components/QuestConfigDialog';
import HeroSelectDialog from '@/components/HeroSelectDialog';
import { runCombatSimulation, runSingleCombatLog, type SimulationResult as CombatSimResult, type QuestMonster, type MiniBossType, type BoosterType, type CombatLogEntry } from '@/lib/combatSimulation';

// 마법검/스펠나이트: all elements at 50% effectiveness for barriers
const SPELLKNIGHT_CLASSES = ['마법검', '스펠나이트'];
function getHeroBarrierContribution(h: Hero, barrierEl: string): number {
  if (SPELLKNIGHT_CLASSES.includes(h.heroClass)) {
    const allVals = Object.values(h.equipmentElements || {});
    const total = allVals.reduce((a, b) => a + b, 0);
    return Math.floor(total * 0.5);
  }
  return h.equipmentElements?.[barrierEl] || 0;
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculatePartyBuffs, type BuffedHeroStats, type PartyBuffSummary } from '@/lib/partyBuffCalculator';
import PartyBuffBreakdownDrawer from '@/components/PartyBuffBreakdownDrawer';
import CombatBattlefield from '@/components/CombatBattlefield';
import SavedResults from '@/components/SavedResults';
import CompareAnalysis from '@/components/CompareAnalysis';
import { saveSimulationResult, SavedSimulationSummary } from '@/lib/savedSimulations';
import { toast } from '@/hooks/use-toast';

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
  boosters: Record<string, { key: string; image: string }>;
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
  { id: 'rest_guild_emerald', label: '길드) 에메랄드 여관 효과', category: 'rest', color: 'text-lime-400', enabled: false, value: null },
  { id: 'rest_skill_hero_champ', label: '재능) 영웅, 챔피언 시간 감소', category: 'rest', enabled: false, value: null },
  { id: 'rest_skill_airship', label: '재능) 에어쉽 시간 감소', category: 'rest', enabled: false, value: null },
  { id: 'rest_champion_pillow', label: '챔피언) 필루', category: 'rest', enabled: false, value: null },
  { id: 'rest_booster_compass', label: '부스터) 나침반 효과', category: 'rest', enabled: false, value: null },
  { id: 'rest_equip_song', label: '장비) 오라의 노래 효과', category: 'rest', enabled: false, value: null },
  { id: 'rest_event', label: '이벤트) 퀘스트, 휴식 감소', category: 'rest', enabled: false, value: null },
  { id: 'rest_guild_boost', label: '길드) 퀘스트, 휴식 부스트', category: 'rest', enabled: false, value: null },
];

type QuestSubTab = 'simulation' | 'saved' | 'compare';

const QUEST_SUB_TABS = [
  { id: 'simulation' as const, label: '퀘스트 시뮬레이션', icon: Swords },
  { id: 'saved' as const, label: '내 결과', icon: ListChecks },
  { id: 'compare' as const, label: '비교 분석실', icon: GitCompare },
];

export default function QuestSimulation() {
  const { colorMode } = useTheme();
  const allHeroes = getHeroes();
  const [questDataMap, setQuestDataMap] = useState<Record<string, QuestData>>({});
  const [commonData, setCommonData] = useState<QuestCommon | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<QuestSubTab>('simulation');

  // Selection state
  const [selectedQuestType, setSelectedQuestType] = useState<string>('');
  const [selectedRegionIdx, setSelectedRegionIdx] = useState<number>(-1);
  const [selectedSubAreaIdx, setSelectedSubAreaIdx] = useState<number>(-1);
  const [selectedQuestIdx, setSelectedQuestIdx] = useState<number>(-1);
  const [selectedHeroIds, setSelectedHeroIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [configOpen, setConfigOpen] = useState(false);
  const [configInitialStep, setConfigInitialStep] = useState<'type' | 'region' | 'subarea' | 'difficulty' | undefined>();
  const [configInitialState, setConfigInitialState] = useState<{ questTypeKey: string; regionIdx: number; subAreaIdx: number } | undefined>();
  const [heroSelectOpen, setHeroSelectOpen] = useState(false);
  const [editingSlotIdx, setEditingSlotIdx] = useState<number | null>(null);

  // Time settings
  const [timeSettings, setTimeSettings] = useState<TimeSettingItem[]>(DEFAULT_TIME_SETTINGS);

  // Simulation state
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<CombatSimResult | null>(null);

  // Party buff state
  const [buffedStats, setBuffedStats] = useState<BuffedHeroStats[]>([]);
  const [buffSummary, setBuffSummary] = useState<PartyBuffSummary | null>(null);
  const [buffBreakdownOpen, setBuffBreakdownOpen] = useState(false);
  const [selectedBooster, setSelectedBooster] = useState<'none' | 'normal' | 'super' | 'mega'>('none');
  const [combatLog, setCombatLog] = useState<CombatLogEntry[] | null>(null);
  const [combatLogDialogOpen, setCombatLogDialogOpen] = useState(false);
  const [selectedMiniBoss, setSelectedMiniBoss] = useState<MiniBossType>('random');
  const [jobDisplayMode, setJobDisplayMode] = useState<'icon' | 'illust' | 'none'>('icon');
  const [simResultsFilter, setSimResultsFilter] = useState<string>('all');

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
        // Preload all region/sub-area images + hero job/champion images
        const preloadImages: string[] = [];
        Object.values(map).forEach((qd: QuestData) => {
          qd.regions.forEach(r => {
            if (r.areaImage) preloadImages.push(r.areaImage);
            r.subAreas.forEach(s => { if (s.image) preloadImages.push(s.image); });
            if (r.boss?.image) preloadImages.push(r.boss.image);
          });
        });
        // Preload hero job icons and illustrations
        allHeroes.forEach(h => {
          if (h.type === 'champion') {
            const p = getChampionImagePath(h.championName || h.name);
            if (p) preloadImages.push(p);
          } else if (h.heroClass) {
            const p1 = getJobImagePath(h.heroClass);
            const p2 = getJobIllustPath(h.heroClass);
            if (p1) preloadImages.push(p1);
            if (p2) preloadImages.push(p2);
          }
        });
        // Preload booster images
        if (commonRes?.boosters) {
          Object.values(commonRes.boosters).forEach((b: any) => { if (b?.image) preloadImages.push(b.image); });
        }
        // Deduplicate and preload all in parallel (non-blocking)
        const unique = [...new Set(preloadImages)];
        unique.forEach(src => {
          const img = new Image();
          img.src = src;
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

  const selectedHeroes = allHeroes.filter(h => selectedHeroIds.has(h.id));
  const maxMembers = currentRegion?.maxMembers || 5;
  const isBossQuest = currentQuest?.isBoss || false;
  const isFlashQuest = selectedQuestType === 'flash';

  // Compute party-buffed stats whenever party changes
  const heroIdKey = Array.from(selectedHeroIds).join(',');
  useEffect(() => {
    if (selectedHeroIds.size === 0) {
      setBuffedStats([]);
      setBuffSummary(null);
      return;
    }
    const heroes = allHeroes.filter(h => selectedHeroIds.has(h.id));
    if (heroes.length === 0) return;
    calculatePartyBuffs({ heroes, isBoss: isBossQuest, isFlashQuest })
      .then(({ summary, buffedStats: bs }) => {
        // Apply booster on top of party buffs
        if (selectedBooster !== 'none') {
          const boosterAtkPct = selectedBooster === 'mega' ? 0.8 : selectedBooster === 'super' ? 0.4 : 0.2;
          const boosterDefPct = boosterAtkPct;
          const boosterCrit = selectedBooster === 'mega' ? 25 : selectedBooster === 'super' ? 10 : 0;
          const boosterCritDmg = selectedBooster === 'mega' ? 50 : 0;
          
          bs.forEach((stat, i) => {
            const hero = heroes[i];
            const atkAdd = Math.floor((hero.atk || 0) * boosterAtkPct);
            const defAdd = Math.floor((hero.def || 0) * boosterDefPct);
            stat.atk += atkAdd;
            stat.deltaAtk += atkAdd;
            stat.def += defAdd;
            stat.deltaDef += defAdd;
            stat.crit += boosterCrit;
            stat.deltaCrit += boosterCrit;
            stat.critDmg += boosterCritDmg;
            stat.deltaCritDmg += boosterCritDmg;
          });
          
          const boosterNames: Record<string, string> = {
            normal: '전투력 부스터',
            super: '슈퍼 전투력 부스터',
            mega: '메가 전투력 부스터',
          };
          summary.sources.push({
            name: boosterNames[selectedBooster],
            type: 'aurasong',
            atkPct: boosterAtkPct * 100,
            defPct: boosterDefPct * 100,
            critPct: boosterCrit || undefined,
            critDmgPct: boosterCritDmg || undefined,
            note: '부스터',
          });
        }
        
        setBuffedStats(bs);
        setBuffSummary(summary);
      });
  }, [heroIdKey, isBossQuest, isFlashQuest, selectedBooster]);

  // Auto-run simulation when party or booster changes
  // IMPORTANT: Only run when buffedStats is ready (prevents fallback path with wrong aurasong values)
  useEffect(() => {
    if (!currentQuest || !currentRegion || selectedHeroes.length === 0) {
      setSimResult(null);
      return;
    }
    // Guard: wait until buffedStats is computed and matches hero count
    if (buffedStats.length !== selectedHeroes.length) {
      return;
    }
    setSimRunning(true);
    const timer = setTimeout(() => {
      const isTerrorTower = selectedQuestType === 'tot' && currentRegion.name === '공포';
      const bElements = currentQuest?.barrier ? (() => {
        const hasSubAreas2 = currentRegion && currentRegion.subAreas.length > 1;
        const barrierElement2 = hasSubAreas2 && selectedSubAreaIdx >= 0 && selectedSubAreaIdx !== 99
          ? (selectedSubAreaIdx === 0 ? currentQuest.barrier!.sub1 : selectedSubAreaIdx === 1 ? currentQuest.barrier!.sub2 : currentQuest.barrier!.sub3)
          : null;
        const rawElements = barrierElement2
          ? [barrierElement2]
          : [currentQuest.barrier!.sub1, currentQuest.barrier!.sub2, currentQuest.barrier!.sub3].filter(Boolean);
        return [...new Set(rawElements)] as string[];
      })() : [];
      const questMonster: QuestMonster = {
        hp: currentQuest.hp,
        atk: currentQuest.atk,
        aoe: currentQuest.aoe,
        aoeChance: currentQuest.aoeChance,
        def: currentQuest.def,
        isBoss: currentQuest.isBoss,
        isExtreme: currentQuest.isExtreme,
        barrier: currentQuest.barrier,
        barrierElement: bElements[0] || null,
      };
      // Boss quests never have mini-bosses
      const effectiveMiniBoss = currentQuest.isBoss ? 'none' as MiniBossType : selectedMiniBoss;
      // Always pass precomputed stats (buffedStats includes champion + aurasong + booster)
      const precomputed = buffedStats.map(bs => ({
        atk: bs.atk,
        def: bs.def,
        hp: bs.hp,
        crit: bs.crit,
        critDmg: bs.critDmg,
        evasion: bs.evasion,
      }));
      const result = runCombatSimulation({
        heroes: selectedHeroes,
        monster: questMonster,
        miniBoss: effectiveMiniBoss,
        booster: { type: selectedBooster },
        questTypeKey: selectedQuestType,
        regionName: currentRegion.name,
        isTerrorTower,
        precomputedStats: precomputed,
      });
      setSimResult(result);
      setSimRunning(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [heroIdKey, selectedBooster, selectedQuestIdx, selectedSubAreaIdx, selectedMiniBoss, buffSummary, buffedStats]);

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
      if (next.has(id)) next.delete(id);
      else if (next.size < currentRegion.maxMembers) next.add(id);
      return next;
    });
  };

  const openSlotForEdit = (slotIdx: number) => {
    setEditingSlotIdx(slotIdx);
    setHeroSelectOpen(true);
  };

  const openSlotForAdd = () => {
    setEditingSlotIdx(null);
    setHeroSelectOpen(true);
  };

  const clearQuest = () => {
    setSelectedQuestType('');
    setSelectedRegionIdx(-1);
    setSelectedSubAreaIdx(-1);
    setSelectedQuestIdx(-1);
    setSelectedHeroIds(new Set());
    setSelectedMiniBoss('random');
  };

  const handleQuestSelect = (sel: { questTypeKey: string; regionIdx: number; subAreaIdx: number; questIdx: number }) => {
    setSelectedQuestType(sel.questTypeKey);
    setSelectedRegionIdx(sel.regionIdx);
    setSelectedSubAreaIdx(sel.subAreaIdx);
    setSelectedQuestIdx(sel.questIdx);
    // 파티 구성 유지 (던전 변경시 초기화 안함)
    setSelectedMiniBoss('random');
  };

  const openConfigAtStep = (step: 'type' | 'region' | 'subarea' | 'difficulty') => {
    setConfigInitialStep(step);
    setConfigInitialState({
      questTypeKey: selectedQuestType,
      regionIdx: selectedRegionIdx,
      subAreaIdx: selectedSubAreaIdx,
    });
    setConfigOpen(true);
  };

  // Save current simulation result
  const handleSaveResult = () => {
    if (!simResult || !currentQuest || !currentRegion) return;
    const selectedHeroList = allHeroes.filter(h => selectedHeroIds.has(h.id));
    const questData = questDataMap[selectedQuestType];
    const regionName = currentRegion.name;
    const diffLabel = currentQuest.difficulty !== '없음' ? ` ${currentQuest.difficulty}` : '';
    const autoName = `${questData?.questType || ''} ${regionName}${diffLabel}`;

    const totalDmg = simResult.heroResults.reduce((s, hr) => s + hr.avgDamageDealt, 0);
    const heroSummaries = simResult.heroResults.map(hr => ({
      heroId: hr.heroId,
      heroName: hr.heroName,
      heroClass: selectedHeroList.find(h => h.id === hr.heroId)?.heroClass || '',
      survivalRate: hr.survivalRate,
      avgDamageDealt: hr.avgDamageDealt,
      damageShare: totalDmg > 0 ? (hr.avgDamageDealt / totalDmg * 100) : 0,
    }));

    saveSimulationResult({
      id: crypto.randomUUID(),
      name: autoName,
      savedAt: Date.now(),
      questTypeKey: selectedQuestType,
      regionIdx: selectedRegionIdx,
      subAreaIdx: selectedSubAreaIdx,
      questIdx: selectedQuestIdx,
      heroIds: Array.from(selectedHeroIds),
      booster: selectedBooster,
      miniBoss: selectedMiniBoss,
      winRate: simResult.winRate,
      avgRounds: simResult.avgRounds,
      minRounds: simResult.minRounds,
      maxRounds: simResult.maxRounds,
      heroSummaries,
    });

    toast({ title: '결과 저장 완료', description: autoName });
  };

  // Load a saved simulation
  const handleLoadSimulation = (sim: SavedSimulationSummary) => {
    setSelectedQuestType(sim.questTypeKey);
    setSelectedRegionIdx(sim.regionIdx);
    setSelectedSubAreaIdx(sim.subAreaIdx);
    setSelectedQuestIdx(sim.questIdx);
    setSelectedHeroIds(new Set(sim.heroIds));
    setSelectedBooster(sim.booster as any);
    setSelectedMiniBoss(sim.miniBoss as MiniBossType);
    setSubTab('simulation');
  };

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

  // Calculate damage reduction % for a given defense value using threshold interpolation
  const getDamageReductionForDef = (def: number): number => {
    const reductions = [-50, 0, 50, 70, 75];
    for (let i = defThresholds.length - 1; i >= 1; i--) {
      if (def >= defThresholds[i - 1].value) {
        const lower = defThresholds[i - 1].value;
        const upper = defThresholds[i].value;
        const lowerRed = reductions[i - 1];
        const upperRed = reductions[i];
        const t = upper > lower ? Math.min(1, (def - lower) / (upper - lower)) : 0;
        return lowerRed + t * (upperRed - lowerRed);
      }
    }
    return -50;
  };

  // Check if barrier is broken (for warning)
  const barrierBrokenGlobal = (() => {
    if (!currentQuest?.barrier || barrierElements.length === 0) return true;
    return barrierElements.every(el => {
      const heroSum = selectedHeroes.reduce((sum, h) => sum + getHeroBarrierContribution(h, el), 0);
      return heroSum >= currentQuest.barrier!.hp;
    });
  })();

  const questTimeSettings = timeSettings.filter(s => s.category === 'quest');
  const restTimeSettings = timeSettings.filter(s => s.category === 'rest');

  return (
    <div className="animate-fade-in">
      {/* Sub-tabs - bookmark style */}
      <div className="flex gap-0.5 mb-4 relative" style={{ paddingBottom: '1px' }}>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border/40" />
        {QUEST_SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`sub-tab-bookmark relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-all duration-200
                  ${isActive
                    ? 'bg-card text-primary border-border/60 z-10 shadow-sm -mb-px'
                    : 'bg-secondary/30 text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50 hover:-translate-y-0.5'
                  }`}
                data-active={isActive}
                style={isActive ? { boxShadow: '0 -2px 8px hsl(var(--primary) / 0.15)' } : {}}
              >
                <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.label}
              </button>
          );
        })}
      </div>

      {/* Tab: Saved Results */}
      <div style={{ display: subTab === 'saved' ? 'block' : 'none' }}>
        <SavedResults onLoadSimulation={handleLoadSimulation} refreshKey={subTab === 'saved' ? Date.now() : 0} />
      </div>

      {/* Tab: Compare */}
      <div style={{ display: subTab === 'compare' ? 'block' : 'none' }}>
        <CompareAnalysis refreshKey={subTab === 'compare' ? Date.now() : 0} />
      </div>

      {/* Tab: Simulation */}
      <div style={{ display: subTab === 'simulation' ? 'block' : 'none' }}>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">퀘스트 데이터 로딩 중...</p>
        </div>
      ) : allHeroes.length === 0 ? (
        <div className="text-center py-20">
          <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">먼저 리스트 관리에서 영웅을 추가해주세요</p>
        </div>
      ) : (
      <>
      {/* Action buttons are now inside the 주요 결과 header */}

      <div data-quest-screenshot>
      <div className="flex gap-4 flex-col lg:flex-row" data-quest-sim>

        {/* LEFT: Monster Info */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-primary" />
            <h3 className="text-lg text-foreground font-bold">몬스터 정보</h3>
            {currentQuest && (
              <button
                onClick={() => {
                  setSelectedQuestType('');
                  setSelectedRegionIdx(-1);
                  setSelectedSubAreaIdx(-1);
                  setSelectedQuestIdx(-1);
                  setSelectedMiniBoss('none');
                  setSelectedBooster('none');
                  setSimResult(null);
                }}
                className="ml-auto p-1.5 rounded-md bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors"
                title="몬스터 정보 초기화"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="card-fantasy p-4 pb-8 relative min-h-[440px]">
            {/* Region icon - top left, bigger */}
            {currentRegion && (
              <button
                onClick={() => openConfigAtStep('region')}
                className="absolute top-3 left-3 w-16 h-16 rounded-full border-2 border-primary/40 overflow-hidden bg-secondary/50 z-10 hover:border-primary/70 transition-all cursor-pointer"
                title="지역 변경"
              >
                <img src={currentRegion.areaImage} alt={currentRegion.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
              </button>
            )}

            {/* Booster slot - top right, symmetric with region icon */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="absolute top-3 right-3 w-16 h-16 rounded-full border-2 border-primary/40 overflow-hidden bg-secondary/50 z-10 flex items-center justify-center hover:border-primary/60 transition-all">
                  {selectedBooster !== 'none' && commonData?.boosters ? (() => {
                    const boosterKeys: Record<string, string> = { normal: '전투력 부스터', super: '슈퍼 전투력 부스터', mega: '메가 전투력 부스터' };
                    const boosterEntry = commonData.boosters[boosterKeys[selectedBooster]];
                    return boosterEntry ? (
                      <img src={boosterEntry.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">⚡</span>
                    );
                  })() : (
                    <Plus className="w-5 h-5 text-muted-foreground/40" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="end">
                <div className="text-xs font-medium text-foreground mb-2">전투력 부스터</div>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedBooster('none')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${selectedBooster === 'none' ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-secondary'}`}
                  >
                    없음
                  </button>
                  {(['normal', 'super', 'mega'] as const).map(bType => {
                    const names: Record<string, string> = { normal: '전투력 부스터', super: '슈퍼 전투력 부스터', mega: '메가 전투력 부스터' };
                    const descs: Record<string, string> = { normal: '공/방 +20%', super: '공/방 +40%, 치확 +10%', mega: '공/방 +80%, 치확 +25%, 치명타 대미지 +50%' };
                    const bEntry = commonData?.boosters?.[names[bType]];
                    return (
                      <button
                        key={bType}
                        onClick={() => setSelectedBooster(bType)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${selectedBooster === bType ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-secondary'}`}
                      >
                        {bEntry && <img src={bEntry.image} alt="" className="w-6 h-6 rounded" />}
                        <div className="text-left">
                          <div className="font-medium">{names[bType]}</div>
                          <div className="text-[10px] text-muted-foreground">{descs[bType]}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Quest select button - centered, larger with less cropping */}
            <div className="flex justify-center pt-2 mb-4">
              <button
                onClick={() => {
                  if (!currentQuest) {
                    // 아무것도 선택 안 된 상태: 처음부터
                    setConfigInitialStep(undefined);
                    setConfigInitialState(undefined);
                    setConfigOpen(true);
                  } else {
                    // 이미 선택된 상태: 세부 지역부터
                    openConfigAtStep(hasSubAreas ? 'subarea' : 'difficulty');
                  }
                }}
                className={`relative w-32 h-32 rounded-full border-2 transition-all flex items-center justify-center overflow-hidden group ${
                  currentQuest
                    ? 'border-primary/60 glow-gold'
                    : 'border-dashed border-muted-foreground/40 hover:border-primary/50'
                }`}
              >
                {currentQuest && centerImage ? (
                  <>
                    <img src={centerImage} alt="" className="w-full h-full object-cover scale-90" />
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
                    <button
                      onClick={() => openConfigAtStep('difficulty')}
                      className={`font-medium cursor-pointer hover:underline ${
                        currentQuest.difficulty === '쉬움' ? 'text-lime-400' :
                        currentQuest.difficulty === '보통' ? 'text-blue-400' :
                        currentQuest.difficulty === '어려움' ? 'text-orange-400' :
                        currentQuest.difficulty === '익스트림' ? 'text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]' : 'text-muted-foreground'
                      }`}
                      title="난이도 변경"
                    >{currentQuest.difficulty}</button>
                  </div>
                )}

                {/* Line 3: Boss or Mini Boss selector */}
                {currentQuest.isBoss ? (
                  <div className="text-center text-sm">
                    <span className="text-red-400">
                      <Crown className="w-3.5 h-3.5 inline mr-0.5" />보스
                    </span>
                  </div>
                ) : !currentQuest.isBoss && selectedSubAreaIdx !== 99 && (
                  <div className="text-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`text-xs px-2 py-0.5 rounded border transition-all ${
                          selectedMiniBoss !== 'random'
                            ? selectedMiniBoss === 'huge' ? 'border-lime-500/40 bg-lime-500/10 text-lime-400' :
                              selectedMiniBoss === 'agile' ? 'border-blue-500/40 bg-blue-500/10 text-blue-400' :
                              selectedMiniBoss === 'dire' ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                              selectedMiniBoss === 'wealthy' ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' :
                              selectedMiniBoss === 'legendary' ? 'border-purple-500/40 bg-purple-500/10 text-purple-400' :
                              'border-border/40 text-muted-foreground hover:border-primary/40'
                            : 'border-primary/40 bg-primary/10 text-primary'
                        }`}>
                          {selectedMiniBoss === 'random' ? '랜덤 (2%)' :
                           selectedMiniBoss === 'none' ? '미니보스 없음' :
                           selectedMiniBoss === 'huge' ? '거대한' :
                           selectedMiniBoss === 'agile' ? '민첩한' :
                           selectedMiniBoss === 'dire' ? '흉포한' :
                           selectedMiniBoss === 'wealthy' ? '부유한' :
                           selectedMiniBoss === 'legendary' ? '전설의' : '미니보스'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-2" align="center">
                        <div className="text-xs font-medium text-foreground mb-2">미니보스 수식어</div>
                        <div className="space-y-1">
                          {([
                            { id: 'random', label: '랜덤', desc: '2% 확률로 미니보스 등장', color: 'text-primary' },
                            { id: 'none', label: '없음 (항상)', desc: '미니보스 없음 고정', color: '' },
                            { id: 'huge', label: '거대한 (항상)', desc: 'HP ×2, 광역 확률 ×3', color: 'text-lime-400' },
                            { id: 'agile', label: '민첩한 (항상)', desc: '회피 40%', color: 'text-blue-400' },
                            { id: 'dire', label: '흉포한 (항상)', desc: 'HP ×1.5, 치확 30%', color: 'text-red-400' },
                            { id: 'wealthy', label: '부유한 (항상)', desc: '보상 증가', color: 'text-yellow-400' },
                            { id: 'legendary', label: '전설의 (항상)', desc: 'HP ×1.5, ATK ×1.25, 치확 15%, 회피 10%', color: 'text-purple-400' },
                          ] as const).map(mb => (
                            <button
                              key={mb.id}
                              onClick={() => setSelectedMiniBoss(mb.id as MiniBossType)}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                selectedMiniBoss === mb.id ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-secondary'
                              }`}
                            >
                              <span className={`font-medium ${mb.color}`}>{mb.label}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">{mb.desc}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* (time display removed) */}

                {/* Line 4: Element Barrier */}
                {barrierElements.length > 0 && currentQuest.barrier && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-4">
                      {barrierElements.map((el, i) => {
                        const iconPath = commonData?.elementalBarriers?.[el]?.image;
                        const heroSum = selectedHeroes.reduce((sum, h) => sum + getHeroBarrierContribution(h, el), 0);
                        const required = currentQuest.barrier!.hp;
                        const isMet = heroSum >= required;
                        return (
                          <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isMet ? 'border-lime-500/40 bg-lime-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                            {iconPath && <img src={iconPath} alt="" className="w-7 h-7" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                            <span className={`text-sm font-mono font-bold ${isMet ? 'text-lime-400' : 'text-red-400'}`}>
                              {formatNumber(heroSum)} / {formatNumber(required)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {!barrierBrokenGlobal && selectedHeroes.length > 0 && (
                      <div className="text-center">
                        <span className="text-[10px] text-red-400 font-medium">
                          ⚠ 배리어 미충족: 대미지 20%로 감소
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats: vertical list */}
                {(() => {
                  // Calculate modified values based on mini-boss
                  const hpMod = selectedMiniBoss === 'huge' ? 2.0 : selectedMiniBoss === 'dire' ? 1.5 : selectedMiniBoss === 'legendary' ? 1.5 : 1.0;
                  const atkMod = selectedMiniBoss === 'legendary' ? 1.25 : 1.0;
                  const aoeMod = selectedMiniBoss === 'huge' ? 3.0 : 1.0;
                  const displayHp = Math.round(currentQuest.hp * hpMod);
                  const displayAtk = Math.round(currentQuest.atk * atkMod);
                  const displayAoeChance = Math.min(currentQuest.aoeChance * aoeMod, 100);
                  const displayAoe = Math.round(currentQuest.aoe * atkMod);
                  const finalCrit = selectedMiniBoss === 'dire' ? 30 : selectedMiniBoss === 'legendary' ? 15 : 10;
                  const mobEva = selectedMiniBoss === 'agile' ? 40 : selectedMiniBoss === 'legendary' ? 10 : 0;
                  const isHpMod = hpMod !== 1.0;
                  const isAtkMod = atkMod !== 1.0;
                  const isAoeMod = aoeMod !== 1.0;
                  const isCritMod = selectedMiniBoss === 'dire' || selectedMiniBoss === 'legendary';
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-border/30">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-xs text-foreground">체력</span>
                        </div>
                        <span className={`text-sm font-bold font-mono ${isHpMod ? 'text-lime-400' : 'text-foreground'}`}>
                          {formatNumber(displayHp)}
                          {isHpMod && <span className="text-[10px] text-muted-foreground ml-1">(×{hpMod})</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                          <Swords className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-xs text-foreground">공격력</span>
                        </div>
                        <span className={`text-sm font-bold font-mono ${isAtkMod ? 'text-orange-400' : 'text-foreground'}`}>
                          {formatNumber(displayAtk)}
                          {isAtkMod && <span className="text-[10px] text-muted-foreground ml-1">(×{atkMod})</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="text-xs text-foreground">광역 공격 확률</span>
                        </div>
                        <span className={`text-sm font-bold font-mono ${isAoeMod ? 'text-yellow-400' : 'text-foreground'}`}>
                          {displayAoeChance}%
                          {isAoeMod && <span className="text-[10px] text-muted-foreground ml-1">(×{aoeMod})</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                          <Swords className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="text-xs text-foreground">광역 대미지</span>
                        </div>
                        <span className={`text-sm font-bold font-mono ${isAtkMod ? 'text-orange-400' : 'text-foreground'}`}>
                          {formatNumber(displayAoe)}
                          {isAtkMod && <span className="text-[10px] text-muted-foreground ml-1">(×{atkMod})</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                          <Crosshair className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="text-xs text-foreground">치명타 확률</span>
                        </div>
                        <span className={`text-sm font-bold font-mono ${isCritMod ? 'text-red-400' : 'text-foreground'}`}>
                          {finalCrit}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                          <Wind className="w-3.5 h-3.5 text-teal-400" />
                          <span className="text-xs text-foreground">회피</span>
                        </div>
                        <span className={`text-sm font-bold font-mono ${mobEva > 0 ? 'text-teal-400' : 'text-foreground'}`}>{mobEva}%</span>
                      </div>
                      {/* Always show defense bar label when monster is selected */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-xs text-foreground">방어력 기준치</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Defense Reference - inside monster info (show even without party) */}
                {(() => {
                  const hasHeroes = selectedHeroes.length > 0 && buffedStats.length > 0;
                  const defToBarPct = (def: number) => {
                    for (let i = defThresholds.length - 1; i >= 1; i--) {
                      const upper = defThresholds[i];
                      const lower = defThresholds[i - 1];
                      if (def >= lower.value) {
                        const segPct = upper.value > lower.value ? (def - lower.value) / (upper.value - lower.value) : 0;
                        const lowerPos = ((i - 1) / (defThresholds.length - 1)) * 100;
                        const upperPos = (i / (defThresholds.length - 1)) * 100;
                        return Math.min(100, lowerPos + segPct * (upperPos - lowerPos));
                      }
                    }
                    return 0;
                  };

                  const barH = 260;
                  const reductions = [-50, 0, 50, 70, 75];
                  const rows = defThresholds.map((t, i) => ({
                    key: t.key, label: t.label, value: t.value, color: t.color, textClass: t.textClass,
                    pct: (i / (defThresholds.length - 1)) * 100,
                    applied: Math.round(100 - reductions[i]),
                  }));

                  const getHeroColor = (heroDef: number): string => {
                    let color = defThresholds[0].color;
                    for (const t of defThresholds) { if (heroDef >= t.value) color = t.color; }
                    return color;
                  };

                  const heroEntries = hasHeroes ? selectedHeroes.map((h, hi) => {
                    const bs = buffedStats[hi];
                    const heroDef = bs ? bs.def : (h.def || 0);
                    const pinPct = defToBarPct(heroDef);
                    const dmgApplied = Math.round(100 - getDamageReductionForDef(heroDef));
                    const color = getHeroColor(heroDef);
                    return { id: h.id, name: h.name, heroDef, pinPct, dmgApplied, color };
                  }) : [];

                  const n = heroEntries.length;
                  const labelPcts = n <= 1 ? [50] : Array.from({ length: n }, (_, i) => (i / (n - 1)) * 100);
                  const sortedByPin = [...heroEntries].sort((a, b) => a.pinPct - b.pinPct);
                  const heroLayout = sortedByPin.map((h, idx) => ({ ...h, labelPct: labelPcts[idx] }));

                    return (
                    <div className="mt-6 pt-4 border-t border-border/30">
                      <div className="relative grid grid-cols-[50px_18px_1fr] gap-x-1.5" style={{ height: `${barH}px` }}>
                        <div className="relative">
                          {rows.map(r => (
                            <div key={r.key} className="absolute right-0 flex items-center" style={{ bottom: `${r.pct}%`, transform: 'translateY(50%)' }}>
                              <span className={`text-[11px] font-mono font-semibold tabular-nums ${r.textClass}`}>{r.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full overflow-hidden border border-border/50" style={{
                            background: 'linear-gradient(to top, #581c87 0%, #7f1d1d 15%, #a16207 35%, #854d0e 50%, #65a30d 75%, #e5e5e5 100%)'
                          }} />
                          {rows.map(r => (
                            <div key={`tick-${r.key}`} className="absolute left-0 right-0 flex items-center pointer-events-none" style={{ bottom: `${r.pct}%`, transform: 'translateY(50%)', zIndex: 2 }}>
                              <div className="h-[2px] w-full" style={{ backgroundColor: r.color, opacity: 0.9 }} />
                            </div>
                          ))}
                          {heroEntries.map(h => (
                            <div key={`pin-${h.id}`} className="absolute" style={{ bottom: `${h.pinPct}%`, left: '50%', transform: 'translate(-50%, 50%)', zIndex: 10 }}>
                              <div className="w-4 h-4 rounded-full border-[2.5px] shadow-[0_0_8px_rgba(255,255,255,0.6)]" style={{ borderColor: '#fff', backgroundColor: h.color }} />
                            </div>
                          ))}
                        </div>
                        <div className="relative ml-1.5">
                          {rows.map(r => (
                            <div key={`thr-${r.key}`} className="absolute left-0 flex items-center gap-1.5" style={{ bottom: `${r.pct}%`, transform: 'translateY(50%)', zIndex: 1 }}>
                              <span className={`text-[11px] font-mono font-semibold tabular-nums ${r.textClass}`}>{formatNumber(r.value)}</span>
                              <span className={`text-[10px] font-mono tabular-nums opacity-70 ${r.textClass}`}>({r.applied}%)</span>
                            </div>
                          ))}
                          {/* SVG bezier curves for connecting hero pins to labels */}
                          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ overflow: 'visible' }}>
                            {heroLayout.map(h => {
                              const yPin = (1 - h.pinPct / 100) * barH;
                              const yLabel = (1 - h.labelPct / 100) * barH;
                              const x1 = 70;
                              const x2 = 98;
                              const cx = (x1 + x2) / 2;
                              return (
                                <path key={`line-${h.id}`}
                                  d={`M ${x1} ${yPin} C ${cx} ${yPin}, ${cx} ${yLabel}, ${x2} ${yLabel}`}
                                  fill="none" stroke={h.color} strokeWidth="1.5" opacity="0.8"
                                />
                              );
                            })}
                          </svg>
                          {heroLayout.map(h => (
                            <div key={`label-${h.id}`} className="absolute flex flex-col whitespace-nowrap" style={{ bottom: `${h.labelPct}%`, left: '100px', transform: 'translateY(50%)', zIndex: 5 }}>
                              <span className="text-[11px] font-semibold truncate max-w-[90px] leading-tight" style={{ color: h.color }}>{h.name}</span>
                              <span className="text-[10px] font-mono font-semibold tabular-nums leading-tight" style={{ color: h.color }}>
                                {formatNumber(h.heroDef)} ({h.dmgApplied}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
            <h3 className="text-lg text-foreground font-bold">파티 구성</h3>
            <span className="text-xs text-muted-foreground ml-auto">{selectedHeroIds.size}/{maxMembers}</span>
            {selectedHeroIds.size > 0 && (
              <button
                onClick={() => setSelectedHeroIds(new Set())}
                className="ml-1 p-1.5 rounded-md bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors"
                title="파티 구성 초기화"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="card-fantasy p-4 overflow-x-auto">
            {currentQuest && selectedHeroes.length > 0 && (
              <div className="mb-3 flex items-center gap-3">
                <Button
                  onClick={() => setBuffBreakdownOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  📊 스탯 계산표
                </Button>
              </div>
            )}
            {/* Win Rate - between stat button and element row */}
            {currentQuest && selectedHeroes.length > 0 && simResult && (
              <div className="mb-3 text-center">
                <div className="text-[10px] text-muted-foreground mb-0.5">승률</div>
                <div className={`text-2xl font-bold font-mono ${
                  simResult.winRate >= 90 ? 'text-lime-400' :
                  simResult.winRate >= 70 ? 'text-lime-400' :
                  simResult.winRate >= 50 ? 'text-yellow-400' :
                  simResult.winRate >= 30 ? 'text-orange-400' : 'text-red-400'
                }`}>
                  {simResult.winRate.toFixed(1)}%
                </div>
                {simResult.retryWinRate !== undefined && (
                  <div className="text-[9px] text-muted-foreground space-y-0.5 mt-1">
                    <div>1차 시도: <span className="text-foreground">{simResult.rawWinRate.toFixed(1)}%</span></div>
                    <div>2차 시도 (부스터 적용): <span className="text-foreground">{simResult.retryWinRate.toFixed(1)}%</span></div>
                  </div>
                )}
                {simRunning && (
                  <div className="flex items-center justify-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> 계산 중...
                  </div>
                )}
              </div>
            )}
            <table className="w-full text-xs table-fixed">
              <colgroup>
                <col style={{ width: '72px' }} />
                {Array.from({ length: maxMembers }).map((_, i) => (
                  <col key={i} style={{ width: `${(100 - 10) / maxMembers}%` }} />
                ))}
              </colgroup>
              <tbody>
                {/* Row: Element barrier icons */}
                {barrierElements.length > 0 && (
                  <tr>
                    <td className="py-1 px-1.5 text-foreground/70 text-sm">원소</td>
                    {Array.from({ length: maxMembers }).map((_, slotIdx) => {
                      const hero = selectedHeroes[slotIdx];
                      if (!hero) return <td key={`el-empty-${slotIdx}`} className="text-center py-1" />;
                      const isSpellKnight = SPELLKNIGHT_CLASSES.includes(hero.heroClass);
                      if (isSpellKnight) {
                        // Show '모든 원소' icon with total * 50%
                        const allTotal = Object.values(hero.equipmentElements || {}).reduce((a, b) => a + b, 0);
                        const halfTotal = Math.floor(allTotal * 0.5);
                        return (
                          <td key={hero.id} className="text-center py-1">
                            <div className="flex justify-center gap-1">
                              <div className="flex flex-col items-center">
                                <img src="/images/elements/all.webp" alt="모든 원소" className="w-5 h-5" />
                                <span className="text-xs font-mono font-bold text-purple-300">{halfTotal > 0 ? formatNumber(halfTotal) : '-'}</span>
                              </div>
                            </div>
                          </td>
                        );
                      }
                      const icons = barrierElements.map(el => ({
                        el, iconPath: ELEMENT_ICON_MAP[el], val: hero.equipmentElements?.[el] || 0,
                      })).filter(b => b.val > 0);
                      return (
                        <td key={hero.id} className="text-center py-1">
                          <div className="flex justify-center gap-1">
                            {icons.length > 0 ? icons.map(b => (
                              <div key={b.el} className="flex flex-col items-center">
                                {b.iconPath && <img src={b.iconPath} alt={b.el} className="w-5 h-5" />}
                                <span className="text-xs font-mono font-bold text-purple-300">{formatNumber(b.val)}</span>
                              </div>
                            )) : <span className="text-xs text-foreground/30">-</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}
                {/* Row: Face - based on death count, using face images */}
                <tr>
                  <td className="py-1 px-1.5 text-foreground/70 text-sm">표정</td>
                  {Array.from({ length: maxMembers }).map((_, slotIdx) => {
                    const hero = selectedHeroes[slotIdx];
                    if (!hero) return <td key={`face-empty-${slotIdx}`} className="text-center py-1" />;
                    
                    const heroResult = simResult?.heroResults.find(r => r.heroId === hero.id);
                    const totalSims = simResult?.totalSimulations || 1;
                    const scale = totalSims / 20;
                    
                    let faceImg = '/images/quest/face/icon_shop_face_A.webp';
                    if (heroResult && simResult) {
                      const deathCount = totalSims - Math.round(heroResult.survivalRate / 100 * totalSims);
                      const belowMinPower = currentQuest && hero.power > 0 && hero.power < currentQuest.minPower;
                      
                      if (belowMinPower || deathCount >= 20 * scale) faceImg = '/images/quest/face/icon_shop_face_D.webp';
                      else if (deathCount >= 12 * scale) faceImg = '/images/quest/face/icon_shop_face_C.webp';
                      else if (deathCount >= 8 * scale) faceImg = '/images/quest/face/icon_shop_face_B.webp';
                      else if (deathCount >= 3 * scale) faceImg = '/images/quest/face/icon_shop_face_A.webp';
                      else if (deathCount >= 0.01 * scale) faceImg = '/images/quest/face/icon_shop_face_S.webp';
                      else if (simResult.avgRounds <= 1 && simResult.winRate >= 99.9) faceImg = '/images/quest/face/icon_shop_face_SSS.webp';
                      else faceImg = '/images/quest/face/icon_shop_face_S.webp';
                    }
                    
                    return (
                      <td key={hero.id} className="text-center py-1">
                        <img src={faceImg} alt="face" className="w-8 h-8 mx-auto" />
                      </td>
                    );
                  })}
                </tr>
                {/* Row: Hero circle (job image) */}
                <tr>
                  <td className="py-1 px-1.5">
                    <button
                      onClick={() => setJobDisplayMode(m => m === 'icon' ? 'illust' : m === 'illust' ? 'none' : 'icon')}
                      className="text-foreground/70 hover:text-foreground transition-colors flex items-center gap-0.5 text-sm"
                      title="클릭하여 직업 표시 방식 변경 (아이콘 → 일러스트 → 없음)"
                    >
                      직업
                      <span className="text-[10px] opacity-50 ml-0.5">
                        {jobDisplayMode === 'icon' ? '●○○' : jobDisplayMode === 'illust' ? '○●○' : '○○●'}
                      </span>
                    </button>
                  </td>
                  {Array.from({ length: maxMembers }).map((_, slotIdx) => {
                    const hero = selectedHeroes[slotIdx];
                    if (!hero) {
                      return (
                        <td key={`slot-empty-${slotIdx}`} className="text-center py-2">
                          <button
                            onClick={() => currentQuest && openSlotForAdd()}
                            className={`w-16 h-16 rounded-full border-2 border-dashed inline-flex items-center justify-center transition-all ${
                              currentQuest ? 'border-muted-foreground/30 hover:border-primary/50 cursor-pointer' : 'border-muted-foreground/15 cursor-not-allowed'
                            }`}>
                            <Plus className="w-5 h-5 text-muted-foreground/30" />
                          </button>
                        </td>
                      );
                    }
                    const belowMin = currentQuest && hero.power > 0 && hero.power < currentQuest.minPower;
                    const iconImg = hero.type === 'champion'
                      ? getChampionImagePath(hero.championName || hero.name)
                      : hero.heroClass ? getJobImagePath(hero.heroClass) : null;
                    const illustImg = hero.type === 'champion'
                      ? getChampionImagePath(hero.championName || hero.name)
                      : hero.heroClass ? getJobIllustPath(hero.heroClass) : null;

                    if (jobDisplayMode === 'none') {
                      return (
                        <td key={hero.id} className="text-center py-2">
                          <div className="relative inline-flex flex-col items-center gap-0.5 group">
                            {belowMin && (
                              <span className="text-[10px] font-mono text-red-400 font-bold">⚠ {formatNumber(hero.power)}</span>
                            )}
                            <button onClick={() => openSlotForEdit(slotIdx)}
                              className={`relative w-8 h-8 rounded-full border-2 bg-secondary/50 flex items-center justify-center transition-all ${
                                belowMin ? 'border-red-500/70' : 'border-primary/30'
                              } hover:border-primary/70`}
                              title={`${hero.name} (클릭하여 변경)`}>
                              <span className="text-xs">⚔</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleHero(hero.id); }}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                              title="제거">✕</button>
                          </div>
                        </td>
                      );
                    }

                    if (jobDisplayMode === 'illust') {
                      return (
                        <td key={hero.id} className="text-center py-1">
                          <div className="relative inline-flex flex-col items-center gap-0.5 group">
                            {belowMin && (
                              <span className="text-[10px] font-mono text-red-400 font-bold">⚠ {formatNumber(hero.power)}</span>
                            )}
                            <button onClick={() => openSlotForEdit(slotIdx)}
                              className="relative w-36 h-36 flex items-center justify-center overflow-hidden transition-all hover:opacity-80 rounded"
                              title={`${hero.name} (클릭하여 변경)`}>
                              {illustImg ? (
                                <img src={illustImg} alt="" className="w-full h-full object-cover object-center" onError={e => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <span className="text-lg">⚔</span>
                              )}
                              <div className="absolute inset-0 bg-primary/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-foreground text-xs font-bold">변경</span>
                              </div>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleHero(hero.id); }}
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                              title="제거">✕</button>
                          </div>
                        </td>
                      );
                    }

                    // icon mode (default)
                    return (
                      <td key={hero.id} className="text-center py-2">
                        <div className="relative inline-flex flex-col items-center gap-0.5 group">
                          {belowMin && (
                            <span className="text-[10px] font-mono text-red-400 font-bold">⚠ {formatNumber(hero.power)}</span>
                          )}
                          <button onClick={() => openSlotForEdit(slotIdx)}
                            className={`relative w-16 h-16 rounded-full border-2 bg-secondary/50 flex items-center justify-center overflow-hidden transition-all ${
                              belowMin ? 'border-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'border-primary/50'
                            } hover:border-primary/70`}
                            title={`${hero.name} (클릭하여 변경)`}>
                            {iconImg ? (
                              <img src={iconImg} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <span className="text-lg">⚔</span>
                            )}
                            <div className="absolute inset-0 bg-primary/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                              <span className="text-foreground text-xs font-bold">변경</span>
                            </div>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleHero(hero.id); }}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                            title="제거">✕</button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                {/* Row: Name */}
                <tr className="border-b border-border/30">
                  <td className="py-1 px-1.5 text-foreground/70 text-sm">이름</td>
                  {Array.from({ length: maxMembers }).map((_, slotIdx) => {
                    const hero = selectedHeroes[slotIdx];
                    return (
                      <td key={hero?.id || `name-empty-${slotIdx}`} className="text-center py-1">
                        {hero && (
                          <div>
                            <div className="text-sm text-foreground font-medium truncate">{hero.name}</div>
                            <div className="text-xs text-foreground/60">{hero.heroClass || hero.championName || ''}</div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {/* Stat rows - order: HP, ATK, CRIT.DMG, DEF, CRIT.C, EVA, THREAT */}
                {selectedHeroes.length > 0 && (() => {
                  const hasEvasionPenalty = currentQuest && (
                    currentQuest.isExtreme ||
                    (selectedQuestType === 'tot' && currentRegion?.name === '공포')
                  );

                  // Check if barrier is broken
                  const barrierBroken = (() => {
                    if (!currentQuest?.barrier || barrierElements.length === 0) return true;
                    const heroSum = selectedHeroes.reduce((sum, h) => {
                      return sum + barrierElements.reduce((s, el) => s + getHeroBarrierContribution(h, el), 0);
                    }, 0);
                    return heroSum >= currentQuest.barrier.hp;
                  })();

                  const statRows = [
                    { label: 'HP', key: 'hp', bKey: 'hp', dKey: 'deltaHp', color: 'text-orange-400', labelColor: 'text-orange-400' },
                    { label: 'ATK', key: 'atk', bKey: 'atk', dKey: 'deltaAtk', color: 'text-red-400', labelColor: 'text-red-400' },
                    { label: 'DEF', key: 'def', bKey: 'def', dKey: 'deltaDef', color: 'text-blue-400', labelColor: 'text-blue-400' },
                    { label: 'CRIT.C', key: 'crit', bKey: 'crit', dKey: 'deltaCrit', color: 'text-yellow-400', suffix: '%', labelColor: 'text-yellow-400' },
                    { label: 'CRIT.D', key: 'critAttack', bKey: 'critAttack', dKey: null, color: 'text-yellow-400', computed: true, labelColor: 'text-yellow-400' },
                    { label: 'EVA', key: 'evasion', bKey: 'evasion', dKey: 'deltaEvasion', color: 'text-teal-400', suffix: '%', labelColor: 'text-teal-400' },
                    { label: 'THREAT', key: 'threat', bKey: 'threat', dKey: null, color: 'text-foreground', labelColor: 'text-foreground/70' },
                  ];

                  const hasBuffs = buffSummary && buffSummary.sources.length > 0;

                  return (
                    <>
                      {statRows.map(stat => (
                        <tr key={stat.key} className="border-b border-border/20">
                          <td className={`py-1.5 px-1.5 font-medium text-sm ${(stat as any).labelColor || 'text-foreground/70'}`}>{stat.label}</td>
                          {Array.from({ length: maxMembers }).map((_, slotIdx) => {
                            const hero = selectedHeroes[slotIdx];
                            if (!hero) return <td key={`stat-empty-${slotIdx}`} />;
                            const bs = buffedStats[slotIdx];
                            
                            let val: number;
                            let delta = 0;
                            if (bs && hasBuffs) {
                              if ((stat as any).computed) {
                                val = Math.floor(bs.atk * bs.critDmg / 100);
                                const rawVal = Math.floor((hero.atk || 0) * (hero.critDmg || 0) / 100);
                                delta = val - rawVal;
                              } else {
                                val = (bs as any)[stat.bKey] || 0;
                                delta = stat.dKey ? ((bs as any)[stat.dKey] || 0) : 0;
                              }
                            } else {
                              val = (stat as any).computed
                                ? Math.floor((hero.atk || 0) * (hero.critDmg || 0) / 100)
                                : (hero as any)[stat.key] || 0;
                            }
                            
                            // Evasion special handling
                            let displayColor = stat.color;
                            let evasionNote = '';
                            let barrierNote = '';
                            if (stat.key === 'evasion') {
                              const hasRockStompers = hero.equipmentSlots?.some(s => s.item?.name === '락 스톰퍼') || false;
                              const isPathfinder = (hero.heroClass || '').includes('길잡이');
                              const cap = isPathfinder ? 78 : 75;
                              if (hasRockStompers) {
                                val = 0;
                                delta = 0;
                              } else {
                                if (hasEvasionPenalty) {
                                  val = val - 20;
                                  delta = delta - 20;
                                }
                                if (val > cap) {
                                  evasionNote = `(${val}%)`;
                                  val = cap;
                                }
                              }
                              if (val < 0) displayColor = 'text-purple-400';
                            }

                            // Crit chance: cap display at 100%, show raw in parentheses
                            let critCapNote = '';
                            let rawCritVal = 0;
                            if (stat.key === 'crit' && val > 100) {
                              rawCritVal = val;
                              critCapNote = `(실제: ${rawCritVal}%)`;
                              val = 100;
                            }

                            // Barrier not broken: ATK and CRIT.DMG show 20% values
                            let barrierOriginal = 0;
                            if (!barrierBroken && (stat.key === 'atk' || (stat as any).computed)) {
                              barrierOriginal = val;
                              val = Math.floor(val * 0.2);
                              displayColor = 'text-purple-400';
                            }
                            
                            return (
                              <td key={hero.id} className={`py-1.5 px-1 text-center font-mono text-sm font-bold ${displayColor}`}>
                                <div className="flex flex-col items-center">
                                  <span>
                                    {stat.suffix ? `${val}${stat.suffix}` : val !== 0 ? formatNumber(val) : '-'}
                                  </span>
                                  {barrierOriginal > 0 && (
                                    <span className="text-[11px] text-muted-foreground leading-tight">({formatNumber(barrierOriginal)})</span>
                                  )}
                                  {evasionNote && <span className="text-[9px]">{evasionNote}</span>}
                                  {critCapNote && <span className="text-[9px] text-muted-foreground">{critCapNote}</span>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Targeting chance row (threat-based) */}
                      <tr className="border-b border-border/20 bg-muted/20">
                        <td className="py-1.5 px-1.5 text-foreground/70 font-medium text-sm">피격 확률</td>
                        {(() => {
                          const totalThreat = selectedHeroes.reduce((sum, h) => sum + (h.threat || 1), 0);
                          return Array.from({ length: maxMembers }).map((_, slotIdx) => {
                            const hero = selectedHeroes[slotIdx];
                            if (!hero) return <td key={`hit-empty-${slotIdx}`} />;
                            const threat = hero.threat || 1;
                            const targetChance = totalThreat > 0 ? (threat / totalThreat) * 100 : 0;
                            return (
                              <td key={hero.id} className="py-1.5 px-1 text-center font-mono text-sm font-bold">
                                <span className={targetChance >= 40 ? 'text-red-400' : targetChance >= 25 ? 'text-yellow-400' : 'text-lime-400'}>
                                  {targetChance.toFixed(1)}%
                                </span>
                              </td>
                            );
                          });
                        })()}
                      </tr>
                      {/* Monster Crit Chance row - same logic as detailed results */}
                      {simResult && (
                        <tr className="border-b border-border/20 bg-muted/20">
                          <td className="py-1.5 px-1.5 text-red-400 font-medium text-sm">M.CRIT.C</td>
                          {Array.from({ length: maxMembers }).map((_, slotIdx) => {
                            const hero = selectedHeroes[slotIdx];
                            if (!hero) return <td key={`mcrit-empty-${slotIdx}`} />;
                            const heroResult = simResult.heroResults.find(r => r.heroId === hero.id);
                            if (!heroResult) return <td key={`mcrit-na-${slotIdx}`} className="text-center text-foreground/30">-</td>;
                            const mc = heroResult.monsterCritChance;
                            return (
                              <td key={hero.id} className="py-1.5 px-1 text-center font-mono text-sm font-bold">
                                <span className={mc > 10 ? 'text-red-400' : 'text-orange-300'}>
                                  {mc}%
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Contribution Panels - always show skeleton */}
        <div className="w-full lg:w-80 shrink-0">
              {/* Main Results Header + Action Buttons */}
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-5 h-5 text-primary" />
                <h3 className="text-lg text-foreground font-bold">주요 결과</h3>
                {/* Action buttons - right aligned, icon only */}
                {currentQuest && selectedHeroes.length > 0 && simResult && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      className="p-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                      title="1회 추적 로그"
                      onClick={() => {
                        if (!currentQuest || !currentRegion) return;
                        const isTerrorTower = selectedQuestType === 'tot' && currentRegion.name === '공포';
                        const bElements = currentQuest?.barrier ? (() => {
                          const hasSubAreas2 = currentRegion && currentRegion.subAreas.length > 1;
                          const barrierElement2 = hasSubAreas2 && selectedSubAreaIdx >= 0 && selectedSubAreaIdx !== 99
                            ? (selectedSubAreaIdx === 0 ? currentQuest.barrier!.sub1 : selectedSubAreaIdx === 1 ? currentQuest.barrier!.sub2 : currentQuest.barrier!.sub3)
                            : null;
                          const rawElements = barrierElement2
                            ? [barrierElement2]
                            : [currentQuest.barrier!.sub1, currentQuest.barrier!.sub2, currentQuest.barrier!.sub3].filter(Boolean);
                          return [...new Set(rawElements)] as string[];
                        })() : [];
                        const questMonster: QuestMonster = {
                          hp: currentQuest.hp, atk: currentQuest.atk, aoe: currentQuest.aoe,
                          aoeChance: currentQuest.aoeChance, def: currentQuest.def,
                          isBoss: currentQuest.isBoss, isExtreme: currentQuest.isExtreme,
                          barrier: currentQuest.barrier, barrierElement: bElements[0] || null,
                        };
                        const entries = runSingleCombatLog({
                          heroes: selectedHeroes, monster: questMonster,
                          miniBoss: selectedMiniBoss, booster: { type: selectedBooster },
                          questTypeKey: selectedQuestType, regionName: currentRegion.name, isTerrorTower,
                        });
                        setCombatLog(entries);
                        setCombatLogDialogOpen(true);
                      }}
                    >
                      <Dices className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                      title="결과 저장"
                      onClick={handleSaveResult}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                      title="스크린샷 저장"
                      onClick={async () => {
                        const el = document.querySelector('[data-quest-screenshot]') as HTMLElement;
                        if (!el) return;
                        const overlay = document.createElement('div');
                        overlay.id = 'screenshot-overlay';
                        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';
                        overlay.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:white;font-size:14px"><div style="width:32px;height:32px;border:3px solid white;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></div>스크린샷 저장 중...</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
                        document.body.appendChild(overlay);
                        try {
                          const { default: html2canvas } = await import('html2canvas');
                          const allCells = el.querySelectorAll('td, th');
                          allCells.forEach(cell => { (cell as HTMLElement).style.verticalAlign = 'middle'; });
                          // Use computed background color from the actual theme
                          const bgStyle = getComputedStyle(document.documentElement);
                          const bgHsl = bgStyle.getPropertyValue('--background').trim();
                          const bgColor = bgHsl ? `hsl(${bgHsl})` : (colorMode === 'light' ? '#f5f3f0' : '#1a1a2e');
                          const isLight = colorMode === 'light';
                          const PAD = 40;
                          const canvas = await html2canvas(el, {
                            backgroundColor: bgColor,
                            useCORS: true, scrollY: -window.scrollY, scrollX: 0, scale: 2, logging: false,
                            onclone: (doc) => {
                              const clonedEl = doc.querySelector('[data-quest-screenshot]') as HTMLElement;
                              if (clonedEl) {
                                // Copy theme attributes so CSS variables resolve correctly
                                const root = doc.documentElement;
                                root.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'gold');
                                root.setAttribute('data-color-mode', colorMode);

                                clonedEl.style.overflow = 'visible';
                                clonedEl.style.height = 'auto';
                                clonedEl.style.maxHeight = 'none';
                                clonedEl.style.padding = `${PAD}px`;
                                clonedEl.style.display = 'inline-block';
                                clonedEl.style.boxSizing = 'border-box';
                                clonedEl.querySelectorAll('td, th').forEach(cell => { (cell as HTMLElement).style.verticalAlign = 'middle'; });
                                // Force flex items to align to top so party composition header lines up
                                const flexRow = clonedEl.querySelector('[data-quest-sim]') as HTMLElement;
                                if (flexRow) {
                                  flexRow.style.alignItems = 'flex-start';
                                }
                                // Ensure all img/span/svg vertical alignment
                                clonedEl.querySelectorAll('img, span, svg').forEach(e => {
                                  const cs = window.getComputedStyle(e);
                                  if (cs.display === 'inline-block' || cs.display === 'inline') {
                                    (e as HTMLElement).style.verticalAlign = 'middle';
                                  }
                                });
                              }
                            }
                          });
                          allCells.forEach(cell => { (cell as HTMLElement).style.verticalAlign = ''; });
                          const link = document.createElement('a');
                          link.download = `quest-sim-${Date.now()}.jpg`;
                          link.href = canvas.toDataURL('image/jpeg', 0.92);
                          link.click();
                        } finally {
                          overlay.remove();
                        }
                      }}
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Skeleton / Real results */}
              {currentQuest && simResult && selectedHeroes.length > 0 ? (
              <>
              <div className="card-fantasy p-4 mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm font-bold text-foreground">턴 수</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-secondary/30 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">최소</div>
                    <div className="text-lg font-bold font-mono text-foreground">{simResult.minRounds}</div>
                  </div>
                  <div className="bg-secondary/30 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">평균</div>
                    <div className="text-lg font-bold font-mono text-primary">{Math.round(simResult.avgRounds)}</div>
                  </div>
                  <div className="bg-secondary/30 rounded p-2">
                    <div className="text-[10px] text-muted-foreground">최대</div>
                    <div className="text-lg font-bold font-mono text-foreground">{simResult.maxRounds}</div>
                  </div>
                </div>
                {simResult.roundLimitRate > 0 && (
                  <div className="mt-2 text-center text-[10px] text-red-400">
                    ⚠ 라운드 제한 도달: {simResult.roundLimitRate.toFixed(1)}%
                  </div>
                )}
              </div>

              {/* Damage Contribution */}
              <div className="card-fantasy p-4 mb-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <Swords className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-sm font-bold text-foreground">대미지 기여도</span>
                </div>
                {(() => {
                  const totalDmg = simResult.heroResults.reduce((s, hr) => s + hr.avgDamageDealt, 0);
                  const sorted = [...simResult.heroResults].sort((a, b) => b.avgDamageDealt - a.avgDamageDealt);
                  const getBarColor = (pct: number) => pct >= 81 ? 'bg-lime-500' : pct >= 61 ? 'bg-yellow-500' : pct >= 41 ? 'bg-orange-500' : pct >= 21 ? 'bg-red-500' : 'bg-purple-500';
                  const getTextColor = (pct: number) => pct >= 81 ? 'text-lime-400' : pct >= 61 ? 'text-yellow-400' : pct >= 41 ? 'text-orange-400' : pct >= 21 ? 'text-red-400' : 'text-purple-400';
                  return (
                    <div className="space-y-2">
                      {sorted.map((hr) => {
                        const pct = totalDmg > 0 ? (hr.avgDamageDealt / totalDmg) * 100 : 0;
                        return (
                          <div key={hr.heroId}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] text-foreground font-medium truncate max-w-[120px]">{hr.heroName}</span>
                              <span className={`text-[11px] font-mono ${getTextColor(pct)}`}>{pct.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-secondary/30 rounded-full h-3 overflow-hidden">
                              <div className={`h-full rounded-full ${getBarColor(pct)} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Tanking Contribution */}
              <div className="card-fantasy p-4 mb-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm font-bold text-foreground">탱킹 기여도</span>
                </div>
                {(() => {
                  const sorted = [...simResult.heroResults].sort((a, b) => b.tankingRate - a.tankingRate);
                  const getBarColor = (pct: number) => pct >= 81 ? 'bg-lime-500' : pct >= 61 ? 'bg-yellow-500' : pct >= 41 ? 'bg-orange-500' : pct >= 21 ? 'bg-red-500' : 'bg-purple-500';
                  const getTextColor = (pct: number) => pct >= 81 ? 'text-lime-400' : pct >= 61 ? 'text-yellow-400' : pct >= 41 ? 'text-orange-400' : pct >= 21 ? 'text-red-400' : 'text-purple-400';
                  return (
                    <div className="space-y-2">
                      {sorted.map((hr) => (
                        <div key={hr.heroId}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] text-foreground font-medium truncate max-w-[120px]">{hr.heroName}</span>
                            <span className={`text-[11px] font-mono ${getTextColor(hr.tankingRate)}`}>{hr.tankingRate.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-secondary/30 rounded-full h-3 overflow-hidden">
                            <div className={`h-full rounded-full ${getBarColor(hr.tankingRate)} transition-all`} style={{ width: `${hr.tankingRate}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Equipment Grade Score */}
              <div className="card-fantasy p-4 mb-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <img src="/images/stats/power.webp" alt="" className="w-3.5 h-3.5" />
                  <span className="text-sm font-bold text-foreground">장비 등급</span>
                </div>
                {(() => {
                  const qualityScore: Record<string, number> = {
                    'common': 1, 'uncommon': 1.25, 'flawless': 1.5, 'epic': 2, 'legendary': 3,
                    '일반': 1, '고급': 1.25, '최고급': 1.5, '에픽': 2, '전설': 3,
                  };
                  const heroGrades = selectedHeroes.map(h => {
                    const slots = h.equipmentSlots || [];
                    const maxSlots = h.type === 'champion' ? 2 : 6;
                    let totalScore = 0;
                    let equipped = 0;
                    slots.forEach(s => {
                      if (s.item) {
                        equipped++;
                        totalScore += qualityScore[s.quality] || 1;
                      }
                    });
                    const avg = equipped > 0 ? totalScore / equipped : 0;
                    return { name: h.name, avg, equipped, maxSlots };
                  });
                  const partyTotal = heroGrades.reduce((s, g) => s + g.avg, 0);
                  const partyAvg = heroGrades.length > 0 ? partyTotal / heroGrades.length : 0;
                  const getGradeColor = (score: number) => score >= 2.5 ? 'text-yellow-400' : score >= 2 ? 'text-fuchsia-400' : score >= 1.5 ? 'text-cyan-400' : score >= 1.25 ? 'text-lime-400' : 'text-gray-400';
                  const getBarColor = (score: number) => score >= 2.5 ? 'bg-yellow-500' : score >= 2 ? 'bg-fuchsia-500' : score >= 1.5 ? 'bg-cyan-500' : score >= 1.25 ? 'bg-lime-500' : 'bg-gray-400';
                  return (
                    <div className="space-y-2">
                      {heroGrades.map(g => (
                        <div key={g.name}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] text-foreground font-medium truncate max-w-[120px]">{g.name}</span>
                            <span className={`text-[11px] font-mono ${getGradeColor(g.avg)}`}>
                              {g.avg > 0 ? g.avg.toFixed(2) : '-'}
                              <span className="text-muted-foreground/60 ml-1">({g.equipped}/{g.maxSlots})</span>
                            </span>
                          </div>
                          <div className="w-full bg-secondary/30 rounded-full h-3 overflow-hidden">
                            <div className={`h-full rounded-full ${getBarColor(g.avg)} transition-all`} style={{ width: `${Math.min(100, (g.avg / 3) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-border/30 pt-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-foreground font-bold">파티 평균</span>
                          <span className={`text-sm font-mono font-bold ${getGradeColor(partyAvg)}`}>{partyAvg > 0 ? partyAvg.toFixed(2) : '-'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              </>
              ) : (
                /* Skeleton frame before simulation */
                <>
                  <div className="card-fantasy p-4 mb-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
                      <span className="text-sm font-bold text-muted-foreground/40">턴 수</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {['최소', '평균', '최대'].map(label => (
                        <div key={label} className="bg-secondary/20 rounded p-2">
                          <div className="text-[10px] text-muted-foreground/40">{label}</div>
                          <div className="text-lg font-bold font-mono text-muted-foreground/20">-</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card-fantasy p-4 mb-3">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Swords className="w-3.5 h-3.5 text-muted-foreground/30" />
                      <span className="text-sm font-bold text-muted-foreground/30">대미지 기여도</span>
                    </div>
                    <div className="space-y-3">
                      {[1,2,3].map(i => (
                        <div key={i}>
                          <div className="h-3 w-16 bg-secondary/20 rounded mb-1" />
                          <div className="w-full bg-secondary/20 rounded-full h-3" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card-fantasy p-4 mb-3">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground/30" />
                      <span className="text-sm font-bold text-muted-foreground/30">탱킹 기여도</span>
                    </div>
                    <div className="space-y-3">
                      {[1,2,3].map(i => (
                        <div key={i}>
                          <div className="h-3 w-16 bg-secondary/20 rounded mb-1" />
                          <div className="w-full bg-secondary/20 rounded-full h-3" />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
        </div>
      </div>

      {/* Full-width Simulation Details Box */}
      {currentQuest && selectedHeroes.length > 0 && simResult && (
        <>
          <div className="flex items-center gap-2 mt-4 mb-3">
            <ListChecks className="w-5 h-5 text-primary" />
            <h3 className="text-lg text-foreground font-bold">상세 정보</h3>
          </div>
          <div className="card-fantasy p-4">

          {/* Mini-boss breakdown (only for random mode, not boss quests) */}
          {!isBossQuest && simResult.miniBossResults && simResult.miniBossResults.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-2 font-medium">미니보스별 결과</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {simResult.miniBossResults.map(mbr => {
                  const typeLabel = mbr.type === 'normal' ? '일반' :
                    mbr.type === 'huge' ? '거대한' :
                    mbr.type === 'agile' ? '민첩한' :
                    mbr.type === 'dire' ? '흉포한' :
                    mbr.type === 'wealthy' ? '부유한' :
                    mbr.type === 'legendary' ? '전설의' : mbr.type;
                  const typeColor = mbr.type === 'normal' ? 'text-foreground' :
                    mbr.type === 'huge' ? 'text-lime-400' :
                    mbr.type === 'agile' ? 'text-blue-400' :
                    mbr.type === 'dire' ? 'text-red-400' :
                    mbr.type === 'wealthy' ? 'text-yellow-400' :
                    mbr.type === 'legendary' ? 'text-purple-400' : 'text-foreground';
                    return (
                      <div key={mbr.type} className="bg-secondary/30 rounded p-2 text-center">
                        <div className={`text-[12px] font-medium ${typeColor}`}>{typeLabel}</div>
                        <div className="text-[11px] text-muted-foreground">{mbr.encounters.toLocaleString()}회</div>
                        <div className={`text-sm font-mono font-bold ${
                          mbr.winRate >= 90 ? 'text-lime-400' :
                          mbr.winRate >= 70 ? 'text-lime-400' :
                          mbr.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {mbr.winRate.toFixed(1)}%
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          평균 {Math.round(mbr.avgRounds)}R
                        </div>
                      </div>
                    );
                })}
              </div>
            </div>
          )}

          {/* Per-hero results - full width detailed table */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {!isBossQuest && simResult.miniBossResults && simResult.miniBossResults.length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground font-medium">미니보스 결과</span>
                  <Select value={simResultsFilter} onValueChange={setSimResultsFilter}>
                    <SelectTrigger className="h-6 w-[100px] text-[12px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="normal">일반</SelectItem>
                      <SelectItem value="huge">거대한</SelectItem>
                      <SelectItem value="agile">민첩한</SelectItem>
                      <SelectItem value="dire">흉포한</SelectItem>
                      <SelectItem value="wealthy">부유한</SelectItem>
                      <SelectItem value="legendary">전설의</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            {(() => {
              // Get the hero results based on filter
              let displayResults = simResult.heroResults;
              if (simResultsFilter !== 'all' && simResult.miniBossResults) {
                const filtered = simResult.miniBossResults.find(m => m.type === simResultsFilter);
                if (filtered) displayResults = filtered.heroResults;
              }
              return (
                <div className="space-y-8">
                  {/* Table 1: 대미지 + 딜링 비중 */}
                  <div>
                    <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-1"><Swords className="w-4 h-4 text-red-400" />대미지</div>
                    <div className="overflow-x-auto">
                      {(() => {
                        const totalDmg = displayResults.reduce((s, hr) => s + hr.avgDamageDealt, 0);
                        return (
                      <table className="w-full text-[13px] border-collapse">
                        <thead>
                          <tr className="border-b border-border/40">
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium whitespace-nowrap w-20" rowSpan={2}>영웅</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium border-l border-border/20" colSpan={4}>가하는 대미지</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium border-l border-border/20" colSpan={2}>일반/치명 비중</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium border-l border-border/20" colSpan={2}>딜링 비중</th>
                          </tr>
                          <tr className="border-b border-border/30 text-[12px] text-foreground/50">
                            <th className="text-center py-1 px-2 border-l border-border/20">총 평균</th>
                            <th className="text-center py-1 px-2">턴당 평균</th>
                            <th className="text-center py-1 px-2">최소</th>
                            <th className="text-center py-1 px-2">최대</th>
                            <th className="text-center py-1 px-2 border-l border-border/20">일반</th>
                            <th className="text-center py-1 px-2">치명</th>
                            <th className="text-center py-1 px-2 border-l border-border/20">비율</th>
                            <th className="text-center py-1 px-2 w-24">그래프</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayResults.map((hr, idx) => {
                            const dmgPct = totalDmg > 0 ? (hr.avgDamageDealt / totalDmg) * 100 : 0;
                            const barColors = ['bg-red-500', 'bg-blue-500', 'bg-lime-500', 'bg-yellow-500', 'bg-purple-500'];
                            return (
                              <tr key={hr.heroId} className={`border-b border-border/10 ${idx % 2 === 0 ? 'bg-secondary/10' : ''}`}>
                                <td className="py-1 px-2 text-center text-foreground font-medium whitespace-nowrap">{hr.heroName}</td>
                                <td className="py-1 px-2 text-center font-mono text-red-400 border-l border-border/20 whitespace-nowrap">{formatNumber(Math.round(hr.avgDamageDealt))}</td>
                                <td className="py-1 px-2 text-center font-mono text-orange-400 whitespace-nowrap">{formatNumber(Math.round(hr.avgDamagePerTurn))}</td>
                                <td className="py-1 px-2 text-center font-mono text-muted-foreground whitespace-nowrap">{formatNumber(Math.round(hr.minDamageDealt))}</td>
                                <td className="py-1 px-2 text-center font-mono text-orange-400 whitespace-nowrap">{formatNumber(Math.round(hr.maxDamageDealt))}</td>
                                {/* Normal/Crit damage breakdown */}
                                {(() => {
                                  const normalPct = hr.avgDamageDealt > 0 ? (hr.normalDmgDealtAvg / hr.avgDamageDealt) * 100 : 0;
                                  const critPct = hr.avgDamageDealt > 0 ? (hr.critDmgDealtAvg / hr.avgDamageDealt) * 100 : 0;
                                  return (
                                    <>
                                      <td className="py-1 px-2 text-center font-mono text-blue-300 border-l border-border/20 whitespace-nowrap">{formatNumber(Math.round(hr.normalDmgDealtAvg))} ({normalPct.toFixed(1)}%)</td>
                                      <td className="py-1 px-2 text-center font-mono text-yellow-300 whitespace-nowrap">{formatNumber(Math.round(hr.critDmgDealtAvg))} ({critPct.toFixed(1)}%)</td>
                                    </>
                                  );
                                })()}
                                <td className="py-1 px-2 text-center font-mono text-amber-400 border-l border-border/20 whitespace-nowrap">{dmgPct.toFixed(1)}%</td>
                                <td className="py-1 px-2">
                                  <div className="w-full bg-secondary/30 rounded-full h-3 overflow-hidden">
                                    <div className={`h-full rounded-full ${barColors[idx % barColors.length]} transition-all`} style={{ width: `${dmgPct}%` }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Table 1.5: 특수 대미지 (상어 / 첫턴 / 광전사) */}
                  <div>
                    <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-1"><Target className="w-4 h-4 text-cyan-400" />특수 대미지 (상어 / 공룡 / 광전사)</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px] border-collapse">
                        <thead>
                          <tr className="border-b border-border/40">
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium whitespace-nowrap w-20" rowSpan={2}>영웅</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium border-l border-border/20" colSpan={2}>🦈 상어</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium border-l border-border/20" colSpan={2}>🦕 공룡</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium border-l border-border/20" colSpan={3}><Flame className="w-3 h-3 inline mr-0.5" /> 광전사</th>
                          </tr>
                          <tr className="border-b border-border/30 text-[12px] text-foreground/50">
                            <th className="text-center py-1 px-2 border-l border-border/20">일반</th>
                            <th className="text-center py-1 px-2">치명</th>
                            <th className="text-center py-1 px-2 border-l border-border/20">일반</th>
                            <th className="text-center py-1 px-2">치명</th>
                            <th className="text-center py-1 px-2 border-l border-border/20">1단계 ATK/EVA</th>
                            <th className="text-center py-1 px-2">2단계 ATK/EVA</th>
                            <th className="text-center py-1 px-2">3단계 ATK/EVA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayResults.map((hr, idx) => {
                            const sharkGray = !hr.hasSharkSpirit;
                            const dinoGray = !hr.hasDinosaurSpirit && !hr.isSamuraiOrDaimyo;
                            const brkGray = !hr.berserkerAtkBonus;
                            return (
                              <tr key={hr.heroId} className={`border-b border-border/10 ${idx % 2 === 0 ? 'bg-secondary/10' : ''}`}>
                                <td className="py-1 px-2 text-center text-foreground font-medium whitespace-nowrap">{hr.heroName}</td>
                                <td className={`py-1 px-2 text-center font-mono border-l border-border/20 whitespace-nowrap ${sharkGray ? 'text-muted-foreground/30' : 'text-cyan-400'}`}>{sharkGray ? '-' : formatNumber(hr.sharkNormalDmg)}</td>
                                <td className={`py-1 px-2 text-center font-mono whitespace-nowrap ${sharkGray ? 'text-muted-foreground/30' : 'text-cyan-300'}`}>{sharkGray ? '-' : formatNumber(hr.sharkCritDmg)}</td>
                                <td className={`py-1 px-2 text-center font-mono border-l border-border/20 whitespace-nowrap ${dinoGray ? 'text-muted-foreground/30' : 'text-lime-400'}`}>{dinoGray ? '-' : formatNumber(hr.dinosaurNormalDmg)}</td>
                                <td className={`py-1 px-2 text-center font-mono whitespace-nowrap ${dinoGray ? 'text-muted-foreground/30' : 'text-lime-300'}`}>{dinoGray ? '-' : formatNumber(hr.dinosaurCritDmg)}</td>
                                <td className={`py-1 px-2 text-center font-mono border-l border-border/20 whitespace-nowrap ${brkGray ? 'text-muted-foreground/30' : 'text-red-400'}`}>
                                  {brkGray ? '-' : `+${hr.berserkerAtkBonus![0]}% / +${hr.berserkerEvaBonus![0]}%`}
                                </td>
                                <td className={`py-1 px-2 text-center font-mono whitespace-nowrap ${brkGray ? 'text-muted-foreground/30' : 'text-red-400'}`}>
                                  {brkGray ? '-' : `+${hr.berserkerAtkBonus![1]}% / +${hr.berserkerEvaBonus![1]}%`}
                                </td>
                                <td className={`py-1 px-2 text-center font-mono whitespace-nowrap ${brkGray ? 'text-muted-foreground/30' : 'text-red-400'}`}>
                                  {brkGray ? '-' : `+${hr.berserkerAtkBonus![2]}% / +${hr.berserkerEvaBonus![2]}%`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 2: 생존 & 방어 (with 받는 대미지) */}
                  <div>
                    <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-1"><Shield className="w-4 h-4 text-blue-400" />생존 & 방어</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px] border-collapse">
                        <thead>
                          <tr className="border-b border-border/40">
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium whitespace-nowrap w-20" rowSpan={2}>영웅</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium border-l border-border/20" colSpan={5}>기본</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium border-l border-border/20" colSpan={4}>받는 대미지</th>
                          </tr>
                          <tr className="border-b border-border/30 text-[12px] text-foreground/50">
                            <th className="text-center py-1 px-2 border-l border-border/20">생존률</th>
                            <th className="text-center py-1 px-2">대미지 보정</th>
                            <th className="text-center py-1 px-2">피격 확률</th>
                            <th className="text-center py-1 px-2">회피 비율</th>
                            <th className="text-center py-1 px-2 text-red-400">몬스터 치확</th>
                            <th className="text-center py-1 px-2 border-l border-border/20">일반</th>
                            <th className="text-center py-1 px-2">치명</th>
                            <th className="text-center py-1 px-2">턴당 평균</th>
                            <th className="text-center py-1 px-2">받은 총</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayResults.map((hr, idx) => (
                            <tr key={hr.heroId} className={`border-b border-border/10 ${idx % 2 === 0 ? 'bg-secondary/10' : ''}`}>
                              <td className="py-1 px-2 text-center text-foreground font-medium whitespace-nowrap">{hr.heroName}</td>
                              <td className={`py-1 px-2 text-center font-mono border-l border-border/20 whitespace-nowrap ${
                                hr.survivalRate >= 90 ? 'text-lime-400' :
                                hr.survivalRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                              }`}>{hr.survivalRate.toFixed(1)}%</td>
                              <td className={`py-1 px-2 text-center font-mono whitespace-nowrap ${
                                hr.damageApplicationRate <= 30 ? 'text-lime-400' :
                                hr.damageApplicationRate <= 60 ? 'text-blue-400' :
                                hr.damageApplicationRate <= 100 ? 'text-yellow-400' : 'text-red-400'
                              }`}>{hr.damageApplicationRate}%</td>
                              <td className="py-1 px-2 text-center font-mono text-orange-400 whitespace-nowrap">{hr.targetingRate.toFixed(1)}%</td>
                              <td className="py-1 px-2 text-center font-mono text-teal-400 whitespace-nowrap">{hr.evasionRate.toFixed(1)}%</td>
                              <td className={`py-1 px-2 text-center font-mono whitespace-nowrap ${hr.monsterCritChance > 10 ? 'text-red-400 font-bold' : 'text-orange-300'}`}>{hr.monsterCritChance}%</td>
                              <td className="py-1 px-2 text-center font-mono text-blue-300 border-l border-border/20 whitespace-nowrap">{formatNumber(hr.normalDamageTaken)}</td>
                              <td className="py-1 px-2 text-center font-mono text-purple-400 whitespace-nowrap">{formatNumber(hr.critDamageTakenVal)}</td>
                              <td className="py-1 px-2 text-center font-mono text-orange-300 whitespace-nowrap">{formatNumber(hr.avgDamageTakenPerTurn)}</td>
                              <td className="py-1 px-2 text-center font-mono text-red-400 font-bold whitespace-nowrap">{formatNumber(hr.totalDamageTakenAvg)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 3: 회복 & 보호 */}
                  <div>
                    <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-1"><Heart className="w-4 h-4 text-lime-400" />회복 & 보호</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px] border-collapse">
                        <thead>
                          <tr className="border-b border-border/40">
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium whitespace-nowrap w-20">영웅</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">총 회복량</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">턴당 회복</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">군주 보호</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">치명타 생존</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayResults.map((hr, idx) => (
                            <tr key={hr.heroId} className={`border-b border-border/10 ${idx % 2 === 0 ? 'bg-secondary/10' : ''}`}>
                              <td className="py-1 px-2 text-center text-foreground font-medium whitespace-nowrap">{hr.heroName}</td>
                              <td className="py-1 px-2 text-center font-mono text-lime-400 whitespace-nowrap">{formatNumber(Math.round(hr.totalHealingAvg))}</td>
                              <td className="py-1 px-2 text-center font-mono text-lime-300 whitespace-nowrap">{hr.healPerTurn > 0 ? hr.healPerTurn.toFixed(1) : '-'}</td>
                              <td className="py-1 px-2 text-center font-mono text-yellow-400 whitespace-nowrap">{hr.lordProtectionAvg > 0 ? hr.lordProtectionAvg.toFixed(2) : '-'}</td>
                              <td className="py-1 px-2 text-center font-mono text-purple-400 whitespace-nowrap">{hr.critSurvivalCount > 0 ? hr.critSurvivalCount.toFixed(2) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 4: 특수 (광전사, 크로노맨서 등) */}
                  {displayResults.some(hr => hr.berserkerThresholds || hr.chronomancerRetries !== undefined) && (
                    <div>
                      <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-1"><Flame className="w-4 h-4 text-orange-400" />특수 정보</div>
                      <div className="overflow-x-auto">
                        <div className="space-y-1">
                          {displayResults.map(hr => {
                            if (!hr.berserkerThresholds && hr.chronomancerRetries === undefined) return null;
                            return (
                              <div key={hr.heroId} className="bg-secondary/20 rounded p-2 text-[13px]">
                                <span className="text-foreground font-medium">{hr.heroName}</span>
                                {hr.berserkerThresholds && (
                                  <div className="mt-1 flex flex-wrap gap-3">
                                    {hr.berserkerThresholds.map((bt, i) => (
                                      <span key={i} className="text-red-400">
                                        HP &lt;{bt.threshold}%: <span className="font-mono">{bt.belowRate}%</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {hr.chronomancerRetries !== undefined && (
                                  <div className="mt-1 text-blue-400">
                                    재시도 비율: <span className="font-mono">{hr.chronomancerRetries}%</span>
                                    {hr.chronomancerRetrySuccessRate !== undefined && (
                                      <span className="ml-2">재시도 성공률: <span className="font-mono">{hr.chronomancerRetrySuccessRate}%</span></span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Table 5: 시뮬레이션 스탯 */}
                  <div>
                    <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-1"><Info className="w-4 h-4 text-blue-400" />시뮬레이션 스탯</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px] border-collapse">
                        <thead>
                          <tr className="border-b border-border/40">
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium whitespace-nowrap w-20">영웅</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">ATK</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">HP</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">DEF</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">CRIT.C</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">CRIT.D</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">CRIT.A</th>
                            <th className="text-center py-1.5 px-2 bg-muted/30 text-foreground/60 font-medium">EVA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayResults.map((hr, idx) => (
                            <tr key={hr.heroId} className={`border-b border-border/10 ${idx % 2 === 0 ? 'bg-secondary/10' : ''}`}>
                              <td className="py-1 px-2 text-center text-foreground font-medium whitespace-nowrap">{hr.heroName}</td>
                              <td className="py-1 px-2 text-center font-mono text-red-400 whitespace-nowrap">{formatNumber(hr.finalAtk)}</td>
                              <td className="py-1 px-2 text-center font-mono text-orange-400 whitespace-nowrap">{formatNumber(hr.finalHp)}</td>
                              <td className="py-1 px-2 text-center font-mono text-blue-400 whitespace-nowrap">{formatNumber(hr.finalDef)}</td>
                              <td className="py-1 px-2 text-center font-mono text-yellow-400 whitespace-nowrap">{hr.finalCritChance}%</td>
                              <td className="py-1 px-2 text-center font-mono text-yellow-300 whitespace-nowrap">x{(hr.finalCritDmg / 100).toFixed(1)}</td>
                              <td className="py-1 px-2 text-center font-mono text-red-300 whitespace-nowrap">{formatNumber(hr.finalCritAttack)}</td>
                              <td className="py-1 px-2 text-center font-mono text-teal-400 whitespace-nowrap">{hr.finalEvasion}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
        </>
      )}
      </div> {/* end data-quest-screenshot */}


      {/* Combat Log Dialog */}
      <Dialog open={combatLogDialogOpen} onOpenChange={setCombatLogDialogOpen}>
        <DialogContent className="max-w-[92vw] h-[85vh] flex flex-col overflow-hidden p-4">
          <DialogHeader>
            <DialogTitle className="sr-only">1회 추적 로그</DialogTitle>
          </DialogHeader>
          {combatLog && (
            <CombatBattlefield
              log={combatLog}
              heroes={selectedHeroes}
              monsterHp={currentQuest?.hp || 0}
              monsterName={locationName}
              onNewBattle={() => {
                if (!currentQuest || !currentRegion) return;
                const isTerrorTower2 = selectedQuestType === 'tot' && currentRegion.name === '공포';
                const bElements2 = currentQuest?.barrier ? (() => {
                  const hasSubAreas2 = currentRegion && currentRegion.subAreas.length > 1;
                  const barrierElement2 = hasSubAreas2 && selectedSubAreaIdx >= 0 && selectedSubAreaIdx !== 99
                    ? (selectedSubAreaIdx === 0 ? currentQuest.barrier!.sub1 : selectedSubAreaIdx === 1 ? currentQuest.barrier!.sub2 : currentQuest.barrier!.sub3)
                    : null;
                  const rawElements = barrierElement2
                    ? [barrierElement2]
                    : [currentQuest.barrier!.sub1, currentQuest.barrier!.sub2, currentQuest.barrier!.sub3].filter(Boolean);
                  return [...new Set(rawElements)] as string[];
                })() : [];
                const questMonster2: QuestMonster = {
                  hp: currentQuest.hp, atk: currentQuest.atk, aoe: currentQuest.aoe,
                  aoeChance: currentQuest.aoeChance, def: currentQuest.def,
                  isBoss: currentQuest.isBoss, isExtreme: currentQuest.isExtreme,
                  barrier: currentQuest.barrier, barrierElement: bElements2[0] || null,
                };
                const entries = runSingleCombatLog({
                  heroes: selectedHeroes, monster: questMonster2,
                  miniBoss: selectedMiniBoss, booster: { type: selectedBooster },
                  questTypeKey: selectedQuestType, regionName: currentRegion.name, isTerrorTower: isTerrorTower2,
                });
                setCombatLog(entries);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <QuestConfigDialog
        open={configOpen}
        onOpenChange={(open) => {
          setConfigOpen(open);
          if (!open) {
            setConfigInitialStep(undefined);
            setConfigInitialState(undefined);
          }
        }}
        questDataMap={questDataMap}
        questFiles={QUEST_FILES}
        onSelect={handleQuestSelect}
        initialStep={configInitialStep}
        initialState={configInitialState}
      />

      {/* Hero Select Dialog */}
      <HeroSelectDialog
        open={heroSelectOpen}
        onOpenChange={(open) => { setHeroSelectOpen(open); if (!open) setEditingSlotIdx(null); }}
        heroes={allHeroes}
        selectedIds={selectedHeroIds}
        maxMembers={maxMembers}
        minPower={currentQuest?.minPower || 0}
        onConfirm={(ids) => {
          setSelectedHeroIds(ids);
          setHeroSelectOpen(false);
          setEditingSlotIdx(null);
        }}
        editingSlotIdx={editingSlotIdx}
        barrierElements={barrierElements}
      />

      {/* Party Buff Breakdown Drawer */}
      <PartyBuffBreakdownDrawer
        open={buffBreakdownOpen}
        onOpenChange={setBuffBreakdownOpen}
        heroes={selectedHeroes}
        buffSummary={buffSummary}
        buffedStats={buffedStats}
        hasEvasionPenalty={!!(currentQuest && (currentQuest.isExtreme || (selectedQuestType === 'tot' && currentRegion?.name === '공포')))}
      />
    </>
      )}
      </div> {/* end simulation tab */}
    </div>
  );
}
