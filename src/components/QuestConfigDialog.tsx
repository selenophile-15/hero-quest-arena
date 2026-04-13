import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Crown, Users, ChevronLeft } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { ELEMENT_ICON_MAP } from '@/types/game';

interface SubArea {
  name: string;
  key: string;
  image: string;
}

interface QuestBarrier {
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  hp: number;
}

interface QuestTime {
  base: number;
  additional: number;
  perMember: number;
  total: number;
  rest: number;
  recovery: number;
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

interface QuestSelection {
  questTypeKey: string;
  regionIdx: number;
  subAreaIdx: number;
  questIdx: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questDataMap: Record<string, QuestData>;
  questFiles: { key: string; file: string }[];
  onSelect: (selection: QuestSelection) => void;
  initialStep?: 'type' | 'region' | 'subarea';
  initialState?: { questTypeKey: string; regionIdx: number; subAreaIdx: number };
}

const DIFFICULTY_COLORS: Record<string, { bg: string; border: string; text: string; textLight: string }> = {
  '쉬움': { bg: 'bg-[hsl(80,40%,30%)]/20', border: 'border-[hsl(80,50%,40%)]', text: 'text-[hsl(80,50%,45%)]', textLight: 'text-[hsl(80,45%,30%)]' },
  '보통': { bg: 'bg-yellow-400/10', border: 'border-yellow-500', text: 'text-yellow-400', textLight: 'text-yellow-600' },
  '어려움': { bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-400', textLight: 'text-red-500' },
  '익스트림': { bg: 'bg-purple-600/15', border: 'border-purple-500', text: 'text-purple-400', textLight: 'text-purple-600' },
};

const NEUTRAL_DIFFICULTY_COLORS = {
  bg: 'bg-secondary/30',
  border: 'border-border/60',
  text: 'text-muted-foreground',
  textLight: 'text-muted-foreground',
};

function getBarrierForSubArea(quest: QuestEntry, subIdx: number): string | null {
  if (!quest.barrier) return null;
  if (subIdx === 0) return quest.barrier.sub1;
  if (subIdx === 1) return quest.barrier.sub2;
  if (subIdx === 2) return quest.barrier.sub3;
  return null;
}

export default function QuestConfigDialog({ open, onOpenChange, questDataMap, questFiles, onSelect, initialStep, initialState }: Props) {
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-color-mode') === 'dark';
  const [step, setStep] = useState<'type' | 'region' | 'subarea'>(initialStep || 'type');
  const [selType, setSelType] = useState(initialState?.questTypeKey || '');
  const [selRegionIdx, setSelRegionIdx] = useState(initialState?.regionIdx ?? -1);

  useEffect(() => {
    if (open && initialStep && initialState) {
      setStep(initialStep);
      setSelType(initialState.questTypeKey);
      setSelRegionIdx(initialState.regionIdx);
    }
  }, [open, initialStep, initialState]);

  const questData = selType ? questDataMap[selType] : null;
  const region = questData && selRegionIdx >= 0 ? questData.regions[selRegionIdx] : null;
  const hasSubAreas = region && region.subAreas.length > 1;

  const questEntries = useMemo(() => {
    if (!region) return [] as (QuestEntry & { originalIdx: number })[];
    return region.quests.map((quest, originalIdx) => ({ ...quest, originalIdx }));
  }, [region]);

  const questGroups = useMemo(() => {
    const normal = questEntries.filter(q => q.type === 'normal');
    const boss = questEntries.filter(q => q.type === 'boss');
    return { normal, boss };
  }, [questEntries]);

  const areaCards = useMemo(() => {
    if (!region) return [] as Array<{
      key: string;
      name: string;
      image: string;
      subAreaIdx: number;
      quests: (QuestEntry & { originalIdx: number })[];
      isBoss: boolean;
    }>;

    const cards = region.subAreas.map((sub, subIdx) => ({
      key: `sub-${sub.key}-${subIdx}`,
      name: sub.name,
      image: sub.image,
      subAreaIdx: subIdx,
      quests: region.boss && questGroups.normal.length > 0
        ? questGroups.normal
        : region.subAreas.length > 1 && questGroups.normal.length > 0
          ? questGroups.normal
          : questEntries,
      isBoss: false,
    }));

    if (region.boss && questGroups.boss.length > 0) {
      cards.push({
        key: `boss-${region.boss.key}`,
        name: region.boss.name,
        image: region.boss.image,
        subAreaIdx: 99,
        quests: questGroups.boss,
        isBoss: true,
      });
    }

    return cards;
  }, [region, questEntries, questGroups]);

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) {
      setStep('type');
      setSelType('');
      setSelRegionIdx(-1);
    } else if (initialStep && initialState) {
      setStep(initialStep);
      setSelType(initialState.questTypeKey);
      setSelRegionIdx(initialState.regionIdx);
    }
    onOpenChange(isOpen);
  };

  const goBack = () => {
    if (step === 'subarea') { setStep('region'); setSelRegionIdx(-1); }
    else if (step === 'region') { setStep('type'); setSelType(''); }
  };

