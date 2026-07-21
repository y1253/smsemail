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
      messages: [
        {
          role: 'system',
          content: `You are a summarizer. The following email is given as its subject line, then a blank line, then the body. Compress the whole email into a single summary that captures what it is about and any action needed. HARD LIMIT: your entire reply must be ${budget} characters or fewer — this is an absolute maximum, not a target. Write complete sentences and make the LAST sentence finish within the limit; never stop mid-sentence and never rely on being truncated. If everything won't fit, include fewer sentences rather than an unfinished one. Ignore email signatures, disclaimers, greetings, and quoted reply text. Use only information present in the email — do not add, infer, or invent anything. Return only the compressed text, nothing else.`,
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
