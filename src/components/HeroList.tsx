import { useState, useEffect, useMemo, Fragment, useRef, useCallback } from 'react';
import { Hero, HERO_STAT_COLUMNS, CHAMPION_STAT_COLUMNS, STAT_ICON_MAP, ELEMENT_ICON_MAP } from '@/types/game';
import { useTheme } from '@/hooks/use-theme';
import { getTypeImagePath } from '@/lib/typeImageUtils';
import { formatNumber } from '@/lib/format';
import { HERO_CLASS_MAP, getCommonSkills, getUniqueSkills, getChampionSkillsData } from '@/lib/gameData';
import { getHeroes, saveHeroes, deleteHero } from '@/lib/storage';
import { getJobImagePath, getJobIllustPath, getChampionImagePath, CHAMPION_NAME_MAP, JOB_NAME_MAP, SPIRIT_NAME_MAP } from '@/lib/nameMap';
import { getSkillImagePath, getUniqueSkillImagePath, setSkillGradeCache } from '@/lib/skillUtils';
import { getAurasongSkillIconPath, getLeaderSkillTierName, getAurasongSkillEffect, ensureAurasongDataLoaded } from '@/lib/championEquipUtils';
import { saveCanvasImage } from '@/lib/fileDownload';
import HeroForm from './HeroForm';
import ChampionForm from './ChampionForm';
import ListSummary, { ListSummaryHandle } from './ListSummary';
import SaveListDialog from './SaveListDialog';
import ElementIcon from './ElementIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, Shield, Crown, LayoutGrid, Table2, Filter, ArrowUpDown, CircleHelp, Copy, RefreshCw, Award, Download, Upload, Camera, BarChart3, Save } from 'lucide-react';
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
  common: 'rgba(100,100,115,0.5)',
  uncommon: 'rgba(74,222,128,0.45)',
  flawless: 'rgba(103,232,249,0.5)',
  epic: 'rgba(217,70,239,0.55)',
  legendary: 'rgba(250,204,21,0.6)',
};
const QUALITY_RADIAL_COLOR_LIGHT: Record<string, string> = {
  common: 'rgba(160,160,175,0.35)',
  uncommon: 'rgba(34,180,80,0.25)',
  flawless: 'rgba(30,180,220,0.3)',
  epic: 'rgba(180,40,200,0.3)',
  legendary: 'rgba(210,170,0,0.35)',
};
const QUALITY_SHADOW_COLOR: Record<string, string> = {
  common: '0 0 6px rgba(220,220,220,0.5)',
  uncommon: '0 0 7px rgba(74,222,128,0.55)',
  flawless: '0 0 8px rgba(103,232,249,0.55)',
  epic: '0 0 10px rgba(217,70,239,0.6)',
  legendary: '0 0 12px rgba(250,204,21,0.7)',
};
const QUALITY_SHADOW_COLOR_LIGHT: Record<string, string> = {
  common: '0 0 6px rgba(120,120,140,0.4)',
  uncommon: '0 0 7px rgba(34,180,80,0.5)',
  flawless: '0 0 8px rgba(30,180,220,0.5)',
  epic: '0 0 10px rgba(180,40,200,0.5)',
  legendary: '0 0 12px rgba(210,170,0,0.6)',
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
const DEFAULT_HIDDEN_COLS = ['classLine', 'threat', 'seeds', 'airshipPower', 'type', 'critDmg', 'position'];

function createScreenshotOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'hero-list-screenshot-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';
  overlay.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:white;font-size:14px;font-weight:600"><div style="width:32px;height:32px;border:3px solid white;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></div>스크린샷 저장 중...</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
  document.body.appendChild(overlay);
  return overlay;
}

