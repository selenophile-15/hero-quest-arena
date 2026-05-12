import { useEffect, useMemo, useState } from 'react';
import { Hero } from '@/types/game';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { addHero, updateHero, getHeroes } from '@/lib/storage';
import { toast as sonnerToast } from 'sonner';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current party members (may be temp-overridden snapshots). */
  members: Hero[];
  /** Called after at least one hero was persisted to the list. */
  onPersisted?: (persistedIds: string[]) => void;
}

type RowMode = 'add' | 'overwrite';

export default function SavePartyToListDialog({ open, onOpenChange, members, onPersisted }: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<Record<string, RowMode>>({});

  const existingIds = useMemo(() => new Set(getHeroes().map(h => h.id)), [open]);

  useEffect(() => {
    if (!open) return;
    // Initialize all unchecked; default mode = overwrite if existing, else add.
    const initMode: Record<string, RowMode> = {};
    members.forEach(m => {
      initMode[m.id] = existingIds.has(m.id) ? 'overwrite' : 'add';
    });
    setSelected({});
    setMode(initMode);
  }, [open, members, existingIds]);

  const allChecked = members.length > 0 && members.every(m => selected[m.id]);
  const noneChecked = members.every(m => !selected[m.id]);

  const toggleAll = () => {
    if (allChecked) {
      setSelected({});
    } else {
      const all: Record<string, boolean> = {};
      members.forEach(m => { all[m.id] = true; });
      setSelected(all);
    }
  };

  const handleConfirm = () => {
    // Persisted ID = id present in the list after operation (new id for adds, original id for overwrites)
    const persistedIds: string[] = [];
    const persistedTypes = new Set<'hero' | 'champion'>();
    let addCount = 0, overCount = 0;

    members.forEach(m => {
      if (!selected[m.id]) return;
      const rowMode = mode[m.id] || 'add';
      if (rowMode === 'overwrite' && existingIds.has(m.id)) {
        updateHero(m);
        overCount++;
        persistedIds.push(m.id);
        persistedTypes.add(m.type === 'champion' ? 'champion' : 'hero');
      } else {
        const newId = crypto.randomUUID();
        const newHero: Hero = { ...m, id: newId, createdAt: new Date().toISOString() };
        addHero(newHero);
        addCount++;
        persistedIds.push(newId);
        persistedTypes.add(m.type === 'champion' ? 'champion' : 'hero');
      }
    });

    if (addCount + overCount > 0) {
      window.dispatchEvent(new Event('heroes-updated'));
      onPersisted?.(persistedIds);

      // Decide which list tab to navigate to (prefer hero if both)
      const targetTab: 'hero' | 'champion' = persistedTypes.has('hero') ? 'hero' : 'champion';

      // Custom sonner toast: 3s, click body to navigate, X to dismiss
      sonnerToast.custom((id) => (
        <div
          onClick={() => {
            window.dispatchEvent(new CustomEvent('goto-hero-list-highlight', {
              detail: { ids: persistedIds, listTab: targetTab },
            }));
            sonnerToast.dismiss(id);
          }}
          className="flex items-center gap-3 rounded-md border border-border bg-card text-foreground px-4 py-3 shadow-lg cursor-pointer hover:bg-accent/30 transition-colors min-w-[280px]"
        >
          <div className="flex-1">
            <div className="text-sm font-semibold">리스트에 저장됨</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              새로 추가 {addCount}개 · 덮어쓰기 {overCount}개 · 클릭하여 이동
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); sonnerToast.dismiss(id); }}
            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ), { duration: 3000 });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>파티원 리스트 저장</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <Checkbox checked={allChecked} onCheckedChange={toggleAll} id="select-all" />
          <label htmlFor="select-all" className="text-sm text-foreground cursor-pointer">
            {allChecked ? '전체 해제' : '전체 선택'}
          </label>
          <span className="ml-auto text-xs text-muted-foreground">{members.length}명</span>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {members.map(m => {
            const canOverwrite = existingIds.has(m.id);
            const rowMode = mode[m.id] || 'add';
            return (
              <div key={m.id} className="flex items-center gap-2 p-2 rounded border border-border/40 bg-card/50">
                <Checkbox
                  checked={!!selected[m.id]}
                  onCheckedChange={c => setSelected(s => ({ ...s, [m.id]: !!c }))}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.type === 'champion' ? (m.championName || '챔피언') : (m.heroClass || '영웅')} · Lv {m.level}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setMode(md => ({ ...md, [m.id]: 'add' }))}
                    className={`text-xs px-2 py-1 rounded transition-colors ${rowMode === 'add' ? 'bg-primary text-primary-foreground btn-force-white' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
                  >
                    새로 추가
                  </button>
                  <button
                    type="button"
                    disabled={!canOverwrite}
                    onClick={() => canOverwrite && setMode(md => ({ ...md, [m.id]: 'overwrite' }))}
                    className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${rowMode === 'overwrite' ? 'bg-primary text-primary-foreground btn-force-white' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
                    title={canOverwrite ? '내 리스트의 동일 ID 영웅을 현재 상태로 덮어씁니다' : '리스트에 동일 ID가 없어 덮어쓰기 불가'}
                  >
                    덮어쓰기
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" disabled={noneChecked} onClick={handleConfirm} className="btn-force-white">확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
