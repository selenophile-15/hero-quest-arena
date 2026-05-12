import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getSavedSimulations,
  deleteSavedSimulation,
  deleteAllSavedSimulations,
  SavedSimulationSummary,
} from '@/lib/savedSimulations';
import { Trash2, Play, AlertTriangle, Download, Upload, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { getHeroes } from '@/lib/storage';
import { saveBlobFile } from '@/lib/fileDownload';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SavedSimDetailDialog from '@/components/SavedSimDetailDialog';

const STORAGE_KEY = 'quest-sim-saved-results';

// Face image based on per-hero survival rate (same image set as QuestSimulation)
const getFaceImg = (survivalRate: number, powerBelowMin?: boolean): string => {
  if (powerBelowMin) return '/images/quest/face/icon_shop_face_D.webp';
  // Approximate inverse of QuestSimulation thresholds (deathCount-based)
  if (survivalRate <= 0) return '/images/quest/face/icon_shop_face_D.webp';
  if (survivalRate < 40) return '/images/quest/face/icon_shop_face_D.webp';
  if (survivalRate < 60) return '/images/quest/face/icon_shop_face_C.webp';
  if (survivalRate < 75) return '/images/quest/face/icon_shop_face_B.webp';
  if (survivalRate < 90) return '/images/quest/face/icon_shop_face_A.webp';
  if (survivalRate < 100) return '/images/quest/face/icon_shop_face_S.webp';
  return '/images/quest/face/icon_shop_face_SSS.webp';
};

// Olive-lime palette (matches QuestSimulation winRate text)
const getWinRateColor = (rate: number) =>
  rate >= 90 ? 'text-lime-600 dark:text-lime-300' :
  rate >= 70 ? 'text-lime-700 dark:text-lime-400' :
  rate >= 50 ? 'text-yellow-600 dark:text-yellow-300' :
  rate >= 30 ? 'text-orange-600 dark:text-orange-300' : 'text-red-500 dark:text-red-400';

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
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SavedSimulationSummary | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detailSim, setDetailSim] = useState<SavedSimulationSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allHeroes = getHeroes();

  useEffect(() => {
    setSaved(getSavedSimulations());
    setSelectedIds(new Set());
  }, [refreshKey]);

  const refresh = () => setSaved(getSavedSimulations());

  const handleDelete = (id: string) => {
    deleteSavedSimulation(id);
    refresh();
  };

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

  const toggleAll = () => {
    if (selectedIds.size === saved.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(saved.map(s => s.id)));
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
        // Merge: add ones whose id isn't present
        const existing = getSavedSimulations();
        const existingIds = new Set(existing.map(s => s.id));
        const merged = [...parsed.filter((s: any) => !existingIds.has(s.id)), ...existing];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        refresh();
      } catch {
        alert('파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

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
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-muted-foreground">
          {editMode && selectedIds.size > 0 ? `${selectedIds.size}개 선택 / ` : ''}{saved.length}개 저장됨
        </span>
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
                {selectedIds.size === saved.length ? '전체 해제' : '전체 선택'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={selectedIds.size === 0}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" /> 삭제 ({selectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setEditMode(false); setSelectedIds(new Set()); }}>
                <X className="w-3.5 h-3.5" /> 완료
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {saved.map((sim, simIndex) => {
          const date = new Date(sim.savedAt);
          const dateStr = `${date.getFullYear()}.${(date.getMonth()+1).toString().padStart(2,'0')}.${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;

          const questTypeLabel = QUEST_TYPE_LABELS[sim.questTypeKey] || sim.questTypeKey;
          const nameParts = sim.name.split(' ');
          const regionName = nameParts.length >= 2 ? nameParts.slice(1).join(' ') : sim.name;

          const boosterLabel = BOOSTER_LABELS[sim.booster] || '';
          const selected = selectedIds.has(sim.id);

          return (
            <div
              key={sim.id}
              className={`rounded-lg border border-border/60 bg-card hover:bg-card/90 transition-all cursor-pointer ${
                editMode && selected ? 'ring-2 ring-primary/60' : ''
              }`}
              onClick={() => {
                if (editMode) toggleSelect(sim.id);
                else setDetailSim(sim);
              }}
            >
              <div className="flex items-stretch min-h-[110px]">
                {/* Checkbox or number badge */}
                <div className="flex items-center justify-center w-10 shrink-0 bg-muted/40 rounded-l-lg border-r border-border/30">
                  {editMode ? (
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleSelect(sim.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-sm font-bold font-mono text-muted-foreground">{simIndex + 1}</span>
                  )}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
                  {/* Top row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">{questTypeLabel}</span>
                    <span className="text-[11px] text-muted-foreground">/</span>
                    <span className="text-sm font-bold text-foreground">{regionName}</span>
                    {boosterLabel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500 dark:text-yellow-400 font-medium">{boosterLabel}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">평균 <span className="font-mono text-foreground">{Math.round(sim.avgRounds)}</span>턴 ({sim.minRounds}~{sim.maxRounds}R)</span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{dateStr}</span>
                  </div>

                  {/* Hero portraits row */}
                  <div className="flex items-center gap-3 flex-wrap">
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
                          <div className="text-[11px] leading-tight">
                            <div className="text-foreground font-medium">{hs.heroName}</div>
                            <div className="text-muted-foreground font-mono">
                              딜 {hs.damageShare.toFixed(0)}% · 탱 {tankShare.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right side: Win rate + actions */}
                <div className="flex items-center gap-2 px-3 shrink-0">
                  <div className="text-right mr-2">
                    <div className="text-[10px] text-muted-foreground">승률</div>
                    <div className={`text-2xl font-bold font-mono ${getWinRateColor(sim.winRate)}`}>
                      {sim.winRate.toFixed(1)}%
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 text-primary hover:bg-primary/10"
                      onClick={(e) => { e.stopPropagation(); onLoadSimulation(sim); }}
                      title="불러오기"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-white hover:bg-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(sim); }}
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
        ℹ️ 카드를 누르면 파티 상세를 볼 수 있습니다. 불러오기 시 저장된 파티/세팅으로 다시 시뮬레이션을 실행합니다.<br/>
        결과는 매번 약간 달라질 수 있습니다.
      </div>

      {/* Single delete confirm */}
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
              onClick={() => {
                if (deleteTarget) handleDelete(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
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
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SavedSimDetailDialog open={!!detailSim} onOpenChange={(o) => !o && setDetailSim(null)} sim={detailSim} />
    </div>
  );
}
