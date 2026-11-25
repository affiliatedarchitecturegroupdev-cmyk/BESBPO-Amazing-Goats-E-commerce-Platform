import { RETURNS } from '@ag/policy';
import { PolicyHistory } from '../../../../components/PolicyView';
import { pageMetadata } from '../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Returns and refunds: version history',
  description: 'Every version of the returns and refunds, newest first.',
  path: '/returns/history',
});

/** /returns/history (T-060): every version, so a change is never silent. */
export default function Page() {
  return <PolicyHistory doc={RETURNS} basePath="/returns" />;
}
