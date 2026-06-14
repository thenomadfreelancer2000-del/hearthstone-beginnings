import { create } from "zustand";

interface ViewState {
  mapZoom: number; // 0.2 .. 1.5  (1 = native)
  smooth: boolean; // animate transform (button clicks) vs track input live (wheel/pinch)
  /** Monotonically increases each time the player requests "center on ranch". */
  centerRequestId: number;
  setMapZoom: (z: number, smooth?: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  /** Reset zoom to 100% and center the viewport on the ranch. */
  centerOnRanch: () => void;
}

export const MIN_ZOOM = 0.2; // 5x out
export const MAX_ZOOM = 1.5;
const STEP = 0.15;
const clamp = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

export const useView = create<ViewState>((set, get) => ({
  mapZoom: 1,
  smooth: true,
  centerRequestId: 0,
  setMapZoom: (z, smooth = false) => set({ mapZoom: clamp(z), smooth }),
  zoomIn: () => set({ mapZoom: clamp(get().mapZoom + STEP), smooth: true }),
  zoomOut: () => set({ mapZoom: clamp(get().mapZoom - STEP), smooth: true }),
  resetZoom: () => set({ mapZoom: 1, smooth: true }),
  centerOnRanch: () =>
    set({ mapZoom: 1, smooth: true, centerRequestId: get().centerRequestId + 1 }),
}));
