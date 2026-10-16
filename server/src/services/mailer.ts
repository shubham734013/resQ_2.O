import { env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type MailSender = (message: MailMessage) => Promise<void>;

const RESEND_API_URL = 'https://api.resend.com/emails';

const isEmailConfigured = (): boolean => Boolean(env.RESEND_API_KEY && env.MAIL_FROM);

/**
 * Delivers mail through the Resend transactional email API.
 * Uses the built-in fetch, so no extra runtime dependency is required.
 */
const sendViaResend = async (message: MailMessage): Promise<void> => {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  });
  if (!response.ok) {
    // Never log the request body: it contains the secret reset link.
    throw new Error(`Transactional email delivery failed with status ${response.status}`);
  }
};

/**
 * Default mail delivery channel.
 *
 * - When RESEND_API_KEY and MAIL_FROM are configured, the message is
 *   delivered through the Resend transactional email API.
 * - In production WITHOUT email configuration the email is NOT sent and an
 *   error is logged so operators can alert on it. The message content (which
 *   may contain secrets such as reset links) is never logged or returned.
 * - Outside production the message content is printed to the server console
 *   as a development convenience. This path is unreachable in production.
 */
export const defaultMailSender: MailSender = async (message) => {
  if (isEmailConfigured()) {
    await sendViaResend(message);
    return;
  }
  if (env.NODE_ENV === 'production') {
    console.error(
      `[mailer] Email delivery is not configured; email to ${message.to} was NOT sent. ` +
      'Set RESEND_API_KEY and MAIL_FROM to enable transactional email.'
    );
    return;
  }
  console.info(
    `[mailer][DEV ONLY - no email provider configured] To: ${message.to}\nSubject: ${message.subject}\n${message.text}`
  );
};

export const sendPasswordResetEmail = async (
  email: string,
  resetUrl: string,
  send: MailSender = defaultMailSender,
): Promise<void> => {
  await send({
    to: email,
    subject: 'ResQ password reset instructions',
    text:
      'A password reset was requested for your ResQ account.\n\n' +
      `Open this one-time link within 30 minutes to choose a new password:\n${resetUrl}\n\n` +
      'If you did not request this reset, you can ignore this email; your password will not change.',
    html:
      '<p>A password reset was requested for your ResQ account.</p>' +
      `<p><a href="${resetUrl}">Reset your password</a> (one-time link, valid for 30 minutes).</p>` +
      '<p>If you did not request this reset, you can ignore this email; your password will not change.</p>',
  });
};
