// Item 8: single contact channel. NEXT_PUBLIC_CONTACT_EMAIL is the web-side
// mirror of the API's CONTACT_EMAIL (Next only inlines env vars prefixed
// with NEXT_PUBLIC_). Empty string = not configured; callers must render a
// visible placeholder instead of a dead link.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export function contactMailto(subject: string): string | null {
  if (!CONTACT_EMAIL) return null;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
