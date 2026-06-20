const DEBUG_PREFIX = "[RanchDebug]";
const BUFFER_KEY = "ranch-debug-log-v1";
const MAX_BUFFERED = 300;

function safeNow() {
  try {
    return Math.round(performance.now());
  } catch {
    return Date.now();
  }
}

export function debugLog(event: string, data?: Record<string, unknown>) {
  try {
    const payload = { at: safeNow(), event, data: data ?? {} };
    remember(payload);
    console.info(DEBUG_PREFIX, `${payload.at}ms`, event, payload.data);
  } catch {
    // Never let diagnostics affect gameplay startup.
  }
}

export function debugError(event: string, error: unknown, data?: Record<string, unknown>) {
  try {
    const payload = {
      at: safeNow(),
      event,
      data: {
        ...data,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      },
    };
    remember(payload);
    console.error(DEBUG_PREFIX, `${safeNow()}ms`, event, {
      ...payload.data,
    });
  } catch {
    // Never let diagnostics affect gameplay startup.
  }
}

function remember(entry: { at: number; event: string; data: Record<string, unknown> }) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const raw = window.localStorage.getItem(BUFFER_KEY);
    const entries = raw ? (JSON.parse(raw) as typeof entry[]) : [];
    entries.push(entry);
    window.localStorage.setItem(BUFFER_KEY, JSON.stringify(entries.slice(-MAX_BUFFERED)));
    (window as unknown as { __RANCH_DEBUG_LOGS__?: typeof entries }).__RANCH_DEBUG_LOGS__ = entries;
  } catch {
    // Diagnostics must never create a new failure mode.
  }
}