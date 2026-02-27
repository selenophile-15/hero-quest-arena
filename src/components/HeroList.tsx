import { useState, useEffect, useMemo } from 'react';
import { Hero, HERO_STAT_COLUMNS, CHAMPION_STAT_COLUMNS, STAT_ICON_MAP, ELEMENT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { HERO_CLASS_MAP, getCommonSkills, getUniqueSkills } from '@/lib/gameData';
import { getHeroes, saveHeroes, deleteHero } from '@/lib/storage';
import { getJobImagePath, getJobIllustPath, getChampionImagePath, CHAMPION_NAME_MAP, JOB_NAME_MAP, SPIRIT_NAME_MAP } from '@/lib/nameMap';
import { getSkillImagePath, getUniqueSkillImagePath, setSkillGradeCache } from '@/lib/skillUtils';
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
  { key: 'hp', icon: '/images/special/hp_seed.png', label: 'HP' },
  { key: 'atk', icon: '/images/special/atk_seed.png', label: 'ATK' },
  { key: 'def', icon: '/images/special/def_seed.png', label: 'DEF' },
];

const ELEMENT_ENG_MAP: Record<string, string> = {
  '불': 'fire', '물': 'water', '공기': 'air', '대지': 'earth', '빛': 'light', '어둠': 'dark',
};

const EQUIP_STAT_ICONS: Record<string, string> = {
  '장비_공격력': '/images/stats/attack.png',
  '장비_방어력': '/images/stats/defense.png',
  '장비_체력': '/images/stats/health.png',
  '장비_치명타확률%': '/images/stats/critchance.png',
  '장비_회피%': '/images/stats/evasion.png',
};

