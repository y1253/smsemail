import { BadRequestException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
}));

/** A duplicate-key error shaped the way the mysql2 driver raises it. */
function dupEntry(key: string) {
  return Object.assign(new Error(`Duplicate entry 'x' for key '${key}'`), {
    code: 'ER_DUP_ENTRY',
    sqlMessage: `Duplicate entry 'x' for key '${key}'`,
  });
}

function gmailPushPayload(
  emailAddress = 'me@example.com',
  historyId: number | string = 200,
) {
  return {
    message: {
      data: Buffer.from(JSON.stringify({ emailAddress, historyId })).toString(
        'base64',
      ),
    },
  };
}

function fetchedMessage(id = 'gm-1') {
  return {
    gmailMessageId: id,
    gmailThreadId: 'th-1',
    rfcMessageId: '<abc@mail.gmail.com>',
    references: '',
    sender: 'Them <them@example.com>',
    subject: 'Lunch',
    body: 'are you free at one',
    attachmentCount: 0,
    labels: ['INBOX'],
  };
}

function makeHarness(opts: { phones?: string[] } = {}) {
  const emailRow: any = {
    emailId: 7,
    email: 'me@example.com',
    refreshToken: 'enc',
    lastHistoryId: '100',
    deletedAt: null,
  };

  const activeSets = (opts.phones ?? ['15550001111']).map((phone, i) => ({
    setId: i + 1,
    phone: { phoneId: i + 1, phone, optedOutAt: null },
    allowedSenders: [],
  }));

  const emailRepo = {
    findOne: jest.fn().mockResolvedValue(emailRow),
    save: jest.fn().mockResolvedValue(emailRow),
  };
  const incomeMessageRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: any) => ({ ...data })),
    insert: jest.fn().mockResolvedValue(undefined),
  };
  const setRepo = { find: jest.fn().mockResolvedValue(activeSets) };
  const gmailService = {
    getNewMessages: jest.fn().mockResolvedValue([{ id: 'gm-1' }]),
    fetchMessage: jest.fn().mockResolvedValue(fetchedMessage()),
  };
  const openAiService = {
    summarize: jest.fn().mockResolvedValue('free at one, yes'),
  };
  const signalwireService = { sendSms: jest.fn().mockResolvedValue(undefined) };
  const emailsService = { decrypt: jest.fn((t: string) => t) };

  const service = new WebhooksService(
    emailRepo as never,
    {} as never,
    setRepo as never,
    incomeMessageRepo as never,
    {} as never,
    { get: () => 'sk_test' } as never,
    emailsService as never,
    gmailService as never,
    openAiService as never,
    signalwireService as never,
    {} as never,
  );

  return {
    service,
    emailRow,
    emailRepo,
    incomeMessageRepo,
    setRepo,
    gmailService,
    openAiService,
    signalwireService,
  };
}

/**
 * Harness for the inbound-SMS path. Unlike makeHarness (which only wires the
 * Gmail-push repos) this stubs phoneRepo/pendingRepo and a stored message, so
 * an "R <id> ..." command can be driven end to end.
 */
function makeSmsHarness(opts: { sender?: string; emails?: string[] } = {}) {
  const emailRow: any = {
    emailId: 7,
    email: 'me@example.com',
    refreshToken: 'enc',
  };
  const storedMessage: any = {
    messageId: 481920,
    email: emailRow,
    gmailMessageId: 'gm-1',
    gmailThreadId: 'th-1',
    rfcMessageId: '<abc@mail.gmail.com>',
    referencesHeader: null,
    sender: opts.sender ?? 'Them <them@example.com>',
    subject: 'Lunch',
  };

  const phoneRepo = {
    findOne: jest.fn().mockResolvedValue({
      phoneId: 1,
      phone: '15550001111',
      optedOutAt: null,
    }),
    save: jest.fn(),
  };
  // One set per connected mailbox: >1 sends the "which account?" prompt first.
  const activeSets = (opts.emails ?? ['me@example.com']).map((address, i) => ({
    setId: i + 1,
    email:
      i === 0
        ? emailRow
        : { emailId: 7 + i, email: address, refreshToken: 'enc' },
  }));
  const setRepo = { find: jest.fn().mockResolvedValue(activeSets) };
  const incomeMessageRepo = {
    findOne: jest.fn().mockResolvedValue(storedMessage),
    update: jest.fn(),
  };
  const pendingRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const gmailService = {
    sendReply: jest.fn().mockResolvedValue(undefined),
    sendEmail: jest.fn().mockResolvedValue(undefined),
    fetchMessage: jest.fn(),
  };
  const signalwireService = { sendSms: jest.fn().mockResolvedValue(undefined) };
  const emailsService = { decrypt: jest.fn((t: string) => t) };

  const service = new WebhooksService(
    {} as never,
    phoneRepo as never,
    setRepo as never,
    incomeMessageRepo as never,
    pendingRepo as never,
    { get: () => 'sk_test' } as never,
    emailsService as never,
    gmailService as never,
    {} as never,
    signalwireService as never,
    {} as never,
  );

  return {
    service,
    gmailService,
    signalwireService,
    incomeMessageRepo,
    pendingRepo,
    storedMessage,
  };
}

