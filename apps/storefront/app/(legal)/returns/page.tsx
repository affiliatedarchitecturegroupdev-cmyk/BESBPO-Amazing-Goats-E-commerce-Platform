import { currentVersion, RETURNS } from '@ag/policy';
import { PolicyBody } from '../../../components/PolicyView';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Returns and refunds',
  description: 'What to do if something is wrong, and how a refund works.',
  path: '/returns',
});

/**
 * /returns (T-060).
 *
 * Renders the version in force today. The whole history is at
 * `/returns/history`, so a shopper can see what changed from the first version.
 */
export default function Page() {
  const version = currentVersion(RETURNS);
  return <PolicyBody doc={RETURNS} version={version} basePath="/returns" />;
}
