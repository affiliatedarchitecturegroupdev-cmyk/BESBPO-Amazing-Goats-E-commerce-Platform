import { describe, it, expect } from 'vitest';
import { escapeHtml, renderMarkdown, safeUrl } from './markdown';

describe('renderMarkdown — formatting', () => {
  it('renders headings by level', () => {
    expect(renderMarkdown('# Title')).toBe('<h1>Title</h1>');
    expect(renderMarkdown('### Deep')).toBe('<h3>Deep</h3>');
  });

  it('wraps plain lines in a paragraph', () => {
    expect(renderMarkdown('Where to buy lamb in Durban.')).toBe(
      '<p>Where to buy lamb in Durban.</p>',
    );
  });

  it('joins wrapped lines into one paragraph and splits on a blank line', () => {
    expect(renderMarkdown('one\ntwo\n\nthree')).toBe('<p>one two</p>\n<p>three</p>');
  });

  it('renders an unordered and an ordered list', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdown('1. first\n2. second')).toBe('<ol><li>first</li><li>second</li></ol>');
  });

  it('splits a list when the kind changes', () => {
    expect(renderMarkdown('- a\n1. b')).toBe('<ul><li>a</li></ul>\n<ol><li>b</li></ol>');
  });

  it('renders emphasis, strong and strikethrough', () => {
    expect(renderMarkdown('**bold** and *italic* and ~~gone~~')).toBe(
      '<p><strong>bold</strong> and <em>italic</em> and <del>gone</del></p>',
    );
  });

  it('renders inline code without reading its asterisks as emphasis', () => {
    expect(renderMarkdown('use `a * b` here')).toBe('<p>use <code>a * b</code> here</p>');
  });

  it('renders a fenced code block, escaped', () => {
    expect(renderMarkdown('```ts\nconst a = 1 < 2;\n```')).toBe(
      '<pre><code class="language-ts">const a = 1 &lt; 2;</code></pre>',
    );
  });

  it('renders a blockquote and a horizontal rule', () => {
    expect(renderMarkdown('> quoted')).toBe('<blockquote><p>quoted</p></blockquote>');
    expect(renderMarkdown('---')).toBe('<hr>');
  });

  it('renders a link with rel attributes', () => {
    expect(renderMarkdown('[lamb](/products/lamb)')).toBe(
      '<p><a href="/products/lamb" rel="noopener noreferrer nofollow">lamb</a></p>',
    );
  });
});

describe('renderMarkdown — sanitisation', () => {
  it('escapes a script tag into visible text', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(html).not.toContain('<script>');
  });

  it('escapes raw HTML blocks rather than passing them through', () => {
    for (const body of [
      '<img src=x onerror="alert(1)">',
      '<iframe src="https://evil.test"></iframe>',
      '<div onclick="steal()">hi</div>',
      '<svg/onload=alert(1)>',
    ]) {
      const html = renderMarkdown(body);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<iframe');
      expect(html).not.toContain('<div');
      expect(html).not.toContain('<svg');
      expect(html).toContain('&lt;');
    }
  });

  it('escapes HTML inside a code fence instead of rendering it', () => {
    const html = renderMarkdown('```\n<script>alert(1)</script>\n```');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes quotes and ampersands in text', () => {
    expect(renderMarkdown(`Tom & "Jerry" 's`)).toBe(
      '<p>Tom &amp; &quot;Jerry&quot; &#39;s</p>',
    );
  });

  it('drops a javascript: link and keeps only the text', () => {
    // The trailing `)` is a leftover of the unbalanced parens in this malformed
    // input; what matters is that no anchor and no executable scheme survive.
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a');
    expect(html).toContain('click');
  });

  it('drops a data: link', () => {
    const html = renderMarkdown('[x](data:text/html;base64,PHNjcmlwdD4=)');
    expect(html).not.toContain('data:');
    expect(html).not.toContain('<a');
  });

  it('cannot be broken out of a link href with a quote', () => {
    const html = renderMarkdown('[x](https://ok.test/"onmouseover="alert(1))');
    expect(html).not.toContain('onmouseover="alert');
  });

  it('escapes HTML in a heading', () => {
    expect(renderMarkdown('# <script>x</script>')).toBe('<h1>&lt;script&gt;x&lt;/script&gt;</h1>');
  });

  it('produces no tag other than the ones the renderer writes', () => {
    const html = renderMarkdown(
      '# h\n\n**b** *i* `c`\n\n- l\n\n> q\n\n```\ncode\n```\n\n[r](/x)\n\n---',
    );
    const tags = new Set([...html.matchAll(/<\/?([a-z0-9]+)/g)].map((m) => m[1]));
    expect([...tags].sort()).toEqual(['a', 'blockquote', 'code', 'del', 'em', 'h1', 'hr', 'li', 'ol', 'p', 'pre', 'strong', 'ul'].filter((t) => tags.has(t)).sort());
    for (const tag of tags) {
      expect(['a', 'blockquote', 'code', 'del', 'em', 'h1', 'hr', 'li', 'ol', 'p', 'pre', 'strong', 'ul']).toContain(tag);
    }
  });
});

describe('escapeHtml', () => {
  it('escapes the five dangerous characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('safeUrl', () => {
  it('allows http, https and site-relative URLs', () => {
    expect(safeUrl('https://ag.test/x')).toBe('https://ag.test/x');
    expect(safeUrl('http://ag.test')).toBe('http://ag.test');
    expect(safeUrl('/products/lamb')).toBe('/products/lamb');
  });

  it('refuses other schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,x')).toBeUndefined();
    expect(safeUrl('vbscript:x')).toBeUndefined();
    expect(safeUrl('file:///etc/passwd')).toBeUndefined();
  });
});
