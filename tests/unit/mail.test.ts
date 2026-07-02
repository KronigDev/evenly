import { describe, expect, it } from 'vitest';
import { escapeHtml, stripHtml } from '@/lib/mail';

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml(`Tom & "Jerry" <script>'`)).toBe(
      'Tom &amp; &quot;Jerry&quot; &lt;script&gt;&#39;',
    );
  });

  it('escapes & first so pre-existing entities are not double-encoded ambiguously', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('stripHtml', () => {
  it('round-trips escapeHtml exactly (decodes &amp; last)', () => {
    const cases = ['&lt;', 'a<b & c>d', '&amp;lt;', 'Tom & "Jerry" <script>', '&amp;amp;', "it's"];
    for (const original of cases) {
      expect(stripHtml(escapeHtml(original))).toBe(original);
    }
  });

  it('does not double-decode text that literally contains an entity', () => {
    // User text "&lt;" is encoded to "&amp;lt;"; decoding must yield "&lt;", not "<".
    expect(stripHtml('&amp;lt;')).toBe('&lt;');
  });

  it('strips tags and rewrites links to "text (url)"', () => {
    const html = '<p>Hello <a href="https://example.com/x?a=1&amp;b=2">click here</a> now</p>';
    expect(stripHtml(html)).toBe('Hello click here (https://example.com/x?a=1&b=2) now');
  });
});
