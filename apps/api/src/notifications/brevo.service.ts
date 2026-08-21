import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/** Error con status HTTP para que los callers distingan fallos de Brevo. */
export class BrevoApiError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Brevo request failed (${status})`);
  }
}

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
export class BrevoService implements OnModuleInit {
  private readonly logger = new Logger(BrevoService.name);
  private apiKey = '';

  onModuleInit() {
    this.apiKey = process.env.BREVO_API_KEY ?? '';
    if (this.apiKey && !process.env.BREVO_SENDER_EMAIL) {
      this.logger.warn('BREVO_SENDER_EMAIL falta: los envíos fallarán');
    }
    if (!this.apiKey) {
      this.logger.warn('BREVO_API_KEY no configurada: emails omitidos');
    }
  }

  /** Envía un email transaccional. `html` y `text` son alternativos (al menos uno). */
  async sendEmail(opts: {
    to: { email: string; name?: string }[];
    subject: string;
    html?: string;
    text?: string;
  }): Promise<Record<string, unknown> | null> {
    if (!this.apiKey) return null;
    return this.request('/v3/smtp/email', {
      sender: {
        name: process.env.BREVO_SENDER_NAME ?? 'Versale',
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: opts.to,
      subject: opts.subject,
      ...(opts.html ? { htmlContent: opts.html } : {}),
      ...(opts.text ? { textContent: opts.text } : {}),
    });
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
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Brevo ${path} respondió ${res.status}: ${detail}`);
      throw new BrevoApiError(res.status, detail);
    }
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
