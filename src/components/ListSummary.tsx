import { useState, useMemo, useCallback } from 'react';
import { Hero, ELEMENT_ICON_MAP } from '@/types/game';
import ElementIcon from './ElementIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Users, TrendingUp } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface ListSummaryProps {
  heroes: Hero[];
}

const STORAGE_KEY_OWNED = 'quest-sim-summary-owned';
const STORAGE_KEY_PLANNED = 'quest-sim-summary-planned';

function loadIds(key: string): string[] {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}
function saveIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

const CLASS_LINE_COLORS: Record<string, string> = {
  '전사': 'text-red-400',
  '로그': 'text-lime-400',
  '주문술사': 'text-sky-400',
};
const CLASS_LINE_BG: Record<string, string> = {
  '전사': 'bg-red-500/15',
  '로그': 'bg-lime-500/15',
  '주문술사': 'bg-sky-500/15',
};

const POSITION_COLORS: Record<string, string> = {
  '퓨어 탱커': 'bg-blue-500',
  '회피 탱커': 'bg-teal-500',
  '딜탱': 'bg-orange-500',
  '치명 딜러': 'bg-red-500',
  '일반 딜러': 'bg-yellow-500',
  '회피 딜러': 'bg-cyan-500',
  '좀비': 'bg-purple-500',
  '기타': 'bg-secondary',
};
const POSITION_TEXT_COLORS: Record<string, string> = {
  '퓨어 탱커': 'text-blue-400',
  '회피 탱커': 'text-teal-400',
  '딜탱': 'text-orange-400',
  '치명 딜러': 'text-red-400',
  '일반 딜러': 'text-yellow-400',
  '회피 딜러': 'text-cyan-300',
  '좀비': 'text-purple-400',
  '기타': 'text-muted-foreground',
};
const POSITION_BAR_STYLE: Record<string, string> = {
  '퓨어 탱커': '#3b82f6',
  '회피 탱커': '#14b8a6',
  '딜탱': '#f97316',
  '치명 딜러': '#ef4444',
  '일반 딜러': '#eab308',
  '회피 딜러': '#22d3ee',
  '좀비': '#a855f7',
  '기타': '#6b7280',
};

const ELEMENT_ORDER = ['불', '물', '공기', '대지', '빛', '어둠', '모든 원소'];
const CLASS_LINE_ORDER = ['전사', '로그', '주문술사'];

// Element bar colors
const ELEMENT_BAR_COLORS: Record<string, string> = {
  '불': '#ef4444',
  '물': '#3b82f6',
  '공기': '#22c55e',
  '대지': '#a16207',
  '빛': '#eab308',
  '어둠': '#a855f7',
  '모든 원소': '#ec4899',
};

