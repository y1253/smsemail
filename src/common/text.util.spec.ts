import { truncateClean } from './text.util';

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