export default function HeroList() {
  const { colorMode } = useTheme();
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importPreview, setImportPreview] = useState<Hero[] | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const summaryHandleRef = useRef<ListSummaryHandle>(null);
  const albumContentRef = useRef<HTMLDivElement>(null);
  const tableContentRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

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

  // Screenshot handler (shared for table & album)
  const handleScreenshot = useCallback(async (targetRef: React.RefObject<HTMLDivElement | null>, prefix: string) => {
    if (!targetRef.current) return;
    const overlay = createScreenshotOverlay();
    setScreenshotLoading(true);
    setCaptureMode(true);
    // For album mode, unflip all cards so screenshot shows front face
    const savedFlipped = new Set(flippedCards);
    setFlippedCards(new Set());
    try {
      await new Promise(r => setTimeout(r, 300));

      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: colorMode === 'light' ? '#ffffff' : '#1a1a2e',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        onclone: (doc) => {
          const root = doc.documentElement;
          root.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'gold');
          root.setAttribute('data-color-mode', colorMode);
          if (colorMode === 'light') {
            root.style.backgroundColor = '#ffffff';
            doc.body.style.backgroundColor = '#ffffff';
          }
          const clonedEl = doc.querySelector(`[data-screenshot-target]`) as HTMLElement;
          if (clonedEl) {
            if (colorMode === 'light') {
              clonedEl.style.backgroundColor = '#ffffff';
            }
            // Force zebra striping + visible horizontal borders inline so html2canvas always renders them
            // Use HSL of current theme primary for header + zebra so they match the active color mode
            const primaryHsl = (window.getComputedStyle(document.documentElement).getPropertyValue('--primary') || '40 85% 55%').trim();
            const headerBg = `hsla(${primaryHsl} / 0.07)`;
            const zebraBg = `hsla(${primaryHsl} / 0.04)`;
            const borderColor = colorMode === 'light' ? '#d4d4d8' : '#3f3f55';
            clonedEl.querySelectorAll('table').forEach(t => {
              (t as HTMLElement).style.borderCollapse = 'collapse';
            });
            clonedEl.querySelectorAll('thead tr').forEach(tr => {
              const el = tr as HTMLElement;
              el.style.borderBottom = `2px solid ${borderColor}`;
              el.style.backgroundColor = headerBg;
            });
            clonedEl.querySelectorAll('tbody tr.table-zebra-row').forEach((tr, idx) => {
              const el = tr as HTMLElement;
              if (idx % 2 === 1) el.style.backgroundColor = zebraBg;
              el.style.borderBottom = `1px solid ${borderColor}`;
            });
            clonedEl.querySelectorAll('td, th').forEach(cell => {
              const el = cell as HTMLElement;
              el.style.verticalAlign = 'middle';
              // Remove any vertical cell borders for clean horizontal-only look
              el.style.borderRight = 'none';
              el.style.borderLeft = 'none';
            });
            clonedEl.querySelectorAll('img, span, svg').forEach(el => {
              const s = window.getComputedStyle(el);
              if (s.display === 'inline-block' || s.display === 'inline') {
                (el as HTMLElement).style.verticalAlign = 'middle';
              }
            });
            // Hide flip inner transforms for album cards
            clonedEl.querySelectorAll('.album-card-flip-inner').forEach(el => {
              (el as HTMLElement).style.transform = 'none';
            });
            clonedEl.querySelectorAll('.album-card-back').forEach(el => {
              (el as HTMLElement).style.display = 'none';
            });
            // Fix light mode screenshot: replace transparent gradients with white
            if (colorMode === 'light') {
              clonedEl.querySelectorAll('*').forEach(el => {
                const htmlEl = el as HTMLElement;
                const bg = htmlEl.style.background || '';
                // Replace transparent in radial-gradient with #ffffff
                if (bg.includes('transparent')) {
                  htmlEl.style.background = bg.replace(/transparent/g, '#ffffff');
                }
                // Remove box-shadow that causes gray halos
                const shadow = htmlEl.style.boxShadow || '';
                if (shadow && shadow !== 'none') {
                  htmlEl.style.boxShadow = 'none';
                }
              });
              // Apply white background only where backgroundColor is unset/transparent — preserve zebra
              clonedEl.querySelectorAll('.card-fantasy, .album-card-front, .album-card-back, table, thead, tbody').forEach(el => {
                const htmlEl = el as HTMLElement;
                const bg = window.getComputedStyle(htmlEl).backgroundColor;
                if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
                  htmlEl.style.backgroundColor = '#ffffff';
                }
              });
            }
          }
        },
      });

      await saveCanvasImage(canvas, `${prefix}_${listTab}_${new Date().toISOString().slice(0, 10)}.png`, 'image/png');
    } catch (e) {
      console.error('Screenshot failed:', e);
    } finally {
      setCaptureMode(false);
      setFlippedCards(savedFlipped);
      setScreenshotLoading(false);
      overlay.remove();
    }
  }, [listTab, colorMode, flippedCards]);

  // Export handler (now via dialog)
  const handleExport = useCallback(() => {
    setSaveDialogOpen(true);
  }, []);

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
        alert('파일 형식이 올바르지 않습니다. JSON 또는 TXT 형식의 백업 파일을 사용해주세요.');
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


  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleSave = (hero: Hero) => {
    let updated: Hero[];
    if (editing) {
      const existingIdx = heroes.findIndex(h => h.id === hero.id);
      if (existingIdx >= 0) {
        // Normal save (overwrite)
        updated = heroes.map(h => (h.id === hero.id ? hero : h));
      } else {
        // Save As (new ID, append)
        updated = [...heroes, hero];
      }
    } else {
      updated = [...heroes, hero];
    }
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

  const STAT_KEYS = new Set(['power', 'airshipPower', 'hp', 'atk', 'def', 'crit', 'critDmg', 'critAttack', 'evasion', 'threat']);
  const activeCols = activeColumns.filter(c => visibleCols.has(c.key));
  const activeColsNoManage = activeCols.filter(c => c.key !== 'label');
  const tableMaxWidth = (activeCols.length + 1) * 150;

  const handleResetCols = () => {
    const allCols = [...HERO_STAT_COLUMNS, ...CHAMPION_STAT_COLUMNS];
    const all = new Set<string>(allCols.map(c => c.key));
    DEFAULT_HIDDEN_COLS.forEach(k => all.delete(k));
    setVisibleCols(all);
  };
  const handleSelectAllCols = (select: boolean) => {
    if (select) {
      setVisibleCols(new Set(activeColumns.map(c => c.key)));
    } else {
      setVisibleCols(new Set());
    }
  };
  const handleToggleStatCols = (select: boolean) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      STAT_KEYS.forEach(k => { if (select) next.add(k); else next.delete(k); });
      return next;
    });
  };
  const EXPANDED_VISIBLE_KEYS = new Set(['heroClass', 'championName', 'name', 'level', 'rank', 'position', 'label', 'promoted']);

  const renderHeaderLabel = (col: { key: string; label: string; icon?: boolean }) => {
    const iconPath = STAT_ICON_MAP[col.key as keyof typeof STAT_ICON_MAP];
    if (iconPath) {
      return <img src={iconPath} alt={col.label} title={col.label} width={20} height={20} className="inline-block" />;
    }
    return <span>{col.label}</span>;
  };

  const renderCell = (hero: Hero, colKey: string, capture = false) => {
    // Capture-mode classes: use inline-block + align-middle + leading-none for html2canvas compat
    const lh = capture ? 'leading-none' : 'leading-[20px]';
    const iconCls = capture ? 'inline-block align-middle w-5 h-5' : 'w-5 h-5 flex-shrink-0';
    const wrapCls = capture
      ? 'inline-block whitespace-nowrap align-middle leading-none'
      : 'inline-flex items-center gap-1';
    const spacer = capture ? <span className="inline-block w-1" /> : null;

    if (colKey === 'name') {
      // For champions: show custom name only. For heroes: show name as before.
      return (
        <span className={`font-bold text-foreground text-center w-full ${wrapCls} justify-center ${lh}`}>
          <span className={capture ? 'inline-block align-middle leading-none' : ''}>{hero.name}</span>
        </span>
      );
    }
    if (colKey === 'type') {
      return (
        <span className={`${hero.type === 'champion' ? 'text-primary font-medium' : 'text-red-400 font-medium'} ${lh}`}>
          {hero.type === 'champion' ? '챔피언' : '영웅'}
        </span>
      );
    }
    if (colKey === 'classLine') {
      if (!hero.classLine) return <span className="text-muted-foreground">-</span>;
      return <span className={`${lh} ${CLASS_LINE_COLORS[hero.classLine] || 'text-foreground'}`}>{hero.classLine}</span>;
    }
    if (colKey === 'heroClass') {
      // For champions: show champion name + icon + promoted badge
      if (hero.type === 'champion') {
        const isPromoted = hero.promoted;
        if (!hero.championName) return <span className="text-muted-foreground">-</span>;
        return (
          <span className={`${wrapCls} ${lh}`}>
            <img src={getChampionImagePath(hero.championName)} alt="" className={`${iconCls} rounded-full`} onError={e => { e.currentTarget.style.display = 'none'; }} />
            {spacer}
            <span className={`whitespace-nowrap font-bold ${capture ? 'inline-block align-middle leading-none' : ''} ${isPromoted ? 'theme-highlight-40' : ''}`}>{hero.championName}</span>
            {isPromoted && <Award className="w-3.5 h-3.5 theme-highlight-40" />}
          </span>
        );
      }
      if (!hero.heroClass) return <span className="text-muted-foreground">-</span>;
      return (
        <span className={`${wrapCls} ${lh}`}>
          <img src={getJobImagePath(hero.heroClass)} alt="" className={iconCls} onError={e => { e.currentTarget.style.display = 'none'; }} />
          {spacer}
          <span className={`whitespace-nowrap font-bold ${capture ? 'inline-block align-middle leading-none' : ''}`}>{hero.heroClass}</span>
        </span>
      );
    }
    if (colKey === 'championName') {
      if (!hero.championName) return <span className="text-muted-foreground">-</span>;
      return (
        <span className={`${wrapCls} ${lh}`}>
          <img src={getChampionImagePath(hero.championName)} alt="" className={`${iconCls} rounded-full`} onError={e => { e.currentTarget.style.display = 'none'; }} />
          {spacer}
          <span className={capture ? 'inline-block align-middle leading-none' : ''}>{hero.championName}</span>
        </span>
      );
    }
    if (colKey === 'rank') {
      const r = hero.rank || 1;
      const isSpecialChamp = hero.championName === '라인홀드' || hero.championName === '타마스';
      const rankBase = isSpecialChamp ? 4 : 11;
      if (r <= rankBase) return <span className={lh}>{r}</span>;
      return <span className={lh}>{r} ({rankBase}+{r - rankBase})</span>;
    }
    if (colKey === 'element') {
      const elVal = hero.elementValue || 0;
      const isDimEl = elVal === 0;
      return (
        <span className={`${wrapCls} ${lh}`}>
          <ElementIcon element={hero.element} size={20} />
          {spacer}
          <span className={`tabular-nums font-bold ${capture ? 'inline-block align-middle leading-none' : ''} ${isDimEl ? 'text-foreground/20' : 'text-foreground'}`}>{formatNumber(elVal)}</span>
        </span>
      );
    }
    if (colKey === 'skills') {
      const skillPx = capture ? 'px-1' : 'px-1';
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
        if (capture) {
          return (
            <span className="inline-block whitespace-nowrap align-middle leading-none">
              {leaderIcon && <img src={leaderIcon} alt="리더" className="inline-block align-middle w-9 h-9" title="리더 스킬" onError={e => { e.currentTarget.style.display = 'none'; }} />}
              {auraIcon && <img src={auraIcon} alt="오라" className="inline-block align-middle w-9 h-9" title="오라의 노래" onError={e => { e.currentTarget.style.display = 'none'; }} />}
              {!leaderIcon && !auraIcon && <span className="text-muted-foreground">-</span>}
            </span>
          );
        }
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
      if (capture) {
        return (
          <span className="inline-block whitespace-nowrap align-middle leading-none">
            {uniqueImgPath && <img src={uniqueImgPath} alt="고유" className="inline-block align-middle w-9 h-9" title={hero.skills?.[0] || '고유 스킬'} onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <span className="inline-block align-middle w-px h-5 bg-border/50 mx-0.5" style={{ verticalAlign: 'middle' }} />
            {Array.from({ length: 4 }).map((_, i) => {
              const sk = commonSkills[i];
              return sk ? <img key={i} src={getSkillImagePath(sk)} alt={sk} className="inline-block align-middle w-9 h-9" title={sk} onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span key={i} className="inline-block align-middle w-9 h-9" />;
            })}
          </span>
        );
      }
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
      if (capture) {
        return (
          <span className="inline-block whitespace-nowrap align-middle leading-none">
            {slots.slice(0, 2).map((slot: any, i: number) => {
              const item = slot?.item;
              if (!item?.imagePath) return <span key={i} className="inline-block align-middle w-9 h-9 rounded border border-border/30 text-center leading-[36px] text-[7px] text-muted-foreground">-</span>;
              return <img key={i} src={item.imagePath} alt={item.name} className="inline-block align-middle w-9 h-9 object-contain" title={item.name} onError={e => { e.currentTarget.style.display = 'none'; }} />;
            })}
          </span>
        );
      }
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
      return <span className={`${lh} ${!val ? 'text-foreground/20' : ''}`}>{val ? formatNumber(val) : '0'}</span>;
    }
    if (colKey === 'seeds') {
      if (!hero.seeds) return <span className="text-muted-foreground">-</span>;
      if (capture) {
        return (
          <span className="inline-block whitespace-nowrap align-middle leading-none">
            {SEED_ICONS.map(s => {
              const seedVal = hero.seeds?.[s.key as keyof typeof hero.seeds] || 0;
              const seedColor = seedVal === 80 ? 'theme-highlight-80' : seedVal === 40 ? 'theme-highlight-40' : seedVal === 0 ? 'text-foreground/20' : '';
              return (
                <span key={s.key} className="inline-block align-middle mx-0.5">
                  <img src={s.icon} alt="" className="inline-block align-middle w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  <span className={`inline-block align-middle text-xs tabular-nums leading-none ${seedColor}`}>{seedVal}</span>
                </span>
              );
            })}
          </span>
        );
      }
      return (
        <div className="flex items-center gap-1 justify-center h-[20px]">
          {SEED_ICONS.map(s => {
            const seedVal = hero.seeds?.[s.key as keyof typeof hero.seeds] || 0;
            const seedColor = seedVal === 80 ? 'theme-highlight-80' : seedVal === 40 ? 'theme-highlight-40' : seedVal === 0 ? 'text-foreground/20' : '';
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
    if (colKey === 'position') return <span className={lh}>{hero.position || '-'}</span>;
    if (colKey === 'promoted') return <span className={lh}>{hero.promoted ? '✓' : '-'}</span>;
    if (colKey === 'airshipPower') return <span className={`text-foreground/20 ${lh}`}>-</span>;
    if (colKey === 'evasion') {
      const ev = typeof hero.evasion === 'number' ? hero.evasion : 0;
      const isDim = ev === 0;
      return <span className={`${lh} ${isDim ? 'text-foreground/20' : ''}`}>{formatNumber(ev)} %</span>;
    }
    if (colKey === 'level') {
      const lv = hero.level || 0;
      const lvColor = lv >= 50 ? 'theme-highlight-40' : '';
      return <span className={`${lh} ${lvColor} font-bold`}>{lv}</span>;
    }
    const value = hero[colKey as keyof Hero];
    const formatted = formatValue(colKey, value);
    if (formatted !== null) {
      const numVal = typeof value === 'number' ? value : 0;
      const isDim = numVal === 0 || formatted === '0' || formatted === '0 %';
      return <span className={`${lh} ${isDim ? 'text-foreground/20' : ''}`}>{formatted}</span>;
    }
    return <span className={lh}>{String(value ?? '-')}</span>;
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
    const seedColor = (val: number) => val === 80 ? 'theme-highlight-80' : val === 40 ? 'theme-highlight-40' : val === 0 ? 'text-foreground/20' : '';

    return (
      <tr id={`expanded-${hero.id}`} className="bg-primary/10 border-b border-primary/20">
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
                  { icon: STAT_ICON_MAP.airshipPower, value: 0, suffix: '', isAirship: true },
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
                    <span className="text-sm ml-auto tabular-nums">{(s as any).isAirship ? '-' : (s.value ? (() => {
                      if ((s as any).isCritDmg) return `x${(Number(s.value) / 100).toFixed(1)}`;
                      const v = `${formatNumber(s.value)}${s.suffix}`;
                      if ((s as any).isEvasion && s.value) {
                        const cap = (s as any).jobName === '길잡이' ? 78 : 75;
                        if (Number(s.value) > cap) return <>{v} <span className="text-xs text-muted-foreground">({cap}%)</span></>;
                      }
                      return v;
                    })() : '0')}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 py-0.5 px-1">
                  <ElementIcon element={isAllElement ? '모든 원소' : hero.element} size={20} />
                  <span className={`text-sm ml-auto tabular-nums ${!hero.elementValue ? 'text-foreground/20' : 'text-foreground'}`}>{hero.elementValue ? formatNumber(hero.elementValue) : '0'}</span>
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
            <div className="card-fantasy p-3 flex-1 flex flex-col gap-2">
              <h4 className="text-xs font-semibold text-primary" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스킬</h4>
              {isChampion ? (
                <div className="flex flex-col gap-2">
                  {leaderSkillIcon && (
                    <div className="flex items-start gap-2">
                      <img src={leaderSkillIcon} alt="" className="w-10 h-10 flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{leaderSkillName || '리더 스킬'}</p>
                        <p className="text-xs text-foreground/70 mt-0.5 whitespace-pre-line font-normal">{leaderSkillEffect}</p>
                      </div>
                    </div>
                  )}
                  {aurasongSkillIcon && (
                    <div className="flex items-start gap-2">
                      <img src={aurasongSkillIcon} alt="" className="w-10 h-10 flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{aurasongItemName}</p>
                        <p className="text-xs text-foreground/70 mt-0.5 whitespace-pre-line font-normal">{aurasongSkillEffect}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Unique skill */}
                  {hero.heroClass && uniqueSkill && (() => {
                    const uLevelNames = uniqueSkill['레벨별_스킬명'] || [];
                    const uDescs = uniqueSkill['스킬_설명'] || [];
                    const uCurrentName = uLevelNames[uniqueLevelIdx] || uLevelNames[0] || hero.skills?.[0] || '';
                    const uBaseName = uLevelNames[0] || '';
                    const uDesc = uDescs[uniqueLevelIdx] || '';
                    return (
                      <div className="flex items-start gap-2 pb-2 border-b border-border/30">
                        <img src={getUniqueSkillImagePath(hero.heroClass)} alt="" className="w-10 h-10 flex-shrink-0"
                          onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="text-xs font-semibold text-foreground">{uCurrentName}</p>
                            {uBaseName && uBaseName !== uCurrentName && (
                              <span className="text-xs text-foreground/50">({uBaseName})</span>
                            )}
                            <span className={`text-[10px] px-1 py-0.5 rounded ${skillLevelColorClass(uniqueLevelIdx + 1)}`}>Lv.{uniqueLevelIdx + 1}</span>
                          </div>
                          {uDesc && (
                            <p className="text-xs text-foreground/70 mt-0.5 whitespace-pre-line font-normal">{uDesc}</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Common skills */}
                  {hero.skills?.slice(1, 5).map((sk, idx) => {
                    const skData = commonSkillsData[sk];
                    // Calculate skill level from element value thresholds
                    let skLevel = 1;
                    if (skData) {
                      const skThresholds: number[] = skData['원소_기준치']?.map((v: unknown) => Number(v)).filter((v: number) => Number.isFinite(v)) || [];
                      for (let t = 0; t < skThresholds.length; t++) {
                        if (elementVal >= skThresholds[t]) skLevel = t + 1;
                      }
                    }
                    // Cap common skill at level 3 for non-promoted heroes
                    if (!isChampion && !hero.promoted) skLevel = Math.min(skLevel, 3);
                    const cLevelNames = skData?.['레벨별_스킬명'] || [];
                    const cDescs = skData?.['스킬_설명'] || [];
                    const cCurrentName = cLevelNames[skLevel - 1] || sk;
                    const cBaseName = cLevelNames[0] || sk;
                    const cDesc = cDescs[skLevel - 1] || '';
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <img src={getSkillImagePath(sk)} alt="" className="w-10 h-10 flex-shrink-0"
                          onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="text-xs font-semibold text-foreground">{cCurrentName}</p>
                            {cBaseName !== cCurrentName && (
                              <span className="text-xs text-foreground/50">({cBaseName})</span>
                            )}
                            <span className={`text-[10px] px-1 py-0.5 rounded ${skillLevelColorClass(skLevel)}`}>Lv.{skLevel}</span>
                          </div>
                          {cDesc && (
                            <p className="text-xs text-foreground/70 mt-0.5 whitespace-pre-line font-normal">{cDesc}</p>
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
                      <div className="text-foreground/80 font-normal">
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
                            {itemType && <img src={getTypeImagePath(itemType, colorMode)} className="w-8 h-8" alt="" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />}
                          </div>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-foreground truncate w-full text-center mt-0.5 font-bold">{item?.name || '-'}</p>
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
    const isFlipped = flippedCards.has(hero.id);

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

    const handleFlip = (e: React.MouseEvent) => {
      e.stopPropagation();
      setFlippedCards(prev => {
        const next = new Set(prev);
        if (next.has(hero.id)) next.delete(hero.id);
        else next.add(hero.id);
        return next;
      });
    };

    // Stats for back of card
    const critAttack = hero.atk && hero.critDmg ? Math.floor(hero.atk * hero.critDmg / 100) : 0;
    const statItems = [
      { label: 'HP', value: hero.hp, color: 'text-orange-400', lightColor: 'text-orange-500' },
      { label: 'ATK', value: hero.atk, color: 'text-red-400', lightColor: 'text-red-500' },
      { label: 'DEF', value: hero.def, color: 'text-blue-400', lightColor: 'text-blue-500' },
      { label: 'CRIT.C', value: hero.crit, color: 'text-yellow-300', lightColor: 'text-yellow-600', suffix: '%' },
      { label: 'CRIT.D', value: hero.critDmg, color: 'text-yellow-300', lightColor: 'text-yellow-600', format: (v: number) => `x${(v / 100).toFixed(1)}` },
      { label: 'CRIT.A', value: critAttack, color: 'text-yellow-300', lightColor: 'text-yellow-600' },
      { label: 'EVA', value: hero.evasion, color: 'text-teal-300', lightColor: 'text-teal-600', suffix: '%' },
      { label: 'THREAT', value: hero.threat, color: 'text-purple-400', lightColor: 'text-purple-600' },
    ];
    const seeds = hero.seeds || { hp: 0, atk: 0, def: 0 };
    const promotedNameClass = hero.type === 'champion' && hero.promoted ? 'theme-highlight-40' : 'text-foreground';

    return (
      <div key={hero.id} className="album-card-flip-container">
        <div className={`album-card-flip-inner ${isFlipped ? 'flipped' : ''}`}>
          {/* Front face */}
          <div
            className="album-card-front card-fantasy p-3 border-2 rounded-xl flex flex-col items-center gap-1.5 cursor-pointer hover:scale-[1.02] transition-all"
            style={{ borderColor, boxShadow: borderShadow }}
            onClick={handleFlip}
          >
            <div className="w-full py-3">
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
              <p className={`text-sm font-bold inline-flex items-center gap-1 justify-center w-full ${promotedNameClass}`}>
                {hero.name}
                {hero.type === 'champion' && hero.promoted && <Award className="w-3.5 h-3.5 flex-shrink-0 theme-highlight-40" />}
              </p>
              <p className="text-xs text-foreground/60">
                {hero.heroClass && <>{hero.heroClass} / </>}Lv.{hero.level}
              </p>
            </div>

            <div className="min-h-[48px] flex items-center justify-center w-full -mt-1 mb-1">
              {isChampion ? (
                <div className="flex items-center gap-1 justify-center w-full">
                  {leaderSkillIcon && <img src={leaderSkillIcon} alt="리더" className="w-9 h-9" title="리더 스킬" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                  {aurasongIcon && <img src={aurasongIcon} alt="오라" className="w-9 h-9" title="오라의 노래" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                </div>
              ) : (
                hero.skills && hero.skills.length > 0 && (
                  <div className="flex items-center gap-0.5 flex-wrap justify-center w-full">
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
            </div>

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
                          ? { background: `radial-gradient(circle, ${(colorMode === 'light' ? QUALITY_RADIAL_COLOR_LIGHT : QUALITY_RADIAL_COLOR)[quality]} 0%, transparent 85%)`, boxShadow: (colorMode === 'light' ? QUALITY_SHADOW_COLOR_LIGHT : QUALITY_SHADOW_COLOR)[quality] }
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
                          {itemType && <img src={getTypeImagePath(itemType, colorMode)} className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
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
                      style={item ? { background: `radial-gradient(circle, ${(colorMode === 'light' ? QUALITY_RADIAL_COLOR_LIGHT : QUALITY_RADIAL_COLOR)[quality]} 0%, transparent 85%)`, boxShadow: (colorMode === 'light' ? QUALITY_SHADOW_COLOR_LIGHT : QUALITY_SHADOW_COLOR)[quality] } : { background: 'hsl(var(--secondary) / 0.2)' }}
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
                          {itemType && <img src={getTypeImagePath(itemType, colorMode)} className="w-5 h-5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!captureMode && (
              <div className="flex items-center gap-1 mt-auto album-delete-btn">
                <button onClick={(e) => { e.stopPropagation(); setEditing(hero); }} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleCopyHero(hero); }} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary" title="복사">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(hero); }} className="p-1 rounded hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Back face - Stats */}
          <div
            className="album-card-back card-fantasy p-3 border-2 rounded-xl flex flex-col items-center gap-1 cursor-pointer"
            style={{ borderColor, boxShadow: borderShadow }}
            onClick={handleFlip}
          >
            <div className="text-center w-full mb-1">
              <p className={`text-sm font-bold inline-flex items-center gap-1 justify-center w-full ${promotedNameClass}`}>
                {hero.name}
                {hero.type === 'champion' && hero.promoted && <Award className="w-3.5 h-3.5 flex-shrink-0 theme-highlight-40" />}
              </p>
              <p className="text-xs text-foreground/60">
                {hero.heroClass && <>{hero.heroClass} / </>}Lv.{hero.level}
              </p>
            </div>

            {/* Element on top */}
            <div className="flex items-center gap-1">
              <ElementIcon element={hero.element} size={16} />
              <span className={`text-xs tabular-nums font-bold ${(hero.elementValue || 0) === 0 ? 'text-foreground/20' : 'text-foreground'}`}>{hero.elementValue || 0}</span>
            </div>

            <div className="w-full space-y-0.5">
              {statItems.map(s => {
                const val = s.format ? s.format(s.value) : `${formatNumber(s.value)}${s.suffix || ''}`;
                const statColor = s.value ? (colorMode === 'light' ? (s.lightColor || s.color) : s.color) : 'text-foreground/20';
                return (
                  <div key={s.label} className="flex items-center justify-between text-xs px-1">
                    <span className="text-foreground/60 font-medium">{s.label}</span>
                    <span className={`font-bold tabular-nums ${statColor}`}>{val}</span>
                  </div>
                );
              })}
            </div>

            <div className="w-full border-t border-border/30 mt-1 pt-1">
              <p className="text-[10px] text-foreground/50 text-center mb-1">씨앗</p>
              <div className="flex items-center justify-center gap-3">
                {SEED_ICONS.map(si => (
                  <div key={si.key} className="flex items-center gap-0.5">
                    <img src={si.icon} alt={si.label} className="w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    <span className={`text-xs font-bold tabular-nums ${(seeds as any)[si.key] >= 40 ? 'text-accent' : (seeds as any)[si.key] > 0 ? 'text-foreground' : 'text-foreground/20'}`}>
                      {(seeds as any)[si.key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Position & Status dividers */}
            {hero.position && (
              <>
                <div className="w-full border-t border-border/30 mt-0.5 pt-1">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-foreground/50">포지션</span>
                    <span className="font-bold text-foreground/80">{hero.position}</span>
                  </div>
                </div>
              </>
            )}
            {hero.label && (
              <div className="w-full border-t border-border/30 pt-1">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-foreground/50">상태</span>
                  <span className="font-bold text-foreground/80">{hero.label}</span>
                </div>
              </div>
            )}

            {!captureMode && (
              <div className="flex items-center gap-1 mt-auto album-delete-btn">
                <button onClick={(e) => { e.stopPropagation(); setEditing(hero); }} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleCopyHero(hero); }} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary" title="복사">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(hero); }} className="p-1 rounded hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="animate-fade-in">
      {/* Tab: Hero / Champion / Summary + View mode + Add buttons */}
      <div className="flex items-center justify-between mb-0">
        <div className="flex items-end gap-0 border-b border-border w-full">
          <div className="flex items-end gap-0">
            {([
              { id: 'hero' as const, label: `영웅 목록 (${heroList.length})`, icon: Shield, active: listTab === 'hero' && !summaryOpen, onClick: () => { setListTab('hero'); setSummaryOpen(false); } },
              { id: 'champion' as const, label: `챔피언 목록 (${championList.length})`, icon: Crown, active: listTab === 'champion' && !summaryOpen, onClick: () => { setListTab('champion'); setSummaryOpen(false); } },
              { id: 'summary' as const, label: '리스트 요약', icon: BarChart3, active: summaryOpen, onClick: () => setSummaryOpen(true) },
            ]).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={tab.onClick}
                  data-active={String(tab.active)}
                  className={`sub-tab-bookmark text-sm font-medium
                    ${tab.active
                      ? 'text-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 transition-transform duration-300 ${tab.active ? 'scale-110' : ''}`} />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          {summaryOpen && (
            <div className="flex items-center gap-2 pb-1">
              <Button onClick={() => summaryHandleRef.current?.takeScreenshot()} variant="outline" size="sm" className="gap-1 text-xs h-8 px-2" title="스크린샷 저장">
                <Camera className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          {!summaryOpen && (
            <div className="flex items-center gap-2 pb-1">
               <Button onClick={() => setAddingType('hero')} className="gap-1.5 text-xs font-medium h-[32px] px-3 bg-primary hover:bg-primary/80 btn-force-white" style={{ color: 'white' }}>
                <Shield className="w-3.5 h-3.5" style={{ color: 'white' }} /> 새 영웅 추가
               </Button>
               <Button onClick={() => setAddingType('champion')} className="gap-1.5 text-xs font-medium h-[32px] px-3 bg-accent hover:bg-accent/80 btn-force-white" style={{ color: 'white' }}>
                <Crown className="w-3.5 h-3.5" style={{ color: 'white' }} /> 새 챔피언 추가
               </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Button onClick={handleExport} variant="outline" size="sm" className="gap-1 text-xs h-8 px-2" title="리스트 저장하기">
                <Save className="w-3.5 h-3.5" />
              </Button>
              <input ref={importInputRef} type="file" accept=".json,.txt" className="sr-only" tabIndex={-1} onChange={handleImportFile} />
              <Button
                onClick={() => importInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="gap-1 text-xs h-8 px-2 cursor-pointer"
                title="리스트 불러오기"
              >
                <Upload className="w-3.5 h-3.5" />
              </Button>
              <Button onClick={() => {
                if (viewMode === 'table') {
                  handleScreenshot(tableContentRef, 'list');
                } else {
                  handleScreenshot(albumContentRef, 'album');
                }
              }} variant="outline" size="sm" className="gap-1 text-xs h-8 px-2" title="스크린샷 저장" disabled={screenshotLoading}>
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
      </div>

      {summaryOpen ? (
        <div ref={listRef} className="mt-3">
          <ListSummary ref={summaryHandleRef} heroes={heroes} />
        </div>
      ) : viewMode === 'table' ? (
        <div ref={listRef}>
          {/* Column visibility - table only */}
          <div className="card-fantasy p-3 mb-3 mt-3">
            <div className="flex flex-wrap gap-3">
              {activeColumns.map(col => (
                <label key={col.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={visibleCols.has(col.key)} onCheckedChange={() => toggleCol(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" className="text-xs h-7 px-2 bg-primary/20 text-primary border-primary/40 hover:bg-primary/30" onClick={handleResetCols}>초기화</Button>
              <Button variant="outline" size="sm" className="text-xs h-7 px-2 bg-primary/20 text-primary border-primary/40 hover:bg-primary/30" onClick={() => handleSelectAllCols(true)}>전체 선택</Button>
              <Button variant="outline" size="sm" className="text-xs h-7 px-2 bg-primary/20 text-primary border-primary/40 hover:bg-primary/30" onClick={() => handleSelectAllCols(false)}>전체 해제</Button>
              <Button variant="outline" size="sm" className="text-xs h-7 px-2 bg-primary/20 text-primary border-primary/40 hover:bg-primary/30" onClick={() => handleToggleStatCols(true)}>스탯 선택</Button>
              <Button variant="outline" size="sm" className="text-xs h-7 px-2 bg-primary/20 text-primary border-primary/40 hover:bg-primary/30" onClick={() => handleToggleStatCols(false)}>스탯 해제</Button>
              <Button variant="outline" size="sm" className="text-xs h-7 px-2 bg-primary/20 text-primary border-primary/40 hover:bg-primary/30" onClick={() => {
                const screenshotKeys = new Set(['heroClass', 'name', 'level', 'element', 'skills']);
                setVisibleCols(screenshotKeys);
              }}>스크린샷용</Button>

            </div>
          </div>

          {/* Table View */}
          <div ref={tableContentRef} data-screenshot-target className="card-fantasy overflow-x-auto scrollbar-fantasy mx-auto" style={{ maxWidth: `${tableMaxWidth}px` }}>
            <table className="w-full text-sm font-bold">
              <thead>
                <tr className="border-b border-border bg-primary/[0.12] table-header-row">
                  {activeCols.map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      className={`${col.key === 'skills' ? 'px-1' : 'px-3'} py-3 font-bold cursor-pointer hover:text-primary transition-colors select-none text-foreground text-center ${
                        col.key === 'heroClass' || col.key === 'name' ? 'min-w-[110px]' : ''
                      } ${col.key === 'championName' ? 'min-w-[100px]' : ''} ${col.key === 'skills' ? (listTab === 'champion' ? 'min-w-[80px]' : 'min-w-[150px]') : ''} ${col.key === 'equipment' ? 'min-w-[80px]' : ''} ${col.key === 'seeds' ? 'min-w-[120px]' : ''} ${(col.key === 'position' || col.key === 'label') ? 'min-w-[90px]' : ''}`}>
                      <span className="flex items-center gap-1 justify-center">
                        {renderHeaderLabel(col)}
                        {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </span>
                    </th>
                  ))}
                  {!captureMode && (
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
                  )}
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
                        className={`border-b border-border/50 transition-colors cursor-pointer select-none even:bg-primary/[0.12] ${
                          isExpanded ? 'bg-primary/[0.07]' : ''
                        } table-zebra-row`}
                        style={{ height: '52px' }}
                      >
                      {activeCols.map(col => {
                          if (isExpanded && !EXPANDED_VISIBLE_KEYS.has(col.key)) {
                            return <td key={col.key} className={`${col.key === 'skills' ? 'px-1' : 'px-3'} py-1 text-center`} style={{ verticalAlign: 'middle' }}><div className={captureMode ? '' : 'h-[36px]'} /></td>;
                          }
                          return (
                            <td key={col.key} className={`${col.key === 'skills' ? 'px-1' : 'px-3'} py-1 text-center`} style={{ verticalAlign: 'middle' }}>
                              {captureMode ? (
                                renderCell(hero, col.key, true)
                              ) : (
                                <div className="flex items-center justify-center h-[36px]">
                                  {renderCell(hero, col.key)}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        {!captureMode && (
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
                        )}
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
           <div className="card-fantasy p-3 mb-3 mt-3 flex flex-wrap items-center gap-3">
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
                      <SelectItem value="heroClass">직업</SelectItem>
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
          <div ref={albumContentRef} data-screenshot-target className="grid grid-cols-6 gap-3">
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

      {/* Save list dialog */}
      <SaveListDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen} heroes={heroes} />
    </div>
  );
}
