import { describe, it, expect } from 'vitest';
import { buildLogLine, createLogger, isSensitiveKey, levelEnabled, redact, REDACTED } from './log';
import type { LogLine } from './log';

describe('isSensitiveKey', () => {
  it('flags credentials and personal data whatever the casing or separator', () => {
    for (const key of [
      'password',
      'Authorization',
      'api_key',
      'apiKey',
      'clientSecret',
      'cardNumber',
      'email',
      'phone',
      'idNumber',
      'idp_subject',
      'subjectId',
    ]) {
      expect(isSensitiveKey(key), key).toBe(true);
    }
  });

  it('leaves ordinary operational fields alone', () => {
    for (const key of ['service', 'route', 'statusCode', 'durationMs', 'batchCode', 'orgId']) {
      expect(isSensitiveKey(key), key).toBe(false);
    }
  });
});

describe('redact', () => {
  it('replaces sensitive values and keeps the rest', () => {
    const out = redact({
      route: '/orders',
      authorization: 'Bearer abc',
      statusCode: 201,
    }) as Record<string, unknown>;
    expect(out).toEqual({ route: '/orders', authorization: REDACTED, statusCode: 201 });
  });

  it('redacts at depth, in arrays and in nested objects', () => {
    const out = redact({
      user: { id: 'u1', email: 'buyer@example.com' },
      tags: ['a', 'b'],
      events: [{ password: 'hunter2', ok: true }],
    }) as Record<string, unknown>;
    expect(out.user).toEqual({ id: 'u1', email: REDACTED });
    expect(out.tags).toEqual(['a', 'b']);
    expect(out.events).toEqual([{ password: REDACTED, ok: true }]);
  });

  it('treats any key containing a sensitive word as sensitive', () => {
    const out = redact({ refreshTokens: ['a'], userEmail: 'x@y.z', batchCode: 'AG-1' }) as Record<
      string,
      unknown
    >;
    expect(out.refreshTokens).toBe(REDACTED);
    expect(out.userEmail).toBe(REDACTED);
    expect(out.batchCode).toBe('AG-1');
  });

  it('reduces an Error to its message so a stack never reaches the log', () => {
    const err = new Error('connection refused');
    expect(redact({ err })).toEqual({ err: 'connection refused' });
  });

  it('passes through primitives and null', () => {
    expect(redact(7)).toBe(7);
    expect(redact('x')).toBe('x');
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });
});

describe('levelEnabled', () => {
  it('writes a level at or above the minimum', () => {
    expect(levelEnabled('error', 'info')).toBe(true);
    expect(levelEnabled('info', 'info')).toBe(true);
    expect(levelEnabled('debug', 'info')).toBe(false);
  });
});

describe('buildLogLine', () => {
  it('stamps time, level, service and message, and redacts fields', () => {
    const line = buildLogLine(
      'warn',
      'stock',
      'temperature breach',
      { celsius: 9.5, subjectId: 'b1' },
      new Date('2026-02-01T08:00:00Z'),
    );
    expect(line).toEqual({
      at: '2026-02-01T08:00:00.000Z',
      level: 'warn',
      service: 'stock',
      message: 'temperature breach',
      fields: { celsius: 9.5, subjectId: REDACTED },
    });
  });

  it('omits the fields key when there are none', () => {
    expect(
      buildLogLine('info', 'gateway', 'up', undefined, new Date('2026-02-01T08:00:00Z')),
    ).not.toHaveProperty('fields');
  });
});

describe('createLogger', () => {
  const collect = () => {
    const lines: LogLine[] = [];
    return { lines, sink: (l: LogLine) => lines.push(l) };
  };

  it('writes one line per call at or above the minimum level', () => {
    const { lines, sink } = collect();
    const log = createLogger({
      service: 'commerce',
      minLevel: 'info',
      sink,
      now: () => new Date('2026-02-01T08:00:00Z'),
    });
    log.debug('skipped');
    log.info('kept', { orderId: 'o1' });
    log.error('also kept');
    expect(lines.map((l) => l.message)).toEqual(['kept', 'also kept']);
  });

  it('redacts bound and per-call fields, and carries bindings into children', () => {
    const { lines, sink } = collect();
    const log = createLogger({
      service: 'identity',
      sink,
      bindings: { requestId: 'r1', authorization: 'Bearer x' },
    });
    log.child({ userId: 'u1' }).info('login', { password: 'p' });
    expect(lines[0].fields).toEqual({
      requestId: 'r1',
      authorization: REDACTED,
      userId: 'u1',
      password: REDACTED,
    });
  });
});
