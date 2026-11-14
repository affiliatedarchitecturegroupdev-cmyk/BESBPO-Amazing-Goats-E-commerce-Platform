-- Services set app.org_id and app.user_id per request. Staff roles bypass with app.staff = 'on' (set only by the gateway after RBAC).
ALTER TABLE sales.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_owner ON sales.orders USING (current_setting('app.staff', true) = 'on' OR org_id::text = current_setting('app.org_id', true) OR customer_user_id::text = current_setting('app.user_id', true));
ALTER TABLE accounts.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_owner ON accounts.invoices USING (current_setting('app.staff', true) = 'on' OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE sales.standing_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY standing_owner ON sales.standing_orders USING (current_setting('app.staff', true) = 'on' OR org_id::text = current_setting('app.org_id', true));
ALTER TABLE ads.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_owner ON ads.campaigns USING (current_setting('app.staff', true) = 'on' OR advertiser_org_id::text = current_setting('app.org_id', true));
ALTER TABLE partners.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_owner ON partners.purchase_orders USING (current_setting('app.staff', true) = 'on' OR partner_org_id::text = current_setting('app.org_id', true));
-- TODO(T-002): add policies for every table that holds personal or customer data, and test them.
