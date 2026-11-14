import type { DayPack } from './daypack';

/** Demo day pack downloaded each morning, until the driver service feeds it. */
export const DEMO_DAY_PACK: DayPack = {
  routeName: 'Wed Durban',
  downloadedAt: '2026-11-18T05:40:00+02:00',
  stops: [
    {
      id: 'cafe-a', sequence: 1, customer: 'Cafe A', address: '1 Long St, Durban', window: '08:00',
      items: [{ name: '10 kg lamb', qty: 1 }], temperature: 'chilled', requiresSignature: false,
      instructions: 'Side entrance, ask for Thandi.',
    },
    {
      id: 'bakery-b', sequence: 2, customer: 'Bakery B', address: '12 Main Rd, Durban', window: '08:30',
      items: [{ name: '20 egg trays', qty: 20 }], temperature: 'chilled', requiresSignature: true,
      cashExpectedCents: 12000, instructions: 'Back door, ring bell.',
    },
  ],
};
