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

  // Group quests by type (normal vs boss) and get difficulties
  const questGroups = useMemo(() => {
    if (!region) return { normal: [] as (QuestEntry & { originalIdx: number })[], boss: [] as (QuestEntry & { originalIdx: number })[] };
    const normal = region.quests.filter(q => q.type === 'normal').map(q => ({ ...q, originalIdx: region.quests.indexOf(q) }));
    const boss = region.quests.filter(q => q.type === 'boss').map(q => ({ ...q, originalIdx: region.quests.indexOf(q) }));
    return { normal, boss };
  }, [region]);

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
              {/* Normal sub-areas */}
              {region.subAreas.map((sub, subIdx) => (
                <div key={sub.key} className="flex flex-col items-center gap-2 min-w-[120px]">
                  {/* Sub-area icon */}
                  <div className="w-24 h-24 rounded-lg border border-border bg-secondary/30 flex items-center justify-center overflow-hidden aspect-square">
                    <img src={sub.image} alt={sub.name} className="w-full h-full object-contain p-1" loading="eager" decoding="sync" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <span className="text-xs font-bold text-foreground text-center">{sub.name}</span>

                  {/* Difficulty buttons for this sub-area */}
                  <div className="flex flex-col gap-1.5 w-full">
                    {questGroups.normal.map(q => {
                      const colors = DIFFICULTY_COLORS[q.difficulty] || { bg: 'bg-secondary/20', border: 'border-border', text: 'text-muted-foreground', textLight: 'text-muted-foreground' };
                      const barrierEl = getBarrierForSubArea(q, subIdx);
                      const barrierHp = q.barrier?.hp || 0;
                      const elIcon = barrierEl ? ELEMENT_ICON_MAP[barrierEl] : null;
                      const diffTextColor = isDark ? colors.text : (q.difficulty === '쉬움' ? 'text-[hsl(80,45%,30%)]' : colors.textLight);
                      return (
                        <button
                          key={q.originalIdx}
                          onClick={() => selectQuest(hasSubAreas ? subIdx : (region.subAreas.length === 1 ? 0 : -1), q.originalIdx)}
                          className={`px-2 py-2 rounded-md border ${q.difficulty === '쉬움' && !isDark ? 'bg-[hsl(80,50%,90%)]/60' : colors.bg} ${colors.border} hover:opacity-80 transition-all text-center`}
                        >
                          <div className={`text-xs font-bold ${diffTextColor}`}>
                            {q.stage ? `${q.stage}단계` : q.difficulty}
                          </div>
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

              {/* Boss */}
              {region.boss && questGroups.boss.length > 0 && (
                <div className="flex flex-col items-center gap-2 min-w-[120px]">
                  <div className="w-24 h-24 rounded-lg border border-border bg-red-500/10 flex items-center justify-center overflow-hidden aspect-square">
                    <img src={region.boss.image} alt={region.boss.name} className="w-full h-full object-contain p-1" loading="eager" decoding="sync" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <span className="text-xs font-bold text-red-400 flex items-center gap-0.5 text-center">
                    <Crown className="w-3.5 h-3.5" /> {region.boss.name}
                  </span>

                  <div className="flex flex-col gap-1.5 w-full">
                    {questGroups.boss.map(q => {
                      const hasDifficulty = q.difficulty !== '없음';
                      const colors = hasDifficulty
                        ? (DIFFICULTY_COLORS[q.difficulty] || { bg: 'bg-secondary/20', border: 'border-border', text: 'text-muted-foreground', textLight: 'text-muted-foreground' })
                        : { bg: 'bg-secondary/20', border: 'border-border/60', text: 'text-muted-foreground', textLight: 'text-muted-foreground' };
                      const barrierEl = q.barrier?.sub1 || null;
                      const barrierHp = q.barrier?.hp || 0;
                      const elIcon = barrierEl ? ELEMENT_ICON_MAP[barrierEl] : null;
                      const diffTextColor = hasDifficulty ? (isDark ? colors.text : (q.difficulty === '쉬움' ? 'text-[hsl(80,45%,30%)]' : colors.textLight)) : 'text-muted-foreground';
                      return (
                        <button
                          key={q.originalIdx}
                          onClick={() => selectQuest(99, q.originalIdx)}
                          className={`px-2 py-2 rounded-md border ${hasDifficulty && q.difficulty === '쉬움' && !isDark ? 'bg-[hsl(80,50%,90%)]/60' : colors.bg} ${colors.border} hover:opacity-80 transition-all text-center`}
                        >
                          <div className={`text-xs font-bold ${diffTextColor}`}>
                            {q.stage ? `${q.stage}단계` : hasDifficulty ? q.difficulty : '-'}
                          </div>
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
              )}

              {/* If no sub-areas (single area), show just difficulty */}
              {!hasSubAreas && !region.boss && region.subAreas.length <= 1 && questGroups.normal.length > 0 && (
                <div className="flex flex-col items-center gap-2 min-w-[100px]">
                  <div className="w-20 h-20 rounded-lg border border-border bg-secondary/30 flex items-center justify-center overflow-hidden aspect-square">
                    <img src={region.areaImage} alt={region.name} className="w-full h-full object-contain p-1" loading="eager" decoding="sync" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <span className="text-[11px] font-medium text-foreground text-center">{region.name}</span>
                  <div className="flex flex-col gap-1.5 w-full">
                    {questGroups.normal.map(q => {
                      const colors = DIFFICULTY_COLORS[q.difficulty] || { bg: 'bg-secondary/20', border: 'border-border', text: 'text-muted-foreground' };
                      return (
                        <button
                          key={q.originalIdx}
                          onClick={() => selectQuest(0, q.originalIdx)}
                          className={`px-2 py-1.5 rounded-md border ${colors.bg} ${colors.border} hover:opacity-80 transition-all text-center`}
                        >
                          <div className={`text-[11px] font-medium ${colors.text}`}>
                            {q.stage ? `${q.stage}단계` : q.difficulty}
                          </div>
                          {q.barrier ? (
                            <div className="flex items-center justify-center gap-1 mt-0.5">
                              <span className="text-[9px] text-muted-foreground font-mono">{q.barrier.hp}</span>
                            </div>
                          ) : (
                            <div className="text-[9px] text-muted-foreground/40 mt-0.5">-</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
