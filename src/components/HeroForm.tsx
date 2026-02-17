import { useState, useEffect } from 'react';
import { Hero, HeroClassLine, HERO_CLASS_LINES, STAT_ICON_MAP, POSITIONS, ELEMENT_ICON_MAP } from '@/types/game';
import { lookupHeroStats, getAvailableSkills, getUniqueSkill } from '@/lib/gameData';
import { formatNumber } from '@/lib/format';
import ElementIcon from '@/components/ElementIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft } from 'lucide-react';

interface HeroFormProps {
  hero?: Hero;
  onSave: (hero: Hero) => void;
  onCancel: () => void;
}

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

const CLASS_LINE_RING: Record<string, string> = {
  '전사': 'ring-warrior',
  '로그': 'ring-rogue',
  '주문술사': 'ring-spellcaster',
};

const EQUIPMENT_SLOT_LABELS = ['무기', '방어구', '헬멧', '장갑', '신발', '악세서리'];

const ELEMENT_ORDER = [
  { key: '불', icon: '/images/elements/fire.png' },
  { key: '물', icon: '/images/elements/water.png' },
  { key: '공기', icon: '/images/elements/air.png' },
  { key: '대지', icon: '/images/elements/earth.png' },
  { key: '빛', icon: '/images/elements/light.png' },
  { key: '어둠', icon: '/images/elements/dark.png' },
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

  const [selectedSkills, setSelectedSkills] = useState<string[]>(hero?.skills?.slice(1) || []);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [uniqueSkillName, setUniqueSkillName] = useState('');

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

  // Reset job when classLine or promotion changes
  useEffect(() => {
    if (!classLine) { setHeroClass(''); return; }
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
    getUniqueSkill(heroClass).then(skill => {
      setUniqueSkillName(skill?.name || heroClass);
    });
    setSelectedSkills([]);
  }, [heroClass]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => {
      if (prev.includes(skill)) return prev.filter(s => s !== skill);
      if (prev.length >= 4) return prev;
      return [...prev, skill];
    });
  };

  // Calculated values
  const critAttack = atk && critDmg ? Math.floor(atk * critDmg / 100) : 0;
  const totalEquipElement = Object.values(equipElements).reduce((a, b) => a + b, 0);

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

  // Prevent enter key from submitting
  const preventEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  const ringClass = classLine ? CLASS_LINE_RING[classLine] || '' : '';

  // Class image path helper
  const getClassImage = (jobName: string) => `/images/classes/${jobName}.png`;

  return (
    <div className="animate-fade-in">
      {/* Sticky back button */}
      <div className="sticky top-14 z-10 bg-card/90 backdrop-blur-sm border-b border-border py-2 px-1 -mx-6 px-6 flex items-center justify-between">
        <h2 className="font-display text-xl text-primary">
          {hero ? '영웅 수정' : '새 영웅 추가'}
        </h2>
        <button onClick={onCancel} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /><span>돌아가기</span>
        </button>
      </div>

      <div className="space-y-4 mt-4" onKeyDown={preventEnter}>
        {/* ─── Row 1: Basic Info ─── */}
        <div className={`card-fantasy p-4 ${ringClass}`}>
          <div className="grid grid-cols-[1.5fr_0.8fr_auto_1.5fr_0.7fr_1fr_1fr] gap-3 items-end">
            <div>
              <Label className="text-secondary-foreground text-xs mb-1 block">이름</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="영웅 이름" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-secondary-foreground text-xs mb-1 block">계열</Label>
              <Select value={classLine || '_empty'} onValueChange={v => setClassLine(v === '_empty' ? '' : v as HeroClassLine)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty" disabled>선택</SelectItem>
                  {HERO_CLASS_LINES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-secondary-foreground text-xs mb-1 block">명인의 혼</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch checked={promoted} onCheckedChange={setPromoted} />
                <span className="text-xs text-muted-foreground">{promoted ? '승급' : '기본'}</span>
              </div>
            </div>
            <div>
              <Label className="text-secondary-foreground text-xs mb-1 block">직업</Label>
              <Select value={heroClass || '_empty'} onValueChange={v => v !== '_empty' && setHeroClass(v)}>
                <SelectTrigger className="h-9 text-sm">
                  {heroClass ? (
                    <span className="flex items-center gap-2">
                      <img src={getClassImage(heroClass)} alt="" className="w-5 h-5" onError={e => (e.currentTarget.style.display = 'none')} />
                      {heroClass}
                    </span>
                  ) : (
                    <SelectValue placeholder="선택" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {jobs.length === 0 && <SelectItem value="_empty" disabled>계열을 먼저 선택</SelectItem>}
                  {jobs.map(j => (
                    <SelectItem key={j} value={j}>
                      <span className={`flex items-center gap-2 ${heroClass === j ? 'font-bold text-primary' : ''}`}>
                        <img src={getClassImage(j)} alt="" className="w-5 h-5" onError={e => (e.currentTarget.style.display = 'none')} />
                        {j}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-secondary-foreground text-xs mb-1 block">레벨</Label>
              <Input type="number" value={level} onChange={handleNumericChange(setLevel as any, 50)} min={1} max={50} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-secondary-foreground text-xs mb-1 block">포지션</Label>
              <Select value={position || '_empty'} onValueChange={v => setPosition(v === '_empty' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty">없음</SelectItem>
                  {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-secondary-foreground text-xs mb-1 block">상태</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="상태" className="h-9 text-sm" />
            </div>
          </div>
        </div>

        {/* ─── Row 2: Stats + Seeds + Element + Detail Stats ─── */}
        <div className="grid grid-cols-[200px_200px_1fr] gap-4">
          {/* Stats Panel (Auto) */}
          <div className="card-fantasy p-3">
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">스탯(자동)</h3>
            <div className="space-y-1.5">
              {/* 전투력 - manual */}
              <div className="flex items-center gap-2 py-1">
                <img src={STAT_ICON_MAP.power} alt="전투력" className="w-5 h-5 flex-shrink-0" />
                <Input
                  type="number"
                  value={power}
                  onChange={handleNumericChange(setPower as any)}
                  placeholder="전투력"
                  className="h-7 text-sm flex-1"
                />
              </div>
              {/* Auto stats - read only */}
              {[
                { icon: STAT_ICON_MAP.hp, value: hp, suffix: '' },
                { icon: STAT_ICON_MAP.atk, value: atk, suffix: '' },
                { icon: STAT_ICON_MAP.def, value: def, suffix: '' },
                { icon: STAT_ICON_MAP.crit, value: crit, suffix: ' %' },
                { icon: STAT_ICON_MAP.critDmg, value: critDmg, suffix: '' },
                { icon: STAT_ICON_MAP.critAttack, value: critAttack, suffix: '' },
                { icon: STAT_ICON_MAP.evasion, value: evasion, suffix: ' %' },
                { icon: STAT_ICON_MAP.threat, value: threat, suffix: '' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5 px-1">
                  <img src={stat.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm text-foreground ml-auto tabular-nums">
                    {stat.value ? formatNumber(stat.value) : '-'}{stat.value ? stat.suffix : ''}
                  </span>
                </div>
              ))}
              {/* 원소 */}
              <div className="flex items-center gap-2 py-0.5 px-1 border-t border-border pt-1.5">
                <ElementIcon element={element} size={20} />
                <span className="text-sm text-foreground ml-auto tabular-nums">
                  {totalEquipElement ? formatNumber(totalEquipElement) : '-'}
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
          <div className="space-y-3">
            {/* Seeds */}
            <div className="card-fantasy p-3">
              <h3 className="text-sm font-medium text-secondary-foreground mb-2">씨앗</h3>
              <div className="space-y-2">
                {[
                  { icon: STAT_ICON_MAP.hp, value: seedHp, set: setSeedHp },
                  { icon: STAT_ICON_MAP.atk, value: seedAtk, set: setSeedAtk },
                  { icon: STAT_ICON_MAP.def, value: seedDef, set: setSeedDef },
                ].map((seed, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <img src={seed.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                    <Input
                      type="number"
                      value={seed.value || ''}
                      onChange={handleSeedChange(seed.set)}
                      min={0} max={80}
                      className="h-7 text-sm flex-1"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment Element Breakdown */}
            <div className="card-fantasy p-3">
              <h3 className="text-sm font-medium text-secondary-foreground mb-2">원소 수치</h3>
              <div className="space-y-1">
                {ELEMENT_ORDER.map(el => {
                  const val = equipElements[el.key] || 0;
                  return (
                    <div key={el.key} className="flex items-center gap-2 py-0.5">
                      <img src={el.icon} alt={el.key} className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm text-foreground ml-auto tabular-nums">
                        {val > 0 ? formatNumber(val) : ''}
                      </span>
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

          {/* Detail Stats Placeholder */}
          <div className="card-fantasy p-3">
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">기타 상세 스탯</h3>
            <div className="space-y-1 text-xs text-muted-foreground">
              {[
                '휴식시간', '경험치', '매 턴마다 체력 회복',
                '치명적인 공격에서 살아날 확률',
                '첫 라운드 +공격력 (공룡)',
                '첫 라운드 데미지',
                '첫 라운드 치명타 데미지',
                '적 체력 50% 미만일 때, +공격력 (상어)',
                '적 체력 50% 미만일 때, 데미지',
                '적 체력 50% 미만일 때, 치명타 데미지',
                '체력에 따른 공격력 (50%<HP<75%)',
                '체력에 따른 공격력 (25%<HP<50%)',
                '체력에 따른 공격력 (HP<25%)',
                '문드라 (보스 상대 +공 20%, 방 20%)',
              ].map((stat, i) => (
                <div key={i} className="flex items-center justify-between py-0.5 border-b border-border/30">
                  <span>{stat}</span>
                  <span className="text-foreground tabular-nums">-</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Row 3: Skills ─── */}
        <div className="card-fantasy p-4">
          <h3 className="text-sm font-medium text-secondary-foreground mb-3">스킬</h3>

          {/* Skill slots */}
          <div className="flex gap-2 mb-3">
            <div className="w-12 h-12 rounded border-2 border-primary/50 bg-primary/10 flex items-center justify-center overflow-hidden" title={uniqueSkillName}>
              <span className="text-[8px] text-primary text-center leading-tight">{uniqueSkillName || '고유'}</span>
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`w-12 h-12 rounded border-2 flex items-center justify-center overflow-hidden ${
                  selectedSkills[i]
                    ? 'border-accent/50 bg-accent/10'
                    : 'border-border bg-secondary/30'
                }`}
                title={selectedSkills[i] || `슬롯 ${i + 2}`}
              >
                {selectedSkills[i] ? (
                  <span className="text-[8px] text-foreground text-center leading-tight">{selectedSkills[i]}</span>
                ) : (
                  <span className="text-[8px] text-muted-foreground">{i + 2}</span>
                )}
              </div>
            ))}
          </div>

          <div className="max-h-56 overflow-y-auto scrollbar-fantasy space-y-0.5">
            {availableSkills.length === 0 && (
              <p className="text-xs text-muted-foreground">직업을 선택하면 스킬이 표시됩니다</p>
            )}
            {availableSkills.map(skill => {
              const isSelected = selectedSkills.includes(skill);
              const isFull = selectedSkills.length >= 4 && !isSelected;
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  disabled={isFull}
                  className={`w-full flex items-center gap-2 py-1.5 px-2 rounded text-sm text-left transition-colors ${
                    isSelected
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : isFull
                        ? 'text-muted-foreground/50 cursor-not-allowed'
                        : 'hover:bg-secondary/50 text-foreground'
                  }`}
                >
                  <div className="w-7 h-7 rounded bg-secondary/50 border border-border flex-shrink-0 flex items-center justify-center">
                    <span className="text-[7px] text-muted-foreground">img</span>
                  </div>
                  <span>{skill}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Row 4: Equipment ─── */}
        <div className="card-fantasy p-4">
          <h3 className="text-sm font-medium text-secondary-foreground mb-3">장비</h3>
          <div className="grid grid-cols-6 gap-3">
            {EQUIPMENT_SLOT_LABELS.map((slotLabel, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-16 h-16 rounded-lg border-2 border-border bg-secondary/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  <span className="text-xs text-muted-foreground">{slotLabel}</span>
                </div>
                {/* Enchantment slots: Element + Soul */}
                <div className="flex gap-1">
                  <div className="w-8 h-8 rounded border border-border bg-secondary/20 flex items-center justify-center cursor-pointer hover:border-accent/50 transition-colors" title="원소 마법부여">
                    <span className="text-[7px] text-muted-foreground">원소</span>
                  </div>
                  <div className="w-8 h-8 rounded border border-border bg-secondary/20 flex items-center justify-center cursor-pointer hover:border-accent/50 transition-colors" title="영혼 마법부여">
                    <span className="text-[7px] text-muted-foreground">영혼</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Actions ─── */}
        <div className="flex gap-3">
          <Button type="button" onClick={handleSubmit} className="flex-1">저장</Button>
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">취소</Button>
        </div>
      </div>
    </div>
  );
}
