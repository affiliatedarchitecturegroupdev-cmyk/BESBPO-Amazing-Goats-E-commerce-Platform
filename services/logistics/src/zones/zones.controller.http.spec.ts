// T-078: the delivery-area check, asked by a shopper with no account.
//
// This boots the real logistics zones module — controller, service, stores and
// the real permission guard — and asks over HTTP with no token at all. That is
// the acceptance criterion a unit test cannot prove: the check must be reachable
// *before* signing in, while the zone table behind it stays gated.
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PermissionsGuard } from '@ag/nest-auth';
import { ZonesModule } from './zones.module';
import type { ZoneCheck } from './zone-check.rules';
import { ZonesService, ZONE_STORE } from './zones.service';
import { InMemoryZoneStore } from './zones.store';
import { ROUTE_STORE } from '../routes/routes.service';
import { InMemoryRouteStore } from '../routes/routes.store';
import { SLOT_STORE } from '../slots/slots.service';
import { InMemorySlotStore } from '../slots/slots.store';

@Module({
  imports: [ZonesModule],
  providers: [{ provide: APP_GUARD, useClass: PermissionsGuard }],
})
class CheckApp {}

describe('check delivery to an area before signing in', () => {
  let app: NestExpressApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(CheckApp, { logger: false });
    // Seed through the stores the module itself resolved, so the request path is
    // the real one: controller -> service -> store.
    const zones = app.get<InMemoryZoneStore>(ZONE_STORE);
    await zones.insert({ id: 2, code: 'KZN-DBN', name: 'Durban', feeCents: 9000, freeOverCents: 100_000 });
    await zones.insert({ id: 1, code: 'KZN-NC-UMH', name: 'Umhlanga and Phoenix', feeCents: 7500 });
    await app.get<InMemoryRouteStore>(ROUTE_STORE).insert({
      id: 'r1', name: 'Wed Durban', dayOfWeek: 3, zoneId: 2,
    });
    await app.get<InMemorySlotStore>(SLOT_STORE).insert({
      id: 's1',
      routeId: 'r1',
      startsAt: '2099-11-18T04:00:00.000Z',
      endsAt: '2099-11-18T16:00:00.000Z',
      capacity: 20,
      booked: 3,
      earlyWindow: false,
    });
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers a served area for an anonymous shopper', async () => {
    const res = await fetch(`${base}/logistics/zones/check?suburb=Durban`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ZoneCheck;
    expect(body.served).toBe(true);
    expect(body.served && body.zone).toEqual({ id: 2, code: 'KZN-DBN', name: 'Durban' });
    expect(body.served && body.feeCents).toBe(9000);
    expect(body.served && body.feeIncludesVat).toBe(true);
    expect(body.served && body.nextSlot).toBe('2099-11-18T04:00:00.000Z');
    // The cut-off is an instant from the engine, not a string from the page.
    expect(Date.parse((body.served && body.cutoffAt) || '')).toBeGreaterThan(0);
  });

  it('applies the free-over threshold from the cart total', async () => {
    const res = await fetch(`${base}/logistics/zones/check?suburb=Durban&goodsTotalCents=150000`);
    const body = (await res.json()) as ZoneCheck;
    expect(body.served && body.feeCents).toBe(0);
    expect(body.served && body.freeOverApplied).toBe(true);
  });

  it('tells an unserved area honestly, and offers the waitlist', async () => {
    const res = await fetch(`${base}/logistics/zones/check?suburb=Kimberley`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      served: false,
      area: 'kimberley',
      needsArea: false,
      waitlist: { available: true },
    });
  });

  it('asks for an area rather than guessing when none was given', async () => {
    const res = await fetch(`${base}/logistics/zones/check`);
    const body = (await res.json()) as ZoneCheck;
    expect(body.served).toBe(false);
    expect(body.served === false && body.needsArea).toBe(true);
  });

  it('still refuses the zone table to an anonymous caller', async () => {
    // The check is public; listing every zone is not.
    const res = await fetch(`${base}/logistics/zones`);
    expect(res.status).toBe(401);
  });

  it('keeps `check` from being read as a zone id', async () => {
    // A `:id` route ordered first would answer 404 for "check" instead.
    const res = await fetch(`${base}/logistics/zones/check?suburb=Umhlanga`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ZoneCheck;
    expect(body.served && body.zone.code).toBe('KZN-NC-UMH');
  });

  it('serves the public delivery table without a token', async () => {
    const res = await fetch(`${base}/logistics/zones/table`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { zones: unknown[]; routeDays: unknown[]; feeIncludesVat: boolean };
    expect(body.feeIncludesVat).toBe(true);
    // Seeded zones are both present, ordered by code.
    expect(body.zones).toEqual([
      { code: 'KZN-DBN', name: 'Durban', feeCents: 9000, freeOverCents: 100_000 },
      { code: 'KZN-NC-UMH', name: 'Umhlanga and Phoenix', feeCents: 7500, freeOverCents: null },
    ]);
    expect(body.routeDays).toEqual([{ dayOfWeek: 3, day: 'Wednesday', zones: ['Durban'] }]);
  });

  it('never puts the delivery geometry on the public table', async () => {
    const res = await fetch(`${base}/logistics/zones/table`);
    const raw = await res.text();
    expect(raw).not.toContain('polygon');
    expect(raw).not.toContain('"lat"');
  });

  it('keeps the zone table itself gated while `/table` is public', async () => {
    // The distinction T-055 depends on: the fee is public, the polygons are not.
    expect((await fetch(`${base}/logistics/zones/table`)).status).toBe(200);
    expect((await fetch(`${base}/logistics/zones`)).status).toBe(401);
  });

  it('serves the same answer through the service the controller calls', async () => {
    const check = await app.get(ZonesService).check({ suburb: 'Durban' });
    expect(check.served).toBe(true);
  });
});
