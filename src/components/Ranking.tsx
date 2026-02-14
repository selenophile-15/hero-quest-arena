import { useState, useMemo } from 'react';
import { SimulationResult } from '@/types/game';
import { HERO_CLASS_MAP } from '@/lib/gameData';
import { getSimulations } from '@/lib/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Trophy, Medal, Award } from 'lucide-react';

const REGIONS = ['전체', '서울', '부산', '대구', '인천', '광주', '대전', '울산'];
const ALL_JOBS = Object.values(HERO_CLASS_MAP).flat();

const makeHero = (id: string, name: string, classLine: any, heroClass: string, type: any, level: number, hp: number, atk: number, def: number, spd: number, crit: number, critDmg: number, evasion: number, threat: number, element: string) => ({
  id, name, classLine, heroClass, type, level, hp, atk, def, spd, crit, critDmg,
  critDmgActual: Math.round(atk * critDmg / 100),
  evasion, threat, element, elementValue: 0, skills: [] as string[], createdAt: '',
});

const MOCK_RANKINGS: SimulationResult[] = [
  { id: 'r1', questId: 'q4', questName: '마왕의 성', heroes: [
    makeHero('h1', '아서', '전사', '기사', 'champion', 45, 5000, 350, 400, 80, 15, 200, 0, 90, '빛'),
    makeHero('h2', '메를린', '주문술사', '마법사', 'hero', 42, 2800, 500, 150, 120, 25, 200, 0, 10, '불'),
  ], score: 135, success: true, details: '', timestamp: '2026-02-10T10:00:00Z', region: '서울' },
  { id: 'r2', questId: 'q5', questName: '심연의 균열', heroes: [
    makeHero('h3', '로빈', '전사', '레인저', 'hero', 50, 3200, 480, 200, 160, 35, 200, 20, 90, '공기'),
  ], score: 128, success: true, details: '', timestamp: '2026-02-09T14:00:00Z', region: '부산' },
];

export default function Ranking() {
  const myResults = getSimulations().filter(r => r.success);
  const allResults = [...MOCK_RANKINGS, ...myResults.map(r => ({ ...r, region: '내 결과' }))];

  const [regionFilter, setRegionFilter] = useState('전체');
  const [classFilter, setClassFilter] = useState('all');
  const [maxMembers, setMaxMembers] = useState('');

  const filtered = useMemo(() => {
    let list = [...allResults];
    if (regionFilter !== '전체') list = list.filter(r => r.region === regionFilter);
    if (classFilter !== 'all') list = list.filter(r => r.heroes.some(h => h.heroClass === classFilter));
    if (maxMembers) list = list.filter(r => r.heroes.length <= Number(maxMembers));
    list.sort((a, b) => b.score - a.score);
    return list;
  }, [regionFilter, classFilter, maxMembers, allResults.length]);

  const RankIcon = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-primary" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (rank === 3) return <Award className="w-5 h-5 text-accent" />;
    return <span className="w-5 text-center text-sm text-muted-foreground">{rank}</span>;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="font-display text-2xl text-primary">랭킹</h2>
      <div className="card-fantasy p-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">지역:</span>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              <SelectItem value="내 결과">내 결과</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">직업:</span>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {ALL_JOBS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">최대 인원:</span>
          <Input type="number" value={maxMembers} onChange={e => setMaxMembers(e.target.value)} placeholder="전체" className="w-20" min={1} />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">해당 조건의 결과가 없습니다</p>}
        {filtered.map((r, i) => (
          <div key={r.id} className="card-fantasy p-4 flex items-center gap-4">
            <div className="w-8 flex justify-center"><RankIcon rank={i + 1} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-foreground">{r.questName}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{r.region}</span>
              </div>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {r.heroes.map(h => (
                  <span key={h.id} className="text-xs text-muted-foreground">{h.name}({h.heroClass})</span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <span className="font-display text-lg text-primary">{r.score}</span>
              <span className="text-xs text-muted-foreground block">{r.heroes.length}명</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
