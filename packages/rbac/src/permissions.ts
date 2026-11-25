export const PERMISSIONS = [
  'catalog:read','catalog:write','pricing:read','pricing:write','pricing:approve',
  'orders:read','orders:write','refunds:request','refunds:approve',
  'stock:read','stock:write','batches:release','batches:recall','cycles:manage',
  'routes:read','routes:manage','delivery:execute',
  'credit:read','credit:write','credit:approve','invoices:read','invoices:write',
  'payments:read','payments:reconcile','payouts:request','payouts:approve','procurement:manage',
  'ads:read','ads:manage','ads:approve','merch:manage','reviews:moderate','content:read','content:write','content:publish',
  'users:read','users:manage','roles:manage','audit:read','pii:read','data:export',
  'infra:operate','system:break_glass','reports:read','support:manage',
  'partner:own','advertiser:own','customer:own','trade:own',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
