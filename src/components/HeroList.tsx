import { useState, useMemo } from 'react';
import { Hero, HERO_STAT_COLUMNS, CHAMPION_STAT_COLUMNS, STAT_ICON_MAP, ELEMENT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { HERO_CLASS_MAP } from '@/lib/gameData';
import { getHeroes, saveHeroes, deleteHero } from '@/lib/storage';
import { getJobImagePath, getJobIllustPath, getChampionImagePath, getSkillImagePath, CHAMPION_NAME_MAP, JOB_NAME_MAP } from '@/lib/nameMap';
import HeroForm from './HeroForm';
import ChampionForm from './ChampionForm';
import ElementIcon from './ElementIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, Shield, Crown, LayoutGrid, Table2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'album';
type ListTab = 'hero' | 'champion';

const CLASS_LINE_COLORS: Record<string, string> = {
  '전사': 'text-red-400',
  '로그': 'text-lime-400',
  '주문술사': 'text-sky-400',
};

const CLASS_LINE_BORDER: Record<string, string> = {
  '전사': 'border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.3)]',
  '로그': 'border-lime-500/60 shadow-[0_0_12px_rgba(132,204,22,0.3)]',
  '주문술사': 'border-sky-500/60 shadow-[0_0_12px_rgba(56,189,248,0.3)]',
};

// Job order for custom sorting (index in HERO_CLASS_MAP arrays)
const JOB_ORDER: Record<string, number> = {};
let orderIdx = 0;
for (const [classLine, jobs] of Object.entries(HERO_CLASS_MAP)) {
  for (const job of jobs) {
    JOB_ORDER[job] = orderIdx++;
  }
}

const CLASS_LINE_ORDER: Record<string, number> = { '전사': 0, '로그': 1, '주문술사': 2 };

// Promoted jobs (even index = base, odd index = promoted in JOB_PAIRS)
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

const formatValue = (key: string, value: any): string | null => {
  if (value === undefined || value === null || value === '') return '-';
  if (key === 'crit' || key === 'evasion') return `${formatNumber(value)} %`;
  if (key === 'critDmg') return `${formatNumber(value)} %`;
  if (typeof value === 'number') return formatNumber(value);
  return null;
};

const SEED_ICONS = [
  { key: 'hp', icon: '/images/special/hp_seed.png', label: 'HP' },
  { key: 'atk', icon: '/images/special/atk_seed.png', label: 'ATK' },
  { key: 'def', icon: '/images/special/def_seed.png', label: 'DEF' },
];

export default function HeroList() {
  const [heroes, setHeroes] = useState<Hero[]>(getHeroes());
  const [editing, setEditing] = useState<Hero | null>(null);
  const [addingType, setAddingType] = useState<'hero' | 'champion' | null>(null);
  const [sortKey, setSortKey] = useState<string>('heroClass');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(HERO_STAT_COLUMNS.map(c => c.key))
  );
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [listTab, setListTab] = useState<ListTab>('hero');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Hero | null>(null);

  const heroList = useMemo(() => heroes.filter(h => h.type === 'hero'), [heroes]);
  const championList = useMemo(() => heroes.filter(h => h.type === 'champion'), [heroes]);
  const activeList = listTab === 'hero' ? heroList : championList;
  const activeColumns: { key: string; label: string; icon?: boolean }[] = listTab === 'hero' ? [...HERO_STAT_COLUMNS] : [...CHAMPION_STAT_COLUMNS];

  const filtered = useMemo(() => {
    let list = [...activeList];

    if (sortKey === 'heroClass' || sortKey === 'classLine') {
      list.sort((a, b) => {
        const aKey = getJobSortKey(a);
        const bKey = getJobSortKey(b);
        return sortDir === 'asc' ? aKey - bKey : bKey - aKey;
      });
    } else if (sortKey === 'element') {
      list.sort((a, b) => {
        const elemCompare = sortDir === 'asc'
          ? String(a.element).localeCompare(String(b.element))
          : String(b.element).localeCompare(String(a.element));
        if (elemCompare !== 0) return elemCompare;
        return sortDir === 'asc'
          ? (b.elementValue || 0) - (a.elementValue || 0)
          : (a.elementValue || 0) - (b.elementValue || 0);
      });
    } else {
      list.sort((a, b) => {
        const av = a[sortKey as keyof Hero];
        const bv = b[sortKey as keyof Hero];
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        return sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return list;
  }, [activeList, sortKey, sortDir]);

  const handleSort = (key: string) => {
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

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteHero(deleteTarget.id);
    setHeroes(prev => prev.filter(h => h.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const toggleCol = (key: string) => {
    // Seeds toggle as group
    if (key === 'seeds') {
      setVisibleCols(prev => {
        const next = new Set(prev);
        if (next.has('seeds')) next.delete('seeds'); else next.add('seeds');
        return next;
      });
      return;
    }
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

  const activeCols = activeColumns.filter(c => visibleCols.has(c.key));

  const renderHeaderLabel = (col: { key: string; label: string; icon?: boolean }) => {
    const iconPath = STAT_ICON_MAP[col.key as keyof typeof STAT_ICON_MAP];
    if (iconPath) {
      return <img src={iconPath} alt={col.label} title={col.label} width={20} height={20} className="inline-block" />;
    }
    return <span>{col.label}</span>;
  };

  const renderCell = (hero: Hero, colKey: string) => {
    if (colKey === 'name') {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === hero.id ? null : hero.id); }}
          className="font-medium text-foreground hover:text-primary transition-colors text-center w-full"
        >
          {hero.name}
        </button>
      );
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
      return (
        <span className="inline-flex items-center gap-1">
          <img src={getJobImagePath(hero.heroClass)} alt="" className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <span>{hero.heroClass}</span>
        </span>
      );
    }
    if (colKey === 'championName') {
      if (!hero.championName) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="inline-flex items-center gap-1">
          <img src={getChampionImagePath(hero.championName)} alt="" className="w-5 h-5 rounded-full" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <span>{hero.championName}</span>
        </span>
      );
    }
    if (colKey === 'element') {
      return (
        <span className="inline-flex items-center gap-1">
          <ElementIcon element={hero.element} size={20} />
          <span className="text-xs text-foreground tabular-nums">{formatNumber(hero.elementValue || 0)}</span>
        </span>
      );
    }
    if (colKey === 'skills') {
      if (!hero.skills || hero.skills.length === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex items-center gap-0.5 justify-center">
          {hero.skills.slice(0, 5).map((sk, i) => (
            <img key={i} src={getSkillImagePath(sk)} alt={sk} className="w-5 h-5" title={sk}
              onError={e => { e.currentTarget.style.display = 'none'; }} />
          ))}
        </div>
      );
    }
    if (colKey === 'critAttack') {
      const val = hero.atk && hero.critDmg ? Math.floor(hero.atk * hero.critDmg / 100) : 0;
      return <span>{val ? formatNumber(val) : '-'}</span>;
    }
    if (colKey === 'seeds') {
      if (!hero.seeds) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex items-center gap-1 justify-center">
          {SEED_ICONS.map(s => (
            <span key={s.key} className="inline-flex items-center gap-0.5">
              <img src={s.icon} alt="" className="w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />
              <span className="text-xs tabular-nums">{hero.seeds?.[s.key as keyof typeof hero.seeds] || 0}</span>
            </span>
          ))}
        </div>
      );
    }
    if (colKey === 'position') {
      return <span>{hero.position || '-'}</span>;
    }
    if (colKey === 'airshipPower') {
      return <span>-</span>;
    }

    const value = hero[colKey as keyof Hero];
    const formatted = formatValue(colKey, value);
    if (formatted !== null) return <span>{formatted}</span>;
    return <span>{String(value ?? '-')}</span>;
  };

  const renderExpandedRow = (hero: Hero) => (
    <tr className="bg-secondary/20">
      <td colSpan={activeCols.length + 1} className="px-4 py-4">
        <div className="flex gap-6">
          {/* Stats */}
          <div className="card-fantasy p-3 min-w-[180px]">
            <h4 className="text-xs font-semibold text-primary mb-2">스탯</h4>
            <div className="space-y-1 text-xs">
              {[
                { label: '전투력', value: hero.power, icon: STAT_ICON_MAP.power },
                { label: 'HP', value: hero.hp, icon: STAT_ICON_MAP.hp },
                { label: 'ATK', value: hero.atk, icon: STAT_ICON_MAP.atk },
                { label: 'DEF', value: hero.def, icon: STAT_ICON_MAP.def },
                { label: 'CRIT%', value: hero.crit, icon: STAT_ICON_MAP.crit, suffix: ' %' },
                { label: 'CRIT.D%', value: hero.critDmg, icon: STAT_ICON_MAP.critDmg, suffix: ' %' },
                { label: 'EVA%', value: hero.evasion, icon: STAT_ICON_MAP.evasion, suffix: ' %' },
                { label: 'THREAT', value: hero.threat, icon: STAT_ICON_MAP.threat },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <img src={s.icon} alt="" className="w-4 h-4" />
                  <span className="text-foreground tabular-nums">{s.value ? `${formatNumber(s.value)}${s.suffix || ''}` : '-'}</span>
                </div>
              ))}
            </div>
            {hero.seeds && (
              <div className="mt-2 pt-2 border-t border-border/30">
                <h4 className="text-xs font-semibold text-primary mb-1">씨앗</h4>
                <div className="flex gap-2">
                  {SEED_ICONS.map(s => (
                    <span key={s.key} className="inline-flex items-center gap-0.5">
                      <img src={s.icon} alt="" className="w-4 h-4" />
                      <span className="text-xs tabular-nums">{hero.seeds?.[s.key as keyof typeof hero.seeds] || 0}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Skills */}
          <div className="card-fantasy p-3 min-w-[280px]">
            <h4 className="text-xs font-semibold text-primary mb-2">스킬셋</h4>
            <div className="space-y-1.5">
              {hero.skills?.map((sk, i) => (
                <div key={i} className="flex items-center gap-2">
                  <img src={getSkillImagePath(sk)} alt="" className="w-7 h-7" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  <span className="text-xs text-foreground">{sk}</span>
                  {i === 0 && <span className="text-[9px] bg-purple-700/60 text-foreground px-1 py-0.5 rounded">고유</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Equipment placeholder */}
          <div className="card-fantasy p-3 flex-1">
            <h4 className="text-xs font-semibold text-primary mb-2">장비</h4>
            <p className="text-xs text-muted-foreground">장비 데이터는 영웅 수정에서 확인하세요.</p>
          </div>
        </div>
      </td>
    </tr>
  );

  // Album card view
  const renderAlbumCard = (hero: Hero) => {
    const borderClass = hero.classLine ? CLASS_LINE_BORDER[hero.classLine] || 'border-border' : 'border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.3)]';
    const illustPath = hero.type === 'champion' && hero.championName
      ? getChampionImagePath(hero.championName)
      : hero.heroClass ? getJobIllustPath(hero.heroClass) : '';

    return (
      <div
        key={hero.id}
        className={`card-fantasy p-3 border-2 rounded-xl ${borderClass} flex flex-col items-center gap-2 cursor-pointer hover:scale-[1.02] transition-all`}
        onClick={() => setEditing(hero)}
      >
        {/* Main image */}
        <div className="w-full aspect-[3/4] flex items-center justify-center overflow-hidden rounded-lg bg-secondary/20">
          {illustPath ? (
            <img src={illustPath} alt={hero.name} className="w-full h-full object-contain"
              onError={e => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <span className="text-muted-foreground text-sm">{hero.name}</span>
          )}
        </div>

        {/* Name + Level */}
        <div className="text-center w-full">
          <p className="text-sm font-bold text-foreground truncate">{hero.name}</p>
          <p className="text-xs text-muted-foreground">Lv.{hero.level}</p>
        </div>

        {/* Element */}
        <div className="flex items-center gap-1">
          <ElementIcon element={hero.element} size={16} />
          <span className="text-xs text-foreground tabular-nums">{hero.elementValue || 0}</span>
        </div>

        {/* Skills */}
        {hero.skills && hero.skills.length > 0 && (
          <div className="flex items-center gap-0.5 flex-wrap justify-center">
            {hero.skills.slice(0, 5).map((sk, i) => (
              <img key={i} src={getSkillImagePath(sk)} alt={sk} className="w-5 h-5" title={sk}
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-auto">
          <button onClick={(e) => { e.stopPropagation(); setEditing(hero); }} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(hero); }} className="p-1 rounded hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Tab: Hero / Champion + View mode */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <button
            onClick={() => setListTab('hero')}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
              listTab === 'hero' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-1" />영웅 목록 ({heroList.length})
          </button>
          <button
            onClick={() => setListTab('champion')}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
              listTab === 'champion' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Crown className="w-4 h-4 inline mr-1" />챔피언 목록 ({championList.length})
          </button>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setViewMode('table')} className={`p-2 rounded ${viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Table2 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('album')} className={`p-2 rounded ${viewMode === 'album' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Column visibility */}
      <div className="card-fantasy p-3 mb-3">
        <div className="flex flex-wrap gap-3">
          <span className="text-sm text-muted-foreground">표시 항목:</span>
          {activeColumns.map(col => (
            <label key={col.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Checkbox checked={visibleCols.has(col.key)} onCheckedChange={() => toggleCol(col.key)} />
              {col.label}
            </label>
          ))}
        </div>
      </div>

      {/* Album View */}
      {viewMode === 'album' ? (
        <div className="grid grid-cols-6 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-6 text-center py-12 text-muted-foreground">
              {listTab === 'hero' ? '영웅을 추가해주세요' : '챔피언을 추가해주세요'}
            </div>
          ) : (
            filtered.map(hero => renderAlbumCard(hero))
          )}
        </div>
      ) : (
        /* Table View */
        <div className="card-fantasy overflow-x-auto scrollbar-fantasy">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {activeCols.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    className={`px-3 py-3 font-medium cursor-pointer hover:text-primary transition-colors select-none text-muted-foreground text-center ${
                      col.key === 'name' ? 'min-w-[100px]' : ''
                    } ${col.key === 'heroClass' || col.key === 'championName' ? 'min-w-[100px]' : ''} ${col.key === 'skills' ? 'min-w-[120px]' : ''} ${col.key === 'seeds' ? 'min-w-[120px]' : ''}`}>
                    <span className="flex items-center gap-1 justify-center">
                      {renderHeaderLabel(col)}
                      {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-muted-foreground font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={activeCols.length + 1} className="text-center py-12 text-muted-foreground">
                  {listTab === 'hero' ? '영웅을 추가해주세요' : '챔피언을 추가해주세요'}
                </td></tr>
              )}
              {filtered.map(hero => (
                <>
                  <tr key={hero.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${expandedId === hero.id ? 'bg-secondary/20' : ''}`}>
                    {activeCols.map(col => (
                      <td key={col.key} className="px-3 py-3 text-center">
                        {renderCell(hero, col.key)}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditing(hero)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(hero)} className="p-1.5 rounded hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === hero.id && renderExpandedRow(hero)}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}"을(를) 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/80">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
