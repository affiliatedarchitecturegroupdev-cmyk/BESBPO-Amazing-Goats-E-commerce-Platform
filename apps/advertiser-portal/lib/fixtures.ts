import type { Campaign, WalletSummary } from '@ag/api-client';
import type { CampaignForm } from './campaign-form';

/**
 * Fixtures only (T-050): demo data so specs can exercise the real mapping and
 * rendering code without a running gateway. Money shows as R --- until set.
 */
export const FIXTURE_CAMPAIGNS: Campaign[] = [
  { id: 'c-1042', advertiserOrgId: 'org-demo', name: 'Braai season', goal: 'Launch the braai season range', budgetCents: 500000, spentCents: 0, pricing: 'flat', status: 'live', targeting: { category: 'lamb', region: 'KwaZulu-Natal', buyerType: 'Household' } },
  { id: 'c-1041', advertiserOrgId: 'org-demo', name: 'Spring lamb launch', goal: 'Launch', budgetCents: 300000, spentCents: 0, pricing: 'cpc', bidCents: 250, status: 'pending_review', targeting: {} },
  { id: 'c-1039', advertiserOrgId: 'org-demo', name: 'Charcoal brand', goal: 'Brand', budgetCents: 100000, spentCents: 0, pricing: 'flat', status: 'draft', targeting: {} },
];

export const FIXTURE_WALLET: WalletSummary = {
  advertiserOrgId: 'org-demo',
  balanceCents: 0,
  ledger: [
    { id: 'w-1', kind: 'top_up', amountCents: 0, at: '2026-11-10T08:00:00Z' },
    { id: 'w-2', kind: 'spend', amountCents: 0, at: '2026-11-11T08:00:00Z' },
  ],
};

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
