/**
 * Truncate `text` to at most `max` characters without splitting a word.
 * Appends an ASCII "..." when truncation happens. ASCII (not the "…" glyph)
 * is deliberate: a plain-text SMS stays in the cheaper GSM-7 single-segment
 * encoding, matching the existing 160-char behavior.
 */
export function truncateClean(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  if (max <= 3) return '...'.slice(0, Math.max(0, max));

  const ELLIPSIS = '...';
  const room = max - ELLIPSIS.length;
  let cut = trimmed.slice(0, room);
  const lastSpace = cut.lastIndexOf(' ');
  // Snap back to the last word boundary, but not if it throws away too much
  // (a single very long word just gets hard-cut).
  if (lastSpace >= room * 0.5) cut = cut.slice(0, lastSpace);
  cut = cut.replace(/[\s.,;:!?-]+$/, ''); // drop trailing space/punctuation
  return `${cut}${ELLIPSIS}`;
}
