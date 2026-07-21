"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncateClean = truncateClean;
exports.fitToSentence = fitToSentence;
function truncateClean(text, max) {
    const trimmed = text.trim();
    if (trimmed.length <= max)
        return trimmed;
    if (max <= 3)
        return '...'.slice(0, Math.max(0, max));
    const ELLIPSIS = '...';
    const room = max - ELLIPSIS.length;
    let cut = trimmed.slice(0, room);
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace >= room * 0.5)
        cut = cut.slice(0, lastSpace);
    cut = cut.replace(/[\s.,;:!?-]+$/, '');
    return `${cut}${ELLIPSIS}`;
}
function fitToSentence(text, max) {
    const trimmed = text.trim();
    if (trimmed.length <= max)
        return trimmed;
    const slice = trimmed.slice(0, max);
    let end = -1;
    for (const m of slice.matchAll(/[.!?]["')\]]?(?=\s|$)/g)) {
        end = m.index + m[0].length;
    }
    if (end >= max * 0.5)
        return slice.slice(0, end).trim();
    return truncateClean(trimmed, max);
}
//# sourceMappingURL=text.util.js.map