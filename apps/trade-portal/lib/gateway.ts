import { cookies } from 'next/headers';
import {
  ApiError,
  createClient,
  toStorefrontItems,
  type ApiClient,
  type CreditApplicationInput,
  type CreditLimit,
  type Statement,
  type StorefrontItem,
} from '@ag/api-client';
import type { ApplicationForm } from './application';

/**
 * The trade portal's door to the platform. Like the storefront, it reads through
 * the gateway on the server, carries the caller's bearer token from the
 * `ag_token` cookie, and keeps the base URL out of the browser bundle.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export const TOKEN_COOKIE = 'ag_token';

/** The trade organisation the signed-in user belongs to, until the session carries it. */
export const ORG_ID = process.env.TRADE_ORG_ID ?? 'org-demo';

export function tradeClient(): ApiClient {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return createClient(BASE_URL, token ? () => ({ authorization: `Bearer ${token}` }) : () => ({}));
}

export interface Loaded<T> {
  data: T;
  error?: string;
}

function message(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return 'Please sign in to your trade account.';
    if (err.status === 404) return 'No account found for your organisation yet.';
  }
  return 'The trade portal is having trouble right now. Please try again.';
}

export async function loadCreditLimit(orgId = ORG_ID): Promise<Loaded<CreditLimit | undefined>> {
  try {
    return { data: await tradeClient().creditLimit(orgId) };
  } catch (err) {
    return { data: undefined, error: message(err) };
  }
}

export async function loadStatement(orgId = ORG_ID): Promise<Loaded<Statement | undefined>> {
  try {
    return { data: await tradeClient().statement(orgId) };
  } catch (err) {
    return { data: undefined, error: message(err) };
  }
}

export async function loadCatalogue(): Promise<Loaded<StorefrontItem[]>> {
  try {
    return { data: toStorefrontItems(await tradeClient().catalogue()) };
  } catch (err) {
    return { data: [], error: message(err) };
  }
}

/** Map the portal's application form onto the shape the accounts service accepts. */
export function toApplicationInput(form: ApplicationForm, orgId: string): CreditApplicationInput {
  return {
    orgId,
    businessType: form.businessType || 'retail',
    registrationNumber: form.registrationNumber,
    turnoverDeclaredCents: form.turnoverDeclaredCents,
    estWeeklySpendCents: form.weeklyVolumes.reduce((sum, v) => sum + v.qty, 0),
    requestedLimitCents: form.requestedLimitCents,
    requestedTermsDays: form.requestedTermsDays,
    documents: Object.entries(form.documents).map(([kind, state]) => ({ kind, state })),
    consentGiven: form.consentGiven,
  };
}

/** Submit a trade credit application through the gateway. */
export async function submitApplication(form: ApplicationForm): Promise<Loaded<{ id: string; status: string } | undefined>> {
  try {
    return { data: await tradeClient().submitCreditApplication(toApplicationInput(form, ORG_ID)) };
  } catch (err) {
    return { data: undefined, error: message(err) };
  }
}
