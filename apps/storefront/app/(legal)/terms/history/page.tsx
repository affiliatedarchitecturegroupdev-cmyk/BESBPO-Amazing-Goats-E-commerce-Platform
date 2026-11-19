import { TERMS } from '@ag/policy';
import { PolicyHistory } from '../../../../components/PolicyView';
import { pageMetadata } from '../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Terms of sale: version history',
  description: 'Every version of the terms of sale, newest first.',
  path: '/terms/history',
});

/** /terms/history (T-060): every version, so a change is never silent. */
export default function Page() {
  return <PolicyHistory doc={TERMS} basePath="/terms" />;
}
