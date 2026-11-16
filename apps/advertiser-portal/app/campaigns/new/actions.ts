'use server';

import { redirect } from 'next/navigation';
import { draftCampaign } from '../../../lib/gateway';
import { validate, type CampaignForm, type Pricing, type SlotCode } from '../../../lib/campaign-form';

function readForm(formData: FormData): CampaignForm {
  return {
    goal: String(formData.get('goal') ?? ''),
    budgetCents: Math.round(Number(formData.get('budgetRands') ?? 0) * 100),
    pricing: String(formData.get('pricing') ?? 'flat') as Pricing,
    bidCents: Math.round(Number(formData.get('bidCents') ?? 0)),
    slotCode: String(formData.get('slotCode') ?? '') as SlotCode | '',
    targeting: {
      category: String(formData.get('category') ?? ''),
      region: String(formData.get('region') ?? ''),
      buyerType: String(formData.get('buyerType') ?? 'Household'),
    },
    headline: String(formData.get('headline') ?? ''),
    destinationUrl: String(formData.get('destinationUrl') ?? ''),
    claimsEvidenceUrl: String(formData.get('claimsEvidenceUrl') ?? ''),
  };
}

/**
 * Draft and submit a campaign through the gateway. The write runs on the
 * server, so the caller's bearer token never reaches the browser. The service
 * re-validates the rules (no health claims, evidence for any claim), so the
 * form's own check is a courtesy, not the gate.
 */
export async function submitCampaign(formData: FormData): Promise<void> {
  const form = readForm(formData);
  if (!validate(form).ok) redirect('/campaigns/new?error=invalid');

  const { data } = await draftCampaign(form);
  if (!data) redirect('/campaigns/new?error=service');
  redirect(`/?created=${encodeURIComponent(data.id)}`);
}
