import { useState, useEffect, useRef } from 'react';
import { Hero, HeroClassLine, HERO_CLASS_LINES, STAT_ICON_MAP, POSITIONS, ELEMENT_ICON_MAP } from '@/types/game';
import { lookupHeroStats, getAvailableSkills, getCommonSkills, getUniqueSkills } from '@/lib/gameData';
import { formatNumber } from '@/lib/format';
import { JOB_NAME_MAP, getJobImagePath, getJobIllustPath } from '@/lib/nameMap';
import { getMaxCommonSkillSlots, getSkillImagePath, setSkillGradeCache } from '@/lib/skillUtils';
import SkillSelectDialog from '@/components/SkillSelectDialog';
import EquipmentSelectDialog from '@/components/EquipmentSelectDialog';
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

// Use JOB_NAME_MAP from nameMap.ts (imported above)

// Base → Promoted job pairs per classLine
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

// Find the paired job (base↔promoted)
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

// Quality radial glow for equipment slots
const QUALITY_BORDER: Record<string, string> = {
  common: 'border-gray-300/50',
  uncommon: 'border-green-400/60',
  flawless: 'border-blue-400/60',
  epic: 'border-purple-400/70',
  legendary: 'border-yellow-400/80',
};
const QUALITY_RADIAL_COLOR: Record<string, string> = {
  common: 'rgba(220,220,220,0.18)',
  uncommon: 'rgba(74,222,128,0.2)',
  flawless: 'rgba(96,165,250,0.25)',
  epic: 'rgba(192,132,252,0.3)',
  legendary: 'rgba(250,204,21,0.35)',
};
const QUALITY_SHADOW_COLOR: Record<string, string> = {
  common: '0 0 8px rgba(220,220,220,0.4)',
  uncommon: '0 0 10px rgba(74,222,128,0.5)',
  flawless: '0 0 12px rgba(96,165,250,0.5)',
  epic: '0 0 14px rgba(192,132,252,0.6)',
  legendary: '0 0 16px rgba(250,204,21,0.7)',
};

const TYPE_IMAGE_FIX: Record<string, string> = { staves: 'staff' };
function getTypeImgPath(typeFile: string) {
  return `/images/type/${TYPE_IMAGE_FIX[typeFile] || typeFile}.png`;
}

function formatEquipStatVal(key: string, value: number): string {
  if (key === '장비_치명타확률%' || key === '장비_회피%') return `${value} %`;
  return formatNumber(value);
}

// Stat icons used in equipment display
const EQUIP_STAT_ICONS: Record<string, string> = {
  '장비_공격력': '/images/stats/attack.png',
  '장비_방어력': '/images/stats/defense.png',
  '장비_체력': '/images/stats/health.png',
  '장비_치명타확률%': '/images/stats/critchance.png',
  '장비_회피%': '/images/stats/evasion.png',
};

const ELEMENT_ORDER = [
  { key: '불', icon: '/images/elements/fire.png' },
  { key: '물', icon: '/images/elements/water.png' },
  { key: '공기', icon: '/images/elements/air.png' },
  { key: '대지', icon: '/images/elements/earth.png' },
  { key: '빛', icon: '/images/elements/light.png' },
  { key: '어둠', icon: '/images/elements/dark.png' },
];

const SEED_ICONS = [
  { key: 'hp', icon: '/images/special/hp_seed.png' },
  { key: 'atk', icon: '/images/special/atk_seed.png' },
  { key: 'def', icon: '/images/special/def_seed.png' },
];

const DETAIL_STATS = [
  '휴식시간 감소 %',
  '경험치 %',
  '매 턴 체력 재생',
  '치명적인 공격에서 살아날 확률 %',
  '공룡 - 첫 라운드 +공격력 %',
  '공룡 - 첫 라운드 대미지',
  '공룡 - 첫 라운드 치명타 대미지',
  '상어 - 적 체력 50% 미만일 때, +공격력 %',
  '상어 - 적 체력 50% 미만일 때, 대미지',
  '상어 - 적 체력 50% 미만일 때, 치명타 대미지',
  '광전사 - 체력 비례 공격력 (50%<HP<75%)',
  '광전사 - 체력 비례 공격력 (25%<HP<50%)',
  '광전사 - 체력 비례 공격력 (HP<25%)',
  '문드라 - 중첩량 (보스 상대 +공 20%, 방 20%)',
];

