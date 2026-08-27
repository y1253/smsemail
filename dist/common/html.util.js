"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlToText = htmlToText;
exports.looksLikeHtml = looksLikeHtml;
exports.stripStrayMarkup = stripStrayMarkup;
const html_to_text_1 = require("html-to-text");
const CONVERT_OPTIONS = {
    wordwrap: false,
    selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'blockquote.gmail_quote', format: 'skip' },
        { selector: 'div.gmail_quote', format: 'skip' },
        { selector: 'div.gmail_quote_container', format: 'skip' },
        { selector: 'blockquote[type="cite"]', format: 'skip' },
        { selector: '.moz-cite-prefix', format: 'skip' },
        { selector: '.protonmail_quote', format: 'skip' },
        { selector: '.yahoo_quoted', format: 'skip' },
        { selector: 'div[id^="divRplyFwdMsg"]', format: 'skip' },
        { selector: '.gmail_signature', format: 'skip' },
    ],
};
function htmlToText(raw) {
    return (0, html_to_text_1.convert)(raw, CONVERT_OPTIONS);
}
const STRUCTURAL_TAG = /<\s*(?:!doctype\s+html|html|head|body|table|tbody|tr|td|div|span|p|br|img|meta|style|font|center|ul|ol|li|h[1-6]|a)\b[^>]*>/gi;
const DOCUMENT_MARKER = /<\s*(?:!doctype\s+html|html|head|body)\b/i;
function looksLikeHtml(text) {
    if (DOCUMENT_MARKER.test(text))
        return true;
    const matches = text.match(STRUCTURAL_TAG);
    return !!matches && matches.length >= 2;
}
const LINE_BREAK_TAG = /<\/?(?:br|p|div|tr|li|h[1-6]|blockquote|ul|ol|table)\b[^>]*>/gi;
const ANY_TAG = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi;
const NAMED_ENTITIES = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
};
function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref) => {
        if (ref[0] !== '#')
            return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
        const code = ref[1] === 'x' || ref[1] === 'X'
            ? parseInt(ref.slice(2), 16)
            : parseInt(ref.slice(1), 10);
        if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff)
            return whole;
        if (code >= 0xd800 && code <= 0xdfff)
            return whole;
        return String.fromCodePoint(code);
    });
}
function collapseWhitespace(text) {
    return text
        .replace(/[^\S\n]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
function stripStrayMarkup(text) {
    const stripped = text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<![^>]*>/g, '')
        .replace(LINE_BREAK_TAG, '\n')
        .replace(ANY_TAG, '');
    return collapseWhitespace(decodeEntities(stripped));
}
//# sourceMappingURL=html.util.js.map