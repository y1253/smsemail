export interface EmailContent {
    subject: string;
    html: string;
    text: string;
}
export interface TempPasswordEmailInput {
    firstName: string | null;
    tempPassword: string;
    expiresMinutes: number;
    loginUrl: string;
    accountUrl: string;
}
export declare function tempPasswordEmail({ firstName, tempPassword, expiresMinutes, loginUrl, accountUrl, }: TempPasswordEmailInput): EmailContent;
export interface GoogleAccountEmailInput {
    firstName: string | null;
    loginUrl: string;
}
export declare function googleAccountEmail({ firstName, loginUrl, }: GoogleAccountEmailInput): EmailContent;
