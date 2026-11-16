import { describe, it, expect } from 'vitest';
import {
  batchTag,
  cycleCapacityPct,
  deriveAlerts,
  orderStatusLabel,
  queueCounts,
  shouldEarlyClose,
  temperatureLabel,
  toBatchRow,
  toCycleRow,
  toOrderRow,
} from './admin-view';
import { rolesFromCookie } from './roles';
import { FIXTURE_BATCHES, FIXTURE_CYCLES, FIXTURE_ORDERS } from './fixtures';

describe('queueCounts', () => {
  it('groups order statuses into the four queues', () => {
    const counts = queueCounts(['confirmed', 'packing', 'out_for_delivery', 'delivered', 'packing']);
    expect(counts).toEqual({ new: 1, packing: 2, out: 1, delivered: 1 });
  });

  it('counts nothing when there are no orders', () => {
    expect(queueCounts([])).toEqual({ new: 0, packing: 0, out: 0, delivered: 0 });
  });
});

describe('cycleCapacityPct', () => {
  it('rounds to a whole percentage and caps at 100', () => {
    expect(cycleCapacityPct(820, 1000)).toBe(82);
    expect(cycleCapacityPct(1200, 1000)).toBe(100);
  });

  it('is zero when capacity is zero', () => {
    expect(cycleCapacityPct(10, 0)).toBe(0);
  });
});

describe('shouldEarlyClose', () => {
  it('closes an open cycle only when it is full and the rule is on', () => {
    expect(shouldEarlyClose('open', 1000, 1000, true)).toBe(true);
    expect(shouldEarlyClose('open', 999, 1000, true)).toBe(false);
    expect(shouldEarlyClose('open', 1000, 1000, false)).toBe(false);
    expect(shouldEarlyClose('closed', 1000, 1000, true)).toBe(false);
  });
});

describe('batchTag', () => {
  it('releases a clean batch and holds a warm one', () => {
    expect(batchTag({ status: 'released', temperatureStatus: 'ok' })).toEqual({ label: 'Released', tone: 'ok' });
    expect(batchTag({ status: 'held', temperatureStatus: 'ok' })).toEqual({ label: 'Held', tone: 'watch' });
  });

  it('keeps the batch status in the label and watches warm stock', () => {
    expect(batchTag({ status: 'released', temperatureStatus: 'watch' })).toEqual({ label: 'Released', tone: 'watch' });
    expect(batchTag({ status: 'recalled', temperatureStatus: 'ok' }).label).toBe('Recalled');
  });

  it('labels temperature for the table column', () => {
    expect(temperatureLabel('ok')).toBe('OK');
    expect(temperatureLabel('watch')).toBe('Watch');
  });
});

describe('rolesFromCookie', () => {
  it('keeps known roles and drops unknown ones', () => {
    expect(rolesFromCookie('ops_manager,sales,chief_wizard')).toEqual(['ops_manager', 'sales']);
  });

  it('returns nothing for a missing or empty cookie', () => {
    expect(rolesFromCookie(undefined)).toEqual([]);
    expect(rolesFromCookie('')).toEqual([]);
  });
});

describe('orderStatusLabel', () => {
  it('maps internal statuses to plain queue labels', () => {
    expect(orderStatusLabel('in_cycle')).toBe('New');
    expect(orderStatusLabel('out_for_delivery')).toBe('Out');
  });
});

describe('gateway mappers', () => {
  it('maps an order onto a queue row', () => {
    const row = toOrderRow(FIXTURE_ORDERS[0]);
    expect(row.id).toBe('o-2041');
    expect(row.statusLabel).toBe('New');
  });

  it('maps a cycle onto a labelled row with the fill counted', () => {
    const row = toCycleRow(FIXTURE_CYCLES[0], 820, 1000);
    expect(row.label).toBe('chilled meat');
    expect(row.statusLabel).toBe('Open');
    expect(cycleCapacityPct(row.filled, row.capacity)).toBe(82);
  });

  it('maps a batch onto a table row', () => {
    const row = toBatchRow(FIXTURE_BATCHES[0]);
    expect(row.batchCode).toBe('AG-20261106-0001');
    expect(row.product).toBe('AG-LM-001');
  });
});

describe('deriveAlerts', () => {
  it('flags warm batches and in-progress orders', () => {
    const batches = FIXTURE_BATCHES.map(toBatchRow);
    const orders = FIXTURE_ORDERS.map(toOrderRow);
    const alerts = deriveAlerts(batches, orders);
    expect(alerts.some((a) => a.title.includes('temperature'))).toBe(true);
    expect(alerts.some((a) => a.title.includes('held'))).toBe(true);
    expect(alerts.some((a) => a.title.includes('in progress'))).toBe(true);
  });

  it('stays quiet when nothing needs attention', () => {
    expect(deriveAlerts([], [])).toEqual([]);
  });
});
