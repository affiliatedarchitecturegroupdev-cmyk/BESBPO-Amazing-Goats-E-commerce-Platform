import { cookies } from 'next/headers';
import {
  ApiError,
  createClient,
  type ApiClient,
  type PartnerDocument,
  type PurchaseOrder,
  type SlaughterSlot,
} from '@ag/api-client';

/**
 * The partner portal's door to the platform. Every screen reads through the
 * gateway on the server, carrying the caller's bearer token from the `ag_token`
 * cookie. The partners service scopes every row to the caller's organisation,
 * so a partner can never see another partner's data.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export const TOKEN_COOKIE = 'ag_token';

export function partnerClient(): ApiClient {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return createClient(BASE_URL, token ? () => ({ authorization: `Bearer ${token}` }) : () => ({}));
}

export interface Loaded<T> {
  data: T;
  error?: string;
}

function message(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return 'Please sign in to your partner account.';
    if (err.status === 404) return 'No partner account found yet.';
  }
  return 'The partner portal is having trouble right now. Please try again.';
}

export async function loadSlots(): Promise<Loaded<SlaughterSlot[]>> {
  try {
    return { data: await partnerClient().partnerSlots() };
  } catch (err) {
    return { data: [], error: message(err) };
  }
}

export async function loadPurchaseOrders(): Promise<Loaded<PurchaseOrder[]>> {
  try {
    return { data: await partnerClient().purchaseOrders() };
  } catch (err) {
    return { data: [], error: message(err) };
  }
}

export async function loadDocuments(): Promise<Loaded<PartnerDocument[]>> {
  try {
    return { data: await partnerClient().partnerDocuments() };
  } catch (err) {
    return { data: [], error: message(err) };
  }
}

/** Confirm a slaughter slot through the gateway. Runs on the server. */
export async function confirmSlot(id: string): Promise<Loaded<SlaughterSlot | undefined>> {
  try {
    return { data: await partnerClient().confirmPartnerSlot(id) };
  } catch (err) {
    return { data: undefined, error: message(err) };
  }
}
