import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { findZone, pointInPolygon, quoteDelivery } from './zone-domain';
import { ZonesService } from './zones.service';
import { InMemoryZoneStore } from './zones.store';
import { Zone } from './zones.types';

// A simple square zone around Johannesburg's eastern suburbs.
const square: Zone = {
  id: 1, code: 'JHB-E', name: 'Johannesburg East', feeCents: 6500, freeOverCents: 75000,
  polygon: [{ lat: -26.0, lng: 28.0 }, { lat: -26.0, lng: 28.5 }, { lat: -26.5, lng: 28.5 }, { lat: -26.5, lng: 28.0 }],
};

describe('pointInPolygon', () => {
  it('is true inside and false outside', () => {
    expect(pointInPolygon({ lat: -26.2, lng: 28.2 }, square.polygon!)).toBe(true);
    expect(pointInPolygon({ lat: -25.5, lng: 28.2 }, square.polygon!)).toBe(false);
  });
});

describe('findZone', () => {
  it('returns the zone containing the point, else undefined', () => {
    expect(findZone({ lat: -26.2, lng: 28.2 }, [square])?.code).toBe('JHB-E');
    expect(findZone({ lat: -30.0, lng: 20.0 }, [square])).toBeUndefined();
  });

  it('ignores zones with too few points', () => {
    expect(findZone({ lat: -26.2, lng: 28.2 }, [{ ...square, polygon: [{ lat: 0, lng: 0 }] }])).toBeUndefined();
  });
});

describe('quoteDelivery', () => {
  it('charges the zone fee inside a zone', () => {
    expect(quoteDelivery({ lat: -26.2, lng: 28.2 }, [square], 10000)).toEqual({ deliverable: true, zone: square, feeCents: 6500 });
  });

  it('is free once the goods total reaches the free-over threshold', () => {
    expect(quoteDelivery({ lat: -26.2, lng: 28.2 }, [square], 75000).feeCents).toBe(0);
    expect(quoteDelivery({ lat: -26.2, lng: 28.2 }, [square], 80000).feeCents).toBe(0);
  });

  it('is not deliverable outside every zone', () => {
    expect(quoteDelivery({ lat: -30.0, lng: 20.0 }, [square], 10000)).toEqual({ deliverable: false });
  });
});

describe('ZonesService', () => {
  const build = () => new ZonesService(new InMemoryZoneStore([square]));

  it('quotes at checkout for a delivery point', async () => {
    const quote = await build().quote({ lat: -26.2, lng: 28.2 }, 10000);
    expect(quote.deliverable).toBe(true);
    expect(quote.feeCents).toBe(6500);
  });

  it('404s on an unknown zone', async () => {
    await expect(build().get(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
