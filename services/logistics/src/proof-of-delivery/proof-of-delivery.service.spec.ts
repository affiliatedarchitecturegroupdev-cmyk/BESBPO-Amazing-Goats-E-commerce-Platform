import { describe, it, expect } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProofOfDeliveryService } from './proof-of-delivery.service';
import { InMemoryProofOfDeliveryStore } from './proof-of-delivery.store';
import { ProofOfDelivery } from './proof-of-delivery.types';

const FIXED = new Date('2026-11-18T07:15:00.000Z');

const build = (seed: ProofOfDelivery[] = []) =>
  new ProofOfDeliveryService(new InMemoryProofOfDeliveryStore(seed), () => FIXED);

describe('ProofOfDeliveryService', () => {
  it('starts empty', async () => {
    expect(await build().list()).toEqual([]);
  });

  it('stores a capture and reads it back by stop', async () => {
    const service = build();
    const saved = await service.capture('s1', { signature: 'T. Dlamini', temperatureC: 3.4 });
    expect(saved).toMatchObject({
      stopId: 's1',
      signature: 'T. Dlamini',
      temperatureC: 3.4,
      temperatureExcursion: false,
      capturedAt: FIXED.toISOString(),
    });
    expect(await service.get('s1')).toEqual(saved);
    expect(await service.list()).toHaveLength(1);
  });

  it('is idempotent per stop, so a replayed sync keeps the first capture', async () => {
    const service = build();
    const first = await service.capture('s1', {
      signature: 'T. Dlamini',
      capturedAt: '2026-11-18T06:40:00.000Z',
    });
    const replay = await service.capture('s1', {
      signature: 'Someone Else',
      capturedAt: '2026-11-18T09:00:00.000Z',
    });
    expect(replay).toEqual(first);
    expect(await service.list()).toHaveLength(1);
    expect((await service.get('s1')).signature).toBe('T. Dlamini');
  });

  it('records a cold-chain excursion and flags it rather than refusing the evidence', async () => {
    const proof = await build().capture('s1', { signature: 'T. Dlamini', temperatureC: 9.2 });
    expect(proof.temperatureC).toBe(9.2);
    expect(proof.temperatureExcursion).toBe(true);
  });

  it('refuses a capture that proves nothing', async () => {
    await expect(build().capture('s1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an implausible probe reading', async () => {
    await expect(
      build().capture('s1', { signature: 'x', temperatureC: 120 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a capture with no stop id', async () => {
    await expect(build().capture('  ', { signature: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reports a stop with no proof as not found', async () => {
    await expect(build().get('s-missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists newest capture first', async () => {
    const service = build([
      { stopId: 's1', signature: 'a', capturedAt: '2026-11-18T06:00:00.000Z' },
      { stopId: 's2', signature: 'b', capturedAt: '2026-11-18T09:00:00.000Z' },
    ]);
    expect((await service.list()).map((p) => p.stopId)).toEqual(['s2', 's1']);
  });
});
