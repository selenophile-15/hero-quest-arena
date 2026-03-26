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

const ELEMENT_ORDER = ['불', '물', '공기', '대지', '빛', '어둠', '모든 원소'];
const CLASS_LINE_ORDER = ['전사', '로그', '주문술사'];

/* ── Hero picker dialog with duplicate prevention ── */
function HeroPicker({ open, onClose, allHeroes, selectedIds, excludeIds, onConfirm, title }: {
  open: boolean;
  onClose: () => void;
  allHeroes: Hero[];
  selectedIds: string[];
  excludeIds: string[];
  onConfirm: (ids: string[]) => void;
  title: string;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const available = useMemo(() => allHeroes.filter(h => !excludeSet.has(h.id)), [allHeroes, excludeSet]);
  const heroItems = useMemo(() => available.filter(h => h.type === 'hero'), [available]);
  const champItems = useMemo(() => available.filter(h => h.type === 'champion'), [available]);

  const selectAll = () => setChecked(new Set(available.map(h => h.id)));
  const deselectAll = () => setChecked(new Set());

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={selectAll}>전체 선택</Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>전체 해제</Button>
          <span className="ml-auto text-sm text-muted-foreground">{checked.size}명 선택</span>
        </div>
        {excludeIds.length > 0 && (
          <p className="text-xs text-muted-foreground mb-1">※ 다른 그룹에 이미 선택된 항목은 표시되지 않습니다.</p>
        )}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {heroItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">영웅</p>
              <div className="space-y-0.5">
                {heroItems.map(h => (
                  <label key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/40 cursor-pointer">
                    <Checkbox checked={checked.has(h.id)} onCheckedChange={() => toggle(h.id)} />
                    <ElementIcon element={h.element} size={16} />
                    <span className={`text-sm ${CLASS_LINE_COLORS[h.classLine] || ''}`}>{h.heroClass}</span>
                    <span className="text-sm text-foreground">{h.name}</span>
                    {h.position && <span className="ml-auto text-xs text-muted-foreground">{h.position}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
          {champItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">챔피언</p>
              <div className="space-y-0.5">
                {champItems.map(h => (
                  <label key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/40 cursor-pointer">
                    <Checkbox checked={checked.has(h.id)} onCheckedChange={() => toggle(h.id)} />
                    <ElementIcon element={h.element} size={16} />
                    <span className="text-sm text-foreground">{h.championName || h.name}</span>
                    {h.position && <span className="ml-auto text-xs text-muted-foreground">{h.position}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={() => { onConfirm(Array.from(checked)); onClose(); }}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Group table (보유 중 / 추가 예정) ── */
function GroupTable({ label, icon, heroes, onAdd, onRemove, accentClass }: {
  label: string;
  icon: React.ReactNode;
  heroes: Hero[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  accentClass: string;
}) {
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
        <p className="text-sm text-muted-foreground text-center py-4">
          아직 추가된 항목이 없습니다. 위 버튼을 눌러 리스트에서 선택하세요.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {heroes.map(h => (
            <div key={h.id} className="flex items-center gap-1 bg-secondary/30 border border-border/40 rounded-md pl-2 pr-1 py-1 text-sm group">
              <ElementIcon element={h.element} size={14} />
              {h.type === 'hero' && (
                <span className={`${CLASS_LINE_COLORS[h.classLine] || ''} text-xs`}>{h.heroClass}</span>
              )}
              <span className="text-foreground">{h.type === 'champion' ? (h.championName || h.name) : h.name}</span>
              {h.position && <span className={`text-[10px] ml-0.5 ${POSITION_TEXT_COLORS[h.position] || 'text-muted-foreground'}`}>{h.position}</span>}
              <button onClick={() => onRemove(h.id)} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Matrix table: element columns × class line rows ── */
function MatrixTable({ owned, planned }: { owned: Hero[]; planned: Hero[] }) {
  const all = useMemo(() => [...owned, ...planned], [owned, planned]);
  if (all.length === 0) return null;

  const ownedSet = useMemo(() => new Set(owned.map(h => h.id)), [owned]);

  // Build matrix: classLine → element → heroes[]
  type CellData = { hero: Hero; isOwned: boolean }[];
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, CellData>> = {};
    // Add "챔피언" as a virtual class line
    const lines = [...CLASS_LINE_ORDER, '챔피언'];
    lines.forEach(cl => {
      m[cl] = {};
      ELEMENT_ORDER.forEach(el => { m[cl][el] = []; });
    });
    all.forEach(h => {
      const cl = h.type === 'champion' ? '챔피언' : (h.classLine || '기타');
      const el = h.element || '기타';
      if (!m[cl]) { m[cl] = {}; ELEMENT_ORDER.forEach(e => { m[cl][e] = []; }); }
      if (!m[cl][el]) m[cl][el] = [];
      m[cl][el].push({ hero: h, isOwned: ownedSet.has(h.id) });
    });
    return m;
  }, [all, ownedSet]);

  const classLines = useMemo(() => {
    const lines = [...CLASS_LINE_ORDER, '챔피언'];
    return lines.filter(cl => matrix[cl] && ELEMENT_ORDER.some(el => matrix[cl][el]?.length > 0));
  }, [matrix]);

  // Row totals per class line
  const rowTotals = useMemo(() => {
    const t: Record<string, { owned: number; planned: number }> = {};
    classLines.forEach(cl => {
      let o = 0, p = 0;
      ELEMENT_ORDER.forEach(el => {
        matrix[cl][el]?.forEach(d => { if (d.isOwned) o++; else p++; });
      });
      t[cl] = { owned: o, planned: p };
    });
    return t;
  }, [matrix, classLines]);

  // Column totals per element
  const colTotals = useMemo(() => {
    const t: Record<string, { owned: number; planned: number }> = {};
    ELEMENT_ORDER.forEach(el => {
      let o = 0, p = 0;
      classLines.forEach(cl => {
        matrix[cl][el]?.forEach(d => { if (d.isOwned) o++; else p++; });
      });
      t[el] = { owned: o, planned: p };
    });
    return t;
  }, [matrix, classLines]);

  const grandTotal = useMemo(() => {
    let o = 0, p = 0;
    Object.values(colTotals).forEach(v => { o += v.owned; p += v.planned; });
    return { owned: o, planned: p };
  }, [colTotals]);

  return (
    <div className="card-fantasy p-3 overflow-x-auto">
      <h3 className="text-sm font-semibold text-primary mb-3">속성 × 계열 분포</h3>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 px-2 text-left text-muted-foreground font-medium w-16"></th>
            {ELEMENT_ORDER.map(el => (
              <th key={el} className="py-2 px-1 text-center min-w-[100px]">
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
          {classLines.map(cl => (
            <tr key={cl} className="border-b border-border/30">
              <td className={`py-2 px-2 font-semibold whitespace-nowrap ${cl === '챔피언' ? 'text-yellow-400' : (CLASS_LINE_COLORS[cl] || 'text-foreground')} ${CLASS_LINE_BG[cl] || ''}`}>
                {cl}
              </td>
              {ELEMENT_ORDER.map(el => {
                const cells = matrix[cl]?.[el] || [];
                return (
                  <td key={el} className="py-1.5 px-1 align-top border-l border-border/20">
                    {cells.length > 0 ? (
                      <div className="space-y-0.5">
                        {cells.map(({ hero: h, isOwned }) => (
                          <div key={h.id} className="flex items-center gap-1 flex-wrap">
                            {h.type === 'hero' && (
                              <span className={`${CLASS_LINE_COLORS[h.classLine] || ''} text-[10px]`}>{h.heroClass}</span>
                            )}
                            <span className={`text-foreground text-[11px] ${!isOwned ? 'opacity-50 italic' : ''}`}>
                              {h.type === 'champion' ? (h.championName || h.name) : h.name}
                            </span>
                            {h.position && (
                              <span className={`text-[9px] px-1 rounded ${
                                POSITION_COLORS[h.position]?.replace('bg-', 'bg-') || 'bg-secondary'
                              } text-white font-medium`}>
                                {h.position}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </td>
                );
              })}
              <td className="py-2 px-2 text-center font-bold text-foreground border-l border-border/40">
                {rowTotals[cl].owned + rowTotals[cl].planned}
                {rowTotals[cl].planned > 0 && (
                  <div className="text-[9px] text-muted-foreground font-normal">
                    +{rowTotals[cl].planned}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {/* Column totals row */}
          <tr className="border-t-2 border-border bg-secondary/10">
            <td className="py-2 px-2 font-semibold text-muted-foreground">인원</td>
            {ELEMENT_ORDER.map(el => {
              const t = colTotals[el];
              return (
                <td key={el} className="py-2 px-1 text-center font-bold text-foreground border-l border-border/20">
                  {t.owned + t.planned}
                  {t.planned > 0 && (
                    <span className="text-[9px] text-muted-foreground font-normal ml-0.5">
                      (+{t.planned})
                    </span>
                  )}
                </td>
              );
            })}
            <td className="py-2 px-2 text-center font-bold text-primary border-l border-border/40">
              {grandTotal.owned + grandTotal.planned}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
        <span>■ 일반 = 보유 중</span>
        <span className="opacity-50 italic">■ 흐린 글씨 = 추가 예정</span>
      </div>
    </div>
  );
}

/* ── Position distribution bar chart ── */
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
          const bgClass = POSITION_COLORS[pos] || 'bg-secondary';
          return (
            <div key={pos} className="flex items-center gap-2">
              <span className={`text-xs font-medium w-20 text-right ${POSITION_TEXT_COLORS[pos] || 'text-muted-foreground'}`}>
                {pos}
              </span>
              <div className="flex-1 h-5 bg-secondary/20 rounded overflow-hidden flex">
                {d.owned > 0 && (
                  <div className={`h-full ${bgClass} transition-all`} style={{ width: `${ownedPct}%` }} />
                )}
                {d.planned > 0 && (
                  <div className={`h-full ${bgClass} opacity-40 transition-all`} style={{ width: `${plannedPct}%` }} />
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
        <span className="opacity-40">■ 흐린 = 추가 예정</span>
      </div>
    </div>
  );
}

/* ── Element distribution summary ── */
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
          return (
            <div key={el} className="flex items-center gap-2">
              <div className="flex items-center gap-1 w-20 justify-end">
                <ElementIcon element={el} size={14} />
                <span className="text-xs text-foreground">{el}</span>
              </div>
              <div className="flex-1 h-5 bg-secondary/20 rounded overflow-hidden flex">
                {d.owned > 0 && (
                  <div className="h-full bg-primary transition-all" style={{ width: `${ownedPct}%` }} />
                )}
                {d.planned > 0 && (
                  <div className="h-full bg-primary/40 transition-all" style={{ width: `${plannedPct}%` }} />
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
    '전사': 'bg-red-500',
    '로그': 'bg-lime-500',
    '주문술사': 'bg-sky-500',
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
          const bg = clBarColors[cl] || 'bg-secondary';
          return (
            <div key={cl} className="flex items-center gap-2">
              <span className={`text-xs font-medium w-20 text-right ${CLASS_LINE_COLORS[cl]}`}>{cl}</span>
              <div className="flex-1 h-5 bg-secondary/20 rounded overflow-hidden flex">
                {d.owned > 0 && (
                  <div className={`h-full ${bg} transition-all`} style={{ width: `${ownedPct}%` }} />
                )}
                {d.planned > 0 && (
                  <div className={`h-full ${bg} opacity-40 transition-all`} style={{ width: `${plannedPct}%` }} />
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

  const updateOwned = useCallback((ids: string[]) => {
    setOwnedIds(ids);
    saveIds(STORAGE_KEY_OWNED, ids);
  }, []);
  const updatePlanned = useCallback((ids: string[]) => {
    setPlannedIds(ids);
    saveIds(STORAGE_KEY_PLANNED, ids);
  }, []);

  const removeOwned = useCallback((id: string) => {
    updateOwned(ownedIds.filter(i => i !== id));
  }, [ownedIds, updateOwned]);
  const removePlanned = useCallback((id: string) => {
    updatePlanned(plannedIds.filter(i => i !== id));
  }, [plannedIds, updatePlanned]);

  return (
    <div className="space-y-4">
      {/* ── 보유 중 ── */}
      <GroupTable
        label="보유 중"
        icon={<Users size={14} />}
        heroes={ownedHeroes}
        onAdd={() => setPickerTarget('owned')}
        onRemove={removeOwned}
        accentClass="bg-primary text-primary-foreground hover:bg-primary/90"
      />

      {/* ── 추가 예정 ── */}
      <GroupTable
        label="추가 예정"
        icon={<TrendingUp size={14} />}
        heroes={plannedHeroes}
        onAdd={() => setPickerTarget('planned')}
        onRemove={removePlanned}
        accentClass="bg-accent text-accent-foreground hover:bg-accent/90"
      />

      {/* ── 매트릭스 표 ── */}
      <MatrixTable owned={ownedHeroes} planned={plannedHeroes} />

      {/* ── 전체 분포 (합산) ── */}
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
          selectedIds={pickerTarget === 'owned' ? ownedIds : plannedIds}
          excludeIds={pickerTarget === 'owned' ? plannedIds : ownedIds}
          onConfirm={ids => pickerTarget === 'owned' ? updateOwned(ids) : updatePlanned(ids)}
          title={pickerTarget === 'owned' ? '보유 중 영웅 선택' : '추가 예정 영웅 선택'}
        />
      )}
    </div>
  );
}
