// THE RANCH — Outside threat: zombie perimeter system.
// Atmospheric only. Zombies wander outside the settlement, never attack,
// never path to survivors. Designed to be expanded later (threat levels,
// walls, patrols, attacks).

import { create } from "zustand";
import { toast } from "sonner";
import { useGame } from "./store";
import type { Territory } from "./types";

export interface Zombie {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pauseTicks: number;   // ms remaining to stand still
  redirectIn: number;   // ms until next direction change
  seed: number;         // for art variance
}

interface ZombieState {
  zombies: Zombie[];
  lastSpawnAt: number;
  lastFlavorAt: number;
  tick: (
    dtMs: number,
    opts: {
      mapW: number;
      mapH: number;
      territory: Territory | null;
      speed: number;
      screen: string;
    },
  ) => void;
  reset: () => void;
}

const MIN_COUNT = 30;
const MAX_COUNT = 60;
const SPAWN_COOLDOWN_MS = 1200;
const FLAVOR_COOLDOWN_MS = 90_000;
const WANDER_SPEED = 0.0004;
const REDIRECT_MIN = 2500;
const REDIRECT_MAX = 7000;

function rand() { return Math.random(); }

function inSettlement(x: number, y: number, t: Territory | null, buffer = 6): boolean {
  if (!t || t.radius <= 0) return false;
  const halfW = (t.halfW ?? t.radius) + buffer;
  const halfH = (t.halfH ?? t.radius) + buffer;
  return Math.abs(x - t.cx) <= halfW && Math.abs(y - t.cy) <= halfH;
}

function pickSpawnPoint(mapW: number, mapH: number, t: Territory | null): { x: number; y: number } | null {
  // Spawn anywhere on the map that isn't inside the ranch perimeter.
  for (let i = 0; i < 20; i++) {
    const x = 2 + rand() * (mapW - 4);
    const y = 2 + rand() * (mapH - 4);
    if (!inSettlement(x, y, t, 4)) return { x, y };
  }
  return null;
}

let _id = 0;
function spawnZombie(x: number, y: number): Zombie {
  const angle = rand() * Math.PI * 2;
  return {
    id: `z${++_id}_${Date.now().toString(36)}`,
    x, y,
    vx: Math.cos(angle) * WANDER_SPEED,
    vy: Math.sin(angle) * WANDER_SPEED,
    pauseTicks: 0,
    redirectIn: REDIRECT_MIN + rand() * (REDIRECT_MAX - REDIRECT_MIN),
    seed: Math.floor(rand() * 1000),
  };
}

const FLAVOR_LINES = [
  "I saw something moving outside the Ranch.",
  "There are more walkers near the woods.",
  "I don't like what's out there.",
  "Heard a moan past the treeline last night.",
  "Something's wandering the old road again.",
];

export const useZombies = create<ZombieState>((set, get) => ({
  zombies: [],
  lastSpawnAt: 0,
  lastFlavorAt: 0,

  reset: () => set({ zombies: [], lastSpawnAt: 0, lastFlavorAt: 0 }),

  tick: (dtMs, { mapW, mapH, territory, speed, screen }) => {
    if (screen !== "game" || speed === 0) return;
    const now = performance.now();
    const dt = dtMs * (speed === 1 ? 1 : speed === 2 ? 1.6 : 2.4);

    const st = get();
    let zombies = st.zombies;

    // Update positions / behavior
    zombies = zombies.map((z) => {
      let { x, y, vx, vy, pauseTicks, redirectIn } = z;
      if (pauseTicks > 0) {
        pauseTicks -= dt;
      } else {
        x += vx * dt;
        y += vy * dt;
        redirectIn -= dt;
        if (redirectIn <= 0) {
          // Either pause briefly or pick a new heading.
          if (rand() < 0.35) {
            pauseTicks = 1200 + rand() * 2200;
          } else {
            const a = rand() * Math.PI * 2;
            vx = Math.cos(a) * WANDER_SPEED;
            vy = Math.sin(a) * WANDER_SPEED;
          }
          redirectIn = REDIRECT_MIN + rand() * (REDIRECT_MAX - REDIRECT_MIN);
        }
        // If they wander into the settlement, turn them back outward.
        if (inSettlement(x, y, territory, 4)) {
          const dx = x - (territory?.cx ?? mapW / 2);
          const dy = y - (territory?.cy ?? mapH / 2);
          const m = Math.hypot(dx, dy) || 1;
          vx = (dx / m) * WANDER_SPEED;
          vy = (dy / m) * WANDER_SPEED;
          // Nudge out
          x += vx * 200;
          y += vy * 200;
        }
        // Keep on map.
        if (x < 1 || x > mapW - 1) { vx = -vx; x = Math.max(1, Math.min(mapW - 1, x)); }
        if (y < 1 || y > mapH - 1) { vy = -vy; y = Math.max(1, Math.min(mapH - 1, y)); }
      }
      return { ...z, x, y, vx, vy, pauseTicks, redirectIn };
    });

    // Spawn / despawn management
    let lastSpawnAt = st.lastSpawnAt;
    // Fill up to MIN_COUNT immediately so the world never feels empty.
    while (zombies.length < MIN_COUNT) {
      const p = pickSpawnPoint(mapW, mapH, territory);
      if (!p) break;
      zombies = [...zombies, spawnZombie(p.x, p.y)];
      lastSpawnAt = now;
    }
    // Above MIN, drift toward a randomized desired count on a cooldown.
    const desired = MIN_COUNT + Math.floor(rand() * (MAX_COUNT - MIN_COUNT));
    if (zombies.length < desired && now - lastSpawnAt > SPAWN_COOLDOWN_MS) {
      const p = pickSpawnPoint(mapW, mapH, territory);
      if (p) { zombies = [...zombies, spawnZombie(p.x, p.y)]; lastSpawnAt = now; }
    }
    if (zombies.length > MAX_COUNT) zombies = zombies.slice(0, MAX_COUNT);

    // Rare flavor text from a random living survivor
    let lastFlavorAt = st.lastFlavorAt;
    if (zombies.length > 0 && now - lastFlavorAt > FLAVOR_COOLDOWN_MS && rand() < 0.02) {
      const game = useGame.getState();
      const alive = game.survivors.filter((s) => s.health > 0);
      if (alive.length > 0) {
        const speaker = alive[Math.floor(rand() * alive.length)];
        const line = FLAVOR_LINES[Math.floor(rand() * FLAVOR_LINES.length)];
        toast(`${speaker.name} ${speaker.surname}`, { description: `"${line}"` });
        lastFlavorAt = now;
      }
    }

    set({ zombies, lastSpawnAt, lastFlavorAt });
  },
}));
