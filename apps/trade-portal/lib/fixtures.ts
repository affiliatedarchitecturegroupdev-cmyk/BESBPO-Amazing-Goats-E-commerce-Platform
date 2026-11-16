import type { ApplicationForm } from './application';

/**
 * Test and demo fixtures only (T-049/T-050). The pages read live data through
 * the gateway; these remain for the screens that have no endpoint yet
 * (standing orders, team) and to prefill the application form for a local run.
 */
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
