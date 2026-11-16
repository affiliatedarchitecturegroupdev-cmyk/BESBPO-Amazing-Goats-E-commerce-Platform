import unittest
from datetime import date
from unittest import mock

from fastapi.testclient import TestClient

from app import main
from app.warehouse import KpiInputs, NullWarehouse, default_range


class FakeWarehouse:
    """A warehouse whose inputs are fixed, so the endpoint's wiring is testable."""

    def __init__(self, inputs: KpiInputs):
        self.inputs = inputs
        self.calls: list[tuple[date, date]] = []

    def kpi_inputs(self, from_date: date, to_date: date) -> KpiInputs:
        self.calls.append((from_date, to_date))
        return self.inputs


class KpiEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_returns_zeros_when_the_warehouse_has_no_data(self):
        with mock.patch.object(main, "_warehouse", lambda: NullWarehouse()):
            response = self.client.get("/kpis")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["dso"], 0.0)
        self.assertEqual(body["bad_debt_pct"], 0.0)
        self.assertEqual(body["gross_margin_pct"], 0.0)
        self.assertIn("from_date", body)
        self.assertIn("to_date", body)

    def test_computes_kpis_from_the_warehouse_inputs(self):
        fake = FakeWarehouse(
            KpiInputs(
                receivables_cents=500,
                credit_sales_cents=1000,
                written_off_cents=10,
                revenue_cents=1000,
                cogs_cents=750,
            )
        )
        with mock.patch.object(main, "_warehouse", lambda: fake):
            body = self.client.get("/kpis?days=30").json()
        self.assertEqual(body["dso"], 15.0)
        self.assertEqual(body["bad_debt_pct"], 1.0)
        self.assertEqual(body["gross_margin_pct"], 25.0)
        # The window is passed through to the warehouse.
        self.assertEqual(fake.calls, [default_range(days=30)])

    def test_accepts_an_explicit_date_range(self):
        fake = FakeWarehouse(KpiInputs())
        with mock.patch.object(main, "_warehouse", lambda: fake):
            response = self.client.get("/kpis?from_date=2026-11-01&to_date=2026-11-14")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(fake.calls, [(date(2026, 11, 1), date(2026, 11, 14))])

    def test_rejects_an_inverted_range(self):
        with mock.patch.object(main, "_warehouse", lambda: NullWarehouse()):
            response = self.client.get("/kpis?from_date=2026-11-14&to_date=2026-11-01")
        self.assertEqual(response.status_code, 422)


class DefaultRangeTests(unittest.TestCase):
    def test_default_window_is_inclusive_of_today(self):
        start, end = default_range(today=date(2026, 11, 14), days=30)
        self.assertEqual(end, date(2026, 11, 14))
        self.assertEqual((end - start).days, 29)


if __name__ == "__main__":
    unittest.main()
