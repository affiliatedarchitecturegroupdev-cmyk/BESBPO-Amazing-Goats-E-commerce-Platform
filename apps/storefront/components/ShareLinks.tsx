import { shareTargets, type ShareTarget } from '../lib/share';

/**
 * Share buttons (T-075).
 *
 * Every button is an anchor, so sharing works before hydration and on a slow
 * connection — the shopper who taps WhatsApp on a phone at a taxi rank is the
 * one who needs it most. There is no copy-to-clipboard button: that needs
 * JavaScript, and a button that silently does nothing without it is worse than
 * no button.
 *
 * The links open in a new tab, and `rel="noopener"` keeps the shared page from
 * reaching back through `window.opener`.
 */
export function ShareLinks({ targets }: { targets: ShareTarget[] }) {
  if (targets.length === 0) return null;
  return (
    <section aria-label="Share this page" className="share">
      <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Share</h2>
      <ul className="chips">
        {targets.map((t) => (
          <li key={t.channel}>
            <a href={t.href} target="_blank" rel="noopener noreferrer" className="tag">
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The share buttons for a page, built from its canonical URL and title. */
export function shareLinksFor(input: { url: string; title: string }) {
  return <ShareLinks targets={shareTargets(input)} />;
}
