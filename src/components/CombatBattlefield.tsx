import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { CombatLogEntry } from "@/lib/combatSimulation";
import { Hero } from "@/types/game";
import { getJobImagePath, getChampionImagePath } from "@/lib/nameMap";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Dices,
  Settings,
  Zap,
  Wind,
  Skull,
  Eye,
  Flame,
  FastForward,
  BarChart3,
  Heart,
  Plus,
  Trophy,
  Shield,
  Sparkles,
  UserX,
  Bug,
  Sword,
  BowArrow,
  WandSparkles,
} from "lucide-react";
import { formatNumber } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";

interface Props {
  log: CombatLogEntry[];
  heroes: Hero[];
  monsterHp: number;
  monsterName: string;
  monsterImage?: string | null;
  onNewBattle?: () => void;
}

const MONSTER_COLOR = "#facc15"; // yellow

// Class-line based colors
const CLASS_LINE_COLORS: Record<string, string> = {
  전사: "#f87171", // red-400
  로그: "#a3e635", // lime-400
  주문술사: "#60a5fa", // blue-400
};
const CHAMPION_COLOR = "#c4b5fd"; // violet-300

// Darken colors for light mode visibility
function adjustColorForLight(hex: string): string {
  const colorMap: Record<string, string> = {
    "#f87171": "#b91c1c",
    "#a3e635": "#4d7c0f",
    "#60a5fa": "#1d4ed8",
    "#c4b5fd": "#6d28d9",
    "#d1d5db": "#374151",
  };
  return colorMap[hex] || hex;
}

// 5-tier HP color
function hpColor(pct: number): string {
  if (pct > 80) return "#84cc16";
  if (pct > 60) return "#eab308";
  if (pct > 40) return "#f97316";
  if (pct > 20) return "#ef4444";
  return "#a855f7";
}

