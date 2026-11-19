import { ABOUT } from '@ag/policy';
import { PolicyHistory } from '../../../../components/PolicyView';
import { pageMetadata } from '../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'About Amazing Goats: version history',
  description: 'Every version of the about amazing goats, newest first.',
  path: '/about/history',
});

/** /about/history (T-060): every version, so a change is never silent. */
export default function Page() {
  return <PolicyHistory doc={ABOUT} basePath="/about" />;
}
