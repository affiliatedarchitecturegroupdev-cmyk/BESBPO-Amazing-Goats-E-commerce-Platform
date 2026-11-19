import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { signJwt } from '@ag/nest-auth';
import { StaffAllowlistGuard } from './staff-allowlist.guard';

const nowSec = 1_700_000_000;
const now = () => nowSec * 1000;
const SECRET = 'test-secret';

const ctxFor = (ip: string | undefined, roles?: string[]) => {
  const headers: Record<string, string> = {};
  if (ip) headers['x-forwarded-for'] = ip;
  if (roles) {
    headers.authorization = `Bearer ${signJwt({ sub: 'u', roles, exp: nowSec + 300 }, { secret: SECRET, now })}`;
  }
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as any;
};

const guard = (csv: string | undefined) => new StaffAllowlistGuard(csv, { secret: SECRET, now });

describe('StaffAllowlistGuard', () => {
  it('allows everything when no list is configured', () => {
    expect(guard(undefined).canActivate(ctxFor('8.8.8.8', ['executive']))).toBe(true);
  });

  it('allows a staff caller from an approved network', () => {
    expect(guard('196.25.1.0/24').canActivate(ctxFor('196.25.1.44', ['executive']))).toBe(true);
  });

  it('refuses a staff caller from anywhere else', () => {
    expect(() => guard('196.25.1.0/24').canActivate(ctxFor('8.8.8.8', ['executive']))).toThrow(
      ForbiddenException,
    );
  });

  it('refuses a staff caller whose IP header was dropped', () => {
    expect(() => guard('196.25.1.0/24').canActivate(ctxFor(undefined, ['executive']))).toThrow(
      ForbiddenException,
    );
  });

  it('does not block an external user in the field', () => {
    // A trade buyer on a phone must reach their own routes regardless of office IPs.
    expect(guard('196.25.1.0/24').canActivate(ctxFor('41.1.2.3', ['trade_buyer']))).toBe(true);
  });

  it('does not block anonymous traffic, which the permission guard rejects anyway', () => {
    expect(guard('196.25.1.0/24').canActivate(ctxFor('8.8.8.8'))).toBe(true);
  });

  it('reads the first hop of a proxy chain', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-forwarded-for': '196.25.1.44, 10.0.0.1',
            authorization: `Bearer ${signJwt({ sub: 'u', roles: ['executive'], exp: nowSec + 300 }, { secret: SECRET, now })}`,
          },
        }),
      }),
    } as any;
    expect(guard('196.25.1.0/24').canActivate(ctx)).toBe(true);
  });
});
