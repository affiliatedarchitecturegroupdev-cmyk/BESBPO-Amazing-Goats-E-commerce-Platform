-- Chargebacks raised by a provider against a payment, and the payout they claw
-- back. The domain models these (services/payments/src/chargebacks) but the
-- payments schema in 0008 did not have a table for them; the store swap needs
-- one. A chargeback freezes its payout before the money leaves, so the payout is
-- a first-class reference, not a free-text note.
CREATE TABLE payments.chargebacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES payments.payments(id),
  payout_id uuid REFERENCES payments.payouts(id),
  provider text NOT NULL,
  amount_cents bigint NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now()
);

-- A chargeback follows the payment it disputes, exactly as a refund does, so the
-- row is visible when its payment is.
ALTER TABLE payments.chargebacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY chargebacks_owner ON payments.chargebacks
  USING (EXISTS (SELECT 1 FROM payments.payments p WHERE p.id = payment_id));

-- The domain intent (services/payments/src/providers/payment-intent.ts) records
-- which provider handled it and the provider's own reference, and a webhook finds
-- the intent by that reference. 0008 put provider_ref only on payments.payments;
-- the intent store needs it on the intent row it owns. The partial unique index
-- mirrors the one on payments.payments, so a provider reference maps to one intent.
ALTER TABLE payments.intents ADD COLUMN provider_ref text;
CREATE UNIQUE INDEX intents_provider_ref_key ON payments.intents (provider, provider_ref)
  WHERE provider_ref IS NOT NULL;