/** Every text sent back to the user, concatenated. */
function textsSent(signalwireService: { sendSms: jest.Mock }): string {
  return signalwireService.sendSms.mock.calls.map((c) => c[1]).join('\n');
}

describe('WebhooksService.handleInboundSms — reply recipient', () => {
  // Regression: msg.sender is the raw From header. Passing it straight through
  // as the recipient made Gmail's bare-address validation reject every reply,
  // so "R <id> ..." always answered with the generic error text.
  it('replies to the bare address, not the raw From header', async () => {
    const h = makeSmsHarness({ sender: 'Them <them@example.com>' });

    await h.service.handleInboundSms('+15550001111', 'R 481920 hi there');

    expect(h.gmailService.sendReply).toHaveBeenCalledTimes(1);
    const [, threadId, to, subject, body] =
      h.gmailService.sendReply.mock.calls[0];
    expect(to).toBe('them@example.com');
    expect(threadId).toBe('th-1');
    expect(subject).toBe('Lunch');
    expect(body).toBe('hi there');
    expect(textsSent(h.signalwireService)).toBe('Sent to them@example.com');
    expect(textsSent(h.signalwireService)).not.toContain(
      'something went wrong',
    );
  });

  it('preserves the case of the address local part', async () => {
    const h = makeSmsHarness({ sender: 'Them <Them.Person@Example.com>' });

    await h.service.handleInboundSms('+15550001111', 'R 481920 hi');

    expect(h.gmailService.sendReply.mock.calls[0][2]).toBe(
      'Them.Person@Example.com',
    );
  });

  it('handles a From header that is already a bare address', async () => {
    const h = makeSmsHarness({ sender: 'them@example.com' });

    await h.service.handleInboundSms('+15550001111', 'R 481920 hi');

    expect(h.gmailService.sendReply.mock.calls[0][2]).toBe('them@example.com');
  });

  it('applies the same extraction on the bare-R (latest message) branch', async () => {
    const h = makeSmsHarness({ sender: 'Them <them@example.com>' });

    await h.service.handleInboundSms('+15550001111', 'R just the latest one');

    expect(h.gmailService.sendReply).toHaveBeenCalledTimes(1);
    expect(h.gmailService.sendReply.mock.calls[0][2]).toBe('them@example.com');
    expect(h.gmailService.sendReply.mock.calls[0][4]).toBe(
      'just the latest one',
    );
  });
});

/**
 * The S (send new email) branch.
 *
 * Regression origin: parseSendCommand split the recipient off the body with
 * `rest.indexOf(' ')`, a literal U+0020. Anything else between the address and
 * the message — a newline, a tab, an autocorrect non-breaking space — glued the
 * start of the body onto the address, and Gmail's bare-address check rejected
 * it. Production logged six of these from one number over two days, every one
 * answered with the generic "something went wrong". The R branch was immune
 * because its regexes use \s and its recipient comes from a stored header.
 */
