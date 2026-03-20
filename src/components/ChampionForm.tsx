import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Hero, STAT_ICON_MAP, POSITIONS, ELEMENT_ICON_MAP } from '@/types/game';
import { CHAMPION_NAMES, lookupChampionStats, getChampionSkillsData, getChampionStats } from '@/lib/gameData';
import { calculateChampionStats, ChampionCalcResult } from '@/lib/championStatCalculator';
import ChampionStatBreakdownDrawer from './ChampionStatBreakdownDrawer';
import { CHAMPION_NAME_MAP, getChampionImagePath, SPIRIT_NAME_MAP } from '@/lib/nameMap';
import { formatNumber } from '@/lib/format';
import { getElementValue } from '@/components/EnchantPickerDialog';
import { loadFamiliars, loadAurasongs, getAurasongSkillEffect, getAurasongSkillIconPath, ensureAurasongDataLoaded, getFamiliarImagePath, getAurasongImagePath, getLeaderSkillTierName } from '@/lib/championEquipUtils';
import ElementIcon from './ElementIcon';
import EnchantPickerDialog from './EnchantPickerDialog';
import ManualEquipmentForm, { ManualEquipmentFormRef } from './ManualEquipmentForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Wrench } from 'lucide-react';
import type { EquipmentItem } from '@/lib/equipmentUtils';

interface ChampionFormProps {
  hero?: Hero;
  onSave: (hero: Hero) => void;
  onCancel: () => void;
}

const ELEMENT_ORDER = [
  { key: '불', icon: '/images/elements/fire.webp' },
  { key: '물', icon: '/images/elements/water.webp' },
  { key: '공기', icon: '/images/elements/air.webp' },
  { key: '대지', icon: '/images/elements/earth.webp' },
  { key: '빛', icon: '/images/elements/light.webp' },
  { key: '어둠', icon: '/images/elements/dark.webp' },
];

const SEED_ICONS = [
  { key: 'hp', icon: '/images/special/hp_seed.webp' },
  { key: 'atk', icon: '/images/special/atk_seed.webp' },
  { key: 'def', icon: '/images/special/def_seed.webp' },
];

const ELEMENT_ENG_MAP: Record<string, string> = {
  '불': 'fire', '물': 'water', '공기': 'air', '대지': 'earth', '빛': 'light', '어둠': 'dark',
  '모든 원소': 'all', '골드': 'gold',
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
  common: '0 0 14px rgba(220,220,220,0.6)',
  uncommon: '0 0 16px rgba(74,222,128,0.7)',
  flawless: '0 0 18px rgba(103,232,249,0.7)',
  epic: '0 0 22px rgba(217,70,239,0.8)',
  legendary: '0 0 26px rgba(250,204,21,0.9)',
};

const QUALITY_OPTIONS = [
  { value: 'common', label: '일반', color: 'text-gray-300' },
  { value: 'uncommon', label: '고급', color: 'text-green-400' },
  { value: 'flawless', label: '최고급', color: 'text-cyan-300' },
  { value: 'epic', label: '에픽', color: 'text-fuchsia-400' },
  { value: 'legendary', label: '전설', color: 'text-yellow-400' },
];

const EQUIP_STAT_ICONS: Record<string, string> = {
  '장비_공격력': '/images/stats/attack.webp',
  '장비_방어력': '/images/stats/defense.webp',
  '장비_체력': '/images/stats/health.webp',
  '장비_치명타확률%': '/images/stats/critchance.webp',
  '장비_회피%': '/images/stats/evasion.webp',
};

function formatEquipStatVal(key: string, value: number): string {
  if (key === '장비_치명타확률%' || key === '장비_회피%') return `${value} %`;
  return formatNumber(value);
}

const STAT_FILTER_OPTIONS = [
  { value: '장비_공격력', label: '공격력' },
  { value: '장비_방어력', label: '방어력' },
  { value: '장비_체력', label: '체력' },
  { value: '장비_치명타확률%', label: '치명타 확률' },
  { value: '장비_회피%', label: '회피' },
];

const STAT_COLOR: Record<string, string> = {
  '장비_공격력': 'text-red-400',
  '장비_방어력': 'text-blue-400',
  '장비_체력': 'text-orange-400',
  '장비_치명타확률%': 'text-yellow-400',
  '장비_회피%': 'text-teal-400',
};

const SPIRIT_TIER: Record<string, number> = {
  '바하무트': 14, '레비아탄': 14, '그리핀': 14, '명인': 14, '조상': 14, '베히모스': 14, '우로보로스': 14,
  '기린': 12, '크람푸스': 12, '크리스마스': 12,
  '크라켄': 12, '키메라': 12, '카벙클': 12, '타라스크': 12, '하이드라': 12, '불사조': 12,
  '케찰코아틀': 10,
  '호랑이': 9, '매머드': 9, '공룡': 9, '사자': 9, '곰': 9, '바다코끼리': 9, '상어': 9,
  '다람쥐': 7, '하마': 7, '말': 7, '도마뱀': 7, '아르마딜로': 7, '부엉이': 7, '코뿔소': 7,
  '졸로틀': 5,
  '독수리': 4, '황소': 4, '양': 4, '늑대': 4, '고양이': 4, '거위': 4, '독사': 4, '토끼': 4,
};

function getSpiritTier(name: string): number {
  return SPIRIT_TIER[name] || 0;
}

const ELEMENT_COLORS: Record<string, string> = {
  '불': 'text-red-400', '물': 'text-blue-400', '공기': 'text-cyan-300',
  '대지': 'text-lime-400', '빛': 'text-yellow-200', '어둠': 'text-purple-400',
  '모든 원소': 'text-white',
};

function formatRank(rank: number): string {
  if (rank <= 11) return String(rank);
  return `11(+${rank - 11})`;
}

