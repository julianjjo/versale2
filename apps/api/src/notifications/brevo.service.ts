import { Injectable, Logger } from '@nestjs/common';

/**
 * Brevo (ex-Sendinblue) — email transaccional vía API REST v3.
 * Sin SDK: usa fetch nativo. No-op seguro si falta BREVO_API_KEY (dev).
 *
 * Env requerido:
 *   BREVO_API_KEY       — clave de API (https://app.brevo.com/settings/keys/api)
 *   BREVO_SENDER_EMAIL  — email remitente verificado en Brevo
 *   BREVO_SENDER_NAME   — nombre visible del remitente (opcional)
 */
@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);
  private readonly apiKey = process.env.BREVO_API_KEY ?? '';

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Envía un email transaccional. `html` y `text` son alternativos (al menos uno). */
  async sendEmail(opts: {
    to: { email: string; name?: string }[];
    subject: string;
    html?: string;
    text?: string;
    templateId?: number;
    params?: Record<string, string>;
  }): Promise<{ messageId: string } | null> {
    if (!this.configured) {
      this.logger.warn('BREVO_API_KEY no configurada: email omitido');
      return null;
    }
    const body: Record<string, unknown> = {
      sender: {
        name: process.env.BREVO_SENDER_NAME ?? 'Versale',
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: opts.to,
      subject: opts.subject,
      ...(opts.templateId ? { templateId: opts.templateId } : {}),
      ...(opts.params ? { params: opts.params } : {}),
      ...(opts.html ? { htmlContent: opts.html } : {}),
      ...(opts.text ? { textContent: opts.text } : {}),
    };
    const res = await this.request('/v3/smtp/email', body);
    return { messageId: (res.messageId as string) ?? '' };
  }

  private async request(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`https://api.brevo.com${path}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Brevo ${path} respondió ${res.status}: ${detail}`);
      throw new Error(`Brevo request failed (${res.status})`);
    }
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
