import { useState, useEffect } from 'react';
import { getSavedSimulations, SavedSimulationSummary } from '@/lib/savedSimulations';
import { formatNumber } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { getHeroes } from '@/lib/storage';

function CompareCell({ a, b, suffix = '', higher = 'better' }: { a: number; b: number; suffix?: string; higher?: 'better' | 'worse' | 'neutral' }) {
  const diff = a - b;
  const pct = b !== 0 ? ((a - b) / b * 100) : 0;
  let color = 'text-muted-foreground';
  let Icon = Minus;

  if (diff > 0) {
    color = higher === 'better' ? 'text-green-400' : higher === 'worse' ? 'text-red-400' : 'text-foreground';
    Icon = ArrowUp;
  } else if (diff < 0) {
    color = higher === 'better' ? 'text-red-400' : higher === 'worse' ? 'text-green-400' : 'text-foreground';
    Icon = ArrowDown;
  }

  return (
    <div className="flex items-center gap-1">
      {diff !== 0 && <Icon className={`w-3 h-3 ${color}`} />}
      <span className={`text-xs font-mono ${color}`}>
        {diff > 0 ? '+' : ''}{typeof a === 'number' && a % 1 !== 0 ? diff.toFixed(1) : formatNumber(Math.round(diff))}{suffix}
      </span>
    </div>
  );
}

export default function CompareAnalysis() {
  const [saved, setSaved] = useState<SavedSimulationSummary[]>([]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const allHeroes = getHeroes();

  useEffect(() => {
    setSaved(getSavedSimulations());
  }, []);

  const left = saved.find(s => s.id === leftId);
  const right = saved.find(s => s.id === rightId);

  if (saved.length < 2) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-sm">비교하려면 최소 2개의 저장된 결과가 필요합니다</p>
        <p className="text-muted-foreground/60 text-xs mt-1">먼저 시뮬레이션 결과를 저장해주세요</p>
      </div>
    );
  }

  const compareRows = left && right ? [
    { label: '승률', a: left.winRate, b: right.winRate, suffix: '%', higher: 'better' as const },
    { label: '평균 턴', a: left.avgRounds, b: right.avgRounds, suffix: '', higher: 'worse' as const },
    { label: '최소 턴', a: left.minRounds, b: right.minRounds, suffix: '', higher: 'worse' as const },
    { label: '최대 턴', a: left.maxRounds, b: right.maxRounds, suffix: '', higher: 'worse' as const },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">결과 A</label>
          <Select value={leftId} onValueChange={setLeftId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="선택..." />
            </SelectTrigger>
            <SelectContent>
              {saved.filter(s => s.id !== rightId).map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="truncate">{s.name} ({s.winRate.toFixed(1)}%)</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">결과 B</label>
          <Select value={rightId} onValueChange={setRightId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="선택..." />
            </SelectTrigger>
            <SelectContent>
              {saved.filter(s => s.id !== leftId).map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="truncate">{s.name} ({s.winRate.toFixed(1)}%)</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comparison */}
      {left && right && (
        <div className="space-y-4">
          {/* Core metrics */}
          <div className="card-fantasy p-4">
            <h4 className="text-sm font-bold text-foreground mb-3">핵심 지표 비교</h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 text-muted-foreground font-medium">항목</th>
                  <th className="text-center py-2 text-primary font-medium">A</th>
                  <th className="text-center py-2 text-muted-foreground font-medium">차이</th>
                  <th className="text-center py-2 text-accent font-medium">B</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map(row => (
                  <tr key={row.label} className="border-b border-border/20">
                    <td className="py-2 text-foreground font-medium">{row.label}</td>
                    <td className={`py-2 text-center font-mono ${
                      row.label === '승률' ? (
                        row.a >= row.b ? 'text-green-400 font-bold' : 'text-foreground'
                      ) : 'text-foreground'
                    }`}>
                      {row.a % 1 !== 0 ? row.a.toFixed(1) : row.a}{row.suffix}
                    </td>
                    <td className="py-2 text-center">
                      <div className="flex justify-center">
                        <CompareCell a={row.a} b={row.b} suffix={row.suffix} higher={row.higher} />
                      </div>
                    </td>
                    <td className={`py-2 text-center font-mono ${
                      row.label === '승률' ? (
                        row.b >= row.a ? 'text-green-400 font-bold' : 'text-foreground'
                      ) : 'text-foreground'
                    }`}>
                      {row.b % 1 !== 0 ? row.b.toFixed(1) : row.b}{row.suffix}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Hero comparison */}
          <div className="card-fantasy p-4">
            <h4 className="text-sm font-bold text-foreground mb-3">파티원 비교</h4>
            <div className="grid grid-cols-2 gap-4">
              {[left, right].map((sim, si) => (
                <div key={sim.id}>
                  <div className="text-[10px] text-muted-foreground mb-2 text-center">{si === 0 ? 'A' : 'B'}: {sim.name}</div>
                  <div className="space-y-1.5">
                    {sim.heroSummaries.map(hs => {
                      const hero = allHeroes.find(h => h.id === hs.heroId);
                      const img = hero?.type === 'champion'
                        ? getChampionImagePath(hero.championName || hero.name)
                        : hero?.heroClass ? getJobImagePath(hero.heroClass) : null;
                      return (
                        <div key={hs.heroId} className="flex items-center gap-2 p-1.5 rounded bg-secondary/20">
                          <div className="w-6 h-6 rounded-full border border-primary/30 overflow-hidden bg-secondary/50 shrink-0">
                            {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-foreground font-medium truncate">{hs.heroName}</div>
                            <div className="text-[10px] text-muted-foreground">{hs.heroClass}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-[11px] font-mono ${hs.survivalRate >= 80 ? 'text-green-400' : hs.survivalRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              생존 {hs.survivalRate.toFixed(0)}%
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground">
                              딜 {hs.damageShare.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
