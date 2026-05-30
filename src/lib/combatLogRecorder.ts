/**
 * Combat Log Recorder
 *
 * 1회 전투로그 전용 표시/포맷 모듈.
 *
 * 전투 계산은 절대 다시 수행하지 않는다. 메인 엔진(`runCombatSimulation`)을
 * `recordEvents: true, simulationCount: 1`로 실행해 얻은 raw 이벤트 로그를,
 * 원본 `CombatBattlefield` UI가 기대하는 legacy log 형식으로 변환하기만 한다.
 *
 * 페이트위버/크로노맨서 재시도 처리도 여기서 담당(엔진 내부 retry는 비활성화).
 */

import {
  runCombatSimulation,
  isClass,
  getRetryBooster,
  type CombatLogEntry,
  type SimulationConfig,
} from "@/lib/combatSimulation";
import type { RawCombatEvent } from "@/lib/combatLogTypes";

function formatNum(n: number): string {
  return Math.round(n).toLocaleString();
}

function toLegacyCombatLog(
  entries: RawCombatEvent[],
  config: SimulationConfig,
  _mobDisplayName?: string,
): CombatLogEntry[] {
  // 로그 표기상의 몬스터 이름은 미니보스 접두어와 무관하게 항상 "몬스터"로 통일.
  // (엔진 내부의 실제 스탯/계산은 그대로 유지)
  const monsterName = "몬스터";

  const pct = (hp: number, maxHp: number): number => {
    if (!maxHp || maxHp <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
  };

  const hpText = (name: string, hp: number, maxHp: number): string => {
    return `${name} HP: ${formatNum(Math.max(0, hp))} (${pct(hp, maxHp)}%)`;
  };

  const legacy: CombatLogEntry[] = [];
  let actualMonsterMaxHp = config.monster.hp;
  const activeHeroes = config.heroes.filter((h) => h.hp > 0);
  const heroName = (idx: number): string => activeHeroes[idx]?.name || `영웅 ${idx + 1}`;
  const num = (values: Record<string, number | string>, key: string, fallback = 0): number =>
    typeof values[key] === "number" ? (values[key] as number) : fallback;
  const str = (values: Record<string, number | string>, key: string, fallback = ""): string =>
    typeof values[key] === "string" ? (values[key] as string) : fallback;
  const hasHeroIndex = (values: Record<string, number | string>): boolean => typeof values.heroIndex === "number";

  for (const entry of entries) {
    const values = entry.values ?? {};

    if (entry.kind === "empty_party") {
      legacy.push({ round: entry.round, type: "result", actor: "시스템", detail: "활성 영웅 없음" });
      continue;
    }

    if (entry.kind === "stat" && entry.code === "monster_stat") {
      const hp = typeof values.hp === "number" ? values.hp : config.monster.hp;
      actualMonsterMaxHp = hp;
      legacy.push({
        round: entry.round,
        type: "event",
        actor: "시스템",
        detail: `전투 시작!`,
        values,
      });
      continue;
    }

    if (entry.kind === "stat" && entry.code === "hero_stat") {
      const heroIndex = num(values, "heroIndex");
      const atk = num(values, "atk");
      const def = num(values, "def");
      const hp = num(values, "hp");
      legacy.push({
        round: entry.round,
        type: "event",
        actor: heroName(heroIndex),
        detail: `ATK ${formatNum(atk)} / DEF ${formatNum(def)} / HP ${formatNum(hp)} / 치확 ${num(values, "critPct")}% / 치댐 ${formatNum(num(values, "critDmg"))} / 회피 ${num(values, "evasionPct")}%`,
        values: { atk, def, hp },
      });
      continue;
    }

    if (entry.kind === "attack" || entry.kind === "crit") {
      const dmg = typeof values.dmg === "number" ? values.dmg : 0;
      const mobHp =
        typeof values.mobHp === "number"
          ? values.mobHp
          : typeof values.mobMaxHp === "number"
            ? values.mobMaxHp
            : actualMonsterMaxHp;
      const mobMaxHp = typeof values.mobMaxHp === "number" ? values.mobMaxHp : actualMonsterMaxHp;

      legacy.push({
        round: entry.round,
        type: "hero_attack",
        actor: heroName(num(values, "heroIndex")),
        target: monsterName,
        detail: `${entry.kind === "crit" ? "치명타" : "공격"} ${formatNum(dmg)} 피해 (${hpText(
          monsterName,
          mobHp,
          mobMaxHp,
        )})`,
        values,
      });
      continue;
    }

    if (entry.kind === "damage") {
      const targetName = heroName(num(values, "heroIndex"));
      const dmg = typeof values.dmg === "number" ? values.dmg : 0;
      const hp = typeof values.hp === "number" ? values.hp : 0;
      const maxHp = typeof values.maxHp === "number" ? values.maxHp : 0;

      if (entry.code === "hemma_drain") {
        legacy.push({
          round: entry.round,
          type: "event",
          actor: targetName,
          detail: `헴마 스킬 발동: ${targetName} HP -${formatNum(dmg)} (${hpText(targetName, hp, maxHp)})`,
          values,
        });
        continue;
      }

      if (entry.code === "crit_survival") {
        const isAoe = num(values, "isAoe") === 1;
        const isCrit = num(values, "isCrit") === 1;
        legacy.push({
          round: entry.round,
          type: "event",
          actor: targetName,
          detail: `[${isAoe ? "광역" : `단일${isCrit ? " 치명" : ""}`}] 치명타 생존 (${formatNum(dmg)} 무효화)`,
          values,
        });
        continue;
      }

      const isAoe = num(values, "isAoe") === 1;
      const isCrit = num(values, "isCrit") === 1;

      legacy.push({
        round: entry.round,
        type: "monster_attack",
        actor: monsterName,
        target: targetName,
        detail: `${isAoe ? "광역 공격 " : ""}${isCrit ? "치명타 " : ""}${formatNum(dmg)} 피해 (${hpText(
          targetName,
          hp,
          maxHp,
        )})`,
        values,
      });
      continue;
    }

    if (entry.kind === "dodge") {
      const targetName = heroName(num(values, "heroIndex"));
      legacy.push({
        round: entry.round,
        type: "event",
        actor: monsterName,
        target: targetName,
        detail: "회피",
        values,
      });
      continue;
    }

    if (entry.kind === "death") {
      legacy.push({
        round: entry.round,
        type: "event",
        actor: heroName(num(values, "heroIndex")),
        detail: "사망",
        values,
      });
      continue;
    }

    if (entry.kind === "heal") {
      const actor = heroName(num(values, "heroIndex"));
      const heal = typeof values.heal === "number" ? values.heal : 0;
      const hp = typeof values.hp === "number" ? values.hp : 0;
      const maxHp = typeof values.maxHp === "number" ? values.maxHp : 0;
      legacy.push({
        round: entry.round,
        type: "heal",
        actor,
        detail: `체력 ${formatNum(heal)} 회복 (${hpText(actor, hp, maxHp)})`,
        values,
      });
      continue;
    }

    if (entry.kind === "lord_protect") {
      const actor = heroName(num(values, "heroIndex"));
      legacy.push({
        round: entry.round,
        type: "lord_protect",
        actor,
        target: heroName(num(values, "targetIndex")),
        detail: `군주 보호: ${formatNum(num(values, "lordDmg"))} 피해 대신 받음 (${hpText(
          actor,
          num(values, "lordHp"),
          num(values, "lordMaxHp"),
        )})`,
        values,
      });
      continue;
    }

    if (entry.kind === "event" && entry.code === "monster_aoe") {
      legacy.push({
        round: entry.round,
        type: "monster_attack",
        actor: monsterName,
        detail: "광역 공격",
        values,
      });
      continue;
    }

    const heroIndex = num(values, "heroIndex");
    const actor = entry.actor || (hasHeroIndex(values) ? heroName(heroIndex) : "시스템");
    const eventDetail = (() => {
      switch (entry.code) {
        case "barrier_fail":
          return `원소 배리어 미돌파! 대미지 ${num(values, "barrierModPct")}%로 제한`;
        case "barrier_success":
          return `원소 배리어 돌파! (${num(values, "heroSum")} ≥ ${num(values, "required")})`;
        case "mini_boss": {
          const bonusList: string[] = [];
          if (num(values, "hpMod", 1) !== 1) bonusList.push(`HP ×${num(values, "hpMod", 1)}`);
          if (num(values, "damageMod", 1) !== 1) bonusList.push(`ATK ×${num(values, "damageMod", 1)}`);
          if (num(values, "critChanceMod", 1) !== 1) bonusList.push(`치확 ×${num(values, "critChanceMod", 1)}`);
          if (num(values, "aoeChanceMod", 1) !== 1) bonusList.push(`광역 공격 확률 ×${num(values, "aoeChanceMod", 1)}`);
          if (num(values, "evasionPct") > 0) bonusList.push(`회피 ${num(values, "evasionPct")}%`);
          return `미니보스: ${str(values, "label")}${bonusList.length ? ` (${bonusList.join(", ")})` : ""}`;
        }
        case "daimyo_first_turn":
          return "다이묘 첫 턴 보너스: 첫 공격 치명타 확정 / 첫 피격 회피 확정";
        case "berserker_stage":
          return `광전사/잘 ${num(values, "stage")}단계 진입 (+ATK ${num(values, "atkBonus")}%, +EVA ${num(values, "evaBonus")}%)`;
        case "dino_start":
          return `공룡 영혼: 첫 턴 +${num(values, "bonusPct")}% 공격력 보너스`;
        case "conqueror_reset":
          return `정복자 스택 리셋 (${num(values, "from")}중첩 → 0중첩)`;
        case "shark_start":
          return `상어 영혼 활성화 (몬스터 HP 50% 이하, +${num(values, "bonusPct")}% 공격력)`;
        case "polonia_steal":
          return `폴로니아 훔치기 성공: ${num(values, "stolen")} / ${num(values, "cap")}개`;
        default:
          return entry.detail || "";
      }
    })();

    if (entry.kind === "event") {
      legacy.push({ round: entry.round, type: "event", actor, detail: eventDetail, values });
      continue;
    }

    if (entry.kind === "result") {
      const outcome = str(values, "outcome");
      if (!outcome && entry.detail) {
        legacy.push({ round: entry.round, type: "result", actor: "시스템", detail: entry.detail, values });
        continue;
      }
      const detail =
        outcome === "win"
          ? `승리! (${num(values, "round", entry.round)}턴)`
          : outcome === "lose_limit"
            ? `패배 — 턴 한도 초과 (${num(values, "round", entry.round)}턴)`
            : `패배 — 전원 사망 (${num(values, "round", entry.round)}턴)`;
      legacy.push({ round: entry.round, type: "result", actor: "시스템", detail, values });
      continue;
    }

    if (entry.kind === "rudo_start") {
      legacy.push({
        round: entry.round,
        type: "rudo_start",
        actor,
        detail: `루도 보너스 발동 (${num(values, "rounds")}라운드 지속, +치명타 확률 ${num(values, "bonusPct")}%)`,
        values,
      });
      continue;
    }
    if (entry.kind === "rudo_end") {
      legacy.push({ round: entry.round, type: "rudo_end", actor, detail: `루도 보너스 종료 (-치명타 확률 ${num(values, "bonusPct")}%)`, values });
      continue;
    }
    if (entry.kind === "sensei_recovery") {
      legacy.push({ round: entry.round, type: "sensei_recovery", actor, detail: `센세 보너스 회복 (+치명타 확률 ${num(values, "bonusPct")}%, +회피 ${num(values, "evaPct")}%)`, values });
      continue;
    }
    if (entry.kind === "ninja_loss") {
      legacy.push({ round: entry.round, type: "ninja_loss", actor, detail: `${num(values, "isSensei") === 1 ? "센세" : "닌자"} 보너스 상실 (-치명타 확률 ${num(values, "bonusPct")}%, -회피 ${num(values, "evaPct")}%)`, values });
      continue;
    }
    if (entry.kind === "acrobat_crit") {
      legacy.push({ round: entry.round, type: "acrobat_crit", actor, detail: "곡예가 보너스 발동: 다음 공격 치명타 확정", values });
      continue;
    }
    if (entry.kind === "conqueror_pre") {
      const stack = num(values, "stack");
      legacy.push({ round: entry.round, type: "conqueror_pre", actor, detail: `정복자 고유 스킬 스택: ${stack}중첩${stack >= 4 ? "(최대)" : ""}`, values });
      continue;
    }
    if (entry.kind === "hemma_atk_gain") {
      legacy.push({ round: entry.round, type: "hemma_atk_gain", actor, detail: `헴마 공격력 +${formatNum(num(values, "gain"))} (+누적 ${formatNum(num(values, "total"))})`, values });
      continue;
    }
    if (entry.kind === "dino_end") {
      legacy.push({ round: entry.round, type: "dino_end", actor, detail: "공룡 영혼 종료", values });
      continue;
    }

    legacy.push({ round: entry.round, type: "event", actor, detail: entry.detail || "", values });
  }

  return legacy;
}

export function runSingleCombatLog(config: SimulationConfig): CombatLogEntry[] {
  const firstRawLog: RawCombatEvent[] = [];
  runCombatSimulation({
    ...config,
    simulationCount: 1,
    _disableRetry: true,
    onEvent: (event) => firstRawLog.push(event),
  });
  if (firstRawLog.length === 0) firstRawLog.push({ round: 0, kind: "result", detail: "이벤트 로그 없음" });

  const mobDisplayName = firstRawLog.find((e) => e.kind === "stat" && e.code === "monster_stat")?.actor;
  const firstLegacy = toLegacyCombatLog(firstRawLog, config, mobDisplayName);

  const firstWon = firstRawLog.some((e) => e.kind === "result" && e.values?.outcome === "win");
  const activeHeroes = config.heroes.filter((h) => h.hp > 0);
  const hasFateweaver = activeHeroes.some((h) => isClass(h, "페이트위버", "운명직공", "Fateweaver"));
  const hasChronos = !hasFateweaver && activeHeroes.some((h) => isClass(h, "크로노맨서", "Chronomancer"));

  if (!firstWon && (hasFateweaver || hasChronos)) {
    const retryConfig: SimulationConfig = {
      ...config,
      simulationCount: 1,
      _isRetry: true,
      _disableRetry: true,
      booster: hasFateweaver ? getRetryBooster(config.booster) : config.booster,
    };
    const retryRawLog: RawCombatEvent[] = [];
    runCombatSimulation({
      ...retryConfig,
      recordEvents: false,
      onEvent: (event) => retryRawLog.push(event),
    });

    const lastRound = firstRawLog.length > 0 ? firstRawLog[firstRawLog.length - 1].round : 0;
    const retryBanner: CombatLogEntry = {
      round: lastRound,
      type: "retry",
      actor: hasFateweaver ? "페이트위버" : "크로노맨서",
      detail: hasFateweaver ? "페이트위버: 재시도 (+20% 보너스 적용)" : "크로노맨서: 재시도",
    };

    const retryLegacy = toLegacyCombatLog(retryRawLog, retryConfig, mobDisplayName);
    return [...firstLegacy, retryBanner, ...retryLegacy];
  }

  return firstLegacy;
}
