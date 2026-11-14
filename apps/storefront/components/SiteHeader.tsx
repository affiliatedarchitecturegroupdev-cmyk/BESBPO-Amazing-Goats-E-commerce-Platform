export function SiteHeader() {
  const corporate = process.env.NEXT_PUBLIC_CORPORATE_URL ?? 'https://amazinggoats.besbpo.co.za';
  return (
    <header style={{ background: 'var(--forest)', color: 'var(--cream)', padding: '10px 18px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <a href="/" style={{ color: 'var(--cream)', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: 20, textDecoration: 'none' }}>Amazing Goats</a>
      <nav style={{ display: 'flex', gap: 14, marginLeft: 'auto', flexWrap: 'wrap' }}>
        <a href="/shop/lamb">Lamb</a><a href="/boxes">Boxes</a><a href="/produce">Dairy and produce</a><a href="/trade">Trade</a>
        <a href={corporate} target="_blank" rel="noopener">About us</a>
        <a href="/cart">Cart</a>
      </nav>
    </header>
  );
}