export default function HeroForm({ hero, onSave, onCancel }: HeroFormProps) {
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

  // Seeds
  const [seedHp, setSeedHp] = useState(hero?.seeds?.hp || 0);
  const [seedAtk, setSeedAtk] = useState(hero?.seeds?.atk || 0);
  const [seedDef, setSeedDef] = useState(hero?.seeds?.def || 0);

  // Equipment elements (placeholder)
  const [equipElements, setEquipElements] = useState<Record<string, number>>(
    hero?.equipmentElements || {}
  );
  const [elementManual, setElementManual] = useState(true);

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
  }>>(Array.from({ length: 6 }, () => ({ item: null, quality: 'common', element: null, spirit: null })));
  // Refs for enter-key navigation
  const formRef = useRef<HTMLDivElement>(null);

  // Load common skills data once
  useEffect(() => {
    getCommonSkills().then(data => {
      setCommonSkillsData(data);
      setSkillGradeCache(data);
    });
  }, []);

  // Preload all job class images for faster dropdown rendering
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

  // Calculate max common skill slots
  const maxCommonSlots = heroClass && level
    ? getMaxCommonSkillSlots(heroClass, Number(level), promoted)
    : 0;

  // When promotion toggles, auto-switch job to paired counterpart
  useEffect(() => {
    if (!classLine) { setHeroClass(''); return; }
    if (heroClass) {
      const paired = findPairedJob(heroClass);
      if (paired) {
        const newJobs = getJobsByPromotion(classLine, promoted);
        if (newJobs.includes(paired)) {
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

  // Load stats when job+level changes
  useEffect(() => {
    if (!heroClass || !level) return;
    lookupHeroStats(heroClass, Number(level)).then(stats => {
      if (stats) {
        setHp(stats.level.hp);
        setAtk(stats.level.atk);
        setDef(stats.level.def);
        setCrit(stats.fixed.critRate);
        setCritDmg(stats.fixed.critDmg);
        setEvasion(stats.fixed.evasion);
        setThreat(stats.fixed.threat);
        setElement(stats.fixed.element);
      }
    });
  }, [heroClass, level]);

  // Load skills when job changes
  useEffect(() => {
    if (!heroClass) return;
    getAvailableSkills(heroClass).then(setAvailableSkills);

    // 고유 스킬은 SKD3의 '한글 직업명' 키로 직접 조회
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

    // 스킬 초기화 하지 않음 - 사용자가 직접 초기화 버튼 사용

    // Load recommended skillsets
    fetch('/data/recommended_skillsets.json')
      .then(r => r.json())
      .then(data => {
        const sets = data[heroClass] || {};
        setRecommendedSets(sets);
      })
      .catch(() => setRecommendedSets({}));

    // Reset equipment on job change
    setEquipmentSlots(Array.from({ length: 6 }, () => ({ item: null, quality: 'common', element: null, spirit: null })));
  }, [heroClass]);

  // 슬롯 수가 줄어도 기존 선택은 유지 (초기화 버튼으로 직접 관리)


  // Calculated values
  const critAttack = atk && critDmg ? Math.floor(atk * critDmg / 100) : 0;
  const totalEquipElement = Object.values(equipElements).reduce((a, b) => a + b, 0);

  // 직업 원소에 해당하는 원소량만 스킬 레벨 계산에 사용
  // 마법검/스펠나이트는 '모든 원소'이므로 총합 사용
  const isAllElement = element === '모든 원소' || heroClass === '마법검' || heroClass === '스펠나이트';
  const jobElementValue = isAllElement ? totalEquipElement : (element ? (equipElements[element] || 0) : 0);

  const handleSubmit = () => {
    if (!name.trim() || !heroClass) return;
    onSave({
      id: hero?.id || crypto.randomUUID(),
      name: name.trim(),
      classLine: classLine as HeroClassLine,
      heroClass,
      type: 'hero',
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
      createdAt: hero?.createdAt || new Date().toISOString(),
    });
  };

  // Enter key moves to next input instead of submitting
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

  // Class image path helper - use English filename
  const getClassImage = (jobName: string) => getJobImagePath(jobName);

  // Format power input display value
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
    <div className="animate-fade-in">
      {/* Sticky back button */}
      <div className="sticky top-14 z-10 bg-card/90 backdrop-blur-sm border-b border-border py-2 px-1 -mx-6 px-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
          {hero ? '영웅 수정' : '새 영웅 추가'}
        </h2>
        <button onClick={onCancel} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /><span>돌아가기</span>
        </button>
      </div>

      <div className="space-y-4 mt-4" ref={formRef} onKeyDown={handleKeyDown}>
        {/* ─── Row 1: Basic Info ─── */}
        <div className={`card-fantasy p-4 ${ringClass}`}>
          <div className="grid grid-cols-[1.5fr_0.8fr_auto_1.5fr_0.7fr_1fr_1fr] gap-3 items-end">
            <div>
              <Label className="text-foreground/80 text-xs mb-1 block">이름</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="영웅 이름" className="h-9 text-sm" />
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
              <Input type="number" value={level} onChange={handleNumericChange(setLevel as any, 50)} min={1} max={50} className="h-9 text-sm" />
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
        <div className="grid grid-cols-[0.8fr_200px_200px_0.7fr] gap-4">
          {/* Job Card - illustration takes 2/3, info below */}
          <div className="card-fantasy p-3 flex flex-col items-center">
            {/* Spacer to push illustration down */}
            <div className="flex-1" />
            {/* Class illustration */}
            <div className="w-full flex items-center justify-center">
              {heroClass ? (
                <img
                  src={`/images/classillust/${JOB_NAME_MAP[heroClass] || heroClass}.png`}
                  alt={heroClass}
                  className="max-w-full max-h-[280px] object-contain drop-shadow-lg"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span className="text-xs text-muted-foreground">직업을 선택하세요</span>
              )}
            </div>
            {/* Position & description below */}
            {heroClass && (
              <div className="flex flex-col items-center mt-3 gap-1 pb-1">
                <span className="text-sm text-foreground">-</span>
                <p className="text-xs text-foreground/70 text-center leading-tight">-</p>
              </div>
            )}
          </div>

          {/* Stats Panel */}
          <div className="card-fantasy p-3">
            <h3 className="text-sm font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스탯(자동)</h3>
            <div className="space-y-1.5">
              {/* Job icon centered above stats */}
              {heroClass && (
                <div className="flex items-center justify-center py-2 mb-1">
                  <img
                    src={getClassImage(heroClass)}
                    alt={heroClass}
                    className="w-12 h-12 object-contain"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              )}
              {/* 전투력 - manual/auto toggle */}
              <div className="flex items-center gap-2 py-0.5 px-1">
                <img src={STAT_ICON_MAP.power} alt="전투력" className="w-5 h-5 flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    if (powerManual) {
                      // Switching to auto → reset value
                      setPower('');
                    }
                    setPowerManual(!powerManual);
                  }}
                  className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
                    powerManual
                      ? 'border-accent/50 text-accent bg-accent/10'
                      : 'border-border text-muted-foreground bg-secondary/30'
                  }`}
                >
                  {powerManual ? '수동' : '자동'}
                </button>
                {powerManual ? (
                  <Input
                    type="text"
                    value={formatPowerDisplay(power)}
                    onChange={handlePowerInput}
                    placeholder="전투력"
                    className="h-7 text-sm flex-1 text-right tabular-nums"
                  />
                ) : (
                  <span className="text-sm text-foreground ml-auto tabular-nums">
                    {power ? formatNumber(Number(power)) : '-'}
                  </span>
                )}
              </div>
              {/* Auto stats - read only */}
              {[
                { icon: STAT_ICON_MAP.hp, value: hp, suffix: '' },
                { icon: STAT_ICON_MAP.atk, value: atk, suffix: '' },
                { icon: STAT_ICON_MAP.def, value: def, suffix: '' },
                { icon: STAT_ICON_MAP.crit, value: crit, suffix: ' %' },
                { icon: STAT_ICON_MAP.critDmg, value: critDmg, suffix: ' %' },
                { icon: STAT_ICON_MAP.critAttack, value: critAttack, suffix: '' },
                { icon: STAT_ICON_MAP.evasion, value: evasion, suffix: ' %' },
                { icon: STAT_ICON_MAP.threat, value: threat, suffix: '' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5 px-1">
                  <img src={stat.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm text-foreground ml-auto tabular-nums">
                    {stat.value ? `${formatNumber(stat.value)}${stat.suffix}` : '-'}
                  </span>
                </div>
              ))}
              {/* 원소 - 직업 원소만 표시 */}
              <div className="flex items-center gap-2 py-0.5 px-1">
                <ElementIcon element={isAllElement ? '모든 원소' : element} size={20} />
                <span className="text-sm text-foreground ml-auto tabular-nums">
                  {jobElementValue ? formatNumber(jobElementValue) : '-'}
                </span>
              </div>
              {/* 에어쉽 파워 */}
              <div className="flex items-center gap-2 py-0.5 px-1">
                <img src={STAT_ICON_MAP.airshipPower} alt="에어쉽 파워" className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm text-foreground ml-auto tabular-nums">-</span>
              </div>
            </div>
          </div>

          {/* Seeds + Element Breakdown */}
          <div className="flex flex-col gap-3">
            {/* Seeds */}
            <div className="card-fantasy p-3">
              <h3 className="text-sm font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>씨앗</h3>
              <div className="flex flex-col gap-[6px]">
                {SEED_ICONS.map((seed, i) => (
                  <div key={seed.key} className="flex items-center gap-2">
                    <img src={seed.icon} alt={seed.key} className="w-5 h-5 flex-shrink-0" />
                    <Input
                      type="number"
                      value={seedValues[i] || ''}
                      onChange={handleSeedChange(seedSetters[i])}
                      min={0} max={80}
                      className="h-7 text-sm flex-1 text-right tabular-nums"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment Element Breakdown */}
            <div className="card-fantasy p-3 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>속성별 원소량</h3>
                <button
                  type="button"
                  onClick={() => {
                    if (elementManual) {
                      setEquipElements({});
                    }
                    setElementManual(!elementManual);
                  }}
                  className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
                    elementManual
                      ? 'border-accent/50 text-accent bg-accent/10'
                      : 'border-border text-muted-foreground bg-secondary/30'
                  }`}
                >
                  {elementManual ? '수동' : '자동'}
                </button>
              </div>
              <div className="flex flex-col gap-[6px]">
                {ELEMENT_ORDER.map(el => {
                  const val = equipElements[el.key] || 0;
                  const isJobElement = element === el.key;
                  return (
                    <div key={el.key} className={`flex items-center gap-2 py-0.5 ${isJobElement ? 'bg-accent/10 rounded px-1 -mx-1' : ''}`}>
                      <img src={el.icon} alt={el.key} className="w-5 h-5 flex-shrink-0" />
                      {elementManual ? (
                        <Input
                          type="number"
                          value={val || ''}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            setEquipElements(prev => ({
                              ...prev,
                              [el.key]: isNaN(v) ? 0 : Math.max(0, v),
                            }));
                          }}
                          min={0}
                          className="h-6 text-xs flex-1 text-right tabular-nums"
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-sm text-foreground ml-auto tabular-nums">
                          {val > 0 ? formatNumber(val) : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
                <div className="border-t border-border pt-1 mt-1 flex items-center gap-2">
                  <img src="/images/elements/all.png" alt="합산" className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground ml-auto tabular-nums">
                    {totalEquipElement > 0 ? formatNumber(totalEquipElement) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detail Stats */}
          <div className="card-fantasy p-3">
            <h3 className="text-sm font-semibold text-primary mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>기타 상세 스탯</h3>
            <div className="space-y-1 text-xs">
              {DETAIL_STATS.map((stat, i) => (
                <div key={i} className="flex items-center justify-between py-0.5 border-b border-border/30">
                  <span className="text-foreground/70">{stat}</span>
                  <span className="text-foreground tabular-nums">-</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Row 3: Skills ─── */}
        <div className="card-fantasy p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스킬</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-accent hover:bg-accent/80 text-accent-foreground"
                onClick={() => setSkillDialogOpen(true)}
                disabled={!heroClass}
              >
                <Plus className="w-3 h-3" />
                스킬 선택
              </Button>
            </div>
          </div>

          {/* Skill table: unique + common */}
          <div className="border border-border rounded overflow-hidden">
            {/* Header */}
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
                ? uniqueSkillData['원소_기준치'].map((v: unknown) => Number(v)).filter(v => Number.isFinite(v))
                : [];

              let uniqueSkillLevelIndex = 0;
              for (let i = 0; i < thresholdValues.length; i++) {
                if (jobElementValue >= thresholdValues[i]) uniqueSkillLevelIndex = i;
              }

              const baseSkillName = hasUniqueSkill
                ? uniqueSkillData?.['레벨별_스킬명']?.[0] || '-'
                : '-';
              const currentSkillName = hasUniqueSkill
                ? uniqueSkillData?.['레벨별_스킬명']?.[uniqueSkillLevelIndex] || baseSkillName
                : '-';
              const currentDescription = hasUniqueSkill
                ? uniqueSkillData?.['스킬_설명']?.[uniqueSkillLevelIndex] || '-'
                : '-';
              const uniqueSkillLevel = hasUniqueSkill ? uniqueSkillLevelIndex + 1 : '-';
              const nextThreshold = hasUniqueSkill
                ? (thresholdValues[uniqueSkillLevelIndex + 1] ?? '-')
                : '-';
              const imagePath = hasUniqueSkill ? uniqueSkillData?.['이미지_경로'] : '';

              return (
                <div className="grid grid-cols-[60px_44px_0.7fr_50px_0.7fr_2fr_100px] gap-0 border-b border-border/50">
                  <div className="px-2 py-1.5 flex items-center justify-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-700/60 text-foreground">고유</span>
                  </div>
                  <div className="px-1 py-1.5 flex items-center justify-center">
                    {imagePath ? (
                      <img
                        src={`/${imagePath}`}
                        alt=""
                        className="w-9 h-9 object-contain"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground">{baseSkillName}</div>
                  <div className="px-1 py-1.5 flex items-center justify-center text-xs text-foreground">{uniqueSkillLevel}</div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground">{currentSkillName}</div>
                  <div className="px-2 py-1.5 flex items-start text-xs text-foreground whitespace-pre-line leading-tight min-h-[2.5rem]">
                    <span className="my-auto">{currentDescription}</span>
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground tabular-nums">
                    {nextThreshold}
                  </div>
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

              // 공용 스킬도 직업 원소 기준으로 레벨 계산
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
                <div
                  key={i}
                  className={`grid grid-cols-[60px_44px_0.7fr_50px_0.7fr_2fr_100px] gap-0 border-b border-border/30 ${
                    isLocked ? 'opacity-30 bg-secondary/10' : ''
                  }`}
                >
                  <div className="px-2 py-1.5 flex items-center justify-center">
                    {grade ? (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${gradeClass}`}>{grade}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{isLocked ? '🔒' : `-`}</span>
                    )}
                  </div>
                  <div className="px-1 py-1.5 flex items-center justify-center">
                    {skillName ? (
                      <img
                        src={getSkillImagePath(skillName)}
                        alt=""
                        className="w-9 h-9 object-contain"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground">
                    {skillName || (isLocked ? '잠김' : '-')}
                  </div>
                  <div className="px-1 py-1.5 flex items-center justify-center text-xs text-foreground">
                    {commonLevel}
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground">
                    {commonCurrentName}
                  </div>
                  <div className="px-2 py-1.5 flex items-start text-xs text-foreground whitespace-pre-line leading-tight min-h-[2.5rem]">
                    <span className="my-auto">{commonCurrentDesc}</span>
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-center text-xs text-foreground tabular-nums">
                    {commonNextThreshold}
                  </div>
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
          <div className="grid grid-cols-6 gap-3">
            {EQUIPMENT_SLOT_LABELS.map((slotLabel, i) => {
              const slotData = equipmentSlots[i];
              const equipItem = slotData?.item;
              const quality = slotData?.quality || 'common';
              const typeFile = equipItem?.type || '';

              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 cursor-pointer"
                  onClick={() => {
                    if (heroClass) {
                      setEquipInitialSlot(i);
                      setEquipDialogOpen(true);
                    }
                  }}
                >
                  <div className="text-[10px] font-semibold text-primary/80 bg-primary/10 w-full text-center rounded-t py-0.5">
                    {slotLabel}
                  </div>

                  {/* Item box with radial glow */}
                  <div
                    className={`relative w-full aspect-square rounded-lg border-2 ${equipItem ? QUALITY_BORDER[quality] : 'border-border'} flex items-center justify-center hover:border-primary/50 transition-all overflow-hidden`}
                    style={equipItem ? {
                      background: `radial-gradient(circle, ${QUALITY_RADIAL_COLOR[quality]} 0%, transparent 70%)`,
                      boxShadow: QUALITY_SHADOW_COLOR[quality],
                    } : { background: 'hsl(var(--secondary) / 0.3)' }}
                  >
                    {equipItem?.relic && (
                      <img src="/images/special/relic_mark.png" alt="유물" className="absolute top-0.5 left-0.5 w-4 h-4 z-10"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                    )}
                    {equipItem?.imagePath ? (
                      <img src={equipItem.imagePath} alt={equipItem.name} className="w-4/5 h-4/5 object-contain"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">비어있음</span>
                    )}
                  </div>

                  {/* Element + Spirit + Type icons */}
                  <div className="grid grid-cols-3 gap-0.5 w-full">
                    <div className="aspect-square rounded border border-border bg-secondary/20 flex items-center justify-center" title="원소">
                      {slotData?.element ? (
                        <img src={`/images/elements/${slotData.element.type}.png`} className="w-4 h-4" alt="" />
                      ) : <span className="text-[6px] text-muted-foreground">원소</span>}
                    </div>
                    <div className="aspect-square rounded border border-border bg-secondary/20 flex items-center justify-center" title="영혼">
                      {slotData?.spirit ? (
                        <span className="text-[6px] text-foreground">{slotData.spirit.name}</span>
                      ) : <span className="text-[6px] text-muted-foreground">영혼</span>}
                    </div>
                    <div className="aspect-square rounded border border-border bg-secondary/20 flex items-center justify-center" title="타입">
                      {typeFile ? (
                        <img src={getTypeImgPath(typeFile)} className="w-4 h-4 object-contain" alt=""
                          onError={e => { e.currentTarget.style.display = 'none'; }} />
                      ) : <span className="text-[6px] text-muted-foreground">타입</span>}
                    </div>
                  </div>

                  {/* Stats line */}
                  {equipItem?.stats && equipItem.stats.length > 0 && (
                    <div className="flex gap-1 justify-center w-full">
                      {equipItem.stats.slice(0, 3).map((stat: any, si: number) => (
                        <div key={si} className="flex items-center gap-0.5">
                          <img src={EQUIP_STAT_ICONS[stat.key] || ''} alt="" className="w-4 h-4" />
                          <span className="text-[10px] text-foreground font-medium tabular-nums">
                            {formatEquipStatVal(stat.key, stat.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Item name */}
                  <p className="text-xs text-foreground truncate w-full text-center leading-tight">
                    {equipItem?.name || '-'}
                  </p>
                </div>
              );
            })}
          </div>
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

        {/* ─── Actions ─── */}
        <div className="flex gap-3">
          <Button type="button" onClick={handleSubmit} className="flex-1">저장</Button>
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">취소</Button>
        </div>
      </div>
    </div>
  );
}
