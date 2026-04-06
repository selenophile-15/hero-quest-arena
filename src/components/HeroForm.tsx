import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Hero, HeroClassLine, HERO_CLASS_LINES, STAT_ICON_MAP, POSITIONS, ELEMENT_ICON_MAP } from '@/types/game';
import { SPIRIT_NAME_MAP } from '@/lib/nameMap';
import { useTheme } from '@/hooks/use-theme';
import { getTypeImagePath as getTypeImgPathUtil } from '@/lib/typeImageUtils';
import { lookupHeroStats, getAvailableSkills, getCommonSkills, getUniqueSkills, lookupHeroFixedStats } from '@/lib/gameData';
import { formatNumber } from '@/lib/format';
import { calculateHeroStats, CalculatedStats } from '@/lib/statCalculator';
import { SkillBonusInput } from '@/lib/skillBonusParser';
import StatBreakdownDrawer from '@/components/StatBreakdownDrawer';
import { JOB_NAME_MAP, getJobImagePath, getJobIllustPath } from '@/lib/nameMap';
import { getMaxCommonSkillSlots, getSkillImagePath, setSkillGradeCache } from '@/lib/skillUtils';
import SkillSelectDialog from '@/components/SkillSelectDialog';
import EquipmentSelectDialog from '@/components/EquipmentSelectDialog';
import EnchantPickerDialog, { getElementValue } from '@/components/EnchantPickerDialog';
import ElementIcon from '@/components/ElementIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Plus } from 'lucide-react';

interface HeroFormProps {
  hero?: Hero;
  onSave: (hero: Hero) => void;
  onCancel: () => void;
}

const JOB_PAIRS: Record<string, [string, string][]> = {
  '전사': [
    ['병사', '용병'], ['야만전사', '족장'], ['기사', '군주'],
    ['레인저', '관리인'], ['사무라이', '다이묘'], ['광전사', '잘'],
    ['어둠의 기사', '죽음의 기사'],
  ],
  '로그': [
    ['도둑', '사기꾼'], ['수도승', '그랜드 마스터'], ['머스킷병', '정복자'],
    ['방랑자', '길잡이'], ['닌자', '센세'], ['무희', '곡예가'],
    ['경보병', '근위병'],
  ],
  '주문술사': [
    ['마법사', '대마법사'], ['성직자', '비숍'], ['드루이드', '아크 드루이드'],
    ['소서러', '워록'], ['마법검', '스펠나이트'], ['풍수사', '아스트라맨서'],
    ['크로노맨서', '페이트위버'],
  ],
};

function getJobsByPromotion(classLine: HeroClassLine | '', promoted: boolean): string[] {
  if (!classLine) return [];
  const pairs = JOB_PAIRS[classLine] || [];
  return pairs.map(pair => promoted ? pair[1] : pair[0]);
}

function findPairedJob(jobName: string): string | null {
  for (const pairs of Object.values(JOB_PAIRS)) {
    for (const [base, prom] of pairs) {
      if (base === jobName) return prom;
      if (prom === jobName) return base;
    }
  }
  return null;
}

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

const CLASS_LINE_RING: Record<string, string> = {
  '전사': 'ring-warrior',
  '로그': 'ring-rogue',
  '주문술사': 'ring-spellcaster',
};

const EQUIPMENT_SLOT_LABELS = ['슬롯 1', '슬롯 2', '슬롯 3', '슬롯 4', '슬롯 5', '슬롯 6'];

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
const QUALITY_SHADOW_COLOR: Record<string, string> = {
  common: '0 0 6px rgba(220,220,220,0.5)',
  uncommon: '0 0 7px rgba(74,222,128,0.55)',
  flawless: '0 0 8px rgba(103,232,249,0.55)',
  epic: '0 0 10px rgba(217,70,239,0.6)',
  legendary: '0 0 12px rgba(250,204,21,0.7)',
};

// getTypeImgPath is now theme-aware, called inside component with colorMode

const ELEMENT_ENG_MAP: Record<string, string> = {
  '불': 'fire', '물': 'water', '공기': 'air', '대지': 'earth', '빛': 'light', '어둠': 'dark',
};

const SPIRIT_NAME_MAP_LOCAL = SPIRIT_NAME_MAP;

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

