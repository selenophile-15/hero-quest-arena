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
  // Per-hero
  heroSummaries: {
    heroId: string;
    heroName: string;
    heroClass: string;
    survivalRate: number;
    avgDamageDealt: number;
    damageShare: number;
  }[];
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

export function deleteSavedSimulation(id: string) {
  const list = getSavedSimulations().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function deleteAllSavedSimulations() {
  localStorage.removeItem(STORAGE_KEY);
}
