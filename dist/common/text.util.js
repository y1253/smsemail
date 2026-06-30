"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncateClean = truncateClean;
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
//# sourceMappingURL=text.util.js.map