'use server';

import { redirect } from 'next/navigation';
import { DEMO_APPLICATION } from '../../lib/fixtures';
import { submitApplication as submit } from '../../lib/gateway';

/**
 * Submit the trade credit application through the gateway. The form is
 * prefilled for a local run; a real form would post the applicant's own answers.
 * The token stays on the server, and the shopper is sent back with a status.
 */
export async function submitApplication(): Promise<void> {
  const { data, error } = await submit(DEMO_APPLICATION);
  if (error || !data) {
    redirect(`/apply?error=${encodeURIComponent(error ?? 'Could not submit the application')}`);
  }
  redirect(`/apply?submitted=${encodeURIComponent(data.id)}`);
}
