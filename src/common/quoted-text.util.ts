/**
 * Remove quoted history from an inbound email body so only the text the
 * sender newly wrote survives.
 *
 * This runs before the OpenAI summarizer (see `GmailService.fetchMessage`),
 * so the model never sees the message that was replied to -- otherwise it
 * happily summarizes the *old* mail and the 160-char SMS is spent on text the
 * user already read.
 *
 * The scan walks forward and cuts at the FIRST boundary it recognizes. When
 * nothing survives (a reply with no new text at all) the original body is
 * returned rather than an empty string, so the SMS is never blank.
 */

// Attribution lines that clients put above the quoted block. Matched against a
// single line AND against up to `ATTRIBUTION_MAX_LINES` consecutive lines
// joined by a space, because clients wrap long attributions.
const ATTRIBUTIONS: RegExp[] = [
  /^On\b.*\bwrote:$/i, // Gmail / Apple Mail (en)
  /^Am\b.*\bschrieb\b.*:$/i, // de
  /^El\b.*\bescribió:$/i, // es
  /^Le\b.*\ba écrit\s*:$/i, // fr
];

const ATTRIBUTION_MAX_LINES = 3;

// A divider, after which everything is the quoted/forwarded original.
// The `{4,}` prefix rule also covers "-----Original Message-----",
// "---------- Forwarded message ----------" and Outlook's "______" rule,
// and html-to-text renders an <hr> as a dash run that lands here too.
const SEPARATORS: RegExp[] = [/^[-_=]{4,}/, /^Begin forwarded message:$/i];

// Signature markers. Only cut here once some real content has been kept, so a
// message whose entire text is "Sent from my iPhone" is not emptied.
const SIGNATURES: RegExp[] = [
  /^--\s*$/, // RFC 3676 signature delimiter
  /^Sent from my \S+/i,
  /^Sent from (Yahoo|Mail for Windows|Outlook)/i,
  /^Get Outlook for (iOS|Android)\b/i,
];

/**
 * Outlook (and Outlook Web) quotes without any ">" marker or attribution
 * line: it repeats the original's headers as a block. Detected as a "From:"
 * line followed, within the next few non-blank lines, by another header.
 */
function isHeaderBlock(lines: string[], start: number): boolean {
  if (!/^\s*From:\s*\S/.test(lines[start])) return false;

  let seen = 0;
  for (let i = start + 1; i < lines.length && seen < 4; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    seen++;
    if (/^(Sent|Date|To|Cc|Subject):/i.test(trimmed)) return true;
  }
  return false;
}

/**
 * If the tail of `kept` is an attribution line (possibly wrapped over several
 * lines), return the length `kept` should be truncated to. Otherwise null.
 */
function attributionCut(kept: string[]): number | null {
  const parts: string[] = [];

  for (let k = 1; k <= ATTRIBUTION_MAX_LINES && k <= kept.length; k++) {
    const trimmed = kept[kept.length - k].trim();
    // A blank line ends the run: an attribution never contains one.
    if (!trimmed) break;
    parts.unshift(trimmed);
    const joined = parts.join(' ');
    if (ATTRIBUTIONS.some((re) => re.test(joined))) return kept.length - k;
  }

  return null;
}

export function stripQuotedText(body: string): string {
  const lines = body.split(/\r?\n/);
  const kept: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Quoted lines are dropped but the scan continues: a bottom-posted reply
    // puts the new text *after* the quoted block.
    if (line.trimStart().startsWith('>')) continue;

    if (SEPARATORS.some((re) => re.test(trimmed))) break;
    if (isHeaderBlock(lines, i)) break;
    if (SIGNATURES.some((re) => re.test(trimmed)) && kept.some((l) => l.trim()))
      break;

    kept.push(line);

    const cut = attributionCut(kept);
    if (cut !== null) {
      kept.length = cut;
      break;
    }
  }

  const stripped = kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return stripped || body.trim();
}
