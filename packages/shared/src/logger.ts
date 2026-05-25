/**
 * Tiny structured logger. Wraps console with JSON output and field merge.
 * Auto-sanitizes log fields with the evidence sanitizer so accidental
 * `cookie: "session=…"` style logs never leak.
 */

import { sanitizeValue } from './sanitizer.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function activeLevel(): number {
  const raw = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[raw as LogLevel] ?? LEVELS.info;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

function emit(level: LogLevel, baseFields: Record<string, unknown>, msg: string, fields?: Record<string, unknown>) {
  if (LEVELS[level] < activeLevel()) return;
  const record = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...baseFields,
    ...(fields ? (sanitizeValue(fields) as Record<string, unknown>) : {}),
  };
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(JSON.stringify(record) + '\n');
}

export function createLogger(baseFields: Record<string, unknown> = {}): Logger {
  const make = (extra: Record<string, unknown>): Logger => {
    const fields = { ...baseFields, ...extra };
    return {
      debug: (m, f) => emit('debug', fields, m, f),
      info: (m, f) => emit('info', fields, m, f),
      warn: (m, f) => emit('warn', fields, m, f),
      error: (m, f) => emit('error', fields, m, f),
      child: (f) => make({ ...extra, ...f }),
    };
  };
  return make({});
}

export const rootLogger = createLogger({});
