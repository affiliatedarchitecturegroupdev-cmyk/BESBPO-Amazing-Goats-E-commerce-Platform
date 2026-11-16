import os
import unittest
import uuid
from datetime import date

from app.warehouse import PgWarehouse

# The warehouse queries read the real platform schema, so this test runs only
# when DATABASE_URL points at a migrated database (the CI db job). Otherwise it
# is skipped and the default unit run needs no database.
DSN = os.environ.get("DATABASE_URL")
requires_db = unittest.skipUnless(DSN, "DATABASE_URL is not set")


def _admin():
    import psycopg

    return psycopg.connect(DSN)


@requires_db
class WarehouseIntegrationTests(unittest.TestCase):
    """Seeds a small ledger of invoices and orders, then checks the KPI inputs."""

    @classmethod
    def setUpClass(cls):
        cls.org = str(uuid.uuid4())
        cls.user = str(uuid.uuid4())
        cls.product = str(uuid.uuid4())
        cls.variant = str(uuid.uuid4())
        cls.order = str(uuid.uuid4())
        cls.line = str(uuid.uuid4())
        cls.invoice_open = str(uuid.uuid4())
        cls.invoice_paid = str(uuid.uuid4())
        cls.invoice_void = str(uuid.uuid4())
        cls.po = str(uuid.uuid4())
        cls.today = date.today()

        with _admin() as conn, conn.cursor() as cur:
            cur.execute("INSERT INTO identity.orgs (id, kind, name) VALUES (%s,'customer','KPI IT')", [cls.org])
            cur.execute(
                "INSERT INTO identity.users (id, idp_subject, email) VALUES (%s,%s,%s)",
                [cls.user, f"kpi-{cls.user}", "kpi-it@example.co.za"],
            )
            cur.execute(
                "INSERT INTO catalog.product_lines (code, name, grp, phase) VALUES ('KP','KPI line','test',1) "
                "ON CONFLICT (code) DO NOTHING",
            )
            cur.execute(
                "INSERT INTO catalog.products (id, line_id, slug, name) "
                "VALUES (%s,(SELECT id FROM catalog.product_lines WHERE code='KP'),%s,'KPI product')",
                [cls.product, f"kpi-{cls.product}"],
            )
            cur.execute(
                "INSERT INTO catalog.variants (id, product_id, sku, unit, fulfilment, temperature, channel, phase, source_kind) "
                "VALUES (%s,%s,%s,'each','in_stock','ambient','both',1,'test')",
                [cls.variant, cls.product, f"KP-{cls.variant}"],
            )
            cur.execute(
                "INSERT INTO sales.orders (id, customer_user_id, org_id, created_at) VALUES (%s,%s,%s, now())",
                [cls.order, cls.user, cls.org],
            )
            # 10 units at R10 ex VAT = 10000 cents revenue.
            cur.execute(
                "INSERT INTO sales.order_lines (id, order_id, variant_id, qty, unit_price_ex_vat_cents, fulfilment) "
                "VALUES (%s,%s,%s,10,1000,'in_stock')",
                [cls.line, cls.order, cls.variant],
            )
            # Cost of goods for that variant: R6 a unit.
            cur.execute(
                "INSERT INTO partners.purchase_orders (id, partner_org_id, kind, status) VALUES (%s,%s,'supply','draft')",
                [cls.po, cls.org],
            )
            cur.execute(
                "INSERT INTO partners.purchase_order_lines (purchase_order_id, variant_id, qty, agreed_price_cents) "
                "VALUES (%s,%s,100,600)",
                [cls.po, cls.variant],
            )
            # Invoices: an open one with a partial allocation, a paid one and a void one.
            cur.execute(
                "INSERT INTO accounts.invoices (id, number, org_id, issued_on, due_on, subtotal_ex_vat_cents, vat_cents, total_inc_vat_cents, status) "
                "VALUES (%s,%s,%s,%s,%s,10000,1500,11500,'open')",
                [cls.invoice_open, f"KP-OPEN-{cls.invoice_open}", cls.org, cls.today, cls.today],
            )
            cur.execute(
                "INSERT INTO accounts.allocations (id, invoice_id, amount_cents) VALUES (%s,%s,1500)",
                [str(uuid.uuid4()), cls.invoice_open],
            )
            cur.execute(
                "INSERT INTO accounts.invoices (id, number, org_id, issued_on, due_on, subtotal_ex_vat_cents, vat_cents, total_inc_vat_cents, status) "
                "VALUES (%s,%s,%s,%s,%s,10000,1500,11500,'paid')",
                [cls.invoice_paid, f"KP-PAID-{cls.invoice_paid}", cls.org, cls.today, cls.today],
            )
            cur.execute(
                "INSERT INTO accounts.invoices (id, number, org_id, issued_on, due_on, subtotal_ex_vat_cents, vat_cents, total_inc_vat_cents, status) "
                "VALUES (%s,%s,%s,%s,%s,10000,1500,11500,'void')",
                [cls.invoice_void, f"KP-VOID-{cls.invoice_void}", cls.org, cls.today, cls.today],
            )

    @classmethod
    def tearDownClass(cls):
        with _admin() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM partners.purchase_order_lines WHERE purchase_order_id = %s", [cls.po])
            cur.execute("DELETE FROM partners.purchase_orders WHERE id = %s", [cls.po])
            cur.execute("DELETE FROM accounts.allocations WHERE invoice_id = %s", [cls.invoice_open])
            cur.execute(
                "DELETE FROM accounts.invoices WHERE id = ANY(%s)",
                [[cls.invoice_open, cls.invoice_paid, cls.invoice_void]],
            )
            cur.execute("DELETE FROM sales.order_lines WHERE id = %s", [cls.line])
            cur.execute("DELETE FROM sales.orders WHERE id = %s", [cls.order])
            cur.execute("DELETE FROM catalog.variants WHERE id = %s", [cls.variant])
            cur.execute("DELETE FROM catalog.products WHERE id = %s", [cls.product])
            cur.execute("DELETE FROM identity.users WHERE id = %s", [cls.user])
            cur.execute("DELETE FROM identity.orgs WHERE id = %s", [cls.org])

    @requires_db
    def test_reads_receivables_credit_sales_write_offs_revenue_and_cogs(self):
        inputs = PgWarehouse(DSN).kpi_inputs(self.today, self.today)
        # Receivables: the open invoice less its R15 allocation.
        self.assertEqual(inputs.receivables_cents, 11500 - 1500)
        # Credit sales: the open and paid invoices issued today (the void one is not a sale).
        self.assertEqual(inputs.credit_sales_cents, 11500 * 2)
        # Written off: the void invoice.
        self.assertEqual(inputs.written_off_cents, 11500)
        # Revenue: 10 x R10 = 10000; COGS: 10 x R6 = 6000.
        self.assertEqual(inputs.revenue_cents, 10000)
        self.assertEqual(inputs.cogs_cents, 6000)

    @requires_db
    def test_a_window_with_no_rows_yields_zeros(self):
        past = date(2000, 1, 1)
        inputs = PgWarehouse(DSN).kpi_inputs(past, past)
        self.assertEqual(inputs.receivables_cents, 0)
        self.assertEqual(inputs.credit_sales_cents, 0)
        self.assertEqual(inputs.written_off_cents, 0)
        self.assertEqual(inputs.revenue_cents, 0)
        self.assertEqual(inputs.cogs_cents, 0)


if __name__ == "__main__":
    unittest.main()
