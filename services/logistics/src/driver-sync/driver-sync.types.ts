/** Event kinds a driver records on the road, matching the sync_events payloads. */
export type DriverEventType = 'arrived' | 'delivered' | 'refused' | 'temperature' | 'cash';

export interface DriverEvent {
  /** Client-generated UUID, so replaying a sync never applies the same event twice. */
  id: string;
  deviceId: string;
  driverId?: string;
  type: DriverEventType;
  stopId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  receivedAt?: string;
  applied?: boolean;
}

/** Delivery status as the driver app drives it. */
export type DeliveryStatus = 'pending' | 'arrived' | 'delivered' | 'refused';

export interface ReceiveResult {
  accepted: number;
  duplicates: number;
}
