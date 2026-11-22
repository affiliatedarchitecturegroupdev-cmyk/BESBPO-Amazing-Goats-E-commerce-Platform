/**
 * Markdown to HTML for content bodies, as one pure function.
 *
 * Body text is Markdown, not HTML: diffable, writable by a non-technical author,
 * and safe once sanitised. Rendering happens once here, the same pattern as the
 * notification templates.
 *
 * The safety property is structural rather than bolted on: **the input is
 * HTML-escaped before any formatting is applied**, and the only tags in the
 * output are ones this file writes itself. Raw HTML in the source therefore
 * cannot survive — `<script>alert(1)</script>` is escaped to text and stays
 * text — so there is no sanitiser to misconfigure and no allow-list to keep in
 * sync with a library upgrade.
 *
 * This is deliberately a small subset (headings, paragraphs, lists, emphasis,
 * links, code, blockquote, rules). It is not CommonMark and does not try to be;
 * content that needs more than this is a signal to reconsider the body, not to
 * pull in a parser with an HTML passthrough.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

/**
 * Only http(s) and site-relative links are allowed. `javascript:` and `data:`
 * URLs are the classic XSS vector in a Markdown link, and escaping the text does
 * not help because the URL is an attribute value the browser acts on.
 */
export function safeUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (/^(https?:\/\/|\/)/i.test(trimmed)) return trimmed;
  return undefined;
}

/** Inline formatting, applied to already-escaped text. Order matters: code
 * spans are taken out first so `*` inside them is not read as emphasis. */
function inline(escaped: string): string {
  const codeSpans: string[] = [];
  let out = escaped.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(`<code>${code}</code>`);
    return `\u0000CODE${codeSpans.length - 1}\u0000`;
  });

  // Links: [text](url). The text is already escaped; the URL is validated.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, text: string, url: string) => {
    const href = safeUrl(url);
    if (!href) return text;
    return `<a href="${href}" rel="noopener noreferrer nofollow">${text}</a>`;
  });

  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return out.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => codeSpans[Number(i)] ?? '');
}

/**
 * Renders a Markdown body to HTML. Blank lines separate blocks; a list is a run
 * of consecutive `-` or `1.` lines; `#` through `######` are headings.
 */
export function renderMarkdown(markdown: string): string {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | undefined;
  let quote: string[] = [];
  let codeFence: { lang: string; lines: string[] } | undefined;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${inline(escapeHtml(paragraph.join(' ')))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? 'ol' : 'ul';
      const items = list.items.map((i) => `<li>${inline(escapeHtml(i))}</li>`).join('');
      blocks.push(`<${tag}>${items}</${tag}>`);
      list = undefined;
    }
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      blocks.push(`<blockquote><p>${inline(escapeHtml(quote.join(' ')))}</p></blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    const fence = line.match(/^```(\w*)\s*$/);
    if (codeFence) {
      if (fence) {
        const cls = codeFence.lang ? ` class="language-${escapeHtml(codeFence.lang)}"` : '';
        blocks.push(`<pre><code${cls}>${escapeHtml(codeFence.lines.join('\n'))}</code></pre>`);
        codeFence = undefined;
      } else {
        codeFence.lines.push(line);
      }
      continue;
    }
    if (fence) {
      flushAll();
      codeFence = { lang: fence[1] ?? '', lines: [] };
      continue;
    }

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushAll();
      blocks.push('<hr>');
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (bullet || ordered) {
      flushParagraph();
      flushQuote();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flushList();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push((bullet ?? ordered)![1]);
      continue;
    }

    const quoted = line.match(/^>\s?(.*)$/);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  if (codeFence) {
    // An unterminated fence still renders its contents as code, escaped.
    blocks.push(`<pre><code>${escapeHtml(codeFence.lines.join('\n'))}</code></pre>`);
  }
  flushAll();

  return blocks.join('\n');
}
