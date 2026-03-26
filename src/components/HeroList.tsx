import { useState, useEffect, useMemo, Fragment, useRef, useCallback } from 'react';
import { Hero, HERO_STAT_COLUMNS, CHAMPION_STAT_COLUMNS, STAT_ICON_MAP, ELEMENT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { HERO_CLASS_MAP, getCommonSkills, getUniqueSkills, getChampionSkillsData } from '@/lib/gameData';
import { getHeroes, saveHeroes, deleteHero } from '@/lib/storage';
import { getJobImagePath, getJobIllustPath, getChampionImagePath, CHAMPION_NAME_MAP, JOB_NAME_MAP, SPIRIT_NAME_MAP } from '@/lib/nameMap';
import { getSkillImagePath, getUniqueSkillImagePath, setSkillGradeCache } from '@/lib/skillUtils';
import { getAurasongSkillIconPath, getLeaderSkillTierName, getAurasongSkillEffect, ensureAurasongDataLoaded } from '@/lib/championEquipUtils';
import HeroForm from './HeroForm';
import ChampionForm from './ChampionForm';
import ListSummary from './ListSummary';
import ElementIcon from './ElementIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, Shield, Crown, LayoutGrid, Table2, Filter, ArrowUpDown, CircleHelp, Copy, RefreshCw, Award, Download, Upload, Camera, BarChart3 } from 'lucide-react';
import html2canvas from 'html2canvas';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

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

// Inline style colors for reliable border rendering
const CLASS_LINE_BORDER_COLOR: Record<string, string> = {
  '전사': '#ef4444',
  '로그': '#84cc16',
  '주문술사': '#38bdf8',
};
const CLASS_LINE_SHADOW_STYLE: Record<string, string> = {
  '전사': '0 0 12px rgba(239,68,68,0.3)',
  '로그': '0 0 12px rgba(132,204,22,0.3)',
  '주문술사': '0 0 12px rgba(56,189,248,0.3)',
};

const JOB_ORDER: Record<string, number> = {};
let orderIdx = 0;
for (const [, jobs] of Object.entries(HERO_CLASS_MAP)) {
  for (const job of jobs) {
    JOB_ORDER[job] = orderIdx++;
  }
}

const CLASS_LINE_ORDER: Record<string, number> = { '전사': 0, '로그': 1, '주문술사': 2 };

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
  if (key === 'critDmg') return `x${(Number(value) / 100).toFixed(1)}`;
  if (typeof value === 'number') return formatNumber(value);
  return null;
};

const SEED_ICONS = [
  { key: 'hp', icon: '/images/special/hp_seed.webp', label: 'HP' },
  { key: 'atk', icon: '/images/special/atk_seed.webp', label: 'ATK' },
  { key: 'def', icon: '/images/special/def_seed.webp', label: 'DEF' },
];

const ELEMENT_ENG_MAP: Record<string, string> = {
  '불': 'fire', '물': 'water', '공기': 'air', '대지': 'earth', '빛': 'light', '어둠': 'dark',
};

const QUALITY_BORDER: Record<string, string> = {
  common: 'border-gray-300/60',
  uncommon: 'border-green-400/70',
  flawless: 'border-cyan-300/80',
  epic: 'border-fuchsia-400/90',
  legendary: 'border-yellow-400',
};
const QUALITY_RADIAL_COLOR: Record<string, string> = {
  common: 'rgba(220,220,220,0.32)',
  uncommon: 'rgba(74,222,128,0.38)',
  flawless: 'rgba(103,232,249,0.45)',
  epic: 'rgba(217,70,239,0.5)',
  legendary: 'rgba(250,204,21,0.55)',
};
const QUALITY_SHADOW_COLOR: Record<string, string> = {
  common: '0 0 4px rgba(220,220,220,0.4)',
  uncommon: '0 0 5px rgba(74,222,128,0.5)',
  flawless: '0 0 6px rgba(103,232,249,0.5)',
  epic: '0 0 7px rgba(217,70,239,0.6)',
  legendary: '0 0 8px rgba(250,204,21,0.7)',
};

