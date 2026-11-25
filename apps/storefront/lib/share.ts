/**
 * Share targets (T-075), as pure functions.
 *
 * Every target is an ordinary URL that a browser can follow without JavaScript,
 * so sharing costs no hydration boundary: the buttons are plain links.
 *
 * WhatsApp is first in the list because it is how grocery shopping is shared in
 * South Africa — a family member forwards the product, not a tweet. It also
 * previews the link itself, so the message needs only a title and a URL.
 */

export type ShareChannel = 'whatsapp' | 'facebook' | 'x' | 'email';

export interface ShareTarget {
  channel: ShareChannel;
  label: string;
  href: string;
}

export interface ShareInput {
  /** The canonical absolute URL of the page being shared. */
  url: string;
  /** The page title, as it should read in the message. */
  title: string;
}

/**
 * The message body. WhatsApp and email take free text, so the title is included;
 * Facebook and X take the URL as a parameter and build their own preview, and
 * adding a title to those would duplicate it in the post.
 */
function message({ url, title }: ShareInput): string {
  return `${title} ${url}`;
}

/**
 * The share links for a page, in the order the buttons should appear.
 *
 * Only channels with a stable, documented share URL are here. Instagram has no
 * web share endpoint (it is app-only), so it is a follow link, not a share one.
 */
export function shareTargets(input: ShareInput): ShareTarget[] {
  const text = encodeURIComponent(message(input));
  const url = encodeURIComponent(input.url);
  const title = encodeURIComponent(input.title);

  return [
    {
      channel: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/?text=${text}`,
    },
    {
      channel: 'facebook',
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    },
    {
      channel: 'x',
      label: 'X',
      href: `https://x.com/intent/post?url=${url}&text=${title}`,
    },
    {
      channel: 'email',
      label: 'Email',
      href: `mailto:?subject=${title}&body=${text}`,
    },
  ];
}

/**
 * The absolute URL to share for a path.
 *
 * `siteUrl` already trims a trailing slash, so a path is joined with exactly one
 * separator. A caller that passes an already-absolute URL is left alone, because
 * the share text must not carry a doubled origin.
 */
export function shareUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
