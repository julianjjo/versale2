// Item 14: fecha de publicación visible. Formato determinista (UTC +
// es-CO) para que servidor y cliente rendericen el mismo string — una fecha
// formateada con la zona local del visitante produciría mismatch de
// hidratación, que es justo lo que este ítem no puede introducir.
const formatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPublishDate(createdAt: string): string {
  return `Publicado el ${formatter.format(new Date(createdAt))}`;
}
