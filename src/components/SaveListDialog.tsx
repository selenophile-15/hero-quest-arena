import { useState, useMemo, useCallback } from 'react';
import { Hero } from '@/types/game';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Shield, Crown, Download } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { JOB_NAME_MAP, CHAMPION_NAME_MAP } from '@/lib/nameMap';

interface SaveListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroes: Hero[];
}

type FilterTab = 'all' | 'hero' | 'champion';

export default function SaveListDialog({ open, onOpenChange, heroes }: SaveListDialogProps) {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(heroes.map(h => h.id)));

  // Reset selection when dialog opens
  const handleOpenChange = useCallback((v: boolean) => {
    if (v) {
      setSelectedIds(new Set(heroes.map(h => h.id)));
      setFilterTab('all');
    }
    onOpenChange(v);
  }, [heroes, onOpenChange]);

  const heroList = useMemo(() => heroes.filter(h => h.type === 'hero'), [heroes]);
  const championList = useMemo(() => heroes.filter(h => h.type === 'champion'), [heroes]);

  const displayList = useMemo(() => {
    if (filterTab === 'hero') return heroList;
    if (filterTab === 'champion') return championList;
    return heroes;
  }, [filterTab, heroes, heroList, championList]);

  const selectedCount = useMemo(() => {
    return heroes.filter(h => selectedIds.has(h.id)).length;
  }, [heroes, selectedIds]);

  const selectedHeroCount = useMemo(() => heroList.filter(h => selectedIds.has(h.id)).length, [heroList, selectedIds]);
  const selectedChampionCount = useMemo(() => championList.filter(h => selectedIds.has(h.id)).length, [championList, selectedIds]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((list: Hero[], checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      list.forEach(h => {
        if (checked) next.add(h.id);
        else next.delete(h.id);
      });
      return next;
    });
  }, []);

  const isAllChecked = useMemo(() => displayList.every(h => selectedIds.has(h.id)), [displayList, selectedIds]);
  const isSomeChecked = useMemo(() => displayList.some(h => selectedIds.has(h.id)) && !isAllChecked, [displayList, selectedIds, isAllChecked]);

  const handleSave = useCallback(() => {
    const selected = heroes.filter(h => selectedIds.has(h.id));
    if (selected.length === 0) return;
    const data = JSON.stringify(selected, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `quest_sim_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    onOpenChange(false);
  }, [heroes, selectedIds, onOpenChange]);

  const getDisplayName = (h: Hero) => {
    if (h.type === 'champion') {
      return CHAMPION_NAME_MAP[h.heroClass] || h.name;
    }
    return h.name;
  };

  const getSubInfo = (h: Hero) => {
    if (h.type === 'hero') {
      return JOB_NAME_MAP[h.heroClass] || h.heroClass || '-';
    }
    return '챔피언';
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">리스트 저장하기</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            저장할 대상을 선택하세요. 영웅 {selectedHeroCount}명, 챔피언 {selectedChampionCount}명 선택됨 (총 {selectedCount}명)
          </DialogDescription>
        </DialogHeader>

        <Tabs value={filterTab} onValueChange={v => setFilterTab(v as FilterTab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-3 flex-shrink-0">
            <TabsTrigger value="all" className="text-xs">
              전체 ({heroes.length})
            </TabsTrigger>
            <TabsTrigger value="hero" className="text-xs gap-1">
              <Shield className="w-3 h-3" /> 영웅 ({heroList.length})
            </TabsTrigger>
            <TabsTrigger value="champion" className="text-xs gap-1">
              <Crown className="w-3 h-3" /> 챔피언 ({championList.length})
            </TabsTrigger>
          </TabsList>

          {(['all', 'hero', 'champion'] as FilterTab[]).map(tab => (
            <TabsContent key={tab} value={tab} className="flex-1 overflow-hidden mt-2">
              <div className="flex flex-col h-full">
                {/* Select all header */}
                <label className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30 rounded-t cursor-pointer">
                  <Checkbox
                    checked={isAllChecked ? true : isSomeChecked ? 'indeterminate' : false}
                    onCheckedChange={(checked) => toggleAll(displayList, !!checked)}
                  />
                  <span className="text-xs font-semibold text-foreground">전체 선택 / 해제</span>
                </label>

                {/* Item list */}
                <div className="flex-1 overflow-y-auto max-h-[40vh] border border-border rounded-b">
                  {displayList.map(h => (
                    <label
                      key={h.id}
                      className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 hover:bg-secondary/20 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(h.id)}
                        onCheckedChange={() => toggleId(h.id)}
                      />
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${h.type === 'hero' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {h.type === 'hero' ? '영웅' : '챔피언'}
                      </span>
                      <span className="text-xs font-medium text-foreground truncate flex-1">{getDisplayName(h)}</span>
                      <span className="text-[10px] text-muted-foreground">{getSubInfo(h)}</span>
                      <span className="text-[10px] text-muted-foreground">Lv.{h.level}</span>
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter className="flex-shrink-0 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={selectedCount === 0} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            저장하기 ({selectedCount}명)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
