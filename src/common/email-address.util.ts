/**
 * Exactly the shape `GmailService.buildRaw` enforces before writing a `To:`
 * header. Shared so the inbound SMS command parser can reject a bad recipient
 * *before* attempting the send, without the two checks ever drifting apart.
 *
 * No /g flag: a shared global regex carries `lastIndex` between calls, so
 * `.test()` would alternate true/false on identical input.
 */
export const BARE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isBareEmailAddress(value: string): boolean {
  return BARE_EMAIL_RE.test(value);
}

// Zero-width joiners and the BOM: invisible, never part of an address, and
// NOT matched by JS `\s` (except U+FEFF), so they survive `trim()` and would
// silently corrupt a recipient.
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

// Unicode spaces that ARE matched by `\s` but are not U+0020. Folded to a
// plain space so one splitting rule covers every keyboard/autocorrect variant
// (iOS in particular likes to insert U+00A0 after an autocorrection).
const UNICODE_SPACE_RE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/**
 * Fold exotic whitespace to ASCII and drop invisible characters. Newlines and
 * tabs are deliberately KEPT — they are legal inside a message body, and only
 * the recipient/body split cares about them.
 */
export function normalizeSmsText(text: string): string {
  return text.replace(ZERO_WIDTH_RE, '').replace(UNICODE_SPACE_RE, ' ');
}

/**
 * Best-effort cleanup of one typed recipient token into a bare address.
 *
 * Deliberately does NOT lowercase: the local part of an address is
 * case-sensitive, the same reasoning as `WebhooksService.extractEmailAddress`.
 */
export function normalizeRecipient(raw: string): string {
  let value = normalizeSmsText(raw).trim();
  value = value.replace(/^to\s*:\s*/i, ''); // "To: a@b.com", as our own alerts format it
  value = value.replace(/^mailto:/i, ''); // pasted out of a mail client link
  const angled = value.match(/<([^>]+)>/); // "Bob <bob@x.com>" or "<bob@x.com>"
  if (angled) value = angled[1];
  value = value.replace(/^[\s"'\u2018\u201C(\[<]+/, '');
  // A valid address can never END in any of these, so a trailing one is a
  // typing artefact ("a@b.com," / "a@b.com."). Only the ends are touched.
  value = value.replace(/[\s"'\u2019\u201D)\]>.,;:!?]+$/, '');
  return value.trim();
}
