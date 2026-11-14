import { NextResponse } from 'next/server';
import { healthHttpStatus, healthReport } from '@ag/observability';

// Health probe for the storefront (task T-034). Returns 200 with an ok report;
// the shared shape matches every other service so one uptime check reads all.
export function GET() {
  const report = healthReport({ service: 'storefront' });
  return NextResponse.json(report, { status: healthHttpStatus(report) });
}
