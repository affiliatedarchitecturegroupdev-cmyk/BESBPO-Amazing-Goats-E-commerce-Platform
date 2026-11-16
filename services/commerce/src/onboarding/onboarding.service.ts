import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SupplierApplication,
  SupplierKind,
  SupplierOnboardingResult,
  SupplierRequirement,
  evaluateSupplierOnboarding,
  supplierChecklist,
  SUPPLIER_REQUIREMENTS,
} from './supplier-onboarding';
import { ProduceCycle, nextOpenProduceCycle, produceCycles } from './produce-cycles';

export const SUPPLIER_APPLICATION_STORE = Symbol('SUPPLIER_APPLICATION_STORE');

export interface SupplierApplicationStore {
  all(): Promise<SupplierApplication[]>;
  upsert(application: SupplierApplication): Promise<SupplierApplication>;
}

/** In-memory store used by tests and local runs until the SQL adapter lands. */
export class InMemorySupplierApplicationStore implements SupplierApplicationStore {
  private readonly byOrg = new Map<string, SupplierApplication>();

  constructor(seed: SupplierApplication[] = []) {
    for (const application of seed) this.byOrg.set(application.orgName, application);
  }

  async all(): Promise<SupplierApplication[]> {
    return [...this.byOrg.values()];
  }

  async upsert(application: SupplierApplication): Promise<SupplierApplication> {
    this.byOrg.set(application.orgName, application);
    return application;
  }
}

function isSupplierKind(value: string): value is SupplierKind {
  return value === 'dairy' || value === 'produce' || value === 'eggs';
}

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(SUPPLIER_APPLICATION_STORE) private readonly store: SupplierApplicationStore,
  ) {}

  requirements(kind: string): SupplierRequirement[] {
    if (!isSupplierKind(kind)) throw new NotFoundException(`unknown supplier kind ${kind}`);
    return SUPPLIER_REQUIREMENTS[kind];
  }

  /** Dry-run the compliance check without lodging the application. */
  evaluate(application: SupplierApplication, asOf: Date = new Date()): SupplierOnboardingResult {
    return evaluateSupplierOnboarding(application, asOf);
  }

  /** Lodge (or replace) an application and return its decision. */
  async submit(application: SupplierApplication, asOf: Date = new Date()): Promise<SupplierOnboardingResult> {
    if (!isSupplierKind(application.kind)) throw new NotFoundException(`unknown supplier kind ${application.kind}`);
    await this.store.upsert(application);
    return evaluateSupplierOnboarding(application, asOf);
  }

  async list(asOf: Date = new Date()): Promise<SupplierOnboardingResult[]> {
    const applications = await this.store.all();
    return applications.map((application) => evaluateSupplierOnboarding(application, asOf));
  }

  /** The requirements checklist for a lodged application, for the admin screen. */
  async checklist(orgName: string, asOf: Date = new Date()) {
    const application = (await this.store.all()).find((a) => a.orgName === orgName);
    if (!application) throw new NotFoundException(`unknown supplier ${orgName}`);
    return supplierChecklist(application, asOf);
  }

  produceCycles(now: Date = new Date(), count = 4): ProduceCycle[] {
    return produceCycles(now, count);
  }

  nextProduceCycle(now: Date = new Date()): ProduceCycle | null {
    return nextOpenProduceCycle(now);
  }
}
