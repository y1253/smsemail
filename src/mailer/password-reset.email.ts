/**
 * Password-recovery emails.
 *
 * Rendered with table layout and fully inline styles on purpose: Gmail strips
 * <style> blocks and most modern CSS, so anything relying on flex/grid or
 * classes collapses into an unstyled column. Every builder also returns a
 * `text` alternative — plain text is what a phone with no HTML rendering, and
 * every spam filter, actually reads.
 */

const BRAND = 'EmailOnText';
const BLUE = '#2563eb';
const INK = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const CANVAS = '#f3f4f6';

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const MONO = "'SF Mono', Menlo, Consolas, monospace";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** Escape anything interpolated into the HTML — first names are user-supplied. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function greeting(firstName: string | null): string {
  return firstName ? `Hi ${firstName},` : 'Hi,';
}

/**
 * Outer chrome shared by both emails: a centred 560px card on a grey canvas,
 * wordmark header, footer. `body` is the inner HTML of the card.
 */
function layout(body: string, preheader: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${BRAND}</title>
</head>
<body style="margin:0; padding:0; background-color:${CANVAS}; font-family:${FONT};">
  <!-- Preheader: the grey snippet shown next to the subject in the inbox list. -->
  <div style="display:none; font-size:1px; color:${CANVAS}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS}; padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:22px; font-weight:700; color:${BLUE}; letter-spacing:-0.3px;">${BRAND}</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff; border:1px solid ${BORDER}; border-radius:16px; padding:32px;">
${body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0; font-size:12px; line-height:18px; color:${MUTED};">
                ${BRAND} &middot; Email delivered to your phone as SMS<br>
                Questions? Just reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="background-color:${BLUE}; border-radius:8px;">
                    <a href="${href}" style="display:inline-block; padding:12px 28px; font-family:${FONT}; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">${label}</a>
                  </td>
                </tr>
              </table>`;
}

export interface TempPasswordEmailInput {
  firstName: string | null;
  tempPassword: string;
  expiresMinutes: number;
  loginUrl: string;
  accountUrl: string;
}

/**
 * Sent when a reset is requested on an email/password account. It carries a
 * working password, so it leads with the expiry and closes with the steps for
 * replacing it with one the user chose.
 */
export function tempPasswordEmail({
  firstName,
  tempPassword,
  expiresMinutes,
  loginUrl,
  accountUrl,
}: TempPasswordEmailInput): EmailContent {
  const body = `
              <h1 style="margin:0 0 16px; font-size:22px; line-height:30px; font-weight:700; color:${INK};">Your temporary password</h1>
              <p style="margin:0 0 12px; font-size:15px; line-height:24px; color:${INK};">${esc(greeting(firstName))}</p>
              <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:${INK};">
                We received a request to reset the password for your ${BRAND} account. Use the temporary password below to sign back in.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
                <tr>
                  <td align="center" style="background-color:#f9fafb; border:1px solid ${BORDER}; border-radius:12px; padding:20px 16px;">
                    <p style="margin:0 0 8px; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:${MUTED};">Temporary password</p>
                    <p style="margin:0; font-family:${MONO}; font-size:24px; font-weight:700; letter-spacing:2px; color:${INK}; word-break:break-all;">${esc(tempPassword)}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px; font-size:14px; line-height:22px; color:#b45309; background-color:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px 14px;">
                This password expires in ${expiresMinutes} minutes. After that it stops working and you will need to request a new one.
              </p>

              ${button(loginUrl, 'Sign in now')}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
                <tr><td style="border-top:1px solid ${BORDER}; padding-top:24px;">
                  <h2 style="margin:0 0 12px; font-size:16px; line-height:24px; font-weight:700; color:${INK};">Then choose your own password</h2>
                  <p style="margin:0 0 14px; font-size:15px; line-height:24px; color:${INK};">
                    The temporary password is only meant to get you back in. Replace it with one of your own:
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="top" style="padding:0 10px 10px 0; font-size:15px; line-height:24px; font-weight:700; color:${BLUE};">1.</td>
                      <td style="padding:0 0 10px; font-size:15px; line-height:24px; color:${INK};">Sign in at <a href="${loginUrl}" style="color:${BLUE};">${esc(loginUrl)}</a> using the temporary password above.</td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding:0 10px 10px 0; font-size:15px; line-height:24px; font-weight:700; color:${BLUE};">2.</td>
                      <td style="padding:0 0 10px; font-size:15px; line-height:24px; color:${INK};">Open <a href="${accountUrl}" style="color:${BLUE};">Account</a> and scroll to the <strong>Password</strong> section.</td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding:0 10px 0 0; font-size:15px; line-height:24px; font-weight:700; color:${BLUE};">3.</td>
                      <td style="font-size:15px; line-height:24px; color:${INK};">Enter the temporary password as your current one, pick a new password of at least 12 characters, and save.</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:24px 0 0; font-size:13px; line-height:20px; color:${MUTED};">
                Did not request this? Because the temporary password above does work, we recommend signing in and changing it right away.
              </p>`;

  const text = `${greeting(firstName)}

We received a request to reset the password for your ${BRAND} account.

  Temporary password: ${tempPassword}

This password expires in ${expiresMinutes} minutes. After that it stops working
and you will need to request a new one.

Then choose your own password:

  1. Sign in at ${loginUrl} using the temporary password above.
  2. Open ${accountUrl} and scroll to the "Password" section.
  3. Enter the temporary password as your current one, pick a new password of
     at least 12 characters, and save.

Did not request this? Because the temporary password above does work, we
recommend signing in and changing it right away.

-- ${BRAND}`;

  return {
    subject: `Your temporary ${BRAND} password`,
    html: layout(body, `Expires in ${expiresMinutes} minutes.`),
    text,
  };
}

export interface GoogleAccountEmailInput {
  firstName: string | null;
  loginUrl: string;
}

/**
 * Sent when a reset is requested for a Google-only account. Those rows have no
 * password hash at all, so there is nothing to reset — without this the user
 * would wait for an email that never came and keep retrying.
 */
export function googleAccountEmail({
  firstName,
  loginUrl,
}: GoogleAccountEmailInput): EmailContent {
  const body = `
              <h1 style="margin:0 0 16px; font-size:22px; line-height:30px; font-weight:700; color:${INK};">You sign in with Google</h1>
              <p style="margin:0 0 12px; font-size:15px; line-height:24px; color:${INK};">${esc(greeting(firstName))}</p>
              <p style="margin:0 0 20px; font-size:15px; line-height:24px; color:${INK};">
                Someone asked to reset the password for your ${BRAND} account. There is no password to reset &mdash; this account was created with <strong>Sign in with Google</strong>, so Google handles the sign-in.
              </p>
              <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:${INK};">
                Head to the sign-in page and use the <strong>Sign in with Google</strong> button.
              </p>

              ${button(loginUrl, 'Go to sign in')}

              <p style="margin:32px 0 0; padding-top:24px; border-top:1px solid ${BORDER}; font-size:13px; line-height:20px; color:${MUTED};">
                Forgotten your Google password? Reset it at <a href="https://accounts.google.com/signin/recovery" style="color:${BLUE};">accounts.google.com</a>. Did not request this? Nothing on your account changed, and you can safely ignore this email.
              </p>`;

  const text = `${greeting(firstName)}

Someone asked to reset the password for your ${BRAND} account. There is no
password to reset - this account was created with "Sign in with Google", so
Google handles the sign-in.

Head to ${loginUrl} and use the "Sign in with Google" button.

Forgotten your Google password? Reset it at
https://accounts.google.com/signin/recovery

Did not request this? Nothing on your account changed, and you can safely
ignore this email.

-- ${BRAND}`;

  return {
    subject: `Signing in to ${BRAND}`,
    html: layout(body, 'This account uses Sign in with Google.'),
    text,
  };
}
