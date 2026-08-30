"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BARE_EMAIL_RE = void 0;
exports.isBareEmailAddress = isBareEmailAddress;
exports.normalizeSmsText = normalizeSmsText;
exports.normalizeRecipient = normalizeRecipient;
exports.BARE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isBareEmailAddress(value) {
    return exports.BARE_EMAIL_RE.test(value);
}
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;
const UNICODE_SPACE_RE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
function normalizeSmsText(text) {
    return text.replace(ZERO_WIDTH_RE, '').replace(UNICODE_SPACE_RE, ' ');
}
function normalizeRecipient(raw) {
    let value = normalizeSmsText(raw).trim();
    value = value.replace(/^to\s*:\s*/i, '');
    value = value.replace(/^mailto:/i, '');
    const angled = value.match(/<([^>]+)>/);
    if (angled)
        value = angled[1];
    value = value.replace(/^[\s"'\u2018\u201C(\[<]+/, '');
    value = value.replace(/[\s"'\u2019\u201D)\]>.,;:!?]+$/, '');
    return value.trim();
}
//# sourceMappingURL=email-address.util.js.map