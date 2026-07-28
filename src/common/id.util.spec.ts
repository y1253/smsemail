import { randomMessageId } from './id.util';

describe('randomMessageId', () => {
  const DRAWS = 5000;
  const draws = Array.from({ length: DRAWS }, () => randomMessageId());

  it('always returns an integer inside [100000, 999999]', () => {
    for (const id of draws) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(100_000);
      expect(id).toBeLessThanOrEqual(999_999);
    }
  });

  it('always stringifies to exactly 6 digits', () => {
    for (const id of draws) {
      expect(String(id)).toMatch(/^\d{6}$/);
    }
  });

  it('is actually random, not a constant or a counter', () => {
    const unique = new Set(draws);
    // 5000 draws from a 900k space: collisions are possible but the set must
    // still be overwhelmingly distinct. A counter or constant would fail hard.
    expect(unique.size).toBeGreaterThan(DRAWS * 0.99);
    // Consecutive draws must not increment.
    const sequential = draws.slice(1).filter((id, i) => id === draws[i] + 1).length;
    expect(sequential).toBeLessThan(10);
  });
});
