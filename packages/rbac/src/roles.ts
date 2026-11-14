export const ROLES = [
  'chief_admin','executive','ops_manager','sales','credit_controller','finance','procurement','cold_room',
  'dispatch','driver','quality','marketing','support','developer','devops','analyst',
  'partner_user','advertiser_user','customer_household','trade_owner','trade_buyer','trade_accounts',
] as const;
export type Role = (typeof ROLES)[number];
