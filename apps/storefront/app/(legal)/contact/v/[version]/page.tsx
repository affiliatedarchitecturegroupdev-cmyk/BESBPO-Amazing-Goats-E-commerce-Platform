import { notFound } from 'next/navigation';
import { CONTACT, parseVersionLabel, versionHistory } from '@ag/policy';
import { PolicyBody } from '../../../../../components/PolicyView';
import { pageMetadata } from '../../../../../lib/seo';

export const metadata = pageMetadata({
  title: 'Contact us: earlier version',
  description: 'An earlier version of the contact us, kept so a shopper can see what they agreed to.',
  path: '/contact/v',
  noindex: true,
});

/**
 * /contact/v/[version] (T-060).
 *
 * A specific version, kept readable forever. `noindex` because an old version
 * should not rank in a search engine above the current one — but it must stay
 * reachable by link, which is what a shopper following a change note needs.
 */
export default function Page({ params }: { params: { version: string } }) {
  const number = parseVersionLabel(params.version);
  const version = number ? CONTACT.versions.find((v) => v.version === number) : undefined;
  if (!version) notFound();
  return <PolicyBody doc={CONTACT} version={version} basePath="/contact" />;
}

/** Every version is a valid static route. */
export function generateStaticParams() {
  return versionHistory(CONTACT).map((v) => ({ version: `v${v.version}` }));
}
