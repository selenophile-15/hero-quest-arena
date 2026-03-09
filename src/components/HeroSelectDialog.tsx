import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Hero, ELEMENT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutGrid, Table2, Filter, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getJobImagePath, getJobIllustPath, getChampionImagePath, CHAMPION_NAME_MAP, SPIRIT_NAME_MAP } from '@/lib/nameMap';
import { getSkillImagePath, getUniqueSkillImagePath } from '@/lib/skillUtils';
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

type SortKey = 'heroClass' | 'level' | 'power' | 'atk' | 'def' | 'hp' | 'name';
type JobImageMode = 'icon' | 'illust' | 'none';

// Equipment quality styles
const QUALITY_BORDER: Record<string, string> = {
  common: 'border-gray-300/50', uncommon: 'border-green-400/60',
  flawless: 'border-cyan-300/60', epic: 'border-fuchsia-400/70', legendary: 'border-yellow-400/80',
};
const QUALITY_RADIAL: Record<string, string> = {
  common: 'rgba(220,220,220,0.28)', uncommon: 'rgba(74,222,128,0.32)',
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
    } else {
      list.sort((a, b) => { const av = (a as any)[sortKey] ?? 0, bv = (b as any)[sortKey] ?? 0; return sortDir === 'asc' ? av - bv : bv - av; });
    }
    return list;
  }, [heroes, filterType, filterClassLine, filterElement, filterJob, filterPosition, sortKey, sortDir]);

  const handleToggle = (heroId: string) => {
    if (editingSlotIdx !== null) {
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

  const isFull = localIds.size >= maxMembers;
  const selectedHeroes = Array.from(localIds).map(id => heroMap.get(id)).filter(Boolean) as Hero[];

  const cycleJobMode = () => setJobImageMode(m => m === 'icon' ? 'illust' : m === 'illust' ? 'none' : 'icon');
  const jobModeLabel = jobImageMode === 'icon' ? '🎭' : jobImageMode === 'illust' ? '🖼️' : '✖';

  // ─── Render Equipment Slot (album) ──────────────────────────────────────────
  const renderEquipSlot = (slot: any, idx: number) => {
    const item = slot?.item || null;
    const quality = slot?.quality || 'common';
    const displayElement = slot?.element || (item?.uniqueElement?.length ? { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true } : null);
    const displaySpirit = slot?.spirit || (item?.uniqueSpirit?.length ? { name: item.uniqueSpirit[0], affinity: true } : null);
    return (
      <div key={idx}
        className={`rounded border ${item ? QUALITY_BORDER[quality] || 'border-border/30' : 'border-border/30'} flex flex-col items-center overflow-hidden`}
        style={item ? {
          background: `radial-gradient(circle, ${QUALITY_RADIAL[quality] || ''} 0%, transparent 85%)`,
          boxShadow: QUALITY_SHADOW[quality] || '',
        } : { background: 'hsl(var(--secondary) / 0.2)' }}>
        <div className="relative w-full flex items-center justify-center pt-0.5">
          {item?.imagePath
            ? <img src={item.imagePath} alt="" className="w-8 h-8 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
            : <span className="text-[6px] text-muted-foreground/40 py-1">-</span>
          }
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
      <DialogContent className="sm:max-w-7xl w-[98vw] max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0" hideCloseButton>
        {/* ─── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <h2 className="font-display text-lg text-primary">파티원 선택</h2>
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

        {/* ─── Filters + Sort ──────────────────────────────────────────────── */}
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
          <div className="w-px h-5 bg-border/50" />
          <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="heroClass">직업순</SelectItem>
              <SelectItem value="name">이름순</SelectItem>
              <SelectItem value="level">레벨순</SelectItem>
              <SelectItem value="power">전투력순</SelectItem>
              <SelectItem value="atk">공격력순</SelectItem>
              <SelectItem value="def">방어력순</SelectItem>
              <SelectItem value="hp">체력순</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="p-1 rounded hover:bg-secondary">
            {sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* ─── Content ─────────────────────────────────────────────────────── */}
        <ScrollArea className="flex-1 min-h-0 px-2">
          {viewMode === 'table' ? (
            // ─── TABLE VIEW ───────────────────────────────────────────────────
            <table className="w-full text-xs min-w-[900px]">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">유형</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">이름</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap cursor-pointer hover:text-primary select-none" onClick={cycleJobMode} title={`이미지: ${jobImageMode === 'icon' ? '아이콘' : jobImageMode === 'illust' ? '일러스트' : '없음'} (클릭하여 변경)`}>
                    직업 {jobModeLabel}
                  </th>
                  <th className="text-center py-2 px-1.5">Lv</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">원소</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">스킬</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">전투력</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">공격력</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">방어력</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">체력</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap text-yellow-400">치확</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap text-yellow-400">치명타 대미지</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap text-teal-400">회피</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">포지션</th>
                  <th className="text-center py-2 px-1.5 whitespace-nowrap">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(hero => {
                  const isSelected = localIds.has(hero.id);
                  const disabled = isFull && !isSelected;
                  const belowMin = hero.power > 0 && hero.power < minPower;
                  const iconPath = hero.type === 'champion' && hero.championName
                    ? getChampionImagePath(hero.championName)
                    : hero.heroClass ? getJobImagePath(hero.heroClass) : '';
                  const illustPath = hero.type === 'champion' && hero.championName
                    ? getChampionImagePath(hero.championName)
                    : hero.heroClass ? getJobIllustPath(hero.heroClass) : '';
                  const critDmgDisplay = hero.critDmg > 0 ? Math.round(hero.atk * hero.critDmg / 100) : 0;
                  return (
                    <tr key={hero.id}
                      onClick={() => !disabled && handleToggle(hero.id)}
                      className={`border-b border-border/30 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10' : disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-secondary/30'
                      }`}>
                      {/* 유형 */}
                      <td className="py-1.5 px-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${hero.type === 'champion' ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}`}>
                          {hero.type === 'champion' ? '챔피언' : '영웅'}
                        </span>
                      </td>
                      {/* 이름 */}
                      <td className="py-1.5 px-1.5 text-center font-medium text-foreground">
                        <div className="flex items-center gap-1 justify-center">
                          {belowMin && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                          {iconPath && <img src={iconPath} alt="" className="w-5 h-5 rounded-full" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                          <span className="whitespace-nowrap">{hero.name}</span>
                        </div>
                      </td>
                      {/* 직업 with toggle */}
                      <td className="py-1.5 px-1 text-center text-muted-foreground">
                        {jobImageMode === 'none' ? (
                          <span className="text-xs whitespace-nowrap">{hero.heroClass || hero.championName || '-'}</span>
                        ) : jobImageMode === 'icon' ? (
                          <span className="text-xs whitespace-nowrap">{hero.heroClass || hero.championName || '-'}</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-16 h-16 overflow-hidden rounded border border-border/30 bg-secondary/20">
                              {illustPath
                                ? <img src={illustPath} alt="" className="w-full h-full object-cover" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                                : null}
                            </div>
                            <span className="text-[10px] whitespace-nowrap">{hero.heroClass || hero.championName || '-'}</span>
                          </div>
                        )}
                      </td>
                      {/* Lv */}
                      <td className="py-1.5 px-1 text-center text-muted-foreground">{hero.level}</td>
                      {/* 전투력 */}
                      <td className={`py-1.5 px-1 text-center font-mono ${belowMin ? 'text-red-400' : 'text-yellow-400'}`}>
                        {hero.power > 0 ? formatNumber(hero.power) : '-'}
                      </td>
                      {/* 공격력 */}
                      <td className="py-1.5 px-1 text-center font-mono text-red-400">{formatNumber(hero.atk)}</td>
                      {/* 방어력 */}
                      <td className="py-1.5 px-1 text-center font-mono text-blue-400">{formatNumber(hero.def)}</td>
                      {/* 체력 */}
                      <td className="py-1.5 px-1 text-center font-mono text-orange-400">{formatNumber(hero.hp)}</td>
                      {/* 치확 */}
                      <td className="py-1.5 px-1 text-center font-mono text-yellow-400">{hero.crit > 0 ? `${formatNumber(hero.crit)}%` : '-'}</td>
                      {/* 치명타 대미지 */}
                      <td className="py-1.5 px-1 text-center font-mono text-yellow-400">{critDmgDisplay > 0 ? formatNumber(critDmgDisplay) : '-'}</td>
                      {/* 회피 */}
                      <td className="py-1.5 px-1 text-center font-mono text-teal-400">{hero.evasion > 0 ? `${formatNumber(hero.evasion)}%` : '-'}</td>
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
                          {hero.heroClass && (
                            <img src={getUniqueSkillImagePath(hero.heroClass)} alt="" className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          )}
                          {hero.skills?.slice(1, 5).map((sk, i) => sk ? (
                            <img key={i} src={getSkillImagePath(sk)} alt={sk} title={sk} className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          ) : null)}
                        </div>
                      </td>
                      {/* 포지션 */}
                      <td className="py-1.5 px-1 text-center text-foreground/70 text-[10px] whitespace-nowrap">{hero.position || '-'}</td>
                      {/* 상태 */}
                      <td className="py-1.5 px-1 text-center text-foreground/70 text-[10px] whitespace-nowrap">{hero.label || '-'}</td>
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
                const disabled = isFull && !isSelected;
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
                    {isChampion ? (
                      <div className="flex gap-1 justify-center w-full">
                        {equipSlots.slice(0, 2).map((slot: any, i: number) => renderEquipSlot(slot, i))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-0.5 w-full">
                        {equipSlots.map((slot: any, i: number) => renderEquipSlot(slot, i))}
                      </div>
                    )}
                    {/* Power */}
                    {hero.power > 0 && (
                      <span className={`text-[10px] font-mono ${belowMin ? 'text-red-400' : 'text-yellow-400'}`}>{formatNumber(hero.power)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" onClick={() => onConfirm(localIds)}>확인 ({localIds.size}/{maxMembers})</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
