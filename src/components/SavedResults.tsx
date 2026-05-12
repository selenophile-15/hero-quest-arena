import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getSavedSimulations,
  deleteSavedSimulation,
  SavedSimulationSummary,
} from '@/lib/savedSimulations';
import { Trash2, Play, AlertTriangle, Download, Upload, Pencil, X, ArrowDown, ArrowUp, ArrowDownUp, Filter, FileDown, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { getHeroes } from '@/lib/storage';
import { saveBlobFile } from '@/lib/fileDownload';
import { formatNumber } from '@/lib/format';
import { ELEMENT_ICON_MAP } from '@/types/game';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SavedSimDetailDialog from '@/components/SavedSimDetailDialog';
import SaveSimsDialog from '@/components/SaveSimsDialog';

const STORAGE_KEY = 'quest-sim-saved-results';

// Mirrors QuestSimulation face logic (death-count based, derived from survival %)
const getFaceImg = (survivalRate: number, powerBelowMin?: boolean, avgRounds?: number, winRate?: number): string => {
  if (powerBelowMin) return '/images/quest/face/icon_shop_face_D.webp';
  const deathPct = 100 - survivalRate;
  if (deathPct >= 100) return '/images/quest/face/icon_shop_face_D.webp';
  if (deathPct >= 60)  return '/images/quest/face/icon_shop_face_C.webp';
  if (deathPct >= 40)  return '/images/quest/face/icon_shop_face_B.webp';
  if (deathPct >= 15)  return '/images/quest/face/icon_shop_face_A.webp';
  if (deathPct >= 0.01) return '/images/quest/face/icon_shop_face_S.webp';
  if ((avgRounds ?? 99) <= 1 && (winRate ?? 0) >= 99.9) return '/images/quest/face/icon_shop_face_SSS.webp';
  return '/images/quest/face/icon_shop_face_S.webp';
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

// Survival color thresholds (matches QuestSimulation 상세 정보)
const getSurvivalColor = (pct: number) =>
  pct >= 90 ? 'text-lime-400' :
  pct >= 50 ? 'text-yellow-400' :
  'text-red-400';

const QUEST_TYPE_LABELS: Record<string, string> = {
  normal: '일반 퀘스트',
  flash: '깜짝 퀘스트',
  lcog: '왕의 모험',
  tot: '공포의 탑',
};

// Quest-type colored chip style (text/border) — identical in light & dark modes
const QUEST_TYPE_CHIP_STYLE: Record<string, string> = {
  normal: 'text-red-600 border-red-600 bg-red-500/15',
  flash:  'text-lime-700 border-lime-700 bg-lime-500/15',
  lcog:   'text-yellow-700 border-yellow-700 bg-yellow-500/15',
  tot:    'text-purple-600 border-purple-600 bg-purple-500/15',
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<SavedSimulationSummary[] | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [extractTarget, setExtractTarget] = useState<SavedSimulationSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterQuestType, setFilterQuestType] = useState<string>('__all__');
  const [filterRegion, setFilterRegion] = useState<string>('__all__');
  const [filterSubArea, setFilterSubArea] = useState<string>('__all__');
  const [filterHero, setFilterHero] = useState<string>('__all__');
  const [filterMinWin, setFilterMinWin] = useState<string>('');

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

  const handleExport = useCallback(() => {
    if (saved.length === 0) return;
    setSaveDialogOpen(true);
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
        setImportPreview(parsed as SavedSimulationSummary[]);
        setImportMode('merge');
      } catch { alert('파일 형식이 올바르지 않습니다.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleImportConfirm = useCallback(() => {
    if (!importPreview) return;
    if (importMode === 'replace') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(importPreview));
    } else {
      const existing = getSavedSimulations();
      const existingIds = new Set(existing.map(s => s.id));
      const merged = [...importPreview.filter(s => !existingIds.has(s.id)), ...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    setImportPreview(null);
    refresh();
  }, [importPreview, importMode]);

  const handleExtractCopy = useCallback(async (sim: SavedSimulationSummary) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(sim, null, 2));
      toast({ title: '복사 완료', description: '클립보드에 결과 코드가 복사되었습니다.' });
    } catch {
      toast({ title: '복사 실패', description: '클립보드 접근이 거부되었습니다.', variant: 'destructive' });
    }
    setExtractTarget(null);
  }, []);

  const handleExtractFile = useCallback(async (sim: SavedSimulationSummary) => {
    const blob = new Blob([JSON.stringify([sim], null, 2)], { type: 'text/plain' });
    const safe = (sim.regionName || 'result').replace(/[^\w가-힣]/g, '_');
    await saveBlobFile(blob, `quest_sim_${safe}_${new Date().toISOString().slice(0, 10)}.txt`);
    setExtractTarget(null);
  }, []);

  // Unique filter options
  const questTypeOpts = useMemo(() => {
    const seen = new Map<string, string>();
    saved.forEach(s => {
      const key = s.questTypeKey;
      const label = s.questTypeLabel || QUEST_TYPE_LABELS[s.questTypeKey] || s.questTypeKey;
      if (!seen.has(key)) seen.set(key, label);
    });
    return Array.from(seen.entries());
  }, [saved]);
  const regionOpts = useMemo(() => {
    const base = filterQuestType === '__all__' ? saved : saved.filter(s => s.questTypeKey === filterQuestType);
    return Array.from(new Set(base.map(s => s.regionName).filter(Boolean) as string[])).sort();
  }, [saved, filterQuestType]);
  const subAreaOpts = useMemo(() => {
    const base = filterRegion === '__all__' ? saved : saved.filter(s => s.regionName === filterRegion);
    return Array.from(new Set(base.map(s => s.subAreaName).filter(Boolean) as string[])).sort();
  }, [saved, filterRegion]);
  const heroOpts = useMemo(() => {
    const set = new Set<string>();
    saved.forEach(s => s.heroSummaries.forEach(hs => {
      if (hs.heroClass) set.add(hs.heroClass);
    }));
    return Array.from(set).sort();
  }, [saved]);

  // Apply filter + sort
  const visible = useMemo(() => {
    let list = [...saved];
    if (filterQuestType !== '__all__') list = list.filter(s => s.questTypeKey === filterQuestType);
    if (filterRegion !== '__all__') list = list.filter(s => s.regionName === filterRegion);
    if (filterSubArea !== '__all__') list = list.filter(s => s.subAreaName === filterSubArea);
    if (filterHero !== '__all__') {
      list = list.filter(s => s.heroSummaries.some(hs => hs.heroClass === filterHero));
    }
    const minWinNum = parseFloat(filterMinWin);
    if (!Number.isNaN(minWinNum)) {
      list = list.filter(s => s.winRate >= minWinNum);
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
  }, [saved, filterQuestType, filterRegion, filterSubArea, filterHero, filterMinWin, sortKey, sortDir]);

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
          <Select value={filterQuestType} onValueChange={(v) => { setFilterQuestType(v); setFilterRegion('__all__'); setFilterSubArea('__all__'); }}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="유형" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체 유형</SelectItem>
              {questTypeOpts.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
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
          <Select value={filterHero} onValueChange={setFilterHero}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="직업/챔피언" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체 직업/챔피언</SelectItem>
              {heroOpts.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">승률 ≥</span>
            <Input
              value={filterMinWin}
              onChange={e => setFilterMinWin(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              inputMode="decimal"
              className="h-8 w-[70px] text-xs"
            />
            <span className="text-[11px] text-muted-foreground">%</span>
          </div>

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
            <Download className="w-3.5 h-3.5" /> 저장하기
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
          const yy = (date.getFullYear() % 100).toString().padStart(2, '0');
          const MM = (date.getMonth() + 1).toString().padStart(2, '0');
          const DD = date.getDate().toString().padStart(2, '0');
          const HH = date.getHours().toString().padStart(2, '0');
          const mm = date.getMinutes().toString().padStart(2, '0');
          const dow = ['일','월','화','수','목','금','토'][date.getDay()];
          const dateLabel = `${yy}.${MM}.${DD}.(${dow})`;
          const timeLabel = `${HH}:${mm}`;
          const questTypeLabel = sim.questTypeLabel || QUEST_TYPE_LABELS[sim.questTypeKey] || sim.questTypeKey;
          const selected = selectedIds.has(sim.id);

          const gearRatio = (sim.avgGearScore && sim.avgGearScore > 0) ? (sim.winRate / sim.avgGearScore) : null;

          return (
            <div
              key={sim.id}
              className={`saved-result-card rounded-lg cursor-pointer overflow-hidden ${editMode && selected ? 'ring-2 ring-primary/60' : ''}`}
              onClick={() => { if (editMode) toggleSelect(sim.id); else setDetailSim(sim); }}
            >
              <div className="flex items-stretch min-h-[170px]">
                {/* Left: number / checkbox */}
                <div className="flex items-center justify-center w-10 shrink-0 bg-primary border-r border-border/30">
                  {editMode ? (
                    <Checkbox checked={selected} onCheckedChange={() => toggleSelect(sim.id)} onClick={(e) => e.stopPropagation()} />
                  ) : (
                    <span className="text-sm font-bold font-mono !text-white" style={{ color: '#fff' }}>{simIndex + 1}</span>
                  )}
                </div>

                {/* Center area (header + body + footer) */}
                <div className="flex-1 min-w-0 flex flex-col">
                  {/* Premium header strip: type, breadcrumbs, date */}
                  <div className="saved-result-header px-3 py-2 flex items-center gap-4 flex-wrap">
                    <span className={`saved-chip saved-chip-quest-type ${QUEST_TYPE_CHIP_STYLE[sim.questTypeKey] || 'text-primary border-primary'}`}>{questTypeLabel}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-foreground">{sim.regionName || '-'}</span>
                      {sim.subAreaName && <>
                        <span className="text-muted-foreground/50 text-[13px]">&gt;</span>
                        <span className="text-[13px] font-bold text-foreground">{sim.subAreaName}</span>
                      </>}
                      {sim.difficulty && <>
                        <span className="text-muted-foreground/50 text-[13px]">&gt;</span>
                        <span className={`text-[13px] font-bold ${
                          sim.difficulty === '쉬움' ? 'text-lime-400' :
                          sim.difficulty === '보통' ? 'text-blue-400' :
                          sim.difficulty === '어려움' ? 'text-orange-400' :
                          sim.difficulty === '익스트림' ? 'text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]' :
                          'text-foreground'
                        }`}>{sim.difficulty}</span>
                      </>}
                      {sim.isBoss ? (<>
                        <span className="text-muted-foreground/50 text-[13px]">&gt;</span>
                        <span className="text-[13px] font-bold text-foreground">보스</span>
                      </>) : sim.miniBossLabel && (<>
                        <span className="text-muted-foreground/50 text-[13px]">&gt;</span>
                        <span className={`text-[13px] font-bold ${
                          sim.miniBoss === 'huge' ? 'text-lime-400' :
                          sim.miniBoss === 'dire' ? 'text-red-400' :
                          sim.miniBoss === 'legendary' ? 'text-purple-400' : 'text-foreground'
                        }`}>{sim.miniBossLabel}</span>
                      </>)}
                    </div>
                    <span className="ml-auto flex items-baseline gap-3">
                      <span className="text-[13px] text-foreground/90 font-semibold">{dateLabel}</span>
                      <span className="text-[13px] text-foreground/90 font-semibold">{timeLabel}</span>
                    </span>
                  </div>

                  {/* Middle row */}
                  <div className="flex-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-8 px-3 py-3">
                    {/* a: region image + sub-area image */}
                    <div className="flex items-center gap-2 shrink-0 mr-8">
                      {sim.regionImage && (
                        <img src={sim.regionImage} alt="" className="w-20 h-20 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      )}
                      {sim.subAreaImage && (
                        <img src={sim.subAreaImage} alt="" className="w-20 h-20 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      )}
                    </div>

                    {/* b: heroes grid */}
                    <div className="grid grid-cols-5 gap-5 min-w-0">
                      {Array.from({ length: 5 }).map((_, heroSlotIndex) => {
                        const hs = sim.heroSummaries[heroSlotIndex];
                        if (!hs) return <div key={`empty-${heroSlotIndex}`} className="min-w-0" />;
                        const hero = allHeroes.find(h => h.id === hs.heroId) ||
                          sim.heroSnapshots?.find(h => h.id === hs.heroId);
                        const img = hero?.type === 'champion'
                          ? getChampionImagePath(hero.championName || hero.name)
                          : hero?.heroClass ? getJobImagePath(hero.heroClass) : null;
                        const faceImg = getFaceImg(hs.survivalRate, hs.powerBelowMin, sim.avgRounds, sim.winRate);
                        const tankShare = hs.tankingShare ?? 0;
                        const heroElements = (sim.barrierInfos || []).map(b => ({
                          element: b.element,
                          iconPath: ELEMENT_ICON_MAP[b.element],
                          value: (hero?.equipmentElements?.[b.element] as number | undefined) || 0,
                        }));
                        return (
                          <div key={hs.heroId} className="flex flex-col gap-1 min-w-0">
                            {/* Row 1: avatar + name (left-aligned at x=0) */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-9 h-9 rounded-full border border-primary/30 overflow-hidden bg-secondary/50 shrink-0">
                                {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                              </div>
                              <div className="text-[14px] font-bold text-foreground truncate min-w-0">{hs.heroName}</div>
                            </div>
                            {/* Row 2: face + survival   |   per-hero elements (right) */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1">
                                <img src={faceImg} alt="" className="w-6 h-6" />
                                <span className={`text-[12px] font-mono font-bold tabular-nums ${getSurvivalColor(hs.survivalRate)}`}>
                                  {hs.survivalRate.toFixed(0)}%
                                </span>
                              </div>
                              {heroElements.length > 0 && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {heroElements.filter(e => e.value > 0).map(e => (
                                    <span key={e.element} className="flex items-center gap-0.5">
                                      {e.iconPath && <img src={e.iconPath} alt={e.element} className="w-[22px] h-[22px]" onError={ev => { ev.currentTarget.style.display = 'none'; }} />}
                                      <span className={`text-[13px] font-mono font-bold tabular-nums ${getSurvivalColor(hs.survivalRate)}`}>{formatNumber(e.value)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Dmg bar — bar = flex-1 (constant track length), number slot = exact width of "100%" left-aligned, right edge aligns with element row */}
                            <div className="flex items-center gap-1 text-[13px]">
                              <span className="font-bold text-foreground/85 w-4 shrink-0">딜</span>
                              <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden flex-1 min-w-0">
                                <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" style={{ width: `${Math.min(100, hs.damageShare)}%` }} />
                              </div>
                              <span className={`font-bold font-mono tabular-nums shrink-0 text-left ${getShareTextColor(hs.damageShare)}`} style={{ width: '4ch' }}>{hs.damageShare.toFixed(0)}%</span>
                            </div>
                            {/* Tank bar */}
                            <div className="flex items-center gap-1 text-[13px]">
                              <span className="font-bold text-foreground/85 w-4 shrink-0">탱</span>
                              <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden flex-1 min-w-0">
                                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${Math.min(100, tankShare)}%` }} />
                              </div>
                              <span className={`font-bold font-mono tabular-nums shrink-0 text-left ${getShareTextColor(tankShare)}`} style={{ width: '4ch' }}>{tankShare.toFixed(0)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* c: win rate + gear ratio */}
                    <div className="mr-3 flex items-center gap-9 shrink-0">
                      <div className="text-center">
                        <div className="text-[11px] text-muted-foreground dark:text-foreground/80">승률</div>
                        <div className={`text-2xl font-bold font-mono ${getWinRateColor(sim.winRate)}`}>
                          {sim.winRate.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[11px] text-muted-foreground dark:text-foreground/80">장비 대비</div>
                        <div className={`text-2xl font-bold font-mono ${gearRatio !== null ? getWinRateColor(gearRatio) : 'text-muted-foreground/50'}`}>
                          {gearRatio !== null ? gearRatio.toFixed(1) : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer: barriers + booster + avg + success/fail/retry */}
                  <div className="border-t border-border/30 px-3 py-2 flex items-center gap-3 text-[13px] flex-wrap">
                    {sim.barrierInfos && sim.barrierInfos.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        {sim.barrierInfos.map((b, i) => {
                          const isMet = b.partySum >= b.required;
                          return (
                            <span key={i} className={`saved-chip saved-chip-barrier text-[13px] ${isMet ? 'is-met text-lime-700' : 'is-unmet text-red-700'}`}>
                              {b.iconPath && <img src={b.iconPath} alt={b.element} className="w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                              {formatNumber(b.partySum)} / {formatNumber(b.required)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {(sim.barrierInfos?.length && sim.boosterImage) ? <span className="text-muted-foreground/40">·</span> : null}
                    {sim.boosterImage && (
                      <span className="flex items-center gap-1.5">
                        <img src={sim.boosterImage} alt="booster" className="w-5 h-5 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <span className="font-bold text-foreground/90">{sim.boosterLabel || '부스터'}</span>
                      </span>
                    )}
                    {(sim.barrierInfos?.length || sim.boosterImage) ? <span className="text-muted-foreground/40">·</span> : null}
                    <span className="font-bold text-foreground/90">
                      평균 <span className="font-mono font-bold text-foreground">{Math.round(sim.avgRounds)}</span>턴
                      <span className="text-foreground/60 font-normal"> ({sim.minRounds}~{sim.maxRounds}R)</span>
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    {sim.successCount !== undefined && (
                      <span className="font-bold text-foreground/90">
                        성공 <span className="font-mono font-bold text-lime-500 dark:text-lime-400">{formatNumber(sim.successCount)}</span>판
                      </span>
                    )}
                    {sim.failCount !== undefined && (
                      <span className="font-bold text-foreground/90">
                        실패 <span className="font-mono font-bold text-red-500 dark:text-red-400">{formatNumber(sim.failCount)}</span>판
                      </span>
                    )}
                    {sim.retryCount !== undefined && sim.retryCount > 0 && (
                      <span className="font-bold text-foreground/90">
                        재시도 <span className="font-mono font-bold text-amber-500 dark:text-amber-300">{formatNumber(sim.retryCount)}</span>판
                      </span>
                    )}
                  </div>
                </div>

                {/* Far right: action buttons */}
                <div className="flex flex-col gap-1.5 items-center justify-center px-2 bg-muted/30 border-l border-border/30">
                  <Button
                    variant="default"
                    size="icon"
                    className="saved-play-btn w-8 h-8 bg-primary text-white border-0 hover:bg-primary/90 [&_svg]:text-white"
                    onClick={(e) => { e.stopPropagation(); onLoadSimulation(sim); }}
                    title="불러오기"
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-white hover:bg-secondary/60 [&:hover_svg]:text-white"
                    onClick={(e) => { e.stopPropagation(); setExtractTarget(sim); }}
                    title="추출"
                  >
                    <FileDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-white hover:bg-destructive [&:hover_svg]:text-white"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(sim); }}
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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

      <SaveSimsDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen} sims={saved} />

      {/* Import confirmation: replace / merge */}
      <AlertDialog open={!!importPreview} onOpenChange={(v) => { if (!v) setImportPreview(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>결과 불러오기</AlertDialogTitle>
            <AlertDialogDescription>
              {importPreview?.length || 0}개의 저장 결과가 포함된 파일입니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-border hover:bg-secondary/20">
              <input type="radio" name="simImportMode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
              <div>
                <span className="text-sm font-medium text-foreground">덮어쓰기</span>
                <p className="text-xs text-muted-foreground">기존 결과를 삭제하고 파일 데이터로 교체합니다</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-border hover:bg-secondary/20">
              <input type="radio" name="simImportMode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
              <div>
                <span className="text-sm font-medium text-foreground">합치기</span>
                <p className="text-xs text-muted-foreground">기존 결과에 파일 데이터를 추가합니다</p>
              </div>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImportPreview(null)}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportConfirm}>적용</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-card extract */}
      <AlertDialog open={!!extractTarget} onOpenChange={(o) => !o && setExtractTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>결과 추출</AlertDialogTitle>
            <AlertDialogDescription>
              이 결과를 어떻게 내보낼까요? 클립보드 복사는 커뮤니티 공유용 코드 붙여넣기에 적합하고, 파일 저장은 개별 백업에 적합합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button variant="outline" className="justify-start gap-2" onClick={() => extractTarget && handleExtractCopy(extractTarget)}>
              <Copy className="w-4 h-4" /> 클립보드로 복사
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => extractTarget && handleExtractFile(extractTarget)}>
              <FileDown className="w-4 h-4" /> 파일로 저장
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
