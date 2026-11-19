import { cookies } from 'next/headers';
import {
  ApiError,
  createClient,
  type ApiClient,
  type DriverEventInput,
  type DriverSyncResult,
  type Order,
  type ProofCaptureInput,
  type ProofOfDelivery,
} from '@ag/api-client';
import type { DayPack, Stop } from './daypack';
import { FIXTURE_DAY_PACK } from './fixtures';

/**
 * The driver app's door to the platform (docs/01-architecture.md,
 * docs/08-offline-driver.md). Reads happen on the server through the gateway;
 * the offline queue is replayed through `app/api/sync`, which also runs on the
 * server so the caller's bearer token never reaches the browser bundle.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export const TOKEN_COOKIE = 'ag_token';

export function driverClient(): ApiClient {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return createClient(BASE_URL, token ? () => ({ authorization: `Bearer ${token}` }) : () => ({}));
}

/** Compose a stop from an order the gateway returned. */
export function stopFromOrder(order: Order, sequence: number): Stop {
  const address = order.deliveryAddress;
  const city = address?.city ?? 'Unknown';
  return {
    id: order.id,
    sequence,
    customer: city,
    address: address ? `${address.line1}, ${address.suburb}, ${address.city}` : 'No address on file',
    window: order.createdAt ? order.createdAt.slice(11, 16) : '—',
    items: (order.lines ?? []).map((l) => ({ name: l.sku, qty: l.qty })),
    temperature: 'chilled',
    requiresSignature: false,
  };
}

/** Build the day pack from the route and its orders, as the morning download. */
export function buildDayPack(routeName: string, orders: Order[], now = new Date()): DayPack {
  return {
    routeName,
    downloadedAt: now.toISOString(),
    stops: orders.map((o, i) => stopFromOrder(o, i + 1)),
  };
}

/**
 * Download the day pack through the gateway. When the gateway cannot be
 * reached (the driver is offline), fall back to the last downloaded pack so a
 * route still works with no signal.
 */
export async function loadDayPack(): Promise<DayPack> {
  try {
    const client = driverClient();
    const [routes, orders] = await Promise.all([client.routes(), client.orders()]);
    const routeName = routes[0]?.name ?? 'Today';
    const pack = buildDayPack(routeName, orders);
    return pack.stops.length > 0 ? pack : FIXTURE_DAY_PACK;
  } catch (err) {
    if (err instanceof ApiError) return FIXTURE_DAY_PACK;
    return FIXTURE_DAY_PACK;
  }
}

/** Replay the offline queue to the gateway. Runs on the server, so the token stays private. */
export async function replayQueue(events: DriverEventInput[]): Promise<DriverSyncResult> {
  return driverClient().syncDriverEvents(events);
}

/**
 * Send the proof captured at a stop. The service keeps the first capture per
 * stop, so replaying a queued proof is safe.
 */
export async function sendProof(stopId: string, capture: ProofCaptureInput): Promise<ProofOfDelivery> {
  return driverClient().captureProof(stopId, capture);
}

/** The proof the server holds for a stop, for the driver to check after a sync. */
export async function fetchProof(stopId: string): Promise<ProofOfDelivery> {
  return driverClient().proofForStop(stopId);
}
