import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Summarize the email in ${budget} characters or fewer. Be concise. No filler words. Return only the summary.`,
        },
        {
          role: 'user',
          content: body.slice(0, 4000),
        },
      ],
      max_tokens: 100,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    return text.slice(0, budget);
  }
}
