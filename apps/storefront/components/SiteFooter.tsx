import Link from 'next/link';
import { POLICIES } from '@ag/policy';
import { loadAds } from '../lib/gateway';
import { renderableAds } from '../lib/placements';
import { socialLinks } from '../lib/social-links';

/**
 * The site footer (T-060).
 *
 * It does two jobs. It makes every legal and consumer page reachable from every
 * page — a privacy notice a shopper cannot find is not a notice — and it carries
 * the A10 partner-logo slot (`docs/06-ads.md`).
 *
 * The A10 slot is served by the ads service like any other, so it goes through
 * `renderableAds`: an ad that is not labelled Sponsored is dropped rather than
 * shown. A failed ad read yields no logos and the footer still renders, because a
 * legal footer must not depend on an ad call succeeding.
 *
 * The follow links come from `socialLinks`, which omits a channel with no handle
 * configured. A farm that has not opened an Instagram account must not link to
 * Instagram's front page, so an unset handle renders nothing at all.
 */
export async function SiteFooter() {
  const partnerAds = renderableAds(await loadAds('A10'));
  const socials = socialLinks();

  return (
    <footer style={{ borderTop: '1px solid var(--border)', marginTop: 36, paddingTop: 18 }}>
      <div className="container">
        <nav aria-label="Legal and company" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
          {POLICIES.map((policy) => (
            <Link key={policy.slug} href={`/${policy.slug}`}>
              {policy.title}
            </Link>
          ))}
        </nav>

        {socials.length > 0 && (
          <nav aria-label="Follow us" style={{ marginBottom: 12 }}>
            <ul className="chips">
              {socials.map((s) => (
                <li key={s.channel}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tag"
                    aria-label={`Amazing Goats on ${s.label}`}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {partnerAds.length > 0 && (
          <section aria-label="Partners" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Our partners</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              {partnerAds.map((ad) => (
                <a
                  key={ad.creativeId}
                  href={ad.destinationUrl ?? '#'}
                  target="_blank"
                  rel="noopener sponsored"
                  className="tag ad"
                  title={ad.label}
                >
                  {ad.headline ?? ad.label}
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="p" style={{ margin: 0 }}>
          Amazing Goats (Ezimbuzini), a specialised agricultural division of Besbpo Group. Prices
          exclude VAT until shown at checkout. Delivered in KwaZulu-Natal on weekly route days.
        </p>
      </div>
    </footer>
  );
}
