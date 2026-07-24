import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { fitToSentence } from '../common/text.util';

@Injectable()
export class OpenAiService implements OnModuleInit {
  private client: OpenAI;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    this.client = new OpenAI({ apiKey });
  }

  async summarize(subject: string, body: string, budget: number): Promise<string> {
    const subj = subject.trim();
    const content = subj ? `${subj}\n\n${body.trim()}` : body.trim();
    if (content.length <= budget) return content;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You turn an email into a terse fact headline for an SMS. The input is the subject line, then a blank line, then the body. Extract the actual information — do NOT describe what the email is about.

Lead with the single most important concrete fact, then pack in as many specifics as fit: dates, times, amounts and prices, order/tracking/confirmation numbers, verification codes, statuses, deadlines, names, and locations. Preserve numbers, dates, and codes EXACTLY as written in the email — never round, reformat, or paraphrase them.

Never write meta-phrases such as "this email is about...", "regarding your...", "a notification about...", "you have received...", or "it's about...". State the fact directly.
- WRITE: "Package arriving 8/09/26"   NOT: "It's about your package arrival"
- WRITE: "Order #4471 shipped, arrives Fri Aug 9"   NOT: "An update about your recent order"
- WRITE: "Invoice $84.20 due 8/15"   NOT: "A reminder about your bill"
- WRITE: "Verification code 481920"   NOT: "A message with your login code"

When the budget is tight, a terse note-style fragment that keeps the key numbers beats a padded full sentence that drops them.

HARD LIMIT: your entire reply must be ${budget} characters or fewer — an absolute maximum, not a target. Finish on a complete word or clause; never stop mid-word and never rely on being truncated. If everything won't fit, drop the least important details rather than leaving an unfinished fragment. Ignore signatures, disclaimers, greetings, and quoted reply text. Use only information present in the email — do not add, infer, or invent anything. Return only the headline text, nothing else.`,
        },
        {
          role: 'user',
          content: content.slice(0, 4000),
        },
      ],
      // ~1 token ≈ 3–4 chars; keep generation close to the budget so the clamp
      // below is a rare safety net rather than the primary mechanism.
      max_tokens: Math.min(100, Math.ceil(budget / 3) + 8),
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    return fitToSentence(text, budget);
  }
}
