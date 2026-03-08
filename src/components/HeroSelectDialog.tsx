import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Hero } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Swords, Heart, Table2, LayoutGrid, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroes: Hero[];
  selectedIds: Set<string>;
  maxMembers: number;
  minPower: number;
  onSelect: (heroId: string) => void;
}

const CLASS_LINE_BORDER: Record<string, string> = {
  '전사': 'border-red-500/50',
  '로그': 'border-green-500/50',
  '주문술사': 'border-blue-500/50',
};

export default function HeroSelectDialog({ open, onOpenChange, heroes, selectedIds, maxMembers, minPower, onSelect }: Props) {
  const [viewMode, setViewMode] = useState<'table' | 'album'>('table');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return heroes;
    const q = search.toLowerCase();
    return heroes.filter(h => h.name.toLowerCase().includes(q) || h.heroClass.toLowerCase().includes(q));
  }, [heroes, search]);

  const handleSelect = (heroId: string) => {
    onSelect(heroId);
    // Don't close - allow multiple selections
  };

  const isFull = selectedIds.size >= maxMembers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center justify-between">
            <span>영웅 선택</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selectedIds.size}/{maxMembers}</span>
              <div className="flex gap-1">
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Table2 className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('album')} className={`p-1.5 rounded ${viewMode === 'album' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 또는 직업 검색..." className="pl-8 h-8 text-sm" />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {viewMode === 'table' ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 px-2">이름</th>
                  <th className="text-left py-1.5 px-2">타입</th>
                  <th className="text-left py-1.5 px-2">직업</th>
                  <th className="text-right py-1.5 px-2">Lv</th>
                  <th className="text-right py-1.5 px-2">전투력</th>
                  <th className="text-right py-1.5 px-2">공격력</th>
                  <th className="text-right py-1.5 px-2">방어력</th>
                  <th className="text-right py-1.5 px-2">체력</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(hero => {
                  const isSelected = selectedIds.has(hero.id);
                  const disabled = isFull && !isSelected;
                  const belowMin = hero.power > 0 && hero.power < minPower;
                  return (
                    <tr key={hero.id}
                      onClick={() => !disabled && handleSelect(hero.id)}
                      className={`border-b border-border/30 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10' : disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-secondary/30'
                      }`}>
                      <td className="py-1.5 px-2 font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          {belowMin && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                          {hero.name}
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <span className={`px-1 py-0.5 rounded text-[10px] ${hero.type === 'champion' ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}`}>
                          {hero.type === 'champion' ? '챔피언' : '영웅'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground">{hero.heroClass || hero.championName || '-'}</td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground">{hero.level}</td>
                      <td className={`py-1.5 px-2 text-right font-mono ${belowMin ? 'text-red-400' : 'text-yellow-400'}`}>{hero.power > 0 ? formatNumber(hero.power) : '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-red-400">{formatNumber(hero.atk)}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-blue-400">{formatNumber(hero.def)}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-orange-400">{formatNumber(hero.hp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-1">
              {filtered.map(hero => {
                const isSelected = selectedIds.has(hero.id);
                const disabled = isFull && !isSelected;
                const belowMin = hero.power > 0 && hero.power < minPower;
                const borderClass = hero.classLine ? CLASS_LINE_BORDER[hero.classLine] || 'border-border' : 'border-purple-500/50';
                return (
                  <button key={hero.id}
                    onClick={() => !disabled && handleSelect(hero.id)}
                    disabled={disabled}
                    className={`rounded-lg border-2 p-2 text-center transition-all ${borderClass} ${
                      isSelected ? 'ring-2 ring-primary bg-primary/10' : disabled ? 'opacity-30' : 'hover:bg-secondary/30'
                    }`}>
                    {belowMin && <div className="w-2 h-2 rounded-full bg-red-500 mx-auto mb-1" />}
                    <div className="w-10 h-10 rounded-full bg-secondary/50 border border-border mx-auto flex items-center justify-center mb-1">
                      <span className="text-sm">⚔</span>
                    </div>
                    <span className="text-[10px] font-medium text-foreground block truncate">{hero.name}</span>
                    <span className="text-[9px] text-muted-foreground">{hero.heroClass || hero.championName || ''}</span>
                    {hero.power > 0 && (
                      <span className={`text-[9px] font-mono block ${belowMin ? 'text-red-400' : 'text-yellow-400'}`}>
                        {formatNumber(hero.power)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
