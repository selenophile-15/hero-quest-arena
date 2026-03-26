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

/* ── Distribution calculator ── */
function calcDistribution(list: Hero[]) {
  const heroList = list.filter(h => h.type === 'hero');
  const champList = list.filter(h => h.type === 'champion');

  const elementDist: Record<string, { hero: number; champ: number }> = {};
  ELEMENT_ORDER.forEach(e => { elementDist[e] = { hero: 0, champ: 0 }; });
  list.forEach(h => {
    if (!h.element) return;
    if (!elementDist[h.element]) elementDist[h.element] = { hero: 0, champ: 0 };
    if (h.type === 'hero') elementDist[h.element].hero++;
    else elementDist[h.element].champ++;
  });

  const classLineDist: Record<string, number> = {};
  CLASS_LINE_ORDER.forEach(cl => { classLineDist[cl] = 0; });
  heroList.forEach(h => {
    if (h.classLine) classLineDist[h.classLine] = (classLineDist[h.classLine] || 0) + 1;
  });

  const positionDist: Record<string, { hero: number; champ: number }> = {};
  list.forEach(h => {
    const pos = h.position || '미지정';
    if (!positionDist[pos]) positionDist[pos] = { hero: 0, champ: 0 };
    if (h.type === 'hero') positionDist[pos].hero++;
    else positionDist[pos].champ++;
  });

  return { heroList, champList, elementDist, classLineDist, positionDist };
}