// Base detail stats always shown
const DETAIL_STATS_BASE = [
  '공통 공격력 계수',
  '공통 방어력 계수',
  '공통 체력 계수',
  '매 턴 체력 재생',
  '죽기 전 공격 한 번 버틸 확률',
  '휴식시간 감소%',
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

// Check if quiver stats should be zeroed (no bow/crossbow/gun equipped)
function hasRangedWeapon(slots: Array<{ item: any | null }>): boolean {
  return slots.some(s => {
    if (!s.item) return false;
    return ['bow', 'crossbow', 'gun'].includes(s.item.type);
  });
}

export default function HeroForm({ hero, onSave, onCancel }: HeroFormProps) {
  const { colorMode } = useTheme();
  const getTypeImgPath = (typeFile: string) => getTypeImgPathUtil(typeFile, colorMode);
  const getInitialPromotion = (): boolean => {
    if (!hero) return false;
    for (const pairs of Object.values(JOB_PAIRS)) {
      for (const [, promoted] of pairs) {
        if (promoted === hero.heroClass) return true;
      }
    }
    return false;
  };

  const [name, setName] = useState(hero?.name || '');
  const [classLine, setClassLine] = useState<HeroClassLine | ''>(hero?.classLine as HeroClassLine || '');
  const [promoted, setPromoted] = useState(getInitialPromotion());
  const [heroClass, setHeroClass] = useState(hero?.heroClass || '');
  const [level, setLevel] = useState<number | ''>(hero?.level || '');
  const [levelInput, setLevelInput] = useState<string>(hero?.level ? String(hero.level) : '');
  const [label, setLabel] = useState(hero?.label || '');
  const [position, setPosition] = useState(hero?.position || '');
  const [power, setPower] = useState<number | ''>(hero?.power || '');
  const [powerManual, setPowerManual] = useState(true);
  const [hp, setHp] = useState(hero?.hp || 0);
  const [atk, setAtk] = useState(hero?.atk || 0);
  const [def, setDef] = useState(hero?.def || 0);
  const [crit, setCrit] = useState(hero?.crit || 0);
  const [critDmg, setCritDmg] = useState(hero?.critDmg || 0);
  const [evasion, setEvasion] = useState(hero?.evasion || 0);
  const [threat, setThreat] = useState(hero?.threat || 0);
  const [element, setElement] = useState(hero?.element || '');
  const [elementValue, setElementValue] = useState(hero?.elementValue || 0);

  const [seedHp, setSeedHp] = useState(hero?.seeds?.hp || 0);
  const [seedAtk, setSeedAtk] = useState(hero?.seeds?.atk || 0);
  const [seedDef, setSeedDef] = useState(hero?.seeds?.def || 0);

  const [equipElements, setEquipElements] = useState<Record<string, number>>(
    hero?.equipmentElements || {}
  );
  const [elementManual, setElementManual] = useState(hero?.elementManual || false);

  const [selectedSkills, setSelectedSkills] = useState<string[]>(hero?.skills?.slice(1) || []);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [uniqueSkillName, setUniqueSkillName] = useState('');
  const [uniqueSkillData, setUniqueSkillData] = useState<any>(null);
  const [commonSkillsData, setCommonSkillsData] = useState<Record<string, any>>({});
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [recommendedSets, setRecommendedSets] = useState<Record<string, string[]>>({});
  const [equipDialogOpen, setEquipDialogOpen] = useState(false);
  const [equipInitialSlot, setEquipInitialSlot] = useState(0);
  const [equipmentSlots, setEquipmentSlots] = useState<Array<{
    item: any | null;
    quality: string;
    element: any | null;
    spirit: any | null;
  }>>(hero?.equipmentSlots || Array.from({ length: 6 }, () => ({ item: null, quality: 'common', element: null, spirit: null })));
  const isInitialHeroClass = useRef(!!hero);
  const isPromotionToggle = useRef(false);
  const previousJobRef = useRef(heroClass);
  const formRef = useRef<HTMLDivElement>(null);
  const [enchantDialogOpen, setEnchantDialogOpen] = useState(false);
  const [enchantInitialTab, setEnchantInitialTab] = useState<'element' | 'spirit'>('element');
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [calcStats, setCalcStats] = useState<CalculatedStats | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [detailStats, setDetailStats] = useState<Record<string, number>>(hero?.detailStats || {});
  const [compareMode, setCompareMode] = useState(false);
  const [baselineStats, setBaselineStats] = useState<CalculatedStats | null>(null);

  // Scroll to top when form mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    getCommonSkills().then(data => {
      setCommonSkillsData(data);
      setSkillGradeCache(data);
    });
  }, []);

  useEffect(() => {
    const allJobs = Object.keys(JOB_NAME_MAP);
    allJobs.forEach(jobKor => {
      const img = new Image();
      img.src = getJobImagePath(jobKor);
      const illust = new Image();
      illust.src = getJobIllustPath(jobKor);
    });
  }, []);

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

  const jobs = classLine ? getJobsByPromotion(classLine, promoted) : [];

  const maxCommonSlots = heroClass && level
    ? getMaxCommonSkillSlots(heroClass, Number(level), promoted)
    : 0;

  // Trim skills when slots decrease (promotion change / level change)
  // Don't trim when level field is empty (user is typing)
  useEffect(() => {
    if (!level || !heroClass) return;
    if (selectedSkills.length > maxCommonSlots && maxCommonSlots > 0) {
      setSelectedSkills(prev => prev.slice(0, maxCommonSlots));
    }
  }, [maxCommonSlots, level, heroClass]);

  useEffect(() => {
    if (!classLine) { setHeroClass(''); return; }
    if (heroClass) {
      const paired = findPairedJob(heroClass);
      if (paired) {
        const newJobs = getJobsByPromotion(classLine, promoted);
        if (newJobs.includes(paired)) {
          isPromotionToggle.current = true;
          setHeroClass(paired);
          return;
        }
      }
    }
    const newJobs = getJobsByPromotion(classLine, promoted);
    if (newJobs.length > 0 && !newJobs.includes(heroClass)) {
      setHeroClass('');
    }
  }, [classLine, promoted]);

  useEffect(() => {
    if (!heroClass) { setElement(''); return; }
    lookupHeroFixedStats(heroClass).then(fixed => {
      if (fixed) {
        setElement(fixed.element);
        setCrit(fixed.critRate);
        setCritDmg(fixed.critDmg);
        setEvasion(fixed.evasion);
        setThreat(fixed.threat);
      }
    });

    getAvailableSkills(heroClass).then(setAvailableSkills);

    getUniqueSkills().then(allUnique => {
      const skill = findUniqueSkillByJob(allUnique, heroClass);
      if (skill) {
        setUniqueSkillName(skill['레벨별_스킬명']?.[0] || '-');
        setUniqueSkillData(skill);
      } else {
        setUniqueSkillName('-');
        setUniqueSkillData(null);
      }
    });

    fetch('/data/recommended_skillsets.json')
      .then(r => r.json())
      .then(data => {
        const sets = data[heroClass] || {};
        setRecommendedSets(sets);
      })
      .catch(() => setRecommendedSets({}));

    // Reset logic depends on context
    if (isInitialHeroClass.current) {
      isInitialHeroClass.current = false;
      previousJobRef.current = heroClass;
    } else if (isPromotionToggle.current) {
      // Promotion toggle within same pair: preserve skills, selectively reset incompatible equipment
      isPromotionToggle.current = false;
      previousJobRef.current = heroClass;
      // Skills are preserved (maxCommonSlots trimming is handled by the separate effect)
      // Check equipment compatibility asynchronously
      import('@/lib/equipmentUtils').then(({ loadSID, getSlotTypes, EQUIP_TYPE_MAP }) => {
        loadSID().then(sid => {
          setEquipmentSlots(prev => {
            const newSlots = [...prev];
            for (let i = 0; i < 6; i++) {
              const item = newSlots[i]?.item;
              if (!item) continue;
              const allowedTypes = getSlotTypes(sid, heroClass, i);
              const allowedFileTypes = new Set<string>();
              for (const typeKor of allowedTypes) {
                const info = EQUIP_TYPE_MAP[typeKor];
                if (info) allowedFileTypes.add(info.file);
              }
              // Also allow dual_wield if any weapon type is allowed
              if (allowedTypes.some(t => EQUIP_TYPE_MAP[t]?.category === 'weapon')) {
                allowedFileTypes.add('dual_wield');
              }
              if (!allowedFileTypes.has(item.type)) {
                newSlots[i] = { item: null, quality: 'common', element: null, spirit: null };
              }
            }
            return newSlots;
          });
        });
      });
    } else {
      // Full job change: reset everything
      previousJobRef.current = heroClass;
      setSelectedSkills([]);
      setEquipmentSlots(Array.from({ length: 6 }, () => ({ item: null, quality: 'common', element: null, spirit: null })));
    }
  }, [heroClass]);

  useEffect(() => {
    if (!heroClass || !level) return;
    lookupHeroStats(heroClass, Number(level)).then(stats => {
      if (stats) {
        setHp(stats.level.hp);
        setAtk(stats.level.atk);
        setDef(stats.level.def);
      }
    });
  }, [heroClass, level]);

  // Auto-calculate element values from enchants when not manual
  const calculatedElements = useMemo(() => {
    const totals: Record<string, number> = {};
    equipmentSlots.forEach(s => {
      if (s.element) {
        const val = getElementValue(s.element.tier, s.element.affinity, !!(s.element as any).allElementAffinity);
        totals[s.element.type] = (totals[s.element.type] || 0) + val;
      }
    });
    return totals;
  }, [equipmentSlots]);

  // Sync auto elements
  useEffect(() => {
    if (!elementManual) {
      setEquipElements(calculatedElements);
    }
  }, [calculatedElements, elementManual]);

  const critAttack = atk && critDmg ? Math.floor(atk * critDmg / 100) : 0;
  const totalEquipElement = Object.values(equipElements).reduce((a, b) => a + b, 0);

  const isAllElement = element === '모든 원소' || heroClass === '마법검' || heroClass === '스펠나이트';
  const jobElementValue = isAllElement ? totalEquipElement : (element ? (equipElements[element] || 0) : 0);

  // Quiver stat check
  const hasRanged = useMemo(() => hasRangedWeapon(equipmentSlots), [equipmentSlots]);

  // Build skill bonus inputs for equipment calculation
  const skillBonusInputs = useMemo(() => {
    const inputs: Array<{
      bonusData: Record<string, number | number[]>;
      appliedEquip: string[][] | undefined;
      skillLevel: number;
      skillType: 'unique' | 'common';
      skillName: string;
    }> = [];

    const getSkillLevel = (thresholds: number[]) => {
      let lvl = 0;
      for (let i = 0; i < thresholds.length; i++) {
        if (jobElementValue >= thresholds[i]) lvl = i;
      }
      return lvl;
    };

    // Unique skill (class skill from SKD3)
    if (uniqueSkillData?.['스탯_보너스']) {
      const thresholds = (uniqueSkillData['원소_기준치'] || [0]).map(Number).filter(Number.isFinite);
      const lvl = getSkillLevel(thresholds);
      inputs.push({
        bonusData: uniqueSkillData['스탯_보너스'],
        appliedEquip: uniqueSkillData['적용_장비'],
        skillLevel: lvl,
        skillType: 'unique',
        skillName: uniqueSkillData['스킬명'] || '고유 스킬',
      });
    }

    // Common skills
    for (const skillName of selectedSkills) {
      const skillData = commonSkillsData[skillName];
      if (!skillData?.['스탯_보너스']) continue;
      const thresholds = (skillData['원소_기준치'] || [0]).map(Number).filter(Number.isFinite);
      const lvl = getSkillLevel(thresholds);
      inputs.push({
        bonusData: skillData['스탯_보너스'],
        appliedEquip: skillData['적용_장비'],
        skillLevel: lvl,
        skillType: 'common',
        skillName,
      });
    }

    return inputs;
  }, [uniqueSkillData, selectedSkills, commonSkillsData, jobElementValue]);

  // Build skill inputs for general bonus parsing (with names)
  const skillInputs = useMemo((): SkillBonusInput[] => {
    const inputs: SkillBonusInput[] = [];
    const getSkillLevel2 = (thresholds: number[]) => {
      let lvl = 0;
      for (let i = 0; i < thresholds.length; i++) {
        if (jobElementValue >= thresholds[i]) lvl = i;
      }
      return lvl;
    };

    if (uniqueSkillData?.['스탯_보너스']) {
      const thresholds = (uniqueSkillData['원소_기준치'] || [0]).map(Number).filter(Number.isFinite);
      inputs.push({
        name: uniqueSkillName || '고유 스킬',
        type: 'unique',
        bonusData: uniqueSkillData['스탯_보너스'],
        skillLevel: getSkillLevel2(thresholds),
      });
    }

    for (const skillName of selectedSkills) {
      const skillData = commonSkillsData[skillName];
      if (!skillData?.['스탯_보너스']) continue;
      const thresholds = (skillData['원소_기준치'] || [0]).map(Number).filter(Number.isFinite);
      inputs.push({
        name: skillName,
        type: 'common',
        bonusData: skillData['스탯_보너스'],
        skillLevel: getSkillLevel2(thresholds),
      });
    }

    return inputs;
  }, [uniqueSkillData, uniqueSkillName, selectedSkills, commonSkillsData, jobElementValue]);

  // Auto-calculate stats (Phase 3: full formula)
  useEffect(() => {
    if (!heroClass || !level) { setCalcStats(null); return; }
    calculateHeroStats({
      jobName: heroClass,
      level: Number(level),
      seeds: { hp: seedHp, atk: seedAtk, def: seedDef },
      equipmentSlots,
      hasRangedWeapon: hasRanged,
      totalElementPoints: totalEquipElement,
      skillBonusInputs,
      skillInputs,
    }).then(result => {
      setCalcStats(result);
      if (result) {
        setHp(result.totalHp);
        setAtk(result.totalAtk);
        setDef(result.totalDef);
        setCrit(result.totalCrit);
        setCritDmg(result.totalCritDmg);
        setEvasion(result.totalEvasion);
        setThreat(result.totalThreat);
        setDetailStats(result.detailStats);
      }
    });
  }, [heroClass, level, seedHp, seedAtk, seedDef, equipmentSlots, hasRanged, skillBonusInputs, skillInputs]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameError(true);
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!heroClass) return;
    setNameError(false);
    const heroData: Hero = {
      id: hero?.id || crypto.randomUUID(),
      name: name.trim(),
      classLine: classLine as HeroClassLine,
      heroClass,
      type: 'hero',
      promoted,
      level: Number(level) || 1,
      power: Number(power) || 0,
      hp, atk, def,
      crit, critDmg,
      evasion, threat, element,
      elementValue: totalEquipElement,
      skills: [uniqueSkillName, ...selectedSkills],
      label,
      position,
      seeds: { hp: seedHp, atk: seedAtk, def: seedDef },
      equipmentElements: equipElements,
      elementManual,
      equipmentSlots,
      detailStats,
      createdAt: hero?.createdAt || new Date().toISOString(),
    };
    onSave(heroData);
  };

  const handleSaveAs = () => {
    if (!name.trim()) {
      setNameError(true);
      nameInputRef.current?.focus();
      return;
    }
    if (!heroClass) return;
    setNameError(false);
    const heroData: Hero = {
      id: crypto.randomUUID(),
      name: name.trim(),
      classLine: classLine as HeroClassLine,
      heroClass,
      type: 'hero',
      promoted,
      level: Number(level) || 1,
      power: Number(power) || 0,
      hp, atk, def,
      crit, critDmg,
      evasion, threat, element,
      elementValue: totalEquipElement,
      skills: [uniqueSkillName, ...selectedSkills],
      label,
      position,
      seeds: { hp: seedHp, atk: seedAtk, def: seedDef },
      equipmentElements: equipElements,
      elementManual,
      equipmentSlots,
      detailStats,
      createdAt: new Date().toISOString(),
    };
    onSave(heroData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = formRef.current;
      if (!form) return;
      const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([disabled])'));
      const current = document.activeElement as HTMLInputElement;
      const idx = inputs.indexOf(current);
      if (idx >= 0 && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      }
    }
  };

  const ringClass = classLine ? CLASS_LINE_RING[classLine] || '' : '';
  const getClassImage = (jobName: string) => getJobImagePath(jobName);

  const formatPowerDisplay = (val: number | '') => {
    if (val === '' || val === 0) return '';
    return val.toLocaleString('en-US');
  };

  const handlePowerInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '') { setPower(''); return; }
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;
    if (parsed < 0) return;
    setPower(parsed);
  };

  const seedSetters = [setSeedHp, setSeedAtk, setSeedDef];
  const seedValues = [seedHp, seedAtk, seedDef];

  return (
    <div className="animate-fade-in relative">
      {/* Sticky top bar with title + save/cancel */}
      <div className="sticky top-14 z-10 bg-card/90 backdrop-blur-sm border-b border-border py-2 -mx-6 px-6 flex items-center justify-between">
        <h2 className="text-xl text-primary tracking-wide font-bold">
          {hero ? '영웅 수정' : '새 영웅 추가'}
        </h2>
         <div className="flex gap-2 items-center">
          <Button type="button" variant="outline" size="sm" onClick={() => setBreakdownOpen(true)} disabled={!calcStats}>📊 스탯 계산표</Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>취소</Button>
          {hero && (
            <Button type="button" variant="outline" size="sm" onClick={handleSaveAs}>다른 이름으로 저장</Button>
          )}
          <Button type="button" size="sm" onClick={handleSubmit}>저장</Button>
        </div>
      </div>

      <div className="space-y-4 mt-4" ref={formRef} onKeyDown={handleKeyDown}>
        {/* ─── Row 1: Basic Info ─── */}
        <div className={`card-fantasy p-4 ${ringClass}`}>
          <div className="grid grid-cols-[1.5fr_0.8fr_auto_1.5fr_0.7fr_1fr_1fr] gap-3 items-end">
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">이름</Label>
              <Input ref={nameInputRef} value={name} onChange={e => { setName(e.target.value); setNameError(false); }} placeholder="영웅 이름" className={`h-9 text-sm ${nameError ? 'border-red-500 ring-1 ring-red-500' : ''}`} />
              {nameError && <p className="text-red-500 text-xs mt-0.5">이름을 입력해주세요</p>}
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">계열</Label>
              <Select value={classLine || '_empty'} onValueChange={v => setClassLine(v === '_empty' ? '' : v as HeroClassLine)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty" disabled>선택</SelectItem>
                  {HERO_CLASS_LINES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block text-center">&nbsp;</Label>
              <div className="flex items-center justify-center h-9">
                <Switch checked={promoted} onCheckedChange={p => setPromoted(p)} />
              </div>
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">직업</Label>
              <Select value={heroClass || '_empty'} onValueChange={v => v !== '_empty' && setHeroClass(v)}>
                <SelectTrigger className="h-9 text-sm [&>span]:text-foreground [&>span]:font-normal">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.length === 0 && <SelectItem value="_empty" disabled>계열을 먼저 선택</SelectItem>}
                  {jobs.map(j => (
                    <SelectItem key={j} value={j}>
                      <span className={`inline-flex items-center gap-2 ${heroClass === j ? 'font-bold text-primary' : ''}`}>
                        <span>{j}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">레벨</Label>
              <Input type="number" value={levelInput} onChange={e => {
                setLevelInput(e.target.value);
              }} onBlur={() => {
                const raw = levelInput;
                if (raw === '') { setLevel(''); return; }
                let parsed = parseInt(raw, 10);
                if (isNaN(parsed)) { setLevelInput(level ? String(level) : ''); return; }
                if (parsed > 50) parsed = 50;
                if (parsed < 1) parsed = 1;
                setLevelInput(String(parsed));
                setLevel(parsed);
              }} onKeyDown={e => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }} min={1} max={50} className="h-9 text-sm" />
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

        {/* ─── Row 2: Job Card + Stats + Seeds/Element + Detail Stats ─── */}
        <div className="grid grid-cols-[360px_200px_180px_1fr] gap-4">
          {/* Job Card - expanded to cover old stat box area */}
          <div className="card-fantasy p-3 flex flex-col items-center justify-center">
            <div className="w-full flex items-center justify-center">
              {heroClass ? (
                <img
                  key={heroClass}
                  src={`/images/classillust/${JOB_NAME_MAP[heroClass] || heroClass}.webp`}
                  alt={heroClass}
                  className="max-w-full max-h-[340px] object-contain drop-shadow-lg"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span className="text-xs text-muted-foreground">직업을 선택하세요</span>
              )}
            </div>
          </div>

          {/* Stats only */}
          <div className="card-fantasy p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스탯</h3>
              <Button type="button" variant={compareMode ? 'default' : 'outline'} size="sm" onClick={() => {
                if (!compareMode && calcStats) setBaselineStats(calcStats);
                setCompareMode(!compareMode);
              }} disabled={!calcStats} className="text-[10px] h-6 px-2 gap-1">
                {compareMode ? '🔄 비교 중' : '📈 비교 모드'}
              </Button>
            </div>
            <div className="space-y-1.5">
              {heroClass && (
                <div className="flex items-center justify-center py-2 mb-1">
                  <img src={getClassImage(heroClass)} alt={heroClass} className="w-12 h-12 object-contain"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}
              {/* 전투력 */}
              <div className="flex items-center gap-2 py-0.5 px-1">
                <img src={STAT_ICON_MAP.power} alt="전투력" className="w-5 h-5 flex-shrink-0" />
                <button type="button" onClick={() => { if (powerManual) setPower(''); setPowerManual(!powerManual); }}
                  className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
                    powerManual ? 'border-accent/50 text-accent bg-accent/10' : 'border-border text-muted-foreground bg-secondary/30'
                  }`}>{powerManual ? '수동' : '자동'}</button>
                {powerManual ? (
                  <Input type="text" value={formatPowerDisplay(power)} onChange={handlePowerInput} placeholder="전투력" className="h-7 text-sm flex-1 text-right tabular-nums" />
                ) : (
                  <span className="text-sm text-foreground ml-auto tabular-nums">{power ? formatNumber(Number(power)) : '-'}</span>
                )}
              </div>
              {(() => {
                const statItems = [
                  { icon: STAT_ICON_MAP.hp, value: hp, suffix: '', baseKey: 'totalHp' as const },
                  { icon: STAT_ICON_MAP.atk, value: atk, suffix: '', baseKey: 'totalAtk' as const },
                  { icon: STAT_ICON_MAP.def, value: def, suffix: '', baseKey: 'totalDef' as const },
                  { icon: STAT_ICON_MAP.crit, value: crit, suffix: ' %', baseKey: 'totalCrit' as const },
                  { icon: STAT_ICON_MAP.critDmg, value: critDmg, suffix: '', isCritDmg: true, baseKey: 'totalCritDmg' as const },
                  { icon: STAT_ICON_MAP.critAttack, value: calcStats?.totalCritAttack ?? critAttack, suffix: '', baseKey: 'totalCritAttack' as const },
                  { icon: STAT_ICON_MAP.evasion, value: evasion, suffix: ' %', isEvasion: true, baseKey: 'totalEvasion' as const },
                  { icon: STAT_ICON_MAP.threat, value: threat, suffix: '', baseKey: 'totalThreat' as const },
                ];
                return statItems.map((stat, i) => {
                  const currentVal = calcStats ? (calcStats as any)[stat.baseKey] ?? stat.value : stat.value;
                  const baseVal = compareMode && baselineStats ? (baselineStats as any)[stat.baseKey] ?? 0 : null;
                  const diff = baseVal !== null ? currentVal - baseVal : null;
                  return (
                    <div key={i} className="flex items-center gap-2 py-0.5 px-1">
                      <img src={stat.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm text-foreground ml-auto tabular-nums">
                        {stat.value ? (() => {
                          if ((stat as any).isCritDmg) return `x${(Number(stat.value) / 100).toFixed(1)}`;
                          const v = `${formatNumber(stat.value)}${stat.suffix}`;
                          if ((stat as any).isEvasion && stat.value) {
                            const cap = heroClass === '길잡이' ? 78 : 75;
                            if (Number(stat.value) > cap) return <>{v} <span className="text-xs text-muted-foreground">({cap}%)</span></>;
                          }
                          return v;
                        })() : '-'}
                      </span>
                      {diff !== null && diff !== 0 && (
                        <span className={`text-[10px] font-semibold tabular-nums ml-1 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {diff > 0 ? '▲' : '▼'}{formatNumber(Math.abs(Math.round(diff)))}
                        </span>
                      )}
                    </div>
                  );
                });
              })()}
              <div className="flex items-center gap-2 py-0.5 px-1">
                <ElementIcon element={isAllElement ? '모든 원소' : element} size={20} />
                <span className="text-sm text-foreground ml-auto tabular-nums">
                  {jobElementValue ? formatNumber(jobElementValue) : '-'}
                </span>
              </div>
              <div className="flex items-center gap-2 py-0.5 px-1">
                <img src={STAT_ICON_MAP.airshipPower} alt="에어쉽 파워" className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm text-foreground ml-auto tabular-nums">-</span>
              </div>
            </div>
          </div>

          {/* Seeds + Element */}
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
                <button type="button" onClick={() => {
                  if (elementManual) setEquipElements({});
                  setElementManual(!elementManual);
                }}
                  className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
                    elementManual ? 'border-accent/50 text-accent bg-accent/10' : 'border-border text-muted-foreground bg-secondary/30'
                  }`}>{elementManual ? '수동' : '자동'}</button>
              </div>
              <div className="flex flex-col gap-[6px]">
                {ELEMENT_ORDER.map(el => {
                  const val = equipElements[el.key] || 0;
                  const isJobElement = element === el.key;
                  return (
                    <div key={el.key} className={`flex items-center gap-2 py-0.5 ${isJobElement ? 'bg-accent/10 rounded px-1 -mx-1' : ''}`}>
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
                  <span className="text-sm font-medium text-foreground ml-auto tabular-nums">
                    {totalEquipElement > 0 ? formatNumber(totalEquipElement) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detail Stats - auto-calculated (read-only display) */}
          <div className="card-fantasy p-3">
            <h3 className="text-sm font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>기타 상세 스탯</h3>
            <div className="space-y-1 text-xs">
              {/* Base stats (always shown) */}
              {DETAIL_STATS_BASE.map((stat, i) => (
                <div key={i} className="flex items-center justify-between py-0.5 border-b border-border/30 gap-2">
                  <span className="text-foreground/70 flex-1 min-w-0 truncate">{stat}</span>
                  <span className="text-sm text-foreground tabular-nums text-right w-20">
                    {detailStats[stat] ? (stat.includes('%') || stat.includes('계수') ? `${detailStats[stat]}%` : formatNumber(detailStats[stat])) : '-'}
                  </span>
                </div>
              ))}
              {/* Conditional stats (dynamically from detailStats keys) */}
              {Object.entries(detailStats)
                .filter(([key]) => !DETAIL_STATS_BASE.includes(key))
                .map(([key, val], i) => {
                  const isPercent = key.includes('%') || key.includes('계수');
                  const isComputed = key.includes('(단독) 공격력') || key.includes('(단독) 방어력');
                  return (
                    <div key={`cond-${i}`} className={`flex items-center justify-between py-0.5 border-b border-border/30 gap-2 ${isComputed ? 'pl-3' : ''}`}>
                      <span className={`flex-1 min-w-0 truncate ${isComputed ? 'text-foreground/50 italic' : 'text-foreground/70'}`}>{isComputed ? `↳ ${key}` : key}</span>
                      <span className={`text-sm tabular-nums text-right w-24 ${isComputed ? 'text-accent font-medium' : 'text-foreground'}`}>
                        {val ? (isPercent ? `${val}%` : formatNumber(val)) : '-'}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>



        <div className="card-fantasy p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스킬</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs gap-1 bg-accent hover:bg-accent/80 text-accent-foreground"
                onClick={() => setSkillDialogOpen(true)} disabled={!heroClass}>
                <Plus className="w-3 h-3" />스킬 선택
              </Button>
            </div>
          </div>

          <div className="border border-border rounded overflow-hidden">
            <div className="grid grid-cols-[60px_44px_0.7fr_50px_0.7fr_2fr_100px] gap-0 bg-secondary/40 text-xs font-semibold text-foreground border-b border-border">
              <div className="px-2 py-1.5 text-center">등급</div>
              <div className="px-1 py-1.5 text-center"></div>
              <div className="px-2 py-1.5 text-center">기본 스킬명</div>
              <div className="px-1 py-1.5 text-center">레벨</div>
              <div className="px-2 py-1.5 text-center">레벨 스킬명</div>
              <div className="px-2 py-1.5 text-center">스킬 효과</div>
              <div className="px-2 py-1.5 text-center">다음 레벨 원소량</div>
            </div>

            {/* Unique skill row */}
            {(() => {
              const hasUniqueSkill = Boolean(uniqueSkillData);
              const thresholdValues = Array.isArray(uniqueSkillData?.['원소_기준치'])
                ? uniqueSkillData['원소_기준치'].map((v: unknown) => Number(v)).filter((v: number) => Number.isFinite(v))
                : [];

              let uniqueSkillLevelIndex = 0;
              for (let i = 0; i < thresholdValues.length; i++) {
                if (jobElementValue >= thresholdValues[i]) uniqueSkillLevelIndex = i;
              }

              const baseSkillName = hasUniqueSkill ? uniqueSkillData?.['레벨별_스킬명']?.[0] || '-' : '-';
              const currentSkillName = hasUniqueSkill ? uniqueSkillData?.['레벨별_스킬명']?.[uniqueSkillLevelIndex] || baseSkillName : '-';
              const currentDescription = hasUniqueSkill ? uniqueSkillData?.['스킬_설명']?.[uniqueSkillLevelIndex] || '-' : '-';
              const uniqueSkillLevel = hasUniqueSkill ? uniqueSkillLevelIndex + 1 : '-';
              const nextThreshold = hasUniqueSkill ? (thresholdValues[uniqueSkillLevelIndex + 1] ?? '-') : '-';
              const imagePath = hasUniqueSkill ? uniqueSkillData?.['이미지_경로'] : '';

              return (
                <div className="grid grid-cols-[60px_44px_0.7fr_50px_0.7fr_2fr_100px] gap-0 border-b border-border/50">
                  <div className="px-2 py-1.5 flex items-center justify-center">
                    <span className="skill-badge-unique px-1.5 py-0.5 rounded text-xs">고유</span>
                  </div>
                  <div className="px-1 py-1.5 flex items-center justify-center">
                    {imagePath ? <img src={`/${imagePath}`} alt="" className="w-9 h-9 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground">{baseSkillName}</div>
                  <div className="px-1 py-1.5 flex items-center justify-center text-xs text-foreground">{uniqueSkillLevel}</div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground">{currentSkillName}</div>
                  <div className="px-2 py-1.5 flex items-start text-xs text-foreground whitespace-pre-line leading-tight min-h-[2.5rem]">
                    <span className="my-auto">{currentDescription}</span>
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground tabular-nums">{nextThreshold}</div>
                </div>
              );
            })()}

            {/* Common skill rows */}
            {Array.from({ length: 4 }).map((_, i) => {
              const skillName = selectedSkills[i];
              const isLocked = i >= maxCommonSlots;
              const skillData = skillName ? commonSkillsData[skillName] : null;
              const grade = skillData?.['희귀도'] || '';
              const gradeClass = grade === '에픽' ? 'bg-yellow-600/60 text-yellow-100' :
                                 grade === '희귀' ? 'bg-cyan-700/60 text-cyan-100' :
                                 grade === '일반' ? 'bg-amber-800/40 text-foreground' : '';

              const commonThresholds: number[] = skillData?.['원소_기준치']?.map((v: unknown) => Number(v)).filter((v: number) => Number.isFinite(v)) || [];
              let commonSkillLevelIndex = 0;
              for (let t = 0; t < commonThresholds.length; t++) {
                if (jobElementValue >= commonThresholds[t]) commonSkillLevelIndex = t;
              }
              const commonCurrentName = skillData?.['레벨별_스킬명']?.[commonSkillLevelIndex] || (skillName || '-');
              const commonCurrentDesc = skillData?.['스킬_설명']?.[commonSkillLevelIndex] || '-';
              const commonNextThreshold = commonThresholds[commonSkillLevelIndex + 1] ?? '-';
              const commonLevel = skillName ? commonSkillLevelIndex + 1 : '-';

              return (
                <div key={i} className={`grid grid-cols-[60px_44px_0.7fr_50px_0.7fr_2fr_100px] gap-0 border-b border-border/30 ${isLocked ? 'opacity-30 bg-secondary/10' : ''}`}>
                  <div className="px-2 py-1.5 flex items-center justify-center">
                    {grade ? <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${gradeClass}`}>{grade}</span> : <span className="text-xs text-muted-foreground">{isLocked ? '🔒' : `-`}</span>}
                  </div>
                  <div className="px-1 py-1.5 flex items-center justify-center">
                    {skillName ? <img src={getSkillImagePath(skillName)} alt="" className="w-9 h-9 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground">{skillName || (isLocked ? '잠김' : '-')}</div>
                  <div className="px-1 py-1.5 flex items-center justify-center text-xs text-foreground">{commonLevel}</div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground">{commonCurrentName}</div>
                  <div className="px-2 py-1.5 flex items-start text-xs text-foreground whitespace-pre-line leading-tight min-h-[2.5rem]">
                    <span className="my-auto">{commonCurrentDesc}</span>
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground tabular-nums">{commonNextThreshold}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skill Select Dialog */}
        <SkillSelectDialog
          open={skillDialogOpen}
          onClose={() => setSkillDialogOpen(false)}
          availableSkills={availableSkills}
          selectedSkills={selectedSkills}
          maxSlots={maxCommonSlots}
          commonSkillsData={commonSkillsData}
          onConfirm={setSelectedSkills}
          jobElementValue={jobElementValue}
          recommendedSets={Object.keys(recommendedSets).length > 0 ? recommendedSets : undefined}
        />

        {/* ─── Row 4: Equipment ─── */}
        <div className="card-fantasy p-4">
          <h3 className="text-sm font-semibold text-primary mb-3" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>장비</h3>
          {/* Quiver warning */}
          {equipmentSlots.some(s => s.item?.type === 'quiver') && !hasRanged && (
            <div className="mb-3 p-2 border border-red-400/50 rounded bg-red-400/10">
              <p className="text-sm font-bold text-red-400">⚠ 화살통 경고: 활/크로스보우/총이 장착되지 않아 화살통 스탯이 0으로 처리됩니다.</p>
            </div>
          )}
          <div className="grid grid-cols-6 gap-3">
            {EQUIPMENT_SLOT_LABELS.map((slotLabel, i) => {
              const slotData = equipmentSlots[i];
              const equipItem = slotData?.item;
              const quality = slotData?.quality || 'common';
              const typeFile = equipItem?.type || '';
              const isQuiverZero = equipItem?.type === 'quiver' && !hasRanged;

              const displayElement = slotData?.element || (equipItem?.uniqueElement?.length ? { type: equipItem.uniqueElement[0], tier: equipItem.uniqueElementTier || 1, affinity: true } : null);
              const displaySpirit = slotData?.spirit || (equipItem?.uniqueSpirit?.length ? { name: equipItem.uniqueSpirit[0], affinity: true } : null);

              return (
                <div
                  key={i}
                  className="flex flex-col items-center cursor-pointer"
                  onClick={() => {
                    if (heroClass) {
                      setEquipInitialSlot(i);
                      setEquipDialogOpen(true);
                    }
                  }}
                >
                  <div
                    className={`relative w-full rounded-lg border-2 ${equipItem ? QUALITY_BORDER[quality] : 'border-border'} flex flex-col items-stretch overflow-hidden hover:border-primary/50 transition-all`}
                    style={equipItem ? {
                      background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 85%)`,
                      boxShadow: QUALITY_SHADOW_COLOR[quality],
                    } : { background: 'hsl(var(--secondary) / 0.3)' }}
                  >
                    <div className="w-full flex items-center justify-between gap-1 px-1.5 pt-1">
                      <div className="rounded bg-card/80 border border-border/40 px-1.5 py-0.5">
                        <span className="text-xs font-bold text-foreground tracking-wide">{slotLabel}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {equipItem && (
                          <span className="text-xs font-bold text-foreground/90 bg-background/80 rounded border border-border/40 px-1 py-0.5">T{equipItem.tier}</span>
                        )}
                        {equipItem?.relic && (
                          <img
                            src="/images/special/icon_global_artifact.webp"
                            alt="유물"
                            className="w-5 h-5"
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>
                    </div>

                    <div className="w-full flex items-center justify-center" style={{ aspectRatio: '1' }}>
                      {equipItem?.imagePath ? (
                        <img
                          src={equipItem.imagePath}
                          alt={equipItem.name}
                          className="w-4/5 h-4/5 object-contain"
                          onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">비어있음</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-0.5 w-[90%] p-0.5 mb-0.5 self-center">
                      <div
                        className="aspect-square rounded border border-border/30 bg-background/30 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-all"
                        title="원소 선택"
                        onClick={(e) => { e.stopPropagation(); setEnchantInitialTab('element'); setEnchantDialogOpen(true); }}
                      >
                        {displayElement ? (
                          <img
                            src={`/images/enchant/element/${ELEMENT_ENG_MAP[displayElement.type] || displayElement.type}${displayElement.tier}_${displayElement.affinity ? '2' : '1'}.webp`}
                            className="w-[80%] h-[80%] object-cover"
                            alt={displayElement.type}
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : <span className="text-[6px] text-muted-foreground">원소</span>}
                      </div>
                      <div
                        className="aspect-square rounded border border-border/30 bg-background/30 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-all"
                        title="영혼 선택"
                        onClick={(e) => { e.stopPropagation(); setEnchantInitialTab('spirit'); setEnchantDialogOpen(true); }}
                      >
                        {displaySpirit ? (() => {
                          const eng = SPIRIT_NAME_MAP_LOCAL[displaySpirit.name];
                          if (displaySpirit.name === '문드라') {
                            return (
                              <img
                                src="/images/enchant/spirit/mundra.webp"
                                className="w-[80%] h-[80%] object-cover"
                                alt="문드라"
                                onError={e => { e.currentTarget.style.display = 'none'; }}
                              />
                            );
                          }
                          return eng ? (
                            <img
                              src={`/images/enchant/spirit/${eng}_${displaySpirit.affinity ? '2' : '1'}.webp`}
                              className="w-[80%] h-[80%] object-cover"
                              alt={displaySpirit.name}
                              onError={e => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : <span className="text-[6px] text-foreground">{displaySpirit.name}</span>;
                        })() : <span className="text-[6px] text-muted-foreground">영혼</span>}
                      </div>
                      <div className="aspect-square rounded border border-border/30 bg-background/30 flex items-center justify-center overflow-hidden" title="타입">
                        {typeFile ? (
                          <img
                            src={getTypeImgPath(typeFile)}
                            className="w-[80%] h-[80%] object-contain"
                            alt=""
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : <span className="text-[6px] text-muted-foreground">타입</span>}
                      </div>
                    </div>

                    {equipItem?.stats && equipItem.stats.length > 0 && (
                      <div className="w-full px-1 pb-1 border-t border-border/20 mt-0.5">
                        <div className="flex items-center justify-center gap-1.5 pt-0.5">
                          {equipItem.stats.slice(0, 3).map((stat: any, si: number) => {
                            const slotCalc = calcStats?.equipResult?.slots?.[i];
                            let statVal: number;
                            if (isQuiverZero) {
                              statVal = 0;
                            } else if (slotCalc) {
                              if (stat.key === '장비_공격력') statVal = slotCalc.finalAtk || 0;
                              else if (stat.key === '장비_방어력') statVal = slotCalc.finalDef || 0;
                              else if (stat.key === '장비_체력') statVal = slotCalc.finalHp || 0;
                              else if (stat.key === '장비_치명타확률%') statVal = slotCalc.baseCrit || 0;
                              else if (stat.key === '장비_회피%') statVal = slotCalc.baseEvasion || 0;
                              else statVal = stat.value;
                            } else {
                              statVal = stat.value;
                            }
                            return (
                              <div key={si} className="flex items-center gap-0.5">
                                <img src={EQUIP_STAT_ICONS[stat.key] || ''} alt="" className="w-4 h-4" />
                                <span className={`text-xs font-semibold tabular-nums ${isQuiverZero ? 'text-red-400 line-through' : 'text-foreground'}`}>
                                  {formatEquipStatVal(stat.key, statVal)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mx-1 mt-1 mb-1 rounded bg-card/80 border border-border/40 py-1 text-center">
                      <p className={`text-sm truncate leading-tight font-bold px-1 ${equipItem ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {equipItem?.name || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Relic effect display */}
          {equipmentSlots.some(s => s.item?.relic && s.item?.relicEffect) && (
            <div className="mt-3 p-2 border border-yellow-400/30 rounded bg-yellow-400/5">
              <p className="text-xs font-semibold text-yellow-400 mb-1 flex items-center gap-1">
                <img src="/images/special/icon_global_artifact.webp" alt="유물" className="w-4 h-4 inline" onError={e => { e.currentTarget.style.display = 'none'; }} />
                유물 효과
              </p>
              {equipmentSlots.filter(s => s.item?.relic && s.item?.relicEffect).map((s, i) => (
                <div key={i} className="text-xs text-foreground/90 dark:text-foreground/80">
                  {s.item!.relicEffect.split(/\\n|\n/).map((line: string, li: number) => (
                    <span key={li}>{li > 0 && <br />}{line}</span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Equipment Select Dialog */}
        <EquipmentSelectDialog
          open={equipDialogOpen}
          onClose={() => setEquipDialogOpen(false)}
          jobName={heroClass}
          heroLevel={Number(level) || 1}
          initialSlot={equipInitialSlot}
          currentEquipment={equipmentSlots}
          onConfirm={setEquipmentSlots}
        />

        {/* Enchant Picker Dialog */}
        <EnchantPickerDialog
          open={enchantDialogOpen}
          onClose={() => setEnchantDialogOpen(false)}
          initialTab={enchantInitialTab}
          slotCount={6}
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

      </div>

      {/* Stat Breakdown Drawer */}
      <StatBreakdownDrawer
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        calcStats={calcStats}
      />
    </div>
  );
}
