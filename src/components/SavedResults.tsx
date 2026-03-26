import { useState, useEffect } from 'react';
import { getSavedSimulations, deleteSavedSimulation, deleteAllSavedSimulations, SavedSimulationSummary } from '@/lib/savedSimulations';
import { formatNumber } from '@/lib/format';
import { Trash2, RotateCcw, Play, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { getHeroes } from '@/lib/storage';

interface Props {
  onLoadSimulation: (sim: SavedSimulationSummary) => void;
}

export default function SavedResults({ onLoadSimulation }: Props) {
  const [saved, setSaved] = useState<SavedSimulationSummary[]>([]);
  const allHeroes = getHeroes();

  useEffect(() => {
    setSaved(getSavedSimulations());
  }, []);

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

      <div className="space-y-2">
        {saved.map(sim => {
          const date = new Date(sim.savedAt);
          const dateStr = `${date.getFullYear()}.${(date.getMonth()+1).toString().padStart(2,'0')}.${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;

          return (
            <div key={sim.id} className="card-fantasy p-3 hover-glow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-foreground truncate">{sim.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{dateStr}</span>
                  </div>

                  {/* Win rate + rounds */}
                  <div className="flex items-center gap-4 mb-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground">승률</span>
                      <span className={`ml-1 text-sm font-bold font-mono ${
                        sim.winRate >= 90 ? 'text-green-400' :
                        sim.winRate >= 70 ? 'text-lime-400' :
                        sim.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>{sim.winRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">평균 턴</span>
                      <span className="ml-1 text-sm font-mono text-foreground">{Math.round(sim.avgRounds)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      ({sim.minRounds}~{sim.maxRounds}R)
                    </div>
                  </div>

                  {/* Hero portraits */}
                  <div className="flex items-center gap-1.5">
                    {sim.heroSummaries.map(hs => {
                      const hero = allHeroes.find(h => h.id === hs.heroId);
                      const img = hero?.type === 'champion'
                        ? getChampionImagePath(hero.championName || hero.name)
                        : hero?.heroClass ? getJobImagePath(hero.heroClass) : null;
                      return (
                        <div key={hs.heroId} className="flex items-center gap-1">
                          <div className="w-7 h-7 rounded-full border border-primary/30 overflow-hidden bg-secondary/50">
                            {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="text-[10px]">
                            <div className="text-foreground/80">{hs.heroName}</div>
                            <div className="text-muted-foreground font-mono">{hs.damageShare.toFixed(0)}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => onLoadSimulation(sim)}
                  >
                    <Play className="w-3 h-3" /> 불러오기
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive gap-1"
                    onClick={() => handleDelete(sim.id)}
                  >
                    <Trash2 className="w-3 h-3" /> 삭제
                  </Button>
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
