import os
from datetime import date

from fastapi import FastAPI, HTTPException

from .kpis import bad_debt_rate, dso, gross_margin_pct
from .warehouse import NullWarehouse, PgWarehouse, default_range

app = FastAPI(title="ag-analytics")


def _warehouse():
    """The warehouse for this process: Postgres when DATABASE_URL is set, else zeros."""
    dsn = os.environ.get("DATABASE_URL")
    return PgWarehouse(dsn) if dsn else NullWarehouse()


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics"}


@app.get("/kpis")
def kpis(from_date: date | None = None, to_date: date | None = None, days: int = 30):
    """DSO, bad-debt rate and gross margin over a date range.

    With no dates, the window is the last ``days`` days ending today. The inputs
    are read from the warehouse views over ``accounts`` and ``sales``; a window
    with no rows yields zeros.
    """
    default_from, default_to = default_range(days=days)
    start = from_date or default_from
    end = to_date or default_to
    if start > end:
        raise HTTPException(status_code=422, detail="from_date must be on or before to_date")

    inputs = _warehouse().kpi_inputs(start, end)
    return {
        "from_date": start.isoformat(),
        "to_date": end.isoformat(),
        "dso": dso(inputs.receivables_cents, inputs.credit_sales_cents, days),
        "bad_debt_pct": bad_debt_rate(inputs.written_off_cents, inputs.credit_sales_cents),
        "gross_margin_pct": gross_margin_pct(inputs.revenue_cents, inputs.cogs_cents),
    }
