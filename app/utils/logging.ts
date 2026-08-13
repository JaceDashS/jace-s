/**
 * Logging utility with LOG_LEVEL control.
 * 
 * LOG_LEVEL options:
 * - error: Only error messages
 * - info: Production logging (one-line request logs with IP)
 * - debug: Verbose logging (all details)
 */

type LogLevel = 'error' | 'info' | 'debug';

type LogPayload = Record<string, unknown>;

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

function writeLog(level: LogLevel, message: string, payload?: LogPayload): void {
  const logEntry: LogPayload = {
    ...(payload ?? {}),
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
  };

  if (message) {
    logEntry.message = message;
  }

  let serializedLog: string;
  try {
    serializedLog = JSON.stringify(logEntry);
  } catch {
    serializedLog = JSON.stringify({
      timestamp: logEntry.timestamp,
      level: logEntry.level,
      message: message || 'Log serialization failed',
    });
  }
  if (level === 'error') {
    console.error(serializedLog);
  } else {
    console.log(serializedLog);
  }
}

/**
 * @deprecated Use LOG_LEVEL=debug instead
 */
export function isVerboseLoggingEnabled(): boolean {
  return shouldLog('debug');
}

export function logDebug(message: string, payload?: LogPayload): void {
  if (!shouldLog('debug')) {
    return;
  }
  writeLog('debug', message, payload);
}

export function logInfo(message: string, payload?: LogPayload): void {
  if (!shouldLog('info')) {
    return;
  }
  writeLog('info', message, payload);
}

export function logError(message: string, payload?: LogPayload): void {
  if (!shouldLog('error')) {
    return;
  }
  writeLog('error', message, payload);
}
