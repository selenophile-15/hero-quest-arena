import { useState, useEffect } from 'react';
import { Hero, HeroClassLine, HERO_CLASS_LINES, STAT_ICON_MAP } from '@/types/game';
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
    ['도둑', '사기꾼'], ['기사도', '정복자'], ['방랑자', '길잡이'],
    ['닌자', '센세'], ['경보병', '근위병'], ['곡예사', '곡예가'],
  ],
  '주문술사': [
    ['마법사', '대마법사'], ['성직자', '비숍'], ['드루이드', '아크 드루이드'],
    ['소서러', '워록'], ['스타게이저', '아스트라맨서'], ['크로노맨서', '페이트위버'],
  ],
};

function getJobsByPromotion(classLine: HeroClassLine, promoted: boolean): string[] {
  const pairs = JOB_PAIRS[classLine] || [];
  return pairs.map(pair => promoted ? pair[1] : pair[0]);
}

// Equipment slot types per index (placeholder - will be refined with actual data)
const EQUIPMENT_SLOT_LABELS = ['무기', '방어구', '헬멧', '장갑', '신발', '악세서리'];

export default function HeroForm({ hero, onSave, onCancel }: HeroFormProps) {
  // Determine initial promotion state from hero's job
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
  const [classLine, setClassLine] = useState<HeroClassLine>(hero?.classLine as HeroClassLine || '전사');
  const [promoted, setPromoted] = useState(getInitialPromotion());
  const [heroClass, setHeroClass] = useState(hero?.heroClass || '');
  const [level, setLevel] = useState(hero?.level || 1);
  const [label, setLabel] = useState(hero?.label || '');
  const [hp, setHp] = useState(hero?.hp || 0);
  const [atk, setAtk] = useState(hero?.atk || 0);
  const [def, setDef] = useState(hero?.def || 0);
  const [crit, setCrit] = useState(hero?.crit || 5);
  const [critDmg, setCritDmg] = useState(hero?.critDmg || 200);
  const [evasion, setEvasion] = useState(hero?.evasion || 0);
  const [threat, setThreat] = useState(hero?.threat || 90);
  const [element, setElement] = useState(hero?.element || '');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(hero?.skills?.slice(1) || []);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [uniqueSkillName, setUniqueSkillName] = useState('');

  const jobs = getJobsByPromotion(classLine, promoted);

  // Auto-set first job when classLine or promotion changes
  useEffect(() => {
    const newJobs = getJobsByPromotion(classLine, promoted);
    if (newJobs.length > 0 && !newJobs.includes(heroClass)) {
      setHeroClass(newJobs[0]);
    }
  }, [classLine, promoted]);

  // Load stats when job+level changes
  useEffect(() => {
    if (!heroClass || !level) return;
    lookupHeroStats(heroClass, level).then(stats => {
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

  // Load available skills when job changes
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !heroClass) return;
    onSave({
      id: hero?.id || crypto.randomUUID(),
      name: name.trim(),
      classLine,
      heroClass,
      type: 'hero',
      level,
      power: 0,
      hp, atk, def,
      crit, critDmg,
      evasion, threat, element,
      elementValue: 0,
      skills: [uniqueSkillName, ...selectedSkills],
      label,
      createdAt: hero?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="animate-fade-in">
      <button onClick={onCancel} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /><span>돌아가기</span>
      </button>

      <h2 className="font-display text-2xl text-primary mb-4">
        {hero ? '영웅 수정' : '새 영웅 추가'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ─── Row 1: Basic Info ─── */}
        <div className="card-fantasy p-4">
          <div className="grid grid-cols-6 gap-3 items-end">
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">이름</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="영웅 이름" required className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">계열</Label>
              <Select value={classLine} onValueChange={v => setClassLine(v as HeroClassLine)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HERO_CLASS_LINES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">승급</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch checked={promoted} onCheckedChange={setPromoted} />
                <span className="text-xs text-muted-foreground">{promoted ? '승급' : '기본'}</span>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">직업</Label>
              <Select value={heroClass} onValueChange={setHeroClass}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {jobs.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">레벨</Label>
              <Input type="number" value={level} onChange={e => setLevel(Number(e.target.value))} min={1} max={50} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">라벨</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="라벨" className="h-9 text-sm" />
            </div>
          </div>
        </div>

        {/* ─── Row 2: Stats + Skills ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stats Panel */}
          <div className="card-fantasy p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">스탯</h3>
            
            {/* Element display */}
            <div className="flex items-center gap-2 mb-3 p-2 rounded bg-secondary/50 border border-border">
              <span className="text-xs text-muted-foreground">원소:</span>
              <ElementIcon element={element} size={24} />
              <span className="text-sm text-foreground">{element || '없음'}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'hp', label: 'HP', value: hp, set: setHp },
                { key: 'atk', label: 'ATK', value: atk, set: setAtk },
                { key: 'def', label: 'DEF', value: def, set: setDef },
                { key: 'crit', label: 'CRIT.C', value: crit, set: setCrit, suffix: '%' },
                { key: 'critDmg', label: 'CRIT.D', value: critDmg, set: setCritDmg },
                { key: 'evasion', label: 'EVA', value: evasion, set: setEvasion, suffix: '%' },
                { key: 'threat', label: 'THREAT', value: threat, set: setThreat },
              ].map(stat => (
                <div key={stat.key} className="flex items-center gap-2">
                  <img src={STAT_ICON_MAP[stat.key]} alt={stat.label} className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1">
                    <Label className="text-muted-foreground text-xs block">{stat.label}</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={stat.value}
                        onChange={e => stat.set(Number(e.target.value))}
                        className="h-8 text-sm flex-1"
                      />
                      {stat.suffix && <span className="text-xs text-muted-foreground">{stat.suffix}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills Panel */}
          <div className="card-fantasy p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">스킬</h3>

            {/* Skill slots visualization */}
            <div className="flex gap-2 mb-3">
              {/* Unique skill slot */}
              <div className="w-12 h-12 rounded border-2 border-primary/50 bg-primary/10 flex items-center justify-center overflow-hidden" title={uniqueSkillName}>
                {/* Skill image placeholder - will use skill image path later */}
                <span className="text-[8px] text-primary text-center leading-tight">{uniqueSkillName || '고유'}</span>
              </div>
              {/* 4 selectable skill slots */}
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

            {/* Skill list */}
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
                    {/* Skill icon placeholder */}
                    <div className="w-7 h-7 rounded bg-secondary/50 border border-border flex-shrink-0 flex items-center justify-center">
                      <span className="text-[7px] text-muted-foreground">img</span>
                    </div>
                    <span>{skill}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Row 3: Equipment Slots ─── */}
        <div className="card-fantasy p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">장비</h3>
          <div className="grid grid-cols-6 gap-3">
            {EQUIPMENT_SLOT_LABELS.map((slotLabel, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                {/* Equipment image slot */}
                <div className="w-16 h-16 rounded-lg border-2 border-border bg-secondary/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  {/* Placeholder - will show equipment type icon based on job */}
                  <span className="text-xs text-muted-foreground">{slotLabel}</span>
                </div>
                {/* Enchantment slot */}
                <div className="w-10 h-10 rounded border border-border bg-secondary/20 flex items-center justify-center cursor-pointer hover:border-accent/50 transition-colors">
                  <span className="text-[8px] text-muted-foreground">마부</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Actions ─── */}
        <div className="flex gap-3">
          <Button type="submit" className="flex-1">저장</Button>
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">취소</Button>
        </div>
      </form>
    </div>
  );
}
