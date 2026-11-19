import { CONTACT } from '@ag/policy';
import { PolicyHistory } from '../../../../components/PolicyView';
import { pageMetadata } from '../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Contact us: version history',
  description: 'Every version of the contact us, newest first.',
  path: '/contact/history',
});

/** /contact/history (T-060): every version, so a change is never silent. */
export default function Page() {
  return <PolicyHistory doc={CONTACT} basePath="/contact" />;
}
