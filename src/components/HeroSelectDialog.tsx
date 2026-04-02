import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Hero, ELEMENT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { LayoutGrid, Table2, Filter, X, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getJobImagePath, getJobIllustPath, getChampionImagePath, CHAMPION_NAME_MAP, SPIRIT_NAME_MAP } from '@/lib/nameMap';
import { getSkillImagePath, getUniqueSkillImagePath } from '@/lib/skillUtils';
import { getAurasongSkillIconPath } from '@/lib/championEquipUtils';
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
  barrierElements?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASS_LINE_BORDER_COLOR: Record<string, string> = {
  '전사': '#ef4444',
  '로그': '#84cc16',
  '주문술사': '#38bdf8',
};
const CLASS_LINE_SHADOW: Record<string, string> = {
  '전사': '0 0 12px rgba(239,68,68,0.3)',
  '로그': '0 0 12px rgba(132,204,22,0.3)',
  '주문술사': '0 0 12px rgba(56,189,248,0.3)',
};

const POSITION_BG_COLORS: Record<string, string> = {
  '퓨어 탱커': 'bg-blue-500',
  '회피 탱커': 'bg-emerald-600',
  '딜탱': 'bg-orange-500',
  '치명 딜러': 'bg-red-500',
  '일반 딜러': 'bg-yellow-500',
  '회피 딜러': 'bg-cyan-500',
  '좀비': 'bg-purple-500',
  '첫 턴 극딜': 'bg-pink-500',
  '기타': 'bg-secondary',
};

const CLASS_LINE_ORDER: Record<string, number> = { '전사': 0, '로그': 1, '주문술사': 2 };

const JOB_ORDER: Record<string, number> = {};
let _idx = 0;
for (const [, jobs] of Object.entries(HERO_CLASS_MAP)) {
  for (const job of jobs) { JOB_ORDER[job] = _idx++; }
}

const PROMOTED_JOBS = new Set<string>();
for (const jobs of Object.values(HERO_CLASS_MAP)) {
  for (let i = 1; i < jobs.length; i += 2) PROMOTED_JOBS.add(jobs[i]);
}

function getJobSortKey(hero: Hero): number {
  return (CLASS_LINE_ORDER[hero.classLine] ?? 99) * 10000 + (JOB_ORDER[hero.heroClass] ?? 999) * 10 + (PROMOTED_JOBS.has(hero.heroClass) ? 1 : 0);
}

const JOB_FILTER_ORDER = [
  '병사', '용병', '야만전사', '족장', '기사', '군주', '레인저', '관리인', '사무라이', '다이묘', '광전사', '잘', '어둠의 기사', '죽음의 기사',
  '도둑', '사기꾼', '수도승', '그랜드 마스터', '머스킷병', '정복자', '방랑자', '길잡이', '닌자', '센세', '무희', '곡예가', '경보병', '근위병',
  '마법사', '대마법사', '성직자', '비숍', '드루이드', '아크 드루이드', '소서러', '워록', '마법검', '스펠나이트', '풍수사', '아스트라맨서', '크로노맨서', '페이트위버',
];

type SortKey = 'heroClass' | 'level' | 'power' | 'atk' | 'def' | 'hp' | 'name' | 'crit' | 'critDmg' | 'evasion' | 'element' | 'position';
type JobImageMode = 'icon' | 'illust' | 'none';

