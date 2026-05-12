import { useState, useMemo, useCallback, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { saveBlobFile } from '@/lib/fileDownload';
import type { SavedSimulationSummary } from '@/lib/savedSimulations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sims: SavedSimulationSummary[];
}

export default function SaveSimsDialog({ open, onOpenChange, sims }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(sims.map(s => s.id)));

  useEffect(() => {
    if (open) setSelectedIds(new Set(sims.map(s => s.id)));
  }, [open, sims]);

  const allChecked = useMemo(
    () => sims.length > 0 && sims.every(s => selectedIds.has(s.id)),
    [sims, selectedIds]
  );
  const someChecked = useMemo(
    () => sims.some(s => selectedIds.has(s.id)) && !allChecked,
    [sims, selectedIds, allChecked]
  );

  const toggleId = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    if (checked) setSelectedIds(new Set(sims.map(s => s.id)));
    else setSelectedIds(new Set());
  }, [sims]);

  const handleSave = useCallback(async () => {
    const selected = sims.filter(s => selectedIds.has(s.id));
    if (selected.length === 0) return;
    const data = JSON.stringify(selected, null, 2);
    const blob = new Blob([data], { type: 'text/plain' });
    await saveBlobFile(
      blob,
      `quest_sim_results_${new Date().toISOString().slice(0, 10)}.txt`,
      '자동 저장이 안 되면 공유 또는 다른 앱으로 열기를 사용해 주세요.',
    );
    onOpenChange(false);
  }, [sims, selectedIds, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">결과 저장하기</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            저장할 결과를 선택하세요. {selectedIds.size}개 선택됨 (총 {sims.length}개)
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          <label className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30 rounded-t cursor-pointer">
            <Checkbox
              checked={allChecked ? true : someChecked ? 'indeterminate' : false}
              onCheckedChange={(c) => toggleAll(!!c)}
            />
            <span className="text-xs font-semibold text-foreground">전체 선택 / 해제</span>
          </label>
          <div className="flex-1 overflow-y-auto max-h-[50vh] border border-border rounded-b">
            {sims.map(s => {
              const d = new Date(s.savedAt);
              const dateStr = `${d.getFullYear()}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
              return (
                <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 hover:bg-secondary/20 cursor-pointer">
                  <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleId(s.id)} />
                  <span className="text-xs font-medium text-foreground truncate flex-1">
                    {s.regionName || '-'} · {s.subAreaName || '-'} {s.difficulty ? `· ${s.difficulty}` : ''}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">{s.winRate.toFixed(1)}%</span>
                  <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={selectedIds.size === 0} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            저장하기 ({selectedIds.size}개)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
