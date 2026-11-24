import Link from 'next/link';
import { currentSession } from '../lib/auth-session';

/**
 * The shop header (T-059).
 *
 * It shows a sign-in link to an anonymous visitor and the person's identity plus
 * a sign-out button to a signed-in one. The session read is the gateway's, so a
 * forged cookie cannot make the header claim a name — though the header is
 * cosmetic either way, and the guarded pages check for themselves.
 */
export async function SiteHeader() {
  const corporate = process.env.NEXT_PUBLIC_CORPORATE_URL ?? 'https://amazinggoats.besbpo.co.za';
  const session = await currentSession();

  return (
    <header style={{ background: 'var(--forest)', color: 'var(--cream)', padding: '10px 18px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <Link href="/" style={{ color: 'var(--cream)', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: 20, textDecoration: 'none' }}>Amazing Goats</Link>
      <nav className="site-nav" aria-label="Shop" style={{ display: 'flex', gap: 14, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href="/shop/lamb">Lamb</Link>
        <Link href="/boxes">Boxes</Link>
        <Link href="/produce">Dairy and produce</Link>
        <Link href="/recipes">Recipes</Link>
        <Link href="/delivery">Delivery</Link>
        <Link href="/trade">Trade</Link>
        <a href={corporate} target="_blank" rel="noopener">About us</a>
        <Link href="/cart">Cart</Link>
        {session ? (
          <>
            <Link href="/account">{session.user.id}</Link>
            <form action="/api/auth/logout" method="post" style={{ display: 'inline' }}>
              <button type="submit" style={{ background: 'transparent', color: 'var(--cream)', border: '1px solid var(--cream)', borderRadius: 10, padding: '4px 12px', cursor: 'pointer' }}>
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/sign-in" style={{ border: '1px solid var(--cream)', borderRadius: 10, padding: '4px 12px' }}>Sign in</Link>
        )}
      </nav>
    </header>
  );
}
