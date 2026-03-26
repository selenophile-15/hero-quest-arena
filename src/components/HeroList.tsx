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

  // Export handler
  const handleExport = useCallback(() => {
    const data = JSON.stringify(heroes, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `quest_sim_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [heroes]);

  // Import handler
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error('Invalid format');
        const valid = parsed.every((h: any) => h.id && h.name && (h.type === 'hero' || h.type === 'champion'));
        if (!valid) throw new Error('Invalid hero data');
        setImportPreview(parsed);
        setSaveLoadOpen(true);
      } catch {
        alert('파일 형식이 올바르지 않습니다. JSON 형식의 백업 파일을 사용해주세요.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleImportConfirm = useCallback(() => {
    if (!importPreview) return;
    if (importMode === 'replace') {
      setHeroes(importPreview);
      saveHeroes(importPreview);
    } else {
      const merged = [...heroes, ...importPreview.map(h => ({ ...h, id: crypto.randomUUID() }))];
      setHeroes(merged);
      saveHeroes(merged);
    }
    setImportPreview(null);
    setSaveLoadOpen(false);
  }, [importPreview, importMode, heroes]);

  // Preload all skill and equipment images for smooth rendering
  useEffect(() => {
    const imagesToPreload = new Set<string>();
    heroes.forEach(hero => {
      if (hero.heroClass) {
        imagesToPreload.add(getUniqueSkillImagePath(hero.heroClass));
        imagesToPreload.add(getJobImagePath(hero.heroClass));
      }
      if (hero.type === 'champion' && hero.championName) {
        imagesToPreload.add(getChampionImagePath(hero.championName));
        const champEng = CHAMPION_NAME_MAP[hero.championName] || '';
        if (champEng) {
          for (let t = 1; t <= 4; t++) {
            imagesToPreload.add(`/images/skills/sk_champion/${champEng}_${t}.webp`);
          }
        }
      }
      hero.skills?.forEach(sk => {
        if (sk) imagesToPreload.add(getSkillImagePath(sk));
      });
      hero.equipmentSlots?.forEach((slot: any) => {
        if (slot?.item?.imagePath) imagesToPreload.add(slot.item.imagePath);
      });
    });
    imagesToPreload.forEach(src => {
      if (src) {
        const img = new Image();
        img.src = src;
      }
    });
  }, [heroes]);

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

  // Premium table screenshot
  const handleTableScreenshot = useCallback(async () => {
    const cols = activeColumns.filter(c => screenshotCols.has(c.key));
    if (cols.length === 0) return;

    const container = document.createElement('div');
    const colW = cols.some(c => ['seeds', 'element', 'name', 'heroClass', 'championName'].includes(c.key)) ? 110 : 90;
    const baseW = cols.length * colW + 64;
    const containerW = Math.max(360, baseW);

    container.style.cssText = `
      position: fixed; left: -9999px; top: 0;
      width: ${containerW}px;
      background: linear-gradient(160deg, #0f1420 0%, #151d2e 40%, #1a1530 70%, #0f1420 100%);
      padding: 28px 32px 24px;
      font-family: 'Noto Sans KR', sans-serif;
      color: #e8dcc8;
    `;

    const topAccent = document.createElement('div');
    topAccent.style.cssText = 'height: 2px; background: linear-gradient(90deg, transparent, #d4af37, transparent); margin-bottom: 24px; border-radius: 1px;';
    container.appendChild(topAccent);

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 20px;';
    header.innerHTML = `
      <div>
        <div style="font-family: Cinzel, serif; font-size: 16px; color: #d4af37; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">Quest Simulator</div>
        <div style="font-size: 11px; color: #8a7e6b; margin-top: 6px; letter-spacing: 0.5px;">${listTab === 'hero' ? '영웅' : '챔피언'} 리스트 · ${filtered.length}명</div>
      </div>
      <div style="font-size: 10px; color: #5a5245; letter-spacing: 1px;">${new Date().toLocaleDateString('ko-KR')}</div>
    `;
    container.appendChild(header);

    const sep = document.createElement('div');
    sep.style.cssText = 'height: 1px; background: rgba(212,175,55,0.2); margin-bottom: 4px;';
    container.appendChild(sep);

    const table = document.createElement('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px;';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    cols.forEach(col => {
      const th = document.createElement('th');
      th.style.cssText = 'padding: 10px 8px; text-align: center; color: #d4af37; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid rgba(212,175,55,0.25);';
      th.textContent = col.label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    filtered.forEach((hero, idx) => {
      const tr = document.createElement('tr');
      tr.style.cssText = `border-bottom: 1px solid rgba(255,255,255,0.04); ${idx % 2 === 0 ? 'background: rgba(255,255,255,0.015);' : ''}`;
      cols.forEach(col => {
        const td = document.createElement('td');
        td.style.cssText = 'padding: 7px 8px; text-align: center; vertical-align: middle; height: 36px; white-space: nowrap; font-size: 12px; color: #d6ccb8;';
        const text = getScreenshotCellText(hero, col.key);
        if (text === '0' || text === '0 %' || text === '-') {
          td.style.color = 'rgba(214,204,184,0.2)';
        }
        td.textContent = text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    const bottomAccent = document.createElement('div');
    bottomAccent.style.cssText = 'height: 1px; background: linear-gradient(90deg, transparent, rgba(212,175,55,0.15), transparent); margin-top: 16px;';
    container.appendChild(bottomAccent);

    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 12px; text-align: right; font-family: Cinzel, serif; font-size: 9px; color: #3d3828; letter-spacing: 2px;';
    footer.textContent = 'QUEST SIMULATOR';
    container.appendChild(footer);

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `list_${listTab}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      document.body.removeChild(container);
    }
    setScreenshotDialogOpen(false);
  }, [screenshotCols, activeColumns, filtered, listTab, getScreenshotCellText]);

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

  const handleBulkDelete = () => {
    if (selectedForDelete.size === 0) return;
    const updated = heroes.filter(h => !selectedForDelete.has(h.id));
    setHeroes(updated);
    saveHeroes(updated);
    setSelectedForDelete(new Set());
    setManageMode(false);
    setBulkDeleteConfirm(false);
  };

  const handleResetList = () => {
    const otherTab = listTab === 'hero' ? heroes.filter(h => h.type !== 'hero') : heroes.filter(h => h.type !== 'champion');
    setHeroes(otherTab);
    saveHeroes(otherTab);
    setResetConfirm(false);
    setManageMode(false);
    setSelectedForDelete(new Set());
  };

  const toggleSelectForDelete = (id: string) => {
    setSelectedForDelete(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCopyHero = (hero: Hero) => {
    const baseName = hero.name.replace(/\s*\(\d+\)$/, '');
    const existingNumbers = heroes
      .filter(h => h.name.startsWith(baseName))
      .map(h => {
        const match = h.name.match(/\((\d+)\)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextNum = Math.max(0, ...existingNumbers) + 1;
    const newName = `${baseName} (${nextNum})`;
    const newHero: Hero = {
      ...JSON.parse(JSON.stringify(hero)),
      id: crypto.randomUUID(),
      name: newName,
      createdAt: new Date().toISOString(),
    };
    const updated = [...heroes, newHero];
    setHeroes(updated);
    saveHeroes(updated);
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
      const isPromoted = isChamp && hero.promoted;
      return (
        <span className="font-medium text-foreground text-center w-full inline-flex items-center gap-1 justify-center leading-[20px]">
          {isChamp && hero.championName && (
            <img src={getChampionImagePath(hero.championName)} alt="" className="w-5 h-5 rounded-full flex-shrink-0" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
          )}
          <span className={isPromoted ? 'text-yellow-400' : ''}>{hero.name}</span>
          {isPromoted && <Award className="w-3.5 h-3.5 text-yellow-400" />}
        </span>
      );
    }
    if (colKey === 'type') {
      return (
        <span className={hero.type === 'champion' ? 'text-primary font-medium leading-[20px]' : 'text-red-400 font-medium leading-[20px]'}>
          {hero.type === 'champion' ? '챔피언' : '영웅'}
        </span>
      );
    }
    if (colKey === 'classLine') {
      if (!hero.classLine) return <span className="text-muted-foreground">-</span>;
      return <span className={`leading-[20px] ${CLASS_LINE_COLORS[hero.classLine] || 'text-foreground'}`}>{hero.classLine}</span>;
    }
    if (colKey === 'heroClass') {
      if (!hero.heroClass) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="inline-flex items-center gap-1 leading-[20px]">
          <img src={getJobImagePath(hero.heroClass)} alt="" className="w-5 h-5 flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <span className="whitespace-nowrap">{hero.heroClass}</span>
        </span>
      );
    }
    if (colKey === 'championName') {
      if (!hero.championName) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="inline-flex items-center gap-1 leading-[20px]">
          <img src={getChampionImagePath(hero.championName)} alt="" className="w-5 h-5 rounded-full flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <span>{hero.championName}</span>
        </span>
      );
    }
    if (colKey === 'rank') {
      const r = hero.rank || 1;
      if (r <= 11) return <span className="leading-[20px]">{r}</span>;
      return <span className="leading-[20px]">{r} (11+{r - 11})</span>;
    }
    if (colKey === 'element') {
      const elVal = hero.elementValue || 0;
      const isDimEl = elVal === 0;
      return (
        <span className="inline-flex items-center gap-1 leading-[20px]">
          <ElementIcon element={hero.element} size={20} />
          <span className={`tabular-nums ${isDimEl ? 'text-foreground/20' : 'text-foreground'}`}>{formatNumber(elVal)}</span>
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
          <div className="flex items-center gap-0.5 justify-center h-[36px]">
            {leaderIcon && <img src={leaderIcon} alt="리더" className="w-9 h-9" title="리더 스킬" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            {auraIcon && <img src={auraIcon} alt="오라" className="w-9 h-9" title="오라의 노래" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            {!leaderIcon && !auraIcon && <span className="text-muted-foreground">-</span>}
          </div>
        );
      }
      const uniqueImgPath = hero.heroClass ? getUniqueSkillImagePath(hero.heroClass) : '';
      const commonSkills = hero.skills?.slice(1) || [];
      return (
        <div className="flex items-center gap-0.5 justify-center h-[36px]">
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
        <div className="flex items-center gap-1 justify-center h-[36px]">
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
      return <span className={`leading-[20px] ${!val ? 'text-foreground/20' : ''}`}>{val ? formatNumber(val) : '0'}</span>;
    }
    if (colKey === 'seeds') {
      if (!hero.seeds) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex items-center gap-1 justify-center h-[20px]">
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
    if (colKey === 'position') return <span className="leading-[20px]">{hero.position || '-'}</span>;
    if (colKey === 'promoted') return null;
    if (colKey === 'airshipPower') return <span className="text-foreground/20 leading-[20px]">-</span>;
    if (colKey === 'evasion') {
      const ev = typeof hero.evasion === 'number' ? hero.evasion : 0;
      const cap = hero.heroClass === '길잡이' ? 78 : 75;
      const isDim = ev === 0;
      if (ev > cap) return <span className="leading-[20px]">{formatNumber(ev)} % <span className="text-xs text-muted-foreground">({cap}%)</span></span>;
      return <span className={`leading-[20px] ${isDim ? 'text-foreground/20' : ''}`}>{formatNumber(ev)} %</span>;
    }
    if (colKey === 'level') {
      const lv = hero.level || 0;
      const lvColor = lv >= 50 ? 'text-yellow-400 font-semibold' : '';
      return <span className={`leading-[20px] ${lvColor}`}>{lv}</span>;
    }
    const value = hero[colKey as keyof Hero];
    const formatted = formatValue(colKey, value);
    if (formatted !== null) {
      const numVal = typeof value === 'number' ? value : 0;
      const isDim = numVal === 0 || formatted === '0' || formatted === '0 %';
      return <span className={`leading-[20px] ${isDim ? 'text-foreground/20' : ''}`}>{formatted}</span>;
    }
    return <span className="leading-[20px]">{String(value ?? '-')}</span>;
  };

  const skillLevelColorClass = (lvl: number | string) => {
    if (typeof lvl !== 'number') return 'bg-secondary text-foreground/80';
    if (lvl >= 5) return 'bg-yellow-500/70 text-yellow-50';
    if (lvl >= 4) return 'bg-purple-500/70 text-purple-50';
    if (lvl >= 3) return 'bg-blue-500/70 text-blue-50';
    if (lvl >= 2) return 'bg-green-500/70 text-green-50';
    return 'bg-secondary text-foreground/80';
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

    const relicEffects: { name: string; effect: string }[] = [];
    equipSlots.forEach((slot: any) => {
      if (slot.item?.relic && slot.item?.relicEffect) {
        relicEffects.push({ name: slot.item.name, effect: slot.item.relicEffect });
      }
    });

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
      <tr id={`expanded-${hero.id}`} className="bg-muted/40">
        <td colSpan={activeCols.length + 1} className="px-4 py-4">
          <div className="flex gap-4">
            {/* Stats Box */}
            <div className="card-fantasy p-3 w-[200px] flex-shrink-0">
              <h4 className="text-xs font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스탯</h4>
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
                  { icon: STAT_ICON_MAP.critDmg, value: hero.critDmg, suffix: '', isCritDmg: true },
                  { icon: STAT_ICON_MAP.critAttack, value: critAttack, suffix: '' },
                  { icon: STAT_ICON_MAP.evasion, value: hero.evasion, suffix: ' %', isEvasion: true, jobName: hero.heroClass },
                  { icon: STAT_ICON_MAP.threat, value: hero.threat, suffix: '' },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center gap-2 py-0.5 px-1 ${dimClass(s.value)}`}>
                    <img src={s.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm ml-auto tabular-nums">{s.value ? (() => {
                      if ((s as any).isCritDmg) return `x${(Number(s.value) / 100).toFixed(1)}`;
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
                          <span className={`text-sm tabular-nums ${seedColor(seedVal)}`}>{seedVal}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Skills Box */}
            <div className="card-fantasy p-3 w-[280px] flex-shrink-0 flex flex-col gap-2">
              <h4 className="text-xs font-semibold text-primary" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스킬</h4>
              {isChampion ? (
                <div className="flex flex-col gap-2">
                  {leaderSkillIcon && (
                    <div className="flex items-start gap-2">
                      <img src={leaderSkillIcon} alt="" className="w-10 h-10 flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{leaderSkillName || '리더 스킬'}</p>
                        <p className="text-xs text-foreground/70 mt-0.5 whitespace-pre-line">{leaderSkillEffect}</p>
                      </div>
                    </div>
                  )}
                  {aurasongSkillIcon && (
                    <div className="flex items-start gap-2">
                      <img src={aurasongSkillIcon} alt="" className="w-10 h-10 flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{aurasongItemName}</p>
                        <p className="text-xs text-foreground/70 mt-0.5 whitespace-pre-line">{aurasongSkillEffect}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Unique skill */}
                  {hero.heroClass && uniqueSkill && (
                    <div className="flex items-start gap-2 pb-2 border-b border-border/30">
                      <img src={getUniqueSkillImagePath(hero.heroClass)} alt="" className="w-10 h-10 flex-shrink-0"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold text-foreground truncate">{uniqueSkill['스킬_이름'] || hero.skills?.[0]}</p>
                          <span className={`text-[10px] px-1 py-0.5 rounded ${skillLevelColorClass(uniqueLevelIdx + 1)}`}>Lv.{uniqueLevelIdx + 1}</span>
                        </div>
                        {uniqueSkill[`${uniqueLevelIdx + 1}레벨`] && (
                          <p className="text-xs text-foreground/70 mt-0.5 whitespace-pre-line">{uniqueSkill[`${uniqueLevelIdx + 1}레벨`]}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Common skills */}
                  {hero.skills?.slice(1, 5).map((sk, idx) => {
                    const skData = commonSkillsData[sk];
                    const skLevel = hero.skillLevels?.[idx + 1] ?? 1;
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <img src={getSkillImagePath(sk)} alt="" className="w-10 h-10 flex-shrink-0"
                          onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-semibold text-foreground truncate">{sk}</p>
                            <span className={`text-[10px] px-1 py-0.5 rounded ${skillLevelColorClass(skLevel)}`}>Lv.{skLevel}</span>
                          </div>
                          {skData?.[`${skLevel}레벨`] && (
                            <p className="text-xs text-foreground/70 mt-0.5 whitespace-pre-line">{skData[`${skLevel}레벨`]}</p>
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

            {/* Equipment grid */}
            <div className="card-fantasy p-3 flex-1 overflow-y-auto">
              <h4 className="text-xs font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>장비</h4>
              <div className={`grid grid-cols-3 gap-2`}>
                {equipSlots.slice(0, isChampion ? 2 : 6).map((slot: any, i: number) => {
                  const item = slot.item;
                  const quality = slot.quality || 'common';
                  const displayElement = slot.element || (item?.uniqueElement?.length ? { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true } : null);
                  const displaySpirit = slot.spirit || (item?.uniqueSpirit?.length ? { name: item.uniqueSpirit[0], affinity: true } : null);
                  const itemType = item?.type || '';
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div
                        className={`relative w-full aspect-square rounded-lg border-2 ${item ? QUALITY_BORDER[quality] : 'border-border'} flex flex-col items-stretch overflow-hidden`}
                        style={item ? {
                          background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 85%)`,
                          boxShadow: QUALITY_SHADOW_COLOR[quality],
                        } : { background: 'hsl(var(--secondary) / 0.3)' }}
                      >
                        <div className="flex items-center justify-between px-1 pt-0.5 flex-shrink-0" style={{ minHeight: '18px' }}>
                          {item ? <span className="text-[9px] font-bold text-muted-foreground bg-background/80 rounded px-0.5">T{item.tier}</span> : <span />}
                          {item?.relic ? <img src="/images/special/icon_global_artifact.webp" alt="" className="w-4 h-4" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} /> : <span />}
                        </div>
                        <div className="flex-1 flex items-start justify-center pt-0.5">
                          {item?.manual ? (
                            <CircleHelp className="w-9 h-9 text-yellow-400/60" />
                          ) : item?.imagePath ? (
                            <img src={item.imagePath} alt={item.name} className="w-[55%] object-contain"
                              onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                          ) : (
                            <span className="text-[9px] text-muted-foreground mt-6">비어있음</span>
                          )}
                        </div>
                        {item ? (
                          <div className="flex items-center justify-center gap-1 pb-1 flex-shrink-0" style={{ minHeight: '34px' }}>
                            {displayElement && (
                              <img src={`/images/enchant/element/${ELEMENT_ENG_MAP[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.webp`}
                                className="w-8 h-8" alt="" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                            )}
                            {displaySpirit && (() => {
                              const eng = SPIRIT_NAME_MAP[displaySpirit.name];
                              if (displaySpirit.name === '문드라') return <img src="/images/enchant/spirit/mundra.webp" className="w-8 h-8" alt="" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />;
                              return eng ? <img src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.webp`} className="w-8 h-8" alt="" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} /> : null;
                            })()}
                            {itemType && <img src={`/images/type/${itemType}.webp`} className="w-8 h-8" alt="" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />}
                          </div>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-foreground truncate w-full text-center mt-0.5">{item?.name || '-'}</p>
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
    const illustPath = hero.type === 'champion' && hero.championName
      ? getChampionImagePath(hero.championName)
      : hero.heroClass ? getJobIllustPath(hero.heroClass) : '';
    const isChampion = hero.type === 'champion';
    const equipSlots = hero.equipmentSlots || Array.from({ length: isChampion ? 2 : 6 }, () => ({ item: null, quality: 'common', element: null, spirit: null }));
    const borderColor = hero.classLine ? (CLASS_LINE_BORDER_COLOR[hero.classLine] || '#6b7280') : '#a855f7';
    const borderShadow = hero.classLine ? (CLASS_LINE_SHADOW_STYLE[hero.classLine] || 'none') : '0 0 12px rgba(168,85,247,0.3)';

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
        className="card-fantasy p-3 border-2 rounded-xl flex flex-col items-center gap-1.5 cursor-pointer hover:scale-[1.02] transition-all"
        style={{ borderColor, boxShadow: borderShadow }}
        onClick={() => setEditing(hero)}
      >
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
          <p className={`text-sm font-bold truncate inline-flex items-center gap-1 justify-center w-full ${hero.type === 'champion' && hero.promoted ? 'text-yellow-400' : 'text-foreground'}`}>
            {hero.name}
            {hero.type === 'champion' && hero.promoted && <Award className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
          </p>
          <p className="text-xs text-foreground/60 truncate">
            {hero.heroClass && <>{hero.heroClass} / </>}Lv.{hero.level}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ElementIcon element={hero.element} size={16} />
          <span className={`text-xs tabular-nums ${(hero.elementValue || 0) === 0 ? 'text-foreground/20' : 'text-foreground'}`}>{hero.elementValue || 0}</span>
        </div>

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

        {isChampion ? (
          <div className="flex gap-2 justify-center w-full">
            {equipSlots.slice(0, 2).map((slot: any, i: number) => {
              const item = slot.item;
              const quality = slot.quality || 'common';
              const displayElement = slot.element || (item?.uniqueElement?.length ? { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true } : null);
              const displaySpirit = slot.spirit || (item?.uniqueSpirit?.length ? { name: item.uniqueSpirit[0], affinity: true } : null);
              const itemType = item?.type || '';
              return (
                <div
                  key={i}
                  className={`rounded border ${item ? QUALITY_BORDER[quality] : 'border-border/30'} flex flex-col items-stretch overflow-hidden`}
                  style={{
                    width: '64px',
                    ...(item
                      ? { background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 85%)`, boxShadow: QUALITY_SHADOW_COLOR[quality] }
                      : { background: 'hsl(var(--secondary) / 0.2)' }),
                  }}
                >
                  <div className="w-full flex items-center justify-between px-0.5 pt-0.5" style={{ minHeight: '14px' }}>
                    {item ? (
                      <span className="text-[7px] font-bold text-muted-foreground bg-background/80 rounded px-0.5">T{item.tier}</span>
                    ) : (
                      <span />
                    )}
                    {item?.relic ? (
                      <img src="/images/special/icon_global_artifact.webp" alt="" className="w-3 h-3" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span />
                    )}
                  </div>
                  <div className="w-full flex items-center justify-center pt-0.5 -mb-1">
                    {item?.manual ? (
                      <CircleHelp className="w-9 h-9 text-muted-foreground/60" />
                    ) : item?.imagePath ? (
                      <img src={item.imagePath} alt="" className="w-11 h-11 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span className="text-[6px] text-muted-foreground/50">-</span>
                    )}
                  </div>
                  {item && (displayElement || displaySpirit || itemType) && (
                    <div className="flex items-center justify-center gap-0.5 pb-0.5 mt-2">
                      {displayElement && (
                        <img src={`/images/enchant/element/${ELEMENT_ENG_MAP[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.webp`}
                          className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      )}
                      {displaySpirit && (() => {
                        const eng = SPIRIT_NAME_MAP[displaySpirit.name];
                        if (displaySpirit.name === '문드라') return <img src="/images/enchant/spirit/mundra.webp" className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />;
                        return eng ? <img src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.webp`} className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                      })()}
                      {itemType && <img src={`/images/type/${itemType}.webp`} className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
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
                <div
                  key={i}
                  className={`rounded border ${item ? QUALITY_BORDER[quality] : 'border-border/30'} flex flex-col items-stretch overflow-hidden min-h-[78px]`}
                  style={item ? { background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 85%)`, boxShadow: QUALITY_SHADOW_COLOR[quality] } : { background: 'hsl(var(--secondary) / 0.2)' }}
                >
                  <div className="w-full flex items-center justify-between px-0.5 pt-0.5" style={{ minHeight: '14px' }}>
                    {item ? (
                      <span className="text-[7px] font-bold text-muted-foreground bg-background/80 rounded px-0.5">T{item.tier}</span>
                    ) : (
                      <span />
                    )}
                    {item?.relic ? (
                      <img src="/images/special/icon_global_artifact.webp" alt="" className="w-3 h-3" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span />
                    )}
                  </div>
                  <div className="w-full flex items-center justify-center pt-0.5 -mb-1">
                    {item?.manual ? (
                      <CircleHelp className="w-9 h-9 text-muted-foreground/60" />
                    ) : item?.imagePath ? (
                      <img src={item.imagePath} alt="" className="w-11 h-11 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span className="text-[6px] text-muted-foreground/50">-</span>
                    )}
                  </div>
                  {item && (displayElement || displaySpirit || itemType) && (
                    <div className="flex items-center justify-center gap-0.5 pb-0.5 mt-2">
                      {displayElement && (
                        <img src={`/images/enchant/element/${ELEMENT_ENG_MAP[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.webp`}
                          className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      )}
                      {displaySpirit && (() => {
                        const eng = SPIRIT_NAME_MAP[displaySpirit.name];
                        if (displaySpirit.name === '문드라') return <img src="/images/enchant/spirit/mundra.webp" className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />;
                        return eng ? <img src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.webp`} className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                      })()}
                      {itemType && <img src={`/images/type/${itemType}.webp`} className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
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
