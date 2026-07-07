export declare class PhoneVerification {
    id: number;
    userId: number;
    phone: string;
    code: string;
    expiresAt: Date;
    consentAt: Date | null;
    createdAt: Date;
}
