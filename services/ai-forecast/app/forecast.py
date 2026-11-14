"""Pure forecasting helpers. Principle: the system proposes, a person approves."""
from typing import List


def moving_average_forecast(history: List[float], window: int = 4, horizon: int = 1) -> List[float]:
    if not history:
        return [0.0] * horizon
    series = list(history)
    out: List[float] = []
    for _ in range(horizon):
        recent = series[-window:]
        nxt = sum(recent) / len(recent)
        out.append(round(nxt, 2))
        series.append(nxt)
    return out


def suggest_buy(forecast_units: float, on_hand: float, safety: float = 0.1, pack: int = 1) -> int:
    """Units to buy for the next cycle, rounded up to a pack size."""
    need = max(0.0, round(forecast_units * (1 + safety) - on_hand, 6))
    packs = -(-need // pack)  # ceil
    return int(packs * pack)
