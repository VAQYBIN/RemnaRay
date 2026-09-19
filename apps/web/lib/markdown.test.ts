import { describe, expect, it } from 'vitest';

import { markdownToHtml } from './markdown';

describe('legal markdown rendering', () => {
  it('renders supported blocks and escapes HTML', () => {
    const html = markdownToHtml('# Terms\n\n- One\n- Two\n\n<script>alert(1)</script>');

    expect(html).toContain('<h1>Terms</h1>');
    expect(html).toContain('<ul><li>One</li><li>Two</li></ul>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
