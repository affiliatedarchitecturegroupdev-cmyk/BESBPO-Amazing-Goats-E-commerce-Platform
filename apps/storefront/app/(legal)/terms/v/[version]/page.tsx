import { notFound } from 'next/navigation';
import { TERMS, parseVersionLabel, versionHistory } from '@ag/policy';
import { PolicyBody } from '../../../../../components/PolicyView';
import { pageMetadata } from '../../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Terms of sale: earlier version',
  description: 'An earlier version of the terms of sale, kept so a shopper can see what they agreed to.',
  path: '/terms/v',
  noindex: true,
});

/**
 * /terms/v/[version] (T-060).
 *
 * A specific version, kept readable forever. `noindex` because an old version
 * should not rank in a search engine above the current one — but it must stay
 * reachable by link, which is what a shopper following a change note needs.
 */
export default function Page({ params }: { params: { version: string } }) {
  const number = parseVersionLabel(params.version);
  const version = number ? TERMS.versions.find((v) => v.version === number) : undefined;
  if (!version) notFound();
  return <PolicyBody doc={TERMS} version={version} basePath="/terms" />;
}

/** Every version is a valid static route. */
export function generateStaticParams() {
  return versionHistory(TERMS).map((v) => ({ version: `v${v.version}` }));
}
