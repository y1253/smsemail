import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import { convert } from 'html-to-text';
import { stripQuotedText } from '../common/quoted-text.util';

@Injectable()
export class GmailService {
  constructor(private readonly config: ConfigService) {}

  // googleapis bundles its own google-auth-library — cast as any to avoid the
  // duplicate-declaration conflict between the two copies.
  private getAuthClient(refreshToken: string): any {
    const client = new google.auth.OAuth2(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
      this.config.get<string>('GOOGLE_CLIENT_SECRET'),
    );
    client.setCredentials({ refresh_token: refreshToken });
    return client;
  }

  async watchGmail(refreshToken: string): Promise<{ historyId: string; expiry: Date }> {
    const auth = this.getAuthClient(refreshToken);
    const gmail = google.gmail({ version: 'v1', auth });
    const topic = this.config.get<string>('GOOGLE_PUBSUB_TOPIC');

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

  async unwatchGmail(refreshToken: string): Promise<void> {
    const auth = this.getAuthClient(refreshToken);
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.stop({ userId: 'me' });
  }

  // Revoke the OAuth grant with Google so the app no longer appears under the
  // user's third-party access. Call this AFTER unwatchGmail — once revoked, the
  // token is dead.
  async revokeAccess(refreshToken: string): Promise<void> {
    const auth = this.getAuthClient(refreshToken);
    // Revoke the refresh token directly. revokeCredentials() only revokes an
    // access token (which we never set here), so it always throws "No access
    // token to revoke." Google's revoke endpoint accepts a refresh token, and
    // revoking it drops the entire grant for this Google-account + client pair.
    await auth.revokeToken(refreshToken);
  }

  async getNewMessages(
    refreshToken: string,
    startHistoryId: string,
  ): Promise<gmail_v1.Schema$Message[]> {
    const auth = this.getAuthClient(refreshToken);
    const gmail = google.gmail({ version: 'v1', auth });

    // Keyed by message id, not an array: Gmail may repeat the same message
    // across several history records (and across pages), and every repeat here
    // would become another text message for the same mail.
    const messages = new Map<string, gmail_v1.Schema$Message>();
    let pageToken: string | undefined;

    do {
      const res = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
        pageToken,
      });

      for (const record of res.data.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          if (added.message?.id && !messages.has(added.message.id)) {
            messages.set(added.message.id, added.message);
          }
        }
      }
      // Without following nextPageToken, a burst of mail silently loses
      // everything past the first page.
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return [...messages.values()];
  }

  async fetchMessage(
    refreshToken: string,
    messageId: string,
  ): Promise<{
    gmailMessageId: string;
    gmailThreadId: string;
    rfcMessageId: string;
    references: string;
    sender: string;
    subject: string;
    body: string;
    attachmentCount: number;
    labels: string[];
  }> {
    const auth = this.getAuthClient(refreshToken);
    const gmail = google.gmail({ version: 'v1', auth });

    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = msg.data.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

    const sender = getHeader('From');
    const subject = getHeader('Subject');
    const labels = msg.data.labelIds ?? [];
    const attachmentCount = (msg.data.payload?.parts ?? []).filter(
      (p) => p.filename && p.filename.length > 0,
    ).length;

    const body = stripQuotedText(this.extractBody(msg.data.payload));

    return {
      gmailMessageId: msg.data.id!,
      gmailThreadId: msg.data.threadId!,
      // Threading headers — needed so a reply lands in the same conversation
      // in the *recipient's* mail client. Already in payload.headers, so this
      // costs no extra api call.
      rfcMessageId: getHeader('Message-ID'),
      references: getHeader('References'),
      sender,
      subject,
      body,
      attachmentCount,
      labels,
    };
  }

  async sendReply(
    refreshToken: string,
    threadId: string,
    to: string,
    subject: string,
    body: string,
    from: string,
    inReplyTo?: string | null,
    references?: string | null,
  ): Promise<void> {
    const auth = this.getAuthClient(refreshToken);
    const gmail = google.gmail({ version: 'v1', auth });

    const replySubject = !subject || /^re:/i.test(subject) ? subject : `Re: ${subject}`;
    const raw = this.buildRaw(from, to, replySubject, body, { inReplyTo, references });

    // threadId threads the copy in our own mailbox; In-Reply-To/References
    // (set in buildRaw) are what thread it for everyone else.
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId },
    });
  }

  async sendEmail(
    refreshToken: string,
    from: string,
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const auth = this.getAuthClient(refreshToken);
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = this.buildRaw(from, to, subject, body);

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    const plainData = this.findPartData(payload, 'text/plain');
    if (plainData) {
      return Buffer.from(plainData, 'base64').toString('utf-8');
    }

    const htmlData = this.findPartData(payload, 'text/html');
    if (htmlData) {
      const rawHtml = Buffer.from(htmlData, 'base64').toString('utf-8');
      return convert(rawHtml, {
        wordwrap: false,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' },
          // Drop the quoted thread structurally, before it ever becomes text.
          // A bare <blockquote> is deliberately left alone: its default
          // formatter emits "> " prefixes, which stripQuotedText handles, and
          // skipping it would eat real content in non-reply mail.
          { selector: 'blockquote.gmail_quote', format: 'skip' },
          { selector: 'div.gmail_quote', format: 'skip' },
          { selector: 'div.gmail_quote_container', format: 'skip' },
          { selector: 'blockquote[type="cite"]', format: 'skip' }, // Apple Mail
          { selector: '.moz-cite-prefix', format: 'skip' }, // Thunderbird
          { selector: '.protonmail_quote', format: 'skip' },
          { selector: '.yahoo_quoted', format: 'skip' },
          { selector: 'div[id^="divRplyFwdMsg"]', format: 'skip' }, // Outlook
          { selector: '.gmail_signature', format: 'skip' },
        ],
      });
    }

    return '';
  }

  private findPartData(
    payload: gmail_v1.Schema$MessagePart,
    mimeType: string,
  ): string | null {
    if (payload.mimeType === mimeType && payload.body?.data) {
      return payload.body.data;
    }
    for (const part of payload.parts ?? []) {
      const found = this.findPartData(part, mimeType);
      if (found) return found;
    }
    return null;
  }

  // The parent's References chain plus the parent itself. Guard against a
  // duplicate: some clients already list their own Message-ID in References.
  private buildReferences(chain: string | null | undefined, inReplyTo: string): string {
    const ids = (chain ?? '').split(/\s+/).filter(Boolean);
    if (ids[ids.length - 1] !== inReplyTo) ids.push(inReplyTo);
    return ids.join(' ');
  }

  // Strip CR/LF so a crafted To/Subject can't inject extra MIME headers
  // (e.g. "Bcc: mass@list") — CRLF / email-header injection (CWE-93).
  private sanitizeHeader(value: string): string {
    return value.replace(/[\r\n]+/g, ' ').trim();
  }

  private buildRaw(
    from: string,
    to: string,
    subject: string,
    body: string,
    opts?: { inReplyTo?: string | null; references?: string | null },
  ): string {
    const safeFrom = this.sanitizeHeader(from);
    const safeTo = this.sanitizeHeader(to);
    const safeSubject = this.sanitizeHeader(subject);

    // Reject anything that isn't a single well-formed address.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeTo)) {
      throw new BadRequestException('Invalid recipient email address');
    }

    const inReplyTo = opts?.inReplyTo?.trim();
    const lines = [
      `From: ${safeFrom}`,
      `To: ${safeTo}`,
      ...(safeSubject ? [`Subject: ${safeSubject}`] : []),
      ...(inReplyTo
        ? [
            `In-Reply-To: ${inReplyTo}`,
            `References: ${this.buildReferences(opts?.references, inReplyTo)}`,
          ]
        : []),
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ];
    return Buffer.from(lines.join('\r\n')).toString('base64url');
  }
}
