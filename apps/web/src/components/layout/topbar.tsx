// Only claims the product can actually honour today: there is no shipping
// engine (the order total never includes shipping) and no returns capability
// anywhere — no endpoint, no order status, no UI — so the previous "Envío
// gratis en pedidos +$80.000 COP" and "Devoluciones 14 días" promises were
// removed rather than reworded.
export function Topbar() {
  return (
    <div className="topbar">
      <span>Cada prenda revisada antes de publicarse</span>
      <span>Envío no incluido: se acuerda al entregar</span>
      <span>Precios en pesos colombianos</span>
    </div>
  );
}
