/**
 * Structured Logger
 *
 * Lightweight logger that outputs JSON in production (for Netlify/CloudWatch)
 * and human-readable format in development. No external dependencies.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Task created', { taskId, category });
 *   logger.error('Payment verification failed', { taskId, error: err.message });
 *   logger.error('Unhandled error occurred', err);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProduction = process.env.NODE_ENV === 'production';
const minLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || (isProduction ? 'info' : 'debug')];

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= minLevel;
}

function formatDev(entry: LogEntry): string {
  const { level, msg, ts, ...ctx } = entry;
  const tag = level.toUpperCase().padEnd(5);
  const time = ts.split('T')[1]?.replace('Z', '') || ts;
  const extra = Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : '';
  return `${time} [${tag}] ${msg}${extra}`;
}

function emit(level: LogLevel, msg: any, ...args: any[]): void {
  if (!shouldLog(level)) return;

  let message = typeof msg === 'string' ? msg : (msg instanceof Error ? msg.message : String(msg));
  let context: Record<string, unknown> = {};

  // If the first argument was an Error object, let's capture its stack
  if (msg instanceof Error) {
    context.error = {
      message: msg.message,
      stack: msg.stack,
    };
  }

  args.forEach((arg, index) => {
    if (arg instanceof Error) {
      context.error = {
        message: arg.message,
        stack: arg.stack,
      };
    } else if (arg && typeof arg === 'object') {
      if (Array.isArray(arg)) {
        context[`arg_${index}`] = arg;
      } else {
        // Merge object fields into context, safely handling non-plain objects
        try {
          context = { ...context, ...arg };
        } catch {
          context[`arg_${index}`] = String(arg);
        }
      }
    } else if (arg !== undefined) {
      message += ` ${String(arg)}`;
    }
  });

  const entry: LogEntry = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...context,
  };

  if (isProduction) {
    const output = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  } else {
    const formatted = formatDev(entry);
    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }
}

export const logger = {
  debug: (msg: any, ...args: any[]) => emit('debug', msg, ...args),
  info: (msg: any, ...args: any[]) => emit('info', msg, ...args),
  warn: (msg: any, ...args: any[]) => emit('warn', msg, ...args),
  error: (msg: any, ...args: any[]) => emit('error', msg, ...args),
};
