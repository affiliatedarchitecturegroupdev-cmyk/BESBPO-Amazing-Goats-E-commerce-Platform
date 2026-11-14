/**
 * Structured logging with redaction. Logs leave the platform (Northflank log
 * drains, Koyeb logs), so anything that identifies a person or authenticates a
 * caller must be stripped before a line is written. Redaction is a pure
 * function so the rule can be tested directly (see docs/02-access-control.md
 * and docs/07-compliance.md: POPIA, no standing access to personal data).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogFields {
  [key: string]: unknown;
}

export interface LogLine {
  at: string;
  level: LogLevel;
  service: string;
  message: string;
  fields?: LogFields;
}

export const REDACTED = '[redacted]';

/** Field names whose value is a credential or personal data. Matched case-insensitively. */
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'accesskey',
  'privatekey',
  'clientsecret',
  'cardnumber',
  'cvv',
  'pin',
  'email',
  'phone',
  'idnumber',
  'id_number',
  'passport',
  'bankaccount',
  'iban',
  'subjectid',
  'idpsubject',
];

/** Whether a field name looks like a credential or personal data. */
export function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[-_\s]/g, '');
  return SENSITIVE_KEYS.some((s) => normalised.includes(s.replace(/[-_]/g, '')));
}

/**
 * Replace the value of any sensitive field with `[redacted]`, at any depth.
 * Arrays and nested objects are walked; everything else is copied as is, so the
 * result is a plain, serialisable value. Errors are reduced to their message,
 * which keeps a stack trace out of the log line.
 */
export function redact(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return value.message;
  if (Array.isArray(value)) return value.map(redact);

  const out: LogFields = {};
  for (const [key, child] of Object.entries(value as LogFields)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(child);
  }
  return out;
}

/** Whether a level is written at the given minimum level. */
export function levelEnabled(level: LogLevel, min: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[min];
}

/** Build one log line, with fields redacted. */
export function buildLogLine(
  level: LogLevel,
  service: string,
  message: string,
  fields: LogFields | undefined,
  at: Date,
): LogLine {
  const line: LogLine = { at: at.toISOString(), level, service, message };
  if (fields && Object.keys(fields).length > 0) line.fields = redact(fields) as LogFields;
  return line;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export interface LoggerOptions {
  service: string;
  minLevel?: LogLevel;
  now?: () => Date;
  sink?: (line: LogLine) => void;
  /** Fields merged into every line this logger writes (e.g. request id). */
  bindings?: LogFields;
}

/**
 * A logger that writes one JSON line per call. The sink defaults to stdout, so
 * Northflank and Koyeb collect the lines without a sidecar. Context passed to
 * `child` is redacted once and carried into every line.
 */
export function createLogger(options: LoggerOptions): Logger {
  const minLevel = options.minLevel ?? 'info';
  const now = options.now ?? (() => new Date());
  const sink = options.sink ?? ((line) => process.stdout.write(`${JSON.stringify(line)}\n`));
  const bindings = options.bindings ? (redact(options.bindings) as LogFields) : undefined;

  const emit = (level: LogLevel, message: string, fields?: LogFields): void => {
    if (!levelEnabled(level, minLevel)) return;
    sink(buildLogLine(level, options.service, message, { ...bindings, ...fields }, now()));
  };

  const logger: Logger = {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    child: (fields) => createLogger({ ...options, bindings: { ...bindings, ...fields } }),
  };
  return logger;
}
