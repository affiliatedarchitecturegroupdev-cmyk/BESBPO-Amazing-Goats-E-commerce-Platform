# Ezimbuzini Ads (retail media)
Slots A1 to A12 are seeded in `db/seeds/001_roles_permissions.sql`: A1 home hero, A2 home band, A3 category top, A4 grid tiles (positions 3, 7, 11), A5 search top 2, A6 product strip, A7 cart cross-sell, A8 order confirmation, A9 recipes, A10 footer partners, A11 email and WhatsApp, A12 box inserts.

Rules: label every ad Sponsored; at most 2 ads per view and one in five grid tiles; category relevance first; human review before go-live; claims evidence required; no health or medical claims (R146 applies to advertising on websites); no ads to children; frequency caps; takedown within hours; advertiser warranty and indemnity in the contract; direct marketing only with recorded opt-in.

Decision logic: `services/ads/src/decisioning/select-ads.ts` (tested). Pricing: flat for premium slots, CPC for product tiles, CPM for banners. Start with manual slots and our own promotions; open self-service when traffic supports it.

The ads stores are in-memory by default; `STORE_DRIVER=sql` selects the SQL adapters over the `ads` schema (`campaigns`, `creatives`, `wallet_ledger`, `impressions`, `clicks`). An advertiser's campaigns and ledger are scoped by row-level security to their organisation, so a non-staff session sees only their own rows.
