import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { truncateClean } from '../common/text.util';

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
          content: `You are a summarizer. The following email is given as its subject line, then a blank line, then the body. Compress the whole email into a single summary of ${budget} characters or fewer that captures what it is about and any action needed. Ignore email signatures, disclaimers, greetings, and quoted reply text. Write complete sentences and end on a sentence boundary; never stop mid-sentence. Use only information present in the email — do not add, infer, or invent anything. Return only the compressed text, nothing else.`,
        },
        {
          role: 'user',
          content: content.slice(0, 4000),
        },
      ],
      max_tokens: 100,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    return truncateClean(text, budget);
  }
}
