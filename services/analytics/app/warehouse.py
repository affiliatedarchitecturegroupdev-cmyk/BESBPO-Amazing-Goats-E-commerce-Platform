"""Warehouse reads for the KPI endpoint (docs/03-credit-control.md).

The KPI formulas live in ``kpis.py`` and stay pure; this module supplies their
inputs from Postgres. The analytics service runs on Koyeb against the platform
database, so the queries read the ``accounts`` and ``sales`` schemas directly and
return integer cents. Every query is date-ranged and coalesces to zero, so a
window with no rows yields zeros rather than NULL.

The SQL is kept here rather than in a migration: the analytics service owns its
read model, and the platform migrations are a gated path.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Protocol


@dataclass(frozen=True)
class KpiInputs:
    """The raw cents the pure formulas need, all defaulting to zero."""

    receivables_cents: int = 0
    credit_sales_cents: int = 0
    written_off_cents: int = 0
    revenue_cents: int = 0
    cogs_cents: int = 0


# Outstanding on open invoices as at the window end: the invoice total less what
# has been allocated to it. An invoice is receivables while it is still `open`.
RECEIVABLES_SQL = """
SELECT COALESCE(SUM(i.total_inc_vat_cents - COALESCE(a.allocated, 0)), 0)::bigint AS receivables_cents
FROM accounts.invoices i
LEFT JOIN (
  SELECT invoice_id, SUM(amount_cents) AS allocated
  FROM accounts.allocations
  GROUP BY invoice_id
) a ON a.invoice_id = i.id
WHERE i.status = 'open' AND i.issued_on <= %(to_date)s
"""

# Credit sales are the invoices issued inside the window. A void invoice was
# never a sale, so it is excluded.
CREDIT_SALES_SQL = """
SELECT COALESCE(SUM(i.total_inc_vat_cents), 0)::bigint AS credit_sales_cents
FROM accounts.invoices i
WHERE i.status <> 'void' AND i.issued_on BETWEEN %(from_date)s AND %(to_date)s
"""

# A written-off invoice is one voided after issue; the platform has no separate
# write-off ledger yet, so `void` is the proxy.
WRITTEN_OFF_SQL = """
SELECT COALESCE(SUM(i.total_inc_vat_cents), 0)::bigint AS written_off_cents
FROM accounts.invoices i
WHERE i.status = 'void' AND i.issued_on BETWEEN %(from_date)s AND %(to_date)s
"""

# Revenue is order lines ex VAT on orders created inside the window.
REVENUE_SQL = """
SELECT COALESCE(ROUND(SUM(ol.qty * ol.unit_price_ex_vat_cents)), 0)::bigint AS revenue_cents
FROM sales.order_lines ol
JOIN sales.orders o ON o.id = ol.order_id
WHERE o.created_at::date BETWEEN %(from_date)s AND %(to_date)s
"""

# Cost of goods is the same lines priced at the partner's agreed purchase price
# for the variant. Where no purchase price is on file the line costs nothing, so
# margin reads high rather than guessing a cost.
COGS_SQL = """
SELECT COALESCE(ROUND(SUM(ol.qty * COALESCE(cost.agreed_price_cents, 0))), 0)::bigint AS cogs_cents
FROM sales.order_lines ol
JOIN sales.orders o ON o.id = ol.order_id
LEFT JOIN (
  SELECT variant_id, AVG(agreed_price_cents) AS agreed_price_cents
  FROM partners.purchase_order_lines
  WHERE agreed_price_cents IS NOT NULL
  GROUP BY variant_id
) cost ON cost.variant_id = ol.variant_id
WHERE o.created_at::date BETWEEN %(from_date)s AND %(to_date)s
"""


class Warehouse(Protocol):
    """Reads the KPI inputs for a closed date range."""

    def kpi_inputs(self, from_date: date, to_date: date) -> KpiInputs: ...


class NullWarehouse:
    """Used when no database is configured; every input is zero."""

    def kpi_inputs(self, from_date: date, to_date: date) -> KpiInputs:
        return KpiInputs()


class PgWarehouse:
    """Reads the KPI inputs from Postgres via psycopg.

    psycopg is imported lazily so the service (and the unit tests) import without
    the driver installed; only a deployment with ``DATABASE_URL`` needs it.
    """

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn

    def _connect(self):
        import psycopg  # noqa: PLC0415 - optional at import time

        return psycopg.connect(self._dsn)

    @staticmethod
    def _scalar(cursor, sql: str, params: dict) -> int:
        cursor.execute(sql, params)
        row = cursor.fetchone()
        return int(row[0]) if row and row[0] is not None else 0

    def kpi_inputs(self, from_date: date, to_date: date) -> KpiInputs:
        params = {"from_date": from_date, "to_date": to_date}
        with self._connect() as conn, conn.cursor() as cur:
            return KpiInputs(
                receivables_cents=self._scalar(cur, RECEIVABLES_SQL, params),
                credit_sales_cents=self._scalar(cur, CREDIT_SALES_SQL, params),
                written_off_cents=self._scalar(cur, WRITTEN_OFF_SQL, params),
                revenue_cents=self._scalar(cur, REVENUE_SQL, params),
                cogs_cents=self._scalar(cur, COGS_SQL, params),
            )


def default_range(today: date | None = None, days: int = 30) -> tuple[date, date]:
    """The default window: the last ``days`` days, ending today (inclusive)."""
    end = today or date.today()
    return end - timedelta(days=days - 1), end
