import { useState, useEffect, useRef } from 'react';
import { CombatLogEntry } from '@/lib/combatSimulation';
import { Hero } from '@/types/game';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react';

interface Props {
  log: CombatLogEntry[];
  heroes: Hero[];
  monsterHp: number;
  monsterName: string;
}

export default function CombatBattlefield({ log, heroes, monsterHp, monsterName }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track state at each step
  const activeHeroes = heroes.filter(h => h.hp > 0);

  // Parse states from log up to currentIdx
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

      // Parse HP from detail
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

  // Scroll log to current entry
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-idx="${currentIdx}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIdx]);

  const mobHpPct = monsterHp > 0 ? Math.max(0, (state.mobHpCurrent / monsterHp) * 100) : 0;
  const isResult = state.lastAction?.type === 'result';
  const isWin = isResult && state.lastAction?.detail.includes('승리');

  return (
    <div className="space-y-3">
      {/* Battlefield */}
      <div className="relative bg-secondary/30 rounded-lg p-4 border border-border/30">
        {/* Round indicator */}
        <div className="text-center mb-3">
          <span className="text-xs text-muted-foreground">라운드</span>
          <span className="ml-1 text-lg font-bold font-mono text-foreground">{state.currentRound}</span>
          {isResult && (
            <span className={`ml-2 text-sm font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
              {isWin ? '🏆 승리!' : '💀 패배!'}
            </span>
          )}
        </div>

        <div className="flex items-start gap-4">
          {/* Heroes side */}
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

              return (
                <div key={h.id} className={`flex items-center gap-2 p-1.5 rounded ${isDead ? 'opacity-30' : ''} ${effect ? 'bg-secondary/40' : ''}`}>
                  <div className="w-8 h-8 rounded-full border border-primary/30 overflow-hidden bg-secondary/50 shrink-0">
                    {heroImg && <img src={heroImg} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-foreground font-medium truncate">{h.name}</span>
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {Math.round(hp).toLocaleString()}/{Math.round(maxHp).toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden mt-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          hpPct > 60 ? 'bg-green-500' : hpPct > 30 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${hpPct}%` }}
                      />
                    </div>
                  </div>
                  {effect && (
                    <span className={`text-xs font-bold font-mono ${effect.color} animate-bounce shrink-0`}>
                      {effect.value}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center justify-center py-4 shrink-0">
            <span className="text-lg font-bold text-muted-foreground/30">⚔</span>
          </div>

          {/* Monster side */}
          <div className="w-40 shrink-0">
            <div className={`p-2 rounded-lg border border-red-500/20 bg-red-500/5 ${state.mobHpCurrent <= 0 ? 'opacity-30' : ''}`}>
              <div className="text-center mb-1">
                <span className="text-2xl">👹</span>
              </div>
              <div className="text-center mb-1.5">
                <span className="text-xs text-foreground font-medium">{monsterName}</span>
              </div>
              <div className="text-center text-[9px] font-mono text-muted-foreground mb-1">
                {Math.max(0, Math.round(state.mobHpCurrent)).toLocaleString()} / {monsterHp.toLocaleString()}
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${mobHpPct}%` }}
                />
              </div>
              {state.actionEffects.find(e => e.target === '__monster__') && (
                <div className="text-center mt-1">
                  <span className={`text-sm font-bold font-mono ${state.actionEffects.find(e => e.target === '__monster__')!.color} animate-bounce`}>
                    {state.actionEffects.find(e => e.target === '__monster__')!.value}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
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
        <span className="text-[9px] text-muted-foreground">{currentIdx + 1}/{log.length}</span>
      </div>

      {/* Log with highlight */}
      <div ref={scrollRef} className="max-h-40 overflow-y-auto rounded border border-border/30 bg-secondary/20 p-2 space-y-0.5 text-[10px] font-mono">
        {log.map((entry, idx) => {
          let color = 'text-muted-foreground';
          let icon = '';
          if (entry.type === 'monster_attack') { color = 'text-red-400'; icon = '⚔️'; }
          else if (entry.type === 'hero_attack') { color = 'text-blue-400'; icon = '🗡️'; }
          else if (entry.type === 'heal') { color = 'text-green-400'; icon = '💚'; }
          else if (entry.type === 'result') { color = entry.detail.includes('승리') ? 'text-green-400' : 'text-red-400'; icon = '🏁'; }
          else { color = 'text-yellow-400'; icon = '⚡'; }

          return (
            <div
              key={idx}
              data-idx={idx}
              onClick={() => { setCurrentIdx(idx); setPlaying(false); }}
              className={`${color} leading-relaxed cursor-pointer rounded px-1 ${
                idx === currentIdx ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-secondary/50'
              } ${idx > currentIdx ? 'opacity-30' : ''}`}
            >
              <span className="text-muted-foreground/50 mr-1">[R{entry.round}]</span>
              <span className="mr-1">{icon}</span>
              <span className="text-foreground/80 font-semibold mr-1">{entry.actor}</span>
              {entry.target && <span className="text-muted-foreground mr-1">→ {entry.target}</span>}
              <span>{entry.detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
