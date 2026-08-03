import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { fitToSentence } from '../common/text.util';

// A summary that reports the ABSENCE of content is never a useful SMS — the
// reader gets a dead end instead of their email. These catch the shapes the
// model falls into when it decides nothing qualifies ("No relevant information
// provided", "N/A - no actionable details", "I cannot summarize this").
const NON_ANSWER = [
  /^(no|none|n\/?a|not?)\b[^.]{0,40}\b(relevant|relevent|information|content|details|actionable|summar)/i,
  /^(i (can ?not|can't|am unable)|unable to|sorry\b)/i,
];

@Injectable()
export class OpenAiService implements OnModuleInit {
  private readonly logger = new Logger(OpenAiService.name);
  private client: OpenAI;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    this.client = new OpenAI({ apiKey });
  }

  async summarize(subject: string, body: string, budget: number): Promise<string> {
    const subj = subject.trim();
    // Collapse to a single line up front: the result is dropped straight into
    // the SMS body, where a stray newline would break the To:/From:/Reply:
    // layout. Doing it before the length check also means a wrapped plain-text
    // email can now fit the budget outright and skip the model call.
    // ". " (not a blank line) joins them: the passthrough path returns this
    // string verbatim as the SMS body, so it has to read as one sentence.
    const sep = !subj || /[.!?:;,-]$/.test(subj) ? ' ' : '. ';
    const content = this.oneLine(subj ? `${subj}${sep}${body}` : body);
    if (content.length <= budget) return content;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You turn an email into a terse headline for an SMS. The input is the subject line, then the body. Summarize what the email SAYS — every email gets a summary.

Lead with the single most important concrete fact, then pack in as many specifics as fit: dates, times, amounts and prices, order/tracking/confirmation numbers, verification codes, statuses, deadlines, names, and locations. Preserve numbers, dates, and codes EXACTLY as written in the email — never round, reformat, or paraphrase them.

ALWAYS PRODUCE A SUMMARY. Many emails carry no dates, numbers, or actions — a personal note, a question, an invitation, small talk, a thank-you. Those still get summarized: say what the sender actually said or asked, in as few words as possible. Never reply that there is no relevant information, no actionable content, nothing to summarize, or that you cannot summarize it. Such a reply is always wrong — summarize the words that are there.
- WRITE: "Wants to know if you want to come over and play"   NOT: "No relevant information provided"
- WRITE: "Asks how you're doing, wants to catch up soon"   NOT: "No actionable content"
- WRITE: "Thanks you for the help last week"   NOT: "A friendly message with no details"

Never describe the email's category or your own reading of it — no "this email is about...", "regarding your...", "a notification about...", "you have received...", "it's about...". State the content directly. (Reporting what the sender asks or wants IS the content, not a description of it — "Asks if you're free Thursday" is correct.)
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

    const text = this.oneLine(response.choices[0]?.message?.content ?? '');

    // Last resort: the prompt forbids non-answers, but a model can still emit
    // one. Send the email's own words trimmed to fit rather than a dead end.
    if (!text || NON_ANSWER.some((re) => re.test(text))) {
      this.logger.warn(`Discarding non-answer summary: ${JSON.stringify(text)}`);
      return fitToSentence(content, budget);
    }

    return fitToSentence(text, budget);
  }

  /** Collapse every run of whitespace (including newlines) to one space. */
  private oneLine(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}