// Equipment quality styles
const QUALITY_BORDER: Record<string, string> = {
  common: 'border-gray-300/50', uncommon: 'border-green-400/60',
  flawless: 'border-cyan-300/60', epic: 'border-fuchsia-400/70', legendary: 'border-yellow-400/80',
};
const QUALITY_RADIAL: Record<string, string> = {
  common: 'rgba(100,100,115,0.35)', uncommon: 'rgba(74,222,128,0.32)',
  flawless: 'rgba(103,232,249,0.38)', epic: 'rgba(217,70,239,0.42)', legendary: 'rgba(250,204,21,0.5)',
};
const QUALITY_SHADOW: Record<string, string> = {
  common: '0 0 10px rgba(220,220,220,0.5)', uncommon: '0 0 12px rgba(74,222,128,0.6)',
  flawless: '0 0 14px rgba(103,232,249,0.6)', epic: '0 0 16px rgba(217,70,239,0.7)', legendary: '0 0 18px rgba(250,204,21,0.8)',
};
const ELEMENT_ENG: Record<string, string> = {
  '불': 'fire', '물': 'water', '공기': 'air', '대지': 'earth', '빛': 'light', '어둠': 'dark',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HeroSelectDialog({ open, onOpenChange, heroes, selectedIds, maxMembers, minPower, onConfirm, editingSlotIdx, barrierElements = [] }: Props) {
  const [viewMode, setViewMode] = useState<'table' | 'album'>('table');
  const [localIds, setLocalIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('heroClass');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClassLine, setFilterClassLine] = useState<string>('all');
  const [filterElement, setFilterElement] = useState<string>('all');
  const [filterJob, setFilterJob] = useState<string>('all');
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [jobImageMode, setJobImageMode] = useState<JobImageMode>('icon');

  useEffect(() => {
    if (open) setLocalIds(new Set(selectedIds));
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc'); // 내림차순부터
    }
  };

  const filtered = useMemo(() => {
    let list = [...heroes];
    if (filterType !== 'all') list = list.filter(h => h.type === filterType);
    if (filterClassLine !== 'all') list = list.filter(h => h.classLine === filterClassLine);
    if (filterElement !== 'all') list = list.filter(h => h.element === filterElement);
    if (filterJob !== 'all') list = list.filter(h => h.heroClass === filterJob);
    if (filterPosition !== 'all') list = list.filter(h => h.position === filterPosition);
    if (sortKey === 'heroClass') {
      list.sort((a, b) => { const ak = getJobSortKey(a), bk = getJobSortKey(b); return sortDir === 'asc' ? ak - bk : bk - ak; });
    } else if (sortKey === 'name') {
      list.sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (sortKey === 'element') {
      // If barrier elements exist, sort by barrier-matching elements first
      if (barrierElements.length > 0) {
        const SPELLKNIGHT_CLASSES = ['마법검', '스펠나이트'];
        const hasBarrierMatch = (h: Hero) => {
          if (SPELLKNIGHT_CLASSES.includes(h.heroClass)) return true; // all elements
          if (h.element === '모든 원소') return true;
          return barrierElements.includes(h.element || '');
        };
        const getElementVal = (h: Hero) => h.elementValue || 0;
        list.sort((a, b) => {
          const aMatch = hasBarrierMatch(a) ? 1 : 0;
          const bMatch = hasBarrierMatch(b) ? 1 : 0;
          if (sortDir === 'desc') {
            if (aMatch !== bMatch) return bMatch - aMatch;
            return getElementVal(b) - getElementVal(a);
          } else {
            if (aMatch !== bMatch) return aMatch - bMatch;
            return getElementVal(a) - getElementVal(b);
          }
        });
      } else {
        list.sort((a, b) => sortDir === 'asc' ? (a.element || '').localeCompare(b.element || '') : (b.element || '').localeCompare(a.element || ''));
      }
    } else if (sortKey === 'position') {
      list.sort((a, b) => sortDir === 'asc' ? (a.position || '').localeCompare(b.position || '') : (b.position || '').localeCompare(a.position || ''));
    } else if (sortKey === 'critDmg') {
      // Sort by computed crit damage (atk * critDmg / 100)
      list.sort((a, b) => {
        const av = a.critDmg > 0 ? Math.round(a.atk * a.critDmg / 100) : 0;
        const bv = b.critDmg > 0 ? Math.round(b.atk * b.critDmg / 100) : 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    } else {
      list.sort((a, b) => { const av = (a as any)[sortKey] ?? 0, bv = (b as any)[sortKey] ?? 0; return sortDir === 'asc' ? av - bv : bv - av; });
    }
    return list;
  }, [heroes, filterType, filterClassLine, filterElement, filterJob, filterPosition, sortKey, sortDir]);

  const handleToggle = (heroId: string) => {
    setLocalIds(prev => {
      const next = new Set(prev);
      if (next.has(heroId)) {
        next.delete(heroId);
      } else if (next.size < maxMembers) {
        next.add(heroId);
      }
      return next;
    });
  };

  const isFull = localIds.size >= maxMembers;
  const selectedHeroes = Array.from(localIds).map(id => heroMap.get(id)).filter(Boolean) as Hero[];
  const hasChampion = selectedHeroes.some(h => h.type === 'champion');

  const cycleJobMode = () => setJobImageMode(m => m === 'icon' ? 'illust' : m === 'illust' ? 'none' : 'icon');
  const jobModeLabel = jobImageMode === 'icon' ? '🎭' : jobImageMode === 'illust' ? '🖼️' : '✖';

  // Sort indicator
  const sortIndicator = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  // ─── Manual overlay helper ────────────────────────────────────────────────
  const ManualOverlay = () => (
    <div className="absolute bottom-0 right-0 w-3 h-3 bg-background/80 rounded-tl flex items-center justify-center">
      <HelpCircle className="w-2.5 h-2.5 text-yellow-400" />
    </div>
  );

  // ─── Render Equipment Slot (album) ──────────────────────────────────────────
  const renderEquipSlot = (slot: any, idx: number) => {
    const item = slot?.item || null;
    const isManual = item?.manual;
    const quality = slot?.quality || 'common';
    const displayElement = slot?.element || (item?.uniqueElement?.length ? { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true } : null);
    const displaySpirit = slot?.spirit || (item?.uniqueSpirit?.length ? { name: item.uniqueSpirit[0], affinity: true } : null);
    return (
      <div key={idx}
        className={`rounded border ${item ? QUALITY_BORDER[quality] || 'border-border/30' : 'border-border/30'} flex flex-col items-center overflow-hidden`}
        style={item ? {
          background: `radial-gradient(circle, ${QUALITY_RADIAL[quality] || ''} 0%, transparent 85%)`,
          boxShadow: `0 0 4px ${(QUALITY_RADIAL[quality] || 'transparent').replace(/[\d.]+\)$/, '0.3)')}`,
        } : { background: 'hsl(var(--secondary) / 0.2)' }}>
        <div className="relative w-full flex items-center justify-center pt-0.5">
          {item?.imagePath
            ? <img src={item.imagePath} alt="" className="w-8 h-8 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
            : <span className="text-[6px] text-muted-foreground/40 py-1">-</span>
          }
          {isManual && <ManualOverlay />}
        </div>
        {item && (displayElement || displaySpirit) && (
          <div className="flex items-center justify-center gap-0.5 pb-0.5">
            {displayElement && (
              <img src={`/images/enchant/element/${ELEMENT_ENG[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.webp`}
                className="w-4 h-4" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
            )}
            {displaySpirit && (() => {
              const eng = SPIRIT_NAME_MAP[displaySpirit.name];
              if (displaySpirit.name === '문드라') return <img src="/images/enchant/spirit/mundra.webp" className="w-4 h-4" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />;
              return eng ? <img src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.webp`} className="w-4 h-4" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
            })()}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl w-[98vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0" hideCloseButton>
        {/* ─── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <h2 className="text-lg text-primary font-bold">파티원 선택</h2>
          <div className="flex gap-1">
            <button onClick={() => setViewMode('table')} className={`p-2 rounded ${viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Table2 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('album')} className={`p-2 rounded ${viewMode === 'album' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Selected heroes summary ─────────────────────────────────────── */}
        {selectedHeroes.length > 0 && (
          <div className="px-5 pb-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{selectedHeroes.length}/{maxMembers}</span>
              {selectedHeroes.map(h => {
                const imgPath = h.type === 'champion' && h.championName ? getChampionImagePath(h.championName) : h.heroClass ? getJobImagePath(h.heroClass) : '';
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

        {/* ─── Filters ──────────────────────────────────────────────── */}
        <div className="px-5 pb-2 flex flex-wrap items-center gap-2 shrink-0">
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
        </div>

        {/* ─── Content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto px-2 overscroll-contain">
          {viewMode === 'table' ? (
            // ─── TABLE VIEW ───────────────────────────────────────────────────
            <table className="w-full text-xs min-w-[900px]">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">유형</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap cursor-pointer hover:text-primary select-none" onClick={() => handleSort('heroClass')}>
                    직업{sortIndicator('heroClass')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap cursor-pointer hover:text-primary select-none" onClick={() => handleSort('name')}>
                    이름{sortIndicator('name')}
                  </th>
                  <th className="text-center py-2 px-1.5 cursor-pointer hover:text-primary select-none" onClick={() => handleSort('level')}>
                    Lv{sortIndicator('level')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap cursor-pointer hover:text-primary select-none" onClick={() => handleSort('element')}>
                    원소{sortIndicator('element')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">스킬</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap cursor-pointer hover:text-primary select-none text-yellow-400" onClick={() => handleSort('power')}>
                    전투력{sortIndicator('power')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap cursor-pointer hover:text-primary select-none text-red-400" onClick={() => handleSort('atk')}>
                    공격력{sortIndicator('atk')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap cursor-pointer hover:text-primary select-none text-blue-400" onClick={() => handleSort('def')}>
                    방어력{sortIndicator('def')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap cursor-pointer hover:text-primary select-none text-orange-400" onClick={() => handleSort('hp')}>
                    체력{sortIndicator('hp')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap text-yellow-400 cursor-pointer hover:text-primary select-none" onClick={() => handleSort('crit')}>
                    치확{sortIndicator('crit')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap text-yellow-400 cursor-pointer hover:text-primary select-none" onClick={() => handleSort('critDmg')}>
                    치명타 대미지{sortIndicator('critDmg')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap text-teal-400 cursor-pointer hover:text-primary select-none" onClick={() => handleSort('evasion')}>
                    회피{sortIndicator('evasion')}
                  </th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap cursor-pointer hover:text-primary select-none" onClick={() => handleSort('position')}>
                    포지션{sortIndicator('position')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(hero => {
                  const isSelected = localIds.has(hero.id);
                  const isOtherChampion = hero.type === 'champion' && hasChampion && !isSelected;
                  const disabled = (isFull && !isSelected) || isOtherChampion;
                  const belowMin = hero.power > 0 && hero.power < minPower;
                  // 직업 column: hero=job icon+name, champion=champion icon+name
                  const jobIconPath = hero.type === 'champion' && hero.championName
                    ? getChampionImagePath(hero.championName)
                    : hero.heroClass ? getJobImagePath(hero.heroClass) : '';
                  const jobLabel = hero.type === 'champion'
                    ? (hero.championName || hero.name)
                    : (hero.heroClass || '-');
                  const illustPath = hero.type === 'champion' && hero.championName
                    ? getChampionImagePath(hero.championName)
                    : hero.heroClass ? getJobIllustPath(hero.heroClass) : '';
                  const critDmgDisplay = hero.critDmg > 0 ? Math.round(hero.atk * hero.critDmg / 100) : 0;
                  return (
                    <tr key={hero.id}
                      onClick={() => !disabled && handleToggle(hero.id)}
                      className={`border-b border-border/30 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/30 border-primary/50' : disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-secondary/30'
                      }`}
                      title={isOtherChampion ? '파티에 챔피언은 1명만 가능' : undefined}>
                      {/* 유형 */}
                      <td className="py-1.5 px-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${hero.type === 'champion' ? 'bg-purple-600' : 'bg-sky-600'}`}>
                          {hero.type === 'champion' ? '챔피언' : '영웅'}
                        </span>
                      </td>
                      {/* 직업: hero=job icon+name, champion=champion icon+name */}
                      <td className="py-1.5 px-1 text-center">
                        {jobImageMode === 'illust' ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-28 h-28 overflow-hidden rounded border border-border/30 bg-secondary/20">
                              {illustPath
                                ? <img src={illustPath} alt="" className="w-full h-full object-cover" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                                : null}
                            </div>
                            <span className="text-[10px] whitespace-nowrap text-muted-foreground">{jobLabel}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-center">
                            {jobIconPath && <img src={jobIconPath} alt="" className="w-5 h-5 rounded-full" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                            <span className="text-xs whitespace-nowrap text-muted-foreground">{jobLabel}</span>
                          </div>
                        )}
                      </td>
                      {/* 이름: just name text, no icon */}
                      <td className="py-1.5 px-1.5 text-center font-bold text-foreground">
                        <div className="flex items-center gap-1 justify-center">
                          {belowMin && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                          <span className="whitespace-nowrap">{hero.name}</span>
                        </div>
                      </td>
                      {/* Lv */}
                      <td className="py-1.5 px-1 text-center font-bold text-muted-foreground">{hero.level}</td>
                      {/* 원소 */}
                      <td className="py-1.5 px-1 text-center">
                        <div className="flex items-center gap-0.5 justify-center">
                          <ElementIcon element={hero.element} size={14} />
                          <span className={`text-[10px] tabular-nums ${!hero.elementValue ? 'text-foreground/20' : 'text-foreground'}`}>{hero.elementValue || 0}</span>
                        </div>
                      </td>
                      {/* 스킬 */}
                      <td className="py-1.5 px-1 text-center">
                        <div className="flex items-center gap-0.5 justify-center flex-wrap">
                          {hero.type === 'champion' ? (
                            <>
                              {(() => {
                                const champEng = hero.championName ? CHAMPION_NAME_MAP[hero.championName] : '';
                                const tier = hero.cardLevel || 1;
                                const leaderIcon = champEng ? `/images/skills/sk_champion/${champEng}_${tier}.webp` : '';
                                return leaderIcon ? <img src={leaderIcon} alt="리더" className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                              })()}
                              {(() => {
                                const aurasongItem = hero.equipmentSlots?.[1]?.item;
                                if (!aurasongItem) return null;
                                const isManual = aurasongItem.manual;
                                const auraIcon = getAurasongSkillIconPath(aurasongItem.name);
                                return auraIcon ? (
                                  <div className="relative">
                                    <img src={auraIcon} alt="오라" className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                    {isManual && <ManualOverlay />}
                                  </div>
                                ) : null;
                              })()}
                            </>
                          ) : (
                            <>
                              {hero.heroClass && (
                                <img src={getUniqueSkillImagePath(hero.heroClass)} alt="" className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                              )}
                              {hero.skills?.slice(1, 5).map((sk, i) => sk ? (
                                <img key={i} src={getSkillImagePath(sk)} alt={sk} title={sk} className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                              ) : null)}
                            </>
                          )}
                        </div>
                      </td>
                      {/* 전투력 */}
                      <td className={`py-1.5 px-1 text-center font-mono font-bold ${belowMin ? 'text-red-400' : 'text-yellow-400'}`}>
                        {hero.power > 0 ? formatNumber(hero.power) : '-'}
                      </td>
                      {/* 공격력 */}
                      <td className="py-1.5 px-1 text-center font-mono font-bold text-red-400">{formatNumber(hero.atk)}</td>
                      {/* 방어력 */}
                      <td className="py-1.5 px-1 text-center font-mono font-bold text-blue-400">{formatNumber(hero.def)}</td>
                      {/* 체력 */}
                      <td className="py-1.5 px-1 text-center font-mono font-bold text-orange-400">{formatNumber(hero.hp)}</td>
                      {/* 치확 */}
                      <td className="py-1.5 px-1 text-center font-mono font-bold text-yellow-400">{hero.crit > 0 ? `${formatNumber(hero.crit)}%` : '-'}</td>
                      {/* 치명타 대미지 */}
                      <td className="py-1.5 px-1 text-center font-mono font-bold text-yellow-400">{critDmgDisplay > 0 ? formatNumber(critDmgDisplay) : '-'}</td>
                      {/* 회피 */}
                      <td className="py-1.5 px-1 text-center font-mono font-bold text-teal-400">{hero.evasion > 0 ? `${formatNumber(hero.evasion)}%` : '-'}</td>
                      {/* 포지션 */}
                      <td className="py-1.5 px-1 text-center text-[10px] whitespace-nowrap">
                        {hero.position ? (
                          <span className={`px-1.5 py-0.5 rounded ${POSITION_BG_COLORS[hero.position] || 'bg-secondary'} text-white`}>{hero.position}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            // ─── ALBUM VIEW ───────────────────────────────────────────────────
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 py-1">
              {filtered.map(hero => {
                const isSelected = localIds.has(hero.id);
                const isOtherChampion = hero.type === 'champion' && hasChampion && !isSelected;
                const disabled = (isFull && !isSelected) || isOtherChampion;
                const belowMin = hero.power > 0 && hero.power < minPower;
                const isChampion = hero.type === 'champion';
                const illustPath = isChampion && hero.championName
                  ? getChampionImagePath(hero.championName)
                  : hero.heroClass ? getJobIllustPath(hero.heroClass) : '';
                const borderColor = hero.classLine ? (CLASS_LINE_BORDER_COLOR[hero.classLine] || '#6b7280') : '#a855f7';
                const boxShadow = hero.classLine ? (CLASS_LINE_SHADOW[hero.classLine] || 'none') : '0 0 12px rgba(168,85,247,0.3)';
                const equipSlots = hero.equipmentSlots || Array.from({ length: isChampion ? 2 : 6 }, () => ({ item: null, quality: 'common', element: null, spirit: null }));

                // Champion leader skill icon
                const champLeaderIcon = isChampion && hero.championName
                  ? (() => {
                      const champEng = CHAMPION_NAME_MAP[hero.championName] || '';
                      const tier = hero.cardLevel || 1;
                      return champEng ? `/images/skills/sk_champion/${champEng}_${tier}.webp` : '';
                    })()
                  : '';

                return (
                  <button key={hero.id}
                    onClick={() => !disabled && handleToggle(hero.id)}
                    disabled={disabled}
                    className={`card-fantasy p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                      disabled ? 'opacity-30 cursor-not-allowed' : 'hover:scale-[1.02]'
                    }`}
                    style={{
                      borderColor,
                      boxShadow: isSelected
                        ? `0 0 0 3px hsl(var(--primary) / 0.8), ${boxShadow}`
                        : boxShadow,
                      outline: isSelected ? '2px solid hsl(var(--primary))' : 'none',
                      outlineOffset: '1px',
                    }}>
                    {belowMin && <div className="w-2 h-2 rounded-full bg-red-500" />}
                    {/* Illustration */}
                    <div className="w-full rounded-lg bg-secondary/20 py-1">
                      <div className="w-full aspect-square flex items-center justify-center overflow-hidden">
                        {illustPath
                          ? <img src={illustPath} alt={hero.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          : <span className="text-muted-foreground text-xs">{hero.name}</span>}
                      </div>
                    </div>
                    {/* Name + class */}
                    <div className="text-center w-full">
                      <p className="text-xs font-bold text-foreground truncate">{hero.name}</p>
                      <p className="text-[10px] text-foreground/60 truncate">
                        {hero.heroClass || hero.championName || ''} {hero.level > 0 && `Lv.${hero.level}`}
                      </p>
                    </div>
                    {/* Element */}
                    <div className="flex items-center gap-1">
                      <ElementIcon element={hero.element} size={14} />
                      <span className={`text-[10px] tabular-nums ${!hero.elementValue ? 'text-foreground/20' : 'text-foreground'}`}>{hero.elementValue || 0}</span>
                    </div>
                    {/* Skills */}
                    {isChampion ? (
                      <div className="flex items-center gap-1 justify-center flex-wrap">
                        {champLeaderIcon && <img src={champLeaderIcon} alt="리더" className="w-7 h-7" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                        {(() => {
                          const aurasongItem = hero.equipmentSlots?.[1]?.item;
                          if (!aurasongItem) return null;
                          const isManual = aurasongItem.manual;
                          const auraIcon = getAurasongSkillIconPath(aurasongItem.name);
                          return auraIcon ? (
                            <div className="relative">
                              <img src={auraIcon} alt="오라" className="w-7 h-7" onError={e => { e.currentTarget.style.display = 'none'; }} />
                              {isManual && <ManualOverlay />}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    ) : (
                      hero.skills && hero.skills.length > 0 && (
                        <div className="flex items-center gap-0.5 flex-wrap justify-center">
                          {hero.heroClass && (
                            <img src={getUniqueSkillImagePath(hero.heroClass)} alt="" className="w-7 h-7" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          )}
                          {hero.skills.slice(1, 5).map((sk, i) => (
                            <img key={i} src={getSkillImagePath(sk)} alt={sk} title={sk} className="w-7 h-7" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          ))}
                        </div>
                      )
                    )}
                    {/* Equipment */}
                    <div className="grid grid-cols-3 gap-0.5 w-full">
                      {isChampion ? (
                        <>
                          <div />
                          {equipSlots.slice(0, 2).map((slot: any, i: number) => renderEquipSlot(slot, i))}
                        </>
                      ) : (
                        equipSlots.map((slot: any, i: number) => renderEquipSlot(slot, i))
                      )}
                    </div>
                    {/* Power */}
                    {hero.power > 0 && (
                      <span className={`text-[10px] font-mono ${belowMin ? 'text-red-400' : 'text-yellow-400'}`}>{formatNumber(hero.power)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" onClick={() => onConfirm(localIds)}>확인 ({localIds.size}/{maxMembers})</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