describe('WebhooksService.handleInboundSms — S (send new email)', () => {
  /** The [from, to, subject, body] of the single sendEmail call. */
  function sentEmail(gmailService: { sendEmail: jest.Mock }) {
    const [, from, to, subject, body] = gmailService.sendEmail.mock.calls[0];
    return { from, to, subject, body };
  }

  it.each([
    ['a plain space', 'S someone@example.com hello there'],
    ['a newline', 'S someone@example.com\nhello there'],
    ['a non-breaking space', 'S someone@example.com hello there'],
    ['several spaces', 'S someone@example.com    hello there'],
    ['a "To:" prefix', 'S To: someone@example.com hello there'],
    ['a lowercase "to:" prefix', 'S to: someone@example.com hello there'],
    ['angle brackets', 'S <someone@example.com> hello there'],
    ['a trailing comma', 'S someone@example.com, hello there'],
    ['a lowercase command letter', 's someone@example.com hello there'],
  ])(
    'sends when the address and body are separated by %s',
    async (_label, text) => {
      const h = makeSmsHarness();

      await h.service.handleInboundSms('+15550001111', text);

      expect(h.gmailService.sendEmail).toHaveBeenCalledTimes(1);
      const { from, to, subject, body } = sentEmail(h.gmailService);
      expect(from).toBe('me@example.com');
      expect(to).toBe('someone@example.com');
      expect(subject).toBe('');
      expect(body).toBe('hello there');
      expect(textsSent(h.signalwireService)).toBe(
        'Sent to someone@example.com',
      );
      expect(textsSent(h.signalwireService)).not.toContain(
        'something went wrong',
      );
    },
  );

  it('accepts the "Name <addr>" form a contact autocomplete produces', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms(
      '+15550001111',
      'S Bob Smith <someone@example.com> hello there',
    );

    expect(sentEmail(h.gmailService).to).toBe('someone@example.com');
    expect(sentEmail(h.gmailService).body).toBe('hello there');
  });

  it('does not mistake a "<" inside the message for an address', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com is 5 <than> 6',
    );

    expect(sentEmail(h.gmailService).to).toBe('someone@example.com');
    expect(sentEmail(h.gmailService).body).toBe('is 5 <than> 6');
  });

  it('splits on a tab as readily as a space', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com\thello',
    );

    expect(sentEmail(h.gmailService).to).toBe('someone@example.com');
    expect(sentEmail(h.gmailService).body).toBe('hello');
  });

  it('keeps newlines inside the body intact', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com line one\nline two',
    );

    expect(sentEmail(h.gmailService).body).toBe('line one\nline two');
  });

  it('reads the pipe form as recipient | subject | body', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com | Lunch | see you at 1',
    );

    const { to, subject, body } = sentEmail(h.gmailService);
    expect(to).toBe('someone@example.com');
    expect(subject).toBe('Lunch');
    expect(body).toBe('see you at 1');
  });

  it('rejoins extra pipes into the body', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com | Subj | part a | part b',
    );

    // Segments are trimmed before rejoining, matching the long-standing
    // behaviour of this branch.
    expect(sentEmail(h.gmailService).body).toBe('part a|part b');
  });

  it('treats a two-part pipe form as recipient | body, with no subject', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com | just the body',
    );

    expect(sentEmail(h.gmailService).subject).toBe('');
    expect(sentEmail(h.gmailService).body).toBe('just the body');
  });

  it('does not treat a pipe inside the message as a delimiter', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com hey | check this',
    );

    const { to, subject, body } = sentEmail(h.gmailService);
    expect(to).toBe('someone@example.com');
    expect(subject).toBe('');
    expect(body).toBe('hey | check this');
  });

  it('explains a bad address instead of failing generically, without echoing it', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms('+15550001111', 'S Mom hello there');

    expect(h.gmailService.sendEmail).not.toHaveBeenCalled();
    const reply = textsSent(h.signalwireService);
    expect(reply).toMatch(/didn't look valid/);
    expect(reply).not.toContain('something went wrong');
    expect(reply).not.toContain('Mom'); // never quote the sender's own text back
  });

  it('asks for the message text when only an address was sent', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms('+15550001111', 'S someone@example.com');

    expect(h.gmailService.sendEmail).not.toHaveBeenCalled();
    expect(textsSent(h.signalwireService)).toMatch(/Missing message text/);
  });

  it('keeps every rejection inside one SMS segment', async () => {
    for (const text of ['S Mom hello', 'S someone@example.com']) {
      const h = makeSmsHarness();
      await h.service.handleInboundSms('+15550001111', text);
      const reply = textsSent(h.signalwireService);
      expect(reply.length).toBeLessThanOrEqual(160);
      // Non-GSM-7 characters would halve the segment budget to 70.
      expect(reply).toMatch(/^[\x20-\x7E\n]*$/);
    }
  });

  it('still treats a bare "S" as an unknown command', async () => {
    const h = makeSmsHarness();

    await h.service.handleInboundSms('+15550001111', 'S');

    expect(textsSent(h.signalwireService)).toContain('Unknown command');
  });

  it('rejects a bad address before asking which account to send from', async () => {
    const h = makeSmsHarness({
      emails: ['me@example.com', 'other@example.com'],
    });

    await h.service.handleInboundSms('+15550001111', 'S Mom hi');

    expect(h.pendingRepo.save).not.toHaveBeenCalled();
    expect(textsSent(h.signalwireService)).toMatch(/didn't look valid/);
    expect(textsSent(h.signalwireService)).not.toContain(
      'Send from which email',
    );
  });

  it('parks a valid multi-account send, then sends it on the numeric reply', async () => {
    const h = makeSmsHarness({
      emails: ['me@example.com', 'other@example.com'],
    });

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com\nhello there',
    );

    expect(h.gmailService.sendEmail).not.toHaveBeenCalled();
    expect(textsSent(h.signalwireService)).toContain('Send from which email');
    expect(h.pendingRepo.save).toHaveBeenCalledTimes(1);

    // The stored body is the raw command; re-parsing it must reach the same
    // recipient it validated a moment ago.
    h.pendingRepo.findOne.mockResolvedValue({
      id: 1,
      body: 'S someone@example.com\nhello there',
      emailIds: '7,8',
    });

    await h.service.handleInboundSms('+15550001111', '1');

    expect(h.gmailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(sentEmail(h.gmailService).to).toBe('someone@example.com');
    expect(sentEmail(h.gmailService).body).toBe('hello there');
  });

  it('stays generic when the failure is internal', async () => {
    const h = makeSmsHarness();
    h.gmailService.sendEmail.mockRejectedValue(
      new Error('ECONNRESET talking to googleapis'),
    );

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com hi',
    );

    const reply = textsSent(h.signalwireService);
    expect(reply).toContain('something went wrong');
    expect(reply).not.toContain('ECONNRESET');
    expect(reply).not.toContain('googleapis');
  });

  it("translates Gmail's own recipient rejection into the format hint", async () => {
    const h = makeSmsHarness();
    h.gmailService.sendEmail.mockRejectedValue(
      new BadRequestException('Invalid recipient email address'),
    );

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com hi',
    );

    expect(textsSent(h.signalwireService)).toMatch(/didn't look valid/);
  });

  it('still asks the user to reconnect on invalid_grant', async () => {
    const h = makeSmsHarness();
    h.gmailService.sendEmail.mockRejectedValue(new Error('invalid_grant'));

    await h.service.handleInboundSms(
      '+15550001111',
      'S someone@example.com hi',
    );

    expect(textsSent(h.signalwireService)).toMatch(/needs reauthorizing/);
  });

  // If the confirmation SMS threw, the exception escaped handleInboundSms, the
  // controller returned 500, SignalWire retried the webhook — and the email
  // went out a second time. There is no idempotency key on this path.
  it('does not resend when the confirmation SMS fails', async () => {
    const h = makeSmsHarness();
    h.signalwireService.sendSms.mockRejectedValue(new Error('signalwire down'));

    await expect(
      h.service.handleInboundSms('+15550001111', 'S someone@example.com hi'),
    ).resolves.toBeUndefined();

    expect(h.gmailService.sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe('WebhooksService.handleInboundSms — R path error text', () => {
  it('names the missing message instead of failing generically', async () => {
    const h = makeSmsHarness();
    h.incomeMessageRepo.findOne.mockResolvedValue(null);

    await h.service.handleInboundSms('+15550001111', 'R 999999 hi');

    const reply = textsSent(h.signalwireService);
    expect(reply).toContain('999999');
    expect(reply).not.toContain('something went wrong');
  });

  it('says so plainly when there is nothing to reply to', async () => {
    const h = makeSmsHarness();
    h.incomeMessageRepo.findOne.mockResolvedValue(null);

    await h.service.handleInboundSms('+15550001111', 'R hello');

    expect(textsSent(h.signalwireService)).toMatch(/No messages to reply to/);
  });

  // A rejected recipient on the R path comes from a stored From header, not
  // from what the user typed, so the S-command syntax hint would only mislead.
  it('stays generic when a reply recipient is rejected', async () => {
    const h = makeSmsHarness();
    h.gmailService.sendReply.mockRejectedValue(
      new BadRequestException('Invalid recipient email address'),
    );

    await h.service.handleInboundSms('+15550001111', 'R 481920 hi');

    const reply = textsSent(h.signalwireService);
    expect(reply).toContain('something went wrong');
    expect(reply).not.toContain('S bob@work.com');
  });

  it('did not become chatty about internal reply failures', async () => {
    const h = makeSmsHarness();
    h.gmailService.sendReply.mockRejectedValue(
      new Error('ECONNRESET talking to googleapis'),
    );

    await h.service.handleInboundSms('+15550001111', 'R 481920 hi');

    const reply = textsSent(h.signalwireService);
    expect(reply).toContain('something went wrong');
    expect(reply).not.toContain('ECONNRESET');
  });
});

describe('WebhooksService.handleGmailPush — duplicate delivery', () => {
  it('sends one SMS for a first-time message', async () => {
    const h = makeHarness();

    await h.service.handleGmailPush(gmailPushPayload());

    expect(h.signalwireService.sendSms).toHaveBeenCalledTimes(1);
    expect(h.incomeMessageRepo.insert).toHaveBeenCalledTimes(1);
  });

  it('does not send when the unique index rejects the insert as an already-stored message', async () => {
    const h = makeHarness();
    h.incomeMessageRepo.insert.mockRejectedValue(
      dupEntry('income_message.uq_income_message_gmail'),
    );

    await h.service.handleGmailPush(gmailPushPayload());

    // No retry with a fresh id, no summary, no text.
    expect(h.incomeMessageRepo.insert).toHaveBeenCalledTimes(1);
    expect(h.openAiService.summarize).not.toHaveBeenCalled();
    expect(h.signalwireService.sendSms).not.toHaveBeenCalled();
  });

  it('still retries a random primary-key collision and then sends once', async () => {
    const h = makeHarness();
    h.incomeMessageRepo.insert
      .mockRejectedValueOnce(dupEntry('PRIMARY'))
      .mockResolvedValueOnce(undefined);

    await h.service.handleGmailPush(gmailPushPayload());

    expect(h.incomeMessageRepo.insert).toHaveBeenCalledTimes(2);
    expect(h.signalwireService.sendSms).toHaveBeenCalledTimes(1);
  });

  it('skips the Gmail fetch entirely when the message is already stored', async () => {
    const h = makeHarness();
    h.incomeMessageRepo.findOne.mockResolvedValue({ messageId: 4242 });

    await h.service.handleGmailPush(gmailPushPayload());

    expect(h.gmailService.fetchMessage).not.toHaveBeenCalled();
    expect(h.signalwireService.sendSms).not.toHaveBeenCalled();
  });

  it('replaying the same notification texts the user only once', async () => {
    const h = makeHarness();
    // Second delivery hits the unique index, exactly as the DB would behave.
    h.incomeMessageRepo.insert
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(dupEntry('income_message.uq_income_message_gmail'));

    await h.service.handleGmailPush(gmailPushPayload());
    await h.service.handleGmailPush(gmailPushPayload());

    expect(h.signalwireService.sendSms).toHaveBeenCalledTimes(1);
  });

  it('texts a number once even when two active sets carry it', async () => {
    const h = makeHarness({ phones: ['15550001111', '15550001111'] });

    await h.service.handleGmailPush(gmailPushPayload());

    expect(h.signalwireService.sendSms).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent pushes for the same mailbox', async () => {
    const h = makeHarness();
    let inFlight = 0;
    let maxInFlight = 0;
    h.gmailService.fetchMessage.mockImplementation(async () => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await new Promise((r) => setImmediate(r));
      inFlight--;
      return fetchedMessage();
    });

    await Promise.all([
      h.service.handleGmailPush(gmailPushPayload('me@example.com', 200)),
      h.service.handleGmailPush(gmailPushPayload('me@example.com', 201)),
    ]);

    expect(maxInFlight).toBe(1);
  });
});

describe('WebhooksService.handleGmailPush — history pointer', () => {
  it('advances lastHistoryId past the processed window', async () => {
    const h = makeHarness();

    await h.service.handleGmailPush(gmailPushPayload('me@example.com', 200));

    expect(h.emailRow.lastHistoryId).toBe('200');
    expect(h.emailRepo.save).toHaveBeenCalled();
  });

  it('never rewinds lastHistoryId when notifications finish out of order', async () => {
    const h = makeHarness();
    h.emailRow.lastHistoryId = '300';

    await h.service.handleGmailPush(gmailPushPayload('me@example.com', 200));

    expect(h.emailRow.lastHistoryId).toBe('300');
    expect(h.emailRepo.save).not.toHaveBeenCalled();
  });

  it('compares history ids numerically, not as strings', async () => {
    const h = makeHarness();
    h.emailRow.lastHistoryId = '9';

    await h.service.handleGmailPush(gmailPushPayload('me@example.com', 10));

    expect(h.emailRow.lastHistoryId).toBe('10');
  });

  it('advances the pointer even when the mailbox has no active sets', async () => {
    const h = makeHarness();
    h.setRepo.find.mockResolvedValue([]);

    await h.service.handleGmailPush(gmailPushPayload('me@example.com', 200));

    expect(h.signalwireService.sendSms).not.toHaveBeenCalled();
    expect(h.emailRow.lastHistoryId).toBe('200');
  });
});
