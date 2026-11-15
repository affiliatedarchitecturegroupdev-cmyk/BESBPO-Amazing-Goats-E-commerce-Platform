import { DunningStep } from './dunning.rules';

export interface CollectionActionRecord {
  id: string;
  invoiceId: string;
  step: DunningStep;
  scheduledAt: string;
  doneAt?: string;
  byUser?: string;
}
