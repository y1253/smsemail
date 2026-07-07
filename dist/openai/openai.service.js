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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = __importDefault(require("openai"));
const text_util_1 = require("../common/text.util");
let OpenAiService = class OpenAiService {
    config;
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
        const content = subj ? `${subj}\n\n${body.trim()}` : body.trim();
        if (content.length <= budget)
            return content;
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
        return (0, text_util_1.truncateClean)(text, budget);
    }
};
exports.OpenAiService = OpenAiService;
exports.OpenAiService = OpenAiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiService);
//# sourceMappingURL=openai.service.js.map