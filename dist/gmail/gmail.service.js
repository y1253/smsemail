"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const googleapis_1 = require("googleapis");
let GmailService = class GmailService {
    config;
    constructor(config) {
        this.config = config;
    }
    getAuthClient(refreshToken) {
        const client = new googleapis_1.google.auth.OAuth2(this.config.get('GOOGLE_CLIENT_ID'), this.config.get('GOOGLE_CLIENT_SECRET'));
        client.setCredentials({ refresh_token: refreshToken });
        return client;
    }
    async watchGmail(refreshToken) {
        const auth = this.getAuthClient(refreshToken);
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
        const topic = this.config.get('GOOGLE_PUBSUB_TOPIC');
        const res = await gmail.users.watch({
            userId: 'me',
            requestBody: {
                topicName: topic,
                labelIds: ['INBOX'],
            },
        });
        return {
            historyId: String(res.data.historyId),
            expiry: new Date(Number(res.data.expiration)),
        };
    }
    async unwatchGmail(refreshToken) {
        const auth = this.getAuthClient(refreshToken);
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
        await gmail.users.stop({ userId: 'me' });
    }
    async getNewMessages(refreshToken, startHistoryId) {
        const auth = this.getAuthClient(refreshToken);
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
        const res = await gmail.users.history.list({
            userId: 'me',
            startHistoryId,
            historyTypes: ['messageAdded'],
            labelId: 'INBOX',
        });
        const messages = [];
        for (const record of res.data.history ?? []) {
            for (const added of record.messagesAdded ?? []) {
                if (added.message?.id) {
                    messages.push(added.message);
                }
            }
        }
        return messages;
    }
    async fetchMessage(refreshToken, messageId) {
        const auth = this.getAuthClient(refreshToken);
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
        const msg = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
        });
        const headers = msg.data.payload?.headers ?? [];
        const getHeader = (name) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
        const sender = getHeader('From');
        const subject = getHeader('Subject');
        const labels = msg.data.labelIds ?? [];
        const attachmentCount = (msg.data.payload?.parts ?? []).filter((p) => p.filename && p.filename.length > 0).length;
        const body = this.extractBody(msg.data.payload);
        return {
            gmailMessageId: msg.data.id,
            gmailThreadId: msg.data.threadId,
            sender,
            subject,
            body,
            attachmentCount,
            labels,
        };
    }
    async sendReply(refreshToken, threadId, to, subject, body, from) {
        const auth = this.getAuthClient(refreshToken);
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        const raw = this.buildRaw(from, to, replySubject, body);
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw, threadId },
        });
    }
    async sendEmail(refreshToken, from, to, subject, body) {
        const auth = this.getAuthClient(refreshToken);
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
        const raw = this.buildRaw(from, to, subject, body);
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw },
        });
    }
    extractBody(payload) {
        if (!payload)
            return '';
        if (payload.mimeType === 'text/plain' && payload.body?.data) {
            return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
        for (const part of payload.parts ?? []) {
            const text = this.extractBody(part);
            if (text)
                return text;
        }
        return '';
    }
    buildRaw(from, to, subject, body) {
        const lines = [
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=utf-8',
            '',
            body,
        ];
        return Buffer.from(lines.join('\r\n')).toString('base64url');
    }
};
exports.GmailService = GmailService;
exports.GmailService = GmailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GmailService);
//# sourceMappingURL=gmail.service.js.map