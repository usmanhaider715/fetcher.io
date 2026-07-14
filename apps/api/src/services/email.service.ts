import { config } from '../config/index.js';

export class EmailService {
  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!config.email.resendKey) {
      console.log(`[email] (dev) To: ${to} | ${subject}`);
      return true;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.email.from,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[email] Resend error:', body);
      return false;
    }
    return true;
  }

  async sendVerification(email: string, token: string) {
    const url = `${config.webUrl}/verify-email?token=${token}`;
    return this.send(
      email,
      'Verify your Fetcher.io email',
      `<p>Click to verify: <a href="${url}">${url}</a></p>`,
    );
  }

  async sendPasswordReset(email: string, token: string) {
    const url = `${config.webUrl}/reset-password?token=${token}`;
    return this.send(
      email,
      'Reset your Fetcher.io password',
      `<p>Reset link: <a href="${url}">${url}</a></p>`,
    );
  }
}

export const emailService = new EmailService();
