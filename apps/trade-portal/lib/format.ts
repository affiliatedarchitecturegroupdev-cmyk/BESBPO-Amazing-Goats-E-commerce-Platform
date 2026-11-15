/** ZAR in integer cents to a display string; prices show as R --- until set. */
export function formatRand(cents: number): string {
  if (!cents) return 'R ---';
  return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
