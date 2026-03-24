import { useState, useMemo } from 'react';
import { SimulationResult } from '@/types/game';
import { HERO_CLASS_MAP, CHAMPION_NAMES } from '@/lib/gameData';
import { getSimulations } from '@/lib/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Medal, Award, Search, ChevronDown, ChevronUp, Users, Clock, Swords, Shield, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatNumber } from '@/lib/format';

const QUEST_TABS = [
  { key: 'normal', label: '일반' },
  { key: 'flash', label: '깜짝 퀘스트' },
  { key: 'lcog', label: '황금의 도시' },
  { key: 'tot', label: '명인의 탑' },
];

const REGIONS: Record<string, string[]> = {
  normal: ['전체', '숲', '동굴', '늪지', '사막', '산', '해안', '성', '화산', '공허', '심해'],
  flash: ['전체'],
  lcog: ['전체'],
  tot: ['전체', '일반', '공포'],
};

const DIFFICULTIES = ['일반', '하드', '익스트림'];

const SORT_OPTIONS = [
  { key: 'winRate', label: '성공률' },
  { key: 'avgRounds', label: '평균 턴 수' },
  { key: 'avgSurvivors', label: '평균 생존자 수' },
  { key: 'avgDamage', label: '평균 대미지' },
  { key: 'minRounds', label: '최소 턴 클리어' },
  { key: 'stabilityScore', label: '안정성 점수' },
];

const ALL_JOBS = Object.values(HERO_CLASS_MAP).flat();
const CLASS_LINES = Object.keys(HERO_CLASS_MAP);

// Mock ranking data for demo
const MOCK_RANKINGS = generateMockRankings();

function generateMockRankings() {
  const names = ['DragonSlayer', 'GuildMasterKim', '영웅사냥꾼', '퀘스트마스터', '불꽃전사', '빛의수호자', '어둠의검', '바람의궁수'];
  const questNames = ['울부짖는 숲', '오로라 동굴', '속삭이는 늪지', '고대의 사막', '불타는 산', '여명의 해안', '망자의 성', '용의 화산'];
  const classes = ['기사', '사무라이', '대마법사', '비숍', '닌자', '길잡이', '광전사', '크로노맨서'];
  const champions = ['아르곤', '릴루', '시아', '야미', '도노반', '헴마'];
  
  return Array.from({ length: 30 }, (_, i) => ({
    id: `mock-${i}`,
    rank: i + 1,
    nickname: names[i % names.length] + (i >= names.length ? `_${Math.floor(i / names.length)}` : ''),
    questType: 'normal' as const,
    questName: questNames[i % questNames.length],
    region: questNames[i % questNames.length],
    difficulty: ['쉬움', '보통', '어려움', '익스트림'][i % 4],
    winRate: Math.max(50, 99.5 - i * 1.5 + Math.random() * 2),
    rawWinRate: Math.max(45, 95 - i * 1.5),
    avgRounds: Math.floor(15 + i * 2 + Math.random() * 10),
    minRounds: Math.floor(8 + i + Math.random() * 5),
    maxRounds: Math.floor(30 + i * 3 + Math.random() * 20),
    avgSurvivors: Math.max(1, 5 - Math.floor(i / 8)),
    avgDamage: Math.floor(50000 + Math.random() * 200000),
    partySize: [4, 5][i % 2],
    partyClasses: Array.from({ length: [4, 5][i % 2] }, (_, j) => classes[(i + j) % classes.length]),
    partyClassLines: Array.from({ length: [4, 5][i % 2] }, (_, j) => ['전사', '로그', '주문술사'][(i + j) % 3]),
    champion: champions[i % champions.length],
    booster: ['없음', '전투력 부스터', '슈퍼 전투력 부스터', '메가 전투력 부스터'][i % 4],
    simCount: Math.floor(10000 + Math.random() * 40000),
    createdAt: new Date(Date.now() - i * 3600000 * 2).toISOString(),
    stabilityScore: Math.max(60, 100 - i * 0.8),
  }));
}

