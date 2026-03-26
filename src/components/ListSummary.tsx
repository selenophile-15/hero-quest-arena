import { useMemo } from 'react';
import { Hero, ELEMENT_ICON_MAP } from '@/types/game';
import ElementIcon from './ElementIcon';

interface ListSummaryProps {
  heroes: Hero[];
}

const CLASS_LINE_COLORS: Record<string, string> = {
  '전사': 'text-red-400',
  '로그': 'text-lime-400',
  '주문술사': 'text-sky-400',
};

const POSITION_COLORS: Record<string, string> = {
  '퓨어 탱커': 'text-blue-400',
  '회피 탱커': 'text-teal-400',
  '딜탱': 'text-orange-400',
  '치명 딜러': 'text-yellow-400',
  '일반 딜러': 'text-red-400',
  '회피 딜러': 'text-cyan-300',
  '좀비': 'text-purple-400',
  '기타': 'text-muted-foreground',
};

const ELEMENT_ORDER = ['불', '물', '공기', '대지', '빛', '어둠', '모든 원소'];
const CLASS_LINE_ORDER = ['전사', '로그', '주문술사'];

export default function ListSummary({ heroes }: ListSummaryProps) {
  const heroList = useMemo(() => heroes.filter(h => h.type === 'hero'), [heroes]);
  const champList = useMemo(() => heroes.filter(h => h.type === 'champion'), [heroes]);

  const elementDist = useMemo(() => {
    const counts: Record<string, { hero: number; champ: number }> = {};
    ELEMENT_ORDER.forEach(e => { counts[e] = { hero: 0, champ: 0 }; });
    heroes.forEach(h => {
      if (!h.element) return;
      if (!counts[h.element]) counts[h.element] = { hero: 0, champ: 0 };
      if (h.type === 'hero') counts[h.element].hero++;
      else counts[h.element].champ++;
    });
    return counts;
  }, [heroes]);

  const classLineDist = useMemo(() => {
    const counts: Record<string, number> = {};
    CLASS_LINE_ORDER.forEach(cl => { counts[cl] = 0; });
    heroList.forEach(h => {
      if (h.classLine) counts[h.classLine] = (counts[h.classLine] || 0) + 1;
    });
    return counts;
  }, [heroList]);

  const positionDist = useMemo(() => {
    const counts: Record<string, { hero: number; champ: number }> = {};
    heroes.forEach(h => {
      const pos = h.position || '미지정';
      if (!counts[pos]) counts[pos] = { hero: 0, champ: 0 };
      if (h.type === 'hero') counts[pos].hero++;
      else counts[pos].champ++;
    });
    return counts;
  }, [heroes]);

  const labelDist = useMemo(() => {
    const counts: Record<string, number> = {};
    heroes.forEach(h => {
      const lbl = h.label || '없음';
      counts[lbl] = (counts[lbl] || 0) + 1;
    });
    return counts;
  }, [heroes]);

  const totalHeroes = heroList.length;
  const totalChamps = champList.length;

  return (
    <div className="space-y-4">
      {/* Total counts */}
      <div className="card-fantasy p-4">
        <h3 className="text-sm font-semibold text-primary mb-3">총 인원</h3>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="text-foreground/70 text-sm">영웅</span>
            <span className="text-lg font-bold text-foreground">{totalHeroes}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground/70 text-sm">챔피언</span>
            <span className="text-lg font-bold text-foreground">{totalChamps}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-border pl-4">
            <span className="text-foreground/70 text-sm">합계</span>
            <span className="text-lg font-bold text-primary">{totalHeroes + totalChamps}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Element distribution */}
        <div className="card-fantasy p-4">
          <h3 className="text-sm font-semibold text-primary mb-3">속성별 분포</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-1.5 text-left">속성</th>
                <th className="py-1.5 text-center w-16">영웅</th>
                <th className="py-1.5 text-center w-16">챔피언</th>
                <th className="py-1.5 text-center w-16">합계</th>
              </tr>
            </thead>
            <tbody>
              {ELEMENT_ORDER.map(el => {
                const d = elementDist[el] || { hero: 0, champ: 0 };
                const total = d.hero + d.champ;
                return (
                  <tr key={el} className="border-b border-border/30">
                    <td className="py-1.5 flex items-center gap-1.5">
                      <ElementIcon element={el} size={18} />
                      <span className="text-foreground">{el}</span>
                    </td>
                    <td className={`py-1.5 text-center tabular-nums ${d.hero === 0 ? 'text-foreground/20' : 'text-foreground'}`}>{d.hero}</td>
                    <td className={`py-1.5 text-center tabular-nums ${d.champ === 0 ? 'text-foreground/20' : 'text-foreground'}`}>{d.champ}</td>
                    <td className={`py-1.5 text-center tabular-nums font-semibold ${total === 0 ? 'text-foreground/20' : 'text-primary'}`}>{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Class line distribution (heroes only) */}
        <div className="card-fantasy p-4">
          <h3 className="text-sm font-semibold text-primary mb-3">계열별 분포 (영웅)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-1.5 text-left">계열</th>
                <th className="py-1.5 text-center w-16">인원</th>
                <th className="py-1.5 text-left">비율</th>
              </tr>
            </thead>
            <tbody>
              {CLASS_LINE_ORDER.map(cl => {
                const count = classLineDist[cl] || 0;
                const pct = totalHeroes > 0 ? Math.round((count / totalHeroes) * 100) : 0;
                return (
                  <tr key={cl} className="border-b border-border/30">
                    <td className={`py-1.5 font-medium ${CLASS_LINE_COLORS[cl] || ''}`}>{cl}</td>
                    <td className={`py-1.5 text-center tabular-nums ${count === 0 ? 'text-foreground/20' : 'text-foreground'}`}>{count}</td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-secondary/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: cl === '전사' ? '#ef4444' : cl === '로그' ? '#84cc16' : '#38bdf8',
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Position distribution */}
      <div className="card-fantasy p-4">
        <h3 className="text-sm font-semibold text-primary mb-3">포지션별 분포</h3>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(positionDist)
            .sort(([, a], [, b]) => (b.hero + b.champ) - (a.hero + a.champ))
            .map(([pos, d]) => {
              const total = d.hero + d.champ;
              return (
                <div key={pos} className="border border-border/30 rounded-lg p-3 bg-secondary/10">
                  <p className={`text-sm font-medium ${POSITION_COLORS[pos] || 'text-foreground'}`}>{pos}</p>
                  <p className="text-lg font-bold text-foreground mt-1">{total}</p>
                  <p className="text-[10px] text-muted-foreground">영웅 {d.hero} / 챔피언 {d.champ}</p>
                </div>
              );
            })}
        </div>
      </div>

      {/* Label/Status distribution */}
      {Object.keys(labelDist).length > 1 && (
        <div className="card-fantasy p-4">
          <h3 className="text-sm font-semibold text-primary mb-3">상태별 분포</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(labelDist)
              .sort(([, a], [, b]) => b - a)
              .map(([lbl, count]) => (
                <div key={lbl} className="border border-border/30 rounded-lg px-3 py-2 bg-secondary/10 flex items-center gap-2">
                  <span className="text-sm text-foreground">{lbl}</span>
                  <span className="text-sm font-bold text-primary tabular-nums">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
