import { currentVersion, TERMS } from '@ag/policy';
import { PolicyBody } from '../../../components/PolicyView';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Terms of sale',
  description: 'How ordering, pricing, cut-off, delivery, cancellation and returns work.',
  path: '/terms',
});

/**
 * /terms (T-060).
 *
 * Renders the version in force today. The whole history is at
 * `/terms/history`, so a shopper can see what changed from the first version.
 */
export default function Page() {
  const version = currentVersion(TERMS);
  return <PolicyBody doc={TERMS} version={version} basePath="/terms" />;
}