function getLeaderSkillTier(rank: number, champSkillData: any): number {
  if (!champSkillData) return 1;
  const tiers = ['4티어', '3티어', '2티어', '1티어'];
  for (const t of tiers) {
    const tierData = champSkillData[t];
    if (tierData && rank >= (tierData['챔피언_랭크'] || 0)) {
      return parseInt(t);
    }
  }
  return 1;
}

export default function ChampionForm({ hero, onSave, onCancel }: ChampionFormProps) {
  const [championName, setChampionName] = useState(hero?.championName || CHAMPION_NAMES[0]);
  const [name, setName] = useState(hero?.name || '');
  const [promoted, setPromoted] = useState(false);
  const [rank, setRank] = useState<number | ''>(hero?.rank || 1);
  const [cardLevel, setCardLevel] = useState<number>(hero?.cardLevel ?? 1);
  const [level, setLevel] = useState<number | ''>(hero?.level || 1);
  const [label, setLabel] = useState(hero?.label || '');
  const [position, setPosition] = useState(hero?.position || '');
  const [power, setPower] = useState<number | ''>(hero?.power || '');
  const [powerManual, setPowerManual] = useState(true);
  const [hp, setHp] = useState(hero?.hp || 0);
  const [atk, setAtk] = useState(hero?.atk || 0);
  const [def, setDef] = useState(hero?.def || 0);
  const [crit, setCrit] = useState(hero?.crit || 5);
  const [critDmg, setCritDmg] = useState(hero?.critDmg || 200);
  const [evasion, setEvasion] = useState(hero?.evasion || 0);
  const [threat, setThreat] = useState(hero?.threat || 90);
  const [element, setElement] = useState(hero?.element || '');
  const [elementValue, setElementValue] = useState(hero?.elementValue || 0);

  const [seedHp, setSeedHp] = useState(hero?.seeds?.hp || 0);
  const [seedAtk, setSeedAtk] = useState(hero?.seeds?.atk || 0);
  const [seedDef, setSeedDef] = useState(hero?.seeds?.def || 0);
  const [equipElements, setEquipElements] = useState<Record<string, number>>(hero?.equipmentElements || {});
  const [elementManual, setElementManual] = useState(hero?.elementManual || false);

  // Equipment: 2 slots - familiar (0) and aurasong (1)
  const [equipmentSlots, setEquipmentSlots] = useState<Array<{
    item: any | null;
    quality: string;
    element: any | null;
    spirit: any | null;
  }>>(hero?.equipmentSlots || Array.from({ length: 2 }, () => ({ item: null, quality: 'common', element: null, spirit: null })));

  const [championSkillsData, setChampionSkillsData] = useState<Record<string, any>>({});
  const [familiarItems, setFamiliarItems] = useState<EquipmentItem[]>([]);
  const [aurasongItems, setAurasongItems] = useState<EquipmentItem[]>([]);
  const [equipDialogType, setEquipDialogType] = useState<'familiar' | 'aurasong' | null>(null);
  const [enchantDialogOpen, setEnchantDialogOpen] = useState(false);
  const [enchantInitialTab, setEnchantInitialTab] = useState<'element' | 'spirit'>('element');
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [equipFilterStat, setEquipFilterStat] = useState<string>('_all');
  const [equipFilterElement, setEquipFilterElement] = useState<string>('_all');
  const [equipFilterSpirit, setEquipFilterSpirit] = useState<string>('_all');
  const [equipSlotQuality, setEquipSlotQuality] = useState<string>('common');
  const [championManualMode, setChampionManualMode] = useState(false);
  const championManualFormRef = useRef<ManualEquipmentFormRef>(null);

  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [championRawData, setChampionRawData] = useState<any>(null);

  const formRef = useRef<HTMLDivElement>(null);

  // Scroll to top when form mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    if (!hero) setName(championName);
  }, [championName]);

  useEffect(() => {
    getChampionSkillsData().then(setChampionSkillsData);
    loadFamiliars().then(setFamiliarItems);
    loadAurasongs().then(setAurasongItems);
    ensureAurasongDataLoaded();
  }, []);

  useEffect(() => {
    getChampionStats().then(data => {
      if (data[championName]) setChampionRawData(data[championName]);
    });
  }, [championName]);


  useEffect(() => {
    if (!championName || !rank) return;
    lookupChampionStats(championName, Number(rank)).then(stats => {
      if (stats) {
        setHp(stats.hp);
        setAtk(stats.atk);
        setDef(stats.def);
        setElementValue(stats.element);
        setCrit(stats.fixed.critRate);
        setCritDmg(stats.fixed.critDmg);
        setEvasion(stats.fixed.evasion);
        setThreat(stats.fixed.threat);
        setElement(stats.fixed.element);
      }
    });
  }, [championName, rank]);

  const calculatedElements = useMemo(() => {
    const totals: Record<string, number> = {};
    // Add rank-based element value to the champion's element
    if (element && elementValue) {
      totals[element] = (totals[element] || 0) + elementValue;
    }
    equipmentSlots.forEach(s => {
      if (s.element) {
        const val = getElementValue(s.element.tier, s.element.affinity, !!(s.element as any).allElementAffinity);
        totals[s.element.type] = (totals[s.element.type] || 0) + val;
      }
    });
    return totals;
  }, [equipmentSlots, element, elementValue]);

  useEffect(() => {
    if (!elementManual) setEquipElements(calculatedElements);
  }, [calculatedElements, elementManual]);

  const totalEquipElement = Object.values(equipElements).reduce((a, b) => a + b, 0);
  const critAttack = atk && critDmg ? Math.floor(atk * critDmg / 100) : 0;

  const [champCalcResult, setChampCalcResult] = useState<ChampionCalcResult | null>(null);

  useEffect(() => {
    if (!championRawData || !rank || !level) {
      setChampCalcResult(null);
      return;
    }
    let cancelled = false;
    calculateChampionStats({
      championData: championRawData,
      rank: Number(rank),
      level: Number(level),
      promoted,
      cardLevel,
      seeds: { hp: seedHp, atk: seedAtk, def: seedDef },
      equipmentSlots,
    }).then(result => {
      if (!cancelled) setChampCalcResult(result);
    });
    return () => { cancelled = true; };
  }, [championRawData, rank, level, promoted, cardLevel, seedHp, seedAtk, seedDef, equipmentSlots]);

  // Leader skill from champion data
  const champSkillData = championSkillsData[championName];
  const leaderSkillTier = useMemo(() => {
    if (!champSkillData) return 1;
    for (let t = 4; t >= 1; t--) {
      const tierData = champSkillData[`${t}티어`];
      if (tierData && Number(rank) >= (tierData['챔피언_랭크'] || 0)) return t;
    }
    return 1;
  }, [champSkillData, rank]);

  // Max rank from champion data
  const championMaxRank = useMemo(() => {
    if (!championRawData) return 60;
    const rankArr = championRawData['랭크별_능력치'] || [];
    if (rankArr.length === 0) return 60;
    return Math.max(...rankArr.map((r: any) => r['랭크'] || 1));
  }, [championRawData]);

  const currentLeaderSkill = champSkillData?.[`${leaderSkillTier}티어`];
  const leaderSkillEffect = currentLeaderSkill?.['효과'] || '-';
  const champEng = CHAMPION_NAME_MAP[championName] || championName;

  // Aura song skill from equipped aurasong
  const aurasongItem = equipmentSlots[1]?.item;
  const aurasongSkillEffect = aurasongItem
    ? (getAurasongSkillEffect(aurasongItem.name) || (aurasongItem.manual ? aurasongItem.relicEffect || '' : ''))
    : '';
  const aurasongSkillIcon = aurasongItem ? getAurasongSkillIconPath(aurasongItem.name) : '';

  const handleNumericChange = (setter: (v: number | '') => void, max?: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') { setter(''); return; }
    let parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;
    if (max !== undefined && parsed > max) parsed = max;
    if (parsed < 0) parsed = 0;
    setter(parsed);
  };

  const handleSeedChange = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') { setter(0); return; }
    let parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;
    if (parsed > 80) parsed = 80;
    if (parsed < 0) parsed = 0;
    setter(parsed);
  };

  const handlePowerInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '') { setPower(''); return; }
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;
    if (parsed < 0) return;
    setPower(parsed);
  };

  const formatPowerDisplay = (val: number | '') => {
    if (val === '' || val === 0) return '';
    return val.toLocaleString('en-US');
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameError(true);
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setNameError(false);
    onSave({
      id: hero?.id || crypto.randomUUID(),
      name: name.trim(),
      classLine: '',
      heroClass: '',
      type: 'champion',
      promoted,
      level: Number(level) || 1,
      rank: Number(rank) || 1,
      championName,
      cardLevel,
      power: Number(power) || 0,
      hp: champCalcResult?.finalHp ?? hp,
      atk: champCalcResult?.finalAtk ?? atk,
      def: champCalcResult?.finalDef ?? def,
      crit: champCalcResult?.totalCrit ?? crit,
      critDmg: champCalcResult?.totalCritDmg ?? critDmg,
      evasion: champCalcResult?.totalEvasion ?? evasion,
      threat: champCalcResult?.totalThreat ?? threat,
      element,
      elementValue: totalEquipElement || elementValue,
      skills: [],
      label,
      position,
      seeds: { hp: seedHp, atk: seedAtk, def: seedDef },
      equipmentElements: equipElements,
      elementManual,
      equipmentSlots,
      createdAt: hero?.createdAt || new Date().toISOString(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = formRef.current;
      if (!form) return;
      const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([disabled])'));
      const current = document.activeElement as HTMLInputElement;
      const idx = inputs.indexOf(current);
      if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
    }
  };

  const seedSetters = [setSeedHp, setSeedAtk, setSeedDef];
  const seedValues = [seedHp, seedAtk, seedDef];

  const SLOT_LABELS = ['퍼밀리어', '오라의 노래'];

  const renderEquipSlot = (slotIdx: number) => {
    const slotData = equipmentSlots[slotIdx];
    const equipItem = slotData?.item;
    const quality = slotData?.quality || 'common';
    const typeFile = equipItem?.type || '';
    const displayElement = slotData?.element || (equipItem?.uniqueElement?.length ? { type: equipItem.uniqueElement[0], tier: equipItem.uniqueElementTier || 1, affinity: true } : null);
    const displaySpirit = slotData?.spirit || (equipItem?.uniqueSpirit?.length ? { name: equipItem.uniqueSpirit[0], affinity: true } : null);

    return (
      <div
        key={slotIdx}
        className="flex flex-col items-center gap-1 cursor-pointer"
        onClick={() => { setEquipDialogType(slotIdx === 0 ? 'familiar' : 'aurasong'); setChampionManualMode(!!equipmentSlots[slotIdx]?.item?.manual); }}
      >
        <div className="text-[10px] font-semibold text-primary/80 bg-primary/10 w-full text-center rounded-t py-0.5">
          {SLOT_LABELS[slotIdx]}
        </div>
        <div
          className={`relative w-full rounded-lg border-2 ${equipItem ? QUALITY_BORDER[quality] : 'border-border'} flex flex-col items-center overflow-hidden hover:border-primary/50 transition-all`}
          style={equipItem ? {
            background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 85%)`,
            boxShadow: QUALITY_SHADOW_COLOR[quality],
          } : { background: 'hsl(var(--secondary) / 0.3)' }}
        >
          <div className="w-full flex items-center justify-center relative" style={{ aspectRatio: '1' }}>
            {equipItem && (
              <span className="absolute top-1 left-1 text-[10px] font-bold text-muted-foreground bg-background/80 rounded px-1 z-10">T{equipItem.tier}</span>
            )}
            {equipItem?.imagePath ? (
              <img src={equipItem.imagePath} alt={equipItem.name} className="w-4/5 h-4/5 object-contain"
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <span className="text-[10px] text-muted-foreground">비어있음</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-0.5 w-[90%] p-0.5 mb-0.5">
            <div className="aspect-square rounded border border-border/30 bg-background/30 flex items-center justify-center overflow-hidden"
              onClick={(e) => { e.stopPropagation(); setEnchantInitialTab('element'); setEnchantDialogOpen(true); }}>
              {displayElement ? (
                <img src={`/images/enchant/element/${ELEMENT_ENG_MAP[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.webp`} className="w-[80%] h-[80%] object-cover" alt=""
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
              ) : <span className="text-[6px] text-muted-foreground">원소</span>}
            </div>
            <div className="aspect-square rounded border border-border/30 bg-background/30 flex items-center justify-center overflow-hidden"
              onClick={(e) => { e.stopPropagation(); setEnchantInitialTab('spirit'); setEnchantDialogOpen(true); }}>
              {displaySpirit ? (() => {
                const eng = SPIRIT_NAME_MAP[displaySpirit.name];
                if (displaySpirit.name === '문드라') return <img src="/images/enchant/spirit/mundra.webp" className="w-[80%] h-[80%] object-cover" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />;
                return eng ? <img src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.webp`} className="w-[80%] h-[80%] object-cover" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span className="text-[6px] text-foreground">{displaySpirit.name}</span>;
              })() : <span className="text-[6px] text-muted-foreground">영혼</span>}
            </div>
            <div className="aspect-square rounded border border-border/30 bg-background/30 flex items-center justify-center overflow-hidden">
              {typeFile ? <img src={`/images/type/${typeFile}.webp`} className="w-[80%] h-[80%] object-contain" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span className="text-[6px] text-muted-foreground">타입</span>}
            </div>
          </div>
        </div>
        {(() => {
          // Use calculated equip stats if available
          const calcSlot = champCalcResult?.equipSlots?.[slotIdx];
          const hasCalcStats = calcSlot && calcSlot.itemName;
          const displayStats = hasCalcStats ? [
            ...(calcSlot.finalAtk ? [{ key: '장비_공격력', value: calcSlot.finalAtk }] : []),
            ...(calcSlot.finalDef ? [{ key: '장비_방어력', value: calcSlot.finalDef }] : []),
            ...(calcSlot.finalHp ? [{ key: '장비_체력', value: calcSlot.finalHp }] : []),
            ...(calcSlot.finalCrit ? [{ key: '장비_치명타확률%', value: calcSlot.finalCrit }] : []),
            ...(calcSlot.finalEvasion ? [{ key: '장비_회피%', value: calcSlot.finalEvasion }] : []),
          ] : equipItem?.stats;
          return displayStats && displayStats.length > 0 ? (
            <div className="flex items-center justify-center w-full mt-0.5">
              <div className="flex gap-1.5">
                {displayStats.slice(0, 3).map((stat: any, si: number) => (
                  <div key={si} className="flex items-center gap-0.5">
                    <img src={EQUIP_STAT_ICONS[stat.key] || ''} alt="" className="w-4 h-4" />
                    <span className="text-xs text-foreground font-semibold tabular-nums">{formatEquipStatVal(stat.key, stat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}
        <p className="text-sm text-foreground truncate w-full text-center leading-tight font-medium mt-0.5">{equipItem?.name || '-'}</p>
      </div>
    );
  };

  // Equipment selection dialog (Dialog format matching hero)
  const renderEquipDialog = () => {
    if (!equipDialogType) return null;
    const items = equipDialogType === 'familiar' ? familiarItems : aurasongItems;
    const slotIdx = equipDialogType === 'familiar' ? 0 : 1;
    const currentItem = equipmentSlots[slotIdx]?.item;

    const filteredItems = items.filter(item => {
      if (equipFilterStat !== '_all' && !item.stats.some(s => s.key === equipFilterStat)) return false;
      if (equipFilterElement !== '_all') {
        const hasAffinity = item.elementAffinity?.includes(equipFilterElement);
        const hasUnique = item.uniqueElement?.includes(equipFilterElement);
        const hasAll = item.elementAffinity?.includes('모든 원소');
        if (!hasAffinity && !hasUnique && !hasAll) return false;
      }
      if (equipFilterSpirit !== '_all') {
        const hasAffinity = item.spiritAffinity?.includes(equipFilterSpirit);
        const hasUnique = item.uniqueSpirit?.includes(equipFilterSpirit);
        if (!hasAffinity && !hasUnique) return false;
      }
      return true;
    });

    return (
      <Dialog open={!!equipDialogType} onOpenChange={v => !v && setEquipDialogType(null)}>
        <DialogContent className="max-w-5xl h-[85vh] overflow-hidden flex flex-col p-5">
          <DialogHeader>
            <DialogTitle className="text-yellow-400" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>장비 선택</DialogTitle>
            <DialogDescription className="sr-only">퍼밀리어 또는 오라의 노래를 선택하세요</DialogDescription>
          </DialogHeader>

          {/* Top: Selected items */}
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <div className="flex gap-1 flex-1">
              {[0, 1].map(i => {
                const s = equipmentSlots[i];
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (s.item) {
                        const newSlots = [...equipmentSlots];
                        newSlots[i] = { item: null, quality: 'common', element: null, spirit: null };
                        setEquipmentSlots(newSlots);
                      } else {
                        setEquipDialogType(i === 0 ? 'familiar' : 'aurasong');
                      }
                    }}
                    className={`flex flex-col items-center p-1.5 rounded border min-w-[64px] transition-all ${
                      (i === 0 && equipDialogType === 'familiar') || (i === 1 && equipDialogType === 'aurasong') ? 'border-primary ring-1 ring-primary/30' : ''
                    } ${s.item ? QUALITY_BORDER[s.quality] : 'border-border/30 opacity-50'}`}
                    style={s.item ? {
                      background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[s.quality]} 0%, transparent 85%)`,
                      boxShadow: QUALITY_SHADOW_COLOR[s.quality],
                    } : {}}
                  >
                    <span className={`text-[8px] ${s.item ? 'text-accent font-bold' : 'text-muted-foreground'}`}>
                      {i === 0 ? '퍼밀리어' : '오라의 노래'}
                      {s.item?.manual && <Wrench className="w-2.5 h-2.5 inline ml-0.5 text-muted-foreground" />}
                    </span>
                    {s.item ? (
                      <>
                        {s.item.imagePath ? (
                          <img src={s.item.imagePath} alt="" className="w-9 h-9 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <span className="text-[8px] text-foreground w-9 h-9 flex items-center justify-center">{s.item.name.slice(0, 4)}</span>
                        )}
                        <span className="text-[8px] text-foreground truncate max-w-[58px]">{s.item.name}</span>
                      </>
                    ) : (
                      <span className="text-[9px] text-muted-foreground w-9 h-9 flex items-center justify-center">-</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setEquipDialogType(null)}>취소</Button>
              <Button size="sm" onClick={() => setEquipDialogType(null)}>선택</Button>
            </div>
          </div>

          {/* Tabs: familiar / aurasong */}
          <div className="flex items-center gap-1 my-1">
            <button
              onClick={() => { setEquipDialogType('familiar'); setChampionManualMode(!!equipmentSlots[0]?.item?.manual); }}
              className={`flex-1 text-xs py-1.5 rounded transition-all ${equipDialogType === 'familiar' ? 'bg-primary text-primary-foreground font-bold' : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'} ${equipmentSlots[0]?.item ? 'text-accent font-bold' : ''}`}
            >퍼밀리어</button>
            <button
              onClick={() => { setEquipDialogType('aurasong'); setChampionManualMode(!!equipmentSlots[1]?.item?.manual); }}
              className={`flex-1 text-xs py-1.5 rounded transition-all ${equipDialogType === 'aurasong' ? 'bg-primary text-primary-foreground font-bold' : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60'} ${equipmentSlots[1]?.item ? 'text-accent font-bold' : ''}`}
            >오라의 노래</button>
          </div>

          {/* Manual mode toggle + Filters */}
          <div className="flex items-center gap-2 px-1 flex-wrap text-xs">
            <Button
              variant={championManualMode ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setChampionManualMode(prev => !prev)}
            >
              <Wrench className="w-3 h-3" />
              수동
            </Button>

            {championManualMode && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setChampionManualMode(false)}>취소</Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => championManualFormRef.current?.triggerConfirm()}>적용</Button>
              </div>
            )}

            {!championManualMode && (
              <>
                <span className="text-muted-foreground">스탯:</span>
                <Select value={equipFilterStat} onValueChange={setEquipFilterStat}>
                  <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">전체</SelectItem>
                    {STAT_FILTER_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>

                <span className="text-muted-foreground">원소:</span>
                <Select value={equipFilterElement} onValueChange={setEquipFilterElement}>
                  <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">전체</SelectItem>
                    {['불', '물', '공기', '대지', '빛', '어둠', '골드'].map(el => (
                      <SelectItem key={el} value={el}>{el}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-muted-foreground">영혼:</span>
                <Select value={equipFilterSpirit} onValueChange={setEquipFilterSpirit}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">전체</SelectItem>
                    {Object.entries(SPIRIT_TIER).sort(([,a], [,b]) => b - a).map(([sp, tier]) => (
                      <SelectItem key={sp} value={sp}>
                        <span className="text-muted-foreground text-[10px] mr-1">T{tier})</span>{sp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex-1" />

                <span className="text-muted-foreground">아이템 등급:</span>
                <Select value={equipSlotQuality} onValueChange={q => {
                  setEquipSlotQuality(q);
                  const newSlots = [...equipmentSlots];
                  newSlots[slotIdx] = { ...newSlots[slotIdx], quality: q };
                  setEquipmentSlots(newSlots);
                }}>
                  <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUALITY_OPTIONS.map(q => <SelectItem key={q.value} value={q.value}><span className={q.color}>{q.label}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                  setEquipmentSlots(prev => prev.map(s => ({ ...s, quality: equipSlotQuality })));
                }}>
                  일괄 적용
                </Button>
              </>
            )}
          </div>

          {/* Item grid or Manual form */}
          <div className="flex-1 min-h-0 mt-1">
            <div className="overflow-y-auto h-full border border-border rounded p-3">
              {championManualMode ? (
                <ManualEquipmentForm
                  ref={championManualFormRef}
                  hideActions
                  isAurasong={equipDialogType === 'aurasong'}
                  initialData={equipmentSlots[slotIdx]?.item?.manualData || null}
                  onConfirm={(item) => {
                    const newSlots = [...equipmentSlots];
                    const existingSlot = newSlots[slotIdx];
                    let slotElement = existingSlot?.element || null;
                    let slotSpirit = existingSlot?.spirit || null;
                    if (item.uniqueElement?.length) {
                      slotElement = { type: item.uniqueElement[0], tier: item.uniqueElementTier || 4, affinity: true };
                    }
                    if (item.uniqueSpirit?.length) {
                      slotSpirit = { name: item.uniqueSpirit[0], affinity: true };
                    }
                    newSlots[slotIdx] = {
                      item: { ...item },
                      quality: existingSlot?.quality || equipSlotQuality,
                      element: slotElement,
                      spirit: slotSpirit,
                    };
                    setEquipmentSlots(newSlots);
                    setChampionManualMode(false);
                  }}
                  onCancel={() => setChampionManualMode(false)}
                />
              ) : (
              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-6 gap-3">
                  {filteredItems.map((item, idx) => {
                    const isSelected = currentItem?.name === item.name && currentItem?.tier === item.tier;
                    const quality = equipmentSlots[slotIdx]?.quality || 'common';
                    const elemAffs = item.elementAffinity || [];
                    const spiritAffs = item.spiritAffinity || [];
                    const uniqueElems = item.uniqueElement || [];
                    const uniqueSp = item.uniqueSpirit || [];
                    const hasAffinityIcons = elemAffs.length > 0 || uniqueElems.length > 0 || spiritAffs.length > 0 || uniqueSp.length > 0;
                    return (
                      <Tooltip key={`${item.name}-${item.tier}-${idx}`}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              const newSlots = [...equipmentSlots];
                              if (isSelected) {
                                newSlots[slotIdx] = { item: null, quality: 'common', element: null, spirit: null };
                              } else {
                                const existingEl = item.uniqueElement?.length ? { type: item.uniqueElement[0], tier: item.uniqueElementTier || 1, affinity: true } : newSlots[slotIdx]?.element;
                                const existingSp = item.uniqueSpirit?.length ? { name: item.uniqueSpirit[0], affinity: true } : newSlots[slotIdx]?.spirit;
                                newSlots[slotIdx] = { item: { ...item }, quality, element: existingEl || null, spirit: existingSp || null };
                              }
                              setEquipmentSlots(newSlots);
                            }}
                            className={`relative flex flex-col rounded-lg border-2 transition-all cursor-pointer aspect-square overflow-hidden ${
                              isSelected ? `${QUALITY_BORDER[quality]} bg-accent/10` : 'border-border/50 bg-secondary/20 hover:border-primary/50'
                            }`}
                            style={isSelected ? {
                              background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 85%)`,
                              boxShadow: QUALITY_SHADOW_COLOR[quality],
                            } : {}}
                          >
                            <div className="flex flex-col items-center w-full relative" style={{ height: '75%' }}>
                              <span className="absolute top-1 left-1 text-[10px] font-bold text-muted-foreground bg-background/80 rounded px-1 z-10">T{item.tier}</span>
                              <div className="flex-1 w-full flex items-center justify-center pt-3">
                                {item.imagePath ? (
                                  <img src={item.imagePath} alt={item.name} className="w-16 h-16 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                ) : (
                                  <span className="text-[9px] text-muted-foreground text-center">{item.name.slice(0, 8)}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-foreground/90 truncate w-full text-center leading-tight font-semibold px-1 pb-0.5">{item.name}</p>
                            </div>
                            <div className="flex items-center justify-center gap-1 w-full" style={{ height: '25%' }}>
                              {hasAffinityIcons ? (
                                <>
                                  <div className="flex items-center gap-0.5">
                                    {elemAffs.map(el => (
                                      <img key={el} src={`/images/elements/${ELEMENT_ENG_MAP[el] || el}.webp`} alt={el} className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                    ))}
                                  </div>
                                  {spiritAffs.length > 0 && elemAffs.length > 0 && <div className="w-px h-4 bg-border/50" />}
                                  <div className="flex items-center gap-0.5">
                                    {spiritAffs.map(sp => {
                                      const eng = SPIRIT_NAME_MAP[sp];
                                      return eng ? <img key={sp} src={`/images/enchant/spirit/${eng}_1.webp`} alt={sp} className="w-5 h-5" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null;
                                    })}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[7px] text-muted-foreground/30">-</span>
                              )}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="center" sideOffset={8} avoidCollisions={true} collisionPadding={16} className="max-w-xs p-3 space-y-1.5 z-50">
                          <p className="font-bold text-sm">{item.name} <span className="text-muted-foreground font-normal">(T{item.tier}, {item.typeKor || item.type})</span></p>
                          {item.stats.length > 0 && (
                            <div className="space-y-0.5">
                              {item.stats.map((s: any, si: number) => (
                                <div key={si} className="flex items-center gap-1 text-xs">
                                  <span className={`font-medium ${STAT_COLOR[s.key] || 'text-foreground'}`}>
                                    {STAT_FILTER_OPTIONS.find(o => o.value === s.key)?.label || s.key}:
                                  </span>
                                  <span className="tabular-nums">{formatEquipStatVal(s.key, s.value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {item.elementAffinity && item.elementAffinity.length > 0 && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">친밀 원소: </span>
                              {item.elementAffinity.map((el: string, ei: number) => (
                                <span key={ei}>{ei > 0 ? ', ' : ''}<span className={ELEMENT_COLORS[el] || 'text-foreground'}>{el}</span></span>
                              ))}
                            </div>
                          )}
                          {item.spiritAffinity && item.spiritAffinity.length > 0 && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">친밀 영혼: </span>
                              {item.spiritAffinity.map((sp: string, si: number) => (
                                <span key={si}>{si > 0 ? ', ' : ''}{sp} (T{getSpiritTier(sp)})</span>
                              ))}
                            </div>
                          )}
                          {equipDialogType === 'aurasong' && (() => {
                            const effect = getAurasongSkillEffect(item.name);
                            return effect ? (
                              <div className="text-xs border-t border-border/50 pt-1 mt-1">
                                <span className="text-primary font-semibold">오라의 노래 스킬:</span>
                                <p className="text-foreground/80 whitespace-pre-line mt-0.5">{effect}</p>
                              </div>
                            ) : null;
                          })()}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* Sticky top bar with title + save/cancel */}
      <div className="sticky top-14 z-10 bg-card/90 backdrop-blur-sm border-b border-border py-2 -mx-6 px-6 flex items-center justify-between">
        <h2 className="font-display text-xl text-primary tracking-wide">
          {hero ? '챔피언 수정' : '새 챔피언 추가'}
        </h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setBreakdownOpen(true)} disabled={!champCalcResult}>📊 스탯 계산표</Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>취소</Button>
          <Button type="button" size="sm" onClick={handleSubmit}>저장</Button>
        </div>
      </div>

      <div className="space-y-4 mt-4" ref={formRef} onKeyDown={handleKeyDown}>
        {/* ─── Row 1: Basic Info ─── */}
        <div className="card-fantasy p-4">
          <div className="grid grid-cols-[1.5fr_auto_0.8fr_0.5fr_0.7fr_1fr_1fr] gap-3 items-end">
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">이름</Label>
              <Select value={championName} onValueChange={v => { setChampionName(v); if (!hero) setName(v); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHAMPION_NAMES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block text-center">&nbsp;</Label>
              <div className="flex items-center justify-center h-9">
                <Switch checked={promoted} onCheckedChange={setPromoted} />
              </div>
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">랭크 ({formatRank(Number(rank) || 1)})</Label>
              <Input type="number" value={rank} onChange={handleNumericChange(setRank as any, championMaxRank)} min={1} max={championMaxRank} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">레벨</Label>
              <Input type="number" value={level} onChange={handleNumericChange(setLevel as any, 50)} min={1} max={50} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">카드 LV</Label>
              <Select value={String(cardLevel)} onValueChange={v => setCardLevel(Number(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">포지션</Label>
              <Select value={position || '_empty'} onValueChange={v => setPosition(v === '_empty' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty">없음</SelectItem>
                  {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">상태</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="상태" className="h-9 text-sm" />
            </div>
          </div>
        </div>

        {/* ─── Row 2: Stats + Seeds/Element + Skills + Equipment ─── */}
        <div className="grid grid-cols-[200px_200px_1fr] gap-4">
          {/* Stats Panel */}
          <div className="card-fantasy p-3">
            <h3 className="text-sm font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스탯(자동)</h3>
            <div className="flex items-center justify-center py-2 mb-1">
              <img src={getChampionImagePath(championName)} alt={championName} className="w-12 h-12 object-contain rounded-full"
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 py-0.5 px-1">
                <img src={STAT_ICON_MAP.power} alt="전투력" className="w-5 h-5 flex-shrink-0" />
                <button type="button" onClick={() => { if (powerManual) setPower(''); setPowerManual(!powerManual); }}
                  className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${powerManual ? 'border-accent/50 text-accent bg-accent/10' : 'border-border text-muted-foreground bg-secondary/30'}`}>
                  {powerManual ? '수동' : '자동'}
                </button>
                {powerManual ? (
                  <Input type="text" value={formatPowerDisplay(power)} onChange={handlePowerInput} placeholder="전투력" className="h-7 text-sm flex-1 text-right tabular-nums" />
                ) : (
                  <span className="text-sm text-foreground ml-auto tabular-nums">{power ? formatNumber(Number(power)) : '-'}</span>
                )}
              </div>
              {[
                { icon: STAT_ICON_MAP.hp, value: champCalcResult?.finalHp ?? hp, suffix: '' },
                { icon: STAT_ICON_MAP.atk, value: champCalcResult?.finalAtk ?? atk, suffix: '' },
                { icon: STAT_ICON_MAP.def, value: champCalcResult?.finalDef ?? def, suffix: '' },
                { icon: STAT_ICON_MAP.crit, value: champCalcResult?.totalCrit ?? crit, suffix: ' %' },
                { icon: STAT_ICON_MAP.critDmg, value: champCalcResult?.totalCritDmg ?? critDmg, suffix: '', isCritDmg: true },
                { icon: STAT_ICON_MAP.critAttack, value: champCalcResult?.critAttack ?? critAttack, suffix: '' },
                { icon: STAT_ICON_MAP.evasion, value: champCalcResult?.totalEvasion ?? evasion, suffix: ' %' },
                { icon: STAT_ICON_MAP.threat, value: champCalcResult?.totalThreat ?? threat, suffix: '' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5 px-1">
                  <img src={stat.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm text-foreground ml-auto tabular-nums">
                    {stat.value ? ((stat as any).isCritDmg ? `x${(Number(stat.value) / 100).toFixed(1)}` : `${formatNumber(stat.value)}${stat.suffix}`) : '-'}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 py-0.5 px-1">
                <ElementIcon element={element || '모든 원소'} size={20} />
                <span className="text-sm text-foreground ml-auto tabular-nums">{totalEquipElement > 0 ? formatNumber(totalEquipElement) : (elementValue ? formatNumber(elementValue) : '-')}</span>
              </div>
              <div className="flex items-center gap-2 py-0.5 px-1">
                <img src={STAT_ICON_MAP.airshipPower} alt="에어쉽 파워" className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm text-foreground ml-auto tabular-nums">-</span>
              </div>
            </div>
          </div>

          {/* Seeds + Element Breakdown */}
          <div className="flex flex-col gap-3">
            <div className="card-fantasy p-3">
              <h3 className="text-sm font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>씨앗</h3>
              <div className="flex flex-col gap-[6px]">
                {SEED_ICONS.map((seed, i) => (
                  <div key={seed.key} className="flex items-center gap-2">
                    <img src={seed.icon} alt={seed.key} className="w-5 h-5 flex-shrink-0" />
                    <Input type="number" value={seedValues[i] || ''} onChange={handleSeedChange(seedSetters[i])} min={0} max={80} className="h-7 text-sm flex-1 text-right tabular-nums" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
            <div className="card-fantasy p-3 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>속성별 원소량</h3>
                <button type="button" onClick={() => { if (elementManual) setEquipElements({}); setElementManual(!elementManual); }}
                  className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${elementManual ? 'border-accent/50 text-accent bg-accent/10' : 'border-border text-muted-foreground bg-secondary/30'}`}>
                  {elementManual ? '수동' : '자동'}
                </button>
              </div>
              <div className="flex flex-col gap-[6px]">
                {ELEMENT_ORDER.map(el => {
                  const val = equipElements[el.key] || 0;
                  return (
                    <div key={el.key} className="flex items-center gap-2 py-0.5">
                      <img src={el.icon} alt={el.key} className="w-5 h-5 flex-shrink-0" />
                      {elementManual ? (
                        <Input type="number" value={val || ''} onChange={e => {
                          const v = parseInt(e.target.value, 10);
                          setEquipElements(prev => ({ ...prev, [el.key]: isNaN(v) ? 0 : Math.max(0, v) }));
                        }} min={0} className="h-6 text-xs flex-1 text-right tabular-nums" placeholder="0" />
                      ) : (
                        <span className="text-sm text-foreground ml-auto tabular-nums">{val > 0 ? formatNumber(val) : ''}</span>
                      )}
                    </div>
                  );
                })}
                <div className="border-t border-border pt-1 mt-1 flex items-center gap-2">
                  <img src="/images/elements/all.webp" alt="합산" className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground ml-auto tabular-nums">{totalEquipElement > 0 ? formatNumber(totalEquipElement) : '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skills + Equipment */}
          <div className="flex flex-col gap-3">
            {/* Skills */}
            <div className="card-fantasy p-3">
              <h3 className="text-sm font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스킬</h3>
              <div className="space-y-3">
                {/* Leader Skill */}
                <div className="border border-border rounded overflow-hidden">
                  <div className="grid grid-cols-[50px_44px_1fr_2fr] gap-0 bg-secondary/40 text-xs font-semibold text-foreground border-b border-border">
                    <div className="px-1 py-1 text-center">타입</div>
                    <div className="px-1 py-1 text-center"></div>
                    <div className="px-1 py-1 text-center">스킬명</div>
                    <div className="px-1 py-1 text-center">스킬 효과</div>
                  </div>
                  {/* Leader skill row */}
                  <div className="grid grid-cols-[50px_44px_1fr_2fr] gap-0 border-b border-border/50">
                    <div className="px-1 py-1.5 flex items-center justify-center">
                      <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-yellow-600/60 text-foreground">챔피언</span>
                    </div>
                    <div className="px-1 py-1.5 flex items-center justify-center">
                      <img src={`/images/skills/sk_champion/${champEng}_${leaderSkillTier}.webp`} alt="" className="w-9 h-9 object-contain"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <div className="px-1 py-1.5 flex items-center justify-center text-xs text-foreground">{getLeaderSkillTierName(championName, leaderSkillTier)}</div>
                    <div className="px-1 py-1.5 flex items-center text-xs text-foreground whitespace-pre-line leading-tight">
                      {leaderSkillEffect}
                    </div>
                  </div>
                  {/* Aura Song skill row */}
                  <div className="grid grid-cols-[50px_44px_1fr_2fr] gap-0">
                    <div className="px-1 py-1.5 flex items-center justify-center">
                      <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-cyan-700/60 text-foreground">오라</span>
                    </div>
                    <div className="px-1 py-1.5 flex items-center justify-center">
                      {aurasongSkillIcon ? (
                        <img src={aurasongSkillIcon} alt="" className="w-9 h-9 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      ) : <span className="text-xs text-muted-foreground">-</span>}
                    </div>
                    <div className="px-1 py-1.5 flex items-center justify-center text-xs text-foreground">
                      {aurasongItem?.name || '-'}
                    </div>
                    <div className="px-1 py-1.5 flex items-center text-xs text-foreground whitespace-pre-line leading-tight">
                      {aurasongSkillEffect || '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Equipment */}
            <div className="card-fantasy p-3">
              <h3 className="text-sm font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>장비</h3>
              <div className="grid grid-cols-2 gap-3 max-w-[280px]">
                {renderEquipSlot(0)}
                {renderEquipSlot(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Equipment Select Dialog */}
        {renderEquipDialog()}

        {/* Enchant Picker Dialog */}
        <EnchantPickerDialog
          open={enchantDialogOpen}
          onClose={() => setEnchantDialogOpen(false)}
          initialTab={enchantInitialTab}
          slotCount={2}
          slots={equipmentSlots.map(s => ({ element: s.element, spirit: s.spirit }))}
          itemInfoPerSlot={equipmentSlots.map(s => s.item ? {
            elementAffinity: s.item.elementAffinity,
            spiritAffinity: s.item.spiritAffinity,
            uniqueElement: s.item.uniqueElement,
            uniqueElementTier: s.item.uniqueElementTier,
            uniqueSpirit: s.item.uniqueSpirit,
          } : null)}
          itemTypes={equipmentSlots.map(s => s.item?.type || s.item?.manualData?.type || '')}
          itemNames={equipmentSlots.map(s => s.item?.name || '')}
          onConfirm={(enchantSlots) => {
            const newSlots = equipmentSlots.map((s, i) => ({
              ...s,
              element: enchantSlots[i].element,
              spirit: enchantSlots[i].spirit,
            }));
            setEquipmentSlots(newSlots);
          }}
        />

        <ChampionStatBreakdownDrawer
          open={breakdownOpen}
          onOpenChange={setBreakdownOpen}
          calcResult={champCalcResult}
          championName={championName}
        />

      </div>
    </div>
  );
}
