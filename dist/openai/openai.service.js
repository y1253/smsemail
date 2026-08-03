"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var OpenAiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = __importDefault(require("openai"));
const text_util_1 = require("../common/text.util");
const NON_ANSWER = [
    /^(no|none|n\/?a|not?)\b[^.]{0,40}\b(relevant|relevent|information|content|details|actionable|summar)/i,
    /^(i (can ?not|can't|am unable)|unable to|sorry\b)/i,
];
let OpenAiService = OpenAiService_1 = class OpenAiService {
    config;
    logger = new common_1.Logger(OpenAiService_1.name);
    client;
    constructor(config) {
        this.config = config;
    }
    onModuleInit() {
        const apiKey = this.config.get('OPENAI_API_KEY');
        if (!apiKey)
            throw new Error('OPENAI_API_KEY is not set');
        this.client = new openai_1.default({ apiKey });
    }
    async summarize(subject, body, budget) {
        const subj = subject.trim();
        const sep = !subj || /[.!?:;,-]$/.test(subj) ? ' ' : '. ';
        const content = this.oneLine(subj ? `${subj}${sep}${body}` : body);
        if (content.length <= budget)
            return content;
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
            max_tokens: Math.min(100, Math.ceil(budget / 3) + 8),
        });
        const text = this.oneLine(response.choices[0]?.message?.content ?? '');
        if (!text || NON_ANSWER.some((re) => re.test(text))) {
            this.logger.warn(`Discarding non-answer summary: ${JSON.stringify(text)}`);
            return (0, text_util_1.fitToSentence)(content, budget);
        }
        return (0, text_util_1.fitToSentence)(text, budget);
    }
    oneLine(text) {
        return text.replace(/\s+/g, ' ').trim();
    }
};
exports.OpenAiService = OpenAiService;
exports.OpenAiService = OpenAiService = OpenAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiService);
//# sourceMappingURL=openai.service.js.map