-- Newsletter (T-069). There was no newsletter, but there was already a consent
-- rule: `decideConsent` refuses marketing without per-channel opt-in. A
-- newsletter is that rule plus a list, a provable opt-in, a working unsubscribe
-- and a paced send.
--
-- The trap this schema must not fall into: reusing `notifications.consent` as
-- the subscriber list. Consent to receive an order confirmation is not consent
-- to receive a newsletter; merging them silently converts transactional
-- recipients into a marketing list, which POPIA s18 and CPA s11 penalise
-- (ADR 0013 s3). So the list is its own table, and a subscriber reaches
-- `confirmed` only by clicking a link sent to that address.

CREATE TABLE notifications.subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  -- `pending` has not proved the address belongs to them and receives nothing
  -- marketing. `bounced` and `complained` are set by the Resend webhook (T-068)
  -- and are terminal until the person subscribes again.
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'unsubscribed', 'bounced', 'complained')),
  -- Two tokens, not one: a confirmation link and an unsubscribe link are sent in
  -- different messages, and sharing a token would let a leaked unsubscribe link
  -- confirm an address.
  confirm_token text NOT NULL,
  unsubscribe_token text NOT NULL,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  -- Where the subscription came from (`footer`, `checkout`, `popup`), so the
  -- quality of each source can be judged.
  source text NOT NULL DEFAULT 'unknown',
  -- A salted hash, never the raw address: POPIA minimisation says an IP is
  -- personal data and the platform does not need the value, only the ability to
  -- spot one source flooding the list.
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per address regardless of case: `Thabo@Example.com` and
-- `thabo@example.com` are the same person and must not become two subscribers.
CREATE UNIQUE INDEX subscribers_email_key ON notifications.subscribers (lower(email));
CREATE UNIQUE INDEX subscribers_confirm_token_key ON notifications.subscribers (confirm_token);
CREATE UNIQUE INDEX subscribers_unsubscribe_token_key ON notifications.subscribers (unsubscribe_token);
CREATE INDEX subscribers_status_idx ON notifications.subscribers (status);

CREATE TRIGGER subscribers_updated BEFORE UPDATE ON notifications.subscribers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE notifications.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body_md text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER campaigns_updated BEFORE UPDATE ON notifications.campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One row per recipient per campaign. This is what makes a send resumable: a
-- recipient with a row is skipped, so a failure mid-send neither double-sends
-- nor strands the rest. The unique index is the guarantee, not the code path.
CREATE TABLE notifications.campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES notifications.campaigns (id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL REFERENCES notifications.subscribers (id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('sent', 'suppressed', 'failed', 'skipped')),
  reason text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX campaign_sends_recipient_key
  ON notifications.campaign_sends (campaign_id, subscriber_id);
CREATE INDEX campaign_sends_campaign_idx ON notifications.campaign_sends (campaign_id, outcome);

-- The list, the campaigns and their outcomes are support-only records: the
-- routes are behind `support:manage`, so only a staff session sees them.
ALTER TABLE notifications.subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscribers_staff ON notifications.subscribers USING (
  current_setting('app.staff', true) = 'on');
ALTER TABLE notifications.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_staff ON notifications.campaigns USING (
  current_setting('app.staff', true) = 'on');
ALTER TABLE notifications.campaign_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_sends_staff ON notifications.campaign_sends USING (
  current_setting('app.staff', true) = 'on');
