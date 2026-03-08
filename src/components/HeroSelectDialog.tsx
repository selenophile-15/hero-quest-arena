import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Hero, ELEMENT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table2, LayoutGrid, Filter, ArrowUpDown, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getJobImagePath, getJobIllustPath, getChampionImagePath } from '@/lib/nameMap';
import { HERO_CLASS_MAP } from '@/lib/gameData';
import ElementIcon from './ElementIcon';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroes: Hero[];
  selectedIds: Set<string>;
  maxMembers: number;
  minPower: number;
  onConfirm: (ids: Set<string>) => void;
  editingSlotIdx: number | null;
}

const CLASS_LINE_COLORS: Record<string, string> = {
  '전사': 'text-red-400',
  '로그': 'text-lime-400',
  '주문술사': 'text-sky-400',
};

const CLASS_LINE_BORDER: Record<string, string> = {
  '전사': 'border-red-500/50',
  '로그': 'border-green-500/50',
  '주문술사': 'border-blue-500/50',
};

const CLASS_LINE_ORDER: Record<string, number> = { '전사': 0, '로그': 1, '주문술사': 2 };

const JOB_ORDER: Record<string, number> = {};
let orderIdx = 0;
for (const [, jobs] of Object.entries(HERO_CLASS_MAP)) {
  for (const job of jobs) {
    JOB_ORDER[job] = orderIdx++;
  }
}

const PROMOTED_JOBS = new Set<string>();
for (const jobs of Object.values(HERO_CLASS_MAP)) {
  for (let i = 1; i < jobs.length; i += 2) {
    PROMOTED_JOBS.add(jobs[i]);
  }
}

function getJobSortKey(hero: Hero): number {
  const classLineVal = CLASS_LINE_ORDER[hero.classLine] ?? 99;
  const jobVal = JOB_ORDER[hero.heroClass] ?? 999;
  const promoVal = PROMOTED_JOBS.has(hero.heroClass) ? 1 : 0;
  return classLineVal * 10000 + jobVal * 10 + promoVal;
}

type SortKey = 'heroClass' | 'level' | 'power' | 'atk' | 'def' | 'hp' | 'name';

const JOB_FILTER_ORDER = [
  '병사', '용병', '야만전사', '족장', '기사', '군주', '레인저', '관리인', '사무라이', '다이묘', '광전사', '잘', '어둠의 기사', '죽음의 기사',
  '도둑', '사기꾼', '수도승', '그랜드 마스터', '머스킷병', '정복자', '방랑자', '길잡이', '닌자', '센세', '무희', '곡예가', '경보병', '근위병',
  '마법사', '대마법사', '성직자', '비숍', '드루이드', '아크 드루이드', '소서러', '워록', '마법검', '스펠나이트', '풍수사', '아스트라맨서', '크로노맨서', '페이트위버',
];