  const selectQuest = (subAreaIdx: number, questIdx: number) => {
    onSelect({ questTypeKey: selType, regionIdx: selRegionIdx, subAreaIdx, questIdx });
    handleOpen(false);
  };

  const stepTitle = step === 'type' ? '퀘스트 종류'
    : step === 'region' ? '지역 선택'
    : '세부 지역 & 난이도';

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-bold flex items-center gap-2">
            {step !== 'type' && (
              <button onClick={goBack} className="p-1 rounded hover:bg-secondary/50 transition-colors">
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            {stepTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Step: Quest Type */}
        {step === 'type' && (
          <div className="grid grid-cols-2 gap-3">
            {questFiles.map(f => {
              const data = questDataMap[f.key];
              if (!data) return null;
              return (
                <button
                  key={f.key}
                  onClick={() => { setSelType(f.key); setStep('region'); }}
                  className="p-4 rounded-lg border border-border bg-secondary/20 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
                >
                  <span className="text-sm font-medium text-foreground">{data.questType}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Step: Region */}
        {step === 'region' && questData && (
          <div className="grid grid-cols-6 gap-3">
            {questData.regions.map((r, idx) => (
              <button
                key={`${r.key}-${idx}`}
                onClick={() => {
                  setSelRegionIdx(idx);
                  setStep('subarea');
                }}
                className="rounded-lg border border-border hover:border-primary/50 overflow-hidden transition-all group flex flex-col"
              >
                <div className="bg-secondary/30 flex items-center justify-center p-2 aspect-square">
                  <img src={r.areaImage} alt={r.name} className="w-full h-full object-contain" loading="eager" decoding="sync" onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <div className="p-1.5 text-center">
                  <span className="text-xs font-bold text-foreground leading-tight block">{r.name}</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground">{r.maxMembers}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step: Sub-area & Difficulty combined */}
        {step === 'subarea' && region && (
          <div className="space-y-4">
            {/* Region header */}
            <div className="flex items-center gap-3">
              <img src={region.areaImage} alt="" className="w-10 h-10 rounded object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
              <div>
                <span className="text-sm font-medium text-foreground">{region.name}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" /> {region.maxMembers}명
                </div>
              </div>
            </div>

            {/* Sub-areas with difficulty buttons */}
            <div className="flex flex-wrap justify-center gap-4">
              {areaCards.map(card => (
                <div key={card.key} className="flex w-[132px] flex-col items-center gap-2">
                  <div className={`w-24 h-24 rounded-lg border ${card.isBoss ? 'border-red-500/40 bg-secondary/30' : 'border-border bg-secondary/30'} flex items-center justify-center overflow-hidden aspect-square`}>
                    <img src={card.image} alt={card.name} className="w-full h-full object-contain p-1" loading="eager" decoding="sync" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <span className={`text-xs font-bold text-center ${card.isBoss ? 'text-red-400' : 'text-foreground'} flex items-center justify-center gap-0.5 min-h-[32px]`}>
                    {card.isBoss && <Crown className="w-3.5 h-3.5" />}
                    {card.name}
                  </span>

                  <div className="flex w-full flex-col gap-1.5">
                    {card.quests.map(q => {
                      const hasDifficulty = q.difficulty !== '없음';
                      const colors = hasDifficulty
                        ? (DIFFICULTY_COLORS[q.difficulty] || NEUTRAL_DIFFICULTY_COLORS)
                        : NEUTRAL_DIFFICULTY_COLORS;
                      const barrierEl = card.isBoss ? (q.barrier?.sub1 || null) : getBarrierForSubArea(q, card.subAreaIdx);
                      const barrierHp = q.barrier?.hp || 0;
                      const elIcon = barrierEl ? ELEMENT_ICON_MAP[barrierEl] : null;
                      const diffTextColor = hasDifficulty
                        ? (isDark ? colors.text : (q.difficulty === '쉬움' ? 'text-[hsl(80,45%,30%)]' : colors.textLight))
                        : 'text-muted-foreground';
                      return (
                        <button
                          key={q.originalIdx}
                          onClick={() => selectQuest(card.subAreaIdx, q.originalIdx)}
                          className={`px-2 py-2 rounded-md border ${hasDifficulty && q.difficulty === '쉬움' && !isDark ? 'bg-[hsl(80,50%,90%)]/60' : colors.bg} ${colors.border} hover:opacity-80 transition-all text-center`}
                        >
                          <div className={`text-xs font-bold ${diffTextColor}`}>
                            {q.stage ? `${q.stage}단계` : hasDifficulty ? q.difficulty : '-'}
                          </div>
                          {!hasDifficulty && q.stage && (
                            <div className="text-[10px] font-bold text-muted-foreground mt-0.5">-</div>
                          )}
                          {q.barrier ? (
                            <div className="flex items-center justify-center gap-1 mt-0.5">
                              {elIcon && <img src={elIcon} alt={barrierEl || ''} className="w-4 h-4" />}
                              <span className={`text-xs font-bold font-mono ${isDark ? 'text-foreground/80' : 'text-foreground/70'}`}>{barrierHp}</span>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground/40 mt-0.5 font-bold">-</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
