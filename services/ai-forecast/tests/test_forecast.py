import unittest
from app.forecast import moving_average_forecast, suggest_buy


class ForecastTests(unittest.TestCase):
    def test_moving_average(self):
        self.assertEqual(moving_average_forecast([10, 20, 30, 40], window=4), [25.0])

    def test_empty_history(self):
        self.assertEqual(moving_average_forecast([], horizon=2), [0.0, 0.0])

    def test_suggest_buy_rounds_up_to_pack(self):
        self.assertEqual(suggest_buy(100, 20, safety=0.1, pack=10), 90)

    def test_suggest_buy_never_negative(self):
        self.assertEqual(suggest_buy(10, 50), 0)
