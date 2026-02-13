import { useState, useMemo } from 'react';
import { Hero, Quest, QUESTS, SimulationResult } from '@/types/game';
import { getHeroes, getSimulations, saveSimulation } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Swords, Trophy, XCircle, History } from 'lucide-react';

function simulateQuest(heroes: Hero[], quest: Quest): Omit<SimulationResult, 'id' | 'timestamp' | 'region'> {
  const totalPower = heroes.reduce((sum, h) => {
    const classMult = h.heroClass === '전사' ? 1.2 : h.heroClass === '기사' ? 1.15 : 1.0;
    return sum + (h.atk * 1.5 + h.def * 0.8 + h.spd * 0.5 + h.crit * 0.3 + h.hp * 0.1) * classMult * (h.level / 10);
  }, 0);

  const ratio = totalPower / quest.enemyPower;
  const success = ratio >= 0.8;
  const score = Math.round(Math.min(ratio * 100, 150));

  const details = success
    ? `파티 전투력 ${Math.round(totalPower)} vs 적 전투력 ${quest.enemyPower}. 승리! (점수: ${score})`
    : `파티 전투력 ${Math.round(totalPower)} vs 적 전투력 ${quest.enemyPower}. 패배... 전투력이 부족합니다.`;

  return { questId: quest.id, questName: quest.name, heroes, score, success, details };
}

export default function QuestSimulation() {
  const allHeroes = getHeroes();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedQuest, setSelectedQuest] = useState<string>(QUESTS[0].id);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<SimulationResult[]>(getSimulations());
  const [showHistory, setShowHistory] = useState(false);

  const quest = QUESTS.find(q => q.id === selectedQuest)!;
  const selectedHeroes = allHeroes.filter(h => selectedIds.has(h.id));

  const toggleHero = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runSimulation = () => {
    if (selectedHeroes.length === 0) return;
    const sim = simulateQuest(selectedHeroes, quest);
    const fullResult: SimulationResult = {
      ...sim,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setResult(fullResult);
  };

  const handleSave = () => {
    if (!result) return;
    saveSimulation(result);
    setHistory(prev => [...prev, result]);
    setResult(null);
  };

  if (allHeroes.length === 0) {
    return (
      <div className="animate-fade-in text-center py-20">
        <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">먼저 리스트 관리에서 영웅을 추가해주세요</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-primary">퀘스트 시뮬레이션</h2>
        <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className="gap-2">
          <History className="w-4 h-4" />
          {showHistory ? '시뮬레이션' : `기록 (${history.length})`}
        </Button>
      </div>

      {showHistory ? (
        <div className="space-y-3">
          {history.length === 0 && (
            <p className="text-muted-foreground text-center py-12">저장된 기록이 없습니다</p>
          )}
          {history.map(r => (
            <div key={r.id} className="card-fantasy p-4">
              <div className="flex items-center gap-3 mb-2">
                {r.success ? <Trophy className="w-5 h-5 text-primary" /> : <XCircle className="w-5 h-5 text-destructive" />}
                <span className="font-display text-foreground">{r.questName}</span>
                <span className="text-sm text-muted-foreground ml-auto">{new Date(r.timestamp).toLocaleDateString('ko-KR')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{r.details}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {r.heroes.map(h => (
                  <span key={h.id} className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">
                    {h.name} ({h.heroClass})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Quest Select */}
          <div className="card-fantasy p-4">
            <label className="text-sm text-muted-foreground block mb-2">던전 선택</label>
            <Select value={selectedQuest} onValueChange={setSelectedQuest}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUESTS.map(q => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name} (난이도 {'★'.repeat(q.difficulty)}) - 권장 Lv.{q.recommendedLevel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">보상: {quest.rewards}</p>
          </div>

          {/* Hero Selection */}
          <div className="card-fantasy p-4">
            <label className="text-sm text-muted-foreground block mb-3">파티 구성 ({selectedHeroes.length}명 선택)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {allHeroes.map(hero => (
                <label
                  key={hero.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                    selectedIds.has(hero.id) ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/20'
                  }`}
                >
                  <Checkbox checked={selectedIds.has(hero.id)} onCheckedChange={() => toggleHero(hero.id)} />
                  <div>
                    <span className="font-medium text-sm text-foreground">{hero.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{hero.heroClass} Lv.{hero.level}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={runSimulation} disabled={selectedHeroes.length === 0} className="w-full gap-2">
            <Swords className="w-4 h-4" /> 시뮬레이션 실행
          </Button>

          {/* Result */}
          {result && (
            <div className={`card-fantasy p-6 animate-fade-in ${result.success ? 'border-primary/30' : 'border-destructive/30'}`}>
              <div className="flex items-center gap-3 mb-3">
                {result.success ? <Trophy className="w-8 h-8 text-primary" /> : <XCircle className="w-8 h-8 text-destructive" />}
                <div>
                  <h3 className="font-display text-xl text-foreground">
                    {result.success ? '승리!' : '패배...'}
                  </h3>
                  <p className="text-sm text-muted-foreground">점수: {result.score}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{result.details}</p>
              <Button onClick={handleSave} variant="outline" className="gap-2">
                결과 저장
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
