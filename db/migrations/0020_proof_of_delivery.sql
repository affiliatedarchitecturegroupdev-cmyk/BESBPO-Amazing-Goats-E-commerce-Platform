-- Proof of delivery (T-065). The driver app captures a signature, a photo, a
-- probe reading and the cash taken on the stop screen (`dr-proof`), but the
-- service only had a stub, so a drop had no evidence behind it.
--
-- The driver knows a stop by its domain id (`s1`, or an order id — see
-- `stopFromOrder` in the driver app), never by the table's uuid, so the domain
-- id is the bridge column and the idempotency key: a stop is proved once, and a
-- replayed offline sync must not create a second row.

ALTER TABLE logistics.proof_of_delivery ADD COLUMN stop_ref text;
CREATE UNIQUE INDEX proof_of_delivery_stop_ref_key ON logistics.proof_of_delivery (stop_ref);

-- The probe reading is a cold-chain record (R638 of 2018), so it is stored
-- with the flag that says it was outside the band rather than dropped: refusing
-- the capture would destroy the evidence.
ALTER TABLE logistics.proof_of_delivery ADD COLUMN temperature_c numeric(4,1);
ALTER TABLE logistics.proof_of_delivery ADD COLUMN temperature_excursion boolean NOT NULL DEFAULT false;
ALTER TABLE logistics.proof_of_delivery ADD COLUMN captured_at timestamptz;

-- The 0011 policy only followed `delivery_id`, so a row a driver captured (which
-- carries a stop ref and no delivery uuid) was invisible to every session,
-- staff included — write-only evidence. The policy now reads:
--   * staff see every proof (they dispatch and audit the drops);
--   * otherwise the proof is visible exactly when its parent is: a linked
--     delivery (deliveries -> stops -> orders), a stop whose uuid is the stop
--     ref, or an order whose domain id is the stop ref — the driver app derives
--     a stop from the order (`stopFromOrder`), so that is the common case.
-- Each parent is itself RLS-governed, so a customer sees the proof of their own
-- delivery and no other, without this policy naming `app.user_id` at all — the
-- same inheritance rule 0011 uses for child tables.
-- Default is deny: with no app.* settings every clause is NULL.
DROP POLICY proof_of_delivery_owner ON logistics.proof_of_delivery;
CREATE POLICY proof_of_delivery_owner ON logistics.proof_of_delivery USING (
  current_setting('app.staff', true) = 'on'
  OR EXISTS (SELECT 1 FROM logistics.deliveries d WHERE d.id = delivery_id)
  OR EXISTS (SELECT 1 FROM logistics.stops s WHERE s.id::text = stop_ref)
  OR EXISTS (SELECT 1 FROM sales.orders o WHERE o.external_id = stop_ref)
);
