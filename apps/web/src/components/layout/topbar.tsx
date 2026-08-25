// Only claims the product can actually honour today: there is no shipping
// engine (the order total never includes shipping) and no returns capability
// anywhere — no endpoint, no order status, no UI — so the previous "Envío
// gratis en pedidos +$80.000 COP" and "Devoluciones 14 días" promises were
// removed rather than reworded.
//
// DESIGN.md specifies this bar as a "centered single line", hidden at `sm` and
// below "if it would crowd the header". Both clauses were being violated: at
// 375px the three phrases wrapped to four lines (92px), which stacked on the
// 65px header ate 19% of a phone viewport before any content rendered.
//
// The tiers live in globals.css beside `.topbar`'s geometry, keyed off the
// `data-phrase` attributes below, so the bar's responsive behaviour reads in
// one place. They are content-driven: measured from each phrase's natural
// single-line width (including the bar's 32px horizontal padding), then given
// headroom for a 17px classic scrollbar plus font-render variance, rather than
// snapped to the nearest Tailwind tier.
//
//   phrase 1     377px → `sm` (640px), 246px slack
//   phrases 1–2  738px → 800px,         45px slack
//   all three   1000px → 1080px,        63px slack
//
// `md`/`lg` would have left 13px and 9px of slack respectively — enough to
// clip on a machine whose scrollbar or Inter fallback renders a hair wider,
// which is the same silent-regression class that produced the 92px bar.
//
// So the bar is hidden below `sm`, because even one phrase cannot hold a
// single line on a phone, and each further phrase appears only at the width
// that can seat it without wrapping. Nothing is lost on mobile: the curation
// promise headlines the home hero, "Envío no incluido" is disclosed in full at
// the cart total, and every price already renders COP.
//
// Add a fourth phrase only behind a breakpoint measured the same way —
// `.topbar` clips rather than wraps, so an unmeasured phrase truncates with an
// ellipsis instead of re-inflating the chrome.
export function Topbar() {
  return (
    <div className="topbar">
      <span>Cada prenda revisada antes de publicarse</span>
      <span data-phrase="2">Envío no incluido: se acuerda al entregar</span>
      <span data-phrase="3">Precios en pesos colombianos</span>
    </div>
  );
}
