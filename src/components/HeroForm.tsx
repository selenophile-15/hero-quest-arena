import { useState, useEffect } from 'react';
import { Hero, HeroClassLine, HERO_CLASS_LINES } from '@/types/game';
import { HERO_CLASS_MAP, lookupHeroStats, getAvailableSkills, getUniqueSkill } from '@/lib/gameData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft } from 'lucide-react';

interface HeroFormProps {
  hero?: Hero;
  onSave: (hero: Hero) => void;
  onCancel: () => void;
}

export default function HeroForm({ hero, onSave, onCancel }: HeroFormProps) {
  const [name, setName] = useState(hero?.name || '');
  const [classLine, setClassLine] = useState<HeroClassLine>(hero?.classLine || '전사');
  const [heroClass, setHeroClass] = useState(hero?.heroClass || '');
  const [level, setLevel] = useState(hero?.level || 1);
  const [hp, setHp] = useState(hero?.hp || 0);
  const [atk, setAtk] = useState(hero?.atk || 0);
  const [def, setDef] = useState(hero?.def || 0);
  const [crit, setCrit] = useState(hero?.crit || 5);
  const [critDmg, setCritDmg] = useState(hero?.critDmg || 200);
  const [evasion, setEvasion] = useState(hero?.evasion || 0);
  const [threat, setThreat] = useState(hero?.threat || 90);
  const [element, setElement] = useState(hero?.element || '');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(hero?.skills || []);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [uniqueSkillName, setUniqueSkillName] = useState('');

  const jobs = HERO_CLASS_MAP[classLine] || [];

  // Auto-set first job when classLine changes
  useEffect(() => {
    if (!hero && jobs.length > 0 && !jobs.includes(heroClass)) {
      setHeroClass(jobs[0]);
    }
  }, [classLine]);

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
  }, [heroClass]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => {
      if (prev.includes(skill)) return prev.filter(s => s !== skill);
      if (prev.length >= 4) return prev; // Max 4 selectable (+ 1 unique = 5 total)
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
      hp, atk, def,
      spd: 0,
      crit, critDmg,
      critDmgActual: Math.round(atk * critDmg / 100),
      evasion, threat, element,
      elementValue: 0,
      skills: [uniqueSkillName, ...selectedSkills],
      createdAt: hero?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="animate-fade-in">
      <button onClick={onCancel} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /><span>돌아가기</span>
      </button>

      <h2 className="font-display text-2xl text-primary mb-6">
        {hero ? '영웅 수정' : '새 영웅 추가'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        {/* Basic Info */}
        <div className="card-fantasy p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-muted-foreground text-sm mb-1.5 block">이름</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="영웅 이름" required />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-1.5 block">계열</Label>
              <Select value={classLine} onValueChange={v => setClassLine(v as HeroClassLine)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HERO_CLASS_LINES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-1.5 block">직업</Label>
              <Select value={heroClass} onValueChange={setHeroClass}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {jobs.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-1.5 block">레벨</Label>
              <Input type="number" value={level} onChange={e => setLevel(Number(e.target.value))} min={1} max={50} />
            </div>
          </div>
        </div>

        {/* Stats + Skills side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Stats */}
          <div className="card-fantasy p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">스탯 (자동 로드)</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'HP', value: hp, set: setHp },
                { label: 'ATK', value: atk, set: setAtk },
                { label: 'DEF', value: def, set: setDef },
                { label: 'CRIT%', value: crit, set: setCrit },
                { label: 'CRIT DMG%', value: critDmg, set: setCritDmg },
                { label: '회피%', value: evasion, set: setEvasion },
                { label: '위협도', value: threat, set: setThreat },
              ].map(stat => (
                <div key={stat.label}>
                  <Label className="text-muted-foreground text-xs mb-1 block">{stat.label}</Label>
                  <Input type="number" value={stat.value} onChange={e => stat.set(Number(e.target.value))} className="h-9 text-sm" />
                </div>
              ))}
              <div>
                <Label className="text-muted-foreground text-xs mb-1 block">원소</Label>
                <Input value={element} onChange={e => setElement(e.target.value)} className="h-9 text-sm" readOnly />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="card-fantasy p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">스킬 선택 (최대 5개)</h3>
            
            {/* Fixed unique skill */}
            <div className="mb-3 p-2 rounded bg-primary/10 border border-primary/20">
              <span className="text-xs text-primary font-medium">고유 스킬:</span>
              <span className="text-sm text-foreground ml-2">{uniqueSkillName || '없음'}</span>
            </div>

            {/* Selectable skills */}
            <div className="max-h-48 overflow-y-auto scrollbar-fantasy space-y-1">
              {availableSkills.length === 0 && (
                <p className="text-xs text-muted-foreground">직업을 선택하면 스킬이 표시됩니다</p>
              )}
              {availableSkills.map(skill => (
                <label key={skill} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-secondary/50 cursor-pointer text-sm">
                  <Checkbox
                    checked={selectedSkills.includes(skill)}
                    onCheckedChange={() => toggleSkill(skill)}
                    disabled={!selectedSkills.includes(skill) && selectedSkills.length >= 4}
                  />
                  <span className="text-foreground">{skill}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Equipment placeholder */}
        <div className="card-fantasy p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">장비 선택</h3>
          <p className="text-xs text-muted-foreground">장비 데이터를 업로드하면 여기에 장비 선택 UI가 추가됩니다.</p>
        </div>

        <div className="flex gap-3">
          <Button type="submit" className="flex-1">저장</Button>
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">취소</Button>
        </div>
      </form>
    </div>
  );
}
