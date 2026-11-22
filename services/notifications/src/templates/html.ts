import type { Message } from './template';

/**
 * HTML rendering for email. The templates are plain text (so the same copy serves
 * SMS and WhatsApp), and this turns that text into an email body without letting
 * any value reach the markup unescaped.
 *
 * Rendering is pure and tested: a message that reaches a real person is a gated
 * path, so the copy and the escaping are verified without sending anything.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes text for use in HTML content and in a quoted attribute. A customer name
 * or an address is user data, so it is escaped before it is placed in the body.
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;

/**
 * Turns one already-escaped line into markup, linking any URL. Escaping runs
 * first, so a URL carrying `&` arrives here as `&amp;`, which is also the correct
 * form inside an `href`.
 */
function linkify(escapedLine: string): string {
  return escapedLine.replace(URL_PATTERN, (url) => `<a href="${url}">${url}</a>`);
}

/**
 * The text body as HTML: a paragraph per blank-line-separated block, a line break
 * within a block. Inline styles only, because an email client strips a stylesheet
 * and a `<style>` block is unreliable across clients.
 */
export function bodyToHtml(body: string): string {
  const blocks = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const paragraphs = blocks.map((block) => {
    const lines = block.split('\n').map((line) => linkify(escapeHtml(line)));
    return `<p style="margin:0 0 16px 0;line-height:1.5">${lines.join('<br>')}</p>`;
  });

  return paragraphs.join('\n');
}

/**
 * A complete HTML email: a titled document around the rendered body. The subject
 * becomes the document title so a client that shows it in a header has it, and
 * the body is the only place message content appears.
 */
export function renderHtml(message: Message): string {
  const title = escapeHtml(message.subject ?? 'Amazing Goats');
  return [
    '<!doctype html>',
    '<html lang="en-ZA">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${title}</title>`,
    '</head>',
    '<body style="margin:0;padding:24px;background:#f6f4ef;' +
      'font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2421">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:24px;' +
      'border-radius:8px">',
    bodyToHtml(message.body),
    '</div>',
    '</body>',
    '</html>',
  ].join('\n');
}
