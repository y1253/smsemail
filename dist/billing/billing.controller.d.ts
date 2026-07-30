import { BillingService } from './billing.service';
import { ListInvoicesDto } from './dto/list-invoices.dto';
type JwtPayload = {
    user_id: number;
    email: string;
};
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
    listInvoices(dto: ListInvoicesDto, user: JwtPayload): Promise<import("./billing.service").InvoicePage>;
    listSubscriptions(user: JwtPayload): Promise<import("./billing.service").BillingSubscription[]>;
}
export {};