type RankingEntry = typeof MOCK_RANKINGS[0];

function getRankStyle(rank: number) {
  if (rank === 1) return { icon: <Trophy className="w-5 h-5" />, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', glow: 'shadow-[0_0_15px_hsl(40_85%_55%/0.2)]' };
  if (rank === 2) return { icon: <Medal className="w-5 h-5" />, color: 'text-gray-300', bg: 'bg-gray-300/10 border-gray-300/20', glow: 'shadow-[0_0_10px_hsl(0_0%_70%/0.15)]' };
  if (rank === 3) return { icon: <Award className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-600/10 border-amber-600/20', glow: 'shadow-[0_0_10px_hsl(25_80%_45%/0.15)]' };
  return { icon: null, color: 'text-muted-foreground', bg: 'bg-card border-border/50', glow: '' };
}

function getWinRateColor(rate: number) {
  if (rate >= 90) return 'text-green-400';
  if (rate >= 70) return 'text-yellow-400';
  if (rate >= 50) return 'text-orange-400';
  return 'text-red-400';
}

function getClassLineIcon(classLine: string) {
  if (classLine === '전사') return '⚔️';
  if (classLine === '로그') return '🗡️';
  if (classLine === '주문술사') return '🔮';
  return '❓';
}

export default function Ranking() {
  const [activeTab, setActiveTab] = useState('normal');
  const [region, setRegion] = useState('전체');
  const [difficulties, setDifficulties] = useState<Set<string>>(new Set());
  const [winRateRange, setWinRateRange] = useState([0, 100]);
  const [selectedChampions, setSelectedChampions] = useState<Set<string>>(new Set());
  const [selectedClassLines, setSelectedClassLines] = useState<Set<string>>(new Set());
  const [partySize, setPartySize] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState('winRate');
  const [sortDesc, setSortDesc] = useState(true);
  const [searchNickname, setSearchNickname] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const toggleDifficulty = (d: string) => {
    setDifficulties(prev => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  };

  const toggleChampion = (c: string) => {
    setSelectedChampions(prev => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  const toggleClassLine = (c: string) => {
    setSelectedClassLines(prev => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  };

  const togglePartySize = (s: number) => {
    setPartySize(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = MOCK_RANKINGS.filter(r => r.questType === activeTab);
    if (region !== '전체') list = list.filter(r => r.region.includes(region));
    if (difficulties.size > 0) list = list.filter(r => difficulties.has(r.difficulty));
    list = list.filter(r => r.winRate >= winRateRange[0] && r.winRate <= winRateRange[1]);
    if (selectedChampions.size > 0) list = list.filter(r => selectedChampions.has(r.champion));
    if (selectedClassLines.size > 0) list = list.filter(r => r.partyClassLines.some(cl => selectedClassLines.has(cl)));
    if (partySize.size > 0) list = list.filter(r => partySize.has(r.partySize));
    if (searchNickname.trim()) list = list.filter(r => r.nickname.toLowerCase().includes(searchNickname.toLowerCase()));

    list.sort((a, b) => {
      const av = a[sortBy as keyof RankingEntry] as number;
      const bv = b[sortBy as keyof RankingEntry] as number;
      return sortDesc ? bv - av : av - bv;
    });

    return list;
  }, [activeTab, region, difficulties, winRateRange, selectedChampions, selectedClassLines, partySize, sortBy, sortDesc, searchNickname]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openDetail = (entry: RankingEntry) => {
    setSelectedEntry(entry);
    setDetailOpen(true);
  };

  const regionOptions = REGIONS[activeTab] || ['전체'];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-primary font-bold">랭킹</h2>
        <span className="text-[10px] text-muted-foreground">최근 갱신: 3분 전</span>
      </div>

      {/* Quest Type Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setRegion('전체'); setPage(1); }}>
        <TabsList className="w-full bg-secondary/50 border border-border/50 p-1">
          {QUEST_TABS.map(tab => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="flex-1 text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_0_0_hsl(var(--primary))] transition-all"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {QUEST_TABS.map(tab => (
          <TabsContent key={tab.key} value={tab.key}>
            {/* Filter Panel */}
            <div className="card-fantasy p-4 space-y-4 glow-gold" style={{ borderRadius: '14px' }}>
              {/* Row 1: Region + Nickname Search */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">지역</label>
                  <Select value={region} onValueChange={(v) => { setRegion(v); setPage(1); }}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {regionOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[150px] space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">닉네임 검색</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={searchNickname}
                      onChange={e => { setSearchNickname(e.target.value); setPage(1); }}
                      placeholder="닉네임 검색..."
                      className="h-8 text-xs pl-7"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Difficulty checkboxes */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium">난이도</label>
                <div className="flex gap-3">
                  {['쉬움', '보통', '어려움', '익스트림'].map(d => (
                    <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={difficulties.has(d)}
                        onCheckedChange={() => { toggleDifficulty(d); setPage(1); }}
                        className="w-3.5 h-3.5"
                      />
                      <span className={`text-xs ${
                        d === '쉬움' ? 'text-green-400' :
                        d === '보통' ? 'text-blue-400' :
                        d === '어려움' ? 'text-orange-400' :
                        'text-purple-400'
                      }`}>{d}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Row 3: Win Rate Slider */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium">
                  성공률 범위: <span className="text-primary font-mono">{winRateRange[0]}% — {winRateRange[1]}%</span>
                </label>
                <Slider
                  value={winRateRange}
                  onValueChange={(v) => { setWinRateRange(v); setPage(1); }}
                  min={0} max={100} step={5}
                  className="w-full"
                />
              </div>

              {/* Row 4: Champion + Class filter */}
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">챔피언</label>
                  <div className="flex flex-wrap gap-1">
                    {CHAMPION_NAMES.map(c => (
                      <button
                        key={c}
                        onClick={() => { toggleChampion(c); setPage(1); }}
                        className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                          selectedChampions.has(c)
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'border-border/40 text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">계열</label>
                  <div className="flex gap-1">
                    {CLASS_LINES.map(cl => (
                      <button
                        key={cl}
                        onClick={() => { toggleClassLine(cl); setPage(1); }}
                        className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                          selectedClassLines.has(cl)
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'border-border/40 text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        {getClassLineIcon(cl)} {cl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 5: Party size + Sort */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">파티 인원</label>
                  <div className="flex gap-1">
                    {[3, 4, 5].map(s => (
                      <button
                        key={s}
                        onClick={() => { togglePartySize(s); setPage(1); }}
                        className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                          partySize.has(s)
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'border-border/40 text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        {s}인
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">정렬</label>
                  <div className="flex gap-1">
                    <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => setSortDesc(!sortDesc)}
                      className="h-8 w-8 flex items-center justify-center rounded border border-border/50 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {sortDesc ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="ml-auto text-[10px] text-muted-foreground self-end">
                  {filtered.length}개 결과
                </div>
              </div>
            </div>

            {/* Ranking Cards */}
            <div className="space-y-2 mt-4">
              {paged.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">해당 조건의 결과가 없습니다</p>
                </div>
              )}
              {paged.map((entry, i) => {
                const globalRank = (page - 1) * PAGE_SIZE + i + 1;
                const style = getRankStyle(globalRank);
                return (
                  <button
                    key={entry.id}
                    onClick={() => openDetail(entry)}
                    className={`w-full text-left rounded-[14px] border p-3 transition-all hover:scale-[1.005] hover:border-primary/40 ${style.bg} ${style.glow}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank */}
                      <div className={`w-10 flex-shrink-0 text-center ${style.color}`}>
                        {style.icon || <span className="text-sm font-mono font-bold">#{globalRank}</span>}
                        {style.icon && <div className="text-[10px] font-mono font-bold">#{globalRank}</div>}
                      </div>

                      {/* Center: Nickname + Party */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{entry.nickname}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                            entry.difficulty === '익스트림' ? 'bg-purple-500/20 text-purple-400' :
                            entry.difficulty === '어려움' ? 'bg-orange-500/20 text-orange-400' :
                            entry.difficulty === '보통' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {entry.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{entry.questName}</span>
                          <span>·</span>
                          <span>{entry.champion}</span>
                        </div>
                        <div className="flex gap-0.5 mt-1">
                          {entry.partyClassLines.map((cl, j) => (
                            <span key={j} className="text-xs" title={entry.partyClasses[j]}>
                              {getClassLineIcon(cl)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right: Win Rate */}
                      <div className="text-right flex-shrink-0">
                        <div className={`text-xl font-bold font-mono ${getWinRateColor(entry.winRate)}`}>
                          {entry.winRate.toFixed(1)}%
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {entry.partySize}명 · {entry.avgRounds}턴
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-1 mt-4">
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded text-xs font-mono transition-all ${
                      page === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md" style={{ borderRadius: '18px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {selectedEntry && (() => {
                const style = getRankStyle(selectedEntry.rank);
                return (
                  <>
                    <span className={style.color}>#{selectedEntry.rank}</span>
                    <span className="text-foreground">{selectedEntry.nickname}</span>
                  </>
                );
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              {/* Quest Info */}
              <div className="card-fantasy p-3 space-y-2" style={{ borderRadius: '12px' }}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">퀘스트</span>
                  <span className="text-foreground">{selectedEntry.questName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">난이도</span>
                  <span className={
                    selectedEntry.difficulty === '익스트림' ? 'text-purple-400' :
                    selectedEntry.difficulty === '어려움' ? 'text-orange-400' :
                    selectedEntry.difficulty === '보통' ? 'text-blue-400' : 'text-green-400'
                  }>{selectedEntry.difficulty}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">챔피언</span>
                  <span className="text-primary">{selectedEntry.champion}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">부스터</span>
                  <span className="text-foreground">{selectedEntry.booster}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="card-fantasy p-3 space-y-2" style={{ borderRadius: '12px' }}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">성공률</span>
                  <span className={`font-bold font-mono ${getWinRateColor(selectedEntry.winRate)}`}>
                    {selectedEntry.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">기본 승률</span>
                  <span className="font-mono text-foreground">{selectedEntry.rawWinRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">평균 턴</span>
                  <span className="font-mono text-foreground">{selectedEntry.avgRounds}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">최소 / 최대 턴</span>
                  <span className="font-mono text-foreground">{selectedEntry.minRounds} / {selectedEntry.maxRounds}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">평균 생존자</span>
                  <span className="font-mono text-foreground">{selectedEntry.avgSurvivors}명</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">평균 대미지</span>
                  <span className="font-mono text-red-400">{formatNumber(selectedEntry.avgDamage)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">안정성 점수</span>
                  <span className="font-mono text-foreground">{selectedEntry.stabilityScore.toFixed(1)}</span>
                </div>
              </div>

              {/* Party Composition */}
              <div className="card-fantasy p-3" style={{ borderRadius: '12px' }}>
                <div className="text-[10px] text-muted-foreground mb-2 font-medium">파티 구성</div>
                <div className="flex flex-wrap gap-2">
                  {selectedEntry.partyClasses.map((cls, j) => (
                    <div key={j} className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded text-xs">
                      <span>{getClassLineIcon(selectedEntry.partyClassLines[j])}</span>
                      <span className="text-foreground">{cls}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>시뮬레이션 {selectedEntry.simCount.toLocaleString()}회</span>
                <span>{new Date(selectedEntry.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
