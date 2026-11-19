import { currentVersion, COOKIES } from '@ag/policy';
import { PolicyBody } from '../../../components/PolicyView';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Cookie notice',
  description: 'The cookies we set, what each one does, and how to refuse the optional ones.',
  path: '/cookies',
});

/**
 * /cookies (T-060).
 *
 * Renders the version in force today. The whole history is at
 * `/cookies/history`, so a shopper can see what changed from the first version.
 */
export default function Page() {
  const version = currentVersion(COOKIES);
  return <PolicyBody doc={COOKIES} version={version} basePath="/cookies" />;
}
