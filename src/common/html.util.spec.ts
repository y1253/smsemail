import { looksLikeHtml, stripStrayMarkup } from './html.util';

describe('looksLikeHtml', () => {
  it('recognizes a full document by its doctype', () => {
    expect(looksLikeHtml('<!doctype html><html><body>Hi</body></html>')).toBe(true);
  });

  it('recognizes a fragment with several structural tags', () => {
    expect(looksLikeHtml('<div><p>Your order shipped</p></div>')).toBe(true);
  });

  it('does not flag prose carrying a single stray tag', () => {
    expect(looksLikeHtml('Thanks, see you <br> tomorrow')).toBe(false);
  });

  it('does not flag an email address in angle brackets', () => {
    expect(looksLikeHtml('Forwarded from John Doe <john@example.com> yesterday')).toBe(
      false,
    );
  });

  it('does not flag an inequality', () => {
    expect(looksLikeHtml('The rule is a < b and b < c, always.')).toBe(false);
  });
});

describe('stripStrayMarkup', () => {
  it('leaves ordinary prose untouched', () => {
    const body = 'Hi Sarah,\n\nThe invoice is $84.20 and due 8/15.\n\nThanks!';
    expect(stripStrayMarkup(body)).toBe(body);
  });

  it('removes a stray tag and decodes entities', () => {
    expect(stripStrayMarkup('Hi &amp; welcome <b>back</b>')).toBe('Hi & welcome back');
  });

  it('turns a line-break tag into a line break', () => {
    expect(stripStrayMarkup('Hi<br>there')).toBe('Hi\nthere');
  });

  it('keeps an angle-bracketed email address', () => {
    expect(stripStrayMarkup('From John Doe <john@example.com> today')).toBe(
      'From John Doe <john@example.com> today',
    );
  });

  it('keeps an inequality', () => {
    expect(stripStrayMarkup('The rule is a < b, always.')).toBe(
      'The rule is a < b, always.',
    );
  });

  it('decodes &nbsp; to an ordinary space, not U+00A0', () => {
    const out = stripStrayMarkup('Order&nbsp;#4471&nbsp;shipped');
    expect(out).toBe('Order #4471 shipped');
  });

  it('decodes numeric and hex references', () => {
    expect(stripStrayMarkup('Caf&#233; opens at 8&#x3a;30')).toBe('Café opens at 8:30');
  });

  it('does not decode an escaped entity twice', () => {
    expect(stripStrayMarkup('Write &amp;lt;b&amp;gt; to show a tag')).toBe(
      'Write &lt;b&gt; to show a tag',
    );
  });

  it('leaves an unknown entity alone', () => {
    expect(stripStrayMarkup('Ampersand &notreal; here')).toBe('Ampersand &notreal; here');
  });

  it('drops comments and declarations', () => {
    expect(stripStrayMarkup('Meeting at 3<!-- internal note -->pm')).toBe(
      'Meeting at 3pm',
    );
  });
});
