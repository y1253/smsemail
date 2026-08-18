import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, MoreThan, LessThan } from 'typeorm';
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
import { ellipsize, fitToSentence } from '../common/text.util';
import { randomMessageId } from '../common/id.util';

@Injectable()
export class WebhooksService {
  // Single-segment GSM-7 SMS character limit; every summary SMS is built to fit.
  private static readonly SMS_LIMIT = 160;
  // Message ids are random out of a ~900k space, so the table has to stay
  // bounded or allocation starts colliding. Anything past this window is
  // pruned nightly and can no longer be replied to by number.
  private static readonly MESSAGE_RETENTION_DAYS = 30;
  private readonly logger = new Logger(WebhooksService.name);
  private readonly stripe: Stripe;
  // One in-flight push per mailbox. Gmail fires several notifications for a
  // single change; run them concurrently and they all read the same stale
  // lastHistoryId, all list the same message, and all send. Chaining them means
  // the second one starts from a pointer the first already advanced.
  private readonly pushChains = new Map<string, Promise<void>>();

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

    const previous = this.pushChains.get(emailAddress) ?? Promise.resolve();
    // .catch on the tail so one failed push doesn't poison the chain, and the
    // map entry is dropped once this is the last link (otherwise it grows one
    // entry per mailbox forever).
    const current = previous
      .catch(() => undefined)
      .then(() => this.processGmailPush(emailAddress, String(newHistoryId)));
    this.pushChains.set(emailAddress, current);
    void current.catch(() => undefined).then(() => {
      if (this.pushChains.get(emailAddress) === current) this.pushChains.delete(emailAddress);
    });
    return current;
  }

  private async processGmailPush(emailAddress: string, newHistoryId: string): Promise<void> {
    const email = await this.emailRepo.findOne({
      where: { email: emailAddress, deletedAt: IsNull() },
    });
    if (!email?.lastHistoryId || !email.refreshToken) return;

    const refreshToken = this.emailsService.decrypt(email.refreshToken);
    const rawMessages = await this.gmailService.getNewMessages(refreshToken, email.lastHistoryId);

    const activeSets = await this.setRepo.find({
      where: { email: { emailId: email.emailId }, deletedAt: IsNull() },
      relations: ['phone', 'allowedSenders'],
    });

    // Even with nobody to notify the pointer has to move on, or every later
    // push re-lists this same window and keeps re-processing it.
    if (activeSets.length) {
      for (const raw of rawMessages) {
        if (!raw.id) continue;
        try {
          // Cheap replay check: on a redelivered notification every message
          // here is already stored, so this skips the Gmail fetch entirely.
          // The unique index below is the race-proof authority — this is only
          // an optimization.
          const alreadySent = await this.incomeMessageRepo.findOne({
            where: { email: { emailId: email.emailId }, gmailMessageId: raw.id },
            select: { messageId: true },
          });
          if (alreadySent) {
            this.logger.debug(`Skipping already-delivered message ${raw.id}`);
            continue;
          }

          const msg = await this.gmailService.fetchMessage(refreshToken, raw.id);
          const isJunk = msg.labels.some((l) =>
            ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'SENT', 'DRAFT'].includes(l),
          );
          if (isJunk) {
            this.logger.debug(`Skipping message ${raw.id} (labels: ${msg.labels.join(', ')})`);
            continue;
          }

          // Insert first: the row must exist before the SMS goes out so the
          // "R <id>" reply can find it, and the footer (and thus the exact body
          // budget) depends on the id. It also claims the message — a null
          // return means another delivery of this same mail already claimed it.
          const saved = await this.createIncomeMessage({
            email,
            createdAt: new Date(),
            gmailMessageId: msg.gmailMessageId,
            gmailThreadId: msg.gmailThreadId,
            rfcMessageId: msg.rfcMessageId.slice(0, 255) || null,
            referencesHeader: msg.references || null,
            sender: msg.sender.slice(0, 145),
            subject: msg.subject.slice(0, 255),
          });
          if (!saved) {
            this.logger.debug(`Skipping already-delivered message ${raw.id}`);
            continue;
          }

          const { bodyBudget } = this.smsScaffold(
            msg.sender,
            email.email,
            msg.attachmentCount,
            saved.messageId,
          );
          const summary = await this.openAiService.summarize(msg.subject, msg.body, bodyBudget);

          const sms = this.buildSms(msg.sender, summary, msg.attachmentCount, saved.messageId, email.email);
          // Lowercased here, not in the helper: set_allowed_sender.email is
          // stored lowercased (SetsService), so the comparison needs it — but
          // replies must keep the sender's original case.
          const senderAddr = this.extractEmailAddress(msg.sender).toLowerCase();
          // Nothing in the DB stops two active sets from carrying the same
          // number (uniqueness is only enforced in app code), and that would be
          // two identical texts with the same "R <id>".
          const sentTo = new Set<string>();
          for (const set of activeSets) {
            if (set.phone.optedOutAt) continue; // number replied STOP — honor opt-out
            if (sentTo.has(set.phone.phone)) continue;
            const filter = set.allowedSenders ?? [];
            if (filter.length > 0 && !filter.some((s) => s.email === senderAddr)) continue;
            await this.signalwireService.sendSms(set.phone.phone, sms);
            sentTo.add(set.phone.phone);
          }
        } catch (err) {
          this.logger.error(`Failed to process Gmail message ${raw.id}: ${err}`);
        }
      }
    }

    await this.advanceHistoryId(email.emailId, newHistoryId);
  }

  // Forward-only. Notifications can finish out of order, and writing this
  // push's id unconditionally would rewind the pointer behind a push that
  // already completed — making the next notification re-list, and re-send,
  // mail that was already delivered. Re-read rather than reusing the entity
  // loaded at the top, which by now may be stale. Compared as BigInt because
  // last_history_id is a varchar and "10" < "9" as a string.
  private async advanceHistoryId(emailId: number, newHistoryId: string): Promise<void> {
    const current = await this.emailRepo.findOne({ where: { emailId } });
    if (!current) return;
    if (current.lastHistoryId && BigInt(current.lastHistoryId) >= BigInt(newHistoryId)) return;
    current.lastHistoryId = newHistoryId;
    await this.emailRepo.save(current);
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
        "EmailOnText: You're unsubscribed and will get no more messages. Reply START to resubscribe.",
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
        "EmailOnText: You're resubscribed to EmailOnText alerts. Reply HELP for help, STOP to unsubscribe.",
      );
      return;
    }
    if (keyword === 'HELP') {
      await this.signalwireService.sendSms(
        from,
        `EmailOnText email-to-SMS

Reply to last email:
R your message here

Reply to email 481920:
R 481920 your message here

Send new email:
S someone@example.com your message

Send with a subject:
S someone@example.com | Subject | your message

Help: yechiel1253@gmail.com
Reply STOP to unsubscribe`,
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
          // By time, not by id — ids are random, so they say nothing about age.
          order: { createdAt: 'DESC', messageId: 'DESC' },
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
      // Log details server-side, but never return raw internal error text to the
      // (untrusted) SMS sender — it was an information-disclosure oracle.
      this.logger.error(`Inbound SMS error from ${from}: ${err}`);
      await this.signalwireService.sendSms(
        from,
        'Sorry, something went wrong processing your message. Please try again.',
      );
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
    return { to: rest.slice(0, spaceIdx), subject: '', body: rest.slice(spaceIdx + 1) };
  }

  /** Reply to a stored incoming message using the email account that received it. */
  private async replyToMessage(
    from: string,
    email: Email,
    msg: IncomeMessage,
    replyText: string,
  ): Promise<void> {
    if (!email.refreshToken) {
      await this.signalwireService.sendSms(
        from,
        `Gmail connection for ${email.email} needs reconnecting on the dashboard.`,
      );
      return;
    }
    const refreshToken = this.emailsService.decrypt(email.refreshToken);
    const { rfcMessageId, referencesHeader } = await this.resolveThreadingHeaders(refreshToken, msg);
    // msg.sender is the raw From header ("Bob Smith <bob@work.com>"); Gmail's
    // recipient validation only accepts a bare address, so send the address.
    const to = this.extractEmailAddress(msg.sender);
    try {
      await this.gmailService.sendReply(
        refreshToken,
        msg.gmailThreadId,
        to,
        msg.subject,
        replyText,
        email.email,
        rfcMessageId,
        referencesHeader,
      );
    } catch (err) {
      await this.handleSendError(from, email, err);
      return;
    }
    await this.signalwireService.sendSms(from, `Sent to ${to}`);
  }

  /**
   * Message-ID/References for a reply. Rows stored before those columns existed
   * have neither, so re-fetch them from Gmail once and backfill. If the fetch
   * fails (message deleted, token trouble) we still send — worst case the reply
   * threads only on our side, which is the old behaviour.
   */
  private async resolveThreadingHeaders(
    refreshToken: string,
    msg: IncomeMessage,
  ): Promise<{ rfcMessageId: string | null; referencesHeader: string | null }> {
    if (msg.rfcMessageId) {
      return { rfcMessageId: msg.rfcMessageId, referencesHeader: msg.referencesHeader };
    }
    try {
      const fetched = await this.gmailService.fetchMessage(refreshToken, msg.gmailMessageId);
      if (!fetched.rfcMessageId) return { rfcMessageId: null, referencesHeader: null };
      const rfcMessageId = fetched.rfcMessageId.slice(0, 255);
      const referencesHeader = fetched.references || null;
      await this.incomeMessageRepo.update(msg.messageId, { rfcMessageId, referencesHeader });
      return { rfcMessageId, referencesHeader };
    } catch (err) {
      this.logger.warn(`Could not fetch threading headers for message ${msg.messageId}: ${err}`);
      return { rfcMessageId: null, referencesHeader: null };
    }
  }

  /** Send a new email from a specific account. */
  private async sendNewEmail(
    from: string,
    email: Email,
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    if (!email.refreshToken) {
      await this.signalwireService.sendSms(
        from,
        `Gmail connection for ${email.email} needs reconnecting on the dashboard.`,
      );
      return;
    }
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

    if (set.email.refreshToken) {
      try {
        const refreshToken = this.emailsService.decrypt(set.email.refreshToken);
        await this.gmailService.unwatchGmail(refreshToken);
      } catch (err) {
        this.logger.error(`Failed to unwatch Gmail for set ${set.setId}: ${err}`);
      }
    }

    const warning =
      event.type === 'invoice.payment_failed'
        ? 'Payment failed — SMS email forwarding paused. Update your payment method to resume.'
        : 'Your subscription was cancelled — SMS email forwarding has been stopped.';

    if (!set.phone.optedOutAt) {
      await this.signalwireService.sendSms(set.phone.phone, warning);
    }
    set.deletedAt = new Date();
    set.pendingCancelAt = null;
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
      if (!email.refreshToken) continue;
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

  @Cron('0 3 * * *')
  async pruneOldMessages(): Promise<void> {
    const cutoff = new Date(
      Date.now() - WebhooksService.MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    // Safe to hard-delete: nothing has a foreign key onto income_message.
    const { affected } = await this.incomeMessageRepo.delete({ createdAt: LessThan(cutoff) });
    if (affected) {
      this.logger.log(
        `Pruned ${affected} income_message rows older than ${WebhooksService.MESSAGE_RETENTION_DAYS} days`,
      );
    }
  }

  // Assigns a random id rather than letting MySQL auto-increment, so the
  // number a user sees in their SMS doesn't reveal the message count. The id
  // space is finite, so retry on the (rare) primary-key collision.
  //
  // Doubles as the delivery lock: returns null when uq_income_message_gmail
  // rejects the row, meaning this Gmail message was already stored (and texted)
  // by another delivery of the same notification. The caller must then skip.
  private async createIncomeMessage(data: Partial<IncomeMessage>): Promise<IncomeMessage | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const record = this.incomeMessageRepo.create({ ...data, messageId: randomMessageId() });
      try {
        // insert(), NOT save(): save() with a pre-set primary key does a SELECT
        // first and would UPDATE a colliding row instead of failing, silently
        // clobbering someone else's message.
        await this.incomeMessageRepo.insert(record);
        return record;
      } catch (err: any) {
        if (err?.code !== 'ER_DUP_ENTRY') throw err;
        // Duplicate mail, not a duplicate id — a fresh random id won't help.
        const detail = String(err?.sqlMessage ?? err?.message ?? '');
        if (detail.includes('uq_income_message_gmail')) return null;
      }
    }
    // Means the table has outgrown the id space — shorten MESSAGE_RETENTION_DAYS.
    throw new Error('Could not allocate a unique message id after 5 attempts');
  }

  // "Bob Smith <bob@work.com>" -> "bob@work.com". Case is preserved: the local
  // part of an address is case-sensitive, so a reply has to go out with the
  // case the sender used. Callers that compare against stored addresses
  // lowercase at the comparison instead.
  private extractEmailAddress(sender: string): string {
    const match = sender.match(/<([^>]+)>/);
    return (match ? match[1] : sender).trim();
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

  // Single source of truth for the SMS layout: the fixed header/footer and the
  // exact room left for the summary body. Used both to tell the summarizer how
  // much space it has and to assemble the final message, so the two never drift.
  private smsScaffold(
    sender: string,
    toEmail: string,
    attachmentCount: number,
    messageId: number,
  ): { to: string; s: string; footer: string; bodyBudget: number } {
    const replyHint = `Reply: R ${messageId}`;
    const footer = attachmentCount > 0 ? `📎+${attachmentCount}  |  ${replyHint}` : replyHint;
    // Ellipsized, not hard-cut: a chopped address must read as chopped.
    const s = ellipsize(this.formatSender(sender), 40);
    const to = ellipsize(toEmail, 30);
    const fixed = `To: ${to}\nFrom: ${s}\n\n\n\n${footer}`;
    return { to, s, footer, bodyBudget: Math.max(10, WebhooksService.SMS_LIMIT - fixed.length) };
  }

  private buildSms(
    sender: string,
    summary: string,
    attachmentCount: number,
    messageId: number,
    toEmail: string,
  ): string {
    const { to, s, footer, bodyBudget } = this.smsScaffold(
      sender,
      toEmail,
      attachmentCount,
      messageId,
    );
    // Fit the summary to the exact room left, preferring a complete-sentence end
    // over a mid-sentence "..." cut.
    const body = fitToSentence(summary, bodyBudget);
    return `To: ${to}\nFrom: ${s}\n\n${body}\n\n${footer}`;
  }
}
