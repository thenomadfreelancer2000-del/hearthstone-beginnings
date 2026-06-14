import type { SaveGame } from "./types";

const KEY = "the-ranch-save-v2";
const LEGACY_KEY_V1 = "the-ranch-save-v1";

export function saveToLocal(save: SaveGame) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function loadFromLocal(): SaveGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveGame;
    if (data.version !== 2 && data.version !== 3 && data.version !== 4 && data.version !== 5) return null;
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
    return data;
  } catch {
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
