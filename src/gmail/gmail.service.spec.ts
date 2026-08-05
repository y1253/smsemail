import { GmailService } from './gmail.service';

const send = jest.fn().mockResolvedValue({ data: {} });

jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn().mockImplementation(() => ({ setCredentials: jest.fn() })) },
    gmail: () => ({ users: { messages: { send } } }),
  },
}));

function makeService() {
  return new GmailService({ get: () => 'test' } as never);
}

/** The headers of the MIME message the last send() call carried. */
function sentHeaders(): string[] {
  const raw = send.mock.calls.at(-1)![0].requestBody.raw as string;
  const decoded = Buffer.from(raw, 'base64url').toString('utf-8');
  return decoded.split('\r\n\r\n')[0].split('\r\n');
}

describe('GmailService.sendReply threading headers', () => {
  beforeEach(() => send.mockClear());

  it('sets In-Reply-To and References when the parent Message-ID is known', async () => {
    await makeService().sendReply(
      'tok',
      'thread-1',
      'them@example.com',
      'Lunch',
      'sounds good',
      'me@example.com',
      '<abc@mail.gmail.com>',
      null,
    );

    const headers = sentHeaders();
    expect(headers).toContain('In-Reply-To: <abc@mail.gmail.com>');
    expect(headers).toContain('References: <abc@mail.gmail.com>');
    expect(headers).toContain('Subject: Re: Lunch');
    expect(send.mock.calls[0][0].requestBody.threadId).toBe('thread-1');
  });

  it('appends the parent to an existing References chain', async () => {
    await makeService().sendReply(
      'tok',
      'thread-1',
      'them@example.com',
      'Lunch',
      'sounds good',
      'me@example.com',
      '<c@mail.gmail.com>',
      '<a@mail.gmail.com> <b@mail.gmail.com>',
    );

    expect(sentHeaders()).toContain(
      'References: <a@mail.gmail.com> <b@mail.gmail.com> <c@mail.gmail.com>',
    );
  });

  it('does not repeat the parent when the chain already ends with it', async () => {
    await makeService().sendReply(
      'tok',
      'thread-1',
      'them@example.com',
      'Lunch',
      'sounds good',
      'me@example.com',
      '<b@mail.gmail.com>',
      '<a@mail.gmail.com> <b@mail.gmail.com>',
    );

    expect(sentHeaders()).toContain('References: <a@mail.gmail.com> <b@mail.gmail.com>');
  });

  it('omits both headers when the parent Message-ID is unknown', async () => {
    await makeService().sendReply(
      'tok',
      'thread-1',
      'them@example.com',
      'Lunch',
      'sounds good',
      'me@example.com',
      null,
      null,
    );

    const headers = sentHeaders();
    expect(headers.some((h) => h.startsWith('In-Reply-To:'))).toBe(false);
    expect(headers.some((h) => h.startsWith('References:'))).toBe(false);
  });

  it('does not double-prefix a subject that already starts with RE:', async () => {
    await makeService().sendReply(
      'tok',
      'thread-1',
      'them@example.com',
      'RE: Lunch',
      'sounds good',
      'me@example.com',
      '<a@mail.gmail.com>',
      null,
    );

    expect(sentHeaders()).toContain('Subject: RE: Lunch');
  });
});

describe('GmailService.sendEmail', () => {
  beforeEach(() => send.mockClear());

  it('sends a plain message with no threading headers or threadId', async () => {
    await makeService().sendEmail('tok', 'me@example.com', 'them@example.com', 'Hi', 'body');

    const headers = sentHeaders();
    expect(headers).toEqual([
      'From: me@example.com',
      'To: them@example.com',
      'Subject: Hi',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
    ]);
    expect(send.mock.calls[0][0].requestBody.threadId).toBeUndefined();
  });
});
