import { useState } from 'react';
import { Hero, HeroClass, HERO_CLASSES } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';

interface HeroFormProps {
  hero?: Hero;
  onSave: (hero: Hero) => void;
  onCancel: () => void;
}

export default function HeroForm({ hero, onSave, onCancel }: HeroFormProps) {
  const [name, setName] = useState(hero?.name || '');
  const [heroClass, setHeroClass] = useState<HeroClass>(hero?.heroClass || '전사');
  const [type, setType] = useState<'hero' | 'champion'>(hero?.type || 'hero');
  const [level, setLevel] = useState(hero?.level || 1);
  const [hp, setHp] = useState(hero?.hp || 100);
  const [atk, setAtk] = useState(hero?.atk || 10);
  const [def, setDef] = useState(hero?.def || 10);
  const [spd, setSpd] = useState(hero?.spd || 10);
  const [crit, setCrit] = useState(hero?.crit || 5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: hero?.id || crypto.randomUUID(),
      name: name.trim(),
      heroClass,
      type,
      level,
      hp,
      atk,
      def,
      spd,
      crit,
      createdAt: hero?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="animate-fade-in">
      <button onClick={onCancel} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        <span>돌아가기</span>
      </button>

      <h2 className="font-display text-2xl text-primary mb-6">
        {hero ? '영웅 수정' : '새 영웅 추가'}
      </h2>

      <form onSubmit={handleSubmit} className="card-fantasy p-6 space-y-5 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label className="text-muted-foreground text-sm mb-1.5 block">이름</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="영웅 이름" required />
          </div>

          <div>
            <Label className="text-muted-foreground text-sm mb-1.5 block">직업</Label>
            <Select value={heroClass} onValueChange={v => setHeroClass(v as HeroClass)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HERO_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-muted-foreground text-sm mb-1.5 block">유형</Label>
            <Select value={type} onValueChange={v => setType(v as 'hero' | 'champion')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hero">영웅</SelectItem>
                <SelectItem value="champion">챔피언</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Level', value: level, set: setLevel, min: 1, max: 99 },
            { label: 'HP', value: hp, set: setHp, min: 1, max: 99999 },
            { label: 'ATK', value: atk, set: setAtk, min: 0, max: 9999 },
            { label: 'DEF', value: def, set: setDef, min: 0, max: 9999 },
            { label: 'SPD', value: spd, set: setSpd, min: 0, max: 999 },
            { label: 'CRIT', value: crit, set: setCrit, min: 0, max: 100 },
          ].map(stat => (
            <div key={stat.label}>
              <Label className="text-muted-foreground text-sm mb-1.5 block">{stat.label}</Label>
              <Input
                type="number"
                value={stat.value}
                onChange={e => stat.set(Number(e.target.value))}
                min={stat.min}
                max={stat.max}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1">저장</Button>
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">취소</Button>
        </div>
      </form>
    </div>
  );
}
