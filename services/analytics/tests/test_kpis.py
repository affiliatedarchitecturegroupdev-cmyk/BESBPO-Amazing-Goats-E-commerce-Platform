import unittest
from app.kpis import dso, bad_debt_rate, gross_margin_pct


class KpiTests(unittest.TestCase):
    def test_dso(self):
        self.assertEqual(dso(500, 1000, 30), 15.0)

    def test_bad_debt(self):
        self.assertEqual(bad_debt_rate(10, 1000), 1.0)

    def test_margin(self):
        self.assertEqual(gross_margin_pct(1000, 750), 25.0)

    def test_zero_safe(self):
        self.assertEqual(dso(1, 0, 30), 0.0)