export default function CombatBattlefield({ log, heroes, monsterHp, monsterName, monsterImage, onNewBattle }: Props) {
  const { colorMode } = useTheme();
  const isLight = colorMode === "light";

  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [filter, setFilter] = useState<{ name: string } | null>(null);
  const showAllBright = false;
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const logScrollRef = useRef<HTMLDivElement>(null);

  // Category visibility toggles (gear-icon menu)
  type CategoryKey =
    | "attacks"
    | "evasion"
    | "death"
    | "heal"
    | "result"
    | "classBonus"
    | "spiritBonus"
    | "leaderBonus"
    | "protection"
    | "retry"
    | "execute"
    | "survival"
    | "stack"
    | "system";
  const ALL_CATEGORIES: { key: CategoryKey; label: string }[] = [
    { key: "attacks", label: "공격 (피해/치명타/광역)" },
    { key: "evasion", label: "회피" },
    { key: "death", label: "사망" },
    { key: "heal", label: "회복/재생" },
    { key: "result", label: "전투 결과" },
    { key: "classBonus", label: "직업 보너스 (닌자/무희/광전사/사무라이 등)" },
    { key: "spiritBonus", label: "영혼 보너스 (상어/공룡)" },
    { key: "leaderBonus", label: "챔피언 리더 스킬 (헴마/루도 등)" },
    { key: "protection", label: "군주 보호" },
    { key: "retry", label: "크로노맨서/페이트위버 재시도" },
    { key: "execute", label: "어둠의 기사 처형" },
    { key: "survival", label: "치명타 생존" },
    { key: "stack", label: "정복자 스택" },
    { key: "system", label: "시스템/기타" },
  ];
  const [visibleCategories, setVisibleCategories] = useState<Set<CategoryKey>>(
    () => new Set(ALL_CATEGORIES.map((c) => c.key)),
  );
  const toggleCategory = (k: CategoryKey) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // Classify a log entry into a category for the gear-icon filter
  const classifyEntry = useCallback((entry: CombatLogEntry): CategoryKey => {
    if (entry.type === "retry") return "retry";
    if ((entry.type as string) === "lord_protect") return "protection";

    if (entry.type === "hero_attack" || entry.type === "monster_attack") return "attacks";
    if (entry.type === "result") return "result";
    if (entry.type === "heal") return "heal";
    if (entry.type === "event") {
      const d = entry.detail || "";
      if (d.includes("광역 공격 발동")) return "attacks";
      if (d.includes("재생") || d.includes("회복")) return "heal";
      if (d.includes("다이묘 확정 회피") || d.includes("회피")) return d.includes("다이묘") ? "classBonus" : "evasion";
      if (d.includes("사망")) return "death";
      if (d.includes("재시도") || d.includes("크로노") || d.includes("페이트")) return "retry";
      if (d.includes("처형")) return "execute";
      if (d.includes("치명타 생존") || d.includes("생존")) return "survival";
      if (d.includes("정복자") || d.includes("스택") || d.includes("중첩")) return "stack";
      if (d.includes("군주") || d.includes("보호") || d.includes("대신")) return "protection";
      if (
        d.includes("헴마") ||
        d.includes("루도") ||
        d.includes("폴로니아") ||
        d.includes("훔치") ||
        d.includes("리더")
      )
        return "leaderBonus";
      if (d.includes("상어") || d.includes("공룡") || d.includes("영혼")) return "spiritBonus";
      if (
        d.includes("닌자") ||
        d.includes("센세") ||
        d.includes("무희") ||
        d.includes("곡예") ||
        d.includes("광전사") ||
        d.includes("잘") ||
        d.includes("사무라이") ||
        d.includes("다이묘") ||
        d.includes("어둠의 기사") ||
        d.includes("죽음의 기사") ||
        d.includes("첫 턴")
      )
        return "classBonus";
      return "system";
    }
    return "system";
  }, []);

  const isCategoryVisible = useCallback(
    (entry: CombatLogEntry) => {
      return visibleCategories.has(classifyEntry(entry));
    },
    [visibleCategories, classifyEntry],
  );

  // Adaptive colors for light/dark mode
  const C = useMemo(
    () => ({
      yellow: "#facc15", // pure yellow for crit (consistent across modes)
      white: isLight ? "#374151" : "#e5e7eb",
      red: isLight ? "#b91c1c" : "#f87171",
      teal: isLight ? "#0f766e" : "#2dd4bf",
      green: isLight ? "#166534" : "#84cc16",
      heal: isLight ? "#c2410c" : "#fb923c", // orange
      monster: isLight ? "#a16207" : "#facc15",
    }),
    [isLight],
  );

  const activeHeroes = heroes.filter((h) => h.hp > 0);

  // Build name→color map from hero data
  const nameColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeHeroes.forEach((h) => {
      if (h.type === "champion") {
        map[h.name] = CHAMPION_COLOR;
      } else {
        map[h.name] = CLASS_LINE_COLORS[h.classLine || ""] || "#d1d5db";
      }
    });
    return map;
  }, [activeHeroes]);

  // Build name→classLine map for hero attack icons
  const nameClassLineMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeHeroes.forEach((h) => {
      map[h.name] = h.classLine || "";
    });
    return map;
  }, [activeHeroes]);

  // Extract the base monster name (without mini-boss prefix) for matching
  const baseMonsterName = useMemo(() => {
    const prefixes = ["거대한", "민첩한", "흉포한", "부유한", "전설적인"];
    let name = monsterName;
    for (const p of prefixes) {
      if (name.startsWith(p + " ")) {
        name = name.slice(p.length + 1);
        break;
      }
    }
    return name;
  }, [monsterName]);

  const getNameColor = (name: string | undefined): string => {
    if (!name) return isLight ? "#374151" : "#d1d5db";
    if (name === monsterName || name.includes(baseMonsterName) || name.includes("몬스터")) return C.monster;
    if (name === "시스템") return isLight ? "#374151" : "#d1d5db";
    const raw = nameColorMap[name] || "#d1d5db";
    return isLight ? adjustColorForLight(raw) : raw;
  };

  const isMonsterName = (name: string | undefined): boolean => {
    if (!name) return false;
    return name === monsterName || name.includes(baseMonsterName) || name.includes("몬스터");
  };

  // Group log entries by round, with retry separator as standalone groups
  const roundGroups = useMemo(() => {
    const groups: {
      round: number;
      entries: { entry: CombatLogEntry; idx: number }[];
      isRetry?: boolean;
      isAfterRetry?: boolean;
    }[] = [];
    let currentGroup: (typeof groups)[0] | null = null;
    let afterRetry = false;
    log.forEach((entry, idx) => {
      // retry separator → its own standalone group
      if (entry.type === "retry") {
        afterRetry = true;
        currentGroup = null;
        groups.push({ round: entry.round, entries: [{ entry, idx }], isRetry: true });
        return;
      }
      if (!currentGroup || currentGroup.round !== entry.round || currentGroup.isRetry) {
        currentGroup = { round: entry.round, entries: [], isAfterRetry: afterRetry };
        groups.push(currentGroup);
      }
      currentGroup.entries.push({ entry, idx });
    });
    return groups;
  }, [log]);

  const heroStatsData = useMemo(() => {
    const stats: Record<string, { dmg: number; targeted: number; dodged: number; singleHits: number }> = {};
    activeHeroes.forEach((h) => {
      stats[h.name] = { dmg: 0, targeted: 0, dodged: 0, singleHits: 0 };
    });

    // Track AOE rounds
    const aoeRounds = new Set<number>();
    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      if (entry.type === "monster_attack" && entry.detail.includes("광역 공격")) aoeRounds.add(entry.round);
    }

    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      if (entry.type === "hero_attack") {
        const dmgMatch = entry.detail.match(/([\d,]+)\s*피해/);
        if (dmgMatch && stats[entry.actor]) stats[entry.actor].dmg += parseInt(dmgMatch[1].replace(/,/g, ""));
      }
      if (entry.type === "monster_attack" && entry.target && stats[entry.target]) {
        stats[entry.target].targeted++;
        if (!aoeRounds.has(entry.round)) stats[entry.target].singleHits++;
      }
      if (entry.type === "event" && entry.detail === "회피" && entry.target && stats[entry.target]) {
        stats[entry.target].dodged++;
        stats[entry.target].targeted++;
      }
    }

    const totalDmg = Object.values(stats).reduce((s, v) => s + v.dmg, 0);
    const totalSingleHits = Object.values(stats).reduce((s, v) => s + v.singleHits, 0);

    return activeHeroes
      .map((h) => ({
        name: h.name,
        ...stats[h.name],
        dmgPct: totalDmg > 0 ? (stats[h.name].dmg / totalDmg) * 100 : 0,
        tankPct: totalSingleHits > 0 ? (stats[h.name].singleHits / totalSingleHits) * 100 : 0,
      }))
      .sort((a, b) => b.dmg - a.dmg);
  }, [log, currentIdx]);

  const getState = () => {
    const heroHp: Record<string, number> = {};
    const heroMaxHp: Record<string, number> = {};
    activeHeroes.forEach((h) => {
      heroHp[h.name] = h.hp || 0;
      heroMaxHp[h.name] = h.hp || 0;
    });
    // 엔진이 보낸 values.maxHp 가 있으면 그것을 진짜 max 로 채택 (파티 버프 등으로 prop hp 보다 클 수 있음)
    const updateMax = (name: string, v: number | undefined) => {
      if (typeof v === "number" && v > 0 && v > (heroMaxHp[name] ?? 0)) heroMaxHp[name] = v;
    };
    // Use the first "전투 시작" entry in the log to get the actual total HP
    // (which includes mini-boss multipliers), falling back to the prop.
    let initialMobHp = monsterHp;
    for (let i = 0; i < log.length; i++) {
      if (log[i].type === "event" && log[i].detail.includes("전투 시작!")) {
        const v = log[i].values ?? {};
        if (typeof v.hp === "number" && v.hp > 0) {
          initialMobHp = v.hp;
          break;
        }
        const m = log[i].detail.match(/HP:\s*([\d,]+)/);
        if (m) {
          initialMobHp = parseInt(m[1].replace(/,/g, ""));
          break;
        }
      }
    }
    let mobHpCurrent = initialMobHp;
    let currentRound = 0;
    let lastAction: CombatLogEntry | null = null;
    const actionEffects: { target: string; value: string; color: string; key: number }[] = [];

    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      const entry = log[i];
      if (entry.type !== "retry") currentRound = entry.round;
      lastAction = entry;
      if (entry.type === "retry") {
        // Reset mob HP and all hero HP to full for the retry battle
        mobHpCurrent = initialMobHp;
        activeHeroes.forEach((h) => {
          heroHp[h.name] = heroMaxHp[h.name];
        });
        continue;
      }
      // "전투 시작" event carries the actual total HP (including mini-boss multiplier)
      if (entry.type === "event" && entry.detail.includes("전투 시작!")) {
        const m = entry.detail.match(/HP:\s*([\d,]+)/);
        if (m) mobHpCurrent = parseInt(m[1].replace(/,/g, ""));
      }

      if (entry.type === "monster_attack" && entry.target) {
        const v = entry.values ?? {};
        updateMax(entry.target, typeof v.maxHp === "number" ? v.maxHp : undefined);
        if (typeof v.hp === "number") heroHp[entry.target] = Math.max(0, v.hp);
        else {
          const hpMatch = entry.detail.match(/HP: ([\d,\-]+)/);
          if (hpMatch) heroHp[entry.target] = Math.max(0, parseInt(hpMatch[1].replace(/,/g, "")));
        }
        const dmgMatch = entry.detail.match(/([\d,]+) 피해/);
        if (dmgMatch && i === currentIdx) {
          actionEffects.push({
            target: entry.target,
            value: `-${dmgMatch[1]}`,
            color: entry.detail.includes("치명타") ? "text-yellow-400" : "text-red-400",
            key: i,
          });
        }
      }
      // damage 이벤트(사망 직전 포함): HP/maxHp 동기화 + 액션 이펙트 표시
      if (entry.type === "damage" && entry.actor) {
        const v = entry.values ?? {};
        updateMax(entry.actor, typeof v.maxHp === "number" ? v.maxHp : undefined);
        if (typeof v.hp === "number") heroHp[entry.actor] = Math.max(0, v.hp);
        if (typeof v.dmg === "number" && i === currentIdx) {
          actionEffects.push({
            target: entry.actor,
            value: `-${v.dmg.toLocaleString()}`,
            color: entry.detail.includes("치명") ? "text-yellow-400" : "text-red-400",
            key: i,
          });
        }
      }
      if (entry.type === "hero_attack") {
        const mobMatch = entry.detail.match(/HP: ([\d,\-]+)/);
        if (mobMatch) mobHpCurrent = Math.max(0, parseInt(mobMatch[1].replace(/,/g, "")));
        const dmgMatch = entry.detail.match(/([\d,]+)\s*피해/);
        if (dmgMatch && i === currentIdx) {
          actionEffects.push({
            target: "__monster__",
            value: `-${dmgMatch[1]}`,
            color: entry.detail.includes("치명타") ? "text-yellow-400" : "text-blue-400",
            key: i,
          });
        }
      }
      if (entry.type === "event" && entry.detail.includes("사망")) heroHp[entry.actor] = 0;
      if (entry.type === "event" && entry.detail === "회피" && entry.target && i === currentIdx) {
        actionEffects.push({ target: entry.target, value: "MISS", color: "text-teal-400", key: i });
      }
      // Heal entries: extract HP info to keep visualization in sync
      if (entry.type === "heal") {
        const hpMatch = entry.detail.match(/HP: ([\d,]+)/);
        if (hpMatch && entry.actor && entry.actor in heroHp) {
          heroHp[entry.actor] = Math.max(0, parseInt(hpMatch[1].replace(/,/g, "")));
        }
        const healMatch = entry.detail.match(/체력 ([\d,]+) 회복/);
        if (healMatch && entry.actor && i === currentIdx) {
          actionEffects.push({ target: entry.actor, value: `+${healMatch[1]}`, color: "text-emerald-400", key: i });
        }
      }
      // Hemma drain: parse the drained party member's remaining HP and the drain amount
      if (entry.type === "event" && entry.detail.includes("헴마 스킬 발동")) {
        // Last HP block in the detail belongs to the drain target
        const hpBlocks = [...entry.detail.matchAll(/(\S+?)\s*HP:\s*([\d,]+)/g)];
        const last = hpBlocks[hpBlocks.length - 1];
        if (last) {
          const targetName = last[1].trim();
          if (targetName in heroHp) {
            heroHp[targetName] = Math.max(0, parseInt(last[2].replace(/,/g, "")));
          }
          if (i === currentIdx) {
            const drainMatch = entry.detail.match(/HP -([\d,]+)/);
            if (drainMatch) {
              actionEffects.push({ target: targetName, value: `-${drainMatch[1]}`, color: "text-purple-400", key: i });
            }
          }
        }
      }
    }
    return { heroHp, heroMaxHp, mobHpCurrent, currentRound, lastAction, actionEffects };
  };

  const state = getState();

  // Derive actual total monster HP from the log (accounts for mini-boss multipliers).
  // The log always contains a "전투 시작! ... HP: X" event at round 0.
  // For retry battles there may be a second such entry — use the one that corresponds
  // to whichever attempt is currently being viewed (before or after the retry separator).
  const actualMonsterHp = useMemo(() => {
    // Find the last "전투 시작" entry at or before currentIdx
    let hp = monsterHp;
    for (let i = 0; i <= currentIdx && i < log.length; i++) {
      if (log[i].type === "event" && log[i].detail.includes("전투 시작!")) {
        const v = log[i].values ?? {};
        if (typeof v.hp === "number" && v.hp > 0) hp = v.hp;
        else {
          const m = log[i].detail.match(/HP:\s*([\d,]+)/);
          if (m) hp = parseInt(m[1].replace(/,/g, ""));
        }
      }
    }
    return hp > 0 ? hp : monsterHp;
  }, [log, currentIdx, monsterHp]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setCurrentIdx((prev) => {
          if (prev >= log.length - 1) {
            setPlaying(false);
            return prev;
          }
          const next = prev + 1;
          // Scroll directly inside the callback so it fires synchronously
          // at every tick, even at 4x speed (100ms) where React state batching
          // would otherwise cause the useEffect below to miss frames.
          requestAnimationFrame(() => {
            if (logScrollRef.current) {
              const el = logScrollRef.current.querySelector(`[data-idx="${next}"]`);
              el?.scrollIntoView({ block: "nearest", behavior: "auto" });
            }
          });
          return next;
        });
      }, speed);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speed, log.length]);

  // Manual seek (click / prev / next buttons) — smooth scroll is fine here.
  useEffect(() => {
    if (playing) return; // handled above during playback
    if (logScrollRef.current) {
      const el = logScrollRef.current.querySelector(`[data-idx="${currentIdx}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: speed <= 250 ? "smooth" : "auto" });
    }
  }, [currentIdx, speed, playing]);

  const mobHpPct = actualMonsterHp > 0 ? Math.max(0, (state.mobHpCurrent / actualMonsterHp) * 100) : 0;
  const isResult = state.lastAction?.type === "result";
  const isWin = isResult && state.lastAction?.detail.includes("승리");
  // After a retry the lastAction might be the retry banner itself momentarily —
  // fall back to scanning the log for the last result entry.
  const lastResultEntry = useMemo(() => {
    for (let i = currentIdx; i >= 0; i--) {
      if (log[i].type === "result") return log[i];
    }
    return null;
  }, [log, currentIdx]);
  const effectiveIsResult = lastResultEntry !== null && currentIdx >= log.findIndex((e) => e === lastResultEntry);
  const effectiveIsWin = effectiveIsResult && lastResultEntry?.detail.includes("승리");

  // Single toggle filter: click once = filter, click again = clear
  const handleFilterClick = (name: string) => {
    if (filter?.name === name) {
      setFilter(null);
    } else {
      setFilter({ name });
    }
  };

  // Match filter: show entries where actor OR target matches the filter name
  const entryMatchesFilter = useCallback(
    (entry: CombatLogEntry) => {
      if (!filter) return true;
      const { name } = filter;
      return (
        entry.actor === name || entry.target === name || entry.actor?.includes(name) || entry.detail.includes(name)
      );
    },
    [filter],
  );

  const isRoundRelevant = useCallback(
    (group: { entries: { entry: CombatLogEntry }[] }) => {
      if (!filter) return true;
      return group.entries.some(({ entry }) => entryMatchesFilter(entry));
    },
    [filter, entryMatchesFilter],
  );

  // Parse log entry into structured display
  const renderLogEntry = (entry: CombatLogEntry, idx: number) => {
    // ── Retry separator banner ──────────────────────────────────────────────
    if (entry.type === "retry") {
      const isPast = idx <= currentIdx;
      const isCurrent = idx === currentIdx;
      return (
        <div
          key={idx}
          data-idx={idx}
          onClick={() => {
            setCurrentIdx(idx);
            setPlaying(false);
          }}
          className={`cursor-pointer transition-opacity ${!isPast ? "opacity-30" : ""}`}
        >
          {/* Top divider line */}
          <div className={`mx-3 my-1 h-px ${isLight ? "bg-violet-400/60" : "bg-violet-500/50"}`} />
          <div
            className={`mx-2 mb-1 rounded-lg px-3 py-2 flex items-center gap-2.5
            ${
              isLight
                ? "bg-violet-100 border border-violet-300 text-violet-800"
                : "bg-violet-950/60 border border-violet-500/50 text-violet-200"
            }
            ${isCurrent ? "ring-2 ring-violet-400" : ""}
          `}
          >
            {/* Clockwise-rewind icon via inline SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-5 h-5 shrink-0 ${isLight ? "text-violet-600" : "text-violet-400"}`}
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <div className="flex flex-col min-w-0">
              <span className={`text-sm font-bold ${isLight ? "text-violet-700" : "text-violet-300"}`}>
                ⏪ 시간 되감기!
              </span>
              <span className={`text-xs mt-0.5 ${isLight ? "text-violet-600" : "text-violet-400/80"}`}>
                {entry.detail.replace(/^시간 되감기! /, "")}
              </span>
            </div>
          </div>
        </div>
      );
    }
    const isPast = idx <= currentIdx;
    const isCurrent = idx === currentIdx;
    const isFuture = idx > currentIdx;
    const matchesFilter = entryMatchesFilter(entry);
    const shouldBright = showAllBright || (filter && matchesFilter);

    const isCrit = entry.detail.includes("치명타");
    const isEvasion = entry.detail === "회피";
    const isDeath = entry.detail.includes("사망");
    const isSetup = entry.type === "event" && !isEvasion && !isDeath;
    const isAoe = entry.detail.includes("광역 공격");

    // Icon selection
    let icon: React.ReactNode;
    if (entry.type === "result") {
      icon = entry.detail.includes("승리") ? (
        <Trophy className="w-4 h-4 text-lime-400" />
      ) : (
        <Skull className="w-4 h-4 text-red-400" />
      );
    } else if (isDeath) {
      icon = <UserX className="w-4 h-4 text-red-300" />;

    } else if (isEvasion) {
      icon = <Wind className="w-4 h-4 text-teal-400" />;
    } else if (isSetup) {
      icon = <Settings className="w-4 h-4 text-muted-foreground" />;
    } else if (entry.type === "monster_attack" && isAoe) {
      icon = <Bug className="w-4 h-4 text-red-500" />;
    } else if (entry.type === "monster_attack" && isCrit) {
      icon = <Bug className="w-4 h-4 text-yellow-400" />;
    } else if (entry.type === "monster_attack" && entry.target) {
      icon = <Bug className="w-4 h-4 text-foreground/60" />;
    } else if (entry.type === "monster_attack") {
      icon = <Bug className="w-4 h-4 text-red-500" />;
    } else if (entry.type === "hero_attack") {
      const cl = nameClassLineMap[entry.actor || ""] || "";
      const color = isCrit ? "text-yellow-400" : "text-foreground/60";
      if (cl === "전사") icon = <Sword className={`w-4 h-4 ${color}`} />;
      else if (cl === "로그") icon = <BowArrow className={`w-4 h-4 ${color}`} />;
      else if (cl === "주문술사") icon = <WandSparkles className={`w-4 h-4 ${color}`} />;
      else icon = <Zap className={`w-4 h-4 ${color}`} />;
    } else if (entry.type === "heal") {
      icon = (
        <span className="relative inline-flex items-center justify-center w-4 h-4">
          <Heart className="w-4 h-4 text-orange-400" />
          <Plus className="absolute w-2 h-2 text-orange-400" strokeWidth={3} />
        </span>
      );
    } else {
      icon = <Settings className="w-4 h-4 text-muted-foreground" />;
    }

    // Determine opacity
    let opacityClass = "";
    if (isFuture && !shouldBright) opacityClass = "opacity-20";
    else if (filter && !matchesFilter && !showAllBright) opacityClass = "opacity-15";

    // Border left color
    let borderLeftColor = "transparent";
    if (entry.type === "monster_attack") borderLeftColor = C.monster;
    else if (entry.type === "hero_attack") borderLeftColor = getNameColor(entry.actor);
    else if (entry.type === "heal") borderLeftColor = C.green;
    else if (entry.type === "result") borderLeftColor = entry.detail.includes("승리") ? "#84cc16" : "#ef4444";
    else if (isEvasion) borderLeftColor = C.teal;
    else borderLeftColor = isLight ? "#6b7280" : "#a3a3a3";

    // Background
    let bgClass = "";
    if (isCurrent) bgClass = "bg-primary/10 ring-1 ring-primary/40";

    // Build structured content
    let damageText = "";
    let hpText = "";

    if (entry.type === "hero_attack" || (entry.type === "monster_attack" && entry.target)) {
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
      if (entry.type === "hero_attack") {
        return isCrit ? C.yellow : C.white;
      }
      if (entry.type === "monster_attack") {
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
        onClick={() => {
          setCurrentIdx(idx);
          setPlaying(false);
        }}
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-sm leading-relaxed ${bgClass} ${opacityClass} hover:bg-secondary/30`}
        style={{ borderLeft: `3px solid ${isFuture && !shouldBright ? "transparent" : borderLeftColor}` }}
      >
        <span className="shrink-0 w-5 flex items-center justify-center">{icon}</span>

        <div className="flex-1 min-w-0 flex items-center gap-1">
          {/* Actor → Target */}
          {entry.actor && entry.actor !== "시스템" && (
            <span className="font-bold text-sm" style={{ color: getNameColor(entry.actor) }}>
              {entry.actor}
            </span>
          )}
          {entry.target && (
            <>
              <span className="text-muted-foreground mx-0.5">→</span>
              <span className="font-bold text-sm" style={{ color: getNameColor(entry.target) }}>
                {entry.target}
              </span>
            </>
          )}

          {/* Attack entries: structured format */}
          {entry.type === "hero_attack" || (entry.type === "monster_attack" && entry.target) ? (
            <>
              {damageText && (
                <span className="ml-4 inline-flex items-baseline gap-1 shrink-0">
                  {isCrit && (
                    <span className="font-body font-bold text-sm" style={{ color: C.yellow }}>
                      치명타!
                    </span>
                  )}
                  <span className="font-mono font-bold text-sm text-foreground/80">
                    {damageText.replace(/\s*피해$/, "")}
                  </span>
                  <span className="font-body font-bold text-sm text-foreground/80">피해</span>
                </span>
              )}

              {hpText &&
                (() => {
                  const m = hpText.match(/^\((.+?)\s+HP:\s*([\d,\-]+)\s*\((\d+)%\)\)$/);
                  if (m) {
                    const [, who, hpNum, pct] = m;
                    return (
                      <span className="ml-auto inline-flex items-baseline gap-1 shrink-0 text-sm text-foreground/80">
                        <span className="font-body">(</span>
                        <span className="font-body font-bold" style={{ color: getNameColor(who) }}>
                          {who}
                        </span>
                        <span className="font-body">HP:</span>
                        <span className="font-mono font-bold">{hpNum}</span>
                        <span className="font-mono">({pct}%)</span>
                        <span className="font-body">)</span>
                      </span>
                    );
                  }
                  return (
                    <span className="font-mono font-bold text-sm ml-auto text-foreground/80 shrink-0">{hpText}</span>
                  );
                })()}
            </>
          ) : entry.type === "heal" ? (
            (() => {
              const healMatch = entry.detail.match(/체력 ([\d,]+) 회복/);
              const hpInfoMatch = entry.detail.match(/\((.+?HP: [\d,\-]+ \(\d+%\))\)/);
              const m = hpInfoMatch ? hpInfoMatch[1].match(/^(.+?)\s+HP:\s*([\d,\-]+)\s*\((\d+)%\)$/) : null;
              return (
                <>
                  {healMatch && (
                    <span className="ml-4 inline-flex items-baseline gap-1 shrink-0">
                      <span className="font-body font-bold text-sm" style={{ color: C.heal }}>
                        체력
                      </span>
                      <span className="font-mono font-bold text-sm" style={{ color: C.heal }}>
                        {healMatch[1]}
                      </span>
                      <span className="font-body font-bold text-sm" style={{ color: C.heal }}>
                        회복
                      </span>
                    </span>
                  )}
                  {m && (
                    <span className="ml-auto inline-flex items-baseline gap-1 shrink-0 text-sm text-foreground/80">
                      <span className="font-body">(</span>
                      <span className="font-body font-bold" style={{ color: getNameColor(m[1]) }}>
                        {m[1]}
                      </span>
                      <span className="font-body">HP:</span>
                      <span className="font-mono font-bold">{m[2]}</span>
                      <span className="font-mono">({m[3]}%)</span>
                      <span className="font-body">)</span>
                    </span>
                  )}
                </>
              );
            })()
          ) : (entry.type === "event" && entry.detail.includes("헴마 스킬 발동")) ||
            entry.type === "lord_protect" ||
            (entry.type === "event" && entry.detail.includes("군주 보호")) ? (

            (() => {
              // Hemma drain — split into prefix + HP block tail
              const tailMatch = entry.detail.match(/^(.*?)\s*\(([^()]+?HP:\s*[\d,\-]+\s*\(\d+%\))\)\s*$/);
              const prefix = tailMatch ? tailMatch[1] : entry.detail;
              const hpBlock = tailMatch ? tailMatch[2] : "";
              const hpM = hpBlock.match(/^(.+?)\s+HP:\s*([\d,\-]+)\s*\((\d+)%\)$/);
              return (
                <>
                  <span className="ml-1 text-sm font-body text-foreground/80">{prefix}</span>
                  {hpM && (
                    <span className="ml-auto inline-flex items-baseline gap-1 shrink-0 text-sm text-foreground/80">
                      <span className="font-body">(</span>
                      <span className="font-body font-bold" style={{ color: getNameColor(hpM[1]) }}>
                        {hpM[1]}
                      </span>
                      <span className="font-body">HP:</span>
                      <span className="font-mono font-bold">{hpM[2]}</span>
                      <span className="font-mono">({hpM[3]}%)</span>
                      <span className="font-body">)</span>
                    </span>
                  )}
                </>
              );
            })()
          ) : entry.type === "monster_attack" && !entry.target ? (
            <span className="ml-1 text-sm font-body font-bold" style={{ color: C.red }}>
              {entry.detail.replace(/\s*\(.*?\)\s*$/, "")}
            </span>
          ) : isEvasion ? (
            <span className="font-body font-bold text-sm ml-4" style={{ color: C.teal }}>
              회피!
            </span>
          ) : (
            <span
              className={`ml-1 text-sm font-body ${
                isDeath
                  ? "text-red-300 font-bold"
                  : entry.type === "result"
                    ? entry.detail.includes("승리")
                      ? "text-lime-400 font-bold"
                      : "text-red-300 font-bold"
                    : "text-foreground/70"
              }`}

            >
              {entry.detail}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-[1.2fr_1fr] gap-4 h-[88vh]">
      {/* LEFT: Battlefield + Stats */}
      <div className="flex flex-col gap-2 overflow-hidden min-h-0">
        {/* Compact Battlefield */}
        <div className="relative bg-secondary/30 rounded-lg p-3 border border-border/30">
          <div className="text-center mb-2">
            <span className="text-xs text-muted-foreground">라운드</span>
            <span className="ml-1 text-lg font-bold font-mono text-foreground">{state.currentRound}</span>
            {effectiveIsResult && (
              <span className={`ml-3 text-sm font-bold ${effectiveIsWin ? "text-lime-400" : "text-red-400"}`}>
                {effectiveIsWin ? "승리!" : "패배"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Heroes — always reserve space for 5 slots */}
            <div className="flex-1">
              {Array.from({ length: 5 }).map((_, slotIdx) => {
                const h = activeHeroes[slotIdx];
                if (!h) {
                  return <div key={`empty-${slotIdx}`} className="h-[52px]" />;
                }

                const hp = state.heroHp[h.name] ?? h.hp ?? 0;
                const maxHp = state.heroMaxHp[h.name] || h.hp || 1;
                const hpPct = Math.max(0, (hp / maxHp) * 100);
                const isDead = hp <= 0;
                const effect = state.actionEffects.find((e) => e.target === h.name);
                const heroImg =
                  h.type === "champion"
                    ? getChampionImagePath(h.championName || h.name)
                    : h.heroClass
                      ? getJobImagePath(h.heroClass)
                      : null;
                const isFiltered = filter?.name === h.name;

                return (
                  <div
                    key={h.id}
                    className={`flex items-center gap-1.5 p-1 rounded cursor-pointer transition-all h-[52px] ${isDead ? "opacity-30" : ""} ${isFiltered ? "ring-2 ring-primary bg-primary/10" : "hover:bg-secondary/20"}`}
                    onClick={() => handleFilterClick(h.name)}
                  >
                    <div
                      className={`w-8 h-8 rounded-full overflow-hidden bg-secondary/50 shrink-0 ${isFiltered ? "ring-2 ring-primary" : "border border-border/50"}`}
                    >
                      {heroImg && <img src={heroImg} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        {/* HP value — shifts left when effect is showing */}
                        <span className="text-xs font-bold truncate" style={{ color: getNameColor(h.name) }}>
                          {h.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {effect && (
                            <span className={`text-[11px] font-bold font-mono ${effect.color} animate-bounce`}>
                              {effect.value}
                            </span>
                          )}
                          <span className="text-xs font-bold font-mono" style={{ color: hpColor(hpPct) }}>
                            {Math.round(hp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${hpPct}%`, backgroundColor: hpColor(hpPct) }}
                        />
                      </div>
                    </div>
                    {isFiltered && <span className="text-[10px] text-primary shrink-0">🔍</span>}
                  </div>
                );
              })}
            </div>

            {/* VS — vertically centered against 5-slot hero area */}
            <div className="flex items-center justify-center shrink-0" style={{ height: `${5 * 52}px` }}>
              <span className="text-lg text-muted-foreground/30">⚔</span>
            </div>

            {/* Monster — fixed height matching 5-slot hero area, centered */}
            <div
              className={`w-36 shrink-0 cursor-pointer transition-all flex items-center justify-center ${filter?.name === monsterName ? "ring-2 ring-primary rounded-lg" : ""}`}
              style={{ height: `${5 * 52}px` }}
              onClick={() => handleFilterClick(monsterName)}
            >
              {/* Fixed-size inner box — pre-reserves space for damage readout to prevent resize */}
              <div
                className={`w-full p-2.5 rounded-lg border bg-yellow-500/5 ${filter?.name === monsterName ? "border-primary" : "border-yellow-500/20"} ${state.mobHpCurrent <= 0 ? "opacity-30" : ""}`}
                style={{ minHeight: "140px" }}
              >
                <div className="flex justify-center mb-1">
                  {monsterImage ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary/40 border border-yellow-500/30">
                      <img src={monsterImage} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <span className="text-2xl">👹</span>
                  )}
                </div>
                <div className="text-center mb-1.5">
                  <span className="text-xs font-bold" style={{ color: C.monster }}>
                    {monsterName}
                  </span>
                </div>
                {/* HP value row */}
                <div className="flex items-center justify-center mb-0.5" style={{ minHeight: "18px" }}>
                  <span className="text-xs font-bold font-mono" style={{ color: hpColor(mobHpPct) }}>
                    {Math.max(0, Math.round(state.mobHpCurrent)).toLocaleString()}
                  </span>
                </div>
                {/* Damage effect — below HP value, separate row, fixed-height to avoid layout shift */}
                <div className="flex items-center justify-center mb-1" style={{ minHeight: "16px" }}>
                  {state.actionEffects.find((e) => e.target === "__monster__") && (
                    <span
                      className={`text-xs font-bold font-mono ${state.actionEffects.find((e) => e.target === "__monster__")!.color} animate-bounce`}
                    >
                      {state.actionEffects.find((e) => e.target === "__monster__")!.value}
                    </span>
                  )}
                </div>
                {/* Reserve a fixed line for the filter badge so it never causes resize */}
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${mobHpPct}%`, backgroundColor: hpColor(mobHpPct) }}
                  />
                </div>
                <div style={{ minHeight: "16px" }} className="flex items-center justify-center">
                  {filter?.name === monsterName && <span className="text-[10px] text-primary">🔍 필터</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls moved into log header (right column) */}

        {/* Combat Stats - premium */}
        <div className="mt-4 rounded-lg border border-primary/20 bg-gradient-to-br from-secondary/40 via-background/40 to-secondary/30 p-2.5 flex-1 overflow-y-auto min-h-0 shrink shadow-[0_4px_20px_-12px_hsl(var(--primary)/0.4)]">
          <div className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span>전투 통계</span>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr
                className={`border-b-2 border-primary/30 ${isLight ? "bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" : "bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20"}`}
              >
                <th
                  className={`text-center py-1.5 px-1 ${isLight ? "text-slate-700" : "text-muted-foreground"} font-bold w-[80px]`}
                >
                  파티원
                </th>
                <th className={`text-center py-1.5 px-1 ${isLight ? "text-red-700" : "text-red-400"} font-bold`}>
                  입힌 대미지
                </th>
                <th className={`text-center py-1.5 px-1 ${isLight ? "text-orange-700" : "text-orange-400"} font-bold`}>
                  대미지 비율
                </th>
                <th className={`text-center py-1.5 px-1 ${isLight ? "text-yellow-700" : "text-yellow-400"} font-bold`}>
                  타켓팅 수
                </th>
                <th className={`text-center py-1.5 px-1 ${isLight ? "text-teal-700" : "text-teal-400"} font-bold`}>
                  회피 수
                </th>
                <th className={`text-center py-1.5 px-1 ${isLight ? "text-blue-700" : "text-blue-400"} font-bold`}>
                  탱킹 비율
                </th>
              </tr>
            </thead>
            <tbody>
              {heroStatsData.map((hs, idx) => {
                // Same color tiers as QuestSimulation contribution bars
                const tierText = (pct: number) =>
                  pct >= 81
                    ? isLight
                      ? "text-lime-700"
                      : "text-lime-400"
                    : pct >= 61
                      ? isLight
                        ? "text-yellow-700"
                        : "text-yellow-400"
                      : pct >= 41
                        ? isLight
                          ? "text-orange-700"
                          : "text-orange-400"
                        : pct >= 21
                          ? isLight
                            ? "text-red-700"
                            : "text-red-400"
                          : isLight
                            ? "text-purple-700"
                            : "text-purple-400";
                return (
                  <tr key={hs.name} className={`border-b border-border/10 ${idx % 2 === 0 ? "bg-secondary/10" : ""}`}>
                    <td
                      className="py-1.5 px-1 font-bold truncate max-w-[80px] text-center text-xs"
                      style={{ color: getNameColor(hs.name) }}
                    >
                      {hs.name}
                    </td>
                    <td
                      className={`py-1.5 px-1 text-center font-mono font-bold text-xs ${isLight ? "text-red-700" : "text-red-400"}`}
                    >
                      {formatNumber(hs.dmg)}
                    </td>
                    <td className={`py-1.5 px-1 text-center font-mono font-bold text-xs ${tierText(hs.dmgPct)}`}>
                      {hs.dmgPct.toFixed(1)}%
                    </td>
                    <td
                      className={`py-1.5 px-1 text-center font-mono font-bold text-xs ${isLight ? "text-yellow-700" : "text-yellow-400"}`}
                    >
                      {hs.targeted}
                    </td>
                    <td
                      className={`py-1.5 px-1 text-center font-mono font-bold text-xs ${isLight ? "text-teal-700" : "text-teal-400"}`}
                    >
                      {hs.dodged}
                    </td>
                    <td className={`py-1.5 px-1 text-center font-mono font-bold text-xs ${tierText(hs.tankPct)}`}>
                      {hs.tankPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
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
            <button
              onClick={() => setFilter(null)}
              className="ml-1 text-muted-foreground hover:text-foreground text-sm"
            >
              ✕
            </button>
          </div>
        )}

        <div
          ref={logScrollRef}
          className="overflow-y-auto rounded-lg border border-primary/20 bg-gradient-to-br from-secondary/30 via-background/30 to-secondary/20 flex-1 min-h-0 shadow-[0_4px_20px_-12px_hsl(var(--primary)/0.4)]"
        >
          {/* Controls inside log box — playback + new battle + filter all in one row */}
          <div className="sticky top-0 z-20 flex items-center gap-1 px-2 py-1 bg-secondary/80 backdrop-blur-sm border-b border-primary/20 flex-wrap">
            {onNewBattle && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1 h-6 px-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                onClick={() => {
                  onNewBattle();
                  setCurrentIdx(0);
                  setPlaying(false);
                }}
                title="새 전투"
              >
                <Dices className="w-3 h-3" /> 새 전투
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-7 p-0"
              onClick={() => {
                setCurrentIdx(0);
                setPlaying(false);
              }}
              title="새로고침 (처음으로)"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-7 p-0"
              onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
              title="이전"
            >
              <SkipBack className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 w-[68px]"
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span className="ml-1 text-xs">{playing ? "정지" : "재생"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-7 p-0"
              onClick={() => setCurrentIdx(Math.min(log.length - 1, currentIdx + 1))}
              title="다음"
            >
              <SkipForward className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-7 p-0"
              onClick={() => {
                setCurrentIdx(log.length - 1);
                setPlaying(false);
              }}
              title="진행 완료 (끝까지)"
            >
              <FastForward className="w-3 h-3" />
            </Button>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="text-xs bg-secondary border border-border rounded px-1.5 h-6 text-foreground"
            >
              <option value={1000}>0.5x</option>
              <option value={500}>1x</option>
              <option value={250}>2x</option>
              <option value={100}>4x</option>
            </select>
            <span className="text-[10px] text-muted-foreground ml-1">
              {currentIdx + 1}/{log.length}
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1 h-6 w-7 p-0 ml-auto"
                  title="표시 항목 선택"
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
                  <span className="text-sm font-bold">로그 표시 항목</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                      onClick={() => setVisibleCategories(new Set(ALL_CATEGORIES.map((c) => c.key)))}
                    >
                      전체
                    </button>
                    <span className="text-[10px] text-muted-foreground">/</span>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                      onClick={() => setVisibleCategories(new Set())}
                    >
                      해제
                    </button>
                  </div>
                </div>
                <div
                  className="max-h-72 overflow-y-auto py-1"
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                  onWheelCapture={(e) => {
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {ALL_CATEGORIES.map((c) => {
                    const checked = visibleCategories.has(c.key);
                    return (
                      <label
                        key={c.key}
                        className="flex items-start gap-2 px-3 py-1.5 hover:bg-secondary/40 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-primary"
                          checked={checked}
                          onChange={() => toggleCategory(c.key)}
                        />
                        <span className="leading-tight">{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {roundGroups.map((group, gIdx) => {
            // ── Retry separator group ──────────────────────────────────────
            if (group.isRetry) {
              const { entry, idx } = group.entries[0];
              if (!isCategoryVisible(entry)) return null;
              return <div key={`retry-${gIdx}`}>{renderLogEntry(entry, idx)}</div>;
            }

            if (filter && !isRoundRelevant(group)) return null;
            const visibleEntries = group.entries.filter(({ entry }) => isCategoryVisible(entry));
            if (visibleEntries.length === 0) return null;

            return (
              <div key={`${group.round}-${gIdx}`} className="border-b border-border/20">
                {/* Round header */}
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 border-b ${
                    group.isAfterRetry
                      ? isLight
                        ? "bg-gradient-to-r from-red-500/15 via-red-500/8 to-transparent border-red-400/30"
                        : "bg-gradient-to-r from-red-500/25 via-red-500/12 to-transparent border-red-500/30"
                      : isLight
                        ? "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20"
                        : "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-primary/30"
                  }`}
                >
                  <span
                    className={`text-sm font-bold ${
                      group.isAfterRetry
                        ? isLight
                          ? "text-red-600"
                          : "text-red-400"
                        : isLight
                          ? "text-primary"
                          : "text-foreground"
                    }`}
                  >
                    라운드 {group.round}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{visibleEntries.length}건</span>
                </div>
                {visibleEntries.map(({ entry, idx }) => {
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
