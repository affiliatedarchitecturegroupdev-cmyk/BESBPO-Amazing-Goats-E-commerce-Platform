/**
 * Social follow links (T-075), driven by configuration.
 *
 * A farm that has not opened an account must not link to one: a footer link to
 * `https://x.com/` with no handle lands on X's own front page, which reads as a
 * broken account. So a channel with no handle set is omitted entirely rather
 * than rendered with an empty path.
 *
 * The handles are configuration because they are operational facts (an account
 * can be renamed or closed) and not code. They are read from the environment at
 * build time, which is when the footer is rendered.
 */

export type SocialChannel = 'facebook' | 'instagram' | 'x' | 'whatsapp' | 'youtube';

export interface SocialLink {
  channel: SocialChannel;
  label: string;
  href: string;
}

/** The environment variable per channel, so ops can set one without the others. */
export const SOCIAL_ENV: Record<SocialChannel, string> = {
  facebook: 'NEXT_PUBLIC_SOCIAL_FACEBOOK',
  instagram: 'NEXT_PUBLIC_SOCIAL_INSTAGRAM',
  x: 'NEXT_PUBLIC_SOCIAL_X',
  whatsapp: 'NEXT_PUBLIC_SOCIAL_WHATSAPP',
  youtube: 'NEXT_PUBLIC_SOCIAL_YOUTUBE',
};

const LABELS: Record<SocialChannel, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
};

/** A handle or number with any leading `@`, `+` or URL prefix removed. */
function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value
    .trim()
    .replace(/^https?:\/\/(www\.)?[^/]+\//i, '')
    .replace(/^@/, '');
  return trimmed.length > 0 ? trimmed : undefined;
}

function hrefFor(channel: SocialChannel, handle: string): string {
  switch (channel) {
    case 'whatsapp':
      // A wa.me link takes digits only; a `+` or spaces would break it.
      return `https://wa.me/${handle.replace(/[^0-9]/g, '')}`;
    case 'youtube':
      return `https://www.youtube.com/@${handle}`;
    case 'instagram':
      return `https://www.instagram.com/${handle}`;
    case 'facebook':
      return `https://www.facebook.com/${handle}`;
    case 'x':
      return `https://x.com/${handle}`;
  }
}

/**
 * The follow links to render, in a fixed order, with unconfigured channels
 * omitted. Order is fixed rather than following the environment so the footer
 * does not reshuffle when an unrelated variable is added.
 */
export function socialLinks(
  env: Record<string, string | undefined> = process.env,
): SocialLink[] {
  const order: SocialChannel[] = ['whatsapp', 'facebook', 'instagram', 'x', 'youtube'];
  const out: SocialLink[] = [];
  for (const channel of order) {
    const handle = clean(env[SOCIAL_ENV[channel]]);
    if (!handle) continue;
    const href = hrefFor(channel, handle);
    // A WhatsApp number that is not a number yields `https://wa.me/`, a dead link.
    if (channel === 'whatsapp' && href === 'https://wa.me/') continue;
    out.push({ channel, label: LABELS[channel], href });
  }
  return out;
}
