import { useState, useMemo, useCallback } from 'react';
import { Hero, ELEMENT_ICON_MAP } from '@/types/game';
import ElementIcon from './ElementIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Users } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { HERO_CLASS_MAP } from '@/lib/gameData';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';

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

const POSITION_COLORS: Record<string, string> = {
  '퓨어 탱커': 'bg-blue-500',
  '회피 탱커': 'bg-emerald-600',
  '딜탱': 'bg-orange-500',
  '치명 딜러': 'bg-red-500',
  '일반 딜러': 'bg-yellow-500',
  '회피 딜러': 'bg-cyan-500',
  '좀비': 'bg-purple-500',
  '기타': 'bg-secondary',
};
const POSITION_TEXT_COLORS: Record<string, string> = {
  '퓨어 탱커': 'text-blue-400',
  '회피 탱커': 'text-emerald-400',
  '딜탱': 'text-orange-400',
  '치명 딜러': 'text-red-400',
  '일반 딜러': 'text-yellow-400',
  '회피 딜러': 'text-cyan-300',
  '좀비': 'text-purple-400',
  '미지정': 'text-muted-foreground',
  '기타': 'text-muted-foreground',
};
const POSITION_BAR_STYLE: Record<string, string> = {
  '퓨어 탱커': '#3b82f6',
  '회피 탱커': '#059669',
  '딜탱': '#f97316',
  '치명 딜러': '#ef4444',
  '일반 딜러': '#eab308',
  '회피 딜러': '#22d3ee',
  '좀비': '#a855f7',
  '미지정': '#6b7280',
  '기타': '#6b7280',
};

const ELEMENT_ORDER = ['불', '물', '공기', '대지', '빛', '어둠', '모든 원소'];
const CLASS_LINE_ORDER = ['전사', '로그', '주문술사'];

const ELEMENT_BAR_COLORS: Record<string, string> = {
  '불': '#ef4444',
  '물': '#3b82f6',
  '공기': '#2dd4bf',
  '대지': '#15803d',
  '빛': '#fde68a',
  '어둠': '#a855f7',
  '모든 원소': '#e5e7eb',
};

const POSITION_ORDER = ['퓨어 탱커', '회피 탱커', '딜탱', '일반 딜러', '치명 딜러', '회피 딜러', '미지정'];

// Build class sort order from HERO_CLASS_MAP
const CLASS_SORT_ORDER: Record<string, number> = {};
let classIdx = 0;
Object.values(HERO_CLASS_MAP).forEach(classes => {
  classes.forEach(c => { CLASS_SORT_ORDER[c] = classIdx++; });
});

