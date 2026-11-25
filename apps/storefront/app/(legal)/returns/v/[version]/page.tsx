import { notFound } from 'next/navigation';
import { RETURNS, parseVersionLabel, versionHistory } from '@ag/policy';
import { PolicyBody } from '../../../../../components/PolicyView';
import { pageMetadata } from '../../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Returns and refunds: earlier version',
  description: 'An earlier version of the returns and refunds, kept so a shopper can see what they agreed to.',
  path: '/returns/v',
  noindex: true,
});

/**
 * /returns/v/[version] (T-060).
 *
 * A specific version, kept readable forever. `noindex` because an old version
 * should not rank in a search engine above the current one — but it must stay
 * reachable by link, which is what a shopper following a change note needs.
 */
export default function Page({ params }: { params: { version: string } }) {
  const number = parseVersionLabel(params.version);
  const version = number ? RETURNS.versions.find((v) => v.version === number) : undefined;
  if (!version) notFound();
  return <PolicyBody doc={RETURNS} version={version} basePath="/returns" />;
}

/** Every version is a valid static route. */
export function generateStaticParams() {
  return versionHistory(RETURNS).map((v) => ({ version: `v${v.version}` }));
}
