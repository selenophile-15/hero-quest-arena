import { useState, useEffect } from 'react';
import { Hero } from '@/types/game';
import { CHAMPION_NAMES, lookupChampionStats } from '@/lib/gameData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';

interface ChampionFormProps {
  hero?: Hero;
  onSave: (hero: Hero) => void;
  onCancel: () => void;
}

export default function ChampionForm({ hero, onSave, onCancel }: ChampionFormProps) {
  const [championName, setChampionName] = useState(hero?.championName || CHAMPION_NAMES[0]);
  const [name, setName] = useState(hero?.name || '');
  const [rank, setRank] = useState(hero?.rank || 1);
  const [level, setLevel] = useState(hero?.level || 1);
  const [hp, setHp] = useState(hero?.hp || 0);
  const [atk, setAtk] = useState(hero?.atk || 0);
  const [def, setDef] = useState(hero?.def || 0);
  const [crit, setCrit] = useState(hero?.crit || 5);
  const [critDmg, setCritDmg] = useState(hero?.critDmg || 200);
  const [evasion, setEvasion] = useState(hero?.evasion || 0);
  const [threat, setThreat] = useState(hero?.threat || 90);
  const [element, setElement] = useState(hero?.element || '');
  const [elementValue, setElementValue] = useState(0);

  // Auto-set name from champion
  useEffect(() => {
    if (!hero) setName(championName);
  }, [championName]);

  // Load stats when champion+rank changes
  useEffect(() => {
    if (!championName || !rank) return;
    lookupChampionStats(championName, rank).then(stats => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: hero?.id || crypto.randomUUID(),
      name: name.trim(),
      classLine: '전사',
      heroClass: championName,
      type: 'champion',
      level, rank,
      championName,
      hp, atk, def,
      spd: 0,
      crit, critDmg, evasion, threat, element,
      skills: [],
      createdAt: hero?.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="animate-fade-in">
      <button onClick={onCancel} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /><span>돌아가기</span>
      </button>

      <h2 className="font-display text-2xl text-primary mb-6">
        {hero ? '챔피언 수정' : '새 챔피언 추가'}
      </h2>

      <form onSubmit={handleSubmit} className="card-fantasy p-6 space-y-5 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label className="text-muted-foreground text-sm mb-1.5 block">챔피언</Label>
            <Select value={championName} onValueChange={setChampionName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHAMPION_NAMES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-muted-foreground text-sm mb-1.5 block">이름</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="챔피언 이름" required />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm mb-1.5 block">랭크</Label>
            <Input type="number" value={rank} onChange={e => setRank(Number(e.target.value))} min={1} max={60} />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm mb-1.5 block">레벨</Label>
            <Input type="number" value={level} onChange={e => setLevel(Number(e.target.value))} min={1} max={50} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">스탯 (랭크 기반 자동 로드)</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'HP', value: hp, set: setHp },
              { label: 'ATK', value: atk, set: setAtk },
              { label: 'DEF', value: def, set: setDef },
              { label: 'CRIT%', value: crit, set: setCrit },
              { label: 'CRIT DMG%', value: critDmg, set: setCritDmg },
              { label: '회피%', value: evasion, set: setEvasion },
              { label: '위협도', value: threat, set: setThreat },
              { label: '원소 수치', value: elementValue, set: setElementValue },
            ].map(stat => (
              <div key={stat.label}>
                <Label className="text-muted-foreground text-xs mb-1 block">{stat.label}</Label>
                <Input type="number" value={stat.value} onChange={e => stat.set(Number(e.target.value))} className="h-9 text-sm" />
              </div>
            ))}
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">원소</Label>
              <Input value={element} readOnly className="h-9 text-sm" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1">저장</Button>
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">취소</Button>
        </div>
      </form>
    </div>
  );
}
