import { useState, useMemo } from 'react';
import { Hero, STAT_COLUMNS, HERO_CLASS_LINES, HeroClassLine, ELEMENT_ICON_MAP } from '@/types/game';
import { HERO_CLASS_MAP } from '@/lib/gameData';
import { getHeroes, saveHeroes, deleteHero } from '@/lib/storage';
import HeroForm from './HeroForm';
import ChampionForm from './ChampionForm';
import ElementIcon from './ElementIcon';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, Shield, Crown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

type SortDir = 'asc' | 'desc';

const CLASS_LINE_COLORS: Record<string, string> = {
  '전사': 'text-red-400',
  '로그': 'text-lime-400',
  '주문술사': 'text-sky-400',
};

const formatValue = (key: string, value: any): string | null => {
  if (value === undefined || value === null || value === '') return '-';
  if (key === 'crit' || key === 'evasion') return `${value}%`;
  if (key === 'critDmg') return `${value}%`;
  return null; // use default rendering
};

export default function HeroList() {
  const [heroes, setHeroes] = useState<Hero[]>(getHeroes());
  const [editing, setEditing] = useState<Hero | null>(null);
  const [addingType, setAddingType] = useState<'hero' | 'champion' | null>(null);
  const [sortKey, setSortKey] = useState<keyof Hero>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(STAT_COLUMNS.map(c => c.key))
  );

  const allJobs = Object.values(HERO_CLASS_MAP).flat();

  const filtered = useMemo(() => {
    let list = [...heroes];
    if (filterClass !== 'all') list = list.filter(h => h.heroClass === filterClass);
    if (filterType !== 'all') list = list.filter(h => h.type === filterType);
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return list;
  }, [heroes, sortKey, sortDir, filterClass, filterType]);

  const handleSort = (key: keyof Hero) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleSave = (hero: Hero) => {
    const updated = editing
      ? heroes.map(h => (h.id === hero.id ? hero : h))
      : [...heroes, hero];
    setHeroes(updated);
    saveHeroes(updated);
    setEditing(null);
    setAddingType(null);
  };

  const handleDelete = (id: string) => {
    deleteHero(id);
    setHeroes(prev => prev.filter(h => h.id !== id));
  };

  const toggleCol = (key: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (addingType === 'hero' || (editing && editing.type === 'hero')) {
    return <HeroForm hero={editing || undefined} onSave={handleSave} onCancel={() => { setAddingType(null); setEditing(null); }} />;
  }
  if (addingType === 'champion' || (editing && editing.type === 'champion')) {
    return <ChampionForm hero={editing || undefined} onSave={handleSave} onCancel={() => { setAddingType(null); setEditing(null); }} />;
  }

  const activeCols = STAT_COLUMNS.filter(c => visibleCols.has(c.key));

  const renderCell = (hero: Hero, colKey: string) => {
    const value = hero[colKey as keyof Hero];

    if (colKey === 'name') {
      return <span className="font-medium text-foreground">{hero.name}</span>;
    }
    if (colKey === 'type') {
      return (
        <span className={hero.type === 'champion' ? 'text-primary font-medium' : 'text-red-400 font-medium'}>
          {hero.type === 'champion' ? '챔피언' : '영웅'}
        </span>
      );
    }
    if (colKey === 'classLine') {
      if (!hero.classLine) return <span className="text-muted-foreground">-</span>;
      return <span className={CLASS_LINE_COLORS[hero.classLine] || 'text-foreground'}>{hero.classLine}</span>;
    }
    if (colKey === 'heroClass') {
      if (!hero.heroClass) return <span className="text-muted-foreground">-</span>;
      return <span>{hero.heroClass}</span>;
    }
    if (colKey === 'element') {
      return <ElementIcon element={hero.element} size={22} />;
    }

    const formatted = formatValue(colKey, value);
    if (formatted !== null) return <span>{formatted}</span>;
    return <span>{String(value ?? '-')}</span>;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl text-primary">영웅 &amp; 챔피언 리스트</h2>
        <div className="flex gap-2">
          <Button onClick={() => setAddingType('hero')} className="gap-2">
            <Shield className="w-4 h-4" /> 영웅 추가
          </Button>
          <Button onClick={() => setAddingType('champion')} variant="secondary" className="gap-2">
            <Crown className="w-4 h-4" /> 챔피언 추가
          </Button>
        </div>
      </div>

      <div className="card-fantasy p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">유형:</span>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="hero">영웅</SelectItem>
                <SelectItem value="champion">챔피언</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">직업:</span>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {allJobs.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="text-sm text-muted-foreground">표시 항목:</span>
          {STAT_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Checkbox checked={visibleCols.has(col.key)} onCheckedChange={() => toggleCol(col.key)} />
              {col.label}
            </label>
          ))}
        </div>
      </div>

      <div className="card-fantasy overflow-x-auto scrollbar-fantasy">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {activeCols.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key as keyof Hero)}
                  className={`px-4 py-3 font-medium cursor-pointer hover:text-primary transition-colors select-none text-muted-foreground ${col.key === 'name' ? 'text-left' : 'text-center'}`}>
                  <span className={`flex items-center gap-1 ${col.key === 'name' ? '' : 'justify-center'}`}>
                    {col.label}
                    {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-muted-foreground font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={activeCols.length + 1} className="text-center py-12 text-muted-foreground">영웅을 추가해주세요</td></tr>
            )}
            {filtered.map(hero => (
              <tr key={hero.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                {activeCols.map(col => (
                  <td key={col.key} className={`px-4 py-3 ${col.key === 'name' ? 'text-left' : 'text-center'}`}>
                    {renderCell(hero, col.key)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(hero)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(hero.id)} className="p-1.5 rounded hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
