import { PERMISSIONS, Permission } from './permissions';
import { Role } from './roles';

const reads = PERMISSIONS.filter((p) => p.endsWith(':read')) as Permission[];

export const MATRIX: Record<Role, Permission[]> = {
  chief_admin: [...PERMISSIONS],
  executive: [...reads, 'reports:read', 'audit:read', 'pii:read', 'data:export',
    'pricing:approve', 'credit:approve', 'ads:approve', 'refunds:approve', 'payouts:approve'],
  ops_manager: ['catalog:read','orders:read','orders:write','stock:read','stock:write','batches:release','cycles:manage',
    'routes:read','routes:manage','procurement:manage','reports:read','support:manage','pii:read'],
  sales: ['catalog:read','pricing:read','orders:read','orders:write','credit:read','invoices:read','pii:read','reports:read'],
  credit_controller: ['credit:read','credit:write','invoices:read','invoices:write','payments:read','orders:read','pii:read','reports:read'],
  finance: ['invoices:read','invoices:write','payments:read','payments:reconcile','payouts:request','refunds:request','credit:read','orders:read','reports:read','pii:read'],
  procurement: ['catalog:read','stock:read','procurement:manage','orders:read','reports:read'],
  cold_room: ['stock:read','stock:write','orders:read'],
  dispatch: ['routes:read','routes:manage','orders:read','pii:read'],
  driver: ['delivery:execute','routes:read'],
  quality: ['stock:read','batches:release','batches:recall','catalog:read','reports:read'],
  marketing: ['ads:read','ads:manage','ads:approve','merch:manage','catalog:read','reports:read'],
  support: ['orders:read','orders:write','refunds:request','support:manage','pii:read'],
  developer: ['catalog:read','reports:read','audit:read'],
  devops: ['infra:operate','audit:read','reports:read','system:break_glass'],
  analyst: ['reports:read'],
  partner_user: ['partner:own'],
  advertiser_user: ['advertiser:own'],
  customer_household: ['customer:own'],
  trade_owner: ['trade:own','customer:own'],
  trade_buyer: ['trade:own'],
  trade_accounts: ['trade:own'],
};
