// First focusable element on every page. Invisible until a keyboard user
// tabs to it, then it jumps ahead of the topbar/nav straight to #main-content
// (see SiteChrome) so repeat visitors don't have to tab through the same
// chrome on every route, admin included.
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-text-primary focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-text-inverse focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      Saltar al contenido principal
    </a>
  );
}
