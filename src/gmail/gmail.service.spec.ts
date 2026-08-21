import { GmailService } from './gmail.service';

const send = jest.fn().mockResolvedValue({ data: {} });
const historyList = jest.fn().mockResolvedValue({ data: {} });
const messagesGet = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn().mockImplementation(() => ({ setCredentials: jest.fn() })) },
    gmail: () => ({
      users: {
        messages: { send, get: messagesGet },
        history: { list: historyList },
      },
    }),
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

describe('GmailService.getNewMessages', () => {
  beforeEach(() => historyList.mockReset());

  it('returns a message once when it appears in several history records', async () => {
    historyList.mockResolvedValue({
      data: {
        history: [
          { messagesAdded: [{ message: { id: 'm1', threadId: 't1' } }] },
          { messagesAdded: [{ message: { id: 'm1', threadId: 't1' } }] },
        ],
      },
    });

    const messages = await makeService().getNewMessages('tok', '100');

    expect(messages.map((m) => m.id)).toEqual(['m1']);
  });

  it('follows nextPageToken and dedupes across pages', async () => {
    historyList
      .mockResolvedValueOnce({
        data: {
          history: [{ messagesAdded: [{ message: { id: 'm1' } }, { message: { id: 'm2' } }] }],
          nextPageToken: 'page-2',
        },
      })
      .mockResolvedValueOnce({
        data: { history: [{ messagesAdded: [{ message: { id: 'm2' } }, { message: { id: 'm3' } }] }] },
      });

    const messages = await makeService().getNewMessages('tok', '100');

    expect(messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(historyList).toHaveBeenCalledTimes(2);
    expect(historyList.mock.calls[0][0].pageToken).toBeUndefined();
    expect(historyList.mock.calls[1][0].pageToken).toBe('page-2');
  });

  it('stops after one page when there is no nextPageToken', async () => {
    historyList.mockResolvedValue({ data: { history: [] } });

    await expect(makeService().getNewMessages('tok', '100')).resolves.toEqual([]);
    expect(historyList).toHaveBeenCalledTimes(1);
  });
});

describe('GmailService.fetchMessage body extraction', () => {
  const b64 = (t: string) => Buffer.from(t, 'utf-8').toString('base64url');

  /** Minimal messages.get response carrying a single body part. */
  function mockMessage(mimeType: string, content: string) {
    messagesGet.mockResolvedValue({
      data: {
        id: 'gm-1',
        threadId: 'th-1',
        labelIds: ['INBOX'],
        payload: {
          mimeType,
          headers: [
            { name: 'From', value: 'John Doe <john@example.com>' },
            { name: 'Subject', value: 'Re: Thursday' },
          ],
          body: { data: b64(content) },
        },
      },
    });
  }

  beforeEach(() => messagesGet.mockReset());

  it('drops the quoted thread from a plain-text reply', async () => {
    mockMessage(
      'text/plain',
      [
        'Sounds good, see you Thursday at 3.',
        '',
        'On Wed, Aug 19, 2026 at 10:15 AM John Doe <john@example.com> wrote:',
        '',
        '> Are you free Thursday afternoon?',
      ].join('\n'),
    );

    const msg = await makeService().fetchMessage('tok', 'gm-1');
    expect(msg.body).toBe('Sounds good, see you Thursday at 3.');
  });

  it('drops the Gmail quote container from an html-only reply', async () => {
    mockMessage(
      'text/html',
      '<div dir="ltr">Sounds good, see you Thursday at 3.</div><br>' +
        '<div class="gmail_quote gmail_quote_container">' +
        '<div dir="ltr" class="gmail_attr">On Wed, Aug 19, 2026 at 10:15 AM John Doe wrote:<br></div>' +
        '<blockquote class="gmail_quote"><div dir="ltr">Are you free Thursday afternoon?</div></blockquote>' +
        '</div>',
    );

    const msg = await makeService().fetchMessage('tok', 'gm-1');
    expect(msg.body).toBe('Sounds good, see you Thursday at 3.');
  });

  it('drops the Outlook header block from an html-only reply', async () => {
    mockMessage(
      'text/html',
      '<div>Approved. Go ahead and book it.</div><div id="appendonsend"></div><hr>' +
        '<div id="divRplyFwdMsg" dir="ltr"><b>From:</b> John Doe<br><b>Sent:</b> Wednesday<br></div>' +
        '<br><div>The venue needs a $500 deposit by Friday.</div>',
    );

    const msg = await makeService().fetchMessage('tok', 'gm-1');
    expect(msg.body).toBe('Approved. Go ahead and book it.');
  });
});
