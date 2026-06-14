import { create } from "zustand";

interface ViewState {
  mapZoom: number; // 0.2 .. 1.5  (1 = native)
  setMapZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export const MIN_ZOOM = 0.2; // 5x out
export const MAX_ZOOM = 1.5;
const STEP = 0.15;
const clamp = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

export const useView = create<ViewState>((set, get) => ({
  mapZoom: 1,
  setMapZoom: (z) => set({ mapZoom: clamp(z) }),
  zoomIn: () => set({ mapZoom: clamp(get().mapZoom + STEP) }),
  zoomOut: () => set({ mapZoom: clamp(get().mapZoom - STEP) }),
  resetZoom: () => set({ mapZoom: 1 }),
}));
