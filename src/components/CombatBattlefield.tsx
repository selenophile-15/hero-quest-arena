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

// Class-line based colors
const CLASS_COLORS: Record<string, string> = {
  '전사': '#f87171',      // red
  '로그': '#4ade80',      // green
  '주문술사': '#60a5fa',  // blue
};
const CHAMPION_COLOR = '#c4b5fd'; // light purple
const MONSTER_COLOR = '#facc15';  // yellow

// Damage contribution color scale (matches main results)
function hpColor(pct: number): string {
  if (pct > 60) return '#65a30d'; // yellow-green / lime-ish
  if (pct > 30) return '#eab308'; // yellow
  return '#ef4444'; // red
}

function getHeroColor(hero: Hero): string {
  if (hero.type === 'champion') return CHAMPION_COLOR;
  return CLASS_COLORS[hero.classLine] || '#60a5fa';
}

export default function CombatBattlefield({ log, heroes, monsterHp, monsterName, onNewBattle }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [filterName, setFilterName] = useState<string | null>(null);
  const [showAllBright, setShowAllBright] = useState(false);
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const logScrollRef = useRef<HTMLDivElement>(null);

  const activeHeroes = heroes.filter(h => h.hp > 0);

  const heroColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeHeroes.forEach(h => { map[h.name] = getHeroColor(h); });
    return map;
  }, [activeHeroes.map(h => h.name + h.classLine + h.type).join(',')]);

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
        const dmgMatch = entry.detail.match(/([\d,]+)\s*(?:대미지|피해)/);
        if (dmgMatch && stats[entry.actor]) stats[entry.actor].dmg += parseInt(dmgMatch[1].replace(/,/g, ''));
      }
      if (entry.type === 'monster_attack' && entry.target && stats[entry.target]) {
        stats[entry.target].targeted++;
        if (!aoeRounds.has(entry.round)) stats[entry.target].singleHits++;
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
        const hpMatch = entry.detail.match(/잔여 HP: ([\d,\-]+)/);
        if (hpMatch) heroHp[entry.target] = Math.max(0, parseInt(hpMatch[1].replace(/,/g, '')));
        const dmgMatch = entry.detail.match(/([\d,]+) 피해/);
        if (dmgMatch && i === currentIdx) {
          actionEffects.push({ target: entry.target, value: `-${dmgMatch[1]}`, color: entry.detail.includes('치명타') ? 'text-orange-400' : 'text-red-400', key: i });
        }
      }
      if (entry.type === 'hero_attack') {
        const mobMatch = entry.detail.match(/몬스터 (?:잔여|HP): ([\d,\-]+)/);
        if (mobMatch) mobHpCurrent = Math.max(0, parseInt(mobMatch[1].replace(/,/g, '')));
        const dmgMatch = entry.detail.match(/([\d,]+)\s*(?:대미지|피해)/);
        if (dmgMatch && i === currentIdx) {
          actionEffects.push({ target: '__monster__', value: `-${dmgMatch[1]}`, color: entry.detail.includes('치명타') ? 'text-yellow-400' : 'text-blue-400', key: i });
        }
      }
      if (entry.type === 'event' && entry.detail.includes('사망')) heroHp[entry.actor] = 0;
      if (entry.type === 'event' && entry.detail.includes('회피') && i === currentIdx) {
        actionEffects.push({ target: entry.actor, value: 'MISS', color: 'text-teal-400', key: i });
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

  // Filter: show only rounds containing the filtered name
  const isRoundRelevant = useCallback((group: { entries: { entry: CombatLogEntry }[] }) => {
    if (!filterName) return true;
    return group.entries.some(({ entry }) =>
      entry.actor === filterName || entry.target === filterName || entry.detail.includes(filterName)
    );
  }, [filterName]);

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
    const shouldBright = showAllBright || (filterName && (entry.actor === filterName || entry.target === filterName));

    const isCrit = entry.detail.includes('치명타');
    const isEvasion = entry.detail.includes('회피 성공') || entry.detail.includes('회피!');
    const isDeath = entry.detail.includes('사망');
    const isSetup = entry.detail.includes('세팅') || entry.detail.includes('보너스') || entry.detail.includes('스택')
      || entry.detail.includes('중첩') || entry.detail.includes('닌자') || entry.detail.includes('치확')
      || entry.detail.includes('광전사') || entry.detail.includes('정복자') || entry.detail.includes('공룡')
      || entry.detail.includes('상어') || entry.detail.includes('고정 효과') || entry.detail.includes('발동')
      || entry.detail.includes('소실') || entry.detail.includes('회복') || entry.detail.includes('적용');
    const isAoe = entry.detail === '광역 공격!' || entry.detail.includes('광역');

    // Icon selection
    let icon: React.ReactNode;
    if (entry.type === 'result') {
      icon = <span className="text-sm">🏁</span>;
    } else if (isDeath) {
      icon = <Skull className="w-3.5 h-3.5 text-red-400" />;
    } else if (isEvasion) {
      icon = <Wind className="w-3.5 h-3.5 text-teal-400" />;
    } else if (isSetup || entry.type === 'event') {
      icon = <Settings className="w-3.5 h-3.5 text-muted-foreground" />;
    } else if (entry.type === 'monster_attack') {
      icon = <span className={`text-sm ${isAoe ? 'text-red-500' : 'text-foreground/80'}`}>👹</span>;
    } else if (entry.type === 'hero_attack' && isCrit) {
      icon = <Zap className="w-3.5 h-3.5 text-yellow-400" />;
    } else if (entry.type === 'hero_attack') {
      icon = <span className="text-sm">🗡️</span>;
    } else if (entry.type === 'heal') {
      icon = <span className="text-sm">💚</span>;
    } else {
      icon = <Settings className="w-3.5 h-3.5 text-muted-foreground" />;
    }

    // Determine opacity
    let opacityClass = '';
    if (isFuture && !shouldBright) opacityClass = 'opacity-20';
    else if (filterName && !(entry.actor === filterName || entry.target === filterName) && !shouldBright) opacityClass = 'opacity-20';

    // Border left color
    let borderLeftColor = 'transparent';
    if (entry.type === 'monster_attack') borderLeftColor = MONSTER_COLOR;
    else if (entry.type === 'hero_attack') borderLeftColor = heroColorMap[entry.actor] || '#60a5fa';
    else if (entry.type === 'heal') borderLeftColor = '#65a30d';
    else if (entry.type === 'result') borderLeftColor = entry.detail.includes('승리') ? '#65a30d' : '#ef4444';
    else if (isEvasion) borderLeftColor = '#2dd4bf';
    else borderLeftColor = '#a3a3a3';

    // Background
    let bgClass = '';
    if (isCurrent) bgClass = 'bg-primary/10 ring-1 ring-primary/40';

    // Parse damage and HP from detail for structured display
    const actorColor = entry.actor === '몬스터' ? MONSTER_COLOR : entry.actor === '시스템' ? undefined : heroColorMap[entry.actor];
    const targetColor = entry.target === '몬스터' ? MONSTER_COLOR : entry.target ? heroColorMap[entry.target] : undefined;

    // Build structured content
    let actionText = '';
    let damageText = '';
    let hpText = '';

    if (entry.type === 'hero_attack' || entry.type === 'monster_attack') {
      // Extract damage
      const dmgMatch = entry.detail.match(/([\d,]+)\s*(?:대미지|피해)/);
      if (dmgMatch) damageText = `${dmgMatch[1]} 피해`;

      // Extract HP info
      const heroHpMatch = entry.detail.match(/(?:잔여 HP|HP): ([\d,\-]+)/);
      const monsterHpMatch = entry.detail.match(/몬스터 (?:잔여|HP): ([\d,\-]+)/);

      if (entry.type === 'hero_attack' && monsterHpMatch) {
        const remainHp = parseInt(monsterHpMatch[1].replace(/,/g, ''));
        const pct = monsterHp > 0 ? Math.max(0, (remainHp / monsterHp) * 100) : 0;
        hpText = `(몬스터 HP: ${parseInt(monsterHpMatch[1].replace(/,/g, '')).toLocaleString()} (~${pct.toFixed(0)}%))`;
      } else if (entry.type === 'monster_attack' && entry.target && heroHpMatch) {
        const remainHp = parseInt(heroHpMatch[1].replace(/,/g, ''));
        const maxHp = state.heroMaxHp[entry.target] || 1;
        const pct = Math.max(0, (remainHp / maxHp) * 100);
        hpText = `(${entry.target} HP: ${Math.max(0, remainHp).toLocaleString()} (~${pct.toFixed(0)}%))`;
      }

      // Action description (crit, evasion etc)
      if (isCrit) actionText = '치명타!';
      else if (isAoe) actionText = '광역 공격!';
      else if (entry.type === 'monster_attack') actionText = '';
      else actionText = '';

      // Remove parsed parts for any remaining detail
      let remaining = entry.detail
        .replace(/([\d,]+)\s*(?:대미지|피해)/, '')
        .replace(/(?:잔여 HP|HP): [\d,\-]+/, '')
        .replace(/몬스터 (?:잔여|HP): [\d,\-]+/, '')
        .replace(/치명타!\s*/, '')
        .replace(/광역 공격!\s*/, '')
        .replace(/[()]/g, '')
        .trim();
      if (remaining && remaining !== actionText) {
        actionText = remaining + (actionText ? ' ' + actionText : '');
      }
    } else {
      actionText = entry.detail;
    }

    // HP color based on percentage (matching damage contribution colors)
    const getHpDisplayColor = () => {
      if (entry.type === 'hero_attack') return hpColor(mobHpPct);
      if (entry.type === 'monster_attack' && entry.target) {
        const hp = state.heroHp[entry.target] || 0;
        const maxHp = state.heroMaxHp[entry.target] || 1;
        return hpColor((hp / maxHp) * 100);
      }
      return undefined;
    };

    return (
      <div
        key={idx}
        data-idx={idx}
        onClick={() => { setCurrentIdx(idx); setPlaying(false); }}
        className={`flex items-center gap-1.5 px-2.5 py-1 cursor-pointer transition-colors text-[13px] leading-relaxed ${bgClass} ${opacityClass} hover:bg-secondary/30`}
        style={{ borderLeft: `3px solid ${(isFuture && !shouldBright) ? 'transparent' : borderLeftColor}` }}
      >
        <span className="shrink-0 w-5 flex items-center justify-center">{icon}</span>

        <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
          {/* Actor → Target */}
          {entry.actor && entry.actor !== '시스템' && (
            <span className="font-bold text-[13px]" style={{ color: actorColor }}>{entry.actor}</span>
          )}
          {entry.target && (
            <>
              <span className="text-muted-foreground mx-0.5">→</span>
              <span className="font-semibold text-[13px]" style={{ color: targetColor }}>{entry.target}</span>
            </>
          )}

          {/* Action text */}
          {(entry.type === 'hero_attack' || entry.type === 'monster_attack') ? (
            <>
              {isCrit && <span className="text-yellow-400 font-bold ml-2">치명타!</span>}
              {isAoe && !isCrit && <span className="text-red-400 font-semibold ml-2">광역!</span>}

              {/* Damage */}
              {damageText && (
                <span className="font-mono font-bold text-[13px] text-gray-100 ml-6">{damageText}</span>
              )}

              {/* HP remaining */}
              {hpText && (
                <span className="font-mono text-[12px] ml-6" style={{ color: getHpDisplayColor() }}>{hpText}</span>
              )}
            </>
          ) : (
            <span className={`ml-1 text-[13px] ${
              isEvasion ? 'text-teal-400 font-bold' :
              isDeath ? 'text-red-400 font-bold' :
              entry.type === 'result' ? (entry.detail.includes('승리') ? 'text-green-400 font-bold' : 'text-red-400 font-bold') :
              'text-foreground/60'
            }`}>
              {actionText}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4 overflow-hidden" style={{ height: '82vh' }}>
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
            {/* Heroes - compact */}
            <div className="flex-1 space-y-1">
              {activeHeroes.map(h => {
                const hp = state.heroHp[h.name] || 0;
                const maxHp = state.heroMaxHp[h.name] || 1;
                const hpPct = Math.max(0, (hp / maxHp) * 100);
                const isDead = hp <= 0;
                const effect = state.actionEffects.find(e => e.target === h.name);
                const heroImg = h.type === 'champion'
                  ? getChampionImagePath(h.championName || h.name)
                  : h.heroClass ? getJobImagePath(h.heroClass) : null;
                const isFiltered = filterName === h.name;
                const color = heroColorMap[h.name];

                return (
                  <div
                    key={h.id}
                    className={`flex items-center gap-1.5 p-1 rounded cursor-pointer transition-all ${isDead ? 'opacity-30' : ''} ${isFiltered ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-secondary/20'}`}
                    onClick={() => setFilterName(prev => prev === h.name ? null : h.name)}
                  >
                    <div className={`w-8 h-8 rounded-full overflow-hidden bg-secondary/50 shrink-0 ${isFiltered ? 'ring-2 ring-primary' : 'border border-border/50'}`}>
                      {heroImg && <img src={heroImg} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold truncate" style={{ color }}>{h.name}</span>
                        <span className="text-[11px] font-mono" style={{ color: hpColor(hpPct) }}>
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
              className={`w-36 shrink-0 cursor-pointer transition-all ${filterName === '몬스터' ? 'ring-2 ring-primary rounded-lg' : ''}`}
              onClick={() => setFilterName(prev => prev === '몬스터' ? null : '몬스터')}
            >
              <div className={`p-2.5 rounded-lg border bg-yellow-500/5 ${filterName === '몬스터' ? 'border-primary' : 'border-yellow-500/20'} ${state.mobHpCurrent <= 0 ? 'opacity-30' : ''}`}>
                <div className="text-center"><span className="text-2xl">👹</span></div>
                <div className="text-center mb-1"><span className="text-xs font-bold" style={{ color: MONSTER_COLOR }}>{monsterName}</span></div>
                <div className="text-center text-[11px] font-mono" style={{ color: hpColor(mobHpPct) }}>
                  {Math.max(0, Math.round(state.mobHpCurrent)).toLocaleString()}
                </div>
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${mobHpPct}%`, backgroundColor: hpColor(mobHpPct) }} />
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

        {/* Combat Stats - scrollable */}
        <div className="rounded border border-border/30 bg-secondary/20 p-2.5 flex-1 overflow-y-auto min-h-0">
          <div className="text-sm font-bold text-foreground mb-1.5">📊 전투 통계</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-center py-1.5 px-1 text-muted-foreground font-medium w-[80px]">영웅</th>
                <th className="text-center py-1.5 px-1 text-red-400 font-medium">대미지</th>
                <th className="text-center py-1.5 px-1 text-orange-400 font-medium">비율</th>
                <th className="text-center py-1.5 px-1 text-yellow-400 font-medium">타겟팅</th>
                <th className="text-center py-1.5 px-1 text-teal-400 font-medium">회피</th>
                <th className="text-center py-1.5 px-1 text-blue-400 font-medium">탱킹</th>
              </tr>
            </thead>
            <tbody>
              {heroStatsData.map((hs, idx) => (
                <tr key={hs.name} className={`border-b border-border/10 ${idx % 2 === 0 ? 'bg-secondary/10' : ''}`}>
                  <td className="py-1.5 px-1 font-medium truncate max-w-[80px] text-center text-[13px]" style={{ color: heroColorMap[hs.name] }}>{hs.name}</td>
                  <td className="py-1.5 px-1 text-center font-mono text-red-400 text-[13px]">{formatNumber(hs.dmg)}</td>
                  <td className="py-1.5 px-1 text-center font-mono text-orange-400 text-[13px]">{hs.dmgPct.toFixed(1)}%</td>
                  <td className="py-1.5 px-1 text-center font-mono text-yellow-400 text-[13px]">{hs.targeted}</td>
                  <td className="py-1.5 px-1 text-center font-mono text-teal-400 text-[13px]">{hs.dodged}</td>
                  <td className="py-1.5 px-1 text-center font-mono text-blue-400 text-[13px]">{hs.tankPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT: Grouped Log */}
      <div className="flex flex-col overflow-hidden" style={{ height: '82vh' }}>
        {/* Log toolbar */}
        <div className="flex items-center gap-2 mb-1 px-1">
          {filterName && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded text-xs text-primary">
              <span className="font-medium">🔍 {filterName}</span>
              <button onClick={() => setFilterName(null)} className="ml-1 text-muted-foreground hover:text-foreground text-sm">✕</button>
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
            if (filterName && !isRoundRelevant(group)) return null;
            const isCollapsed = collapsedRounds.has(group.round);

            return (
              <div key={group.round} className="border-b border-border/20">
                {/* Round header */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 cursor-pointer hover:bg-secondary/60 sticky top-0 z-10"
                  onClick={() => toggleRoundCollapse(group.round)}
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className="text-[13px] font-bold text-foreground/90">라운드 {group.round}</span>
                  <span className="text-[11px] text-muted-foreground ml-auto">{group.entries.length}건</span>
                </div>
                {/* Round entries */}
                {!isCollapsed && group.entries.map(({ entry, idx }) => {
                  if (filterName && !(entry.actor === filterName || entry.target === filterName || entry.detail.includes(filterName))) {
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
