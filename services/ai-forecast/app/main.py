from fastapi import FastAPI
from pydantic import BaseModel
from .forecast import moving_average_forecast, suggest_buy

app = FastAPI(title="ag-ai-forecast")


class ForecastIn(BaseModel):
    history: list[float]
    window: int = 4
    horizon: int = 1


class BuyIn(BaseModel):
    forecast_units: float
    on_hand: float = 0
    safety: float = 0.1
    pack: int = 1


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-forecast"}


@app.post("/forecast")
def forecast(body: ForecastIn):
    return {"forecast": moving_average_forecast(body.history, body.window, body.horizon)}


@app.post("/suggest-buy")
def buy(body: BuyIn):
    # TODO(agent): persist suggestions as drafts that a buyer must approve
    return {"units": suggest_buy(body.forecast_units, body.on_hand, body.safety, body.pack), "status": "draft"}
