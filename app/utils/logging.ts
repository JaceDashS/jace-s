/**
 * Logging utility with LOG_LEVEL control.
 * 
 * LOG_LEVEL options:
 * - error: Only error messages
 * - info: Production logging (one-line request logs with IP)
 * - debug: Verbose logging (all details)
 */

type LogLevel = 'error' | 'info' | 'debug';

function getLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase().trim();
  if (level === 'error' || level === 'info' || level === 'debug') {
    return level;
  }
  return 'info'; // default to info
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  const levels: LogLevel[] = ['error', 'info', 'debug'];
  const currentIndex = levels.indexOf(currentLevel);
  const targetIndex = levels.indexOf(level);
  return targetIndex <= currentIndex;
}

/**
 * @deprecated Use LOG_LEVEL=debug instead
 */
export function isVerboseLoggingEnabled(): boolean {
  return shouldLog('debug');
}

export function logDebug(message: string, payload?: Record<string, unknown>): void {
  if (!shouldLog('debug')) {
    return;
  }
  if (payload) {
    console.log(message, payload);
  } else {
    console.log(message);
  }
}

export function logInfo(message: string, payload?: Record<string, unknown>): void {
  if (!shouldLog('info')) {
    return;
  }
  if (payload) {
    console.log(message, payload);
  } else {
    console.log(message);
  }
}

export function logError(message: string, payload?: Record<string, unknown>): void {
  if (!shouldLog('error')) {
    return;
  }
  if (payload) {
    console.error(message, payload);
  } else {
    console.error(message);
  }
}

