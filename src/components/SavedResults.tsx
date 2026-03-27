import { useState, useEffect } from 'react';
import { getSavedSimulations, deleteSavedSimulation, deleteAllSavedSimulations, SavedSimulationSummary } from '@/lib/savedSimulations';
import { formatNumber } from '@/lib/format';
import { Trash2, Play, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { getHeroes } from '@/lib/storage';

// Facial expressions based on survival rate
const getExpression = (survivalRate: number): string => {
  if (survivalRate >= 95) return '😊';
  if (survivalRate >= 80) return '🙂';
  if (survivalRate >= 60) return '😐';
  if (survivalRate >= 40) return '😟';
  if (survivalRate >= 20) return '😰';
  return '💀';
};

const getWinRateColor = (rate: number) =>
  rate >= 90 ? 'text-green-400' :
  rate >= 70 ? 'text-lime-400' :
  rate >= 50 ? 'text-yellow-400' :
  rate >= 30 ? 'text-orange-400' : 'text-red-400';

const getWinRateBorderColor = (rate: number) =>
  rate >= 90 ? 'border-green-500/40' :
  rate >= 70 ? 'border-lime-500/30' :
  rate >= 50 ? 'border-yellow-500/30' :
  rate >= 30 ? 'border-orange-500/30' : 'border-red-500/30';

// Quest type labels
const QUEST_TYPE_LABELS: Record<string, string> = {
  normal: '일반 퀘스트',
  flash: '깜짝 퀘스트',
  lcog: '왕의 모험',
  tot: '공포의 탑',
};

const BOOSTER_LABELS: Record<string, string> = {
  none: '',
  normal: '⚡부스터',
  super: '⚡슈퍼',
  mega: '⚡메가',
};

interface Props {
  onLoadSimulation: (sim: SavedSimulationSummary) => void;
  refreshKey?: number;
}

export default function SavedResults({ onLoadSimulation, refreshKey }: Props) {
  const [saved, setSaved] = useState<SavedSimulationSummary[]>([]);
  const allHeroes = getHeroes();

  useEffect(() => {
    setSaved(getSavedSimulations());
  }, [refreshKey]);

  const handleDelete = (id: string) => {
    deleteSavedSimulation(id);
    setSaved(getSavedSimulations());
  };

  const handleDeleteAll = () => {
    if (!confirm('저장된 모든 결과를 삭제하시겠습니까?')) return;
    deleteAllSavedSimulations();
    setSaved([]);
  };

  if (saved.length === 0) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">저장된 결과가 없습니다</p>
        <p className="text-muted-foreground/60 text-xs mt-1">시뮬레이션 결과에서 "결과 저장" 버튼을 눌러 저장하세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{saved.length}개 저장됨</span>
        <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive gap-1" onClick={handleDeleteAll}>
          <Trash2 className="w-3.5 h-3.5" /> 전체 삭제
        </Button>
      </div>

      <div className="space-y-3">
        {saved.map((sim, simIndex) => {
          const date = new Date(sim.savedAt);
          const dateStr = `${date.getFullYear()}.${(date.getMonth()+1).toString().padStart(2,'0')}.${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;

          const questTypeLabel = QUEST_TYPE_LABELS[sim.questTypeKey] || sim.questTypeKey;
          // Parse region/difficulty from name
          const nameParts = sim.name.split(' ');
          const regionName = nameParts.length >= 2 ? nameParts.slice(1).join(' ') : sim.name;

          const boosterLabel = BOOSTER_LABELS[sim.booster] || '';

          // Calculate avg gear score from heroSummaries
          const totalDmg = sim.heroSummaries.reduce((s, hs) => s + hs.avgDamageDealt, 0);

          return (
            <div
              key={sim.id}
              className={`rounded-lg border bg-card/80 hover:bg-card transition-all ${getWinRateBorderColor(sim.winRate)}`}
            >
              <div className="flex items-stretch">
                {/* Number badge */}
                <div className="flex items-center justify-center w-10 shrink-0 bg-muted/40 rounded-l-lg border-r border-border/30">
                  <span className="text-sm font-bold font-mono text-muted-foreground">{simIndex + 1}</span>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0 p-3">
                  {/* Top row: Quest info + date */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">{questTypeLabel}</span>
                    <span className="text-[11px] text-muted-foreground">/</span>
                    <span className="text-sm font-bold text-foreground">{regionName}</span>
                    {boosterLabel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">{boosterLabel}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{dateStr}</span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
                    <span>평균 <span className="font-mono text-foreground">{Math.round(sim.avgRounds)}</span>턴</span>
                    <span className="text-muted-foreground/40">({sim.minRounds}~{sim.maxRounds}R)</span>
                  </div>

                  {/* Hero portraits row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {sim.heroSummaries.map(hs => {
                      const hero = allHeroes.find(h => h.id === hs.heroId);
                      const img = hero?.type === 'champion'
                        ? getChampionImagePath(hero.championName || hero.name)
                        : hero?.heroClass ? getJobImagePath(hero.heroClass) : null;
                      const tankingRate = totalDmg > 0 ? 0 : 0; // We don't have tanking in summary, show damage share only
                      const expression = getExpression(hs.survivalRate);
                      return (
                        <div key={hs.heroId} className="flex items-center gap-1.5">
                          <div className="w-9 h-9 rounded-full border border-primary/30 overflow-hidden bg-secondary/50 shrink-0">
                            {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="text-[11px] leading-tight">
                            <div className="text-foreground font-medium flex items-center gap-0.5">
                              {hs.heroName} <span>{expression}</span>
                            </div>
                            <div className="text-muted-foreground font-mono">
                              딜 {hs.damageShare.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right side: Win rate + actions */}
                <div className="flex items-center gap-2 px-3 shrink-0">
                  {/* Win rate - big */}
                  <div className="text-right mr-2">
                    <div className="text-[10px] text-muted-foreground">승률</div>
                    <div className={`text-2xl font-bold font-mono ${getWinRateColor(sim.winRate)}`}>
                      {sim.winRate.toFixed(1)}%
                    </div>
                  </div>

                  {/* Action buttons - icon only, vertically centered */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 text-primary hover:bg-primary/10"
                      onClick={() => onLoadSimulation(sim)}
                      title="불러오기"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(sim.id)}
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center text-[10px] text-muted-foreground/50 pt-2">
        ℹ️ 불러오기 시 저장된 파티/세팅으로 다시 시뮬레이션을 실행합니다.<br/>
        결과는 매번 약간 달라질 수 있습니다.
      </div>
    </div>
  );
}