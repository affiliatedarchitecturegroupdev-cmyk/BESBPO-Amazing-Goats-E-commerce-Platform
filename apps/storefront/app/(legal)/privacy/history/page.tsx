import { PRIVACY } from '@ag/policy';
import { PolicyHistory } from '../../../../components/PolicyView';
import { pageMetadata } from '../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Privacy notice: version history',
  description: 'Every version of the privacy notice, newest first.',
  path: '/privacy/history',
});

/** /privacy/history (T-060): every version, so a change is never silent. */
export default function Page() {
  return <PolicyHistory doc={PRIVACY} basePath="/privacy" />;
}
