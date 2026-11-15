import type { CreditTier } from '@ag/shared-types';
import type { ApplicationForm } from './application';

/**
 * Demo data for local runs, until the gateway is wired to accounts and commerce.
 * Prices show as R --- until set (docs/wireframes/README.md), so the seed keeps
 * money fields as 0 where a real value is not known yet.
 */
export interface TradeAccount {
  orgName: string;
  tier: CreditTier;
  monthsClean: number;
  limitCents: number;
  usedCents: number;
  nextDelivery: string;
}

export const DEMO_ACCOUNT: TradeAccount = {
  orgName: 'Durban Butchery Co.',
  tier: 'standard',
  monthsClean: 3,
  limitCents: 10_000_000,
  usedCents: 6_200_000,
  nextDelivery: 'Wed 04:00 to 07:00 (bakery slot)',
};

export interface Alert {
  id: string;
  text: string;
  action: string;
}

export const DEMO_ALERTS: Alert[] = [
  { id: 'due', text: 'Invoice due in 3 days', action: 'Pay' },
];

/** A prefilled application for the demo, at the documents step. */
export const DEMO_APPLICATION: ApplicationForm = {
  businessType: 'butchery',
  registrationNumber: '2019/123456/07',
  turnoverDeclaredCents: 2_000_000_000,
  weeklyVolumes: [
    { item: 'Lamb carcasses', qty: 5 },
    { item: 'Chicken (kg)', qty: 40 },
    { item: 'Egg trays', qty: 20 },
  ],
  documents: {
    company_registration: 'verified',
    vat_certificate: 'verified',
    certificate_of_acceptability: 'uploaded',
    bank_letter: 'missing',
  },
  requestedLimitCents: 5_000_000,
  requestedTermsDays: 14,
  consentGiven: true,
};

export const DEMO_STATEMENTS = [
  { invoice: 'INV-0412', due: '14 Nov', status: 'Due' },
  { invoice: 'INV-0406', due: '07 Nov', status: 'Paid' },
];

export const DEMO_STANDING_ORDERS = [
  { day: 'Mon', items: '2 lamb carcasses' },
  { day: 'Wed', items: '20 egg trays' },
  { day: 'Fri', items: '1 lamb carcass' },
];

export const DEMO_TEAM = [
  { name: 'Owner', role: 'Owner', detail: '' },
  { name: 'Buyer', role: 'Buyer', detail: 'Limit R ---' },
  { name: 'Accounts', role: 'Accounts', detail: 'Invoices only' },
];