/* ── Hero picker dialog ── */
function HeroPicker({ open, onClose, allHeroes, ownedIds, plannedIds, onConfirm }: {
  open: boolean;
  onClose: () => void;
  allHeroes: Hero[];
  ownedIds: string[];
  plannedIds: string[];
  onConfirm: (owned: string[], planned: string[]) => void;
}) {
  const [target, setTarget] = useState<'owned' | 'planned'>('owned');
  const [localOwned, setLocalOwned] = useState<Set<string>>(new Set(ownedIds));
  const [localPlanned, setLocalPlanned] = useState<Set<string>>(new Set(plannedIds));

  const toggle = useCallback((id: string) => {
    if (target === 'owned') {
      setLocalOwned(prev => {
        const next = new Set(prev);
        if (next.has(id)) { next.delete(id); } else {
          next.add(id);
          setLocalPlanned(p => { const n = new Set(p); n.delete(id); return n; });
        }
        return next;
      });
    } else {
      setLocalPlanned(prev => {
        const next = new Set(prev);
        if (next.has(id)) { next.delete(id); } else {
          next.add(id);
          setLocalOwned(p => { const n = new Set(p); n.delete(id); return n; });
        }
        return next;
      });
    }
  }, [target]);

  const isChecked = (id: string) => target === 'owned' ? localOwned.has(id) : localPlanned.has(id);
  const otherGroup = (id: string): 'owned' | 'planned' | null => {
    if (target === 'owned' && localPlanned.has(id)) return 'planned';
    if (target === 'planned' && localOwned.has(id)) return 'owned';
    return null;
  };

  // Sort by class order
  const sorted = useMemo(() => {
    return [...allHeroes].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'hero' ? -1 : 1;
      if (a.type === 'hero' && b.type === 'hero') {
        const aIdx = CLASS_SORT_ORDER[a.heroClass] ?? 999;
        const bIdx = CLASS_SORT_ORDER[b.heroClass] ?? 999;
        return aIdx - bIdx;
      }
      return 0;
    });
  }, [allHeroes]);

  const heroItems = useMemo(() => sorted.filter(h => h.type === 'hero'), [sorted]);
  const champItems = useMemo(() => sorted.filter(h => h.type === 'champion'), [sorted]);

  const selectAll = () => {
    const ids = new Set(allHeroes.map(h => h.id));
    if (target === 'owned') { setLocalOwned(ids); setLocalPlanned(new Set()); }
    else { setLocalPlanned(ids); setLocalOwned(new Set()); }
  };
  const deselectAll = () => {
    if (target === 'owned') setLocalOwned(new Set());
    else setLocalPlanned(new Set());
  };

  const currentCount = target === 'owned' ? localOwned.size : localPlanned.size;

  const renderRow = (h: Hero) => {
    const checked = isChecked(h.id);
    const other = otherGroup(h.id);
    const isInOther = other !== null;
    let rowBg = '';
    if (checked) {
      rowBg = target === 'owned' ? 'bg-yellow-500/15' : 'bg-amber-500/15';
    } else if (isInOther) {
      rowBg = other === 'owned' ? 'bg-yellow-500/10' : 'bg-amber-500/10';
    }
    const checkboxClass = isInOther
      ? (other === 'owned' ? '[&_[data-state=checked]]:bg-yellow-500 [&_[data-state=checked]]:border-yellow-500' : '[&_[data-state=checked]]:bg-amber-600 [&_[data-state=checked]]:border-amber-600')
      : checked
        ? (target === 'owned' ? '[&_[data-state=checked]]:bg-yellow-500 [&_[data-state=checked]]:border-yellow-500' : '[&_[data-state=checked]]:bg-amber-600 [&_[data-state=checked]]:border-amber-600')
        : '';

    const imgPath = h.type === 'champion' && h.championName
      ? getChampionImagePath(h.championName)
      : h.heroClass ? getJobImagePath(h.heroClass) : '';

    return (
      <label key={h.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-secondary/40 ${rowBg}`}>
        <Checkbox
          checked={checked || isInOther}
          onCheckedChange={() => toggle(h.id)}
          className={checkboxClass}
        />
        {imgPath && (
          <img src={imgPath} alt="" className="w-5 h-5 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
        )}
        {h.type === 'hero' ? (
          <>
            <span className="text-sm text-foreground font-medium">{h.heroClass}</span>
            <span className="text-sm text-muted-foreground">{h.name}</span>
          </>
        ) : (
          <>
            <span className="text-sm text-foreground font-medium">{h.championName || h.name}</span>
            <span className="text-sm text-muted-foreground">{h.name !== h.championName ? h.name : ''}</span>
          </>
        )}
        {isInOther && (
          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium ${other === 'owned' ? 'bg-yellow-500/30 text-yellow-300' : 'bg-amber-600/30 text-amber-400'}`}>
            {other === 'owned' ? '보유 중' : '추가 예정'}
          </span>
        )}
      </label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>영웅 선택</DialogTitle>
        </DialogHeader>
        {/* Mode toggle */}
        <div className="flex gap-1 mb-2 bg-secondary/30 rounded-lg p-1">
          <button
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${target === 'owned' ? 'bg-yellow-500/20 text-yellow-300 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTarget('owned')}
          >
            보유 중 선택
          </button>
          <button
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${target === 'planned' ? 'bg-amber-600/20 text-amber-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTarget('planned')}
          >
            추가 예정 선택
          </button>
        </div>
        <div className="flex gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={selectAll}>전체 선택</Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>전체 해제</Button>
          <span className="ml-auto text-sm text-muted-foreground">{currentCount}명 선택</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {heroItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">영웅</p>
              <div className="space-y-0.5">{heroItems.map(renderRow)}</div>
            </div>
          )}
          {champItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">챔피언</p>
              <div className="space-y-0.5">{champItems.map(renderRow)}</div>
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
// Fixed row heights — always show grid; 4 entries per cell
const HERO_ROW_H = 116; // fits ~4 entries (4 * 24px + padding)
const CHAMP_ROW_H = 116; // fits ~4 entries

function MatrixGrid({ allHeroes, ownedIds, plannedIds, onAdd }: {
  allHeroes: Hero[];
  ownedIds: Set<string>;
  plannedIds: Set<string>;
  onAdd: () => void;
}) {
  const all = useMemo(() => {
    const combined = new Set([...Array.from(ownedIds), ...Array.from(plannedIds)]);
    return allHeroes.filter(h => combined.has(h.id));
  }, [allHeroes, ownedIds, plannedIds]);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, Hero[]>> = {};
    const lines = [...CLASS_LINE_ORDER, '챔피언'];
    lines.forEach(cl => { m[cl] = {}; ELEMENT_ORDER.forEach(el => { m[cl][el] = []; }); });
    all.forEach(h => {
      const cl = h.type === 'champion' ? '챔피언' : (h.classLine || '기타');
      const el = h.element || '기타';
      if (!m[cl]) { m[cl] = {}; ELEMENT_ORDER.forEach(e => { m[cl][e] = []; }); }
      if (!m[cl][el]) m[cl][el] = [];
      m[cl][el].push(h);
    });
    return m;
  }, [all]);

  const allLines = [...CLASS_LINE_ORDER, '챔피언'];

  const rowTotals = useMemo(() => {
    const t: Record<string, number> = {};
    allLines.forEach(cl => {
      t[cl] = ELEMENT_ORDER.reduce((s, el) => s + (matrix[cl]?.[el]?.length || 0), 0);
    });
    return t;
  }, [matrix]);

  const colTotals = useMemo(() => {
    const t: Record<string, number> = {};
    ELEMENT_ORDER.forEach(el => {
      t[el] = allLines.reduce((s, cl) => s + (matrix[cl]?.[el]?.length || 0), 0);
    });
    return t;
  }, [matrix]);

  const grandTotal = all.length;

  return (
    <div className="card-fantasy p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
          <Users size={14} />
          전체
          <span className="text-muted-foreground font-normal ml-1">({all.length}명)</span>
        </h3>
        <Button size="sm" onClick={onAdd} className="gap-1 bg-yellow-500 text-black hover:bg-yellow-400 font-semibold">
          <Plus size={14} /> 추가
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="py-2 px-2 text-center text-muted-foreground font-medium w-20"></th>
              {ELEMENT_ORDER.map(el => (
                <th key={el} className="py-2 px-1 text-center border-l border-border" style={{ minWidth: '110px' }}>
                  <div className="flex items-center justify-center gap-1">
                    <ElementIcon element={el} size={16} />
                    <span className="text-foreground font-medium">{el}</span>
                  </div>
                </th>
              ))}
              <th className="py-2 px-2 text-center text-muted-foreground font-medium w-14 border-l border-border">인원</th>
            </tr>
          </thead>
          <tbody>
            {allLines.map((cl, clIdx) => {
              const isChamp = cl === '챔피언';
              const rowH = isChamp ? CHAMP_ROW_H : HERO_ROW_H;
              const maxInRow = Math.max(...ELEMENT_ORDER.map(el => matrix[cl]?.[el]?.length || 0));
              const capacity = 4;
              const dynamicH = maxInRow > capacity ? maxInRow * 26 + 12 : rowH;
              // Add thicker border before champion row
              const topBorderClass = isChamp ? 'border-t-2 border-border' : (clIdx > 0 ? 'border-t border-border' : '');
              return (
                <tr key={cl} className={topBorderClass}>
                  <td className={`py-2 px-2 font-bold whitespace-nowrap text-sm text-center ${isChamp ? 'text-yellow-400' : (CLASS_LINE_COLORS[cl] || 'text-foreground')}`}>
                    {cl}
                  </td>
                  {ELEMENT_ORDER.map(el => {
                    const cells = matrix[cl]?.[el] || [];
                    return (
                      <td key={el} className="py-1 px-1 align-middle border-l border-border" style={{ height: dynamicH }}>
                        <div className="flex flex-col items-center justify-center gap-0.5 h-full">
                          {cells.map(h => {
                            const isPlanned = plannedIds.has(h.id);
                            return (
                              <div key={h.id} className={`flex items-center gap-1 justify-center ${isPlanned ? 'opacity-50' : ''}`}>
                                <span className="text-[11px] font-semibold text-white">
                                  {h.type === 'hero' ? h.heroClass : (h.championName || h.name)}
                                </span>
                                {h.position && (
                                  <span className={`text-[10px] font-bold px-1 rounded ${POSITION_COLORS[h.position] || 'bg-secondary'} text-white`}>
                                    {h.position}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-center font-bold text-foreground text-sm border-l border-border">
                    {rowTotals[cl] || 0}
                  </td>
                </tr>
              );
            })}
            {/* Column totals */}
            <tr className="border-t-2 border-border bg-secondary/10">
              <td className="py-2 px-2 font-semibold text-muted-foreground text-center">인원</td>
              {ELEMENT_ORDER.map(el => (
                <td key={el} className="py-2 px-1 text-center font-bold text-foreground border-l border-border">
                  {colTotals[el] || 0}
                </td>
              ))}
              <td className="py-2 px-2 text-center font-bold text-primary border-l border-border">
                {grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Distribution bar (reusable) ── */
function DistBar({ label, labelNode, owned, planned, maxCount, color }: {
  label?: string;
  labelNode?: React.ReactNode;
  owned: number;
  planned: number;
  maxCount: number;
  color: string;
}) {
  const total = owned + planned;
  const ownedPct = (owned / maxCount) * 100;
  const plannedPct = (planned / maxCount) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 text-right flex items-center justify-end gap-1">
        {labelNode || <span className="text-xs font-medium text-foreground">{label}</span>}
      </div>
      <div className="flex-1 h-5 bg-secondary/20 rounded overflow-hidden flex">
        {owned > 0 && <div className="h-full transition-all" style={{ width: `${ownedPct}%`, backgroundColor: color }} />}
        {planned > 0 && <div className="h-full transition-all" style={{ width: `${plannedPct}%`, backgroundColor: color, opacity: 0.4 }} />}
      </div>
      <span className="text-xs font-bold text-foreground tabular-nums w-6 text-right">{owned}</span>
      <span className="text-xs font-bold text-muted-foreground tabular-nums w-6 text-right">
        {planned > 0 ? `${planned}` : ''}
      </span>
    </div>
  );
}

/* ── Element distribution ── */
function ElementSummary({ owned, planned }: { owned: Hero[]; planned: Hero[] }) {
  const ownedSet = useMemo(() => new Set(owned.map(h => h.id)), [owned]);
  const all = useMemo(() => [...owned, ...planned], [owned, planned]);

  const data = useMemo(() => {
    const map: Record<string, { owned: number; planned: number }> = {};
    ELEMENT_ORDER.forEach(el => { map[el] = { owned: 0, planned: 0 }; });
    all.forEach(h => {
      const el = h.element || '기타';
      if (!map[el]) map[el] = { owned: 0, planned: 0 };
      if (ownedSet.has(h.id)) map[el].owned++; else map[el].planned++;
    });
    return map;
  }, [all, ownedSet]);

  const maxCount = Math.max(...Object.values(data).map(d => d.owned + d.planned), 1);
  if (all.length === 0) return null;

  return (
    <div className="card-fantasy p-3">
      <h3 className="text-sm font-semibold text-primary mb-3">속성 분포</h3>
      <div className="space-y-2">
        {ELEMENT_ORDER.map(el => (
          <DistBar
            key={el}
            labelNode={<><ElementIcon element={el} size={14} /><span className="text-xs text-foreground">{el}</span></>}
            owned={data[el].owned}
            planned={data[el].planned}
            maxCount={maxCount}
            color={ELEMENT_BAR_COLORS[el] || '#6b7280'}
          />
        ))}
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
      if (ownedSet.has(h.id)) map[cl].owned++; else map[cl].planned++;
    });
    return map;
  }, [heroesOnly, ownedSet]);

  const clBarColors: Record<string, string> = { '전사': '#ef4444', '로그': '#84cc16', '주문술사': '#38bdf8' };
  const maxCount = Math.max(...Object.values(data).map(d => d.owned + d.planned), 1);
  if (heroesOnly.length === 0) return null;

  return (
    <div className="card-fantasy p-3">
      <h3 className="text-sm font-semibold text-primary mb-3">계열 분포 (영웅)</h3>
      <div className="space-y-2">
        {CLASS_LINE_ORDER.map(cl => (
          <DistBar
            key={cl}
            labelNode={<span className={`text-xs font-medium ${CLASS_LINE_COLORS[cl]}`}>{cl}</span>}
            owned={data[cl].owned}
            planned={data[cl].planned}
            maxCount={maxCount}
            color={clBarColors[cl] || '#6b7280'}
          />
        ))}
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
    POSITION_ORDER.forEach(p => { map[p] = { owned: 0, planned: 0 }; });
    all.forEach(h => {
      const pos = h.position || '미지정';
      if (!map[pos]) map[pos] = { owned: 0, planned: 0 };
      if (ownedSet.has(h.id)) map[pos].owned++; else map[pos].planned++;
    });
    return POSITION_ORDER.map(p => [p, map[p]] as [string, { owned: number; planned: number }])
      .filter(([, d]) => d.owned + d.planned > 0);
  }, [all, ownedSet]);

  if (posData.length === 0) return null;
  const maxCount = Math.max(...posData.map(([, d]) => d.owned + d.planned), 1);

  return (
    <div className="card-fantasy p-3">
      <h3 className="text-sm font-semibold text-primary mb-3">포지션 분포</h3>
      <div className="space-y-2">
        {posData.map(([pos, d]) => (
          <DistBar
            key={pos}
            labelNode={<span className={`text-xs font-medium ${POSITION_TEXT_COLORS[pos] || 'text-muted-foreground'}`}>{pos}</span>}
            owned={d.owned}
            planned={d.planned}
            maxCount={maxCount}
            color={POSITION_BAR_STYLE[pos] || '#6b7280'}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function ListSummary({ heroes }: ListSummaryProps) {
  const [ownedIds, setOwnedIds] = useState<string[]>(() => loadIds(STORAGE_KEY_OWNED));
  const [plannedIds, setPlannedIds] = useState<string[]>(() => loadIds(STORAGE_KEY_PLANNED));
  const [pickerOpen, setPickerOpen] = useState(false);

  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);
  const plannedSet = useMemo(() => new Set(plannedIds), [plannedIds]);

  const ownedHeroes = useMemo(() => heroes.filter(h => ownedSet.has(h.id)), [heroes, ownedSet]);
  const plannedHeroes = useMemo(() => heroes.filter(h => plannedSet.has(h.id)), [heroes, plannedSet]);

  const handlePickerConfirm = useCallback((newOwned: string[], newPlanned: string[]) => {
    setOwnedIds(newOwned);
    setPlannedIds(newPlanned);
    saveIds(STORAGE_KEY_OWNED, newOwned);
    saveIds(STORAGE_KEY_PLANNED, newPlanned);
  }, []);

  return (
    <div className="space-y-4">
      <MatrixGrid
        allHeroes={heroes}
        ownedIds={ownedSet}
        plannedIds={plannedSet}
        onAdd={() => setPickerOpen(true)}
      />

      {(ownedHeroes.length > 0 || plannedHeroes.length > 0) && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ElementSummary owned={ownedHeroes} planned={plannedHeroes} />
            <ClassLineSummary owned={ownedHeroes} planned={plannedHeroes} />
          </div>
          <PositionChart owned={ownedHeroes} planned={plannedHeroes} />
        </div>
      )}

      {pickerOpen && (
        <HeroPicker
          open
          onClose={() => setPickerOpen(false)}
          allHeroes={heroes}
          ownedIds={ownedIds}
          plannedIds={plannedIds}
          onConfirm={handlePickerConfirm}
        />
      )}
    </div>
  );
}
