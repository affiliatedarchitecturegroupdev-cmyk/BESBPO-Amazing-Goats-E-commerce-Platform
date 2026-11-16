import type { CampaignForm } from './campaign-form';

/**
 * Demo data for local runs, until the gateway is wired to the ads service.
 * Money shows as R --- until set (docs/wireframes/README.md), so the seed keeps
 * spend fields at 0 where a real value is not known yet.
 */
export interface CampaignRow {
  id: string;
  name: string;
  slot: string;
  status: string;
  budgetCents: number;
  spentCents: number;
  impressions: number;
  clicks: number;
}

export const DEMO_CAMPAIGNS: CampaignRow[] = [
  { id: 'c-1042', name: 'Braai season', slot: 'A4', status: 'live', budgetCents: 0, spentCents: 0, impressions: 12_400, clicks: 340 },
  { id: 'c-1041', name: 'Spring lamb launch', slot: 'A1', status: 'pending_review', budgetCents: 0, spentCents: 0, impressions: 0, clicks: 0 },
  { id: 'c-1039', name: 'Charcoal brand', slot: 'A4', status: 'draft', budgetCents: 0, spentCents: 0, impressions: 0, clicks: 0 },
];

export interface WalletEntry {
  date: string;
  item: string;
  amountCents: number;
}

/** Prepaid wallet through the payment aggregators (wireframe av-wallet). */
export const DEMO_WALLET: WalletEntry[] = [
  { date: '10 Nov', item: 'Top up', amountCents: 0 },
  { date: '11 Nov', item: 'Spend', amountCents: 0 },
];

/** A prefilled campaign for the demo, at the creative step. */
export const DEMO_FORM: CampaignForm = {
  goal: 'Launch the braai season range',
  budgetCents: 500_000,
  pricing: 'flat',
  bidCents: 0,
  slotCode: 'A4',
  targeting: { category: 'lamb', region: 'KwaZulu-Natal', buyerType: 'Household' },
  headline: 'Charcoal and spice for the braai',
  destinationUrl: 'https://amazinggoats.co.za/occasions/braai-day',
  claimsEvidenceUrl: '',
};
