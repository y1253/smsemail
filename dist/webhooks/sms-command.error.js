"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsCommandError = void 0;
class SmsCommandError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SmsCommandError';
    }
}
exports.SmsCommandError = SmsCommandError;
//# sourceMappingURL=sms-command.error.js.map