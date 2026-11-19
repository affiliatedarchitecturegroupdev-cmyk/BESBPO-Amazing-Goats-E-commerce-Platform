import { currentVersion, PRIVACY } from '@ag/policy';
import { PolicyBody } from '../../../components/PolicyView';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Privacy notice',
  description: 'What personal information we collect, why, how long we keep it, and your rights under POPIA.',
  path: '/privacy',
});

/**
 * /privacy (T-060).
 *
 * Renders the version in force today. The whole history is at
 * `/privacy/history`, so a shopper can see what changed from the first version.
 */
export default function Page() {
  const version = currentVersion(PRIVACY);
  return <PolicyBody doc={PRIVACY} version={version} basePath="/privacy" />;
}
