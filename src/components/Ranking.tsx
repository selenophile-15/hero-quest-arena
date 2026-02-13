import { useState, useMemo } from 'react';
import { SimulationResult } from '@/types/game';
import { HERO_CLASS_MAP } from '@/lib/gameData';
import { getSimulations } from '@/lib/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Trophy, Medal, Award } from 'lucide-react';

const REGIONS = ['전체', '서울', '부산', '대구', '인천', '광주', '대전', '울산'];
const ALL_JOBS = Object.values(HERO_CLASS_MAP).flat();

const MOCK_RANKINGS: SimulationResult[] = [
  { id: 'r1', questId: 'q4', questName: '마왕의 성', heroes: [
    { id: 'h1', name: '아서', classLine: '전사', heroClass: '기사', type: 'champion', level: 45, hp: 5000, atk: 350, def: 400, spd: 80, crit: 15, critDmg: 200, evasion: 0, threat: 90, element: '빛', skills: [], createdAt: '' },
    { id: 'h2', name: '메를린', classLine: '주문술사', heroClass: '마법사', type: 'hero', level: 42, hp: 2800, atk: 500, def: 150, spd: 120, crit: 25, critDmg: 200, evasion: 0, threat: 10, element: '불', skills: [], createdAt: '' },
  ], score: 135, success: true, details: '', timestamp: '2026-02-10T10:00:00Z', region: '서울' },
  { id: 'r2', questId: 'q5', questName: '심연의 균열', heroes: [
    { id: 'h3', name: '로빈', classLine: '전사', heroClass: '레인저', type: 'hero', level: 50, hp: 3200, atk: 480, def: 200, spd: 160, crit: 35, critDmg: 200, evasion: 20, threat: 90, element: '공기', skills: [], createdAt: '' },
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
