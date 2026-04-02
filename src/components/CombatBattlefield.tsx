import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CombatLogEntry } from '@/lib/combatSimulation';
import { Hero } from '@/types/game';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Dices, Settings, Zap, Wind, Skull, Eye, Flame, FastForward } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  log: CombatLogEntry[];
  heroes: Hero[];
  monsterHp: number;
  monsterName: string;
  onNewBattle?: () => void;
}

const MONSTER_COLOR = '#facc15'; // yellow

// Class-line based colors
const CLASS_LINE_COLORS: Record<string, string> = {
  '전사': '#f87171',   // red-400
  '로그': '#a3e635',   // lime-400
  '주문술사': '#60a5fa', // blue-400
};
const CHAMPION_COLOR = '#c4b5fd'; // violet-300

// 5-tier HP color
function hpColor(pct: number): string {
  if (pct > 80) return '#84cc16';
  if (pct > 60) return '#eab308';
  if (pct > 40) return '#f97316';
  if (pct > 20) return '#ef4444';
  return '#a855f7';
}

export default function CombatBattlefield({ log, heroes, monsterHp, monsterName, onNewBattle }: Props) {
  const { colorMode } = useTheme();
  const isLight = colorMode === 'light';

  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [filter, setFilter] = useState<{ name: string } | null>(null);
  const [showAllBright, setShowAllBright] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const logScrollRef = useRef<HTMLDivElement>(null);

  // Adaptive colors for light/dark mode
  const C = useMemo(() => ({
    yellow: isLight ? '#a16207' : '#facc15',
    white: isLight ? '#374151' : '#e5e7eb',
    red: isLight ? '#b91c1c' : '#f87171',
    teal: isLight ? '#0f766e' : '#2dd4bf',
    green: isLight ? '#166534' : '#84cc16',
    monster: isLight ? '#a16207' : '#facc15',
  }), [isLight]);

  const activeHeroes = heroes.filter(h => h.hp > 0);

  // Build name→color map from hero data
  const nameColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeHeroes.forEach(h => {
      if (h.type === 'champion') {
        map[h.name] = CHAMPION_COLOR;
      } else {
        map[h.name] = CLASS_LINE_COLORS[h.classLine || ''] || '#d1d5db';
      }
    });
    return map;
  }, [activeHeroes]);

  // Extract the base monster name (without mini-boss prefix) for matching
  const baseMonsterName = useMemo(() => {
    const prefixes = ['거대한', '민첩한', '흉포한', '부유한', '전설적인'];
    let name = monsterName;
    for (const p of prefixes) {
      if (name.startsWith(p + ' ')) {
        name = name.slice(p.length + 1);
        break;
      }
    }
    return name;
  }, [monsterName]);

  const getNameColor = (name: string | undefined): string => {
    if (!name) return isLight ? '#4b5563' : '#d1d5db';
    if (name === monsterName || name.includes(baseMonsterName) || name.includes('몬스터')) return C.monster;
    if (name === '시스템') return isLight ? '#4b5563' : '#d1d5db';
    return nameColorMap[name] || '#d1d5db';
  };

  const isMonsterName = (name: string | undefined): boolean => {
    if (!name) return false;
    return name === monsterName || name.includes(baseMonsterName) || name.includes('몬스터');
  };

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

    // Track AOE rounds
    const aoeRounds = new Set<number>();
    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      if (entry.type === 'monster_attack' && entry.detail.includes('광역 공격')) aoeRounds.add(entry.round);
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
      if (entry.type === 'event' && entry.detail === '회피' && entry.target && stats[entry.target]) {
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
          actionEffects.push({ target: entry.target, value: `-${dmgMatch[1]}`, color: entry.detail.includes('치명타') ? 'text-yellow-400' : 'text-red-400', key: i });
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
      if (entry.type === 'event' && entry.detail === '회피' && entry.target && i === currentIdx) {
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

  // Single toggle filter: click once = filter, click again = clear
  const handleFilterClick = (name: string) => {
    if (filter?.name === name) {
      setFilter(null);
    } else {
      setFilter({ name });
    }
  };

  // Match filter: show entries where actor OR target matches the filter name
  const entryMatchesFilter = useCallback((entry: CombatLogEntry) => {
    if (!filter) return true;
    const { name } = filter;
    return entry.actor === name || entry.target === name
      || entry.actor?.includes(name) || entry.detail.includes(name);
  }, [filter]);

  const isRoundRelevant = useCallback((group: { entries: { entry: CombatLogEntry }[] }) => {
    if (!filter) return true;
    return group.entries.some(({ entry }) => entryMatchesFilter(entry));
  }, [filter, entryMatchesFilter]);

  // Parse log entry into structured display
  const renderLogEntry = (entry: CombatLogEntry, idx: number) => {
    const isPast = idx <= currentIdx;
    const isCurrent = idx === currentIdx;
    const isFuture = idx > currentIdx;
    const matchesFilter = entryMatchesFilter(entry);
    const shouldBright = showAllBright || (filter && matchesFilter);

    const isCrit = entry.detail.includes('치명타');
    const isEvasion = entry.detail === '회피';
    const isDeath = entry.detail.includes('사망');
    const isSetup = entry.type === 'event' && !isEvasion && !isDeath;
    const isAoe = entry.detail.includes('광역 공격');

    // Icon selection
    let icon: React.ReactNode;
    if (entry.type === 'result') {
      icon = <span className="text-base">🏁</span>;
    } else if (isDeath) {
      icon = <Skull className="w-4 h-4 text-red-400" />;
    } else if (isEvasion) {
      icon = <Wind className="w-4 h-4 text-teal-400" />;
    } else if (isSetup) {
      icon = <Settings className="w-4 h-4 text-muted-foreground" />;
    } else if (entry.type === 'monster_attack' && isAoe) {
      icon = <Flame className="w-4 h-4 text-red-500" />;
    } else if (entry.type === 'monster_attack' && isCrit) {
      icon = <Flame className="w-4 h-4 text-yellow-400" />;
    } else if (entry.type === 'monster_attack') {
      icon = <Flame className="w-4 h-4 text-foreground/60" />;
    } else if (entry.type === 'hero_attack' && isCrit) {
      icon = <Zap className="w-4 h-4 text-yellow-400" />;
    } else if (entry.type === 'hero_attack') {
      icon = <Zap className="w-4 h-4 text-foreground/60" />;
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
    if (entry.type === 'monster_attack') borderLeftColor = C.monster;
    else if (entry.type === 'hero_attack') borderLeftColor = getNameColor(entry.actor);
    else if (entry.type === 'heal') borderLeftColor = C.green;
    else if (entry.type === 'result') borderLeftColor = entry.detail.includes('승리') ? '#84cc16' : '#ef4444';
    else if (isEvasion) borderLeftColor = C.teal;
    else borderLeftColor = isLight ? '#6b7280' : '#a3a3a3';

    // Background
    let bgClass = '';
    if (isCurrent) bgClass = 'bg-primary/10 ring-1 ring-primary/40';

    // Build structured content
    let damageText = '';
    let hpText = '';

    if (entry.type === 'hero_attack' || (entry.type === 'monster_attack' && entry.target)) {
      const dmgMatch = entry.detail.match(/([\d,]+)\s*피해/);
      if (dmgMatch) damageText = `${dmgMatch[1]} 피해`;

      const hpInfoMatch = entry.detail.match(/\((.+?HP: [\d,\-]+ \(\d+%\))\)/);
      if (hpInfoMatch) {
        hpText = `(${hpInfoMatch[1]})`;
      } else {
        const hpFallback = entry.detail.match(/\((.+?HP: [\d,\-]+.*?)\)/);
        if (hpFallback) hpText = `(${hpFallback[1]})`;
      }
    }

    // HP percentage for color
    const getHpPctFromText = (): number => {
      const pctMatch = hpText.match(/(\d+)%/);
      if (pctMatch) return parseInt(pctMatch[1]);
      return 100;
    };

    // Damage text color logic
    const getDamageColor = (): string => {
      if (entry.type === 'hero_attack') {
        return isCrit ? C.yellow : C.white;
      }
      if (entry.type === 'monster_attack') {
        if (isCrit) return C.yellow;
        if (isAoe) return C.red;
        return C.white;
      }
      return C.white;
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
          {(entry.type === 'hero_attack' || (entry.type === 'monster_attack' && entry.target)) ? (
            <>
              {damageText && (
                <span className="font-mono font-bold text-sm ml-8" style={{ color: getDamageColor() }}>{damageText}</span>
              )}

              {hpText && (
                <span className="font-mono text-sm ml-8" style={{ color: hpColor(getHpPctFromText()) }}>{hpText}</span>
              )}
            </>
          ) : entry.type === 'monster_attack' && !entry.target ? (
            // AOE header line
            <span className="ml-1 text-sm text-red-400 font-bold">{entry.detail}</span>
          ) : isEvasion ? (
            <span className="text-teal-400 font-bold text-sm ml-8">회피</span>
          ) : (
            <span className={`ml-1 text-sm ${
              isDeath ? 'text-red-400 font-bold' :
              entry.type === 'result' ? (entry.detail.includes('승리') ? 'text-lime-400 font-bold' : 'text-red-400 font-bold') :
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
    <div className="grid grid-cols-2 gap-4 h-[78vh]">
      {/* LEFT: Battlefield + Stats */}
      <div className="flex flex-col gap-2 overflow-hidden min-h-0">
        {/* Compact Battlefield */}
        <div className="relative bg-secondary/30 rounded-lg p-3 border border-border/30">
          <div className="text-center mb-2">
            <span className="text-xs text-muted-foreground">라운드</span>
            <span className="ml-1 text-lg font-bold font-mono text-foreground">{state.currentRound}</span>
            {isResult && (
              <span className={`ml-2 text-sm font-bold ${isWin ? 'text-lime-400' : 'text-red-400'}`}>
                {isWin ? '🏆 승리!' : '💀 패배!'}
              </span>
            )}
          </div>

          <div className="flex items-start gap-3">
            {/* Heroes */}
            <div className="flex-1 space-y-2">
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
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold truncate" style={{ color: isLight ? (nameColorMap[h.name] ? adjustColorForLight(nameColorMap[h.name]) : '#1f2937') : getNameColor(h.name) }}>{h.name}</span>
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
                      <span className="text-[10px] text-primary shrink-0">🔍</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* VS */}
            <div className="flex flex-col items-center justify-center py-2 shrink-0">
              <span className="text-lg text-muted-foreground/30">⚔</span>
            </div>

            {/* Monster */}
            <div
              className={`w-36 shrink-0 cursor-pointer transition-all ${filter?.name === monsterName ? 'ring-2 ring-primary rounded-lg' : ''}`}
              onClick={() => handleFilterClick(monsterName)}
            >
              <div className={`p-2.5 rounded-lg border bg-yellow-500/5 ${filter?.name === monsterName ? 'border-primary' : 'border-yellow-500/20'} ${state.mobHpCurrent <= 0 ? 'opacity-30' : ''}`}>
                <div className="text-center"><span className="text-2xl">👹</span></div>
                <div className="text-center mb-1.5"><span className="text-xs font-bold" style={{ color: C.monster }}>{monsterName}</span></div>
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
                {filter?.name === monsterName && (
                  <div className="text-center mt-1">
                    <span className="text-[10px] text-primary">🔍 필터</span>
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

        {/* Combat Stats - with extra spacing */}
        <div className="mt-4 rounded border border-border/30 bg-secondary/20 p-2.5 flex-1 overflow-y-auto min-h-0 shrink">
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
                  <td className="py-1.5 px-1 font-medium truncate max-w-[80px] text-center text-sm" style={{ color: getNameColor(hs.name) }}>{hs.name}</td>
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

      {/* RIGHT: Log */}
      <div className="flex flex-col overflow-hidden min-h-0">
        {/* Filter bar */}
        {filter && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-t text-xs text-primary mb-0.5">
            <span className="font-medium">🔍 {filter.name}</span>
            <button onClick={() => setFilter(null)} className="ml-1 text-muted-foreground hover:text-foreground text-sm">✕</button>
          </div>
        )}

        <div ref={logScrollRef} className="overflow-y-auto rounded border border-border/30 bg-secondary/20 flex-1 min-h-0">
          {/* Controls inside log box */}
          <div className="sticky top-0 z-20 flex justify-end gap-1.5 px-2 py-1 bg-secondary/80 border-b border-border/20">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1 h-6"
              onClick={() => { setCurrentIdx(log.length - 1); setPlaying(false); }}
              title="끝까지 진행"
            >
              <FastForward className="w-3 h-3" />
              진행 완료
            </Button>
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

          {roundGroups.map(group => {
            if (filter && !isRoundRelevant(group)) return null;

            return (
              <div key={group.round} className="border-b border-border/20">
                {/* Round header - non-collapsible, just a divider */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40">
                  <span className="text-sm font-bold text-foreground">라운드 {group.round}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{group.entries.length}건</span>
                </div>
                {group.entries.map(({ entry, idx }) => {
                  if (filter && !entryMatchesFilter(entry)) return null;
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
