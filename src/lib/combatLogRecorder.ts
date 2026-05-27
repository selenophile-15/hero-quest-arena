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

function formatNum(n: number): string {
  return Math.round(n).toLocaleString();
}

function toLegacyCombatLog(
  entries: CombatLogEntry[],
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

  for (const entry of entries) {
    const values = entry.values ?? {};

    if (entry.type === "stat" && entry.detail.includes("몬스터 스탯")) {
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

    if (entry.type === "stat") {
      legacy.push({ ...entry, type: "event" });
      continue;
    }

    if (entry.type === "attack" || entry.type === "crit") {
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
        actor: entry.actor,
        target: monsterName,
        detail: `${entry.type === "crit" ? "치명타" : "공격"} ${formatNum(dmg)} 피해 (${hpText(
          monsterName,
          mobHp,
          mobMaxHp,
        )})`,
        values,
      });
      continue;
    }

    if (entry.type === "damage") {
      const targetName = entry.target ?? entry.actor;
      const dmg = typeof values.dmg === "number" ? values.dmg : 0;
      const hp = typeof values.hp === "number" ? values.hp : 0;
      const maxHp = typeof values.maxHp === "number" ? values.maxHp : 0;

      if (entry.detail.includes("헴마 드레인")) {
        legacy.push({
          round: entry.round,
          type: "event",
          actor: targetName,
          detail: `헴마 스킬 발동: ${targetName} HP -${formatNum(dmg)} (${hpText(targetName, hp, maxHp)})`,
          values,
        });
        continue;
      }

      if (entry.detail.includes("군주") || entry.detail.includes("치명타 생존")) {
        legacy.push({
          round: entry.round,
          type: "event",
          actor: targetName,
          detail: entry.detail,
          values,
        });
        continue;
      }

      const isAoe = entry.detail.includes("[광역]") || entry.detail.includes("광역");
      const isCrit = entry.detail.includes("치명");

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

    if (entry.type === "dodge") {
      const targetName = entry.target ?? entry.actor;
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

    if (entry.type === "death") {
      legacy.push({
        round: entry.round,
        type: "event",
        actor: entry.actor,
        detail: "사망",
        values,
      });
      continue;
    }

    if (entry.type === "heal") {
      const heal = typeof values.heal === "number" ? values.heal : 0;
      const hp = typeof values.hp === "number" ? values.hp : 0;
      const maxHp = typeof values.maxHp === "number" ? values.maxHp : 0;
      legacy.push({
        round: entry.round,
        type: "heal",
        actor: entry.actor,
        detail: `체력 ${formatNum(heal)} 회복 (${hpText(entry.actor, hp, maxHp)})`,
        values,
      });
      continue;
    }

    // AoE 광역 공격 배너: monster_attack(no target) 로 변환해 빨간 볼드 + 몬스터 아이콘으로 렌더
    if (entry.type === "event" && entry.actor === "몬스터" && entry.detail === "광역 공격") {
      legacy.push({
        round: entry.round,
        type: "monster_attack",
        actor: monsterName,
        detail: "광역 공격",
        values,
      });
      continue;
    }

    legacy.push(entry);
  }

  return legacy;
}

export function runSingleCombatLog(config: SimulationConfig): CombatLogEntry[] {
  const firstResult = runCombatSimulation({
    ...config,
    recordEvents: true,
    simulationCount: 1,
    _disableRetry: true,
  });
  const firstRawLog = firstResult.eventLog ?? [
    { round: 0, type: "result" as const, actor: "시스템", detail: "이벤트 로그 없음" },
  ];

  const mobDisplayName = firstRawLog.find((e) => e.type === "stat" && e.detail.includes("몬스터 스탯"))?.actor;
  const firstLegacy = toLegacyCombatLog(firstRawLog, config, mobDisplayName);

  const firstWon = firstRawLog.some((e) => e.type === "result" && e.detail.includes("승리"));
  const activeHeroes = config.heroes.filter((h) => h.hp > 0);
  const hasFateweaver = activeHeroes.some((h) => isClass(h, "페이트위버", "운명직공", "Fateweaver"));
  const hasChronos = !hasFateweaver && activeHeroes.some((h) => isClass(h, "크로노맨서", "Chronomancer"));

  if (!firstWon && (hasFateweaver || hasChronos)) {
    const retryConfig: SimulationConfig = {
      ...config,
      recordEvents: true,
      simulationCount: 1,
      _isRetry: true,
      _disableRetry: true,
      booster: hasFateweaver ? getRetryBooster(config.booster) : config.booster,
    };
    const retryResult = runCombatSimulation(retryConfig);
    const retryRawLog = retryResult.eventLog ?? [];

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
