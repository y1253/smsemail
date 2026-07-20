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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("./user.entity");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const google_auth_library_1 = require("google-auth-library");
const bcrypt = __importStar(require("bcrypt"));
let UsersService = class UsersService {
    userRepo;
    jwtService;
    googleClient;
    constructor(userRepo, jwtService, googleClient) {
        this.userRepo = userRepo;
        this.jwtService = jwtService;
        this.googleClient = googleClient;
    }
    async getProfile(userId) {
        const user = await this.userRepo.findOne({
            where: { userId },
            select: ['userId', 'firstName', 'lastName', 'email'],
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
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
        const { userId } = await this.userRepo.save(account);
        return this.jwtService.signAsync({ user_id: userId, email });
    }
    async login(user) {
        const savedUser = await this.getUserByEmail(user.email);
        if (!savedUser) {
            throw new common_1.UnauthorizedException('Invalid password or email');
        }
        if (!savedUser.password || !(await bcrypt.compare(user.password, savedUser.password))) {
            throw new common_1.UnauthorizedException('Invalid password or email');
        }
        return await this.createToken({
            userId: savedUser.userId,
            email: savedUser.email || '',
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
    async createToken({ userId, email, }) {
        const payload = { user_id: userId, email };
        return await this.jwtService.signAsync(payload);
    }
    async hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, common_1.Inject)('GOOGLE_CLIENT')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService,
        google_auth_library_1.OAuth2Client])
], UsersService);
//# sourceMappingURL=users.service.js.map