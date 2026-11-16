import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CATALOGUE_STORE } from '../catalog/catalog.service';
import { CatalogueStore } from '../catalog/catalog.store';
import { parseWeightG } from '../catalog/catalogue-mapping';
import { LabelCompliance, LabelPreview, buildLabel, dateHasPassed, missingComplianceFields } from './label';

export const COMPLIANCE_STORE = Symbol('COMPLIANCE_STORE');

export interface ComplianceStore {
  all(): Promise<LabelCompliance[]>;
  get(sku: string): Promise<LabelCompliance | undefined>;
  upsert(record: LabelCompliance & { variantSku: string }): Promise<LabelCompliance>;
}

export class InMemoryComplianceStore implements ComplianceStore {
  private readonly bySku = new Map<string, LabelCompliance>();

  constructor(seed: Array<LabelCompliance & { variantSku: string }> = []) {
    for (const record of seed) this.bySku.set(record.variantSku, record);
  }

  async all(): Promise<LabelCompliance[]> {
    return [...this.bySku.values()];
  }

  async get(sku: string): Promise<LabelCompliance | undefined> {
    return this.bySku.get(sku);
  }

  async upsert(record: LabelCompliance & { variantSku: string }): Promise<LabelCompliance> {
    this.bySku.set(record.variantSku, record);
    return record;
  }
}

export interface LabelPreviewOptions {
  asOf?: Date;
  responsibleParty?: { name: string; address: string } | null;
  batchNo?: string | null;
  dateMarking?: string | null;
  storageInstructions?: string | null;
  countryOfOrigin?: string | null;
  ingredients?: string[] | null;
}

@Injectable()
export class ComplianceService {
  constructor(
    @Inject(CATALOGUE_STORE) private readonly catalogue: CatalogueStore,
    @Inject(COMPLIANCE_STORE) private readonly store: ComplianceStore,
  ) {}

  async get(sku: string): Promise<LabelCompliance & { variantSku: string }> {
    const record = (await this.store.get(sku)) as (LabelCompliance & { variantSku: string }) | undefined;
    if (!record) throw new NotFoundException(`unknown sku ${sku}`);
    return record;
  }

  /** Update the compliance fields a rule set needs (class/grade, packer, pack station). */
  async set(
    sku: string,
    fields: Partial<Omit<LabelCompliance, 'ruleSet'>>,
  ): Promise<LabelCompliance & { variantSku: string }> {
    const existing = (await this.store.get(sku)) as (LabelCompliance & { variantSku: string }) | undefined;
    if (!existing) throw new NotFoundException(`unknown sku ${sku}`);
    return (await this.store.upsert({ ...existing, ...fields, variantSku: sku })) as LabelCompliance & {
      variantSku: string;
    };
  }

  /**
   * Build the R146 label preview for a variant. The product name, pack and net
   * weight come from the catalogue; the rule set, class/grade and packer come
   * from the compliance row. A certificate that has lapsed is reported as
   * `certificateExpired`, alongside the `missing` fields.
   */
  async labelPreview(
    sku: string,
    options: LabelPreviewOptions = {},
  ): Promise<LabelPreview & { sku: string; certificateExpired: boolean }> {
    const item = await this.catalogue.get(sku);
    if (!item) throw new NotFoundException(`unknown sku ${sku}`);
    const compliance = (await this.store.get(sku)) ?? { ruleSet: 'general' };
    const asOf = options.asOf ?? new Date();

    const preview = buildLabel({
      productName: item.name,
      pack: item.pack,
      netWeightG: parseWeightG(item.pack),
      ingredients: options.ingredients ?? null,
      responsibleParty: options.responsibleParty ?? null,
      countryOfOrigin: options.countryOfOrigin ?? 'South Africa',
      batchNo: options.batchNo ?? null,
      dateMarking: options.dateMarking ?? null,
      storageInstructions: options.storageInstructions ?? null,
      compliance,
    });

    return { ...preview, sku, certificateExpired: dateHasPassed(compliance.certificateExpiry, asOf) };
  }

  /**
   * Every variant whose compliance row still has a static gap: the class/grade,
   * pack station or ingredient list its rule set requires and that is still
   * blank. These are the fields an admin fills on `product_compliance`; the
   * per-pack fields (batch, date marking) are added at packing time and are not
   * part of this report.
   */
  async incompleteLabels(): Promise<Array<{ sku: string; ruleSet: string; missing: string[] }>> {
    const items = await this.catalogue.all();
    const rows = await Promise.all(
      items.map(async (item) => {
        const compliance = (await this.store.get(item.sku)) ?? { ruleSet: 'general' };
        return { sku: item.sku, ruleSet: compliance.ruleSet, missing: missingComplianceFields(compliance) as string[] };
      }),
    );
    return rows.filter((row) => row.missing.length > 0);
  }
}
