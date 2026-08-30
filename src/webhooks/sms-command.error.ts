/**
 * A problem with what the user *typed* in an inbound SMS command — safe to
 * quote back to them over SMS, because every message on this class is authored
 * to be read by a stranger.
 *
 * Deliberately NOT `@nestjs/common`'s `BadRequestException`: that is thrown
 * throughout the internal services (EmailsService, SetsService, BillingService,
 * GmailService), so an `instanceof BadRequestException` check in the inbound
 * catch-all would start texting internal error text to an untrusted sender —
 * exactly the information-disclosure oracle that catch-all exists to prevent.
 */
export class SmsCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsCommandError';
  }
}
