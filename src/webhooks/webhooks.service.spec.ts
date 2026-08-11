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

function gmailPushPayload(emailAddress = 'me@example.com', historyId: number | string = 200) {
  return {
    message: {
      data: Buffer.from(JSON.stringify({ emailAddress, historyId })).toString('base64'),
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
  const openAiService = { summarize: jest.fn().mockResolvedValue('free at one, yes') };
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

describe('WebhooksService.handleGmailPush — duplicate delivery', () => {
  it('sends one SMS for a first-time message', async () => {
    const h = makeHarness();

    await h.service.handleGmailPush(gmailPushPayload());

    expect(h.signalwireService.sendSms).toHaveBeenCalledTimes(1);
    expect(h.incomeMessageRepo.insert).toHaveBeenCalledTimes(1);
  });

  it('does not send when the unique index rejects the insert as an already-stored message', async () => {
    const h = makeHarness();
    h.incomeMessageRepo.insert.mockRejectedValue(dupEntry('income_message.uq_income_message_gmail'));

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
