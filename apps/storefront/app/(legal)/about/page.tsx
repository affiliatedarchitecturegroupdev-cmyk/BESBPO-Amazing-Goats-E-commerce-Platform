import { currentVersion, ABOUT } from '@ag/policy';
import { PolicyBody } from '../../../components/PolicyView';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata({
  title: 'About Amazing Goats',
  description: 'A farm-direct model: we buy to order, slaughter to order, and deliver on a weekly cycle.',
  path: '/about',
});

/**
 * /about (T-060).
 *
 * Renders the version in force today. The whole history is at
 * `/about/history`, so a shopper can see what changed from the first version.
 */
export default function Page() {
  const version = currentVersion(ABOUT);
  return <PolicyBody doc={ABOUT} version={version} basePath="/about" />;
}
