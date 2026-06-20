// Lightweight runtime profiler — measurement only, no behavior changes.
// Toggle the on-screen panel with Ctrl+Shift+P or ?perf=1 in the URL.

export interface ProfileEntry {
  name: string;
  calls: number;
  totalMs: number;
  lastMs: number;
  maxMs: number;
}

const _entries = new Map<string, ProfileEntry>();
const _renderCounts = new Map<string, { count: number; lastAt: number }>();

let _now = (): number => {
  try { return performance.now(); } catch { return Date.now(); }
};

export function measure<T>(name: string, fn: () => T): T {
  const t0 = _now();
  try {
    return fn();
  } finally {
    const dt = _now() - t0;
    let e = _entries.get(name);
    if (!e) { e = { name, calls: 0, totalMs: 0, lastMs: 0, maxMs: 0 }; _entries.set(name, e); }
    e.calls += 1;
    e.totalMs += dt;
    e.lastMs = dt;
    if (dt > e.maxMs) e.maxMs = dt;
  }
}

export function recordFrame(frameMs: number, kind: "frame" | "tick" | "render" = "frame") {
  let e = _entries.get(`@${kind}`);
  if (!e) { e = { name: `@${kind}`, calls: 0, totalMs: 0, lastMs: 0, maxMs: 0 }; _entries.set(`@${kind}`, e); }
  e.calls += 1;
  e.totalMs += frameMs;
  e.lastMs = frameMs;
  if (frameMs > e.maxMs) e.maxMs = frameMs;
}

export function getEntries(): ProfileEntry[] {
  return Array.from(_entries.values());
}

export function resetEntries() {
  _entries.clear();
  _renderCounts.clear();
  _frameWindow.length = 0;
}

// ── FPS window ─────────────────────────────────────────────────────────
const _frameWindow: number[] = [];
const FRAME_WINDOW = 60;
export function pushFrameTime(ms: number) {
  _frameWindow.push(ms);
  if (_frameWindow.length > FRAME_WINDOW) _frameWindow.shift();
}
export function getFps(): { fps: number; avgFrameMs: number } {
  if (_frameWindow.length === 0) return { fps: 0, avgFrameMs: 0 };
  let sum = 0;
  for (const v of _frameWindow) sum += v;
  const avg = sum / _frameWindow.length;
  return { fps: avg > 0 ? 1000 / avg : 0, avgFrameMs: avg };
}

// ── React render tracking ──────────────────────────────────────────────
export function trackRender(componentName: string) {
  const e = _renderCounts.get(componentName);
  const at = _now();
  if (!e) _renderCounts.set(componentName, { count: 1, lastAt: at });
  else { e.count += 1; e.lastAt = at; }
}
export function getRenderCounts() {
  return Array.from(_renderCounts.entries()).map(([name, v]) => ({ name, ...v }));
}

// ── Panel toggle state ─────────────────────────────────────────────────
let _panelOpen = false;
const _listeners = new Set<(open: boolean) => void>();
export function isPanelOpen() { return _panelOpen; }
export function setPanelOpen(v: boolean) {
  if (_panelOpen === v) return;
  _panelOpen = v;
  for (const l of _listeners) l(v);
}
export function subscribePanel(fn: (open: boolean) => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

// Default-open if ?perf=1 in URL
try {
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.searchParams.get("perf") === "1") _panelOpen = true;
    (window as unknown as { __ranchProfiler?: unknown }).__ranchProfiler = {
      getEntries, getFps, getRenderCounts, reset: resetEntries, setPanelOpen,
    };
  }
} catch { /* noop */ }
