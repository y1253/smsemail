import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Always send one — some clients never render HTML. */
  text: string;
}

/**
 * Transactional email over the support Gmail mailbox, via an app password.
 *
 * Same shape as SignalwireService: if the credentials are absent the transport
 * stays null and the constructor still succeeds, so a dev machine without mail
 * secrets boots normally and only fails when something actually tries to send.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transport: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const user =
      this.config.get<string>('SUPPORT_EMAIL') || 'support@emailontext.com';
    // Gmail app passwords are issued with spaces for readability; the SMTP
    // login rejects them, so strip whitespace rather than making the operator
    // remember to.
    const pass = (this.config.get<string>('APP_PASSWORD') || '').replace(
      /\s+/g,
      '',
    );

    this.from = `EmailOnText <${user}>`;

    if (pass) {
      this.transport = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    } else {
      this.transport = null;
      this.logger.warn(
        'APP_PASSWORD is not set — outbound email is disabled. See server/.env.example.',
      );
    }
  }

  async sendMail({ to, subject, html, text }: MailOptions): Promise<void> {
    if (!this.transport) {
      throw new Error(
        'Email is not configured. Set SUPPORT_EMAIL and APP_PASSWORD in .env',
      );
    }

    await this.transport.sendMail({ from: this.from, to, subject, html, text });
  }
}
