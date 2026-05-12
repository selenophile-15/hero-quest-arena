import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getSavedSimulations,
  deleteSavedSimulation,
  SavedSimulationSummary,
} from '@/lib/savedSimulations';
import { Trash2, Play, AlertTriangle, Download, Upload, Pencil, X, ArrowDown, ArrowUp, ArrowDownUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { getHeroes } from '@/lib/storage';
import { saveBlobFile } from '@/lib/fileDownload';
import { formatNumber } from '@/lib/format';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SavedSimDetailDialog from '@/components/SavedSimDetailDialog';

const STORAGE_KEY = 'quest-sim-saved-results';

const getFaceImg = (survivalRate: number, powerBelowMin?: boolean): string => {
  if (powerBelowMin) return '/images/quest/face/icon_shop_face_D.webp';
  if (survivalRate <= 0) return '/images/quest/face/icon_shop_face_D.webp';
  if (survivalRate < 40) return '/images/quest/face/icon_shop_face_D.webp';
  if (survivalRate < 60) return '/images/quest/face/icon_shop_face_C.webp';
  if (survivalRate < 75) return '/images/quest/face/icon_shop_face_B.webp';
  if (survivalRate < 90) return '/images/quest/face/icon_shop_face_A.webp';
  if (survivalRate < 100) return '/images/quest/face/icon_shop_face_S.webp';
  return '/images/quest/face/icon_shop_face_SSS.webp';
};

// Olive-lime palette matching QuestSimulation
const getWinRateColor = (rate: number) =>
  rate >= 90 ? 'text-lime-600 dark:text-lime-300' :
  rate >= 70 ? 'text-lime-700 dark:text-lime-400' :
  rate >= 50 ? 'text-yellow-600 dark:text-yellow-300' :
  rate >= 30 ? 'text-orange-600 dark:text-orange-300' : 'text-red-500 dark:text-red-400';

// Contribution color thresholds (matches QuestSimulation main results)
const getShareTextColor = (pct: number) =>
  pct >= 81 ? 'text-lime-400' :
  pct >= 61 ? 'text-yellow-400' :
  pct >= 41 ? 'text-orange-400' :
  pct >= 21 ? 'text-red-400' : 'text-purple-400';

const QUEST_TYPE_LABELS: Record<string, string> = {
  normal: '일반 퀘스트',
  flash: '깜짝 퀘스트',
  lcog: '왕의 모험',
  tot: '공포의 탑',
};

interface Props {
  onLoadSimulation: (sim: SavedSimulationSummary) => void;
  refreshKey?: number;
}

type SortKey = 'savedAt' | 'winRate' | 'avgRounds' | 'region' | 'gearVsWin';
type SortDir = 'desc' | 'asc' | null;

export default function SavedResults({ onLoadSimulation, refreshKey }: Props) {
  const [saved, setSaved] = useState<SavedSimulationSummary[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SavedSimulationSummary | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detailSim, setDetailSim] = useState<SavedSimulationSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterRegion, setFilterRegion] = useState<string>('__all__');
  const [filterSubArea, setFilterSubArea] = useState<string>('__all__');
  const [filterHero, setFilterHero] = useState<string>('');
  const [filterMinWin, setFilterMinWin] = useState<string>('__all__');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('savedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const allHeroes = getHeroes();

  useEffect(() => {
    setSaved(getSavedSimulations());
    setSelectedIds(new Set());
  }, [refreshKey]);

  const refresh = () => setSaved(getSavedSimulations());

  const handleDelete = (id: string) => { deleteSavedSimulation(id); refresh(); };
  const handleBulkDelete = () => {
    selectedIds.forEach(id => deleteSavedSimulation(id));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    refresh();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleExport = useCallback(async () => {
    if (saved.length === 0) return;
    const data = JSON.stringify(saved, null, 2);
    const blob = new Blob([data], { type: 'text/plain' });
    await saveBlobFile(
      blob,
      `quest_sim_results_${new Date().toISOString().slice(0, 10)}.txt`,
      '자동 저장이 안 되면 공유 또는 다른 앱으로 열기를 사용해 주세요.',
    );
  }, [saved]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error('Invalid format');
        const valid = parsed.every((s: any) => s.id && s.name && Array.isArray(s.heroSummaries));
        if (!valid) throw new Error('Invalid results data');
        const existing = getSavedSimulations();
        const existingIds = new Set(existing.map(s => s.id));
        const merged = [...parsed.filter((s: any) => !existingIds.has(s.id)), ...existing];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        refresh();
      } catch { alert('파일 형식이 올바르지 않습니다.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // Unique regions / sub-areas
  const regionOpts = useMemo(() => Array.from(new Set(saved.map(s => s.regionName).filter(Boolean) as string[])).sort(), [saved]);
  const subAreaOpts = useMemo(() => {
    const base = filterRegion === '__all__' ? saved : saved.filter(s => s.regionName === filterRegion);
    return Array.from(new Set(base.map(s => s.subAreaName).filter(Boolean) as string[])).sort();
  }, [saved, filterRegion]);

  // Apply filter + sort
  const visible = useMemo(() => {
    let list = [...saved];
    if (filterRegion !== '__all__') list = list.filter(s => s.regionName === filterRegion);
    if (filterSubArea !== '__all__') list = list.filter(s => s.subAreaName === filterSubArea);
    if (filterHero.trim()) {
      const q = filterHero.trim().toLowerCase();
      list = list.filter(s => s.heroSummaries.some(hs => hs.heroName.toLowerCase().includes(q) || (hs.heroClass || '').toLowerCase().includes(q)));
    }
    if (filterMinWin !== '__all__') {
      const min = Number(filterMinWin);
      list = list.filter(s => s.winRate >= min);
    }
    if (sortDir !== null) {
      const mul = sortDir === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        let av = 0, bv = 0;
        switch (sortKey) {
          case 'savedAt': av = a.savedAt; bv = b.savedAt; break;
          case 'winRate': av = a.winRate; bv = b.winRate; break;
          case 'avgRounds': av = a.avgRounds; bv = b.avgRounds; break;
          case 'region':
            return mul * ((a.regionName || '').localeCompare(b.regionName || ''));
          case 'gearVsWin':
            av = (a.avgGearScore || 0) > 0 ? a.winRate / (a.avgGearScore || 1) : 0;
            bv = (b.avgGearScore || 0) > 0 ? b.winRate / (b.avgGearScore || 1) : 0;
            break;
        }
        return mul * (av - bv);
      });
    }
    return list;
  }, [saved, filterRegion, filterSubArea, filterHero, filterMinWin, sortKey, sortDir]);

  const toggleAll = () => {
    if (selectedIds.size === visible.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map(s => s.id)));
  };

  const cycleSort = (key: SortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('desc'); return; }
    if (sortDir === 'desc') setSortDir('asc');
    else if (sortDir === 'asc') setSortDir(null);
    else setSortDir('desc');
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key || sortDir === null) return <ArrowDownUp className="w-3 h-3" />;
    return sortDir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />;
  };

  if (saved.length === 0) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">저장된 결과가 없습니다</p>
        <p className="text-muted-foreground/60 text-xs mt-1">시뮬레이션 결과에서 "결과 저장" 버튼을 눌러 저장하세요</p>
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> 불러오기
          </Button>
          <input ref={fileInputRef} type="file" accept=".txt,.json" className="hidden" onChange={handleImportFile} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: Filter / Sort + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={filterRegion} onValueChange={(v) => { setFilterRegion(v); setFilterSubArea('__all__'); }}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="지역" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체 지역</SelectItem>
              {regionOpts.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSubArea} onValueChange={setFilterSubArea}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="세부지역" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체 세부지역</SelectItem>
              {subAreaOpts.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            value={filterHero}
            onChange={e => setFilterHero(e.target.value)}
            placeholder="직업/챔피언"
            className="h-8 w-[120px] text-xs"
          />
          <Select value={filterMinWin} onValueChange={setFilterMinWin}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue placeholder="최소 승률" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체 승률</SelectItem>
              <SelectItem value="90">90% 이상</SelectItem>
              <SelectItem value="70">70% 이상</SelectItem>
              <SelectItem value="50">50% 이상</SelectItem>
              <SelectItem value="30">30% 이상</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort cluster */}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border/40">
            <span className="text-[10px] text-muted-foreground mr-0.5">정렬</span>
            {([
              { key: 'savedAt' as SortKey, label: '저장일' },
              { key: 'winRate' as SortKey, label: '승률' },
              { key: 'avgRounds' as SortKey, label: '턴수' },
              { key: 'gearVsWin' as SortKey, label: '장비 대비' },
            ]).map(s => (
              <button
                key={s.key}
                onClick={() => cycleSort(s.key)}
                className={`flex items-center gap-0.5 h-7 px-1.5 rounded text-[11px] border transition-colors ${
                  sortKey === s.key && sortDir !== null
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                {s.label}
                {sortIcon(s.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> 추출
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> 불러오기
          </Button>
          <input ref={fileInputRef} type="file" accept=".txt,.json" className="hidden" onChange={handleImportFile} />
          {!editMode ? (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditMode(true)}>
              <Pencil className="w-3.5 h-3.5" /> 편집
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={toggleAll}>
                {selectedIds.size === visible.length ? '전체 해제' : '전체 선택'}
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5 text-xs"
                disabled={selectedIds.size === 0} onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5" /> 삭제 ({selectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setEditMode(false); setSelectedIds(new Set()); }}>
                <X className="w-3.5 h-3.5" /> 완료
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {visible.map((sim, simIndex) => {
          const date = new Date(sim.savedAt);
          const dateStr = `${date.getFullYear()}.${(date.getMonth()+1).toString().padStart(2,'0')}.${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
          const questTypeLabel = sim.questTypeLabel || QUEST_TYPE_LABELS[sim.questTypeKey] || sim.questTypeKey;
          const selected = selectedIds.has(sim.id);

          return (
            <div
              key={sim.id}
              className={`saved-result-card rounded-lg cursor-pointer ${editMode && selected ? 'ring-2 ring-primary/60' : ''}`}
              onClick={() => { if (editMode) toggleSelect(sim.id); else setDetailSim(sim); }}
            >
              <div className="flex items-stretch min-h-[150px]">
                {/* Left: number / checkbox */}
                <div className="flex items-center justify-center w-10 shrink-0 bg-muted/30 rounded-l-lg border-r border-border/30">
                  {editMode ? (
                    <Checkbox checked={selected} onCheckedChange={() => toggleSelect(sim.id)} onClick={(e) => e.stopPropagation()} />
                  ) : (
                    <span className="text-sm font-bold font-mono text-muted-foreground">{simIndex + 1}</span>
                  )}
                </div>

                {/* Main */}
                <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
                  {/* Header row: breadcrumb + barrier + date */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">{questTypeLabel}</span>
                    <span className="text-muted-foreground text-[11px]">›</span>
                    <span className="text-sm font-bold text-foreground">{sim.regionName || '-'}</span>
                    {sim.subAreaName && (
                      <>
                        <span className="text-muted-foreground text-[11px]">›</span>
                        <span className="text-sm font-medium text-foreground/90">{sim.subAreaName}</span>
                      </>
                    )}
                    {sim.difficulty && (
                      <>
                        <span className="text-muted-foreground text-[11px]">›</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary/60 text-foreground font-medium">{sim.difficulty}</span>
                      </>
                    )}
                    {sim.miniBossLabel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-300 font-medium">{sim.miniBossLabel} 미니보스</span>
                    )}

                    {/* Barriers */}
                    {sim.barrierInfos && sim.barrierInfos.length > 0 && (
                      <div className="flex items-center gap-1.5 ml-1">
                        {sim.barrierInfos.map((b, i) => {
                          const isMet = b.partySum >= b.required;
                          return (
                            <div key={i} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${isMet ? 'border-lime-500/40 bg-lime-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                              {b.iconPath && <img src={b.iconPath} alt={b.element} className="w-3.5 h-3.5" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                              <span className={`text-[10px] font-mono font-bold ${isMet ? 'text-lime-500 dark:text-lime-400' : 'text-red-500 dark:text-red-400'}`}>
                                {formatNumber(b.partySum)} / {formatNumber(b.required)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{dateStr}</span>
                  </div>

                  {/* Divider after header */}
                  <div className="border-t border-border/40" />

                  {/* Party row: Region/SubArea image + booster overlay | hero portraits */}
                  <div className="flex items-center gap-3">
                    {/* Region/SubArea visual */}
                    <div className="relative w-16 h-16 shrink-0">
                      <div className="w-16 h-16 rounded-lg border-2 border-primary/40 overflow-hidden bg-secondary/40">
                        {(sim.subAreaImage || sim.regionImage) ? (
                          <img src={sim.subAreaImage || sim.regionImage} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        ) : null}
                      </div>
                      {sim.regionImage && sim.subAreaImage && sim.regionImage !== sim.subAreaImage && (
                        <img src={sim.regionImage} alt="" className="absolute -top-1 -left-1 w-6 h-6 rounded-full border border-primary/40 bg-secondary/60 object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      )}
                      {sim.boosterImage && (
                        <img src={sim.boosterImage} alt="booster" className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border border-yellow-500/60 bg-background/80 object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      )}
                    </div>

                    {/* Hero portraits */}
                    <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                      {sim.heroSummaries.map(hs => {
                        const hero = allHeroes.find(h => h.id === hs.heroId) ||
                          sim.heroSnapshots?.find(h => h.id === hs.heroId);
                        const img = hero?.type === 'champion'
                          ? getChampionImagePath(hero.championName || hero.name)
                          : hero?.heroClass ? getJobImagePath(hero.heroClass) : null;
                        const faceImg = getFaceImg(hs.survivalRate, hs.powerBelowMin);
                        const tankShare = hs.tankingShare ?? 0;
                        return (
                          <div key={hs.heroId} className="flex items-center gap-1.5">
                            <div className="relative w-11 h-11 shrink-0">
                              <div className="w-11 h-11 rounded-full border border-primary/30 overflow-hidden bg-secondary/50">
                                {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                              </div>
                              <img src={faceImg} alt="" className="absolute -bottom-1 -right-1 w-5 h-5" />
                            </div>
                            <div className="text-xs leading-tight">
                              <div className="text-foreground font-bold text-[13px]">{hs.heroName}</div>
                              <div className="text-foreground/80 font-medium">
                                딜 기여도 <span className={`font-bold ${getShareTextColor(hs.damageShare)}`}>{hs.damageShare.toFixed(0)}%</span>
                              </div>
                              <div className="text-foreground/80 font-medium">
                                탱 기여도 <span className={`font-bold ${getShareTextColor(tankShare)}`}>{tankShare.toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider before summary */}
                  <div className="border-t border-border/40" />

                  {/* Summary row: avg rounds + success / fail / retry */}
                  <div className="flex items-center gap-3 text-[11px] flex-wrap">
                    <span className="text-muted-foreground">
                      평균 <span className="font-mono font-bold text-foreground">{Math.round(sim.avgRounds)}</span>턴
                      <span className="text-muted-foreground/70"> ({sim.minRounds}~{sim.maxRounds}R)</span>
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    {sim.successCount !== undefined && (
                      <span className="text-muted-foreground">
                        성공 <span className="font-mono font-bold text-lime-500 dark:text-lime-400">{formatNumber(sim.successCount)}</span>판
                      </span>
                    )}
                    {sim.failCount !== undefined && (
                      <span className="text-muted-foreground">
                        실패 <span className="font-mono font-bold text-red-500 dark:text-red-400">{formatNumber(sim.failCount)}</span>판
                      </span>
                    )}
                    {sim.retryCount !== undefined && sim.retryCount > 0 && (
                      <span className="text-muted-foreground">
                        재시도 <span className="font-mono font-bold text-amber-500 dark:text-amber-300">{formatNumber(sim.retryCount)}</span>판
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: win rate + actions */}
                <div className="flex items-center gap-2 px-3 shrink-0">
                  <div className="text-right mr-2">
                    <div className="text-[10px] text-muted-foreground">승률</div>
                    <div className={`text-2xl font-bold font-mono ${getWinRateColor(sim.winRate)}`}>
                      {sim.winRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="outline" size="icon" className="w-8 h-8 text-primary hover:bg-primary/10"
                      onClick={(e) => { e.stopPropagation(); onLoadSimulation(sim); }} title="불러오기">
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-white hover:bg-destructive [&:hover_svg]:text-white"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(sim); }} title="삭제">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="text-center py-10 text-xs text-muted-foreground">
            필터에 맞는 결과가 없습니다.
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-muted-foreground/50 pt-2">
        ℹ️ 카드를 누르면 파티 상세를 볼 수 있습니다. 불러오기 시 저장된 파티/세팅으로 다시 시뮬레이션을 실행합니다.<br/>
        결과는 매번 약간 달라질 수 있습니다.
      </div>

      {/* Delete confirm dialogs */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>저장된 결과를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" 결과가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null); }}
            >삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택한 결과를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size}개의 저장된 결과가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SavedSimDetailDialog open={!!detailSim} onOpenChange={(o) => !o && setDetailSim(null)} sim={detailSim} />
    </div>
  );
}
