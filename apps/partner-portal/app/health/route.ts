import { NextResponse } from 'next/server';
import { healthHttpStatus, healthReport } from '@ag/observability';

// Health probe for partner-portal (task T-034). The report shape matches every other
// service, so one uptime check reads them all.
export function GET() {
  const report = healthReport({ service: 'partner-portal' });
  return NextResponse.json(report, { status: healthHttpStatus(report) });
}
