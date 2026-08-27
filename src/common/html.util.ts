import { convert, HtmlToTextOptions } from 'html-to-text';

/**
 * How an email's HTML is flattened into the text we summarize. Shared so the
 * `text/html` part and a `text/plain` part that is secretly HTML get identical
 * treatment.
 */
const CONVERT_OPTIONS: HtmlToTextOptions = {
  wordwrap: false,
  selectors: [
    { selector: 'a', options: { ignoreHref: true } },
    { selector: 'img', format: 'skip' },
    // Drop the quoted thread structurally, before it ever becomes text.
    // A bare <blockquote> is deliberately left alone: its default
    // formatter emits "> " prefixes, which stripQuotedText handles, and
    // skipping it would eat real content in non-reply mail.
    { selector: 'blockquote.gmail_quote', format: 'skip' },
    { selector: 'div.gmail_quote', format: 'skip' },
    { selector: 'div.gmail_quote_container', format: 'skip' },
    { selector: 'blockquote[type="cite"]', format: 'skip' }, // Apple Mail
    { selector: '.moz-cite-prefix', format: 'skip' }, // Thunderbird
    { selector: '.protonmail_quote', format: 'skip' },
    { selector: '.yahoo_quoted', format: 'skip' },
    { selector: 'div[id^="divRplyFwdMsg"]', format: 'skip' }, // Outlook
    { selector: '.gmail_signature', format: 'skip' },
  ],
};

/** Flatten an HTML email body to plain text, dropping the quoted thread. */
export function htmlToText(raw: string): string {
  return convert(raw, CONVERT_OPTIONS);
}

// Tags a real HTML email is built out of. Bare `<b>`/`<i>`/`<em>` are absent on
// purpose — one of those in a plain-text mail is a typo or a code sample, not a
// document, and stripStrayMarkup handles it without invoking the full parser.
const STRUCTURAL_TAG =
  /<\s*(?:!doctype\s+html|html|head|body|table|tbody|tr|td|div|span|p|br|img|meta|style|font|center|ul|ol|li|h[1-6]|a)\b[^>]*>/gi;

// A document wrapper is proof on its own; nothing else produces these.
const DOCUMENT_MARKER = /<\s*(?:!doctype\s+html|html|head|body)\b/i;

/**
 * Whether `text` is an HTML document rather than prose — used to catch senders
 * that put markup inside a part labelled `text/plain`.
 *
 * Deliberately conservative: one structural tag is not enough, because sending
 * an otherwise-plain email through the HTML parser costs more than it gains.
 */
export function looksLikeHtml(text: string): boolean {
  if (DOCUMENT_MARKER.test(text)) return true;
  const matches = text.match(STRUCTURAL_TAG);
  return !!matches && matches.length >= 2;
}

// Tags that separate blocks of text — without this, "Hi<br>there" would join.
const LINE_BREAK_TAG = /<\/?(?:br|p|div|tr|li|h[1-6]|blockquote|ul|ol|table)\b[^>]*>/gi;

// A tag-shaped run. The optional attribute tail must start with whitespace, so
// this does NOT match "<john@example.com>" (a bare address in a From: line) and
// the leading letter requirement means "if a < b then" is left alone too.
const ANY_TAG = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi;

const NAMED_ENTITIES: Record<string, string> = {
  // A literal U+00A0 would survive into the SMS and push it out of the cheaper
  // GSM-7 encoding, so &nbsp; becomes an ordinary space.
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * Decode HTML entities in one pass. One pass (rather than a chain of
 * `.replace()` calls) is what stops "&amp;lt;" from decoding twice into "<".
 */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] !== '#') return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;

    const code =
      ref[1] === 'x' || ref[1] === 'X'
        ? parseInt(ref.slice(2), 16)
        : parseInt(ref.slice(1), 10);
    // Reject lone surrogates and out-of-range points: fromCodePoint throws.
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
    if (code >= 0xd800 && code <= 0xdfff) return whole;
    return String.fromCodePoint(code);
  });
}

/** Tidy the whitespace left behind by removing tags, keeping paragraph breaks. */
function collapseWhitespace(text: string): string {
  return text
    .replace(/[^\S\n]+/g, ' ') // runs of spaces/tabs/CR -> one space
    .replace(/ *\n */g, '\n') // no space hugging a line break
    .replace(/\n{3,}/g, '\n\n') // cap blank runs; stripQuotedText reads lines
    .trim();
}

/**
 * Clean a body that is prose, not a document: remove the odd stray tag and
 * decode entities, leaving the wording and line structure intact.
 *
 * Tags are removed BEFORE entities are decoded, so an escaped "&lt;b&gt;" that
 * the sender meant as visible text survives as "<b>".
 */
export function stripStrayMarkup(text: string): string {
  const stripped = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<![^>]*>/g, '') // doctype and other declarations
    .replace(LINE_BREAK_TAG, '\n')
    .replace(ANY_TAG, '');

  return collapseWhitespace(decodeEntities(stripped));
}
