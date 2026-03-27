import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CombatLogEntry } from '@/lib/combatSimulation';
import { Hero } from '@/types/game';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Dices } from 'lucide-react';
import { formatNumber } from '@/lib/format';

interface Props {
  log: CombatLogEntry[];
  heroes: Hero[];
  monsterHp: number;
  monsterName: string;
  onNewBattle?: () => void;
}

// Hero colors for distinguishing in logs
const HERO_COLORS = ['#60a5fa', '#4ade80', '#facc15', '#f97316', '#a78bfa'];
const MONSTER_COLOR = '#f87171';

export default function CombatBattlefield({ log, heroes, monsterHp, monsterName, onNewBattle }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [filterHeroName, setFilterHeroName] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const logScrollRef = useRef<HTMLDivElement>(null);

  const activeHeroes = heroes.filter(h => h.hp > 0);

  const heroColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeHeroes.forEach((h, i) => { map[h.name] = HERO_COLORS[i % HERO_COLORS.length]; });
    return map;
  }, [activeHeroes.map(h => h.name).join(',')]);

  const heroStatsData = useMemo(() => {
    const stats: Record<string, { dmg: number; targeted: number; dodged: number; singleHits: number }> = {};
    activeHeroes.forEach(h => { stats[h.name] = { dmg: 0, targeted: 0, dodged: 0, singleHits: 0 }; });

    const aoeRounds = new Set<number>();
    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      if (entry.type === 'monster_attack' && entry.detail === '광역 공격!') {
        aoeRounds.add(entry.round);
      }
    }

    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      if (entry.type === 'hero_attack') {
        const dmgMatch = entry.detail.match(/([\d,]+) 대미지/);
        if (dmgMatch && stats[entry.actor]) {
          stats[entry.actor].dmg += parseInt(dmgMatch[1].replace(/,/g, ''));
        }
      }
      if (entry.type === 'monster_attack' && entry.target && stats[entry.target]) {
        stats[entry.target].targeted++;
        if (!aoeRounds.has(entry.round)) {
          stats[entry.target].singleHits++;
        }
      }
      if (entry.type === 'event' && entry.detail.includes('회피') && stats[entry.actor]) {
        stats[entry.actor].dodged++;
        stats[entry.actor].targeted++;
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
    activeHeroes.forEach(h => {
      heroHp[h.name] = h.hp || 0;
      heroMaxHp[h.name] = h.hp || 0;
    });
    let mobHpCurrent = monsterHp;
    let currentRound = 0;
    let lastAction: CombatLogEntry | null = null;
    const actionEffects: { target: string; value: string; color: string; key: number }[] = [];

    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      currentRound = entry.round;
      lastAction = entry;

      if (entry.type === 'monster_attack' && entry.target) {
        const hpMatch = entry.detail.match(/잔여 HP: ([\d,\-]+)/);
        if (hpMatch) {
          heroHp[entry.target] = Math.max(0, parseInt(hpMatch[1].replace(/,/g, '')));
        }
        const dmgMatch = entry.detail.match(/([\d,]+) 피해/);
        if (dmgMatch && i === currentIdx) {
          actionEffects.push({
            target: entry.target,
            value: `-${dmgMatch[1]}`,
            color: entry.detail.includes('치명타') ? 'text-orange-400' : 'text-red-400',
            key: i,
          });
        }
      }
      if (entry.type === 'hero_attack') {
        const mobMatch = entry.detail.match(/몬스터 잔여: ([\d,\-]+)/);
        if (mobMatch) {
          mobHpCurrent = Math.max(0, parseInt(mobMatch[1].replace(/,/g, '')));
        }
        const dmgMatch = entry.detail.match(/([\d,]+) 대미지/);
        if (dmgMatch && i === currentIdx) {
          actionEffects.push({
            target: '__monster__',
            value: `-${dmgMatch[1]}`,
            color: entry.detail.includes('치명타') ? 'text-yellow-400' : 'text-blue-400',
            key: i,
          });
        }
      }
      if (entry.type === 'event' && entry.detail.includes('사망')) {
        heroHp[entry.actor] = 0;
      }
      if (entry.type === 'event' && entry.detail.includes('회피') && i === currentIdx) {
        actionEffects.push({
          target: entry.actor,
          value: 'MISS',
          color: 'text-teal-400',
          key: i,
        });
      }
    }

    return { heroHp, heroMaxHp, mobHpCurrent, currentRound, lastAction, actionEffects };
  };

  const state = getState();

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setCurrentIdx(prev => {
          if (prev >= log.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, log.length]);

  // Auto-scroll log internally
  useEffect(() => {
    if (logScrollRef.current) {
      const el = logScrollRef.current.querySelector(`[data-idx="${currentIdx}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIdx]);

  const mobHpPct = monsterHp > 0 ? Math.max(0, (state.mobHpCurrent / monsterHp) * 100) : 0;
  const isResult = state.lastAction?.type === 'result';
  const isWin = isResult && state.lastAction?.detail.includes('승리');

  // Check if a log entry is related to the filtered hero
  const isEntryRelevant = useCallback((entry: CombatLogEntry) => {
    if (!filterHeroName) return true;
    return entry.actor === filterHeroName || entry.target === filterHeroName;
  }, [filterHeroName]);

  return (
    <div className="grid grid-cols-2 gap-4 overflow-y-auto" style={{ height: '75vh' }}>
      {/* LEFT: Battlefield + Stats */}
      <div className="flex flex-col space-y-3">
        {/* Battlefield */}
        <div className="relative bg-secondary/30 rounded-lg p-4 border border-border/30">
          <div className="text-center mb-3">
            <span className="text-xs text-muted-foreground">라운드</span>
            <span className="ml-1 text-xl font-bold font-mono text-foreground">{state.currentRound}</span>
            {isResult && (
              <span className={`ml-2 text-base font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                {isWin ? '🏆 승리!' : '💀 패배!'}
              </span>
            )}
          </div>

          <div className="flex items-start gap-4">
            {/* Heroes side */}
            <div className="flex-1 space-y-1.5">
              {activeHeroes.map((h, hIdx) => {
                const hp = state.heroHp[h.name] || 0;
                const maxHp = state.heroMaxHp[h.name] || 1;
                const hpPct = Math.max(0, (hp / maxHp) * 100);
                const isDead = hp <= 0;
                const effect = state.actionEffects.find(e => e.target === h.name);
                const heroImg = h.type === 'champion'
                  ? getChampionImagePath(h.championName || h.name)
                  : h.heroClass ? getJobImagePath(h.heroClass) : null;
                const isFiltered = filterHeroName === h.name;
                const heroColor = heroColorMap[h.name] || HERO_COLORS[0];

                return (
                  <div
                    key={h.id}
                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all ${isDead ? 'opacity-30' : ''} ${effect ? 'bg-secondary/40' : ''} ${isFiltered ? 'ring-2 ring-primary' : 'hover:bg-secondary/20'}`}
                    onClick={() => setFilterHeroName(prev => prev === h.name ? null : h.name)}
                  >
                    <div
                      className={`w-9 h-9 rounded-full overflow-hidden bg-secondary/50 shrink-0 ${isFiltered ? 'ring-2 ring-primary shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'border border-primary/30'}`}
                    >
                      {heroImg && <img src={heroImg} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold truncate" style={{ color: heroColor }}>{h.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-foreground/80">
                          {Math.round(hp).toLocaleString()} / {Math.round(maxHp).toLocaleString()}
                        </span>
                        <span className={`text-[11px] font-mono font-bold ${hpPct > 60 ? 'text-green-400' : hpPct > 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {hpPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-secondary rounded-full overflow-hidden mt-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            hpPct > 60 ? 'bg-green-500' : hpPct > 30 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                    </div>
                    {effect && (
                      <span className={`text-sm font-bold font-mono ${effect.color} animate-bounce shrink-0`}>
                        {effect.value}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* VS divider */}
            <div className="flex flex-col items-center justify-center py-4 shrink-0">
              <span className="text-xl font-bold text-muted-foreground/30">⚔</span>
            </div>

            {/* Monster side */}
            <div className="w-44 shrink-0">
              <div className={`p-3 rounded-lg border border-red-500/20 bg-red-500/5 ${state.mobHpCurrent <= 0 ? 'opacity-30' : ''}`}>
                <div className="text-center mb-1"><span className="text-3xl">👹</span></div>
                <div className="text-center mb-1.5"><span className="text-sm text-foreground font-bold" style={{ color: MONSTER_COLOR }}>{monsterName}</span></div>
                <div className="text-center text-xs font-mono text-foreground/80 mb-1">
                  몬스터 HP: {Math.max(0, Math.round(state.mobHpCurrent)).toLocaleString()} / {monsterHp.toLocaleString()}
                </div>
                <div className="text-center text-sm font-mono font-bold mb-1" style={{ color: MONSTER_COLOR }}>
                  {mobHpPct.toFixed(0)}%
                </div>
                <div className="h-3.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${mobHpPct}%` }} />
                </div>
                {state.actionEffects.find(e => e.target === '__monster__') && (
                  <div className="text-center mt-1">
                    <span className={`text-base font-bold font-mono ${state.actionEffects.find(e => e.target === '__monster__')!.color} animate-bounce`}>
                      {state.actionEffects.find(e => e.target === '__monster__')!.value}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setCurrentIdx(0); setPlaying(false); }}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}>
            <SkipBack className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPlaying(!playing)} className="w-20">
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="ml-1 text-xs">{playing ? '일시정지' : '재생'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentIdx(Math.min(log.length - 1, currentIdx + 1))}>
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
          <select
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
          >
            <option value={1000}>0.5x</option>
            <option value={500}>1x</option>
            <option value={250}>2x</option>
            <option value={100}>4x</option>
          </select>
          {onNewBattle && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5 border-blue-500/40 text-blue-400 hover:bg-blue-500/10" onClick={() => { onNewBattle(); setCurrentIdx(0); setPlaying(false); }}>
              <Dices className="w-3.5 h-3.5" /> 새로운 전투
            </Button>
          )}
          <span className="text-[10px] text-muted-foreground ml-1">{currentIdx + 1}/{log.length}</span>
        </div>

        {/* Combat Stats Summary */}
        <div className="rounded border border-border/30 bg-secondary/20 p-3 flex-1">
          <div className="text-sm font-bold text-foreground mb-2">📊 전투 통계</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-center py-2 px-2 text-muted-foreground font-medium w-[90px]">영웅</th>
                <th className="text-center py-2 px-2 text-red-400 font-medium">대미지</th>
                <th className="text-center py-2 px-2 text-orange-400 font-medium">비율</th>
                <th className="text-center py-2 px-2 text-yellow-400 font-medium">타겟팅</th>
                <th className="text-center py-2 px-2 text-teal-400 font-medium">회피</th>
                <th className="text-center py-2 px-2 text-blue-400 font-medium">탱킹</th>
              </tr>
            </thead>
            <tbody>
              {heroStatsData.map((hs, idx) => (
                <tr key={hs.name} className={`border-b border-border/10 ${idx % 2 === 0 ? 'bg-secondary/10' : ''}`}>
                  <td className="py-2 px-2 font-medium truncate max-w-[90px] text-center" style={{ color: heroColorMap[hs.name] }}>{hs.name}</td>
                  <td className="py-2 px-2 text-center font-mono text-red-400 text-sm">{formatNumber(hs.dmg)}</td>
                  <td className="py-2 px-2 text-center font-mono text-orange-400">{hs.dmgPct.toFixed(1)}%</td>
                  <td className="py-2 px-2 text-center font-mono text-yellow-400">{hs.targeted}</td>
                  <td className="py-2 px-2 text-center font-mono text-teal-400">{hs.dodged}</td>
                  <td className="py-2 px-2 text-center font-mono text-blue-400">{hs.tankPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT: Log - fixed height with internal scroll */}
      <div className="flex flex-col" style={{ height: '75vh' }}>
        {filterHeroName && (
          <div className="flex items-center gap-2 mb-1 px-2 py-1 bg-primary/10 rounded text-xs text-primary">
            <span className="font-medium">🔍 {filterHeroName} 필터 활성</span>
            <button onClick={() => setFilterHeroName(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}
        <div
          ref={logScrollRef}
          className="overflow-y-auto rounded border border-border/30 bg-secondary/20 flex-1"
        >
          {log.map((entry, idx) => {
            const isRelevant = isEntryRelevant(entry);
            const isPast = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            const isFuture = idx > currentIdx;

            // Determine row styling based on entry type
            let bgClass = '';
            let borderLeftColor = 'transparent';

            if (entry.type === 'monster_attack') {
              bgClass = isCurrent ? 'bg-red-500/10' : '';
              borderLeftColor = MONSTER_COLOR;
            } else if (entry.type === 'hero_attack') {
              bgClass = isCurrent ? 'bg-blue-500/10' : '';
              borderLeftColor = heroColorMap[entry.actor] || '#60a5fa';
            } else if (entry.type === 'heal') {
              borderLeftColor = '#4ade80';
            } else if (entry.type === 'result') {
              bgClass = 'bg-primary/5';
              borderLeftColor = entry.detail.includes('승리') ? '#4ade80' : '#f87171';
            } else if (entry.detail.includes('회피')) {
              borderLeftColor = '#2dd4bf'; // teal/mint for evasion
            } else {
              borderLeftColor = '#facc15';
            }

            // Actor/target name coloring
            const actorColor = entry.actor === '몬스터' ? MONSTER_COLOR
              : entry.actor === '시스템' ? undefined
              : heroColorMap[entry.actor];

            const targetColor = entry.target === '몬스터' ? MONSTER_COLOR
              : entry.target ? heroColorMap[entry.target] : undefined;

            // When filtering, dim non-relevant entries but keep them bright (not dark)
            const filterDimmed = filterHeroName && !isRelevant;
            const opacity = isFuture ? 'opacity-20' : filterDimmed ? 'opacity-25' : '';

            // Parse detail for richer display
            const isCrit = entry.detail.includes('치명타');
            const isEvasion = entry.detail.includes('회피 성공');
            const isMonsterEvasion = entry.detail.includes('몬스터가 회피');
            const isDeath = entry.detail.includes('사망');

            // Format detail with HP info
            let displayDetail = entry.detail;
            // Replace "잔여 HP: X" with "영웅이름 HP: X"
            if (entry.target && entry.detail.includes('잔여 HP:')) {
              displayDetail = entry.detail.replace('잔여 HP:', `${entry.target} HP:`);
            }
            // Replace "몬스터 잔여:" with "몬스터 HP:"
            if (entry.detail.includes('몬스터 잔여:')) {
              displayDetail = entry.detail.replace('몬스터 잔여:', '몬스터 HP:');
            }

            // Icon based on type
            let icon = '⚡';
            if (entry.type === 'monster_attack') icon = entry.detail === '광역 공격!' ? '💥' : '⚔️';
            else if (entry.type === 'hero_attack') icon = '🗡️';
            else if (entry.type === 'heal') icon = '💚';
            else if (entry.type === 'result') icon = '🏁';
            else if (isEvasion) icon = '💨';
            else if (isDeath) icon = '💀';

            return (
              <div
                key={idx}
                data-idx={idx}
                onClick={() => { setCurrentIdx(idx); setPlaying(false); }}
                className={`flex items-start gap-2 px-2.5 py-1.5 cursor-pointer transition-colors text-xs leading-relaxed
                  ${bgClass} ${opacity}
                  ${isCurrent ? 'ring-1 ring-primary/40 bg-primary/10' : 'hover:bg-secondary/30'}
                  ${isCrit && !isFuture ? 'font-semibold' : ''}
                `}
                style={{ borderLeft: `3px solid ${isFuture ? 'transparent' : borderLeftColor}` }}
              >
                <span className="shrink-0 w-5 text-center">{icon}</span>
                <span className="text-muted-foreground/50 shrink-0 w-8 text-right">[R{entry.round}]</span>
                <div className="flex-1 min-w-0">
                  {entry.actor !== '시스템' && (
                    <span className="font-bold mr-1" style={{ color: actorColor }}>{entry.actor}</span>
                  )}
                  {entry.target && (
                    <>
                      <span className="text-muted-foreground mx-0.5">→</span>
                      <span className="font-semibold mr-1" style={{ color: targetColor }}>{entry.target}</span>
                    </>
                  )}
                  <span className={`${
                    isEvasion ? 'text-teal-400 font-bold' :
                    isMonsterEvasion ? 'text-purple-400' :
                    isCrit ? 'text-orange-300' :
                    isDeath ? 'text-red-400 font-bold' :
                    entry.type === 'result' ? (entry.detail.includes('승리') ? 'text-green-400 font-bold' : 'text-red-400 font-bold') :
                    'text-foreground/70'
                  }`}>
                    {displayDetail}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
