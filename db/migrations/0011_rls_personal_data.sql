-- Row-level security for tables that hold personal or customer data.
-- Completes the set started in 0010_row_level_security.sql.
--
-- Two rules to keep in mind:
--   * Superusers and table owners BYPASS row-level security. The application
--     must connect as a role that is neither (see db/README.md). The gateway
--     sets app.staff, app.org_id and app.user_id per request after RBAC.
--   * A policy with only USING also governs INSERT and UPDATE (the USING
--     expression doubles as the WITH CHECK). Child tables inherit the parent's
--     visibility by testing the parent row, which is itself subject to RLS, so
--     a line is visible exactly when its order or invoice is.
--
-- Default is deny: with none of the settings present the expressions are NULL,
-- so no rows are visible.

-- sales: order children and per-customer rows
ALTER TABLE sales.order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_lines_owner ON sales.order_lines
  USING (EXISTS (SELECT 1 FROM sales.orders o WHERE o.id = order_id));
ALTER TABLE sales.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_events_owner ON sales.order_events
  USING (EXISTS (SELECT 1 FROM sales.orders o WHERE o.id = order_id));
ALTER TABLE sales.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY reservations_owner ON sales.reservations USING (
  current_setting('app.staff', true) = 'on'
  OR customer_user_id::text = current_setting('app.user_id', true));
ALTER TABLE sales.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_owner ON sales.subscriptions USING (
  current_setting('app.staff', true) = 'on'
  OR customer_user_id::text = current_setting('app.user_id', true));
ALTER TABLE sales.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotes_owner ON sales.quotes USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true)
  OR requester_user_id::text = current_setting('app.user_id', true));
-- Reviews are public once approved; the author sees their own drafts too.
ALTER TABLE sales.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_owner ON sales.reviews USING (
  approved = true
  OR current_setting('app.staff', true) = 'on'
  OR user_id::text = current_setting('app.user_id', true));

-- accounts: trade credit, documents and invoice children
ALTER TABLE accounts.trade_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY trade_accounts_owner ON accounts.trade_accounts USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE accounts.credit_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_applications_owner ON accounts.credit_applications USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE accounts.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_documents_owner ON accounts.documents USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE accounts.bureau_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY bureau_reports_owner ON accounts.bureau_reports USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE accounts.credit_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_limits_owner ON accounts.credit_limits USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE accounts.credit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_events_owner ON accounts.credit_events USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE accounts.sureties ENABLE ROW LEVEL SECURITY;
CREATE POLICY sureties_owner ON accounts.sureties USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE accounts.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_lines_owner ON accounts.invoice_lines
  USING (EXISTS (SELECT 1 FROM accounts.invoices i WHERE i.id = invoice_id));
ALTER TABLE accounts.allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY allocations_owner ON accounts.allocations
  USING (EXISTS (SELECT 1 FROM accounts.invoices i WHERE i.id = invoice_id));
ALTER TABLE accounts.collection_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_actions_owner ON accounts.collection_actions
  USING (EXISTS (SELECT 1 FROM accounts.invoices i WHERE i.id = invoice_id));
ALTER TABLE accounts.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY disputes_owner ON accounts.disputes
  USING (EXISTS (SELECT 1 FROM accounts.invoices i WHERE i.id = invoice_id));

-- ads: advertiser-owned rows and campaign children
ALTER TABLE ads.advertisers ENABLE ROW LEVEL SECURITY;
CREATE POLICY advertisers_owner ON ads.advertisers USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE ads.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallet_ledger_owner ON ads.wallet_ledger USING (
  current_setting('app.staff', true) = 'on'
  OR advertiser_org_id::text = current_setting('app.org_id', true));
ALTER TABLE ads.creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY creatives_owner ON ads.creatives
  USING (EXISTS (SELECT 1 FROM ads.campaigns c WHERE c.id = campaign_id));

-- partners: partner-owned rows and purchase-order children
ALTER TABLE partners.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_documents_owner ON partners.documents USING (
  current_setting('app.staff', true) = 'on'
  OR partner_org_id::text = current_setting('app.org_id', true));
ALTER TABLE partners.slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_slots_owner ON partners.slots USING (
  current_setting('app.staff', true) = 'on'
  OR partner_org_id::text = current_setting('app.org_id', true));
ALTER TABLE partners.purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_order_lines_owner ON partners.purchase_order_lines
  USING (EXISTS (SELECT 1 FROM partners.purchase_orders po WHERE po.id = purchase_order_id));

-- payments: money rows follow the order or invoice they belong to
ALTER TABLE payments.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY payouts_owner ON payments.payouts USING (
  current_setting('app.staff', true) = 'on'
  OR payee_org_id::text = current_setting('app.org_id', true));
ALTER TABLE payments.intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY intents_owner ON payments.intents USING (
  current_setting('app.staff', true) = 'on'
  OR EXISTS (SELECT 1 FROM sales.orders o WHERE o.id = order_id)
  OR EXISTS (SELECT 1 FROM accounts.invoices i WHERE i.id = invoice_id));
ALTER TABLE payments.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_owner ON payments.payments
  USING (EXISTS (SELECT 1 FROM payments.intents i WHERE i.id = intent_id));
ALTER TABLE payments.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_owner ON payments.refunds
  USING (EXISTS (SELECT 1 FROM payments.payments p WHERE p.id = payment_id));

-- logistics: delivery rows follow their order, proof of delivery follows the delivery
ALTER TABLE logistics.stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY stops_owner ON logistics.stops
  USING (EXISTS (SELECT 1 FROM sales.orders o WHERE o.id = order_id));
ALTER TABLE logistics.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY deliveries_owner ON logistics.deliveries
  USING (EXISTS (SELECT 1 FROM logistics.stops s WHERE s.id = stop_id));
ALTER TABLE logistics.proof_of_delivery ENABLE ROW LEVEL SECURITY;
CREATE POLICY proof_of_delivery_owner ON logistics.proof_of_delivery
  USING (EXISTS (SELECT 1 FROM logistics.deliveries d WHERE d.id = delivery_id));
