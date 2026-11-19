import { notFound } from 'next/navigation';
import { COOKIES, parseVersionLabel, versionHistory } from '@ag/policy';
import { PolicyBody } from '../../../../../components/PolicyView';
import { pageMetadata } from '../../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Cookie notice: earlier version',
  description: 'An earlier version of the cookie notice, kept so a shopper can see what they agreed to.',
  path: '/cookies/v',
  noindex: true,
});

/**
 * /cookies/v/[version] (T-060).
 *
 * A specific version, kept readable forever. `noindex` because an old version
 * should not rank in a search engine above the current one — but it must stay
 * reachable by link, which is what a shopper following a change note needs.
 */
export default function Page({ params }: { params: { version: string } }) {
  const number = parseVersionLabel(params.version);
  const version = number ? COOKIES.versions.find((v) => v.version === number) : undefined;
  if (!version) notFound();
  return <PolicyBody doc={COOKIES} version={version} basePath="/cookies" />;
}

/** Every version is a valid static route. */
export function generateStaticParams() {
  return versionHistory(COOKIES).map((v) => ({ version: `v${v.version}` }));
}
