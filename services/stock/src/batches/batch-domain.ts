import { Batch, BatchInput, PackSpec, StockMovement } from './batches.types';

/** Batch codes look like AG-20261118-0007: kind, packed date (SAST), sequence. */
export function formatBatchCode(packedOn: string, sequence: number): string {
  const day = packedOn.slice(0, 10).replace(/-/g, '');
  return `AG-${day}-${String(sequence).padStart(4, '0')}`;
}

/**
 * One batch record per pack in the input. A pack spec overrides the input's
 * weight and grade, so a single intake can split into several graded packs.
 */
export function createBatches(input: BatchInput, packs: PackSpec[], sequenceStart = 1): Batch[] {
  return packs.map((pack, index) => ({
    id: `batch_${formatBatchCode(input.packedOn, sequenceStart + index)}`,
    batchCode: formatBatchCode(input.packedOn, sequenceStart + index),
    sku: input.sku,
    pack: pack.pack,
    ...(input.sourceOrgId ? { sourceOrgId: input.sourceOrgId } : {}),
    ...(input.processorOrgId ? { processorOrgId: input.processorOrgId } : {}),
    ...(input.slaughteredOn ? { slaughteredOn: input.slaughteredOn } : {}),
    packedOn: input.packedOn,
    ...(input.useBy ? { useBy: input.useBy } : {}),
    grossWeightG: pack.grossWeightG ?? input.grossWeightG,
    grade: pack.grade ?? input.grade,
    halaalCertified: input.halaalCertified ?? false,
    temperatureStatus: input.temperatureStatus ?? 'ok',
    status: 'quarantine',
  }));
}

/** Released batches only; quarantine, held and recalled stock cannot be sold. */
export function isSellable(batch: Batch): boolean {
  return batch.status === 'released' && batch.temperatureStatus === 'ok';
}

/** Total physical stock for a batch across movements (in minus out). */
export function stockOnHand(movements: StockMovement[], batchId: string): number {
  return movements
    .filter((m) => m.batchId === batchId)
    .reduce((total, m) => total + (m.kind === 'in' ? m.qty : -m.qty), 0);
}
