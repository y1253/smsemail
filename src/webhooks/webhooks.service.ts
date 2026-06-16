import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import Stripe from 'stripe';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { IncomeMessage } from '../messages/income-message.entity';
import { EmailsService } from '../emails/emails.service';
import { GmailService } from '../gmail/gmail.service';
import { OpenAiService } from '../openai/openai.service';
import { SignalwireService } from '../signalwire/signalwire.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly stripe: Stripe;

  constructor(
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(Phone)
    private readonly phoneRepo: Repository<Phone>,
    @InjectRepository(EmailPhoneSet)
    private readonly setRepo: Repository<EmailPhoneSet>,
    @InjectRepository(IncomeMessage)
    private readonly incomeMessageRepo: Repository<IncomeMessage>,
    private readonly config: ConfigService,
    private readonly emailsService: EmailsService,
    private readonly gmailService: GmailService,
    private readonly openAiService: OpenAiService,
    private readonly signalwireService: SignalwireService,
  ) {
    const key = this.config.get<string>('STRIPE_TEST_KEY');
    if (!key) throw new Error('STRIPE_TEST_KEY is not set');
    this.stripe = new Stripe(key);
  }

  async handleGmailPush(payload: Record<string, any>): Promise<void> {
    const encoded = payload?.message?.data as string | undefined;
    if (!encoded) return;

    const { emailAddress, historyId: newHistoryId } = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf-8'),
    ) as { emailAddress: string; historyId: number | string };

    const email = await this.emailRepo.findOne({
      where: { email: emailAddress, deletedAt: IsNull() },
    });
    if (!email?.lastHistoryId) return;

    const refreshToken = this.emailsService.decrypt(email.refreshToken);
    const rawMessages = await this.gmailService.getNewMessages(refreshToken, email.lastHistoryId);

    const activeSets = await this.setRepo.find({
      where: { email: { emailId: email.emailId }, deletedAt: IsNull() },
      relations: ['phone'],
    });
    if (!activeSets.length) return;

    for (const raw of rawMessages) {
      if (!raw.id) continue;
      try {
        const msg = await this.gmailService.fetchMessage(refreshToken, raw.id);
        const isJunk = msg.labels.some((l) =>
          ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'SENT'].includes(l),
        );
        if (isJunk) {
          this.logger.debug(`Skipping message ${raw.id} (labels: ${msg.labels.join(', ')})`);
          continue;
        }

        const budget = this.summaryBudget(msg.sender, msg.subject, msg.attachmentCount);
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

        const sms = this.buildSms(msg.sender, msg.subject, summary, msg.attachmentCount, saved.messageId);
        for (const set of activeSets) {
          await this.signalwireService.sendSms(set.phone.phone, sms);
        }
      } catch (err) {
        this.logger.error(`Failed to process Gmail message ${raw.id}: ${err}`);
      }
    }

    email.lastHistoryId = String(newHistoryId);
    await this.emailRepo.save(email);
  }

  async handleInboundSms(from: string, body: string): Promise<void> {
    const normalizedFrom = from.startsWith('+') ? from.slice(1) : from;
    const phone = await this.phoneRepo.findOne({
      where: { phone: normalizedFrom, deletedAt: IsNull() },
    });
    if (!phone) {
      await this.signalwireService.sendSms(from, 'No active account found for this number.');
      return;
    }

    const activeSet = await this.setRepo.findOne({
      where: { phone: { phoneId: phone.phoneId }, deletedAt: IsNull() },
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
        const match = trimmed.match(/^R\s+(\d+)\s+([\s\S]+)$/i)!;
        const msgId = parseInt(match[1], 10);
        const replyText = match[2];
        const msg = await this.incomeMessageRepo.findOne({
          where: { messageId: msgId, email: { emailId: activeSet.email.emailId } },
        });
        if (!msg) throw new Error(`Message #${msgId} not found`);
        await this.gmailService.sendReply(refreshToken, msg.gmailThreadId, msg.sender, msg.subject, replyText, senderAddress);
        await this.signalwireService.sendSms(from, `Sent to ${msg.sender}`);
      } else if (/^R\s+/i.test(trimmed)) {
        const replyText = trimmed.replace(/^R\s+/i, '');
        const latest = await this.incomeMessageRepo.findOne({
          where: { email: { emailId: activeSet.email.emailId } },
          order: { messageId: 'DESC' },
        });
        if (!latest) throw new Error('No messages to reply to');
        await this.gmailService.sendReply(refreshToken, latest.gmailThreadId, latest.sender, latest.subject, replyText, senderAddress);
        await this.signalwireService.sendSms(from, `Sent to ${latest.sender}`);
      } else if (/^S\s+/i.test(trimmed)) {
        const rest = trimmed.replace(/^S\s+/i, '');
        const pipeParts = rest.split('|').map((p) => p.trim());
        if (pipeParts.length >= 3) {
          const [to, subject, ...bodyParts] = pipeParts;
          await this.gmailService.sendEmail(refreshToken, senderAddress, to, subject, bodyParts.join('|'));
          await this.signalwireService.sendSms(from, `Sent to ${to}`);
        } else {
          const spaceIdx = rest.indexOf(' ');
          if (spaceIdx === -1) throw new Error('Missing message body. Use: S email@x.com message');
          const to = rest.slice(0, spaceIdx);
          const msgBody = rest.slice(spaceIdx + 1);
          await this.gmailService.sendEmail(refreshToken, senderAddress, to, 'Message from SMS', msgBody);
          await this.signalwireService.sendSms(from, `Sent to ${to}`);
        }
      } else if (/^HELP$/i.test(trimmed)) {
        await this.signalwireService.sendSms(
          from,
          'Commands:\nR 0001 msg - reply to msg #0001\nR msg - reply to latest email\nS to@x.com msg - send email\nS to@x.com|subject|msg - with custom subject',
        );
      } else {
        await this.signalwireService.sendSms(from, 'Unknown command. Use R to reply, S to send, or HELP for instructions.');
      }
    } catch (err) {
      this.logger.error(`Inbound SMS error from ${from}: ${err}`);
      await this.signalwireService.sendSms(from, `Error: ${(err as Error).message}`);
    }
  }

  async handleStripeWebhook(rawBody: Buffer, sig: string): Promise<void> {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch {
      throw new Error('Stripe signature verification failed');
    }

    if (event.type !== 'invoice.payment_failed' && event.type !== 'customer.subscription.deleted') {
      return;
    }

    const subscriptionId =
      event.type === 'invoice.payment_failed'
        ? ((event.data.object as any).subscription as string | null)
        : (event.data.object as Stripe.Subscription).id;

    if (!subscriptionId) return;

    const set = await this.setRepo.findOne({
      where: { stripeSubscriptionId: subscriptionId, deletedAt: IsNull() },
      relations: ['email', 'phone'],
    });
    if (!set) return;

    try {
      const refreshToken = this.emailsService.decrypt(set.email.refreshToken);
      await this.gmailService.unwatchGmail(refreshToken);
    } catch (err) {
      this.logger.error(`Failed to unwatch Gmail for set ${set.setId}: ${err}`);
    }

    const warning =
      event.type === 'invoice.payment_failed'
        ? 'Payment failed — SMS email forwarding paused. Update your payment method to resume.'
        : 'Your subscription was cancelled — SMS email forwarding has been stopped.';

    await this.signalwireService.sendSms(set.phone.phone, warning);
    set.deletedAt = new Date();
    await this.setRepo.save(set);
  }

  @Cron('0 2 * * *')
  async renewExpiringWatches(): Promise<void> {
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
      } catch (err) {
        this.logger.error(`Failed to renew Gmail watch for email ${email.emailId}: ${err}`);
      }
    }
  }

  private summaryBudget(sender: string, subject: string, attachmentCount: number): number {
    const senderLen = Math.min(sender.length, 35);
    const subjectLen = Math.min(subject.length, 40);
    // Fixed structure chars: "From: \nRe: \n\n\n\n" = 15; footer reserve = 20
    return Math.max(10, 160 - 15 - senderLen - subjectLen - 20);
  }

  private buildSms(
    sender: string,
    subject: string,
    summary: string,
    attachmentCount: number,
    messageId: number,
  ): string {
    const idStr = String(messageId).padStart(4, '0');
    const footer = attachmentCount > 0 ? `📎+${attachmentCount}  |  #${idStr}` : `#${idStr}`;
    const s = sender.slice(0, 35);
    const sub = subject.slice(0, 40);
    return `From: ${s}\nRe: ${sub}\n\n${summary}\n\n${footer}`.slice(0, 160);
  }
}
