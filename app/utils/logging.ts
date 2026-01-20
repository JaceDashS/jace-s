/**
 * Logging utility with verbosity control.
 */

const VERBOSE_VALUES = new Set(['true', '1', 'yes', 'y', 'on']);

export function isVerboseLoggingEnabled(): boolean {
  const raw =
    process.env.LOG_VERBOSE ??
    process.env.API_LOG_VERBOSE ??
    '';
  return VERBOSE_VALUES.has(raw.trim().toLowerCase());
}

export function logDebug(message: string, payload?: Record<string, unknown>): void {
  if (!isVerboseLoggingEnabled()) {
    return;
  }
  if (payload) {
    console.log(message, payload);
  } else {
    console.log(message);
  }
}

export function logInfo(message: string, payload?: Record<string, unknown>): void {
  if (payload) {
    console.log(message, payload);
  } else {
    console.log(message);
  }
}

export function logError(message: string, payload?: Record<string, unknown>): void {
  if (payload) {
    console.error(message, payload);
  } else {
    console.error(message);
  }
}

