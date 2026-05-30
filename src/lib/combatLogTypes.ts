export interface CombatLogEntry {
  round: number;
  type:
    | "attack"
    | "crit"
    | "damage"
    | "dodge"
    | "heal"
    | "death"
    | "stat"
    | "event"
    | "result"
    | "retry"
    | "monster_attack"
    | "hero_attack"
    | "execute"
    | "lord_protect"
    | "crit_survival"
    | "conqueror_pre"
    | "hemma_atk_gain"
    | "rudo_start"
    | "rudo_end"
    | "ninja_loss"
    | "sensei_recovery"
    | "acrobat_crit"
    | "dino_end";
  actor: string;
  target?: string;
  detail: string;
  values?: Record<string, number | string>;
}

export type RawCombatEventKind = CombatLogEntry["type"] | "empty_party";

export interface RawCombatEvent {
  kind: RawCombatEventKind;
  round: number;
  code?: string;
  actor?: string;
  target?: string;
  detail?: string;
  values?: Record<string, number | string>;
}
