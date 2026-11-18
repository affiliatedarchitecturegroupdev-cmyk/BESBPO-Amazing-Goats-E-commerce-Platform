import { ImageResponse } from 'next/og';

// The driver app icon (T-064): the brand chevrons on the forest ground, drawn in
// code so no binary artwork is checked in. Next serves this at `/icon`.
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 260, height: 48, background: '#B4492B', borderRadius: 24 }} />
        <div style={{ width: 260, height: 48, background: '#D6A23E', borderRadius: 24 }} />
        <div style={{ width: 260, height: 48, background: '#F4ECD8', borderRadius: 24 }} />
      </div>
    </div>,
    { ...size },
  );
}
