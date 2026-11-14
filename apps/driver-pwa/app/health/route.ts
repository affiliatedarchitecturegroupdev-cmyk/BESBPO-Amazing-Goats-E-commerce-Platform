import { NextResponse } from 'next/server';
import { healthHttpStatus, healthReport } from '@ag/observability';

// Health probe for driver-pwa (task T-034). The report shape matches every other
// service, so one uptime check reads them all.
export function GET() {
  const report = healthReport({ service: 'driver-pwa' });
  return NextResponse.json(report, { status: healthHttpStatus(report) });
}
