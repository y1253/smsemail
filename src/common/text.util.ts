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

/**
 * Fit `text` into at most `max` characters, preferring to end on a COMPLETE
 * sentence (a trailing `.`/`!`/`?`, optionally followed by a closing quote or
 * paren). Keeps the terminating punctuation and adds no ellipsis.
 *
 * If no sentence boundary sits within `max` (or it would throw away more than
 * half the room), falls back to `truncateClean` (word boundary + "..."). The
 * result is always <= `max`, so the SMS still fits a single message.
 */
export function fitToSentence(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;

  const slice = trimmed.slice(0, max);
  // Find the END of the last sentence: terminating .!? (allowing a closing
  // quote/paren after it) that is followed by whitespace or the slice end.
  // Matched via indices so a "." inside e.g. "3.5" is never mistaken for one.
  let end = -1;
  for (const m of slice.matchAll(/[.!?]["')\]]?(?=\s|$)/g)) {
    end = m.index + m[0].length;
  }
  // Only accept it if we keep at least half the available room, otherwise a
  // clean word-boundary cut reads better than one tiny fragment.
  if (end >= max * 0.5) return slice.slice(0, end).trim();

  return truncateClean(trimmed, max);
}
