"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripQuotedText = stripQuotedText;
const ATTRIBUTIONS = [
    /^On\b.*\bwrote:$/i,
    /^Am\b.*\bschrieb\b.*:$/i,
    /^El\b.*\bescribió:$/i,
    /^Le\b.*\ba écrit\s*:$/i,
];
const ATTRIBUTION_MAX_LINES = 3;
const SEPARATORS = [/^[-_=]{4,}/, /^Begin forwarded message:$/i];
const SIGNATURES = [
    /^--\s*$/,
    /^Sent from my \S+/i,
    /^Sent from (Yahoo|Mail for Windows|Outlook)/i,
    /^Get Outlook for (iOS|Android)\b/i,
];
function isHeaderBlock(lines, start) {
    if (!/^\s*From:\s*\S/.test(lines[start]))
        return false;
    let seen = 0;
    for (let i = start + 1; i < lines.length && seen < 4; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed)
            continue;
        seen++;
        if (/^(Sent|Date|To|Cc|Subject):/i.test(trimmed))
            return true;
    }
    return false;
}
function attributionCut(kept) {
    const parts = [];
    for (let k = 1; k <= ATTRIBUTION_MAX_LINES && k <= kept.length; k++) {
        const trimmed = kept[kept.length - k].trim();
        if (!trimmed)
            break;
        parts.unshift(trimmed);
        const joined = parts.join(' ');
        if (ATTRIBUTIONS.some((re) => re.test(joined)))
            return kept.length - k;
    }
    return null;
}
function stripQuotedText(body) {
    const lines = body.split(/\r?\n/);
    const kept = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (line.trimStart().startsWith('>'))
            continue;
        if (SEPARATORS.some((re) => re.test(trimmed)))
            break;
        if (isHeaderBlock(lines, i))
            break;
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
//# sourceMappingURL=quoted-text.util.js.map