/* ── Hero picker dialog ── */
function HeroPicker({ open, onClose, allHeroes, selectedIds, onConfirm, title }: {
  open: boolean;
  onClose: () => void;
  allHeroes: Hero[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  title: string;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));

  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const heroItems = useMemo(() => allHeroes.filter(h => h.type === 'hero'), [allHeroes]);
  const champItems = useMemo(() => allHeroes.filter(h => h.type === 'champion'), [allHeroes]);

  const selectAll = () => setChecked(new Set(allHeroes.map(h => h.id)));
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
function GroupTable({ label, icon, heroes, onAdd, onRemove }: {
  label: string;
  icon: React.ReactNode;
  heroes: Hero[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const heroItems = heroes.filter(h => h.type === 'hero');
  const champItems = heroes.filter(h => h.type === 'champion');

  return (
    <div className="card-fantasy p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
          {icon}
          {label}
          <span className="text-muted-foreground font-normal ml-1">({heroes.length}명)</span>
        </h3>
        <Button variant="outline" size="sm" onClick={onAdd} className="gap-1">
          <Plus size={14} /> 추가
        </Button>
      </div>

      {heroes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          아직 추가된 항목이 없습니다. 위 버튼을 눌러 리스트에서 선택하세요.
        </p>
      ) : (
        <div className="space-y-2">
          {heroItems.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">영웅 ({heroItems.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {heroItems.map(h => (
                  <div key={h.id} className="flex items-center gap-1 bg-secondary/30 border border-border/40 rounded-md pl-2 pr-1 py-1 text-sm group">
                    <ElementIcon element={h.element} size={14} />
                    <span className={`${CLASS_LINE_COLORS[h.classLine] || ''} text-xs`}>{h.heroClass}</span>
                    <span className="text-foreground">{h.name}</span>
                    {h.position && <span className={`text-[10px] ml-0.5 ${POSITION_COLORS[h.position] || 'text-muted-foreground'}`}>{h.position}</span>}
                    <button onClick={() => onRemove(h.id)} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {champItems.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">챔피언 ({champItems.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {champItems.map(h => (
                  <div key={h.id} className="flex items-center gap-1 bg-secondary/30 border border-border/40 rounded-md pl-2 pr-1 py-1 text-sm group">
                    <ElementIcon element={h.element} size={14} />
                    <span className="text-foreground">{h.championName || h.name}</span>
                    {h.position && <span className={`text-[10px] ml-0.5 ${POSITION_COLORS[h.position] || 'text-muted-foreground'}`}>{h.position}</span>}
                    <button onClick={() => onRemove(h.id)} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Distribution section ── */
function DistributionSection({ title, heroes, totalHeroes }: { title: string; heroes: Hero[]; totalHeroes: number }) {
  const { heroList, champList, elementDist, classLineDist, positionDist } = useMemo(() => calcDistribution(heroes), [heroes]);
  const hCount = heroList.length;
  const cCount = champList.length;

  if (heroes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-primary border-b border-border pb-1">{title} 분포 ({heroes.length}명)</h3>

      {/* Counts */}
      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground/70">영웅</span>
          <span className="font-bold text-foreground">{hCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-foreground/70">챔피언</span>
          <span className="font-bold text-foreground">{cCount}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Element */}
        <div className="card-fantasy p-3">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">속성별</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="py-1 text-left">속성</th>
                <th className="py-1 text-center w-12">영웅</th>
                <th className="py-1 text-center w-12">챔피언</th>
                <th className="py-1 text-center w-12">합계</th>
              </tr>
            </thead>
            <tbody>
              {ELEMENT_ORDER.map(el => {
                const d = elementDist[el] || { hero: 0, champ: 0 };
                const total = d.hero + d.champ;
                return (
                  <tr key={el} className="border-b border-border/30">
                    <td className="py-1 flex items-center gap-1.5">
                      <ElementIcon element={el} size={16} />
                      <span className="text-foreground text-xs">{el}</span>
                    </td>
                    <td className={`py-1 text-center tabular-nums text-xs ${d.hero === 0 ? 'text-foreground/20' : 'text-foreground'}`}>{d.hero}</td>
                    <td className={`py-1 text-center tabular-nums text-xs ${d.champ === 0 ? 'text-foreground/20' : 'text-foreground'}`}>{d.champ}</td>
                    <td className={`py-1 text-center tabular-nums text-xs font-semibold ${total === 0 ? 'text-foreground/20' : 'text-primary'}`}>{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Class line */}
        <div className="card-fantasy p-3">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">계열별 (영웅)</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="py-1 text-left">계열</th>
                <th className="py-1 text-center w-12">인원</th>
                <th className="py-1 text-left">비율</th>
              </tr>
            </thead>
            <tbody>
              {CLASS_LINE_ORDER.map(cl => {
                const count = classLineDist[cl] || 0;
                const pct = hCount > 0 ? Math.round((count / hCount) * 100) : 0;
                return (
                  <tr key={cl} className="border-b border-border/30">
                    <td className={`py-1 font-medium text-xs ${CLASS_LINE_COLORS[cl] || ''}`}>{cl}</td>
                    <td className={`py-1 text-center tabular-nums text-xs ${count === 0 ? 'text-foreground/20' : 'text-foreground'}`}>{count}</td>
                    <td className="py-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-secondary/30 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${pct}%`,
                            backgroundColor: cl === '전사' ? '#ef4444' : cl === '로그' ? '#84cc16' : '#38bdf8',
                          }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Position */}
      <div className="card-fantasy p-3">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">포지션별</h4>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(positionDist)
            .sort(([, a], [, b]) => (b.hero + b.champ) - (a.hero + a.champ))
            .map(([pos, d]) => {
              const total = d.hero + d.champ;
              return (
                <div key={pos} className="border border-border/30 rounded-lg p-2 bg-secondary/10">
                  <p className={`text-xs font-medium ${POSITION_COLORS[pos] || 'text-foreground'}`}>{pos}</p>
                  <p className="text-base font-bold text-foreground mt-0.5">{total}</p>
                  <p className="text-[10px] text-muted-foreground">영웅 {d.hero} / 챔피언 {d.champ}</p>
                </div>
              );
            })}
        </div>
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

  const combinedHeroes = useMemo(() => [...ownedHeroes, ...plannedHeroes], [ownedHeroes, plannedHeroes]);

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
      />

      {/* ── 추가 예정 ── */}
      <GroupTable
        label="추가 예정"
        icon={<TrendingUp size={14} />}
        heroes={plannedHeroes}
        onAdd={() => setPickerTarget('planned')}
        onRemove={removePlanned}
      />

      {/* ── 분포 ── */}
      <div className="space-y-6">
        <DistributionSection title="보유 중" heroes={ownedHeroes} totalHeroes={ownedHeroes.length} />
        <DistributionSection title="추가 예정" heroes={plannedHeroes} totalHeroes={plannedHeroes.length} />
        {ownedHeroes.length > 0 && plannedHeroes.length > 0 && (
          <DistributionSection title="합산 (보유 + 추가 예정)" heroes={combinedHeroes} totalHeroes={combinedHeroes.length} />
        )}
      </div>

      {/* ── Picker dialog ── */}
      {pickerTarget && (
        <HeroPicker
          open
          onClose={() => setPickerTarget(null)}
          allHeroes={heroes}
          selectedIds={pickerTarget === 'owned' ? ownedIds : plannedIds}
          onConfirm={ids => pickerTarget === 'owned' ? updateOwned(ids) : updatePlanned(ids)}
          title={pickerTarget === 'owned' ? '보유 중 영웅 선택' : '추가 예정 영웅 선택'}
        />
      )}
    </div>
  );
}
