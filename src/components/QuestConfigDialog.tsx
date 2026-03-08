import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Crown, Users, ChevronLeft } from 'lucide-react';
import { formatNumber } from '@/lib/format';

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
  initialStep?: 'type' | 'region' | 'subarea' | 'difficulty';
  initialState?: { questTypeKey: string; regionIdx: number; subAreaIdx: number };
}

const getDifficultyColor = (diff: string) => {
  switch (diff) {
    case '쉬움': return 'text-green-400';
    case '보통': return 'text-blue-400';
    case '어려움': return 'text-orange-400';
    case '익스트림': return 'text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]';
    default: return 'text-muted-foreground';
  }
};

export default function QuestConfigDialog({ open, onOpenChange, questDataMap, questFiles, onSelect, initialStep, initialState }: Props) {
  const [step, setStep] = useState<'type' | 'region' | 'subarea' | 'difficulty'>(initialStep || 'type');
  const [selType, setSelType] = useState(initialState?.questTypeKey || '');
  const [selRegionIdx, setSelRegionIdx] = useState(initialState?.regionIdx ?? -1);
  const [selSubAreaIdx, setSelSubAreaIdx] = useState(initialState?.subAreaIdx ?? -1);

  // Sync initial state when dialog opens
  useState(() => {
    if (open && initialStep && initialState) {
      setStep(initialStep);
      setSelType(initialState.questTypeKey);
      setSelRegionIdx(initialState.regionIdx);
      setSelSubAreaIdx(initialState.subAreaIdx);
    }
  });

  const questData = selType ? questDataMap[selType] : null;
  const region = questData && selRegionIdx >= 0 ? questData.regions[selRegionIdx] : null;
  const hasSubAreas = region && region.subAreas.length > 1;

  const questGroups = useMemo(() => {
    if (!region) return { normal: [], boss: [] };
    const normal = region.quests.filter(q => q.type === 'normal').map(q => ({ ...q, originalIdx: region.quests.indexOf(q) }));
    const boss = region.quests.filter(q => q.type === 'boss').map(q => ({ ...q, originalIdx: region.quests.indexOf(q) }));
    return { normal, boss };
  }, [region]);

  const reset = () => {
    setStep('type');
    setSelType('');
    setSelRegionIdx(-1);
    setSelSubAreaIdx(-1);
  };

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const goBack = () => {
    if (step === 'difficulty') {
      if (hasSubAreas) { setStep('subarea'); setSelSubAreaIdx(-1); }
      else { setStep('region'); setSelRegionIdx(-1); }
    } else if (step === 'subarea') { setStep('region'); setSelRegionIdx(-1); }
    else if (step === 'region') { setStep('type'); setSelType(''); }
  };

  const selectQuest = (questIdx: number) => {
    onSelect({ questTypeKey: selType, regionIdx: selRegionIdx, subAreaIdx: selSubAreaIdx, questIdx });
    handleOpen(false);
  };

  const stepTitle = step === 'type' ? '퀘스트 종류'
    : step === 'region' ? '지역 선택'
    : step === 'subarea' ? '세부 지역'
    : '난이도 선택';

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
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
          <div className="grid grid-cols-6 gap-2">
            {questData.regions.map((r, idx) => (
              <button
                key={`${r.key}-${idx}`}
                onClick={() => {
                  setSelRegionIdx(idx);
                  if (r.subAreas.length > 1) setStep('subarea');
                  else {
                    setSelSubAreaIdx(r.subAreas.length === 1 ? 0 : -1);
                    setStep('difficulty');
                  }
                }}
                className="rounded-lg border border-border hover:border-primary/50 overflow-hidden transition-all group"
              >
                <div className="bg-secondary/30 flex items-center justify-center p-1.5">
                  <img src={r.areaImage} alt={r.name} className="w-full h-auto object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <div className="p-1.5 text-center">
                  <span className="text-[10px] font-medium text-foreground leading-tight block">{r.name}</span>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{r.maxMembers}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step: Sub-area */}
        {step === 'subarea' && region && (
          <div className="grid grid-cols-6 gap-2">
            {region.subAreas.map((sub, idx) => (
              <button
                key={sub.key}
                onClick={() => { setSelSubAreaIdx(idx); setStep('difficulty'); }}
                className="rounded-lg border border-border hover:border-primary/50 overflow-hidden transition-all"
              >
                <div className="bg-secondary/30 flex items-center justify-center p-1.5">
                  <img src={sub.image} alt={sub.name} className="w-full h-auto object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <div className="p-1 text-center">
                  <span className="text-[10px] font-medium text-foreground leading-tight block">{sub.name}</span>
                </div>
              </button>
            ))}
            {region.boss && (
              <button
                onClick={() => { setSelSubAreaIdx(99); setStep('difficulty'); }}
                className="rounded-lg border border-border hover:border-primary/50 overflow-hidden transition-all"
              >
                <div className="bg-red-500/10 flex items-center justify-center p-1.5">
                  <img src={region.boss.image} alt={region.boss.name} className="w-full h-auto object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <div className="p-1 text-center">
                  <span className="text-[10px] font-medium text-red-400 flex items-center justify-center gap-0.5">
                    <Crown className="w-2.5 h-2.5" /> {region.boss.name}
                  </span>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Step: Difficulty */}
        {step === 'difficulty' && region && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <img src={region.areaImage} alt="" className="w-10 h-10 rounded object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
              <div>
                <span className="text-sm font-medium text-foreground">{region.name}</span>
                {selSubAreaIdx >= 0 && selSubAreaIdx !== 99 && region.subAreas[selSubAreaIdx] && (
                  <span className="text-xs text-muted-foreground ml-1">- {region.subAreas[selSubAreaIdx].name}</span>
                )}
                {selSubAreaIdx === 99 && region.boss && (
                  <span className="text-xs text-red-400 ml-1">- {region.boss.name}</span>
                )}
              </div>
            </div>

            {((!hasSubAreas || (selSubAreaIdx >= 0 && selSubAreaIdx !== 99)) && questGroups.normal.length > 0) && (
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">일반</span>
                <div className="grid grid-cols-2 gap-2">
                  {questGroups.normal.map(q => (
                    <button
                      key={q.originalIdx}
                      onClick={() => selectQuest(q.originalIdx)}
                      className={`p-3 rounded-lg border text-left transition-all ${getDifficultyBorder(q.difficulty)}`}
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

            {((!hasSubAreas || selSubAreaIdx === 99) && questGroups.boss.length > 0) && (
              <div>
                <span className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                  <Crown className="w-3 h-3" /> 보스
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {questGroups.boss.map(q => (
                    <button
                      key={q.originalIdx}
                      onClick={() => selectQuest(q.originalIdx)}
                      className={`p-3 rounded-lg border text-left transition-all ${getDifficultyBorder(q.difficulty)}`}
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
      </DialogContent>
    </Dialog>
  );
}
