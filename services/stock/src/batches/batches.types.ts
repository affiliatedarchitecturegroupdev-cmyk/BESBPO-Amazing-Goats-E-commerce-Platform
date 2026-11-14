export type BatchStatus = 'quarantine' | 'released' | 'held' | 'recalled' | 'consumed';

/** One batch record, matching inventory.batches. */
export interface Batch {
  id: string;
  batchCode: string;
  sku: string;
  pack: string;
  sourceOrgId?: string;
  processorOrgId?: string;
  slaughteredOn?: string;
  packedOn?: string;
  useBy?: string;
  grossWeightG?: number;
  grade?: string;
  halaalCertified: boolean;
  temperatureStatus: string;
  status: BatchStatus;
}

export interface BatchInput {
  sku: string;
  pack: string;
  packedOn: string;
  sourceOrgId?: string;
  processorOrgId?: string;
  slaughteredOn?: string;
  useBy?: string;
  grossWeightG?: number;
  grade?: string;
  halaalCertified?: boolean;
  temperatureStatus?: string;
}

export interface PackSpec {
  pack: string;
  grossWeightG?: number;
  grade?: string;
}

/** A stock movement against a batch (inventory.stock_movements). */
export interface StockMovement {
  batchId: string;
  kind: string;
  qty: number;
  refType?: string;
  refId?: string;
  at: string;
}

/** The part of an order a recall needs: which batch each line came from. */
export interface OrderRef {
  id: string;
  lines: { sku: string; batchId?: string }[];
}
