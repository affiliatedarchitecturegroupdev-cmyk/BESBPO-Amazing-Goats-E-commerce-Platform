import { describe, it, expect } from 'vitest';
import { MfaService } from './mfa.service';
import { InMemoryMfaStore } from './mfa-domain';
import { totp } from './totp';

const at = new Date('2026-01-01T00:00:00Z');
const unix = Math.floor(at.getTime() / 1000);
const service = (store = new InMemoryMfaStore()) => new MfaService(store, () => at);

describe('MfaService', () => {
  it('starts enrolment with a secret and a scannable URI', async () => {
    const { secret, uri } = await service().beginEnrolment('u1', 'staff@example.co.za');
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${secret}`);
  });

  it('confirms enrolment only with a valid first code', async () => {
    const svc = service();
    const { secret } = await svc.beginEnrolment('u1', 'staff@example.co.za');
    await expect(svc.confirm('u1', '000000')).rejects.toThrow(/invalid code/);
    await svc.confirm('u1', totp(secret, unix));
    expect(await svc.isEnrolled('u1')).toBe(true);
  });

  it('refuses to confirm a subject that never started enrolment', async () => {
    await expect(service().confirm('nobody', '123456')).rejects.toThrow(/not enrolled/);
  });

  it('verifies a login with a live code once confirmed', async () => {
    const svc = service();
    const { secret } = await svc.beginEnrolment('u1', 'staff@example.co.za');
    await svc.confirm('u1', totp(secret, unix));
    expect(await svc.verify('u1', totp(secret, unix))).toEqual({ ok: true });
    expect(await svc.verify('u1', '000000')).toEqual({ ok: false, reason: 'invalid code' });
  });

  it('will not verify before enrolment is confirmed', async () => {
    const svc = service();
    const { secret } = await svc.beginEnrolment('u1', 'staff@example.co.za');
    expect(await svc.verify('u1', totp(secret, unix))).toEqual({ ok: false, reason: 'enrolment not confirmed' });
  });

  it('will not verify an unknown subject', async () => {
    expect(await service().verify('nobody', '123456')).toEqual({ ok: false, reason: 'not enrolled' });
  });
});
