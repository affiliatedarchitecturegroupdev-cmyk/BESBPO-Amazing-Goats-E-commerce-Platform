'use server';

import { redirect } from 'next/navigation';
import { ApiError } from '@ag/api-client';
import { adminClient } from '../../lib/gateway';

/**
 * Ask for a time-limited elevation (break-glass). The request is made on the
 * server, so the caller's bearer token never reaches the browser; a failure
 * sends the operator back to the screen with a plain reason.
 */
export async function requestElevation(formData: FormData): Promise<void> {
  const subjectId = String(formData.get('subjectId') ?? '');
  const role = String(formData.get('role') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const minutes = Number(formData.get('minutes') ?? 0);

  try {
    await adminClient().requestElevation({ subjectId, role, reason, minutes });
  } catch (err) {
    const code = err instanceof ApiError && err.status === 403 ? 'denied' : 'failed';
    redirect(`/roles?error=${code}`);
  }
  redirect('/roles?requested=1');
}
