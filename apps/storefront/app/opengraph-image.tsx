import { ImageResponse } from 'next/og';
import { SITE_DESCRIPTION, SITE_NAME } from '../lib/seo';

// The default social card (T-064): the brand colours, the wordmark and the
// one-line description, drawn in code so a shared link previews without any
// checked-in image. Per-page cards can override this later.
export const alt = `${SITE_NAME} — farm-direct meat, eggs and dairy`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#1F3B2D',
        color: '#F4ECD8',
        padding: 72,
        fontFamily: 'Georgia, serif',
      }}
    >
      <div style={{ display: 'flex', fontSize: 40, letterSpacing: 2, color: '#D6A23E' }}>
        AMAZING GOATS · EZIMBUZINI
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 96,
            fontStyle: 'italic',
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          Farm-direct lamb and more
        </div>
        <div style={{ display: 'flex', fontSize: 36, color: '#F4ECD8', opacity: 0.85 }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ width: 180, height: 24, background: '#B4492B' }} />
        <div style={{ width: 180, height: 24, background: '#D6A23E' }} />
        <div style={{ width: 180, height: 24, background: '#F4ECD8' }} />
      </div>
    </div>,
    { ...size },
  );
}
