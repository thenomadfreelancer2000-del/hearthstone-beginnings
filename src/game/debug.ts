const DEBUG_PREFIX = "[RanchDebug]";

function safeNow() {
  try {
    return Math.round(performance.now());
  } catch {
    return Date.now();
  }
}

export function debugLog(event: string, data?: Record<string, unknown>) {
  try {
    console.info(DEBUG_PREFIX, `${safeNow()}ms`, event, data ?? {});
  } catch {
    // Never let diagnostics affect gameplay startup.
  }
}

export function debugError(event: string, error: unknown, data?: Record<string, unknown>) {
  try {
    console.error(DEBUG_PREFIX, `${safeNow()}ms`, event, {
      ...data,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    });
  } catch {
    // Never let diagnostics affect gameplay startup.
  }
}