/** Destino por defecto cuando `?next=` falta o no es confiable. */
export const DEFAULT_LOGIN_REDIRECT = "/products";

/**
 * Devuelve una ruta interna segura a partir del `?next=` de la URL.
 *
 * `next.startsWith("/")` no alcanza: el navegador resuelve `//evil.example` y
 * `/\evil.example` como URLs absolutas a otro origen, así que alguien podría
 * llevarse al usuario recién autenticado a una página falsa. Solo aceptamos
 * rutas del mismo origen; cualquier otra cosa cae al catálogo.
 */
export function safeLoginRedirect(next: string | null | undefined): string {
  if (!next) return DEFAULT_LOGIN_REDIRECT;

  // Los navegadores descartan tabs y saltos de línea al resolver una URL y
  // tratan "\" como "/", así que normalizamos antes de validar.
  const candidate = next.replace(/[\t\n\r]/g, "").replace(/\\/g, "/").trim();

  // Rutas relativas, URLs absolutas ("https://…") y esquemas ("javascript:…").
  if (!candidate.startsWith("/")) return DEFAULT_LOGIN_REDIRECT;
  // Protocolo relativo: "//otro-sitio.com" sale del origen de la app.
  if (candidate.startsWith("//")) return DEFAULT_LOGIN_REDIRECT;
  // "/javascript:alert(1)" y similares: esquema escondido en el primer segmento.
  if (/^\/[^/?#]*:/.test(candidate)) return DEFAULT_LOGIN_REDIRECT;

  return candidate;
}
