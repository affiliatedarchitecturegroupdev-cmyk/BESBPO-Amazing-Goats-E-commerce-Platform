import { COOKIES } from '@ag/policy';
import { PolicyHistory } from '../../../../components/PolicyView';
import { pageMetadata } from '../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Cookie notice: version history',
  description: 'Every version of the cookie notice, newest first.',
  path: '/cookies/history',
});

/** /cookies/history (T-060): every version, so a change is never silent. */
export default function Page() {
  return <PolicyHistory doc={COOKIES} basePath="/cookies" />;
}
