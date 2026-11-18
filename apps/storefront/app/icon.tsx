import { ImageResponse } from 'next/og';

// The app icon (T-064): the goat-horn chevrons from the brand strip, drawn in
// code so there is no binary artwork to check in. Next serves this at `/icon`,
// and both the favicon and the web manifest point here.
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
      <div
        style={{
          width: 400,
          height: 400,
          borderRadius: 96,
          background: '#F4ECD8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ width: 220, height: 44, background: '#B4492B', borderRadius: 22 }} />
          <div style={{ width: 220, height: 44, background: '#D6A23E', borderRadius: 22 }} />
          <div style={{ width: 220, height: 44, background: '#1F3B2D', borderRadius: 22 }} />
        </div>
      </div>
    </div>,
    { ...size },
  );
}
