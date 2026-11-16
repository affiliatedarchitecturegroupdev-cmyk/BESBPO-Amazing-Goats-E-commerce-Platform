'use server';

import { redirect } from 'next/navigation';
import { confirmSlot } from '../lib/gateway';

/**
 * Confirm a slaughter slot through the gateway. The write runs on the server,
 * so the caller's bearer token never reaches the browser; a failure sends the
 * partner back to the slots screen with a plain reason.
 */
export async function confirmSlotAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const { data } = await confirmSlot(id);
  redirect(data ? '/?confirmed=1' : '/?error=failed');
}