function normalizeJobName(name: string): string {
  return name.replace(/\s+/g, '').trim();
}

function findUniqueSkillByJob(allUnique: Record<string, any>, jobName: string) {
  const normalizedJobName = normalizeJobName(jobName);
  return (
    allUnique[jobName] ??
    allUnique[normalizedJobName] ??
    Object.entries(allUnique).find(([key]) => normalizeJobName(key) === normalizedJobName)?.[1] ??
    null
  );
}

// Default hidden columns
const DEFAULT_HIDDEN_COLS = ['classLine', 'threat', 'seeds', 'airshipPower', 'type', 'critDmg'];

export default function HeroList() {
  const [heroes, setHeroes] = useState<Hero[]>(getHeroes());
  const [editing, setEditing] = useState<Hero | null>(null);
  const [addingType, setAddingType] = useState<'hero' | 'champion' | null>(null);
  const [sortKey, setSortKey] = useState<string>('heroClass');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    const allCols = [...HERO_STAT_COLUMNS, ...CHAMPION_STAT_COLUMNS];
    const all = new Set<string>(allCols.map(c => c.key));
    DEFAULT_HIDDEN_COLS.forEach(k => all.delete(k));
    return all;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [listTab, setListTab] = useState<ListTab>('hero');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Hero | null>(null);
  const [commonSkillsData, setCommonSkillsData] = useState<Record<string, any>>({});
  const [uniqueSkillsData, setUniqueSkillsData] = useState<Record<string, any>>({});
  const [championSkillsData, setChampionSkillsData] = useState<Record<string, any>>({});
  // Bulk delete management mode
  const [manageMode, setManageMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [saveLoadOpen, setSaveLoadOpen] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importPreview, setImportPreview] = useState<Hero[] | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const albumContentRef = useRef<HTMLDivElement>(null);
  const [screenshotDialogOpen, setScreenshotDialogOpen] = useState(false);
  const [screenshotCols, setScreenshotCols] = useState<Set<string>>(new Set());

  // Album filters/sort
  const [albumSortKey, setAlbumSortKey] = useState<string>('heroClass');
  const [albumSortDir, setAlbumSortDir] = useState<SortDir>('asc');
  const [albumFilterClassLine, setAlbumFilterClassLine] = useState<string>('all');
  const [albumFilterElement, setAlbumFilterElement] = useState<string>('all');
  const [albumFilterJob, setAlbumFilterJob] = useState<string>('all');

  useEffect(() => {
    getCommonSkills().then(data => {
      setCommonSkillsData(data);
      setSkillGradeCache(data);
    });
    getUniqueSkills().then(setUniqueSkillsData);
    getChampionSkillsData().then(setChampionSkillsData);
    ensureAurasongDataLoaded();
  }, []);

  // Scroll to expanded row
  useEffect(() => {
    if (expandedId) {
      setTimeout(() => {
        const el = document.getElementById(`expanded-${expandedId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [expandedId]);

  // Album screenshot handler
  const handleAlbumScreenshot = useCallback(async () => {
    if (!albumContentRef.current) return;
    try {
      const canvas = await html2canvas(albumContentRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `album_${listTab}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Screenshot failed:', e);
    }
  }, [listTab]);

  // Helper to get plain text for screenshot cells
  const getScreenshotCellText = useCallback((hero: Hero, colKey: string): string => {
    if (colKey === 'name') return hero.name;
    if (colKey === 'heroClass') return hero.heroClass || '-';
    if (colKey === 'championName') return hero.championName || '-';
    if (colKey === 'classLine') return hero.classLine || '-';
    if (colKey === 'level') return String(hero.level || 0);
    if (colKey === 'rank') {
      const r = hero.rank || 1;
      return r <= 11 ? String(r) : `${r} (11+${r - 11})`;
    }
    if (colKey === 'element') return `${hero.element || '-'} ${hero.elementValue || 0}`;
    if (colKey === 'position') return hero.position || '-';
    if (colKey === 'label') return (hero as any).label || '-';
    if (colKey === 'type') return hero.type === 'champion' ? '챔피언' : '영웅';
    if (colKey === 'promoted') return hero.promoted ? '○' : '-';
    if (colKey === 'crit') return hero.crit ? `${formatNumber(hero.crit)} %` : '0';
    if (colKey === 'critDmg') return hero.critDmg ? `x${(hero.critDmg / 100).toFixed(1)}` : '-';
    if (colKey === 'critAttack') {
      const val = hero.atk && hero.critDmg ? Math.floor(hero.atk * hero.critDmg / 100) : 0;
      return val ? formatNumber(val) : '0';
    }
    if (colKey === 'evasion') return hero.evasion ? `${formatNumber(hero.evasion)} %` : '0';
    if (colKey === 'threat') return hero.threat ? formatNumber(hero.threat) : '0';
    if (colKey === 'skills') return '-';
    if (colKey === 'equipment') return '-';
    if (colKey === 'seeds') {
      if (!hero.seeds) return '-';
      return `${hero.seeds.hp || 0}/${hero.seeds.atk || 0}/${hero.seeds.def || 0}`;
    }
    if (colKey === 'airshipPower') return '-';
    const value = hero[colKey as keyof Hero];
    if (typeof value === 'number') return formatNumber(value);
    return String(value ?? '-');
  }, []);




  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl text-primary font-bold">영웅 &amp; 챔피언 리스트</h2>
        <div className="flex gap-2">
          <Button onClick={() => setAddingType('hero')} className="gap-2 text-sm font-medium">
            <Shield className="w-4 h-4" /> 새 영웅 추가
          </Button>
          <Button onClick={() => setAddingType('champion')} variant="secondary" className="gap-2 text-sm font-medium">
            <Crown className="w-4 h-4" /> 새 챔피언 추가
          </Button>
        </div>
      </div>

      {/* Tab: Hero / Champion / Summary + View mode */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <button
            onClick={() => { setListTab('hero'); setSummaryOpen(false); }}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
              listTab === 'hero' && !summaryOpen ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-1" />영웅 목록 ({heroList.length})
          </button>
          <button
            onClick={() => { setListTab('champion'); setSummaryOpen(false); }}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
              listTab === 'champion' && !summaryOpen ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Crown className="w-4 h-4 inline mr-1" />챔피언 목록 ({championList.length})
          </button>
          <button
            onClick={() => setSummaryOpen(true)}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
              summaryOpen ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1" />리스트 요약
          </button>
        </div>
        {!summaryOpen && (
          <div className="flex items-center gap-2">
            <Button onClick={handleExport} variant="outline" size="sm" className="gap-1 text-xs h-8 px-2" title="리스트 내보내기">
              <Download className="w-3.5 h-3.5" />
            </Button>
            <label className="inline-flex">
              <input type="file" accept=".json" className="hidden" onChange={handleImportFile} />
              <Button asChild variant="outline" size="sm" className="gap-1 text-xs h-8 px-2 cursor-pointer" title="리스트 불러오기">
                <span><Upload className="w-3.5 h-3.5" /></span>
              </Button>
            </label>
            <Button onClick={() => {
              if (viewMode === 'table') {
                setScreenshotCols(new Set(visibleCols));
                setScreenshotDialogOpen(true);
              } else {
                handleAlbumScreenshot();
              }
            }} variant="outline" size="sm" className="gap-1 text-xs h-8 px-2" title="스크린샷 저장">
              <Camera className="w-3.5 h-3.5" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={() => setViewMode('table')} className={`p-2 rounded ${viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Table2 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('album')} className={`p-2 rounded ${viewMode === 'album' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {summaryOpen ? (
        <div ref={listRef}>
          <ListSummary heroes={heroes} />
        </div>
      ) : viewMode === 'table' ? (
        <div ref={listRef}>
          {/* Column visibility - table only */}
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

          {/* Table View */}
          <div className="card-fantasy overflow-x-auto scrollbar-fantasy">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {activeCols.map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      className={`px-3 py-3 font-medium cursor-pointer hover:text-primary transition-colors select-none text-muted-foreground text-center ${
                        col.key === 'heroClass' || col.key === 'name' ? 'min-w-[110px]' : ''
                      } ${col.key === 'championName' ? 'min-w-[100px]' : ''} ${col.key === 'skills' ? (listTab === 'champion' ? 'min-w-[100px]' : 'min-w-[170px]') : ''} ${col.key === 'equipment' ? 'min-w-[80px]' : ''} ${col.key === 'seeds' ? 'min-w-[120px]' : ''} ${(col.key === 'position' || col.key === 'label') ? 'min-w-[90px]' : ''}`}>
                      <span className="flex items-center gap-1 justify-center">
                        {renderHeaderLabel(col)}
                        {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-muted-foreground font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          if (manageMode) {
                            if (selectedForDelete.size > 0) {
                              setBulkDeleteConfirm(true);
                            } else {
                              setManageMode(false);
                            }
                          } else {
                            setManageMode(true);
                            setSelectedForDelete(new Set());
                          }
                        }}
                        className={`text-sm font-medium transition-colors ${manageMode ? 'text-yellow-400' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        관리
                      </button>
                      {manageMode && (
                        <button
                          onClick={() => setResetConfirm(true)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors"
                          title="리스트 초기화"
                        >
                          <RefreshCw className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={activeCols.length + 1} className="text-center py-12 text-muted-foreground">
                    {listTab === 'hero' ? '영웅을 추가해주세요' : '챔피언을 추가해주세요'}
                  </td></tr>
                )}
                {filtered.map(hero => {
                  const isExpanded = expandedId === hero.id;
                  const isSelectedForDel = selectedForDelete.has(hero.id);
                  return (
                    <Fragment key={hero.id}>
                      <tr
                        onClick={() => setExpandedId(expandedId === hero.id ? null : hero.id)}
                        className={`border-b border-border/50 transition-colors cursor-pointer select-none ${
                          isExpanded ? 'bg-primary/15' : 'hover:bg-secondary/20'
                        }`}
                        style={{ height: '52px' }}
                      >
                        {activeCols.map(col => {
                          if (isExpanded && !EXPANDED_VISIBLE_KEYS.has(col.key)) {
                            return <td key={col.key} className="px-3 py-3 text-center align-middle" />;
                          }
                          return (
                            <td key={col.key} className="px-3 py-3 text-center align-middle">
                              {renderCell(hero, col.key)}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center align-middle">
                          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                            {manageMode ? (
                              <button
                                onClick={() => toggleSelectForDelete(hero.id)}
                                className={`p-1.5 rounded transition-colors ${isSelectedForDel ? 'text-yellow-400' : 'text-muted-foreground hover:text-destructive'}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <>
                                <button onClick={() => setEditing(hero)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteTarget(hero)} className="p-1.5 rounded hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleCopyHero(hero)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary" title="복사">
                                  <Copy className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && renderExpandedRow(hero)}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Album controls: sort + filter */}
          <div className="card-fantasy p-3 mb-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">정렬:</span>
              <Select value={albumSortKey} onValueChange={setAlbumSortKey}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {listTab === 'hero' ? (
                    <>
                      <SelectItem value="heroClass">직업</SelectItem>
                      <SelectItem value="classLine">계열</SelectItem>
                      <SelectItem value="level">레벨</SelectItem>
                      <SelectItem value="element">속성</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="name">이름</SelectItem>
                      <SelectItem value="element">속성</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <button onClick={() => setAlbumSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="p-1 rounded hover:bg-secondary">
                {albumSortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            <div className="w-px h-6 bg-border/50" />
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">필터:</span>
              {listTab === 'hero' && (
                <Select value={albumFilterClassLine} onValueChange={setAlbumFilterClassLine}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue placeholder="계열" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="전사">전사</SelectItem>
                    <SelectItem value="로그">로그</SelectItem>
                    <SelectItem value="주문술사">주문술사</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={albumFilterElement} onValueChange={setAlbumFilterElement}>
                <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue placeholder="속성" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {uniqueElements.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              {listTab === 'hero' && uniqueJobs.length > 0 && (
                <Select value={albumFilterJob} onValueChange={setAlbumFilterJob}>
                  <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="직업" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {(() => {
                      let lastClassLine = '';
                      return uniqueJobs.map(j => {
                        const cl = CLASS_LINE_FOR_JOB[j] || '';
                        const showSep = cl !== lastClassLine && lastClassLine !== '';
                        lastClassLine = cl;
                        return (
                          <div key={j}>
                            {showSep && <div className="border-t border-border/30 my-1" />}
                            <SelectItem value={j}>{j}</SelectItem>
                          </div>
                        );
                      });
                    })()}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Album Grid */}
          <div ref={albumContentRef} className="grid grid-cols-6 gap-3">
            {albumFiltered.length === 0 ? (
              <div className="col-span-6 text-center py-12 text-muted-foreground">
                {listTab === 'hero' ? '영웅을 추가해주세요' : '챔피언을 추가해주세요'}
              </div>
            ) : (
              albumFiltered.map(hero => renderAlbumCard(hero))
            )}
          </div>
        </>
      )}

      {/* Screenshot settings dialog */}
      <AlertDialog open={screenshotDialogOpen} onOpenChange={setScreenshotDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>스크린샷 설정</AlertDialogTitle>
            <AlertDialogDescription>
              저장할 항목을 선택하세요. 선택한 항목에 맞게 이미지가 생성됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <div className="flex flex-wrap gap-3">
              {activeColumns.filter(c => c.key !== 'skills' && c.key !== 'equipment').map(col => (
                <label key={col.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={screenshotCols.has(col.key)}
                    onCheckedChange={() => {
                      setScreenshotCols(prev => {
                        const next = new Set(prev);
                        if (next.has(col.key)) next.delete(col.key);
                        else next.add(col.key);
                        return next;
                      });
                    }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  const all = new Set(activeColumns.filter(c => c.key !== 'skills' && c.key !== 'equipment').map(c => c.key));
                  setScreenshotCols(all);
                }}
                className="text-xs text-primary hover:underline"
              >
                전체 선택
              </button>
              <button
                onClick={() => setScreenshotCols(new Set())}
                className="text-xs text-muted-foreground hover:underline"
              >
                전체 해제
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleTableScreenshot} disabled={screenshotCols.size === 0}>
              <Camera className="w-4 h-4 mr-1" />
              저장
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import confirmation dialog */}
      <AlertDialog open={!!importPreview && saveLoadOpen} onOpenChange={v => { if (!v) { setImportPreview(null); setSaveLoadOpen(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>데이터 불러오기</AlertDialogTitle>
            <AlertDialogDescription>
              {importPreview?.length || 0}개의 항목이 포함된 파일입니다.
              (영웅 {importPreview?.filter(h => h.type === 'hero').length || 0}명, 챔피언 {importPreview?.filter(h => h.type === 'champion').length || 0}명)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-border hover:bg-secondary/20">
              <input type="radio" name="importMode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
              <div>
                <span className="text-sm font-medium text-foreground">덮어쓰기</span>
                <p className="text-xs text-muted-foreground">기존 리스트를 삭제하고 파일 데이터로 교체합니다</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-border hover:bg-secondary/20">
              <input type="radio" name="importMode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
              <div>
                <span className="text-sm font-medium text-foreground">합치기</span>
                <p className="text-xs text-muted-foreground">기존 리스트에 파일 데이터를 추가합니다</p>
              </div>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setImportPreview(null); setSaveLoadOpen(false); }}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportConfirm}>
              적용
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={v => !v && setBulkDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>일괄 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedForDelete.size}개 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/80">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset list confirmation dialog */}
      <AlertDialog open={resetConfirm} onOpenChange={v => !v && setResetConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>리스트 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              {listTab === 'hero' ? '영웅' : '챔피언'} 목록을 전부 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetList} className="bg-destructive text-destructive-foreground hover:bg-destructive/80">
              초기화
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
