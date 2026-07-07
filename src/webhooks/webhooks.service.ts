import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import Stripe from 'stripe';
import { Email } from '../emails/email.entity';
import { Phone } from '../phones/phone.entity';
import { EmailPhoneSet } from '../sets/email-phone-set.entity';
import { IncomeMessage } from '../messages/income-message.entity';
import { PendingSmsCommand } from './pending-sms-command.entity';
import { EmailsService } from '../emails/emails.service';
import { GmailService } from '../gmail/gmail.service';
import { OpenAiService } from '../openai/openai.service';
import { SignalwireService } from '../signalwire/signalwire.service';
import { truncateClean } from '../common/text.util';

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
    @InjectRepository(PendingSmsCommand)
    private readonly pendingRepo: Repository<PendingSmsCommand>,
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
      relations: ['phone', 'allowedSenders'],
    });
    if (!activeSets.length) return;

    for (const raw of rawMessages) {
      if (!raw.id) continue;
      try {
        const msg = await this.gmailService.fetchMessage(refreshToken, raw.id);
        const isJunk = msg.labels.some((l) =>
          ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'SENT', 'DRAFT'].includes(l),
        );
        if (isJunk) {
          this.logger.debug(`Skipping message ${raw.id} (labels: ${msg.labels.join(', ')})`);
          continue;
        }

        const budget = this.summaryBudget(msg.sender, email.email);
        const summary = await this.openAiService.summarize(msg.subject, msg.body, budget);

        const record = this.incomeMessageRepo.create({
          email,
          createdAt: new Date(),
          gmailMessageId: msg.gmailMessageId,
          gmailThreadId: msg.gmailThreadId,
          sender: msg.sender.slice(0, 145),
          subject: msg.subject.slice(0, 255),
        });
        const saved = await this.incomeMessageRepo.save(record);

        const sms = this.buildSms(msg.sender, summary, msg.attachmentCount, saved.messageId, email.email);
        const senderAddr = this.extractEmailAddress(msg.sender);
        for (const set of activeSets) {
          if (set.phone.optedOutAt) continue; // number replied STOP — honor opt-out
          const filter = set.allowedSenders ?? [];
          if (filter.length > 0 && !filter.some((s) => s.email === senderAddr)) continue;
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

    // Carrier-required keywords (STOP/START/HELP) are handled first and always
    // respond, independent of whether the number currently has an active set.
    const keyword = body.trim().toUpperCase();
    if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|QUIT|END)$/.test(keyword)) {
      if (!phone.optedOutAt) {
        phone.optedOutAt = new Date();
        await this.phoneRepo.save(phone);
      }
      await this.signalwireService.sendSms(
        from,
        "SMSMail: You're unsubscribed and will get no more messages. Reply START to resubscribe.",
      );
      return;
    }
    if (/^(START|UNSTOP)$/.test(keyword)) {
      if (phone.optedOutAt) {
        phone.optedOutAt = null;
        await this.phoneRepo.save(phone);
      }
      await this.signalwireService.sendSms(
        from,
        "SMSMail: You're resubscribed to SMSMail alerts. Reply HELP for help, STOP to unsubscribe.",
      );
      return;
    }
    if (keyword === 'HELP') {
      await this.signalwireService.sendSms(
        from,
        'SMSMail email-to-SMS. Help: yechiel1253@gmail.com. Reply STOP to unsubscribe.\nCommands: R <msg> reply, R <#1234> <msg> reply to #1234, S <email> <msg> send.',
      );
      return;
    }

    // All active emails linked to this phone (a phone can be in several sets).
    const activeSets = await this.setRepo.find({
      where: { phone: { phoneId: phone.phoneId }, deletedAt: IsNull() },
      relations: ['email'],
    });
    const emails: Email[] = [];
    const seen = new Set<number>();
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
      // Resolve a pending "which email to send from?" selection, if any.
      const pending = await this.pendingRepo.findOne({
        where: { phone: normalizedFrom, expiresAt: MoreThan(new Date()) },
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
        // A non-numeric reply abandons the pending selection; process as fresh.
        await this.pendingRepo.delete({ id: pending.id });
      }

      if (/^R\s+\d+\s+/i.test(trimmed)) {
        const match = trimmed.match(/^R\s+(\d+)\s+([\s\S]+)$/i)!;
        const msgId = parseInt(match[1], 10);
        const replyText = match[2];
        const msg = await this.incomeMessageRepo.findOne({
          where: { messageId: msgId, email: { emailId: In(emailIds) } },
          relations: ['email'],
        });
        if (!msg) throw new Error(`Message #${msgId} not found`);
        await this.replyToMessage(from, msg.email, msg, replyText);
      } else if (/^R\s+/i.test(trimmed)) {
        const replyText = trimmed.replace(/^R\s+/i, '');
        const latest = await this.incomeMessageRepo.findOne({
          where: { email: { emailId: In(emailIds) } },
          order: { messageId: 'DESC' },
          relations: ['email'],
        });
        if (!latest) throw new Error('No messages to reply to');
        await this.replyToMessage(from, latest.email, latest, replyText);
      } else if (/^S\s+/i.test(trimmed)) {
        const { to, subject, body: msgBody } = this.parseSendCommand(trimmed);
        if (emails.length === 1) {
          await this.sendNewEmail(from, emails[0], to, subject, msgBody);
        } else {
          await this.pendingRepo.delete({ phone: normalizedFrom });
          await this.pendingRepo.save(
            this.pendingRepo.create({
              phone: normalizedFrom,
              body: trimmed,
              emailIds: emailIds.join(','),
              expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            }),
          );
          await this.signalwireService.sendSms(from, this.buildSelectPrompt(emails));
        }
      } else {
        await this.signalwireService.sendSms(from, 'Unknown command. Use R to reply, S to send, or HELP for instructions.');
      }
    } catch (err) {
      this.logger.error(`Inbound SMS error from ${from}: ${err}`);
      await this.signalwireService.sendSms(from, `Error: ${(err as Error).message}`);
    }
  }

  /** Parse an "S ..." command into recipient / subject / body. */
  private parseSendCommand(trimmed: string): { to: string; subject: string; body: string } {
    const rest = trimmed.replace(/^S\s+/i, '');
    const pipeParts = rest.split('|').map((p) => p.trim());
    if (pipeParts.length >= 3) {
      const [to, subject, ...bodyParts] = pipeParts;
      return { to, subject, body: bodyParts.join('|') };
    }
    const spaceIdx = rest.indexOf(' ');
    if (spaceIdx === -1) throw new Error('Missing message body. Use: S email@x.com message');
    return { to: rest.slice(0, spaceIdx), subject: 'Message from SMS', body: rest.slice(spaceIdx + 1) };
  }

  /** Reply to a stored incoming message using the email account that received it. */
  private async replyToMessage(
    from: string,
    email: Email,
    msg: IncomeMessage,
    replyText: string,
  ): Promise<void> {
    const refreshToken = this.emailsService.decrypt(email.refreshToken);
    try {
      await this.gmailService.sendReply(refreshToken, msg.gmailThreadId, msg.sender, msg.subject, replyText, email.email);
    } catch (err) {
      await this.handleSendError(from, email, err);
      return;
    }
    await this.signalwireService.sendSms(from, `Sent to ${msg.sender}`);
  }

  /** Send a new email from a specific account. */
  private async sendNewEmail(
    from: string,
    email: Email,
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const refreshToken = this.emailsService.decrypt(email.refreshToken);
    try {
      await this.gmailService.sendEmail(refreshToken, email.email, to, subject, body);
    } catch (err) {
      await this.handleSendError(from, email, err);
      return;
    }
    await this.signalwireService.sendSms(from, `Sent to ${to}`);
  }

  /** Turn an expired/revoked-token failure into a clear "reconnect" SMS. */
  private async handleSendError(from: string, email: Email, err: unknown): Promise<void> {
    const message = (err as Error)?.message ?? String(err);
    if (/invalid_grant/i.test(message)) {
      this.logger.error(`invalid_grant sending from email ${email.emailId} (${email.email})`);
      await this.signalwireService.sendSms(
        from,
        `Gmail connection for ${email.email} needs reauthorizing — reconnect it on the dashboard.`,
      );
      return;
    }
    throw err instanceof Error ? err : new Error(message);
  }

  /** "Send from which email? Reply with the number:\n1 a@x.com\n2 b@x.com" */
  private buildSelectPrompt(emails: Email[]): string {
    const lines = emails.map((e, i) => `${i + 1} ${e.email}`);
    return `Send from which email? Reply with the number:\n${lines.join('\n')}`;
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

    if (!set.phone.optedOutAt) {
      await this.signalwireService.sendSms(set.phone.phone, warning);
    }
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

  private extractEmailAddress(sender: string): string {
    const match = sender.match(/<([^>]+)>/);
    return (match ? match[1] : sender).trim().toLowerCase();
  }

  private formatSender(raw: string): string {
    const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
      const name = match[1].trim();
      const email = match[2].trim();
      return name ? `${name} ${email}` : email;
    }
    return raw.trim();
  }

  private summaryBudget(sender: string, toEmail: string): number {
    const senderLen = Math.min(this.formatSender(sender).length, 40);
    const emailLen = Math.min(toEmail.length, 30);
    // Structure: "To: \nFrom: \n\n\n\n" = 15 chars; footer reserve = 20
    return Math.max(10, 160 - 15 - emailLen - senderLen - 20);
  }

  private buildSms(
    sender: string,
    summary: string,
    attachmentCount: number,
    messageId: number,
    toEmail: string,
  ): string {
    const replyHint = `Reply: R ${messageId}`;
    const footer = attachmentCount > 0 ? `📎+${attachmentCount}  |  ${replyHint}` : replyHint;
    const s = this.formatSender(sender).slice(0, 40);
    const to = toEmail.slice(0, 30);
    // Fit the summary to the exact room left after the real header + footer, so
    // any truncation lands on a word boundary (...) instead of mid-word.
    const headerFooter = `To: ${to}\nFrom: ${s}\n\n\n\n${footer}`;
    const body = truncateClean(summary, Math.max(0, 160 - headerFooter.length));
    return `To: ${to}\nFrom: ${s}\n\n${body}\n\n${footer}`;
  }
}
