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
const emails_service_1 = require("../emails/emails.service");
const gmail_service_1 = require("../gmail/gmail.service");
const openai_service_1 = require("../openai/openai.service");
const signalwire_service_1 = require("../signalwire/signalwire.service");
let WebhooksService = WebhooksService_1 = class WebhooksService {
    emailRepo;
    phoneRepo;
    setRepo;
    incomeMessageRepo;
    config;
    emailsService;
    gmailService;
    openAiService;
    signalwireService;
    logger = new common_1.Logger(WebhooksService_1.name);
    stripe;
    constructor(emailRepo, phoneRepo, setRepo, incomeMessageRepo, config, emailsService, gmailService, openAiService, signalwireService) {
        this.emailRepo = emailRepo;
        this.phoneRepo = phoneRepo;
        this.setRepo = setRepo;
        this.incomeMessageRepo = incomeMessageRepo;
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
        if (!email?.lastHistoryId)
            return;
        const refreshToken = this.emailsService.decrypt(email.refreshToken);
        const rawMessages = await this.gmailService.getNewMessages(refreshToken, email.lastHistoryId);
        const activeSets = await this.setRepo.find({
            where: { email: { emailId: email.emailId }, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['phone'],
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
                const budget = this.summaryBudget(msg.sender, msg.subject, msg.attachmentCount, email.email);
                const summary = await this.openAiService.summarize(msg.body, budget);
                const record = this.incomeMessageRepo.create({
                    email,
                    createdAt: new Date(),
                    gmailMessageId: msg.gmailMessageId,
                    gmailThreadId: msg.gmailThreadId,
                    sender: msg.sender.slice(0, 145),
                    subject: msg.subject.slice(0, 255),
                });
                const saved = await this.incomeMessageRepo.save(record);
                const sms = this.buildSms(msg.sender, msg.subject, summary, msg.attachmentCount, saved.messageId, email.email);
                for (const set of activeSets) {
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
        const activeSet = await this.setRepo.findOne({
            where: { phone: { phoneId: phone.phoneId }, deletedAt: (0, typeorm_2.IsNull)() },
            relations: ['email'],
        });
        if (!activeSet) {
            await this.signalwireService.sendSms(from, 'No active set found for this number.');
            return;
        }
        const refreshToken = this.emailsService.decrypt(activeSet.email.refreshToken);
        const senderAddress = activeSet.email.email;
        const trimmed = body.trim();
        try {
            if (/^R\s+\d+\s+/i.test(trimmed)) {
                const match = trimmed.match(/^R\s+(\d+)\s+([\s\S]+)$/i);
                const msgId = parseInt(match[1], 10);
                const replyText = match[2];
                const msg = await this.incomeMessageRepo.findOne({
                    where: { messageId: msgId, email: { emailId: activeSet.email.emailId } },
                });
                if (!msg)
                    throw new Error(`Message #${msgId} not found`);
                await this.gmailService.sendReply(refreshToken, msg.gmailThreadId, msg.sender, msg.subject, replyText, senderAddress);
                await this.signalwireService.sendSms(from, `Sent to ${msg.sender}`);
            }
            else if (/^R\s+/i.test(trimmed)) {
                const replyText = trimmed.replace(/^R\s+/i, '');
                const latest = await this.incomeMessageRepo.findOne({
                    where: { email: { emailId: activeSet.email.emailId } },
                    order: { messageId: 'DESC' },
                });
                if (!latest)
                    throw new Error('No messages to reply to');
                await this.gmailService.sendReply(refreshToken, latest.gmailThreadId, latest.sender, latest.subject, replyText, senderAddress);
                await this.signalwireService.sendSms(from, `Sent to ${latest.sender}`);
            }
            else if (/^S\s+/i.test(trimmed)) {
                const rest = trimmed.replace(/^S\s+/i, '');
                const pipeParts = rest.split('|').map((p) => p.trim());
                if (pipeParts.length >= 3) {
                    const [to, subject, ...bodyParts] = pipeParts;
                    await this.gmailService.sendEmail(refreshToken, senderAddress, to, subject, bodyParts.join('|'));
                    await this.signalwireService.sendSms(from, `Sent to ${to}`);
                }
                else {
                    const spaceIdx = rest.indexOf(' ');
                    if (spaceIdx === -1)
                        throw new Error('Missing message body. Use: S email@x.com message');
                    const to = rest.slice(0, spaceIdx);
                    const msgBody = rest.slice(spaceIdx + 1);
                    await this.gmailService.sendEmail(refreshToken, senderAddress, to, 'Message from SMS', msgBody);
                    await this.signalwireService.sendSms(from, `Sent to ${to}`);
                }
            }
            else if (/^HELP$/i.test(trimmed)) {
                await this.signalwireService.sendSms(from, 'Email SMS Commands:\nR <msg> - reply to your latest email\nR <#1234> <msg> - reply to email #1234\nS <email> <msg> - send new email\nS <email>|<subject>|<msg> - send with custom subject\n(The #number at end of each notification is the email ID)');
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
        try {
            const refreshToken = this.emailsService.decrypt(set.email.refreshToken);
            await this.gmailService.unwatchGmail(refreshToken);
        }
        catch (err) {
            this.logger.error(`Failed to unwatch Gmail for set ${set.setId}: ${err}`);
        }
        const warning = event.type === 'invoice.payment_failed'
            ? 'Payment failed — SMS email forwarding paused. Update your payment method to resume.'
            : 'Your subscription was cancelled — SMS email forwarding has been stopped.';
        await this.signalwireService.sendSms(set.phone.phone, warning);
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
    formatSender(raw) {
        const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
        if (match) {
            const name = match[1].trim();
            const email = match[2].trim();
            return name ? `${name} ${email}` : email;
        }
        return raw.trim();
    }
    summaryBudget(sender, subject, attachmentCount, toEmail) {
        const cleanSubject = subject.replace(/^(re:\s*)*/i, '').replace(/<[^>]+>/g, '').trim();
        const senderLen = Math.min(this.formatSender(sender).length, 40);
        const subjectLen = Math.min(cleanSubject.length, 35);
        const emailLen = Math.min(toEmail.length, 30);
        return Math.max(10, 160 - 22 - emailLen - senderLen - subjectLen - 15);
    }
    buildSms(sender, subject, summary, attachmentCount, messageId, toEmail) {
        const idStr = String(messageId).padStart(4, '0');
        const footer = attachmentCount > 0 ? `📎+${attachmentCount}  |  #${idStr}` : `#${idStr}`;
        const s = this.formatSender(sender).slice(0, 40);
        const cleanSubject = subject.replace(/^(re:\s*)*/i, '').replace(/<[^>]+>/g, '').trim();
        const sub = cleanSubject.slice(0, 35);
        const to = toEmail.slice(0, 30);
        return `To: ${to}\nFrom: ${s}\nSubj: ${sub}\n\n${summary}\n\n${footer}`.slice(0, 160);
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
    __metadata("design:paramtypes", [typeorm_2.Repository,
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