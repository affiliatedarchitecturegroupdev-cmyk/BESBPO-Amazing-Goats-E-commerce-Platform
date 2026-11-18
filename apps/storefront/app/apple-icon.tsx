import { ImageResponse } from 'next/og';

// The 180x180 Apple touch icon (T-064), same mark as `icon.tsx` at the size iOS
// asks for. Drawn in code so no binary artwork is checked in.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1F3B2D',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ width: 96, height: 18, background: '#B4492B', borderRadius: 9 }} />
        <div style={{ width: 96, height: 18, background: '#D6A23E', borderRadius: 9 }} />
        <div style={{ width: 96, height: 18, background: '#F4ECD8', borderRadius: 9 }} />
      </div>
    </div>,
    { ...size },
  );
}
