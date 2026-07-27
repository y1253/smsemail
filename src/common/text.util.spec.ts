import { ellipsize, fitToSentence, truncateClean } from './text.util';

describe('truncateClean', () => {
  it('returns short text unchanged, without an ellipsis', () => {
    expect(truncateClean('Hello there', 50)).toBe('Hello there');
  });

  it('trims surrounding whitespace when within budget', () => {
    expect(truncateClean('  Hello there  ', 50)).toBe('Hello there');
  });

  it('truncates long text on a word boundary and ends with ...', () => {
    const result = truncateClean(
      'Invoice for four hundred dollars is due this Friday, pay via the portal',
      40,
    );
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith('...')).toBe(true);
    // The char before "..." must not be a space or a split word fragment.
    const before = result.slice(0, -3);
    expect(before).toBe(before.trimEnd());
    // No partial trailing word: every word in the result is whole.
    expect('Invoice for four hundred dollars is due this Friday, pay via the portal').toContain(
      before.replace(/[.,;:!?-]+$/, ''),
    );
  });

  it('hard-cuts a single word longer than max, still ending with ...', () => {
    const giant = 'a'.repeat(100);
    const result = truncateClean(giant, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles a tiny max without throwing', () => {
    expect(truncateClean('anything long here', 3)).toBe('...');
    expect(truncateClean('anything long here', 2)).toBe('..');
    expect(truncateClean('anything long here', 0)).toBe('');
  });
});

describe('ellipsize', () => {
  it('returns text unchanged, and trimmed, when it fits', () => {
    expect(ellipsize('Bob bob@x.com', 40)).toBe('Bob bob@x.com');
    expect(ellipsize('  Bob bob@x.com  ', 40)).toBe('Bob bob@x.com');
  });

  it('cuts a long sender to exactly max and ends with ...', () => {
    const result = ellipsize('Jonathan Smithers jonathan.smithers@longcompany.com', 40);
    expect(result).toBe('Jonathan Smithers jonathan.smithers@l...');
    expect(result.length).toBe(40); // 37 kept chars + "..."
    expect(result.endsWith('...')).toBe(true);
  });

  it('keeps the address fragment instead of snapping back to the display name', () => {
    const sender = 'Averyverylongdisplayname Smith bob@example.com';
    const result = ellipsize(sender, 40);
    expect(result).toBe('Averyverylongdisplayname Smith bob@ex...');
    // truncateClean would have thrown the address away at the word boundary.
    expect(result).not.toBe(truncateClean(sender, 40));
  });

  it('handles a tiny max without throwing', () => {
    expect(ellipsize('anything long here', 3)).toBe('...');
    expect(ellipsize('anything long here', 2)).toBe('..');
    expect(ellipsize('anything long here', 0)).toBe('');
  });

  it('always stays within max', () => {
    const text = 'Jonathan Smithers jonathan.smithers@longcompany.example.com';
    for (const max of [0, 1, 3, 4, 10, 30, 40, 59, 100]) {
      expect(ellipsize(text, max).length).toBeLessThanOrEqual(max);
    }
  });
});

describe('fitToSentence', () => {
  it('returns text unchanged when it already fits', () => {
    const text = 'Invoice is due Friday.';
    expect(fitToSentence(text, 100)).toBe(text);
  });

  it('keeps only whole sentences and adds no ellipsis', () => {
    const text = 'Invoice is due Friday. Please pay online. A late fee applies after that.';
    const out = fitToSentence(text, 45);
    expect(out.length).toBeLessThanOrEqual(45);
    expect(out).not.toContain('...');
    expect(out).toBe('Invoice is due Friday. Please pay online.');
  });

  it('does not treat a decimal point as a sentence boundary', () => {
    const text = 'Meeting at 5. The plan covers 3.5 million users and more.';
    const out = fitToSentence(text, 20);
    expect(out).toBe('Meeting at 5.');
  });

  it('falls back to a word-boundary cut when no sentence fits', () => {
    const text = 'This single very long sentence has no early period so it must be cut';
    const out = fitToSentence(text, 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.endsWith('...')).toBe(true);
    expect(out).toBe(truncateClean(text, 30));
  });

  it('always stays within max', () => {
    const text = 'One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten.';
    for (const max of [10, 15, 20, 33, 40]) {
      expect(fitToSentence(text, max).length).toBeLessThanOrEqual(max);
    }
  });
});
