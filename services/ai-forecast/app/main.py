from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .forecast import moving_average_forecast, suggest_buy
from .suggestions import (
    InMemorySuggestionStore,
    SuggestionError,
    approve,
    new_suggestion,
)

app = FastAPI(title="ag-ai-forecast")

# One store per process. Suggestions are drafts a buyer promotes; nothing here
# decides the numbers, the forecast maths does.
_store = InMemorySuggestionStore()


class ForecastIn(BaseModel):
    history: list[float]
    window: int = 4
    horizon: int = 1


class BuyIn(BaseModel):
    forecast_units: float
    on_hand: float = 0
    safety: float = 0.1
    pack: int = 1


class ApproveIn(BaseModel):
    approved_by: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-forecast"}


@app.post("/forecast")
def forecast(body: ForecastIn):
    return {"forecast": moving_average_forecast(body.history, body.window, body.horizon)}


@app.post("/suggest-buy")
def buy(body: BuyIn):
    """Persist a buy suggestion as a draft a buyer must approve."""
    units = suggest_buy(body.forecast_units, body.on_hand, body.safety, body.pack)
    return _store.add(
        new_suggestion(units, body.forecast_units, body.on_hand, body.safety, body.pack)
    )


@app.get("/suggestions")
def list_suggestions(status: str | None = None):
    """List suggestions, newest first; filter by status (e.g. `draft`)."""
    return _store.list(status)


@app.post("/suggestions/{suggestion_id}/approve")
def approve_suggestion(suggestion_id: str, body: ApproveIn):
    """Promote a draft suggestion. A named person is recorded as the approver."""
    suggestion = _store.get(suggestion_id)
    if suggestion is None:
        raise HTTPException(status_code=404, detail=f"unknown suggestion {suggestion_id}")
    try:
        return _store.replace(approve(suggestion, body.approved_by))
    except SuggestionError as err:
        raise HTTPException(status_code=409, detail=str(err)) from err
