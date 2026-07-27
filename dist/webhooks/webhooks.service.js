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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WebhooksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const stripe_1 = __importDefault(require("stripe"));
const email_entity_1 = require("../emails/email.entity");
const phone_entity_1 = require("../phones/phone.entity");
const email_phone_set_entity_1 = require("../sets/email-phone-set.entity");
const income_message_entity_1 = require("../messages/income-message.entity");
const pending_sms_command_entity_1 = require("./pending-sms-command.entity");
const emails_service_1 = require("../emails/emails.service");
const gmail_service_1 = require("../gmail/gmail.service");
const openai_service_1 = require("../openai/openai.service");
const signalwire_service_1 = require("../signalwire/signalwire.service");
const text_util_1 = require("../common/text.util");
let WebhooksService = class WebhooksService {
    static { WebhooksService_1 = this; }
    emailRepo;
    phoneRepo;
    setRepo;
    incomeMessageRepo;
    pendingRepo;
    config;
    emailsService;
    gmailService;
    openAiService;
    signalwireService;
    static SMS_LIMIT = 160;
    logger = new common_1.Logger(WebhooksService_1.name);
    stripe;
    constructor(emailRepo, phoneRepo, setRepo, incomeMessageRepo, pendingRepo, config, emailsService, gmailService, openAiService, signalwireService) {
        this.emailRepo = emailRepo;
        this.phoneRepo = phoneRepo;
        this.setRepo = setRepo;
        this.incomeMessageRepo = incomeMessageRepo;
        this.pendingRepo = pendingRepo;
        this.config = config;
        this.emailsService = emailsService;
        this.gmailService = gmailService;
        this.openAiService = openAiService;
        this.signalwireService = signalwireService;
        const key = this.config.get('STRIPE_TEST_KEY');
        if (!key)
            throw new Error('STRIPE_TEST_KEY is not set');
        this.stripe = new stripe_1.default(key);
    }
    async handleGmailPush(payload) {
        const encoded = payload?.message?.data;
        if (!encoded)
            return;
        const { emailAddress, historyId: newHistoryId } = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
        const email = await this.emailRepo.findOne({
            where: { email: emailAddress, deletedAt: (0, typeorm_2.IsNull)() },
        });
        if (!email?.lastHistoryId || !email.refreshToken)
            return;
        const refreshToken = this.emailsService.decrypt(email.refreshToken);
        const rawMessages = await this.gmailService.getNewMessages(refreshToken, email.lastHistoryId);
        const activeSets = await this.setRepo.find({
            where: { email: { emailId: email.emailId }, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['phone', 'allowedSenders'],
        });
        if (!activeSets.length)
            return;
        for (const raw of rawMessages) {
            if (!raw.id)
                continue;
            try {
                const msg = await this.gmailService.fetchMessage(refreshToken, raw.id);
                const isJunk = msg.labels.some((l) => ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'SENT', 'DRAFT'].includes(l));
                if (isJunk) {
                    this.logger.debug(`Skipping message ${raw.id} (labels: ${msg.labels.join(', ')})`);
                    continue;
                }
                const record = this.incomeMessageRepo.create({
                    email,
                    createdAt: new Date(),
                    gmailMessageId: msg.gmailMessageId,
                    gmailThreadId: msg.gmailThreadId,
                    sender: msg.sender.slice(0, 145),
                    subject: msg.subject.slice(0, 255),
                });
                const saved = await this.incomeMessageRepo.save(record);
                const { bodyBudget } = this.smsScaffold(msg.sender, email.email, msg.attachmentCount, saved.messageId);
                const summary = await this.openAiService.summarize(msg.subject, msg.body, bodyBudget);
                const sms = this.buildSms(msg.sender, summary, msg.attachmentCount, saved.messageId, email.email);
                const senderAddr = this.extractEmailAddress(msg.sender);
                for (const set of activeSets) {
                    if (set.phone.optedOutAt)
                        continue;
                    const filter = set.allowedSenders ?? [];
                    if (filter.length > 0 && !filter.some((s) => s.email === senderAddr))
                        continue;
                    await this.signalwireService.sendSms(set.phone.phone, sms);
                }
            }
            catch (err) {
                this.logger.error(`Failed to process Gmail message ${raw.id}: ${err}`);
            }
        }
        email.lastHistoryId = String(newHistoryId);
        await this.emailRepo.save(email);
    }
    async handleInboundSms(from, body) {
        const normalizedFrom = from.startsWith('+') ? from.slice(1) : from;
        const phone = await this.phoneRepo.findOne({
            where: { phone: normalizedFrom, deletedAt: (0, typeorm_2.IsNull)() },
        });
        if (!phone) {
            await this.signalwireService.sendSms(from, 'No active account found for this number.');
            return;
        }
        const keyword = body.trim().toUpperCase();
        if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|QUIT|END)$/.test(keyword)) {
            if (!phone.optedOutAt) {
                phone.optedOutAt = new Date();
                await this.phoneRepo.save(phone);
            }
            await this.signalwireService.sendSms(from, "SMSMail: You're unsubscribed and will get no more messages. Reply START to resubscribe.");
            return;
        }
        if (/^(START|UNSTOP)$/.test(keyword)) {
            if (phone.optedOutAt) {
                phone.optedOutAt = null;
                await this.phoneRepo.save(phone);
            }
            await this.signalwireService.sendSms(from, "SMSMail: You're resubscribed to SMSMail alerts. Reply HELP for help, STOP to unsubscribe.");
            return;
        }
        if (keyword === 'HELP') {
            await this.signalwireService.sendSms(from, `SMSMail email-to-SMS

Reply to last email:
R your message here

Reply to email 42:
R 42 your message here

Send new email:
S someone@example.com your message

Send with a subject:
S someone@example.com | Subject | your message

Help: yechiel1253@gmail.com
Reply STOP to unsubscribe`);
            return;
        }
        const activeSets = await this.setRepo.find({
            where: { phone: { phoneId: phone.phoneId }, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email'],
        });
        const emails = [];
        const seen = new Set();
        for (const set of activeSets) {
            if (!seen.has(set.email.emailId)) {
                seen.add(set.email.emailId);
                emails.push(set.email);
            }
        }
        emails.sort((a, b) => a.emailId - b.emailId);
        if (!emails.length) {
            await this.signalwireService.sendSms(from, 'No active set found for this number.');
            return;
        }
        const emailIds = emails.map((e) => e.emailId);
        const trimmed = body.trim();
        try {
            const pending = await this.pendingRepo.findOne({
                where: { phone: normalizedFrom, expiresAt: (0, typeorm_2.MoreThan)(new Date()) },
                order: { id: 'DESC' },
            });
            if (pending) {
                if (/^\d+$/.test(trimmed)) {
                    const choice = parseInt(trimmed, 10);
                    const candidateIds = pending.emailIds.split(',').map((s) => parseInt(s, 10));
                    const chosenId = candidateIds[choice - 1];
                    const chosen = emails.find((e) => e.emailId === chosenId);
                    if (!chosen) {
                        await this.signalwireService.sendSms(from, this.buildSelectPrompt(emails));
                        return;
                    }
                    await this.pendingRepo.delete({ id: pending.id });
                    const { to, subject, body: msgBody } = this.parseSendCommand(pending.body);
                    await this.sendNewEmail(from, chosen, to, subject, msgBody);
                    return;
                }
                await this.pendingRepo.delete({ id: pending.id });
            }
            if (/^R\s+\d+\s+/i.test(trimmed)) {
                const match = trimmed.match(/^R\s+(\d+)\s+([\s\S]+)$/i);
                const msgId = parseInt(match[1], 10);
                const replyText = match[2];
                const msg = await this.incomeMessageRepo.findOne({
                    where: { messageId: msgId, email: { emailId: (0, typeorm_2.In)(emailIds) } },
                    relations: ['email'],
                });
                if (!msg)
                    throw new Error(`Message #${msgId} not found`);
                await this.replyToMessage(from, msg.email, msg, replyText);
            }
            else if (/^R\s+/i.test(trimmed)) {
                const replyText = trimmed.replace(/^R\s+/i, '');
                const latest = await this.incomeMessageRepo.findOne({
                    where: { email: { emailId: (0, typeorm_2.In)(emailIds) } },
                    order: { messageId: 'DESC' },
                    relations: ['email'],
                });
                if (!latest)
                    throw new Error('No messages to reply to');
                await this.replyToMessage(from, latest.email, latest, replyText);
            }
            else if (/^S\s+/i.test(trimmed)) {
                const { to, subject, body: msgBody } = this.parseSendCommand(trimmed);
                if (emails.length === 1) {
                    await this.sendNewEmail(from, emails[0], to, subject, msgBody);
                }
                else {
                    await this.pendingRepo.delete({ phone: normalizedFrom });
                    await this.pendingRepo.save(this.pendingRepo.create({
                        phone: normalizedFrom,
                        body: trimmed,
                        emailIds: emailIds.join(','),
                        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
                    }));
                    await this.signalwireService.sendSms(from, this.buildSelectPrompt(emails));
                }
            }
            else {
                await this.signalwireService.sendSms(from, 'Unknown command. Use R to reply, S to send, or HELP for instructions.');
            }
        }
        catch (err) {
            this.logger.error(`Inbound SMS error from ${from}: ${err}`);
            await this.signalwireService.sendSms(from, `Error: ${err.message}`);
        }
    }
    parseSendCommand(trimmed) {
        const rest = trimmed.replace(/^S\s+/i, '');
        const pipeParts = rest.split('|').map((p) => p.trim());
        if (pipeParts.length >= 3) {
            const [to, subject, ...bodyParts] = pipeParts;
            return { to, subject, body: bodyParts.join('|') };
        }
        const spaceIdx = rest.indexOf(' ');
        if (spaceIdx === -1)
            throw new Error('Missing message body. Use: S email@x.com message');
        return { to: rest.slice(0, spaceIdx), subject: '', body: rest.slice(spaceIdx + 1) };
    }
    async replyToMessage(from, email, msg, replyText) {
        if (!email.refreshToken) {
            await this.signalwireService.sendSms(from, `Gmail connection for ${email.email} needs reconnecting on the dashboard.`);
            return;
        }
        const refreshToken = this.emailsService.decrypt(email.refreshToken);
        try {
            await this.gmailService.sendReply(refreshToken, msg.gmailThreadId, msg.sender, msg.subject, replyText, email.email);
        }
        catch (err) {
            await this.handleSendError(from, email, err);
            return;
        }
        await this.signalwireService.sendSms(from, `Sent to ${msg.sender}`);
    }
    async sendNewEmail(from, email, to, subject, body) {
        if (!email.refreshToken) {
            await this.signalwireService.sendSms(from, `Gmail connection for ${email.email} needs reconnecting on the dashboard.`);
            return;
        }
        const refreshToken = this.emailsService.decrypt(email.refreshToken);
        try {
            await this.gmailService.sendEmail(refreshToken, email.email, to, subject, body);
        }
        catch (err) {
            await this.handleSendError(from, email, err);
            return;
        }
        await this.signalwireService.sendSms(from, `Sent to ${to}`);
    }
    async handleSendError(from, email, err) {
        const message = err?.message ?? String(err);
        if (/invalid_grant/i.test(message)) {
            this.logger.error(`invalid_grant sending from email ${email.emailId} (${email.email})`);
            await this.signalwireService.sendSms(from, `Gmail connection for ${email.email} needs reauthorizing — reconnect it on the dashboard.`);
            return;
        }
        throw err instanceof Error ? err : new Error(message);
    }
    buildSelectPrompt(emails) {
        const lines = emails.map((e, i) => `${i + 1} ${e.email}`);
        return `Send from which email? Reply with the number:\n${lines.join('\n')}`;
    }
    async handleStripeWebhook(rawBody, sig) {
        const secret = this.config.get('STRIPE_WEBHOOK_SECRET');
        if (!secret)
            throw new Error('STRIPE_WEBHOOK_SECRET is not set');
        let event;
        try {
            event = this.stripe.webhooks.constructEvent(rawBody, sig, secret);
        }
        catch {
            throw new Error('Stripe signature verification failed');
        }
        if (event.type !== 'invoice.payment_failed' && event.type !== 'customer.subscription.deleted') {
            return;
        }
        const subscriptionId = event.type === 'invoice.payment_failed'
            ? event.data.object.subscription
            : event.data.object.id;
        if (!subscriptionId)
            return;
        const set = await this.setRepo.findOne({
            where: { stripeSubscriptionId: subscriptionId, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email', 'phone'],
        });
        if (!set)
            return;
        if (set.email.refreshToken) {
            try {
                const refreshToken = this.emailsService.decrypt(set.email.refreshToken);
                await this.gmailService.unwatchGmail(refreshToken);
            }
            catch (err) {
                this.logger.error(`Failed to unwatch Gmail for set ${set.setId}: ${err}`);
            }
        }
        const warning = event.type === 'invoice.payment_failed'
            ? 'Payment failed — SMS email forwarding paused. Update your payment method to resume.'
            : 'Your subscription was cancelled — SMS email forwarding has been stopped.';
        if (!set.phone.optedOutAt) {
            await this.signalwireService.sendSms(set.phone.phone, warning);
        }
        set.deletedAt = new Date();
        await this.setRepo.save(set);
    }
    async renewExpiringWatches() {
        const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const emails = await this.emailRepo
            .createQueryBuilder('email')
            .where('email.deleted_at IS NULL')
            .andWhere('email.watch_expiry IS NOT NULL')
            .andWhere('email.watch_expiry <= :deadline', { deadline })
            .getMany();
        for (const email of emails) {
            if (!email.refreshToken)
                continue;
            try {
                const refreshToken = this.emailsService.decrypt(email.refreshToken);
                const { historyId, expiry } = await this.gmailService.watchGmail(refreshToken);
                email.lastHistoryId = historyId;
                email.watchExpiry = expiry;
                await this.emailRepo.save(email);
            }
            catch (err) {
                this.logger.error(`Failed to renew Gmail watch for email ${email.emailId}: ${err}`);
            }
        }
    }
    extractEmailAddress(sender) {
        const match = sender.match(/<([^>]+)>/);
        return (match ? match[1] : sender).trim().toLowerCase();
    }
    formatSender(raw) {
        const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
        if (match) {
            const name = match[1].trim();
            const email = match[2].trim();
            return name ? `${name} ${email}` : email;
        }
        return raw.trim();
    }
    smsScaffold(sender, toEmail, attachmentCount, messageId) {
        const replyHint = `Reply: R ${messageId}`;
        const footer = attachmentCount > 0 ? `📎+${attachmentCount}  |  ${replyHint}` : replyHint;
        const s = (0, text_util_1.ellipsize)(this.formatSender(sender), 40);
        const to = (0, text_util_1.ellipsize)(toEmail, 30);
        const fixed = `To: ${to}\nFrom: ${s}\n\n\n\n${footer}`;
        return { to, s, footer, bodyBudget: Math.max(10, WebhooksService_1.SMS_LIMIT - fixed.length) };
    }
    buildSms(sender, summary, attachmentCount, messageId, toEmail) {
        const { to, s, footer, bodyBudget } = this.smsScaffold(sender, toEmail, attachmentCount, messageId);
        const body = (0, text_util_1.fitToSentence)(summary, bodyBudget);
        return `To: ${to}\nFrom: ${s}\n\n${body}\n\n${footer}`;
    }
};
exports.WebhooksService = WebhooksService;
__decorate([
    (0, schedule_1.Cron)('0 2 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WebhooksService.prototype, "renewExpiringWatches", null);
exports.WebhooksService = WebhooksService = WebhooksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(email_entity_1.Email)),
    __param(1, (0, typeorm_1.InjectRepository)(phone_entity_1.Phone)),
    __param(2, (0, typeorm_1.InjectRepository)(email_phone_set_entity_1.EmailPhoneSet)),
    __param(3, (0, typeorm_1.InjectRepository)(income_message_entity_1.IncomeMessage)),
    __param(4, (0, typeorm_1.InjectRepository)(pending_sms_command_entity_1.PendingSmsCommand)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        emails_service_1.EmailsService,
        gmail_service_1.GmailService,
        openai_service_1.OpenAiService,
        signalwire_service_1.SignalwireService])
], WebhooksService);
//# sourceMappingURL=webhooks.service.js.map