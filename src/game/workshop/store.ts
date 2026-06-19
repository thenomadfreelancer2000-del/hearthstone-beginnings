import { create } from "zustand";
import { syncWorkshopRegistry } from "./registry";
import {
  WORKSHOP_PACK_VERSION,
  type WorkshopBuilding,
  type WorkshopPack,
} from "./types";

const STORAGE_KEY = "ranch-workshop-v1";
const SHARE_PREFIX = "RANCHPACK1:";

interface PersistedState {
  packs: WorkshopPack[];
  enabled: Record<string, boolean>;
}

function loadPersisted(): PersistedState {
  if (typeof window === "undefined") return { packs: [], enabled: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { packs: [], enabled: {} };
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      packs: Array.isArray(parsed.packs) ? parsed.packs : [],
      enabled: parsed.enabled && typeof parsed.enabled === "object" ? parsed.enabled : {},
    };
  } catch {
    return { packs: [], enabled: {} };
  }
}

function savePersisted(s: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage may be full or disabled — silently ignore.
  }
}

// ── Encoding ──────────────────────────────────────────────────

function utf8ToBase64(s: string): string {
  if (typeof window === "undefined") return Buffer.from(s, "utf8").toString("base64");
  // Handle unicode safely via percent-encoding round-trip.
  return window.btoa(unescape(encodeURIComponent(s)));
}

function base64ToUtf8(s: string): string {
  if (typeof window === "undefined") return Buffer.from(s, "base64").toString("utf8");
  return decodeURIComponent(escape(window.atob(s)));
}

function validatePack(raw: unknown): WorkshopPack | string {
  if (!raw || typeof raw !== "object") return "Pack is not an object.";
  const p = raw as Partial<WorkshopPack>;
  if (!p.id || typeof p.id !== "string") return "Pack is missing an id.";
  if (!p.name || typeof p.name !== "string") return "Pack is missing a name.";
  if (!p.version || typeof p.version !== "string") p.version = "1.0";
  if (!Array.isArray(p.buildings)) return "Pack has no buildings list.";
  const seen = new Set<string>();
  for (const b of p.buildings as WorkshopBuilding[]) {
    if (!b || typeof b !== "object") return "Invalid building entry.";
    if (!b.id || !b.name || !b.category || !b.size || !b.visual) {
      return `Building "${b?.name ?? "?"}" is missing required fields.`;
    }
    if (seen.has(b.id)) return `Duplicate building id "${b.id}".`;
    seen.add(b.id);
    if (b.visual.type === "sprite" && typeof b.visual.dataUrl !== "string") {
      return `Building "${b.name}" sprite is invalid.`;
    }
    if (b.visual.type === "procedural" && !b.visual.style) {
      return `Building "${b.name}" procedural style is missing.`;
    }
  }
  return p as WorkshopPack;
}

// ── Store ─────────────────────────────────────────────────────

export interface WorkshopStore {
  packs: WorkshopPack[];
  enabled: Record<string, boolean>;

  importPack: (raw: unknown) => { ok: true; pack: WorkshopPack } | { ok: false; error: string };
  importFromJson: (json: string) => ReturnType<WorkshopStore["importPack"]>;
  importFromShareCode: (code: string) => ReturnType<WorkshopStore["importPack"]>;
  exportPackJson: (packId: string) => string | null;
  exportShareCode: (packId: string) => string | null;
  togglePack: (packId: string, enabled?: boolean) => void;
  deletePack: (packId: string) => void;
  upsertPack: (pack: WorkshopPack) => void;

  /** Buildings from currently-enabled packs. */
  activeBuildings: () => { pack: WorkshopPack; building: WorkshopBuilding }[];
}

const initial = loadPersisted();
syncWorkshopRegistry(initial.packs, initial.enabled);

function commit(set: (s: Partial<PersistedState>) => void, next: PersistedState) {
  savePersisted(next);
  syncWorkshopRegistry(next.packs, next.enabled);
  set(next);
}

export const useWorkshop = create<WorkshopStore>((set, get) => ({
  packs: initial.packs,
  enabled: initial.enabled,

  importPack: (raw) => {
    const result = validatePack(raw);
    if (typeof result === "string") return { ok: false, error: result };
    const pack = result;
    const st = get();
    const exists = st.packs.some((p) => p.id === pack.id);
    const packs = exists
      ? st.packs.map((p) => (p.id === pack.id ? pack : p))
      : [...st.packs, pack];
    const enabled = { ...st.enabled, [pack.id]: st.enabled[pack.id] ?? true };
    commit(set, { packs, enabled });
    return { ok: true, pack };
  },

  importFromJson: (json) => {
    try {
      const parsed = JSON.parse(json);
      return get().importPack(parsed);
    } catch (e) {
      return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
    }
  },

  importFromShareCode: (code) => {
    const trimmed = code.trim();
    if (!trimmed.startsWith(SHARE_PREFIX)) {
      return { ok: false, error: "Share code must start with RANCHPACK1:" };
    }
    try {
      const json = base64ToUtf8(trimmed.slice(SHARE_PREFIX.length));
      return get().importFromJson(json);
    } catch (e) {
      return { ok: false, error: `Could not decode share code: ${(e as Error).message}` };
    }
  },

  exportPackJson: (packId) => {
    const pack = get().packs.find((p) => p.id === packId);
    if (!pack) return null;
    return JSON.stringify({ ...pack, _format: WORKSHOP_PACK_VERSION }, null, 2);
  },

  exportShareCode: (packId) => {
    const json = get().exportPackJson(packId);
    if (!json) return null;
    return SHARE_PREFIX + utf8ToBase64(json);
  },

  togglePack: (packId, value) => {
    const st = get();
    const next = { ...st.enabled, [packId]: value ?? !st.enabled[packId] };
    commit(set, { packs: st.packs, enabled: next });
  },

  deletePack: (packId) => {
    const st = get();
    const packs = st.packs.filter((p) => p.id !== packId);
    const enabled = { ...st.enabled };
    delete enabled[packId];
    commit(set, { packs, enabled });
  },

  upsertPack: (pack) => {
    const r = get().importPack(pack);
    if (!r.ok) throw new Error(r.error);
  },

  activeBuildings: () => {
    const st = get();
    const out: { pack: WorkshopPack; building: WorkshopBuilding }[] = [];
    for (const p of st.packs) {
      if (!st.enabled[p.id]) continue;
      for (const b of p.buildings) out.push({ pack: p, building: b });
    }
    return out;
  },
}));

export { SHARE_PREFIX };
