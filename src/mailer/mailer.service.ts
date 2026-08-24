import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
export class MailerService implements OnModuleInit {
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
        // Nodemailer's defaults are 2min / 30s / 10min. A stalled Gmail socket
        // would hold the HTTP request open far past nginx's proxy_read_timeout,
        // and forgot-password awaits the send by design — so bound it here or a
        // bad network turns into a request that never answers.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    } else {
      this.transport = null;
      this.logger.warn(
        'APP_PASSWORD is not set — outbound email is disabled. See server/.env.example.',
      );
    }
  }

  /**
   * Check the SMTP credentials once at boot.
   *
   * trySend() swallows send failures to keep forgot-password non-enumerating,
   * which means a wrong app password produces a cheerful "check your inbox" and
   * no mail, with nothing obvious to look at. This is where that becomes
   * visible. Deliberately fire-and-forget: a machine with bad secrets must
   * still boot, exactly as one with no secrets does.
   */
  onModuleInit(): void {
    if (!this.transport) return;

    void this.transport
      .verify()
      .then(() => this.logger.log('SMTP credentials verified'))
      .catch((err: Error) =>
        this.logger.error(
          `SMTP credentials rejected — password email will silently fail to send: ${err.message}`,
        ),
      );
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
