import { describe, expect, it } from 'vitest';
import { userFromRequest } from '@ag/nest-auth';
import { SessionMiddleware } from './session.middleware';
import { issueSession, sessionConfigFromEnv } from './session-cookie';

const nowSec = 1_700_000_000;
const now = () => nowSec * 1000;
const config = { ...sessionConfigFromEnv({ JWT_SECRET: 'test-secret' }), secure: false };

function run(headers: Record<string, string>) {
  const req: any = { headers };
  let called = false;
  new SessionMiddleware({ secret: 'test-secret' }).use(req, {}, () => (called = true));
  return { req, called };
}

describe('SessionMiddleware', () => {
  it('turns the session cookie into the bearer header the guard reads', () => {
    const token = issueSession({ sub: 'u-1', roles: ['ops_manager'] }, config, now);
    const { req } = run({ cookie: `ag_session=${token}` });
    expect(req.headers.authorization).toBe(`Bearer ${token}`);
    expect(userFromRequest(req, { secret: 'test-secret', now })?.id).toBe('u-1');
  });

  it('leaves an existing bearer header alone, so service-to-service calls work', () => {
    const { req } = run({ authorization: 'Bearer already-here', cookie: 'ag_session=other' });
    expect(req.headers.authorization).toBe('Bearer already-here');
  });

  it('does nothing when there is no cookie', () => {
    const { req } = run({});
    expect(req.headers.authorization).toBeUndefined();
  });

  it('ignores other cookies on the same domain', () => {
    const { req } = run({ cookie: 'theme=dark; ag_refresh=x' });
    expect(req.headers.authorization).toBeUndefined();
  });

  it('always calls next, so a request is never dropped', () => {
    expect(run({}).called).toBe(true);
    expect(run({ cookie: 'ag_session=tok' }).called).toBe(true);
  });
});
