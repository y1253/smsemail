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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Price = void 0;
const typeorm_1 = require("typeorm");
let Price = class Price {
    priceId;
    price;
    additional;
    createdAt;
    deletedAt;
};
exports.Price = Price;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'price_id' }),
    __metadata("design:type", Number)
], Price.prototype, "priceId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'price',
        type: 'decimal',
        precision: 9,
        scale: 2,
    }),
    __metadata("design:type", String)
], Price.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'additional',
        type: 'decimal',
        precision: 9,
        scale: 2,
    }),
    __metadata("design:type", String)
], Price.prototype, "additional", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], Price.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'dleleted_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Price.prototype, "deletedAt", void 0);
exports.Price = Price = __decorate([
    (0, typeorm_1.Entity)('price')
], Price);
//# sourceMappingURL=price.entity.js.map