const QUALITY_BORDER: Record<string, string> = {
  common: 'border-gray-300/50',
  uncommon: 'border-green-400/60',
  flawless: 'border-cyan-300/60',
  epic: 'border-fuchsia-400/70',
  legendary: 'border-yellow-400/80',
};
const QUALITY_RADIAL_COLOR: Record<string, string> = {
  common: 'rgba(220,220,220,0.18)',
  uncommon: 'rgba(74,222,128,0.2)',
  flawless: 'rgba(103,232,249,0.25)',
  epic: 'rgba(217,70,239,0.3)',
  legendary: 'rgba(250,204,21,0.35)',
};
const QUALITY_SHADOW_COLOR: Record<string, string> = {
  common: '0 0 8px rgba(220,220,220,0.4)',
  uncommon: '0 0 10px rgba(74,222,128,0.5)',
  flawless: '0 0 12px rgba(103,232,249,0.5)',
  epic: '0 0 14px rgba(217,70,239,0.6)',
  legendary: '0 0 16px rgba(250,204,21,0.7)',
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
  const [commonSkillsData, setCommonSkillsData] = useState<Record<string, any>>({});
  const [uniqueSkillsData, setUniqueSkillsData] = useState<Record<string, any>>({});

  useEffect(() => {
    getCommonSkills().then(data => {
      setCommonSkillsData(data);
      setSkillGradeCache(data);
    });
    getUniqueSkills().then(setUniqueSkillsData);
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
    if (colKey === 'element') {
      return (
        <span className="inline-flex items-center gap-1">
          <ElementIcon element={hero.element} size={20} />
          <span className="text-xs text-foreground tabular-nums">{formatNumber(hero.elementValue || 0)}</span>
        </span>
      );
    }
    if (colKey === 'skills') {
      // Show unique skill + 4 common slots (always 5 spaces)
      const uniqueImgPath = hero.heroClass ? getUniqueSkillImagePath(hero.heroClass) : '';
      const commonSkills = hero.skills?.slice(1) || [];
      return (
        <div className="flex items-center gap-0.5 justify-center">
          {/* Unique skill */}
          <div className="w-5 h-5 flex-shrink-0">
            {uniqueImgPath && (
              <img src={uniqueImgPath} alt="고유" className="w-5 h-5" title={hero.skills?.[0] || '고유 스킬'}
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            )}
          </div>
          <div className="w-px h-4 bg-border/50 mx-0.5" />
          {/* 4 common slots */}
          {Array.from({ length: 4 }).map((_, i) => {
            const sk = commonSkills[i];
            return (
              <div key={i} className="w-5 h-5 flex-shrink-0">
                {sk ? (
                  <img src={getSkillImagePath(sk)} alt={sk} className="w-5 h-5" title={sk}
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : null}
              </div>
            );
          })}
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
    if (colKey === 'position') return <span>{hero.position || '-'}</span>;
    if (colKey === 'airshipPower') return <span>-</span>;
    const value = hero[colKey as keyof Hero];
    const formatted = formatValue(colKey, value);
    if (formatted !== null) return <span>{formatted}</span>;
    return <span>{String(value ?? '-')}</span>;
  };

  const renderExpandedRow = (hero: Hero) => {
    const uniqueSkill = hero.heroClass ? findUniqueSkillByJob(uniqueSkillsData, hero.heroClass) : null;
    const elementVal = hero.elementValue || 0;
    const critAttack = hero.atk && hero.critDmg ? Math.floor(hero.atk * hero.critDmg / 100) : 0;
    const isAllElement = hero.element === '모든 원소' || hero.heroClass === '마법검' || hero.heroClass === '스펠나이트';

    // Compute unique skill level
    let uniqueLevelIdx = 0;
    const uThresholds = uniqueSkill?.['원소_기준치']?.map(Number).filter(Number.isFinite) || [];
    for (let i = 0; i < uThresholds.length; i++) {
      if (elementVal >= uThresholds[i]) uniqueLevelIdx = i;
    }

    const equipSlots = hero.equipmentSlots || Array.from({ length: 6 }, () => ({ item: null, quality: 'common', element: null, spirit: null }));

    return (
      <tr className="bg-secondary/20">
        <td colSpan={activeCols.length + 1} className="px-4 py-4">
          <div className="flex gap-4">
            {/* Stats - matches HeroForm auto stats box */}
            <div className="card-fantasy p-3 min-w-[180px]">
              <h4 className="text-xs font-semibold text-primary mb-2">스탯(자동)</h4>
              {hero.heroClass && (
                <div className="flex items-center justify-center py-1 mb-1">
                  <img src={getJobImagePath(hero.heroClass)} alt="" className="w-10 h-10 object-contain"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}
              <div className="space-y-1 text-xs">
                {[
                  { icon: STAT_ICON_MAP.power, value: hero.power, suffix: '' },
                  { icon: STAT_ICON_MAP.hp, value: hero.hp, suffix: '' },
                  { icon: STAT_ICON_MAP.atk, value: hero.atk, suffix: '' },
                  { icon: STAT_ICON_MAP.def, value: hero.def, suffix: '' },
                  { icon: STAT_ICON_MAP.crit, value: hero.crit, suffix: ' %' },
                  { icon: STAT_ICON_MAP.critDmg, value: hero.critDmg, suffix: ' %' },
                  { icon: STAT_ICON_MAP.critAttack, value: critAttack, suffix: '' },
                  { icon: STAT_ICON_MAP.evasion, value: hero.evasion, suffix: ' %' },
                  { icon: STAT_ICON_MAP.threat, value: hero.threat, suffix: '' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 py-0.5 px-1">
                    <img src={s.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm text-foreground ml-auto tabular-nums">{s.value ? `${formatNumber(s.value)}${s.suffix}` : '-'}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 py-0.5 px-1">
                  <ElementIcon element={isAllElement ? '모든 원소' : hero.element} size={20} />
                  <span className="text-sm text-foreground ml-auto tabular-nums">{hero.elementValue ? formatNumber(hero.elementValue) : '-'}</span>
                </div>
                <div className="flex items-center gap-2 py-0.5 px-1">
                  <img src={STAT_ICON_MAP.airshipPower} alt="" className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm text-foreground ml-auto tabular-nums">-</span>
                </div>
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

            {/* Skills - with icons, names, levels, effects */}
            <div className="card-fantasy p-3 flex-1 min-w-[320px]">
              <h4 className="text-xs font-semibold text-primary mb-2">스킬셋</h4>
              <div className="space-y-2">
                {/* Unique skill */}
                {(() => {
                  const baseName = uniqueSkill?.['레벨별_스킬명']?.[0] || hero.skills?.[0] || '-';
                  const currentName = uniqueSkill?.['레벨별_스킬명']?.[uniqueLevelIdx] || baseName;
                  const desc = uniqueSkill?.['스킬_설명']?.[uniqueLevelIdx] || '-';
                  const imgPath = uniqueSkill?.['이미지_경로'];
                  return (
                    <div className="flex items-start gap-2 min-h-[48px]">
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        {imgPath ? <img src={`/${imgPath}`} alt="" className="w-8 h-8 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-foreground">{baseName}</span>
                          {currentName !== baseName && <span className="text-xs text-muted-foreground">({currentName})</span>}
                        </div>
                        <p className="text-[10px] text-foreground/70 leading-tight whitespace-pre-line mt-0.5">{desc}</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="border-t border-border/30" />

                {/* Common skills (4 fixed slots) */}
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

                  return (
                    <div key={i} className="flex items-start gap-2 min-h-[48px]">
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        {sk ? <img src={getSkillImagePath(sk)} alt="" className="w-8 h-8 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        {sk ? (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-foreground">{baseName}</span>
                              {currentName !== baseName && <span className="text-xs text-muted-foreground">({currentName})</span>}
                            </div>
                            <p className="text-[10px] text-foreground/70 leading-tight whitespace-pre-line mt-0.5">{desc}</p>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Equipment 3x2 grid */}
            <div className="card-fantasy p-3 min-w-[320px]">
              <h4 className="text-xs font-semibold text-primary mb-2">장비</h4>
              <div className="grid grid-cols-3 gap-2">
                {equipSlots.map((slot, i) => {
                  const item = slot.item;
                  const quality = slot.quality || 'common';
                  const displayElement = slot.element || (item?.uniqueElement?.length ? { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true } : null);
                  const displaySpirit = slot.spirit || (item?.uniqueSpirit?.length ? { name: item.uniqueSpirit[0], affinity: true } : null);

                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div
                        className={`relative w-full aspect-square rounded-lg border-2 ${item ? QUALITY_BORDER[quality] : 'border-border'} flex flex-col items-center justify-center overflow-hidden`}
                        style={item ? {
                          background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 70%)`,
                          boxShadow: QUALITY_SHADOW_COLOR[quality],
                        } : { background: 'hsl(var(--secondary) / 0.3)' }}
                      >
                        {item?.relic && (
                          <img src="/images/special/icon_global_artifact.png" alt="" className="absolute top-0.5 left-0.5 w-3 h-3 z-10"
                            onError={e => { e.currentTarget.style.display = 'none'; }} />
                        )}
                        {item?.imagePath ? (
                          <img src={item.imagePath} alt={item.name} className="w-3/4 h-3/4 object-contain"
                            onError={e => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <span className="text-[8px] text-muted-foreground">비어있음</span>
                        )}
                        {/* Enchant icons at bottom */}
                        {item && (
                          <div className="absolute bottom-0.5 left-0.5 right-0.5 flex justify-center gap-0.5">
                            {displayElement && (
                              <img src={`/images/enchant/element/${ELEMENT_ENG_MAP[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.png`}
                                className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                            )}
                            {displaySpirit && (() => {
                              const eng = SPIRIT_NAME_MAP[displaySpirit.name];
                              if (displaySpirit.name === '문드라') {
                                return <img src="/images/enchant/spirit/mundra.png" className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />;
                              }
                              return eng ? <img src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.png`} className="w-3.5 h-3.5" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                            })()}
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-foreground truncate w-full text-center mt-0.5">{item?.name || '-'}</p>
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

    return (
      <div
        key={hero.id}
        className={`card-fantasy p-3 border-2 rounded-xl ${borderClass} flex flex-col items-center gap-2 cursor-pointer hover:scale-[1.02] transition-all`}
        onClick={() => setEditing(hero)}
      >
        <div className="w-full aspect-[3/4] flex items-center justify-center overflow-hidden rounded-lg bg-secondary/20">
          {illustPath ? (
            <img src={illustPath} alt={hero.name} className="w-full h-full object-contain"
              onError={e => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <span className="text-muted-foreground text-sm">{hero.name}</span>
          )}
        </div>
        <div className="text-center w-full">
          <p className="text-sm font-bold text-foreground truncate">{hero.name}</p>
          <p className="text-xs text-muted-foreground">Lv.{hero.level}</p>
        </div>
        <div className="flex items-center gap-1">
          <ElementIcon element={hero.element} size={16} />
          <span className="text-xs text-foreground tabular-nums">{hero.elementValue || 0}</span>
        </div>
        {hero.skills && hero.skills.length > 0 && (
          <div className="flex items-center gap-0.5 flex-wrap justify-center">
            {hero.skills.slice(0, 5).map((sk, i) => (
              <img key={i} src={i === 0 ? getUniqueSkillImagePath(hero.heroClass) : getSkillImagePath(sk)} alt={sk} className="w-5 h-5" title={sk}
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            ))}
          </div>
        )}
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
                      col.key === 'heroClass' || col.key === 'name' ? 'min-w-[110px]' : ''
                    } ${col.key === 'championName' ? 'min-w-[100px]' : ''} ${col.key === 'skills' ? 'min-w-[140px]' : ''} ${col.key === 'seeds' ? 'min-w-[120px]' : ''}`}>
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
