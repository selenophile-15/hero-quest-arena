import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getSavedSimulations, SavedSimulationSummary } from '@/lib/savedSimulations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (targetId: string) => void;
  defaultSelectedId?: string | null;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const getWinRateColor = (rate: number) =>
  rate >= 90 ? 'text-green-400' :
  rate >= 70 ? 'text-lime-400' :
  rate >= 50 ? 'text-yellow-400' :
  rate >= 30 ? 'text-orange-400' : 'text-red-400';

export default function OverwriteSimulationDialog({ open, onOpenChange, onConfirm }: Props) {
  const [items, setItems] = useState<SavedSimulationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setItems(getSavedSimulations());
      setSelectedId(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">결과 덮어쓰기</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            덮어쓸 저장된 결과를 선택하세요. 선택한 결과는 현재 시뮬레이션 결과로 교체됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto max-h-[50vh] border border-border rounded">
          {items.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-8">
              저장된 결과가 없습니다
            </div>
          ) : items.map(s => (
            <label
              key={s.id}
              className={`flex items-center gap-2 px-3 py-2 border-b border-border/30 cursor-pointer hover:bg-secondary/30 ${selectedId === s.id ? 'bg-primary/10' : ''}`}
            >
              <input
                type="radio"
                name="overwrite-target"
                checked={selectedId === s.id}
                onChange={() => setSelectedId(s.id)}
                className="accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground truncate">{s.name}</div>
                <div className="text-[10px] text-muted-foreground">{formatDate(s.savedAt)}</div>
              </div>
              <div className={`text-sm font-mono font-bold ${getWinRateColor(s.winRate)}`}>
                {s.winRate.toFixed(1)}%
              </div>
            </label>
          ))}
        </div>

        <DialogFooter className="flex-shrink-0 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            size="sm"
            disabled={!selectedId}
            onClick={() => {
              if (selectedId) {
                onConfirm(selectedId);
                onOpenChange(false);
              }
            }}
          >
            덮어쓰기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
