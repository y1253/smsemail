import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';

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

  async getNewMessages(
    refreshToken: string,
    startHistoryId: string,
  ): Promise<gmail_v1.Schema$Message[]> {
    const auth = this.getAuthClient(refreshToken);
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    });

    const messages: gmail_v1.Schema$Message[] = [];
    for (const record of res.data.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        if (added.message?.id) {
          messages.push(added.message);
        }
      }
    }
    return messages;
  }

  async fetchMessage(
    refreshToken: string,
    messageId: string,
  ): Promise<{
    gmailMessageId: string;
    gmailThreadId: string;
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

    const body = this.stripQuotedText(this.extractBody(msg.data.payload));

    return {
      gmailMessageId: msg.data.id!,
      gmailThreadId: msg.data.threadId!,
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
  ): Promise<void> {
    const auth = this.getAuthClient(refreshToken);
    const gmail = google.gmail({ version: 'v1', auth });

    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    const raw = this.buildRaw(from, to, replySubject, body);

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

    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    for (const part of payload.parts ?? []) {
      const text = this.extractBody(part);
      if (text) return text;
    }

    return '';
  }

  private stripQuotedText(body: string): string {
    const lines = body.split('\n');
    const result: string[] = [];
    let prevStartedWithOn = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[-_]{4,}/.test(trimmed)) break;
      if (line.trimStart().startsWith('>')) { prevStartedWithOn = false; continue; }
      // Multi-line "On ... wrote:" — previous line started with "On" and this ends with "wrote:"
      if (prevStartedWithOn && /wrote:\s*$/.test(trimmed)) { result.pop(); break; }
      // Single-line "On ... wrote:"
      if (/^On .+wrote:\s*$/.test(trimmed)) break;
      prevStartedWithOn = /^On /.test(trimmed);
      result.push(line);
    }
    return result.join('\n').trim();
  }

  private buildRaw(from: string, to: string, subject: string, body: string): string {
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
}
