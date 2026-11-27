'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError } from '@ag/api-client';
import { gatewayClient } from '../../lib/gateway';

const ACCOUNT_PATH = '/account';

/**
 * Pause or resume one of the shopper's subscriptions (`/account`, T-056).
 *
 * The write goes through the gateway on the server, so the bearer token never
 * reaches the browser. Ownership is decided by the service from the session, not
 * from anything this form sends: the id is the only thing the browser supplies,
 * and a subscription the caller does not own answers 404, which is reported as
 * "no longer available" rather than confirming the id exists.
 */
export async function setSubscriptionPaused(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  const paused = String(formData.get('paused') ?? '') === 'true';
  if (!id) redirect(`${ACCOUNT_PATH}?subscription=error`);

  try {
    const client = gatewayClient();
    if (paused) await client.pauseSubscription(id);
    else await client.resumeSubscription(id);
  } catch (err) {
    const reason = err instanceof ApiError && err.status === 401 ? 'signin' : 'error';
    redirect(`${ACCOUNT_PATH}?subscription=${reason}`);
  }

  revalidatePath(ACCOUNT_PATH);
  redirect(`${ACCOUNT_PATH}?subscription=${paused ? 'paused' : 'resumed'}`);
}
