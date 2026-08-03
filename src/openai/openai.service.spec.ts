import { Logger } from '@nestjs/common';
import { OpenAiService } from './openai.service';

/**
 * Builds a service whose OpenAI client is a stub returning `reply`, bypassing
 * onModuleInit (and therefore the real SDK and the API key check).
 */
function makeService(reply: string | null) {
  const create = jest.fn().mockResolvedValue({
    choices: [{ message: { content: reply } }],
  });
  const service = new OpenAiService({ get: () => 'test-key' } as never);
  (service as unknown as { client: unknown }).client = {
    chat: { completions: { create } },
  };
  return { service, create };
}

describe('OpenAiService.summarize', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('short emails (no model call)', () => {
    it('returns subject + body as one line, with no newlines', async () => {
      const { service, create } = makeService(null);
      const result = await service.summarize('Dinner', 'Are you free\nThursday?', 80);

      expect(create).not.toHaveBeenCalled();
      expect(result).toBe('Dinner. Are you free Thursday?');
      expect(result).not.toContain('\n');
    });

    it('does not double up punctuation when the subject already ends in some', async () => {
      const { service } = makeService(null);
      expect(await service.summarize('Are you free?', 'Let me know.', 80)).toBe(
        'Are you free? Let me know.',
      );
    });

    it('collapses wrapped plain-text so an email that looked long now fits', async () => {
      const { service, create } = makeService(null);
      const body = 'Are you\n   free on\n\n   Thursday?';
      const result = await service.summarize('', body, 25);

      expect(create).not.toHaveBeenCalled();
      expect(result).toBe('Are you free on Thursday?');
      expect(result.length).toBeLessThanOrEqual(25);
    });
  });

  describe('model summaries', () => {
    const LONG_BODY =
      'Hi there, just following up on the thing we discussed last week at the office, ' +
      'let me know what you think when you get a chance to look it over properly.';

    it('returns the model summary fitted to the budget', async () => {
      const { service, create } = makeService('Following up on last week, wants your thoughts');
      const result = await service.summarize('Follow up', LONG_BODY, 70);

      expect(create).toHaveBeenCalledTimes(1);
      expect(result).toBe('Following up on last week, wants your thoughts');
      expect(result.length).toBeLessThanOrEqual(70);
    });

    it('passes the budget into the system prompt', async () => {
      const { service, create } = makeService('Something');
      await service.summarize('Follow up', LONG_BODY, 64);

      const system = create.mock.calls[0][0].messages[0].content as string;
      expect(system).toContain('64 characters or fewer');
    });

    it('preserves order numbers and amounts exactly', async () => {
      const { service } = makeService('Order #4471 shipped, invoice $84.20 due 8/15');
      const result = await service.summarize('Your order', LONG_BODY, 70);

      expect(result).toContain('#4471');
      expect(result).toContain('$84.20');
      expect(result).toContain('8/15');
    });

    it('flattens a multi-line model reply into one line', async () => {
      const { service } = makeService('Following up on last week.\nWants your thoughts.');
      const result = await service.summarize('Follow up', LONG_BODY, 70);

      expect(result).not.toContain('\n');
    });
  });

  describe('non-answer guard', () => {
    // The bug this whole change exists for: a chatty email with no dates,
    // numbers, or actions used to come back as "no relevant information".
    const CHATTY =
      'hello i was just wondering if you want to come over and play with me sometime ' +
      'this week, it has been a while since we hung out and it would be really fun';

    it.each([
      'No relevant information provided',
      'no relevent information provided',
      'None - no actionable content in this email',
      'N/A - nothing to summarize',
      'I cannot summarize this email',
      'Unable to extract any relevant details',
      '',
      '   ',
    ])('falls back to the email text instead of returning %p', async (reply) => {
      const { service } = makeService(reply);
      const result = await service.summarize('', CHATTY, 70);

      expect(result.toLowerCase()).not.toContain('no relevant information');
      expect(result.toLowerCase()).not.toContain('cannot summarize');
      expect(result).toContain('come over and play');
      expect(result.length).toBeLessThanOrEqual(70);
    });

    it('does not misfire on a real summary that merely starts with "No"', async () => {
      const { service } = makeService('No school Friday, teacher training day');
      expect(await service.summarize('Notice', CHATTY, 70)).toBe(
        'No school Friday, teacher training day',
      );
    });

    it('does not misfire on a summary mentioning a confirmation number', async () => {
      const { service } = makeService('Not shipping until 8/12, confirmation #4471');
      expect(await service.summarize('Notice', CHATTY, 70)).toBe(
        'Not shipping until 8/12, confirmation #4471',
      );
    });
  });
});
