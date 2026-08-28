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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.SESSION_INVALID = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
exports.SESSION_INVALID = 'SESSION_INVALID';
const sessionOver = (reason, message) => new common_1.UnauthorizedException({
    statusCode: 401,
    message,
    code: exports.SESSION_INVALID,
    reason,
});
let AuthService = class AuthService {
    jwtService;
    userRepo;
    constructor(jwtService, userRepo) {
        this.jwtService = jwtService;
        this.userRepo = userRepo;
    }
    async validCustomer(request) {
        const token = request.headers['x-token'];
        if (!token) {
            throw sessionOver('invalid', 'Missing token');
        }
        let decoded;
        try {
            decoded = await this.jwtService.verify(token);
        }
        catch (err) {
            const expired = err?.name === 'TokenExpiredError';
            throw sessionOver(expired ? 'expired' : 'invalid', expired
                ? 'Your session has expired. Please sign in again.'
                : 'Invalid token');
        }
        const current = await this.userRepo.findOne({
            where: { userId: decoded.user_id },
            select: ['userId', 'tokenVersion'],
        });
        if (!current) {
            throw sessionOver('invalid', 'Invalid token');
        }
        if ((decoded.tv ?? 0) !== (current.tokenVersion ?? 0)) {
            throw sessionOver('revoked', 'Session ended because the account password was changed. Please sign in again.');
        }
        request.user = decoded;
        return true;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        typeorm_2.Repository])
], AuthService);
//# sourceMappingURL=auth.service.js.map