def dso(receivables_cents: int, credit_sales_cents: int, days: int) -> float:
    """Days sales outstanding."""
    return 0.0 if credit_sales_cents == 0 else round(receivables_cents / credit_sales_cents * days, 1)


def bad_debt_rate(written_off_cents: int, credit_sales_cents: int) -> float:
    return 0.0 if credit_sales_cents == 0 else round(written_off_cents / credit_sales_cents * 100, 2)


def gross_margin_pct(revenue_cents: int, cogs_cents: int) -> float:
    return 0.0 if revenue_cents == 0 else round((revenue_cents - cogs_cents) / revenue_cents * 100, 1)
