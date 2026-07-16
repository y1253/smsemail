"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EmailsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const email_entity_1 = require("./email.entity");
const deleted_email_entity_1 = require("./deleted-email.entity");
const user_entity_1 = require("../users/user.entity");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const google_auth_library_1 = require("google-auth-library");
const gmail_service_1 = require("../gmail/gmail.service");
const sets_service_1 = require("../sets/sets.service");
const REQUIRED_GMAIL_SCOPE = 'https://mail.google.com/';
let EmailsService = EmailsService_1 = class EmailsService {
    emailRepo;
    deletedEmailRepo;
    userRepo;
    config;
    googleClient;
    gmailService;
    setsService;
    encryptionKey;
    logger = new common_1.Logger(EmailsService_1.name);
    constructor(emailRepo, deletedEmailRepo, userRepo, config, googleClient, gmailService, setsService) {
        this.emailRepo = emailRepo;
        this.deletedEmailRepo = deletedEmailRepo;
        this.userRepo = userRepo;
        this.config = config;
        this.googleClient = googleClient;
        this.gmailService = gmailService;
        this.setsService = setsService;
        const key = this.config.get('REFRESH_TOKEN_KEY');
        if (!key || key.length < 32) {
            throw new Error('REFRESH_TOKEN_KEY must be set and at least 32 characters');
        }
        this.encryptionKey = Buffer.from(key.slice(0, 32));
    }
    async connectGoogleEmail(dto, user) {
        const owner = await this.userRepo.findOne({ where: { userId: user.user_id } });
        if (!owner) {
            throw new common_1.BadRequestException('User not found');
        }
        if (!dto.code) {
            throw new common_1.BadRequestException('Missing Google auth code');
        }
        const { tokens } = await this.googleClient.getToken(dto.code);
        if (!tokens.refresh_token) {
            throw new common_1.BadRequestException('Google did not return a refresh_token. Make sure you request offline access and prompt=consent.');
        }
        const grantedScopes = (tokens.scope ?? '').split(' ');
        if (!grantedScopes.includes(REQUIRED_GMAIL_SCOPE)) {
            throw new common_1.ForbiddenException("SMSMail needs permission to read and send your Gmail. On Google's consent screen, please check the box granting access to Gmail, then try again.");
        }
        const idToken = tokens.id_token;
        if (!idToken) {
            throw new common_1.BadRequestException('Google did not return an id_token with email information');
        }
        const ticket = await this.googleClient.verifyIdToken({
            idToken,
            audience: this.config.get('GOOGLE_CLIENT_ID'),
        });
        const payload = ticket.getPayload();
        const emailFromGoogle = payload?.email;
        if (!emailFromGoogle) {
            throw new common_1.BadRequestException('Could not determine Gmail address from Google token');
        }
        const encrypted = this.encrypt(tokens.refresh_token);
        let email = await this.emailRepo.findOne({
            where: { user: { userId: owner.userId }, email: emailFromGoogle },
            relations: ['user'],
        });
        const isNew = !email;
        const priorRefreshToken = email?.refreshToken ?? null;
        const priorDeletedAt = email?.deletedAt ?? null;
        if (!email) {
            email = this.emailRepo.create({
                user: owner,
                email: emailFromGoogle,
                refreshToken: encrypted,
                addedAt: new Date(),
                deletedAt: null,
            });
        }
        else {
            email.refreshToken = encrypted;
            email.deletedAt = null;
        }
        await this.emailRepo.save(email);
        let historyId;
        let expiry;
        try {
            ({ historyId, expiry } = await this.gmailService.watchGmail(tokens.refresh_token));
        }
        catch (err) {
            this.logger.error(`Failed to start Gmail watch for ${emailFromGoogle}: ${err}`);
            if (isNew) {
                await this.emailRepo.remove(email);
            }
            else {
                email.refreshToken = priorRefreshToken;
                email.deletedAt = priorDeletedAt;
                await this.emailRepo.save(email);
            }
            throw new common_1.ForbiddenException("SMSMail couldn't access your Gmail. On Google's consent screen, please check the box granting access to Gmail, then try again.");
        }
        email.lastHistoryId = historyId;
        email.watchExpiry = expiry;
        await this.emailRepo.save(email);
        return {
            emailId: email.emailId,
            email: email.email,
        };
    }
    async listEmailsForUser(userId) {
        const emails = await this.emailRepo.find({
            where: { user: { userId }, deletedAt: (0, typeorm_2.IsNull)() },
            order: { addedAt: 'ASC' },
        });
        return emails.map((e) => ({ emailId: e.emailId, email: e.email, addedAt: e.addedAt }));
    }
    async deleteEmailForUser(userId, emailId) {
        const email = await this.emailRepo.findOne({
            where: { emailId },
            relations: ['user'],
        });
        if (!email || email.user.userId !== userId) {
            throw new common_1.BadRequestException('Email not found for this user');
        }
        if (email.deletedAt) {
            return { deleted: true, emailId: email.emailId };
        }
        await this.setsService.teardownSetsForEmail(userId, emailId);
        if (email.refreshToken) {
            try {
                await this.gmailService.unwatchGmail(this.decrypt(email.refreshToken));
            }
            catch (err) {
                this.logger.error(`Failed to unwatch Gmail for email ${emailId}: ${err}`);
            }
        }
        await this.deletedEmailRepo.save(this.deletedEmailRepo.create({
            userId,
            originalEmailId: email.emailId,
            email: email.email,
            createdAt: email.addedAt,
            deletedAt: new Date(),
        }));
        email.refreshToken = null;
        email.deletedAt = new Date();
        await this.emailRepo.save(email);
        return { deleted: true, emailId: email.emailId };
    }
    decrypt(encrypted) {
        const buf = Buffer.from(encrypted, 'base64');
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const data = buf.subarray(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
    }
    encrypt(plain) {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return Buffer.concat([iv, tag, enc]).toString('base64');
    }
};
exports.EmailsService = EmailsService;
exports.EmailsService = EmailsService = EmailsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(email_entity_1.Email)),
    __param(1, (0, typeorm_1.InjectRepository)(deleted_email_entity_1.DeletedEmail)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(4, (0, common_1.Inject)('GOOGLE_CLIENT')),
    __param(6, (0, common_1.Inject)((0, common_1.forwardRef)(() => sets_service_1.SetsService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        google_auth_library_1.OAuth2Client,
        gmail_service_1.GmailService,
        sets_service_1.SetsService])
], EmailsService);
//# sourceMappingURL=emails.service.js.map