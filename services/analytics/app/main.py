from fastapi import FastAPI
from .kpis import dso, bad_debt_rate, gross_margin_pct

app = FastAPI(title="ag-analytics")


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics"}


@app.get("/kpis")
def kpis(receivables_cents: int = 0, credit_sales_cents: int = 0, days: int = 30, written_off_cents: int = 0, revenue_cents: int = 0, cogs_cents: int = 0):
    # TODO(agent): read from the warehouse views instead of query parameters
    return {"dso": dso(receivables_cents, credit_sales_cents, days), "bad_debt_pct": bad_debt_rate(written_off_cents, credit_sales_cents), "gross_margin_pct": gross_margin_pct(revenue_cents, cogs_cents)}
