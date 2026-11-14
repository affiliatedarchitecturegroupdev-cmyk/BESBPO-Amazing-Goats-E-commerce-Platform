import type { Permission } from '@ag/rbac';
// The admin menu is generated from permissions, so people only see what they may use.
export const NAV: { href: string; label: string; needs: Permission }[] = [
  { href: '/orders', label: 'Orders', needs: 'orders:read' },
  { href: '/cycles', label: 'Cut-off cycles', needs: 'cycles:manage' },
  { href: '/batches', label: 'Stock and batches', needs: 'stock:read' },
  { href: '/recalls', label: 'Recalls', needs: 'batches:recall' },
  { href: '/routes', label: 'Routes and slots', needs: 'routes:manage' },
  { href: '/pricing', label: 'Pricing', needs: 'pricing:read' },
  { href: '/merchandising', label: 'Merchandising', needs: 'merch:manage' },
  { href: '/accounts', label: 'Trade accounts', needs: 'credit:read' },
  { href: '/credit', label: 'Credit control', needs: 'credit:read' },
  { href: '/payments', label: 'Payments', needs: 'payments:read' },
  { href: '/roles', label: 'Roles and access', needs: 'roles:manage' },
  { href: '/audit', label: 'Audit log', needs: 'audit:read' },
  { href: '/ads', label: 'Ads', needs: 'ads:read' },
  { href: '/partners', label: 'Partners', needs: 'procurement:manage' },
  { href: '/reports', label: 'Reports', needs: 'reports:read' },
];
