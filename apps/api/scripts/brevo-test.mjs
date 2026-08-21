// Prueba real de Brevo: email transaccional
// Uso: node scripts/brevo-test.mjs <destinatario>
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);
const KEY = env.BREVO_API_KEY;
const EMAIL_TO = process.argv[2];

if (!KEY) { console.error('BREVO_API_KEY no configurada'); process.exit(1); }
if (!EMAIL_TO) { console.error('Uso: node scripts/brevo-test.mjs <email-destinatario>'); process.exit(1); }

const res = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': KEY },
  body: JSON.stringify({
    sender: { name: env.BREVO_SENDER_NAME || 'Versale', email: env.BREVO_SENDER_EMAIL },
    to: [{ email: EMAIL_TO }],
    subject: 'Prueba Versale — integración Brevo',
    textContent: 'Prueba de la integración Brevo de Versale. Si lees esto, el envío de email funciona.',
  }),
});
const text = await res.text();
console.log('EMAIL →', res.status, text.slice(0, 300));
process.exit(res.ok ? 0 : 1);
