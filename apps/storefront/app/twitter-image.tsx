import { ImageResponse } from 'next/og';
import { SITE_NAME } from '../lib/seo';

// The Twitter card (T-064). X prefers a slightly wider crop than Open Graph, so
// it is the same mark at 1200x600.
export const alt = `${SITE_NAME} — farm-direct meat, eggs and dairy`;
export const size = { width: 1200, height: 600 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 24,
        background: '#F4ECD8',
        color: '#1F3B2D',
        padding: 72,
        fontFamily: 'Georgia, serif',
      }}
    >
      <div style={{ display: 'flex', fontSize: 88, fontStyle: 'italic', fontWeight: 700 }}>
        {SITE_NAME}
      </div>
      <div style={{ display: 'flex', fontSize: 36 }}>Order by Sunday. Delivered Wednesday.</div>
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ width: 160, height: 20, background: '#1F3B2D' }} />
        <div style={{ width: 160, height: 20, background: '#B4492B' }} />
        <div style={{ width: 160, height: 20, background: '#D6A23E' }} />
      </div>
    </div>,
    { ...size },
  );
}
