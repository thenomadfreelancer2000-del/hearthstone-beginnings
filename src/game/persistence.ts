import type { SaveGame } from "./types";
import { syncSkills } from "./sim/skills";
import { debugError, debugLog } from "./debug";


const KEY = "the-ranch-save-v2";
const LEGACY_KEY_V1 = "the-ranch-save-v1";

export function saveToLocal(save: SaveGame) {
  try {
    debugLog("save:write:start", {
      tick: save.time.tick,
      survivors: save.survivors.length,
      buildings: save.buildings.length,
      tiles: save.tiles.length,
      nodes: save.resourceNodes.length,
    });
    localStorage.setItem(KEY, JSON.stringify(save));
    debugLog("save:write:done");
    return true;
  } catch (error) {
    debugError("save:write:error", error);
    return false;
  }
}

export function loadFromLocal(): SaveGame | null {
  try {
    debugLog("save:load:start");
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      debugLog("save:load:empty");
      return null;
    }
    debugLog("save:load:raw", { bytes: raw.length });
    const data = JSON.parse(raw) as SaveGame;
    debugLog("save:load:parsed", {
      version: data.version,
      tick: data.time?.tick,
      survivors: data.survivors?.length ?? 0,
      buildings: data.buildings?.length ?? 0,
      tiles: data.tiles?.length ?? 0,
      nodes: data.resourceNodes?.length ?? 0,
    });
    if (data.version !== 2 && data.version !== 3 && data.version !== 4 && data.version !== 5 && data.version !== 6) return null;
    if (data.version === 2) {
      (data as SaveGame).proposals = [];
      (data as SaveGame).version = 3;
    }
    if (data.version === 3) {
      // Migrate v3 → v4: add empty livestock arrays + missing resources.
      (data as SaveGame).animals = [];
      (data as SaveGame).livestockRequests = [];
      const r = data.resources as Record<string, number>;
      if (r.eggs == null) r.eggs = 0;
      if (r.milk == null) r.milk = 0;
      if (r.wool == null) r.wool = 0;
      (data as SaveGame).version = 4;
    }
    if (data.version === 4) {
      // Migrate v4 → v5: add empty ministers/admin arrays.
      (data as SaveGame).ministers = [];
      (data as SaveGame).ministerRequests = [];
      (data as SaveGame).ministerReports = [];
      (data as SaveGame).version = 5;
    }
    if (data.version === 5) {
      // Migrate v5 → v6: add empty expeditions array.
      (data as SaveGame).expeditions = [];
      (data as SaveGame).version = 6;
    }
    // Always re-normalize the new skill schema on load.
    try {
      for (const sv of data.survivors ?? []) {
        if (sv.skills) syncSkills(sv.skills);
      }
    } catch {
      /* ignore — UI falls back to legacy fields if sync fails */
    }
    debugLog("save:load:done", { version: data.version });
    return data;
  } catch (error) {
    debugError("save:load:error", error);
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY_V1);
  } catch {
    /* ignore */
  }
}

export function exportSave(save: SaveGame) {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `the-ranch-${save.ranchName.replace(/\s+/g, "_")}-y${save.time.year}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