/* ── Hero picker dialog — shows ALL heroes, cross-group toggle ── */
function HeroPicker({ open, onClose, allHeroes, ownedIds, plannedIds, target, onConfirm, title }: {
  open: boolean;
  onClose: () => void;
  allHeroes: Hero[];
  ownedIds: string[];
  plannedIds: string[];
  target: 'owned' | 'planned';
  onConfirm: (owned: string[], planned: string[]) => void;
  title: string;
}) {
  const [localOwned, setLocalOwned] = useState<Set<string>>(new Set(ownedIds));
  const [localPlanned, setLocalPlanned] = useState<Set<string>>(new Set(plannedIds));

  const toggle = useCallback((id: string) => {
    if (target === 'owned') {
      setLocalOwned(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          // Remove from other group
          setLocalPlanned(p => { const n = new Set(p); n.delete(id); return n; });
        }
        return next;
      });
    } else {
      setLocalPlanned(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          // Remove from other group
          setLocalOwned(p => { const n = new Set(p); n.delete(id); return n; });
        }
        return next;
      });
    }
  }, [target]);

  const isChecked = (id: string) => target === 'owned' ? localOwned.has(id) : localPlanned.has(id);
  const otherLabel = (id: string) => {
    if (target === 'owned' && localPlanned.has(id)) return '추가 예정';
    if (target === 'planned' && localOwned.has(id)) return '보유 중';
    return null;
  };

  const heroItems = useMemo(() => allHeroes.filter(h => h.type === 'hero'), [allHeroes]);
  const champItems = useMemo(() => allHeroes.filter(h => h.type === 'champion'), [allHeroes]);

  const selectAll = () => {
    const ids = new Set(allHeroes.map(h => h.id));
    if (target === 'owned') {
      setLocalOwned(ids);
      setLocalPlanned(new Set());
    } else {
      setLocalPlanned(ids);
      setLocalOwned(new Set());
    }
  };
  const deselectAll = () => {
    if (target === 'owned') setLocalOwned(new Set());
    else setLocalPlanned(new Set());
  };

  const currentCount = target === 'owned' ? localOwned.size : localPlanned.size;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={selectAll}>전체 선택</Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>전체 해제</Button>
          <span className="ml-auto text-sm text-muted-foreground">{currentCount}명 선택</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {heroItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">영웅</p>
              <div className="space-y-0.5">
                {heroItems.map(h => {
                  const other = otherLabel(h.id);
                  return (
                    <label key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/40 cursor-pointer">
                      <Checkbox checked={isChecked(h.id)} onCheckedChange={() => toggle(h.id)} />
                      <ElementIcon element={h.element} size={16} />
                      <span className={`text-sm ${CLASS_LINE_COLORS[h.classLine] || ''}`}>{h.heroClass}</span>
                      <span className="text-sm text-foreground">{h.name}</span>
                      {h.position && <span className="text-xs text-muted-foreground">{h.position}</span>}
                      {other && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{other}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {champItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">챔피언</p>
              <div className="space-y-0.5">
                {champItems.map(h => {
                  const other = otherLabel(h.id);
                  return (
                    <label key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/40 cursor-pointer">
                      <Checkbox checked={isChecked(h.id)} onCheckedChange={() => toggle(h.id)} />
                      <ElementIcon element={h.element} size={16} />
                      <span className="text-sm text-foreground">{h.championName || h.name}</span>
                      {h.position && <span className="text-xs text-muted-foreground">{h.position}</span>}
                      {other && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{other}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={() => { onConfirm(Array.from(localOwned), Array.from(localPlanned)); onClose(); }}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Matrix grid table (element × classLine) ── */
// Fixed cell sizes: hero rows fit 6, champion row fits 4
const HERO_CELL_MIN_H = 'min-h-[160px]'; // ~6 entries
const CHAMP_CELL_MIN_H = 'min-h-[110px]'; // ~4 entries

function MatrixGrid({ heroes, label, icon, onAdd, accentClass, isPlanned }: {
  heroes: Hero[];
  label: string;
  icon: React.ReactNode;
  onAdd: () => void;
  accentClass: string;
  isPlanned?: boolean;
}) {
  // Build matrix
  type CellEntry = Hero;
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, CellEntry[]>> = {};
    const lines = [...CLASS_LINE_ORDER, '챔피언'];
    lines.forEach(cl => { m[cl] = {}; ELEMENT_ORDER.forEach(el => { m[cl][el] = []; }); });
    heroes.forEach(h => {
      const cl = h.type === 'champion' ? '챔피언' : (h.classLine || '기타');
      const el = h.element || '기타';
      if (!m[cl]) { m[cl] = {}; ELEMENT_ORDER.forEach(e => { m[cl][e] = []; }); }
      if (!m[cl][el]) m[cl][el] = [];
      m[cl][el].push(h);
    });
    return m;
  }, [heroes]);

  const classLines = useMemo(() => {
    const lines = [...CLASS_LINE_ORDER, '챔피언'];
    return lines.filter(cl => matrix[cl] && ELEMENT_ORDER.some(el => matrix[cl][el]?.length > 0));
  }, [matrix]);

  // Row/col totals
  const rowTotals = useMemo(() => {
    const t: Record<string, number> = {};
    classLines.forEach(cl => {
      t[cl] = ELEMENT_ORDER.reduce((s, el) => s + (matrix[cl][el]?.length || 0), 0);
    });
    return t;
  }, [matrix, classLines]);

  const colTotals = useMemo(() => {
    const t: Record<string, number> = {};
    ELEMENT_ORDER.forEach(el => {
      t[el] = classLines.reduce((s, cl) => s + (matrix[cl]?.[el]?.length || 0), 0);
    });
    return t;
  }, [matrix, classLines]);

  const grandTotal = heroes.length;

  return (
    <div className="card-fantasy p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
          {icon}
          {label}
          <span className="text-muted-foreground font-normal ml-1">({heroes.length}명)</span>
        </h3>
        <Button size="sm" onClick={onAdd} className={`gap-1 ${accentClass}`}>
          <Plus size={14} /> 추가
        </Button>
      </div>

      {heroes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          아직 추가된 항목이 없습니다. 위 버튼을 눌러 리스트에서 선택하세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-2 text-left text-muted-foreground font-medium w-20"></th>
                {ELEMENT_ORDER.map(el => (
                  <th key={el} className="py-2 px-1 text-center" style={{ minWidth: '120px' }}>
                    <div className="flex items-center justify-center gap-1">
                      <ElementIcon element={el} size={16} />
                      <span className="text-foreground font-medium">{el}</span>
                    </div>
                  </th>
                ))}
                <th className="py-2 px-2 text-center text-muted-foreground font-medium w-14">인원</th>
              </tr>
            </thead>
            <tbody>
              {classLines.map(cl => {
                const isChamp = cl === '챔피언';
                const cellH = isChamp ? CHAMP_CELL_MIN_H : HERO_CELL_MIN_H;
                return (
                  <tr key={cl} className="border-b border-border/30">
                    <td className={`py-2 px-2 font-bold whitespace-nowrap text-sm ${isChamp ? 'text-yellow-400' : (CLASS_LINE_COLORS[cl] || 'text-foreground')} ${CLASS_LINE_BG[cl] || ''}`}>
                      {cl}
                    </td>
                    {ELEMENT_ORDER.map(el => {
                      const cells = matrix[cl]?.[el] || [];
                      return (
                        <td key={el} className={`py-1.5 px-1.5 align-top border-l border-border/20 ${cellH}`}>
                          <div className="flex flex-col items-center gap-1">
                            {cells.map(h => (
                              <div key={h.id} className={`flex flex-col items-center ${isPlanned ? 'opacity-60' : ''}`}>
                                {h.type === 'hero' ? (
                                  <span className={`text-sm font-semibold ${CLASS_LINE_COLORS[h.classLine] || 'text-foreground'}`}>{h.heroClass}</span>
                                ) : (
                                  <span className="text-sm font-semibold text-yellow-400">{h.championName || h.name}</span>
                                )}
                                {h.position && (
                                  <span className={`text-xs font-bold px-1.5 rounded ${POSITION_COLORS[h.position] || 'bg-secondary'} text-white`}>
                                    {h.position}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-center font-bold text-foreground text-sm border-l border-border/40">
                      {rowTotals[cl]}
                    </td>
                  </tr>
                );
              })}
              {/* Column totals */}
              <tr className="border-t-2 border-border bg-secondary/10">
                <td className="py-2 px-2 font-semibold text-muted-foreground">인원</td>
                {ELEMENT_ORDER.map(el => (
                  <td key={el} className="py-2 px-1 text-center font-bold text-foreground border-l border-border/20">
                    {colTotals[el] || ''}
                  </td>
                ))}
                <td className="py-2 px-2 text-center font-bold text-primary border-l border-border/40">
                  {grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Element distribution bar chart with element-specific colors ── */
function ElementSummary({ owned, planned }: { owned: Hero[]; planned: Hero[] }) {
  const ownedSet = useMemo(() => new Set(owned.map(h => h.id)), [owned]);
  const all = useMemo(() => [...owned, ...planned], [owned, planned]);

  const data = useMemo(() => {
    const map: Record<string, { owned: number; planned: number }> = {};
    ELEMENT_ORDER.forEach(el => { map[el] = { owned: 0, planned: 0 }; });
    all.forEach(h => {
      const el = h.element || '기타';
      if (!map[el]) map[el] = { owned: 0, planned: 0 };
      if (ownedSet.has(h.id)) map[el].owned++;
      else map[el].planned++;
    });
    return map;
  }, [all, ownedSet]);

  const maxCount = Math.max(...Object.values(data).map(d => d.owned + d.planned), 1);

  if (all.length === 0) return null;

  return (
    <div className="card-fantasy p-3">
      <h3 className="text-sm font-semibold text-primary mb-3">속성 분포</h3>
      <div className="space-y-2">
        {ELEMENT_ORDER.map(el => {
          const d = data[el];
          const total = d.owned + d.planned;
          const ownedPct = (d.owned / maxCount) * 100;
          const plannedPct = (d.planned / maxCount) * 100;
          const color = ELEMENT_BAR_COLORS[el] || '#6b7280';
          return (
            <div key={el} className="flex items-center gap-2">
              <div className="flex items-center gap-1 w-20 justify-end">
                <ElementIcon element={el} size={14} />
                <span className="text-xs text-foreground">{el}</span>
              </div>
              <div className="flex-1 h-5 bg-secondary/20 rounded overflow-hidden flex">
                {d.owned > 0 && (
                  <div className="h-full transition-all" style={{ width: `${ownedPct}%`, backgroundColor: color }} />
                )}
                {d.planned > 0 && (
                  <div className="h-full transition-all" style={{ width: `${plannedPct}%`, backgroundColor: color, opacity: 0.4 }} />
                )}
              </div>
              <span className="text-xs font-bold text-foreground tabular-nums w-8 text-right">{total}</span>
              {d.planned > 0 && (
                <span className="text-[9px] text-muted-foreground tabular-nums w-10">(+{d.planned})</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Class line distribution ── */
function ClassLineSummary({ owned, planned }: { owned: Hero[]; planned: Hero[] }) {
  const ownedSet = useMemo(() => new Set(owned.map(h => h.id)), [owned]);
  const heroesOnly = useMemo(() => [...owned, ...planned].filter(h => h.type === 'hero'), [owned, planned]);

  const data = useMemo(() => {
    const map: Record<string, { owned: number; planned: number }> = {};
    CLASS_LINE_ORDER.forEach(cl => { map[cl] = { owned: 0, planned: 0 }; });
    heroesOnly.forEach(h => {
      const cl = h.classLine || '기타';
      if (!map[cl]) map[cl] = { owned: 0, planned: 0 };
      if (ownedSet.has(h.id)) map[cl].owned++;
      else map[cl].planned++;
    });
    return map;
  }, [heroesOnly, ownedSet]);

  const maxCount = Math.max(...Object.values(data).map(d => d.owned + d.planned), 1);
  if (heroesOnly.length === 0) return null;

  const clBarColors: Record<string, string> = {
    '전사': '#ef4444',
    '로그': '#84cc16',
    '주문술사': '#38bdf8',
  };

  return (
    <div className="card-fantasy p-3">
      <h3 className="text-sm font-semibold text-primary mb-3">계열 분포 (영웅)</h3>
      <div className="space-y-2">
        {CLASS_LINE_ORDER.map(cl => {
          const d = data[cl];
          const total = d.owned + d.planned;
          const ownedPct = (d.owned / maxCount) * 100;
          const plannedPct = (d.planned / maxCount) * 100;
          const color = clBarColors[cl] || '#6b7280';
          return (
            <div key={cl} className="flex items-center gap-2">
              <span className={`text-xs font-medium w-20 text-right ${CLASS_LINE_COLORS[cl]}`}>{cl}</span>
              <div className="flex-1 h-5 bg-secondary/20 rounded overflow-hidden flex">
                {d.owned > 0 && (
                  <div className="h-full transition-all" style={{ width: `${ownedPct}%`, backgroundColor: color }} />
                )}
                {d.planned > 0 && (
                  <div className="h-full transition-all" style={{ width: `${plannedPct}%`, backgroundColor: color, opacity: 0.4 }} />
                )}
              </div>
              <span className="text-xs font-bold text-foreground tabular-nums w-8 text-right">{total}</span>
              {d.planned > 0 && (
                <span className="text-[9px] text-muted-foreground tabular-nums w-10">(+{d.planned})</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Position distribution chart ── */
function PositionChart({ owned, planned }: { owned: Hero[]; planned: Hero[] }) {
  const all = useMemo(() => [...owned, ...planned], [owned, planned]);
  const ownedSet = useMemo(() => new Set(owned.map(h => h.id)), [owned]);

  const posData = useMemo(() => {
    const map: Record<string, { owned: number; planned: number }> = {};
    all.forEach(h => {
      const pos = h.position || '미지정';
      if (!map[pos]) map[pos] = { owned: 0, planned: 0 };
      if (ownedSet.has(h.id)) map[pos].owned++;
      else map[pos].planned++;
    });
    return Object.entries(map).sort(([, a], [, b]) => (b.owned + b.planned) - (a.owned + a.planned));
  }, [all, ownedSet]);

  if (posData.length === 0) return null;
  const maxCount = Math.max(...posData.map(([, d]) => d.owned + d.planned), 1);

  return (
    <div className="card-fantasy p-3">
      <h3 className="text-sm font-semibold text-primary mb-3">포지션 분포</h3>
      <div className="space-y-2">
        {posData.map(([pos, d]) => {
          const total = d.owned + d.planned;
          const ownedPct = (d.owned / maxCount) * 100;
          const plannedPct = (d.planned / maxCount) * 100;
          const color = POSITION_BAR_STYLE[pos] || '#6b7280';
          return (
            <div key={pos} className="flex items-center gap-2">
              <span className={`text-xs font-medium w-20 text-right ${POSITION_TEXT_COLORS[pos] || 'text-muted-foreground'}`}>
                {pos}
              </span>
              <div className="flex-1 h-5 bg-secondary/20 rounded overflow-hidden flex">
                {d.owned > 0 && (
                  <div className="h-full transition-all" style={{ width: `${ownedPct}%`, backgroundColor: color }} />
                )}
                {d.planned > 0 && (
                  <div className="h-full transition-all" style={{ width: `${plannedPct}%`, backgroundColor: color, opacity: 0.4 }} />
                )}
              </div>
              <span className="text-xs font-bold text-foreground tabular-nums w-8 text-right">{total}</span>
              {d.planned > 0 && (
                <span className="text-[9px] text-muted-foreground tabular-nums w-10">(+{d.planned})</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
        <span>■ 진한 = 보유 중</span>
        <span style={{ opacity: 0.4 }}>■ 흐린 = 추가 예정</span>
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function ListSummary({ heroes }: ListSummaryProps) {
  const [ownedIds, setOwnedIds] = useState<string[]>(() => loadIds(STORAGE_KEY_OWNED));
  const [plannedIds, setPlannedIds] = useState<string[]>(() => loadIds(STORAGE_KEY_PLANNED));
  const [pickerTarget, setPickerTarget] = useState<'owned' | 'planned' | null>(null);

  const ownedHeroes = useMemo(() => {
    const idSet = new Set(ownedIds);
    return heroes.filter(h => idSet.has(h.id));
  }, [heroes, ownedIds]);

  const plannedHeroes = useMemo(() => {
    const idSet = new Set(plannedIds);
    return heroes.filter(h => idSet.has(h.id));
  }, [heroes, plannedIds]);

  const handlePickerConfirm = useCallback((newOwned: string[], newPlanned: string[]) => {
    setOwnedIds(newOwned);
    setPlannedIds(newPlanned);
    saveIds(STORAGE_KEY_OWNED, newOwned);
    saveIds(STORAGE_KEY_PLANNED, newPlanned);
  }, []);

  const removeOwned = useCallback((id: string) => {
    const next = ownedIds.filter(i => i !== id);
    setOwnedIds(next);
    saveIds(STORAGE_KEY_OWNED, next);
  }, [ownedIds]);

  const removePlanned = useCallback((id: string) => {
    const next = plannedIds.filter(i => i !== id);
    setPlannedIds(next);
    saveIds(STORAGE_KEY_PLANNED, next);
  }, [plannedIds]);

  return (
    <div className="space-y-4">
      {/* ── 보유 중 표 ── */}
      <MatrixGrid
        heroes={ownedHeroes}
        label="보유 중"
        icon={<Users size={14} />}
        onAdd={() => setPickerTarget('owned')}
        accentClass="bg-emerald-600 text-white hover:bg-emerald-700"
      />

      {/* ── 추가 예정 표 ── */}
      <MatrixGrid
        heroes={plannedHeroes}
        label="추가 예정"
        icon={<TrendingUp size={14} />}
        onAdd={() => setPickerTarget('planned')}
        accentClass="bg-amber-600 text-white hover:bg-amber-700"
        isPlanned
      />

      {/* ── 전체 분포 ── */}
      {(ownedHeroes.length > 0 || plannedHeroes.length > 0) && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-primary border-b border-border pb-1">
            전체 분포 ({ownedHeroes.length + plannedHeroes.length}명)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ElementSummary owned={ownedHeroes} planned={plannedHeroes} />
            <ClassLineSummary owned={ownedHeroes} planned={plannedHeroes} />
          </div>
          <PositionChart owned={ownedHeroes} planned={plannedHeroes} />
        </div>
      )}

      {/* ── Picker dialog ── */}
      {pickerTarget && (
        <HeroPicker
          open
          onClose={() => setPickerTarget(null)}
          allHeroes={heroes}
          ownedIds={ownedIds}
          plannedIds={plannedIds}
          target={pickerTarget}
          onConfirm={handlePickerConfirm}
          title={pickerTarget === 'owned' ? '보유 중 영웅 선택' : '추가 예정 영웅 선택'}
        />
      )}
    </div>
  );
}
