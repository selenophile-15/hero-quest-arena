import { Hero, SimulationResult } from '@/types/game';

const HEROES_KEY = 'quest-sim-heroes';
const SIMULATIONS_KEY = 'quest-sim-results';

export function getHeroes(): Hero[] {
  const data = localStorage.getItem(HEROES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveHeroes(heroes: Hero[]) {
  localStorage.setItem(HEROES_KEY, JSON.stringify(heroes));
}

export function addHero(hero: Hero) {
  const heroes = getHeroes();
  heroes.push(hero);
  saveHeroes(heroes);
}

export function updateHero(hero: Hero) {
  const heroes = getHeroes();
  const idx = heroes.findIndex(h => h.id === hero.id);
  if (idx !== -1) {
    heroes[idx] = hero;
    saveHeroes(heroes);
  }
}

export function deleteHero(id: string) {
  const heroes = getHeroes().filter(h => h.id !== id);
  saveHeroes(heroes);
}

export function getSimulations(): SimulationResult[] {
  const data = localStorage.getItem(SIMULATIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveSimulation(result: SimulationResult) {
  const results = getSimulations();
  results.push(result);
  localStorage.setItem(SIMULATIONS_KEY, JSON.stringify(results));
}
