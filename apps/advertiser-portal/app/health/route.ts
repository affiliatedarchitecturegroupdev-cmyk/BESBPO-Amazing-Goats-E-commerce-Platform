import { NextResponse } from 'next/server';
import { healthHttpStatus, healthReport } from '@ag/observability';

// Health probe for advertiser-portal (task T-034). The report shape matches every other
// service, so one uptime check reads them all.
export function GET() {
  const report = healthReport({ service: 'advertiser-portal' });
  return NextResponse.json(report, { status: healthHttpStatus(report) });
}
