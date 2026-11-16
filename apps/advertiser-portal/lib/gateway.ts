import { cookies } from 'next/headers';
import {
  ApiError,
  createClient,
  type ApiClient,
  type Campaign,
  type CampaignInput,
  type WalletSummary,
} from '@ag/api-client';

/**
 * The advertiser portal's door to the platform. Reads run on the server through
 * the gateway; a campaign is drafted through `app/campaigns/new/actions.ts`,
 * which also runs on the server so the caller's bearer token stays private.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export const TOKEN_COOKIE = 'ag_token';

/** The advertiser organisation the signed-in user belongs to, until the session carries it. */
export const ADVERTISER_ORG_ID = process.env.ADVERTISER_ORG_ID ?? 'org-demo';

export function advertiserClient(): ApiClient {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return createClient(BASE_URL, token ? () => ({ authorization: `Bearer ${token}` }) : () => ({}));
}

export interface Loaded<T> {
  data: T;
  error?: string;
}

function message(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return 'Please sign in to your advertiser account.';
    if (err.status === 404) return 'No advertiser account found yet.';
  }
  return 'The advertiser portal is having trouble right now. Please try again.';
}

export async function loadCampaigns(): Promise<Loaded<Campaign[]>> {
  try {
    return { data: await advertiserClient().campaigns() };
  } catch (err) {
    return { data: [], error: message(err) };
  }
}

export async function loadWallet(orgId = ADVERTISER_ORG_ID): Promise<Loaded<WalletSummary | undefined>> {
  try {
    return { data: await advertiserClient().wallet(orgId) };
  } catch (err) {
    return { data: undefined, error: message(err) };
  }
}

/** Map the builder form onto the shape the ads service accepts. */
export function toCampaignInput(form: {
  goal: string;
  budgetCents: number;
  pricing: CampaignInput['pricing'];
  bidCents: number;
  slotCode: string;
  targeting: { category: string; region: string; buyerType: string };
  headline: string;
}, orgId: string): CampaignInput {
  return {
    advertiserOrgId: orgId,
    name: form.headline.trim() || form.goal.trim() || 'Untitled campaign',
    goal: form.goal,
    budgetCents: form.budgetCents,
    pricing: form.pricing,
    ...(form.pricing !== 'flat' ? { bidCents: form.bidCents } : {}),
    targeting: form.targeting,
  };
}

/** Draft a campaign through the gateway. */
export async function draftCampaign(form: Parameters<typeof toCampaignInput>[0]): Promise<Loaded<Campaign | undefined>> {
  try {
    return { data: await advertiserClient().createCampaign(toCampaignInput(form, ADVERTISER_ORG_ID)) };
  } catch (err) {
    return { data: undefined, error: message(err) };
  }
}

/** Top up the wallet through the gateway. */
export async function topUp(amountCents: number, ref?: string): Promise<Loaded<{ balanceCents: number } | undefined>> {
  try {
    return { data: await advertiserClient().topUpWallet({ advertiserOrgId: ADVERTISER_ORG_ID, amountCents, ref }) };
  } catch (err) {
    return { data: undefined, error: message(err) };
  }
}
