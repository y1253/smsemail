"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomMessageId = randomMessageId;
const node_crypto_1 = require("node:crypto");
const MIN_MESSAGE_ID = 100_000;
const MAX_MESSAGE_ID = 999_999;
function randomMessageId() {
    return (0, node_crypto_1.randomInt)(MIN_MESSAGE_ID, MAX_MESSAGE_ID + 1);
}
//# sourceMappingURL=id.util.js.map