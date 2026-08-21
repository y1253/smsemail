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
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("./user.entity");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const google_auth_library_1 = require("google-auth-library");
const bcrypt = __importStar(require("bcrypt"));
const node_crypto_1 = require("node:crypto");
const mailer_service_1 = require("../mailer/mailer.service");
const password_reset_email_1 = require("../mailer/password-reset.email");
const TEMP_PASSWORD_EXPIRY_MINUTES = 30;
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
let UsersService = class UsersService {
    static { UsersService_1 = this; }
    userRepo;
    jwtService;
    googleClient;
    mailer;
    logger = new common_1.Logger(UsersService_1.name);
    constructor(userRepo, jwtService, googleClient, mailer) {
        this.userRepo = userRepo;
        this.jwtService = jwtService;
        this.googleClient = googleClient;
        this.mailer = mailer;
    }
    async getProfile(userId) {
        const user = await this.userRepo.findOne({
            where: { userId },
            select: ['userId', 'firstName', 'lastName', 'email', 'authType'],
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async updateProfile(userId, dto) {
        const user = await this.userRepo.findOneBy({ userId });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        user.firstName = dto.first_name;
        user.lastName = dto.last_name ?? null;
        await this.userRepo.save(user);
        return this.getProfile(userId);
    }
    async changePassword(userId, dto) {
        const user = await this.userRepo.findOneBy({ userId });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (!user.password) {
            throw new common_1.BadRequestException('This account signs in with Google');
        }
        if (!(await bcrypt.compare(dto.current_password, user.password))) {
            throw new common_1.UnauthorizedException('Current password is incorrect');
        }
        if (dto.current_password === dto.new_password) {
            throw new common_1.BadRequestException('New password must be different from the current one');
        }
        user.password = await this.hashPassword(dto.new_password);
        user.tempPasswordExpiresAt = null;
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
        await this.userRepo.save(user);
        const token = await this.createToken({
            userId: user.userId,
            email: user.email || '',
            tokenVersion: user.tokenVersion,
        });
        return { ok: true, token };
    }
    async forgotPassword(email) {
        const user = await this.getUserByEmail(email);
        const publicUrl = (process.env.PUBLIC_URL || 'https://emailontext.com').replace(/\/+$/, '');
        const loginUrl = `${publicUrl}/login`;
        if (!user || !user.email) {
            return { ok: true };
        }
        if (!user.password) {
            await this.trySend(user.email, (0, password_reset_email_1.googleAccountEmail)({ firstName: user.firstName, loginUrl }));
            return { ok: true };
        }
        const tempPassword = UsersService_1.generateTempPassword();
        const sent = await this.trySend(user.email, (0, password_reset_email_1.tempPasswordEmail)({
            firstName: user.firstName,
            tempPassword,
            expiresMinutes: TEMP_PASSWORD_EXPIRY_MINUTES,
            loginUrl,
            accountUrl: `${publicUrl}/account`,
        }));
        if (!sent) {
            return { ok: true };
        }
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + TEMP_PASSWORD_EXPIRY_MINUTES);
        user.password = await this.hashPassword(tempPassword);
        user.tempPasswordExpiresAt = expiresAt;
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
        await this.userRepo.save(user);
        return { ok: true };
    }
    async trySend(to, content) {
        try {
            await this.mailer.sendMail({ to, ...content });
            return true;
        }
        catch (err) {
            this.logger.error(`Failed to send "${content.subject}": ${err.message}`);
            return false;
        }
    }
    static generateTempPassword() {
        const groups = [];
        for (let g = 0; g < 3; g++) {
            let group = '';
            for (let i = 0; i < 4; i++) {
                group += TEMP_PASSWORD_ALPHABET[(0, node_crypto_1.randomInt)(0, TEMP_PASSWORD_ALPHABET.length)];
            }
            groups.push(group);
        }
        return groups.join('-');
    }
    async createNewUser(newUser) {
        const { first_name, last_name, email, password, auth_type = 'reg' } = newUser;
        const existing = await this.getUserByEmail(email);
        if (existing) {
            throw new common_1.ConflictException('Account already exists');
        }
        const account = this.userRepo.create({
            firstName: first_name,
            lastName: last_name,
            email,
            password: await this.hashPassword(password),
            authType: auth_type,
        });
        const saved = await this.userRepo.save(account);
        return this.createToken({
            userId: saved.userId,
            email,
            tokenVersion: saved.tokenVersion ?? 0,
        });
    }
    static DUMMY_HASH = '$2b$10$zJQZuvQszFCsN5HCNHJZnOoSY3Ez0l3YKgzitZRSUJHS89Gnx5MaO';
    async login(user) {
        const savedUser = await this.getUserByEmail(user.email);
        const hash = savedUser?.password || UsersService_1.DUMMY_HASH;
        const passwordOk = await bcrypt.compare(user.password, hash);
        if (!savedUser || !savedUser.password || !passwordOk) {
            throw new common_1.UnauthorizedException('Invalid password or email');
        }
        if (savedUser.tempPasswordExpiresAt &&
            savedUser.tempPasswordExpiresAt < new Date()) {
            throw new common_1.UnauthorizedException('This temporary password has expired. Request a new one from the login page.');
        }
        return await this.createToken({
            userId: savedUser.userId,
            email: savedUser.email || '',
            tokenVersion: savedUser.tokenVersion ?? 0,
        });
    }
    async googleLogin(credential) {
        const { tokens } = await this.googleClient.getToken(credential);
        if (!tokens.id_token)
            throw new common_1.UnauthorizedException('Google did not return an id_token');
        const ticket = await this.googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload)
            throw new common_1.UnauthorizedException('Invalid Google token');
        const { email, given_name, family_name } = payload;
        let user = await this.getUserByEmail(email || '');
        if (!user) {
            user = this.userRepo.create({
                email,
                firstName: given_name,
                lastName: family_name,
                authType: 'google',
            });
            user = await this.userRepo.save(user);
        }
        else {
            let changed = false;
            if (!user.firstName && given_name) {
                user.firstName = given_name;
                changed = true;
            }
            if (!user.lastName && family_name) {
                user.lastName = family_name;
                changed = true;
            }
            if (changed) {
                user = await this.userRepo.save(user);
            }
        }
        const accessToken = await this.createToken({
            userId: user.userId,
            email: user.email || '',
            tokenVersion: user.tokenVersion ?? 0,
        });
        return {
            accessToken,
        };
    }
    async getUserByEmail(email) {
        return await this.userRepo.findOneBy({
            email,
        });
    }
    async createToken({ userId, email, tokenVersion, }) {
        const payload = { user_id: userId, email, tv: tokenVersion };
        return await this.jwtService.signAsync(payload);
    }
    async hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, common_1.Inject)('GOOGLE_CLIENT')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService,
        google_auth_library_1.OAuth2Client,
        mailer_service_1.MailerService])
], UsersService);
//# sourceMappingURL=users.service.js.map