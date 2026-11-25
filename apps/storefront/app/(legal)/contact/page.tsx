import { currentVersion, CONTACT } from '@ag/policy';
import { PolicyBody } from '../../../components/PolicyView';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Contact us',
  description: 'How to reach Amazing Goats, and when we answer.',
  path: '/contact',
});

/**
 * /contact (T-060).
 *
 * Renders the version in force today. The whole history is at
 * `/contact/history`, so a shopper can see what changed from the first version.
 */
export default function Page() {
  const version = currentVersion(CONTACT);
  return <PolicyBody doc={CONTACT} version={version} basePath="/contact" />;
}
