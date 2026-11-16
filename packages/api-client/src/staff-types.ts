import type { CycleStatus, Money, OrderStatus } from '@ag/shared-types';

/**
 * Response shapes for the staff and partner portals. They mirror what each
 * service returns over the gateway (the services own the schemas; these are the
 * transport copies the apps render). Kept apart from `index.ts` so the endpoint
 * surface there stays readable.
 */

/** A cut-off cycle row, matching commerce `CycleRecord` (times as ISO strings). */
export interface CycleRecord {
  id: string;
  productClass: string;
  cutoffAt: string;
  tradeLockAt?: string;
  topUpUntil?: string;
  slaughterOn?: string;
  deliveryFrom: string;
  deliveryTo: string;
  status: CycleStatus;
}

/** A stock batch, matching stock `Batch`. */
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
  status: 'quarantine' | 'released' | 'held' | 'recalled' | 'consumed';
}

/** A delivery route, matching logistics `Route`. */
export interface DeliveryRoute {
  id: string;
  name: string;
  dayOfWeek: number;
  zoneId?: number;
  vehicleId?: string;
  capacityBoxes?: number;
}

/** One row of the append-only audit log, matching identity `AuditRecord`. */
export interface AuditRecord {
  at: string;
  actorUserId?: string;
  actorRoles?: string[];
  action: string;
  entity: string;
  entityId?: string;
  ip?: string;
  requestId?: string;
  approvedBy?: string;
}

export type InvoiceStatus = 'open' | 'paid' | 'void';

export interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  unitExVatCents: Money;
  totalExVatCents: Money;
}

/** A trade invoice, matching accounts `Invoice`. */
export interface Invoice {
  id: string;
  number: string;
  orgId: string;
  orderId?: string;
  issuedOn: string;
  dueOn: string;
  subtotalExVatCents: Money;
  vatCents: Money;
  totalIncVatCents: Money;
  status: InvoiceStatus;
  lines: InvoiceLine[];
}

/** A scheduled dunning step, matching accounts `CollectionActionRecord`. */
export interface CollectionAction {
  id: string;
  invoiceId: string;
  step: string;
  scheduledAt: string;
  doneAt?: string;
  byUser?: string;
}

/** A provider settlement, matching payments `Settlement`. Integer cents. */
export interface Settlement {
  id: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  grossCents: Money;
  feesCents: Money;
  netCents: Money;
  bankRef: string;
  matched: boolean;
}

export type PriceListStatus = 'draft' | 'pending_approval' | 'published' | 'superseded';

export interface PriceListItem {
  sku: string;
  priceExVatCents: Money;
  unitPriceBasis: string;
}

/** A price list, matching commerce `PriceList`. */
export interface PriceList {
  id: string;
  code: string;
  name: string;
  audience: string;
  validFrom: string;
  validTo: string | null;
  status: PriceListStatus;
  items: PriceListItem[];
  requestedBy?: string;
  approvedBy?: string;
  publishedAt?: string;
}

/** A merchandising section, matching commerce `MerchSection`. */
export interface MerchSection {
  id: string;
  code: string;
  title: string;
  page: string;
  sort: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

/** A slaughter slot a partner can book, matching partners `SlaughterSlot`. */
export interface SlaughterSlot {
  id: string;
  orgId: string;
  date: string;
  capacity: number;
  booked: number;
  confirmed: boolean;
  halaal: boolean;
}

/** A purchase order a farm partner fulfils, matching partners `PurchaseOrder`. */
export interface PurchaseOrder {
  id: string;
  orgId: string;
  code: string;
  description: string;
  date: string;
  status: 'draft' | 'sent' | 'confirmed';
  grades?: string;
}

/** A compliance document a partner must keep current. */
export interface PartnerDocument {
  id: string;
  orgId: string;
  name: string;
  expiresOn: string;
}

export type CampaignStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'live'
  | 'paused'
  | 'ended'
  | 'rejected';

export interface AdTargeting {
  category?: string;
  region?: string;
  buyerType?: string;
}

/** A retail-media campaign, matching ads `Campaign`. */
export interface Campaign {
  id: string;
  advertiserOrgId: string;
  name: string;
  goal: string;
  budgetCents: Money;
  spentCents: Money;
  pricing: 'flat' | 'cpc' | 'cpm';
  bidCents?: Money;
  startsAt?: string;
  endsAt?: string;
  status: CampaignStatus;
  targeting: AdTargeting;
  submittedAt?: string;
  reviewedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
}

/** What the advertiser portal sends to draft a campaign. */
export interface CampaignInput {
  advertiserOrgId: string;
  name: string;
  goal: string;
  budgetCents: Money;
  pricing: 'flat' | 'cpc' | 'cpm';
  bidCents?: Money;
  startsAt?: string;
  endsAt?: string;
  targeting?: AdTargeting;
}

/** An advertiser wallet: its balance and the movements that produced it. */
export interface WalletSummary {
  advertiserOrgId: string;
  balanceCents: Money;
  ledger: { id: string; kind: string; amountCents: Money; ref?: string; at: string }[];
}

/** One ledger row the advertiser portal shows. */
export interface WalletEntry {
  id: string;
  kind: string;
  amountCents: Money;
  ref?: string;
  at: string;
}

/** A creative row from the ads review queue. */
export interface Creative {
  id: string;
  campaignId: string;
  slotCode: string;
  assetUrl: string;
  headline?: string;
  destinationUrl?: string;
  claimsEvidenceUrl?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: string;
}

/** Retail-media reporting totals, matching ads `AdReport`. */
export interface AdReport {
  impressions: number;
  clicks: number;
  clickThroughPct: number;
  rows?: { creativeId: string; impressions: number; clicks: number }[];
}

/** The analytics service KPI window (FastAPI `/kpis`). */
export interface KpiReport {
  from_date: string;
  to_date: string;
  dso: number;
  bad_debt_pct: number;
  gross_margin_pct: number;
}

/** A driver event as the logistics sync endpoint accepts it. */
export interface DriverEventInput {
  id: string;
  deviceId: string;
  type: 'arrived' | 'delivered' | 'refused' | 'temperature' | 'cash';
  stopId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

/** What the logistics sync endpoint answers with. */
export interface DriverSyncResult {
  accepted: number;
  duplicates: number;
}

/** A batch row shape used by the admin orders queue chips. */
export interface OrderQueueRow {
  id: string;
  status: OrderStatus;
}

/** A stock recall, matching stock `Recall`. */
export interface Recall {
  id: string;
  batchId: string;
  reason: string;
  openedBy: string;
  openedAt: string;
  closedAt?: string;
  affectedOrderIds: string[];
}
