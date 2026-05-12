import type { Hero } from '@/types/game';

export interface SavedSimBarrierInfo {
  element: string;
  iconPath: string;
  partySum: number;
  required: number;
}

export interface SavedSimulationSummary {
  id: string;
  name: string;
  savedAt: number;
  // Quest config
  questTypeKey: string;
  regionIdx: number;
  subAreaIdx: number;
  questIdx: number;
  // Party
  heroIds: string[];
  booster: string;
  miniBoss: string;
  // Summary
  winRate: number;
  avgRounds: number;
  minRounds: number;
  maxRounds: number;
  // Display snapshots (captured at save time)
  questTypeLabel?: string;
  regionName?: string;
  subAreaName?: string;
  difficulty?: string;
  regionImage?: string;
  subAreaImage?: string;
  boosterImage?: string;
  boosterLabel?: string;
  miniBossLabel?: string;
  isBoss?: boolean;
  barrierInfos?: SavedSimBarrierInfo[];
  successCount?: number;
  failCount?: number;
  retryCount?: number;
  avgGearScore?: number;
  // Per-hero
  heroSummaries: {
    heroId: string;
    heroName: string;
    heroClass: string;
    survivalRate: number;
    avgDamageDealt: number;
    damageShare: number;
    tankingShare?: number;
    powerBelowMin?: boolean;
  }[];
  // Hero snapshots — used only when a hero no longer exists in the user's list
  heroSnapshots?: Hero[];
}

const STORAGE_KEY = 'quest-sim-saved-results';
export const SAVED_SIMULATIONS_UPDATED_EVENT = 'quest-sim-saved-results-updated';

function notifySavedSimulationsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SAVED_SIMULATIONS_UPDATED_EVENT));
  }
}

export function setSavedSimulations(list: SavedSimulationSummary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  notifySavedSimulationsUpdated();
}

export function getSavedSimulations(): SavedSimulationSummary[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveSimulationResult(sim: SavedSimulationSummary) {
  const list = getSavedSimulations();
  list.unshift(sim);
  setSavedSimulations(list);
}

export function overwriteSimulationResult(targetId: string, sim: SavedSimulationSummary) {
  const list = getSavedSimulations();
  const idx = list.findIndex(s => s.id === targetId);
  if (idx === -1) return;
  list[idx] = { ...sim, id: targetId };
  setSavedSimulations(list);
}

export function deleteSavedSimulation(id: string) {
  const list = getSavedSimulations().filter(s => s.id !== id);
  setSavedSimulations(list);
}

export function deleteAllSavedSimulations() {
  localStorage.removeItem(STORAGE_KEY);
  notifySavedSimulationsUpdated();
}
