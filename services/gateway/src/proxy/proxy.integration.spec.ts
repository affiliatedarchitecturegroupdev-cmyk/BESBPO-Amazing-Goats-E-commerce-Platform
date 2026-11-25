import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AUTH_OPTIONS, PermissionsGuard, RequirePermissions } from '@ag/nest-auth';
import { FetchLike, Upstreams } from '../bff/upstream';
import { UPSTREAMS as UPSTREAMS_TOKEN } from '../bff/bff.service';
import { ProxyController } from './proxy.controller';
import { PROXY_FETCH, ProxyService } from './proxy.service';
import { RateLimitService, RATE_LIMIT_RULES } from '../rate-limit/rate-limit.service';
import { RATE_LIMIT_STORE, InMemoryRateLimitStore } from '../rate-limit/rate-limit.store';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';

/**
 * Boots the real proxy and rate limiter through Nest, with the network boundary
 * (the upstream `fetch`) stubbed. This is the end-to-end proof that a request
 * reaches the owning service, that a route the gateway owns still wins over the
 * catch-all, and that the rate limiter runs before a forward.
 */
const UPSTREAMS: Upstreams = { commerce: 'http://commerce.test', analytics: 'http://analytics.test' };

interface Call {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: unknown };
}
const calls: Call[] = [];

const stubFetch: FetchLike = async (url, init) => {
  calls.push({ url, init });
  const body = JSON.stringify({ served: url, method: init?.method ?? 'GET' });
  return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), text: async () => body, json: async () => JSON.parse(body) };
};

/** A route the gateway serves itself, to prove it is not proxied. */
@Controller('gateway/own')
class OwnController {
  @Get('secure')
  @RequirePermissions('audit:read')
  secure() {
    return { owned: true };
  }
}

/** One strict rule, so a second call to the catalogue trips the limiter. */
const RULES = { 'GET /commerce/catalog': { refillPerSec: 0, burst: 1 } };

@Module({
  // OwnController before the catch-all, as AppModule orders the real modules.
  controllers: [OwnController, ProxyController],
  providers: [
    ProxyService,
    { provide: UPSTREAMS_TOKEN, useValue: UPSTREAMS },
    { provide: PROXY_FETCH, useValue: stubFetch },
    RateLimitService,
    { provide: RATE_LIMIT_STORE, useFactory: () => new InMemoryRateLimitStore() },
    { provide: RATE_LIMIT_RULES, useValue: RULES },
    { provide: AUTH_OPTIONS, useValue: {} },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
class TestApp {}

describe('gateway proxy (booted app)', () => {
  let app: NestExpressApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(TestApp, { logger: false, rawBody: true });
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('forwards a service path to the owning service with the token carried', async () => {
    calls.length = 0;
    const res = await fetch(`${base}/commerce/catalog?line=beef`, {
      headers: { authorization: 'Bearer tok-abc', host: 'gateway.test', 'x-forwarded-for': '41.0.0.1' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ served: 'http://commerce.test/commerce/catalog?line=beef', method: 'GET' });
    expect(calls[0].url).toBe('http://commerce.test/commerce/catalog?line=beef');
    expect(calls[0].init?.headers?.authorization).toBe('Bearer tok-abc');
    expect(calls[0].init?.headers?.host).toBeUndefined();
  });

  it('forwards a write body and method to the owning service', async () => {
    calls.length = 0;
    const res = await fetch(`${base}/analytics/kpis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '41.0.0.2' },
      body: JSON.stringify({ days: 30 }),
    });
    expect(res.status).toBe(200);
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.body).toBe('{"days":30}');
  });

  it('serves a route the gateway owns instead of proxying it', async () => {
    calls.length = 0;
    const res = await fetch(`${base}/gateway/own/secure`, { headers: { 'x-forwarded-for': '41.0.0.3' } });
    // The permission guard runs on the gateway route: no token means 401, and
    // nothing is forwarded.
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('answers 404 for a path no service owns', async () => {
    calls.length = 0;
    const res = await fetch(`${base}/nope/nothing`, { headers: { 'x-forwarded-for': '41.0.0.4' } });
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('applies the rate limiter before forwarding', async () => {
    // The strict rule allows one call, then refuses the next with 429.
    const ip = { 'x-forwarded-for': '41.0.0.5' };
    const first = await fetch(`${base}/commerce/catalog`, { headers: ip });
    const second = await fetch(`${base}/commerce/catalog`, { headers: ip });
    expect([first.status, second.status]).toContain(429);
  });
});
