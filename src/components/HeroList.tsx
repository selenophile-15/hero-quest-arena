import { useState, useEffect, useMemo } from 'react';
import { Hero, HERO_STAT_COLUMNS, CHAMPION_STAT_COLUMNS, STAT_ICON_MAP, ELEMENT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { HERO_CLASS_MAP, getCommonSkills, getUniqueSkills, getChampionSkillsData } from '@/lib/gameData';
import { getHeroes, saveHeroes, deleteHero } from '@/lib/storage';
import { getJobImagePath, getJobIllustPath, getChampionImagePath, CHAMPION_NAME_MAP, JOB_NAME_MAP, SPIRIT_NAME_MAP } from '@/lib/nameMap';
import { getSkillImagePath, getUniqueSkillImagePath, setSkillGradeCache } from '@/lib/skillUtils';
import { getAurasongSkillIconPath, getLeaderSkillTierName, getAurasongSkillEffect } from '@/lib/championEquipUtils';
import HeroForm from './HeroForm';
import ChampionForm from './ChampionForm';
import ElementIcon from './ElementIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, Shield, Crown, LayoutGrid, Table2, Filter, ArrowUpDown, CircleHelp } from 'lucide-react';
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
  if (key === 'critDmg') return `${formatNumber(value)} %`;
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
  common: 'border-gray-300/50',
  uncommon: 'border-green-400/60',
  flawless: 'border-cyan-300/60',
  epic: 'border-fuchsia-400/70',
  legendary: 'border-yellow-400/80',
};
const QUALITY_RADIAL_COLOR: Record<string, string> = {
  common: 'rgba(220,220,220,0.28)',
  uncommon: 'rgba(74,222,128,0.32)',
  flawless: 'rgba(103,232,249,0.38)',
  epic: 'rgba(217,70,239,0.42)',
  legendary: 'rgba(250,204,21,0.5)',
};
const QUALITY_SHADOW_COLOR: Record<string, string> = {
  common: '0 0 10px rgba(220,220,220,0.5)',
  uncommon: '0 0 12px rgba(74,222,128,0.6)',
  flawless: '0 0 14px rgba(103,232,249,0.6)',
  epic: '0 0 16px rgba(217,70,239,0.7)',
  legendary: '0 0 18px rgba(250,204,21,0.8)',
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
  }, []);

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

  // Album filtered list
  const albumFiltered = useMemo(() => {
    let list = [...activeList];
    if (albumFilterClassLine !== 'all') list = list.filter(h => h.classLine === albumFilterClassLine);
    if (albumFilterElement !== 'all') list = list.filter(h => h.element === albumFilterElement);
    if (albumFilterJob !== 'all') list = list.filter(h => h.heroClass === albumFilterJob);

    if (albumSortKey === 'heroClass' || albumSortKey === 'classLine') {
      list.sort((a, b) => {
        const aKey = getJobSortKey(a);
        const bKey = getJobSortKey(b);
        return albumSortDir === 'asc' ? aKey - bKey : bKey - aKey;
      });
    } else if (albumSortKey === 'level') {
      list.sort((a, b) => albumSortDir === 'asc' ? a.level - b.level : b.level - a.level);
    } else if (albumSortKey === 'element') {
      list.sort((a, b) => {
        const c = String(a.element).localeCompare(String(b.element));
        return albumSortDir === 'asc' ? c : -c;
      });
    } else {
      list.sort((a, b) => {
        const av = a[albumSortKey as keyof Hero];
        const bv = b[albumSortKey as keyof Hero];
        if (typeof av === 'number' && typeof bv === 'number') return albumSortDir === 'asc' ? av - bv : bv - av;
        return albumSortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return list;
  }, [activeList, albumSortKey, albumSortDir, albumFilterClassLine, albumFilterElement, albumFilterJob]);

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
    setExpandedId(null);
    setSortKey('heroClass');
    setSortDir('asc');
    setListTab(hero.type === 'champion' ? 'champion' : 'hero');
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteHero(deleteTarget.id);
    setHeroes(prev => prev.filter(h => h.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const toggleCol = (key: string) => {
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

  // Unique elements for album filters - ordered
  const ELEMENT_FILTER_ORDER = ['불', '물', '공기', '대지', '빛', '어둠', '모든 원소'];
  const JOB_FILTER_ORDER = [
    '병사', '용병', '야만전사', '족장', '기사', '군주', '레인저', '관리인', '사무라이', '다이묘', '광전사', '잘', '어둠의 기사', '죽음의 기사',
    '도둑', '사기꾼', '수도승', '그랜드 마스터', '머스킷병', '정복자', '방랑자', '길잡이', '닌자', '센세', '무희', '곡예가', '경보병', '근위병',
    '마법사', '대마법사', '성직자', '비숍', '드루이드', '아크 드루이드', '소서러', '워록', '마법검', '스펠나이트', '풍수사', '아스트라맨서', '크로노맨서', '페이트위버',
  ];
  const CLASS_LINE_FOR_JOB: Record<string, string> = {};
  JOB_FILTER_ORDER.forEach(j => {
    if (JOB_FILTER_ORDER.indexOf(j) < 14) CLASS_LINE_FOR_JOB[j] = '전사';
    else if (JOB_FILTER_ORDER.indexOf(j) < 28) CLASS_LINE_FOR_JOB[j] = '로그';
    else CLASS_LINE_FOR_JOB[j] = '주문술사';
  });
  const uniqueElements = useMemo(() => {
    const set = new Set(activeList.map(h => h.element).filter(Boolean));
    return ELEMENT_FILTER_ORDER.filter(e => set.has(e));
  }, [activeList]);
  const uniqueJobs = useMemo(() => {
    const set = new Set(activeList.map(h => h.heroClass).filter(Boolean));
    return JOB_FILTER_ORDER.filter(j => set.has(j));
  }, [activeList]);

  if (addingType === 'hero' || (editing && editing.type === 'hero')) {
    return <HeroForm hero={editing || undefined} onSave={handleSave} onCancel={() => { setAddingType(null); setEditing(null); setExpandedId(null); setSortKey('heroClass'); setSortDir('asc'); }} />;
  }
  if (addingType === 'champion' || (editing && editing.type === 'champion')) {
    return <ChampionForm hero={editing || undefined} onSave={handleSave} onCancel={() => { setAddingType(null); setEditing(null); setExpandedId(null); setSortKey('heroClass'); setSortDir('asc'); }} />;
  }

  const activeCols = activeColumns.filter(c => visibleCols.has(c.key));

  // Columns to keep visible when expanded
  const EXPANDED_VISIBLE_KEYS = new Set(['heroClass', 'championName', 'name', 'level', 'rank', 'position', 'label', 'promoted']);

  const renderHeaderLabel = (col: { key: string; label: string; icon?: boolean }) => {
    const iconPath = STAT_ICON_MAP[col.key as keyof typeof STAT_ICON_MAP];
    if (iconPath) {
      return <img src={iconPath} alt={col.label} title={col.label} width={20} height={20} className="inline-block" />;
    }
    return <span>{col.label}</span>;
  };

  const renderCell = (hero: Hero, colKey: string) => {
    if (colKey === 'name') {
      const isChamp = hero.type === 'champion';
      return (
        <button
          onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === hero.id ? null : hero.id); }}
          className="font-medium text-foreground hover:text-primary transition-colors text-center w-full inline-flex items-center gap-1 justify-center"
        >
          {isChamp && hero.championName && (
            <img src={getChampionImagePath(hero.championName)} alt="" className="w-5 h-5 rounded-full" onError={e => { e.currentTarget.style.display = 'none'; }} />
          )}
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
          <span className="whitespace-nowrap">{hero.heroClass}</span>
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
    if (colKey === 'rank') {
      const r = hero.rank || 1;
      if (r <= 11) return <span>{r}</span>;
      return <span>{r} (11+{r - 11})</span>;
    }
    if (colKey === 'element') {
      const elVal = hero.elementValue || 0;
      const isDimEl = elVal === 0;
      return (
        <span className="inline-flex items-center gap-1">
          <ElementIcon element={hero.element} size={20} />
          <span className={`text-xs tabular-nums ${isDimEl ? 'text-foreground/20' : 'text-foreground'}`}>{formatNumber(elVal)}</span>
        </span>
      );
    }
    if (colKey === 'skills') {
      if (hero.type === 'champion') {
        const champEng = hero.championName ? (CHAMPION_NAME_MAP[hero.championName] || '') : '';
        let leaderTier = 1;
        const csd = championSkillsData[hero.championName || ''];
        if (csd) {
          for (let t = 4; t >= 1; t--) {
            const td = csd[`${t}티어`];
            if (td && (hero.rank || 1) >= (td['챔피언_랭크'] || 0)) { leaderTier = t; break; }
          }
        }
        const leaderIcon = champEng ? `/images/skills/sk_champion/${champEng}_${leaderTier}.webp` : '';
        const aurasongItem = hero.equipmentSlots?.[1]?.item;
        const auraIcon = aurasongItem ? getAurasongSkillIconPath(aurasongItem.name) : '';
        return (
          <div className="flex items-center gap-0.5 justify-center">
            {leaderIcon && <img src={leaderIcon} alt="리더" className="w-9 h-9" title="리더 스킬" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            {auraIcon && <img src={auraIcon} alt="오라" className="w-9 h-9" title="오라의 노래" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            {!leaderIcon && !auraIcon && <span className="text-muted-foreground">-</span>}
          </div>
        );
      }
      const uniqueImgPath = hero.heroClass ? getUniqueSkillImagePath(hero.heroClass) : '';
      const commonSkills = hero.skills?.slice(1) || [];
      return (
        <div className="flex items-center gap-0.5 justify-center">
          <div className="w-9 h-9 flex-shrink-0">
            {uniqueImgPath && (
              <img src={uniqueImgPath} alt="고유" className="w-9 h-9" title={hero.skills?.[0] || '고유 스킬'}
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            )}
          </div>
          <div className="w-px h-5 bg-border/50 mx-0.5" />
          {Array.from({ length: 4 }).map((_, i) => {
            const sk = commonSkills[i];
            return (
              <div key={i} className="w-9 h-9 flex-shrink-0">
                {sk ? (
                  <img src={getSkillImagePath(sk)} alt={sk} className="w-9 h-9" title={sk}
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : null}
              </div>
            );
          })}
        </div>
      );
    }
    if (colKey === 'equipment') {
      const slots = hero.equipmentSlots || [];
      return (
        <div className="flex items-center gap-1 justify-center">
          {slots.slice(0, 2).map((slot: any, i: number) => {
            const item = slot?.item;
            if (!item?.imagePath) return <div key={i} className="w-9 h-9 rounded border border-border/30 flex items-center justify-center"><span className="text-[7px] text-muted-foreground">-</span></div>;
            return <img key={i} src={item.imagePath} alt={item.name} className="w-9 h-9 object-contain" title={item.name} onError={e => { e.currentTarget.style.display = 'none'; }} />;
          })}
        </div>
      );
    }
    if (colKey === 'critAttack') {
      const val = hero.atk && hero.critDmg ? Math.floor(hero.atk * hero.critDmg / 100) : 0;
      return <span className={!val ? 'text-foreground/20' : ''}>{val ? formatNumber(val) : '0'}</span>;
    }
    if (colKey === 'seeds') {
      if (!hero.seeds) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex items-center gap-1 justify-center">
          {SEED_ICONS.map(s => {
            const seedVal = hero.seeds?.[s.key as keyof typeof hero.seeds] || 0;
            const seedColor = seedVal === 80 ? 'text-orange-400 font-semibold' : seedVal === 40 ? 'text-yellow-400 font-semibold' : seedVal === 0 ? 'text-foreground/20' : '';
            return (
              <span key={s.key} className="inline-flex items-center gap-0.5">
                <img src={s.icon} alt="" className="w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />
                <span className={`text-xs tabular-nums ${seedColor}`}>{seedVal}</span>
              </span>
            );
          })}
        </div>
      );
    }
    if (colKey === 'position') return <span>{hero.position || '-'}</span>;
    if (colKey === 'promoted') {
      const isPromoted = hero.promoted || false;
      return <span className={isPromoted ? 'text-foreground font-medium' : 'text-foreground/20'}>
        {isPromoted ? 'O' : 'X'}
      </span>;
    }
    if (colKey === 'airshipPower') return <span className="text-foreground/20">-</span>;
    if (colKey === 'evasion') {
      const ev = typeof hero.evasion === 'number' ? hero.evasion : 0;
      const cap = hero.heroClass === '길잡이' ? 78 : 75;
      const isDim = ev === 0;
      if (ev > cap) return <span>{formatNumber(ev)} % <span className="text-xs text-muted-foreground">({cap}%)</span></span>;
      return <span className={isDim ? 'text-foreground/20' : ''}>{formatNumber(ev)} %</span>;
    }
    const value = hero[colKey as keyof Hero];
    const formatted = formatValue(colKey, value);
    if (formatted !== null) {
      const numVal = typeof value === 'number' ? value : 0;
      const isDim = numVal === 0 || formatted === '0' || formatted === '0 %';
      return <span className={isDim ? 'text-foreground/20' : ''}>{formatted}</span>;
    }
    return <span>{String(value ?? '-')}</span>;
  };

  const renderExpandedRow = (hero: Hero) => {
    const isChampion = hero.type === 'champion';
    const elementVal = hero.elementValue || 0;
    const critAttack = hero.atk && hero.critDmg ? Math.floor(hero.atk * hero.critDmg / 100) : 0;
    const isAllElement = hero.element === '모든 원소' || hero.heroClass === '마법검' || hero.heroClass === '스펠나이트';

    const uniqueSkill = !isChampion && hero.heroClass ? findUniqueSkillByJob(uniqueSkillsData, hero.heroClass) : null;
    let uniqueLevelIdx = 0;
    const uThresholds = uniqueSkill?.['원소_기준치']?.map(Number).filter(Number.isFinite) || [];
    for (let i = 0; i < uThresholds.length; i++) {
      if (elementVal >= uThresholds[i]) uniqueLevelIdx = i;
    }

    const equipSlots = hero.equipmentSlots || Array.from({ length: isChampion ? 2 : 6 }, () => ({ item: null, quality: 'common', element: null, spirit: null }));

    // Relic effects
    const relicEffects: { name: string; effect: string }[] = [];
    equipSlots.forEach((slot: any) => {
      if (slot.item?.relic && slot.item?.relicEffect) {
        relicEffects.push({ name: slot.item.name, effect: slot.item.relicEffect });
      }
    });

    // Champion skill data
    let leaderSkillTier = 1;
    let leaderSkillEffect = '-';
    let leaderSkillName = '';
    let leaderSkillIcon = '';
    let aurasongSkillEffect = '';
    let aurasongSkillIcon = '';
    let aurasongItemName = '';
    if (isChampion && hero.championName) {
      const champEng = CHAMPION_NAME_MAP[hero.championName] || '';
      const csd = championSkillsData[hero.championName];
      if (csd) {
        for (let t = 4; t >= 1; t--) {
          const td = csd[`${t}티어`];
          if (td && (hero.rank || 1) >= (td['챔피언_랭크'] || 0)) { leaderSkillTier = t; break; }
        }
        const cls = csd[`${leaderSkillTier}티어`];
        leaderSkillEffect = cls?.['효과'] || '-';
      }
      leaderSkillName = getLeaderSkillTierName(hero.championName, leaderSkillTier);
      leaderSkillIcon = champEng ? `/images/skills/sk_champion/${champEng}_${leaderSkillTier}.webp` : '';
      const aurasongItem = equipSlots[1]?.item;
      if (aurasongItem) {
        aurasongSkillEffect = getAurasongSkillEffect(aurasongItem.name);
        // For manual items, use relicEffect as skill description
        if (!aurasongSkillEffect && aurasongItem.manual && aurasongItem.relicEffect) {
          aurasongSkillEffect = aurasongItem.relicEffect;
        }
        aurasongSkillIcon = getAurasongSkillIconPath(aurasongItem.name);
        aurasongItemName = aurasongItem.name;
      }
    }

    const dimClass = (val: number | undefined | null) => (!val || val === 0) ? 'text-foreground/20' : '';
    const seedColor = (val: number) => val === 80 ? 'text-orange-400 font-semibold' : val === 40 ? 'text-yellow-400 font-semibold' : val === 0 ? 'text-foreground/20' : '';

    return (
      <tr className="bg-secondary/20">
        <td colSpan={activeCols.length + 1} className="px-4 py-4">
          <div className="flex gap-4">
            {/* Stats Box */}
            <div className="card-fantasy p-3 w-[200px] flex-shrink-0">
              <h4 className="text-xs font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스탯(자동)</h4>
              {isChampion && hero.championName ? (
                <div className="flex items-center justify-center py-1 mb-1">
                  <img src={getChampionImagePath(hero.championName)} alt="" className="w-10 h-10 object-contain rounded-full"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
              ) : hero.heroClass ? (
                <div className="flex items-center justify-center py-1 mb-1">
                  <img src={getJobImagePath(hero.heroClass)} alt="" className="w-10 h-10 object-contain"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
              ) : null}
              <div className="space-y-1 text-xs">
                {[
                  { icon: STAT_ICON_MAP.power, value: hero.power, suffix: '' },
                  { icon: STAT_ICON_MAP.hp, value: hero.hp, suffix: '' },
                  { icon: STAT_ICON_MAP.atk, value: hero.atk, suffix: '' },
                  { icon: STAT_ICON_MAP.def, value: hero.def, suffix: '' },
                  { icon: STAT_ICON_MAP.crit, value: hero.crit, suffix: ' %' },
                  { icon: STAT_ICON_MAP.critDmg, value: hero.critDmg, suffix: ' %' },
                  { icon: STAT_ICON_MAP.critAttack, value: critAttack, suffix: '' },
                  { icon: STAT_ICON_MAP.evasion, value: hero.evasion, suffix: ' %', isEvasion: true, jobName: hero.heroClass },
                  { icon: STAT_ICON_MAP.threat, value: hero.threat, suffix: '' },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center gap-2 py-0.5 px-1 ${dimClass(s.value)}`}>
                    <img src={s.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm ml-auto tabular-nums">{s.value ? (() => {
                      const v = `${formatNumber(s.value)}${s.suffix}`;
                      if ((s as any).isEvasion && s.value) {
                        const cap = (s as any).jobName === '길잡이' ? 78 : 75;
                        if (Number(s.value) > cap) return <>{v} <span className="text-xs text-muted-foreground">({cap}%)</span></>;
                      }
                      return v;
                    })() : '0'}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 py-0.5 px-1">
                  <ElementIcon element={isAllElement ? '모든 원소' : hero.element} size={20} />
                  <span className={`text-sm ml-auto tabular-nums ${!hero.elementValue ? 'text-foreground/20' : 'text-foreground'}`}>{hero.elementValue ? formatNumber(hero.elementValue) : '0'}</span>
                </div>
                <div className={`flex items-center gap-2 py-0.5 px-1 ${dimClass(0)}`}>
                  <img src={STAT_ICON_MAP.airshipPower} alt="" className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm ml-auto tabular-nums">-</span>
                </div>
              </div>
              {hero.seeds && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <h4 className="text-xs font-semibold text-primary mb-1" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>씨앗</h4>
                  <div className="flex gap-2">
                    {SEED_ICONS.map(s => {
                      const seedVal = hero.seeds?.[s.key as keyof typeof hero.seeds] || 0;
                      return (
                        <span key={s.key} className="inline-flex items-center gap-0.5">
                          <img src={s.icon} alt="" className="w-4 h-4" />
                          <span className={`text-xs tabular-nums ${seedColor(seedVal)}`}>{seedVal}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Skills Box */}
            <div className="card-fantasy p-3 flex-1 overflow-y-auto">
              <h4 className="text-xs font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스킬셋</h4>
              <div className="space-y-2">
                {isChampion ? (
                  <>
                    {/* Leader Skill */}
                    <div className="flex items-start gap-2 min-h-[48px]">
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                        {leaderSkillIcon && <img src={leaderSkillIcon} alt="" className="w-12 h-12 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-yellow-600/60 text-foreground">챔피언</span>
                          <span className="text-sm font-medium text-foreground">{leaderSkillName}</span>
                        </div>
                        <p className="text-xs text-foreground/70 leading-tight whitespace-pre-line mt-0.5">{leaderSkillEffect}</p>
                      </div>
                    </div>
                    <div className="border-t border-border/30" />
                    {/* Aura Song Skill */}
                    <div className="flex items-start gap-2 min-h-[48px]">
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                        {aurasongSkillIcon ? <img src={aurasongSkillIcon} alt="" className="w-12 h-12 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        {aurasongItemName ? (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-cyan-700/60 text-foreground">오라</span>
                              <span className="text-sm font-medium text-foreground">{aurasongItemName}</span>
                            </div>
                            <p className="text-xs text-foreground/70 leading-tight whitespace-pre-line mt-0.5">{aurasongSkillEffect || '-'}</p>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">오라의 노래 미장착</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Hero unique skill */}
                    {(() => {
                      const baseName = uniqueSkill?.['레벨별_스킬명']?.[0] || hero.skills?.[0] || '-';
                      const currentName = uniqueSkill?.['레벨별_스킬명']?.[uniqueLevelIdx] || baseName;
                      const desc = uniqueSkill?.['스킬_설명']?.[uniqueLevelIdx] || '-';
                      const imgPath = hero.heroClass ? getUniqueSkillImagePath(hero.heroClass) : '';
                      const skillLevel = uniqueSkill ? uniqueLevelIdx + 1 : '-';
                      return (
                        <div className="flex items-start gap-2 min-h-[48px]">
                          <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                            {imgPath ? <img src={imgPath} alt="" className="w-12 h-12 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium text-foreground">{baseName}</span>
                              {currentName !== baseName && <span className="text-xs text-muted-foreground">({currentName})</span>}
                              <span className="text-[10px] px-1 py-0.5 rounded bg-secondary text-muted-foreground ml-1">Lv.{skillLevel}</span>
                            </div>
                            <p className="text-xs text-foreground/70 leading-tight whitespace-pre-line mt-0.5">{desc}</p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="border-t border-border/30" />
                    {/* Common skills */}
                    {Array.from({ length: 4 }).map((_, i) => {
                      const sk = hero.skills?.[i + 1];
                      const skData = sk ? commonSkillsData[sk] : null;
                      const thresholds = skData?.['원소_기준치']?.map(Number).filter(Number.isFinite) || [];
                      let lvIdx = 0;
                      for (let t = 0; t < thresholds.length; t++) {
                        if (elementVal >= thresholds[t]) lvIdx = t;
                      }
                      const baseName = skData?.['레벨별_스킬명']?.[0] || sk || '-';
                      const currentName = skData?.['레벨별_스킬명']?.[lvIdx] || baseName;
                      const desc = skData?.['스킬_설명']?.[lvIdx] || '-';
                      const skillLevel = sk ? lvIdx + 1 : '-';
                      return (
                        <div key={i} className="flex items-start gap-2 min-h-[48px]">
                          <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                            {sk ? <img src={getSkillImagePath(sk)} alt="" className="w-12 h-12 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            {sk ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium text-foreground">{baseName}</span>
                                  {currentName !== baseName && <span className="text-xs text-muted-foreground">({currentName})</span>}
                                  <span className="text-[10px] px-1 py-0.5 rounded bg-secondary text-muted-foreground ml-1">Lv.{skillLevel}</span>
                                </div>
                                <p className="text-xs text-foreground/70 leading-tight whitespace-pre-line mt-0.5">{desc}</p>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                {/* Relic effects */}
                {relicEffects.length > 0 && (
                  <div className="border-t border-border/30 pt-2">
                    <h4 className="text-xs font-semibold text-primary mb-1" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>유물 효과</h4>
                    {relicEffects.map((r, i) => (
                      <div key={i} className="flex items-start gap-1 text-xs mb-1">
                        <img src="/images/special/icon_global_artifact.webp" alt="" className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="text-foreground/80">
                          {r.effect.split(/\\n|\n/).map((line: string, li: number) => (
                            <span key={li}>{li > 0 && <br />}{line}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Equipment grid */}
            <div className="card-fantasy p-3 flex-1 overflow-y-auto">
              <h4 className="text-xs font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>장비</h4>
              <div className={`grid ${isChampion ? 'grid-cols-2 max-w-[200px]' : 'grid-cols-3'} gap-2`}>
                {equipSlots.slice(0, isChampion ? 2 : 6).map((slot: any, i: number) => {
                  const item = slot.item;
                  const quality = slot.quality || 'common';
                  const radialStop = '85%';
                  const displayElement = slot.element || (item?.uniqueElement?.length ? { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true } : null);
                  const displaySpirit = slot.spirit || (item?.uniqueSpirit?.length ? { name: item.uniqueSpirit[0], affinity: true } : null);
                  const itemType = item?.type || '';
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div
                        className={`relative w-full aspect-square rounded-lg border-2 ${item ? QUALITY_BORDER[quality] : 'border-border'} flex flex-col items-center justify-center overflow-hidden`}
                        style={item ? {
                          background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent ${radialStop})`,
                          boxShadow: QUALITY_SHADOW_COLOR[quality],
                        } : { background: 'hsl(var(--secondary) / 0.3)' }}
                      >
                        {item && (
                          <span className="absolute top-0.5 left-0.5 text-[9px] font-bold text-muted-foreground bg-background/80 rounded px-0.5 z-10">T{item.tier}</span>
                        )}
                        {item?.relic && (
                          <img src="/images/special/icon_global_artifact.webp" alt="" className="absolute top-0.5 right-0.5 w-4 h-4 z-10"
                            onError={e => { e.currentTarget.style.display = 'none'; }} />
                        )}
                        {item?.imagePath ? (
                          <img src={item.imagePath} alt={item.name} className="w-3/5 h-3/5 object-contain"
                            onError={e => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <span className="text-[9px] text-muted-foreground">비어있음</span>
                        )}
                        {item && (
                          <div className="absolute bottom-0.5 left-0.5 right-0.5 flex items-center justify-center gap-1">
                            {displayElement && (
                              <img src={`/images/enchant/element/${ELEMENT_ENG_MAP[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.webp`}
                                className="w-6 h-6" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                            )}
                            {displaySpirit && (() => {
                              const eng = SPIRIT_NAME_MAP[displaySpirit.name];
                              if (displaySpirit.name === '문드라') return <img src="/images/enchant/spirit/mundra.webp" className="w-6 h-6" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />;
                              return eng ? <img src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.webp`} className="w-6 h-6" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                            })()}
                            {itemType && <img src={`/images/type/${itemType}.webp`} className="w-6 h-6" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-foreground truncate w-full text-center mt-0.5">{item?.name || '-'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  // Album card view
  const renderAlbumCard = (hero: Hero) => {
    const borderClass = hero.classLine ? CLASS_LINE_BORDER[hero.classLine] || 'border-border' : 'border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.3)]';
    const illustPath = hero.type === 'champion' && hero.championName
      ? getChampionImagePath(hero.championName)
      : hero.heroClass ? getJobIllustPath(hero.heroClass) : '';
    const isChampion = hero.type === 'champion';
    const equipSlots = hero.equipmentSlots || Array.from({ length: isChampion ? 2 : 6 }, () => ({ item: null, quality: 'common', element: null, spirit: null }));

    // Champion leader skill + aura icons
    let leaderSkillIcon = '';
    let aurasongIcon = '';
    if (isChampion && hero.championName) {
      const champEng = CHAMPION_NAME_MAP[hero.championName] || '';
      const champSkillData = championSkillsData[hero.championName];
      let leaderTier = 1;
      if (champSkillData) {
        for (let t = 4; t >= 1; t--) {
          const tierData = champSkillData[`${t}티어`];
          if (tierData && (hero.rank || 1) >= (tierData['챔피언_랭크'] || 0)) { leaderTier = t; break; }
        }
      }
      leaderSkillIcon = champEng ? `/images/skills/sk_champion/${champEng}_${leaderTier}.webp` : '';
      const aurasongItem = equipSlots[1]?.item;
      if (aurasongItem) {
        aurasongIcon = getAurasongSkillIconPath(aurasongItem.name);
      }
    }

    return (
      <div
        key={hero.id}
        className={`card-fantasy p-3 border-2 rounded-xl ${borderClass} flex flex-col items-center gap-1.5 cursor-pointer hover:scale-[1.02] transition-all`}
        onClick={() => setEditing(hero)}
      >
        {/* Square illustration with padding */}
        <div className="w-full rounded-lg bg-secondary/20 py-3">
          <div className="w-full aspect-square flex items-center justify-center overflow-hidden">
            {illustPath ? (
              <img src={illustPath} alt={hero.name} className="w-full h-full object-cover"
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <span className="text-muted-foreground text-sm">{hero.name}</span>
            )}
          </div>
        </div>
        <div className="text-center w-full">
          <p className="text-sm font-bold text-foreground truncate">{hero.name}</p>
          <p className="text-xs text-foreground/60 truncate">
            {hero.heroClass && <>{hero.heroClass} / </>}Lv.{hero.level}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ElementIcon element={hero.element} size={16} />
          <span className={`text-xs tabular-nums ${(hero.elementValue || 0) === 0 ? 'text-foreground/20' : 'text-foreground'}`}>{hero.elementValue || 0}</span>
        </div>

        {/* Skills */}
        {isChampion ? (
          <div className="flex items-center gap-1 justify-center">
            {leaderSkillIcon && <img src={leaderSkillIcon} alt="리더" className="w-9 h-9" title="리더 스킬" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            {aurasongIcon && <img src={aurasongIcon} alt="오라" className="w-9 h-9" title="오라의 노래" onError={e => { e.currentTarget.style.display = 'none'; }} />}
          </div>
        ) : (
          hero.skills && hero.skills.length > 0 && (
            <div className="flex items-center gap-0.5 flex-wrap justify-center">
              {hero.heroClass && (
                <img src={getUniqueSkillImagePath(hero.heroClass)} alt="" className="w-9 h-9" title={hero.skills?.[0]}
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
              )}
              {hero.skills.slice(1, 5).map((sk, i) => (
                <img key={i} src={getSkillImagePath(sk)} alt={sk} className="w-9 h-9" title={sk}
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
              ))}
            </div>
          )
        )}

        {/* Equipment */}
        {isChampion ? (
          <div className="flex gap-2 justify-center w-full">
            {equipSlots.slice(0, 2).map((slot: any, i: number) => {
              const item = slot.item;
              const quality = slot.quality || 'common';
              const displayElement = slot.element || (item?.uniqueElement?.length ? { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true } : null);
              const displaySpirit = slot.spirit || (item?.uniqueSpirit?.length ? { name: item.uniqueSpirit[0], affinity: true } : null);
              const itemType = item?.type || '';
              return (
                <div key={i}
                  className={`relative rounded border ${item ? QUALITY_BORDER[quality] : 'border-border/30'} flex flex-col items-center overflow-hidden`}
                  style={{ width: '64px', ...(item ? { background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 85%)`, boxShadow: QUALITY_SHADOW_COLOR[quality] } : { background: 'hsl(var(--secondary) / 0.2)' }) }}>
                  {/* Item image area */}
                  <div className="relative w-full flex items-center justify-center py-1.5">
                    {item && <span className="absolute top-0 left-0 text-[7px] font-bold text-muted-foreground bg-background/80 rounded-br px-0.5 z-10">T{item.tier}</span>}
                    {item?.relic && <img src="/images/special/icon_global_artifact.webp" alt="" className="absolute top-0 right-0 w-3 h-3 z-10" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    {item?.manual ? <CircleHelp className="w-7 h-7 text-muted-foreground/60" /> : item?.imagePath ? <img src={item.imagePath} alt="" className="w-8 h-8 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span className="text-[6px] text-muted-foreground/50">-</span>}
                  </div>
                  {/* Enchant + type icons below image */}
                  {item && (displayElement || displaySpirit || itemType) && (
                    <div className="flex items-center justify-center gap-0.5 pb-0.5 -mt-0.5">
                      {displayElement && <img src={`/images/enchant/element/${ELEMENT_ENG_MAP[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.webp`} className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                      {displaySpirit && (() => {
                        const eng = SPIRIT_NAME_MAP[displaySpirit.name];
                        if (displaySpirit.name === '문드라') return <img src="/images/enchant/spirit/mundra.webp" className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />;
                        return eng ? <img src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.webp`} className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                      })()}
                      {itemType && <img src={`/images/type/${itemType}.webp`} className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 w-full">
            {equipSlots.map((slot: any, i: number) => {
              const item = slot.item;
              const quality = slot.quality || 'common';
              const displayElement = slot.element || (item?.uniqueElement?.length ? { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true } : null);
              const displaySpirit = slot.spirit || (item?.uniqueSpirit?.length ? { name: item.uniqueSpirit[0], affinity: true } : null);
              const itemType = item?.type || '';
              return (
                <div key={i}
                  className={`rounded border ${item ? QUALITY_BORDER[quality] : 'border-border/30'} flex flex-col items-center overflow-hidden`}
                  style={item ? { background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 85%)`, boxShadow: QUALITY_SHADOW_COLOR[quality] } : { background: 'hsl(var(--secondary) / 0.2)' }}>
                  {/* Item image area */}
                  <div className="relative w-full flex items-center justify-center py-1.5">
                    {item && <span className="absolute top-0 left-0 text-[7px] font-bold text-muted-foreground bg-background/80 rounded-br px-0.5 z-10">T{item.tier}</span>}
                    {item?.relic && <img src="/images/special/icon_global_artifact.webp" alt="" className="absolute top-0 right-0 w-3 h-3 z-10" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    {item?.manual ? <CircleHelp className="w-7 h-7 text-muted-foreground/60" /> : item?.imagePath ? <img src={item.imagePath} alt="" className="w-8 h-8 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span className="text-[6px] text-muted-foreground/50">-</span>}
                  </div>
                  {/* Enchant + type icons below image */}
                  {item && (displayElement || displaySpirit || itemType) && (
                    <div className="flex items-center justify-center gap-0.5 pb-0.5 -mt-0.5">
                      {displayElement && <img src={`/images/enchant/element/${ELEMENT_ENG_MAP[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.webp`} className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                      {displaySpirit && (() => {
                        const eng = SPIRIT_NAME_MAP[displaySpirit.name];
                        if (displaySpirit.name === '문드라') return <img src="/images/enchant/spirit/mundra.webp" className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />;
                        return eng ? <img src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.webp`} className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                      })()}
                      {itemType && <img src={`/images/type/${itemType}.webp`} className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 mt-auto">
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
          <Button onClick={() => setAddingType('hero')} className="gap-2 text-sm font-medium">
            <Shield className="w-4 h-4" /> 새 영웅 추가
          </Button>
          <Button onClick={() => setAddingType('champion')} variant="secondary" className="gap-2 text-sm font-medium">
            <Crown className="w-4 h-4" /> 새 챔피언 추가
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

      {viewMode === 'table' ? (
        <>
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
                  <th className="px-3 py-3 text-center text-muted-foreground font-medium">관리</th>
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
                  return (
                    <>
                      <tr key={hero.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${isExpanded ? 'bg-secondary/20' : ''}`}>
                        {activeCols.map(col => {
                          // When expanded, hide non-essential columns
                          if (isExpanded && !EXPANDED_VISIBLE_KEYS.has(col.key)) {
                            return <td key={col.key} className="px-3 py-3 text-center" />;
                          }
                          return (
                            <td key={col.key} className="px-3 py-3 text-center">
                              {renderCell(hero, col.key)}
                            </td>
                          );
                        })}
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
                      {isExpanded && renderExpandedRow(hero)}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
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
          <div className="grid grid-cols-6 gap-3">
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
