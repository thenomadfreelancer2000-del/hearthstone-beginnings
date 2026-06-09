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
    if (data.version !== 2) return null;
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
