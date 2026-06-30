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

  async summarize(body: string, budget: number): Promise<string> {
    const trimmed = body.trim();
    if (trimmed.length <= budget) return trimmed;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a summarizer. Compress the following email body to ${budget} characters or fewer. Write complete sentences and end on a sentence boundary; never stop mid-sentence. Use only information present in the email — do not add, infer, or invent anything. Return only the compressed text, nothing else.`,
        },
        {
          role: 'user',
          content: trimmed.slice(0, 4000),
        },
      ],
      max_tokens: 100,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    return truncateClean(text, budget);
  }
}
