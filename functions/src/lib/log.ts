/**
 * Structured, pseudonymised logging (DESIGN.md §13). Entries carry an `event` name and scalar fields chosen by
 * the caller: never request data, tag text, names, emails, tokens, IP addresses or raw uids (use `uidH`).
 */
import { stackFrames } from '@friendpod/core/node';
import { logger } from 'firebase-functions/logger';

export type LogValue = string | number | boolean | null | readonly LogValue[] | { readonly [key: string]: LogValue };
export type LogFields = Readonly<Record<string, LogValue>>;

export interface Log {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

function entry(severity: 'INFO' | 'WARNING' | 'ERROR', event: string, fields: LogFields = {}): void {
  logger.write({ severity, message: event, event, ...fields });
}

export const log: Log = {
  info: (event, fields) => entry('INFO', event, fields),
  warn: (event, fields) => entry('WARNING', event, fields),
  error: (event, fields) => entry('ERROR', event, fields),
};

/**
 * What may be logged about an unexpected error: its class name, a numeric SDK status and the stack frames.
 * The message is dropped because SDK errors echo document paths (with uids) and values.
 */
export function errorFields(err: unknown): LogFields {
  if (!(err instanceof Error)) return { errorName: typeof err };
  const code = (err as { code?: unknown }).code;
  return { errorName: err.name, ...(typeof code === 'number' ? { grpcCode: code } : {}), stack: stackFrames(err) };
}
