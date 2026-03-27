import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CombatLogEntry } from '@/lib/combatSimulation';
import { Hero } from '@/types/game';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Dices, Settings, Zap, Wind, Skull, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { formatNumber } from '@/lib/format';

interface Props {
  log: CombatLogEntry[];
  heroes: Hero[];
  monsterHp: number;
  monsterName: string;
  onNewBattle?: () => void;
}

// Lime green for party members (yellowish-green)
const PARTY_COLOR = '#a3e635'; // lime-400
const MONSTER_COLOR = '#facc15'; // yellow

// 5-tier HP color matching damage contribution scale
function hpColor(pct: number): string {
  if (pct > 80) return '#84cc16';  // lime-500 (연두)
  if (pct > 60) return '#eab308';  // yellow-500
  if (pct > 40) return '#f97316';  // orange-500
  if (pct > 20) return '#ef4444';  // red-500
  return '#a855f7';                // purple-500
}

function hpColorClass(pct: number): string {
  if (pct > 80) return 'text-lime-500';
  if (pct > 60) return 'text-yellow-500';
  if (pct > 40) return 'text-orange-500';
  if (pct > 20) return 'text-red-500';
  return 'text-purple-500';
}

export default function CombatBattlefield({ log, heroes, monsterHp, monsterName, onNewBattle }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  // 3-click filter: null → {name, mode:'attack'} → {name, mode:'defense'} → null
  const [filter, setFilter] = useState<{ name: string; mode: 'attack' | 'defense' } | null>(null);
  const [showAllBright, setShowAllBright] = useState(false);
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const logScrollRef = useRef<HTMLDivElement>(null);

  const activeHeroes = heroes.filter(h => h.hp > 0);

  // Group log entries by round
  const roundGroups = useMemo(() => {
    const groups: { round: number; entries: { entry: CombatLogEntry; idx: number }[] }[] = [];
    let currentGroup: typeof groups[0] | null = null;
    log.forEach((entry, idx) => {
      if (!currentGroup || currentGroup.round !== entry.round) {
        currentGroup = { round: entry.round, entries: [] };
        groups.push(currentGroup);
      }
      currentGroup.entries.push({ entry, idx });
    });
    return groups;
  }, [log]);

  const heroStatsData = useMemo(() => {
    const stats: Record<string, { dmg: number; targeted: number; dodged: number; singleHits: number }> = {};
    activeHeroes.forEach(h => { stats[h.name] = { dmg: 0, targeted: 0, dodged: 0, singleHits: 0 }; });

    const aoeRounds = new Set<number>();
    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      if (entry.type === 'monster_attack' && entry.detail === '광역 공격!') aoeRounds.add(entry.round);
    }

    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      if (entry.type === 'hero_attack') {
        const dmgMatch = entry.detail.match(/([\d,]+)\s*피해/);
        if (dmgMatch && stats[entry.actor]) stats[entry.actor].dmg += parseInt(dmgMatch[1].replace(/,/g, ''));
      }
      if (entry.type === 'monster_attack' && entry.target && stats[entry.target]) {
        stats[entry.target].targeted++;
        if (!aoeRounds.has(entry.round)) stats[entry.target].singleHits++;
      }
      if (entry.type === 'event' && entry.detail.includes('회피 성공') && entry.target && stats[entry.target]) {
        stats[entry.target].dodged++;
        stats[entry.target].targeted++;
      }
    }

    const totalDmg = Object.values(stats).reduce((s, v) => s + v.dmg, 0);
    const totalSingleHits = Object.values(stats).reduce((s, v) => s + v.singleHits, 0);

    return activeHeroes.map(h => ({
      name: h.name,
      ...stats[h.name],
      dmgPct: totalDmg > 0 ? (stats[h.name].dmg / totalDmg) * 100 : 0,
      tankPct: totalSingleHits > 0 ? (stats[h.name].singleHits / totalSingleHits) * 100 : 0,
    })).sort((a, b) => b.dmg - a.dmg);
  }, [log, currentIdx]);

  const getState = () => {
    const heroHp: Record<string, number> = {};
    const heroMaxHp: Record<string, number> = {};
    activeHeroes.forEach(h => { heroHp[h.name] = h.hp || 0; heroMaxHp[h.name] = h.hp || 0; });
    let mobHpCurrent = monsterHp;
    let currentRound = 0;
    let lastAction: CombatLogEntry | null = null;
    const actionEffects: { target: string; value: string; color: string; key: number }[] = [];

    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      currentRound = entry.round;
      lastAction = entry;

      if (entry.type === 'monster_attack' && entry.target) {
        const hpMatch = entry.detail.match(/HP: ([\d,\-]+)/);
        if (hpMatch) heroHp[entry.target] = Math.max(0, parseInt(hpMatch[1].replace(/,/g, '')));
        const dmgMatch = entry.detail.match(/([\d,]+) 피해/);
        if (dmgMatch && i === currentIdx) {
          actionEffects.push({ target: entry.target, value: `-${dmgMatch[1]}`, color: entry.detail.includes('치명타') ? 'text-orange-400' : 'text-red-400', key: i });
        }
      }
      if (entry.type === 'hero_attack') {
        const mobMatch = entry.detail.match(/HP: ([\d,\-]+)/);
        if (mobMatch) mobHpCurrent = Math.max(0, parseInt(mobMatch[1].replace(/,/g, '')));
        const dmgMatch = entry.detail.match(/([\d,]+)\s*피해/);
        if (dmgMatch && i === currentIdx) {
          actionEffects.push({ target: '__monster__', value: `-${dmgMatch[1]}`, color: entry.detail.includes('치명타') ? 'text-yellow-400' : 'text-blue-400', key: i });
        }
      }
      if (entry.type === 'event' && entry.detail.includes('사망')) heroHp[entry.actor] = 0;
      if (entry.type === 'event' && entry.detail.includes('회피 성공') && entry.target && i === currentIdx) {
        actionEffects.push({ target: entry.target, value: 'MISS', color: 'text-teal-400', key: i });
      }
    }
    return { heroHp, heroMaxHp, mobHpCurrent, currentRound, lastAction, actionEffects };
  };

  const state = getState();

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setCurrentIdx(prev => {
          if (prev >= log.length - 1) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, speed);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, log.length]);

  useEffect(() => {
    if (logScrollRef.current) {
      const el = logScrollRef.current.querySelector(`[data-idx="${currentIdx}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIdx]);

  const mobHpPct = monsterHp > 0 ? Math.max(0, (state.mobHpCurrent / monsterHp) * 100) : 0;
  const isResult = state.lastAction?.type === 'result';
  const isWin = isResult && state.lastAction?.detail.includes('승리');

  // 3-click filter cycle
  const handleFilterClick = (name: string) => {
    if (!filter || filter.name !== name) {
      setFilter({ name, mode: 'attack' });
    } else if (filter.mode === 'attack') {
      setFilter({ name, mode: 'defense' });
    } else {
      setFilter(null);
    }
  };

  // Check if entry matches filter
  const entryMatchesFilter = useCallback((entry: CombatLogEntry) => {
    if (!filter) return true;
    const { name, mode } = filter;
    if (mode === 'attack') {
      return entry.actor === name || entry.actor?.includes(name) || entry.detail.includes(name);
    } else {
      return entry.target === name || entry.detail.includes(name);
    }
  }, [filter]);

  // Check if round is relevant for filter
  const isRoundRelevant = useCallback((group: { entries: { entry: CombatLogEntry }[] }) => {
    if (!filter) return true;
    return group.entries.some(({ entry }) => entryMatchesFilter(entry));
  }, [filter, entryMatchesFilter]);

  const toggleRoundCollapse = (round: number) => {
    setCollapsedRounds(prev => {
      const next = new Set(prev);
      if (next.has(round)) next.delete(round); else next.add(round);
      return next;
    });
  };

  // Parse log entry into structured display
  const renderLogEntry = (entry: CombatLogEntry, idx: number) => {
    const isPast = idx <= currentIdx;
    const isCurrent = idx === currentIdx;
    const isFuture = idx > currentIdx;
    const matchesFilter = entryMatchesFilter(entry);
    const shouldBright = showAllBright || (filter && matchesFilter);

    const isCrit = entry.detail.includes('치명타');
    const isEvasion = entry.detail.includes('회피 성공');
    const isDeath = entry.detail.includes('사망');
    const isSetup = entry.type === 'event' && !isEvasion && !isDeath;
    const isAoe = entry.detail === '광역 공격!' || entry.detail.includes('광역');

    // Icon selection - all use consistent styled icons
    let icon: React.ReactNode;
    if (entry.type === 'result') {
      icon = <span className="text-base">🏁</span>;
    } else if (isDeath) {
      icon = <Skull className="w-4 h-4 text-red-400" />;
    } else if (isEvasion) {
      icon = <Wind className="w-4 h-4 text-teal-400" />;
    } else if (isSetup) {
      icon = <Settings className="w-4 h-4 text-muted-foreground" />;
    } else if (entry.type === 'monster_attack') {
      icon = <span className={`text-base ${isAoe ? 'text-red-500' : 'text-foreground/80'}`}>👹</span>;
    } else if (entry.type === 'hero_attack' && isCrit) {
      icon = <Zap className="w-4 h-4 text-yellow-400" />;
    } else if (entry.type === 'hero_attack') {
      icon = <span className="text-base">⚔️</span>;
    } else if (entry.type === 'heal') {
      icon = <span className="text-base">💚</span>;
    } else {
      icon = <Settings className="w-4 h-4 text-muted-foreground" />;
    }

    // Determine opacity
    let opacityClass = '';
    if (isFuture && !shouldBright) opacityClass = 'opacity-20';
    else if (filter && !matchesFilter && !showAllBright) opacityClass = 'opacity-15';

    // Border left color
    let borderLeftColor = 'transparent';
    const isMonsterActor = entry.actor?.includes('몬스터');
    if (entry.type === 'monster_attack') borderLeftColor = MONSTER_COLOR;
    else if (entry.type === 'hero_attack') borderLeftColor = PARTY_COLOR;
    else if (entry.type === 'heal') borderLeftColor = '#84cc16';
    else if (entry.type === 'result') borderLeftColor = entry.detail.includes('승리') ? '#84cc16' : '#ef4444';
    else if (isEvasion) borderLeftColor = '#2dd4bf';
    else borderLeftColor = '#a3a3a3';

    // Background
    let bgClass = '';
    if (isCurrent) bgClass = 'bg-primary/10 ring-1 ring-primary/40';

    // Actor/target colors
    const getNameColor = (name: string | undefined) => {
      if (!name) return undefined;
      if (name.includes('몬스터')) return MONSTER_COLOR;
      if (name === '시스템') return undefined;
      return PARTY_COLOR;
    };

    // Build structured content
    let damageText = '';
    let hpText = '';

    if (entry.type === 'hero_attack' || entry.type === 'monster_attack') {
      const dmgMatch = entry.detail.match(/([\d,]+)\s*피해/);
      if (dmgMatch) damageText = `${dmgMatch[1]} 피해`;

      // Extract HP info with percentage
      const hpInfoMatch = entry.detail.match(/\((.+?HP: [\d,\-]+ \(~\d+%\))\)/);
      if (hpInfoMatch) {
        hpText = `(${hpInfoMatch[1]})`;
      } else {
        const hpFallback = entry.detail.match(/\((.+?HP: [\d,\-]+.*?)\)/);
        if (hpFallback) hpText = `(${hpFallback[1]})`;
      }
    }

    // HP percentage for color
    const getHpPctFromText = (): number => {
      const pctMatch = hpText.match(/~(\d+)%/);
      if (pctMatch) return parseInt(pctMatch[1]);
      return 100;
    };

    return (
      <div
        key={idx}
        data-idx={idx}
        onClick={() => { setCurrentIdx(idx); setPlaying(false); }}
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-sm leading-relaxed ${bgClass} ${opacityClass} hover:bg-secondary/30`}
        style={{ borderLeft: `3px solid ${(isFuture && !shouldBright) ? 'transparent' : borderLeftColor}` }}
      >
        <span className="shrink-0 w-5 flex items-center justify-center">{icon}</span>

        <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
          {/* Actor → Target */}
          {entry.actor && entry.actor !== '시스템' && (
            <span className="font-bold text-sm" style={{ color: getNameColor(entry.actor) }}>{entry.actor}</span>
          )}
          {entry.target && (
            <>
              <span className="text-muted-foreground mx-0.5">→</span>
              <span className="font-bold text-sm" style={{ color: getNameColor(entry.target) }}>{entry.target}</span>
            </>
          )}

          {/* Attack entries: structured format */}
          {(entry.type === 'hero_attack' || entry.type === 'monster_attack') ? (
            <>
              {isCrit && <span className="text-yellow-400 font-bold ml-2">치명타!</span>}
              {isAoe && !isCrit && entry.detail === '광역 공격!' && <span className="text-red-400 font-bold ml-2">광역!</span>}

              {damageText && (
                <span className="font-mono font-bold text-sm text-gray-100 ml-8">{damageText}</span>
              )}

              {hpText && (
                <span className="font-mono text-sm ml-8" style={{ color: hpColor(getHpPctFromText()) }}>{hpText}</span>
              )}
            </>
          ) : (
            <span className={`ml-1 text-sm ${
              isEvasion ? 'text-teal-400 font-bold' :
              isDeath ? 'text-red-400 font-bold' :
              entry.type === 'result' ? (entry.detail.includes('승리') ? 'text-green-400 font-bold' : 'text-red-400 font-bold') :
              'text-foreground/60'
            }`}>
              {entry.detail}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4 overflow-hidden" style={{ height: '85vh' }}>
      {/* LEFT: Battlefield + Stats */}
      <div className="flex flex-col gap-2 overflow-hidden">
        {/* Compact Battlefield */}
        <div className="relative bg-secondary/30 rounded-lg p-3 border border-border/30">
          <div className="text-center mb-2">
            <span className="text-xs text-muted-foreground">라운드</span>
            <span className="ml-1 text-lg font-bold font-mono text-foreground">{state.currentRound}</span>
            {isResult && (
              <span className={`ml-2 text-sm font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                {isWin ? '🏆 승리!' : '💀 패배!'}
              </span>
            )}
          </div>

          <div className="flex items-start gap-3">
            {/* Heroes - compact with spacing */}
            <div className="flex-1 space-y-1.5">
              {activeHeroes.map(h => {
                const hp = state.heroHp[h.name] || 0;
                const maxHp = state.heroMaxHp[h.name] || 1;
                const hpPct = Math.max(0, (hp / maxHp) * 100);
                const isDead = hp <= 0;
                const effect = state.actionEffects.find(e => e.target === h.name);
                const heroImg = h.type === 'champion'
                  ? getChampionImagePath(h.championName || h.name)
                  : h.heroClass ? getJobImagePath(h.heroClass) : null;
                const isFiltered = filter?.name === h.name;

                return (
                  <div
                    key={h.id}
                    className={`flex items-center gap-1.5 p-1 rounded cursor-pointer transition-all ${isDead ? 'opacity-30' : ''} ${isFiltered ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-secondary/20'}`}
                    onClick={() => handleFilterClick(h.name)}
                  >
                    <div className={`w-8 h-8 rounded-full overflow-hidden bg-secondary/50 shrink-0 ${isFiltered ? 'ring-2 ring-primary' : 'border border-border/50'}`}>
                      {heroImg && <img src={heroImg} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold truncate" style={{ color: PARTY_COLOR }}>{h.name}</span>
                        <span className="text-xs font-mono" style={{ color: hpColor(hpPct) }}>
                          {Math.round(hp).toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${hpPct}%`, backgroundColor: hpColor(hpPct) }}
                        />
                      </div>
                    </div>
                    {effect && (
                      <span className={`text-xs font-bold font-mono ${effect.color} animate-bounce shrink-0`}>{effect.value}</span>
                    )}
                    {isFiltered && (
                      <span className="text-[10px] text-primary shrink-0">{filter?.mode === 'attack' ? '⚔' : '🛡'}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* VS */}
            <div className="flex flex-col items-center justify-center py-2 shrink-0">
              <span className="text-lg text-muted-foreground/30">⚔</span>
            </div>

            {/* Monster - compact, clickable for filter */}
            <div
              className={`w-36 shrink-0 cursor-pointer transition-all ${filter?.name === '몬스터' ? 'ring-2 ring-primary rounded-lg' : ''}`}
              onClick={() => handleFilterClick('몬스터')}
            >
              <div className={`p-2.5 rounded-lg border bg-yellow-500/5 ${filter?.name === '몬스터' ? 'border-primary' : 'border-yellow-500/20'} ${state.mobHpCurrent <= 0 ? 'opacity-30' : ''}`}>
                <div className="text-center"><span className="text-2xl">👹</span></div>
                <div className="text-center mb-1.5"><span className="text-xs font-bold" style={{ color: MONSTER_COLOR }}>{monsterName}</span></div>
                <div className="text-center text-xs font-mono mb-1" style={{ color: hpColor(mobHpPct) }}>
                  {Math.max(0, Math.round(state.mobHpCurrent)).toLocaleString()}
                </div>
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${mobHpPct}%`, backgroundColor: hpColor(mobHpPct) }} />
                </div>
                {state.actionEffects.find(e => e.target === '__monster__') && (
                  <div className="text-center mt-1">
                    <span className={`text-sm font-bold font-mono ${state.actionEffects.find(e => e.target === '__monster__')!.color} animate-bounce`}>
                      {state.actionEffects.find(e => e.target === '__monster__')!.value}
                    </span>
                  </div>
                )}
                {filter?.name === '몬스터' && (
                  <div className="text-center mt-1">
                    <span className="text-[10px] text-primary">{filter.mode === 'attack' ? '⚔ 공격' : '🛡 피격'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setCurrentIdx(0); setPlaying(false); }}><RotateCcw className="w-3.5 h-3.5" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}><SkipBack className="w-3.5 h-3.5" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPlaying(!playing)} className="w-20">
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="ml-1 text-xs">{playing ? '일시정지' : '재생'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentIdx(Math.min(log.length - 1, currentIdx + 1))}><SkipForward className="w-3.5 h-3.5" /></Button>
          <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="text-xs bg-secondary border border-border rounded px-1.5 py-1 text-foreground">
            <option value={1000}>0.5x</option>
            <option value={500}>1x</option>
            <option value={250}>2x</option>
            <option value={100}>4x</option>
          </select>
          {onNewBattle && (
            <Button variant="outline" size="sm" className="text-xs gap-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/10" onClick={() => { onNewBattle(); setCurrentIdx(0); setPlaying(false); }}>
              <Dices className="w-3.5 h-3.5" /> 새 전투
            </Button>
          )}
          <span className="text-[10px] text-muted-foreground">{currentIdx + 1}/{log.length}</span>
        </div>

        {/* Combat Stats */}
        <div className="rounded border border-border/30 bg-secondary/20 p-2.5 flex-1 overflow-y-auto min-h-0">
          <div className="text-sm font-bold text-foreground mb-1.5">📊 전투 통계</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-center py-1.5 px-1 text-muted-foreground font-medium w-[80px]">파티원</th>
                <th className="text-center py-1.5 px-1 text-red-400 font-medium">입힌 대미지</th>
                <th className="text-center py-1.5 px-1 text-orange-400 font-medium">대미지 비율</th>
                <th className="text-center py-1.5 px-1 text-yellow-400 font-medium">타켓팅 수</th>
                <th className="text-center py-1.5 px-1 text-teal-400 font-medium">회피 수</th>
                <th className="text-center py-1.5 px-1 text-blue-400 font-medium">탱킹 비율</th>
              </tr>
            </thead>
            <tbody>
              {heroStatsData.map((hs, idx) => (
                <tr key={hs.name} className={`border-b border-border/10 ${idx % 2 === 0 ? 'bg-secondary/10' : ''}`}>
                  <td className="py-1.5 px-1 font-medium truncate max-w-[80px] text-center text-sm" style={{ color: PARTY_COLOR }}>{hs.name}</td>
                  <td className="py-1.5 px-1 text-center font-mono text-red-400 text-sm">{formatNumber(hs.dmg)}</td>
                  <td className="py-1.5 px-1 text-center font-mono text-orange-400 text-sm">{hs.dmgPct.toFixed(1)}%</td>
                  <td className="py-1.5 px-1 text-center font-mono text-yellow-400 text-sm">{hs.targeted}</td>
                  <td className="py-1.5 px-1 text-center font-mono text-teal-400 text-sm">{hs.dodged}</td>
                  <td className="py-1.5 px-1 text-center font-mono text-blue-400 text-sm">{hs.tankPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT: Grouped Log */}
      <div className="flex flex-col overflow-hidden" style={{ height: '85vh' }}>
        {/* Log toolbar */}
        <div className="flex items-center gap-2 mb-1 px-1">
          {filter && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded text-xs text-primary">
              <span className="font-medium">
                {filter.mode === 'attack' ? '⚔' : '🛡'} {filter.name} {filter.mode === 'attack' ? '공격' : '피격'}
              </span>
              <button onClick={() => setFilter(null)} className="ml-1 text-muted-foreground hover:text-foreground text-sm">✕</button>
            </div>
          )}
          <div className="ml-auto">
            <Button
              variant={showAllBright ? 'default' : 'outline'}
              size="sm"
              className="text-xs gap-1 h-6"
              onClick={() => setShowAllBright(!showAllBright)}
            >
              <Eye className="w-3 h-3" />
              전체 밝게
            </Button>
          </div>
        </div>

        <div ref={logScrollRef} className="overflow-y-auto rounded border border-border/30 bg-secondary/20 flex-1 min-h-0">
          {roundGroups.map(group => {
            if (filter && !isRoundRelevant(group)) return null;
            const isCollapsed = collapsedRounds.has(group.round);

            return (
              <div key={group.round} className="border-b border-border/20">
                {/* Round header - brighter */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary/60 cursor-pointer hover:bg-secondary/80 sticky top-0 z-10"
                  onClick={() => toggleRoundCollapse(group.round)}
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-foreground/70" /> : <ChevronDown className="w-3.5 h-3.5 text-foreground/70" />}
                  <span className="text-sm font-bold text-foreground">라운드 {group.round}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{group.entries.length}건</span>
                </div>
                {/* Round entries */}
                {!isCollapsed && group.entries.map(({ entry, idx }) => {
                  if (filter && !entryMatchesFilter(entry)) {
                    return null;
                  }
                  return renderLogEntry(entry, idx);
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