export default function HeroSelectDialog({ open, onOpenChange, heroes, selectedIds, maxMembers, minPower, onConfirm, editingSlotIdx }: Props) {
  const [viewMode, setViewMode] = useState<'table' | 'album'>('table');
  const [localIds, setLocalIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('heroClass');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClassLine, setFilterClassLine] = useState<string>('all');
  const [filterElement, setFilterElement] = useState<string>('all');
  const [filterJob, setFilterJob] = useState<string>('all');
  const [filterPosition, setFilterPosition] = useState<string>('all');

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalIds(new Set(selectedIds));
    }
  }, [open, selectedIds]);

  const heroMap = useMemo(() => new Map(heroes.map(h => [h.id, h])), [heroes]);

  const uniqueElements = useMemo(() => {
    const set = new Set(heroes.map(h => h.element).filter(Boolean));
    return ['불', '물', '공기', '대지', '빛', '어둠', '모든 원소'].filter(e => set.has(e));
  }, [heroes]);

  const uniqueJobs = useMemo(() => {
    const set = new Set(heroes.map(h => h.heroClass).filter(Boolean));
    return JOB_FILTER_ORDER.filter(j => set.has(j));
  }, [heroes]);

  const uniquePositions = useMemo(() => {
    const set = new Set(heroes.map(h => h.position).filter(Boolean));
    return Array.from(set).sort();
  }, [heroes]);

  const filtered = useMemo(() => {
    let list = [...heroes];

    // Filters
    if (filterType !== 'all') list = list.filter(h => h.type === filterType);
    if (filterClassLine !== 'all') list = list.filter(h => h.classLine === filterClassLine);
    if (filterElement !== 'all') list = list.filter(h => h.element === filterElement);
    if (filterJob !== 'all') list = list.filter(h => h.heroClass === filterJob);
    if (filterPosition !== 'all') list = list.filter(h => h.position === filterPosition);

    // Sort
    if (sortKey === 'heroClass') {
      list.sort((a, b) => {
        const ak = getJobSortKey(a), bk = getJobSortKey(b);
        return sortDir === 'asc' ? ak - bk : bk - ak;
      });
    } else if (sortKey === 'name') {
      list.sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else {
      list.sort((a, b) => {
        const av = (a as any)[sortKey] ?? 0;
        const bv = (b as any)[sortKey] ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [heroes, filterType, filterClassLine, filterElement, filterJob, filterPosition, sortKey, sortDir]);

  const handleToggle = (heroId: string) => {
    if (editingSlotIdx !== null) {
      // Swap mode: replace the slot
      setLocalIds(prev => {
        const arr = Array.from(prev);
        const existingIdx = arr.indexOf(heroId);
        if (existingIdx !== -1) arr.splice(existingIdx, 1);
        if (editingSlotIdx < arr.length) arr[editingSlotIdx] = heroId;
        else arr.push(heroId);
        return new Set(arr);
      });
      onConfirm((() => {
        const arr = Array.from(localIds);
        const existingIdx = arr.indexOf(heroId);
        if (existingIdx !== -1) arr.splice(existingIdx, 1);
        if (editingSlotIdx < arr.length) arr[editingSlotIdx] = heroId;
        else arr.push(heroId);
        return new Set(arr);
      })());
      return;
    }
    setLocalIds(prev => {
      const next = new Set(prev);
      if (next.has(heroId)) next.delete(heroId);
      else if (next.size < maxMembers) next.add(heroId);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(localIds);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const isFull = localIds.size >= maxMembers;
  const selectedHeroes = Array.from(localIds).map(id => heroMap.get(id)).filter(Boolean) as Hero[];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0" hideCloseButton>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-display text-lg text-primary">영웅 선택</h2>
          <div className="flex gap-1">
            <button onClick={() => setViewMode('table')} className={`p-2 rounded ${viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Table2 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('album')} className={`p-2 rounded ${viewMode === 'album' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected heroes summary */}
        {selectedHeroes.length > 0 && (
          <div className="px-5 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{selectedHeroes.length}/{maxMembers}</span>
              {selectedHeroes.map(h => {
                const imgPath = h.type === 'champion' && h.championName
                  ? getChampionImagePath(h.championName)
                  : h.heroClass ? getJobImagePath(h.heroClass) : '';
                return (
                  <div key={h.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/30">
                    {imgPath && <img src={imgPath} alt="" className="w-5 h-5 rounded-full" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    <span className="text-xs font-medium text-foreground">{h.name}</span>
                    <button onClick={() => setLocalIds(prev => { const n = new Set(prev); n.delete(h.id); return n; })} className="text-muted-foreground hover:text-foreground ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-5 pb-2 flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[80px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="hero">영웅</SelectItem>
              <SelectItem value="champion">챔피언</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterClassLine} onValueChange={setFilterClassLine}>
            <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">계열</SelectItem>
              <SelectItem value="전사">전사</SelectItem>
              <SelectItem value="로그">로그</SelectItem>
              <SelectItem value="주문술사">주문술사</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterElement} onValueChange={setFilterElement}>
            <SelectTrigger className="w-[80px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">속성</SelectItem>
              {uniqueElements.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          {uniqueJobs.length > 0 && (
            <Select value={filterJob} onValueChange={setFilterJob}>
              <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">직업</SelectItem>
                {uniqueJobs.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {uniquePositions.length > 0 && (
            <Select value={filterPosition} onValueChange={setFilterPosition}>
              <SelectTrigger className="w-[100px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">포지션</SelectItem>
                {uniquePositions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="w-px h-5 bg-border/50" />
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="heroClass">직업</SelectItem>
              <SelectItem value="name">이름</SelectItem>
              <SelectItem value="level">레벨</SelectItem>
              <SelectItem value="power">전투력</SelectItem>
              <SelectItem value="atk">공격력</SelectItem>
              <SelectItem value="def">방어력</SelectItem>
              <SelectItem value="hp">체력</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="p-1 rounded hover:bg-secondary">
            {sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0 px-5">
          {viewMode === 'table' ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-2 cursor-pointer hover:text-primary" onClick={() => handleSort('name')}>
                    유형 {sortIcon('name')}
                  </th>
                  <th className="text-left py-2 px-2 cursor-pointer hover:text-primary" onClick={() => handleSort('name')}>
                    이름 {sortIcon('name')}
                  </th>
                  <th className="text-left py-2 px-2 cursor-pointer hover:text-primary" onClick={() => handleSort('heroClass')}>
                    직업 {sortIcon('heroClass')}
                  </th>
                  <th className="text-right py-2 px-2 cursor-pointer hover:text-primary" onClick={() => handleSort('level')}>
                    Lv {sortIcon('level')}
                  </th>
                  <th className="text-right py-2 px-2 cursor-pointer hover:text-primary" onClick={() => handleSort('power')}>
                    전투력 {sortIcon('power')}
                  </th>
                  <th className="text-right py-2 px-2 cursor-pointer hover:text-primary" onClick={() => handleSort('atk')}>
                    공격력 {sortIcon('atk')}
                  </th>
                  <th className="text-right py-2 px-2 cursor-pointer hover:text-primary" onClick={() => handleSort('def')}>
                    방어력 {sortIcon('def')}
                  </th>
                  <th className="text-right py-2 px-2 cursor-pointer hover:text-primary" onClick={() => handleSort('hp')}>
                    체력 {sortIcon('hp')}
                  </th>
                  <th className="text-right py-2 px-2">치확</th>
                  <th className="text-right py-2 px-2">치댐</th>
                  <th className="text-right py-2 px-2">회피</th>
                  <th className="text-left py-2 px-2">포지션</th>
                  <th className="text-left py-2 px-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(hero => {
                  const isSelected = localIds.has(hero.id);
                  const disabled = isFull && !isSelected;
                  const belowMin = hero.power > 0 && hero.power < minPower;
                  const imgPath = hero.type === 'champion' && hero.championName
                    ? getChampionImagePath(hero.championName)
                    : hero.heroClass ? getJobImagePath(hero.heroClass) : '';
                  // Calculate actual crit damage
                  const critDmgDisplay = hero.critDmg > 0 ? Math.round(hero.atk * hero.critDmg / 100) : 0;
                  return (
                    <tr key={hero.id}
                      onClick={() => !disabled && handleToggle(hero.id)}
                      className={`border-b border-border/30 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10' : disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-secondary/30'
                      }`}>
                      <td className="py-1.5 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${hero.type === 'champion' ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}`}>
                          {hero.type === 'champion' ? '챔피언' : '영웅'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          {imgPath && <img src={imgPath} alt="" className="w-5 h-5 rounded-full" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                          {belowMin && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                          {hero.name}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground">{hero.heroClass || hero.championName || '-'}</td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground">{hero.level}</td>
                      <td className={`py-1.5 px-2 text-right font-mono ${belowMin ? 'text-red-400' : 'text-yellow-400'}`}>
                        {hero.power > 0 ? formatNumber(hero.power) : '-'}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-red-400">{formatNumber(hero.atk)}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-blue-400">{formatNumber(hero.def)}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-orange-400">{formatNumber(hero.hp)}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-foreground/70">{hero.crit > 0 ? `${formatNumber(hero.crit)}%` : '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-foreground/70">{critDmgDisplay > 0 ? formatNumber(critDmgDisplay) : '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-foreground/70">{hero.evasion > 0 ? `${formatNumber(hero.evasion)}%` : '-'}</td>
                      <td className="py-1.5 px-2 text-foreground/70 text-[10px]">{hero.position || '-'}</td>
                      <td className="py-1.5 px-2 text-foreground/70 text-[10px]">{hero.label || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* Album view - matching HeroList album style */
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 py-1">
              {filtered.map(hero => {
                const isSelected = localIds.has(hero.id);
                const disabled = isFull && !isSelected;
                const belowMin = hero.power > 0 && hero.power < minPower;
                const borderClass = hero.classLine ? CLASS_LINE_BORDER[hero.classLine] || 'border-border' : 'border-purple-500/50';
                const illustPath = hero.type === 'champion' && hero.championName
                  ? getChampionImagePath(hero.championName)
                  : hero.heroClass ? getJobIllustPath(hero.heroClass) : '';

                return (
                  <button key={hero.id}
                    onClick={() => !disabled && handleToggle(hero.id)}
                    disabled={disabled}
                    className={`card-fantasy p-2 border-2 rounded-xl ${borderClass} flex flex-col items-center gap-1 transition-all ${
                      isSelected ? 'ring-2 ring-primary bg-primary/10' : disabled ? 'opacity-30' : 'hover:scale-[1.02] hover:bg-secondary/30'
                    }`}>
                    {belowMin && <div className="w-2 h-2 rounded-full bg-red-500 mx-auto" />}
                    <div className="w-full rounded-lg bg-secondary/20 py-1">
                      <div className="w-full aspect-square flex items-center justify-center overflow-hidden">
                        {illustPath ? (
                          <img src={illustPath} alt={hero.name} className="w-full h-full object-cover"
                            onError={e => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <span className="text-muted-foreground text-xs">{hero.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-center w-full">
                      <p className="text-xs font-bold text-foreground truncate">{hero.name}</p>
                      <p className="text-[10px] text-foreground/60 truncate">
                        {hero.heroClass || hero.championName || ''} {hero.level > 0 && `Lv.${hero.level}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <ElementIcon element={hero.element} size={14} />
                      <span className={`text-[10px] tabular-nums ${!hero.elementValue ? 'text-foreground/20' : 'text-foreground'}`}>
                        {hero.elementValue || 0}
                      </span>
                    </div>
                    {hero.power > 0 && (
                      <span className={`text-[10px] font-mono ${belowMin ? 'text-red-400' : 'text-yellow-400'}`}>
                        {formatNumber(hero.power)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer: Cancel / Confirm */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={handleCancel}>취소</Button>
          <Button size="sm" onClick={handleConfirm}>확인 ({localIds.size}/{maxMembers})</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
