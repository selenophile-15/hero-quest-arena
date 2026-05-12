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
  miniBossLabel?: string;
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

export function getSavedSimulations(): SavedSimulationSummary[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveSimulationResult(sim: SavedSimulationSummary) {
  const list = getSavedSimulations();
  list.unshift(sim);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function overwriteSimulationResult(targetId: string, sim: SavedSimulationSummary) {
  const list = getSavedSimulations();
  const idx = list.findIndex(s => s.id === targetId);
  if (idx === -1) return;
  list[idx] = { ...sim, id: targetId };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function deleteSavedSimulation(id: string) {
  const list = getSavedSimulations().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function deleteAllSavedSimulations() {
  localStorage.removeItem(STORAGE_KEY);
}
