# Payments orchestration
One payment service hides providers. Routing and fee model: `services/payments/src/routing/route-payment.ts` (tested).

| Method | Order tried | Notes |
|---|---|---|
| Pay by bank | Stitch, Peach, PayFast | Capitec Pay, PayShap Request, Instant EFT. Show first, offer about 1% discount. |
| Card | Peach, PayFast, Stitch | Hosted fields only (PCI scope minimal), 3D Secure |
| Wallet, BNPL | PayFast, Peach | Payflex, Float, MoreTyme, Mobicred |
| Recurring debit | Stitch | Trade collections |
| Escrow | TradeSafe | From R10,000 (minimum fee); farm-gate purchases |
| Trade terms | LulaPay | Pilot, behind a feature flag |
| Point of sale | Yoco | Farm shop |

Published fees (excluding VAT, November 2026, to be confirmed in writing): PayFast card 3.2% + R2, Instant EFT 2% (min R2); Peach about 2.95% + R1.50 cards, 1.5% + R1.50 pay by bank; Stitch 2.95% cards. On a R3,105 box: card R92 to R101, pay by bank about R47 to R62. Needs: idempotency keys, signed webhooks, daily settlement reconciliation, refunds with second approver above a limit, chargeback handling, partner payouts with second approver, accounting sync.
