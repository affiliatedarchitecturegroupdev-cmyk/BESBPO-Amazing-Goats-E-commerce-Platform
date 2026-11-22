import { buildLlmsTxt } from '../../lib/llms';
import { siteUrl } from '../../lib/seo';

// /llms.txt (T-073): a plain-text summary for AI crawlers and assistants.
// Static, because the content is derived from the route list, not live data.
export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(buildLlmsTxt(siteUrl()), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
