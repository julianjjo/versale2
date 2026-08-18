import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderStatusTimeline } from "../order-status-timeline";

describe("OrderStatusTimeline", () => {
  it("marca solo el primer paso como actual cuando el pedido está pendiente", () => {
    render(<OrderStatusTimeline status="PENDING" />);

    expect(screen.getByText(/Pendiente/).parentElement).toHaveTextContent(
      "(actual)",
    );
    expect(screen.getByText(/Pagado/).parentElement).toHaveTextContent(
      "(pendiente)",
    );
    expect(screen.getByText(/Enviado/).parentElement).toHaveTextContent(
      "(pendiente)",
    );
    expect(screen.getByText(/Entregado/).parentElement).toHaveTextContent(
      "(pendiente)",
    );
  });

  it("marca los pasos anteriores como completados y el paso actual una vez pagado", () => {
    render(<OrderStatusTimeline status="PAID" />);

    expect(screen.getByText(/Pendiente/).parentElement).toHaveTextContent(
      "(completado)",
    );
    expect(screen.getByText(/Pagado/).parentElement).toHaveTextContent(
      "(actual)",
    );
    expect(screen.getByText(/Enviado/).parentElement).toHaveTextContent(
      "(pendiente)",
    );
  });

  it("marca los primeros tres pasos como completados cuando el pedido fue enviado", () => {
    render(<OrderStatusTimeline status="SHIPPED" />);

    expect(screen.getByText(/Pendiente/).parentElement).toHaveTextContent(
      "(completado)",
    );
    expect(screen.getByText(/Pagado/).parentElement).toHaveTextContent(
      "(completado)",
    );
    expect(screen.getByText(/Enviado/).parentElement).toHaveTextContent(
      "(actual)",
    );
    expect(screen.getByText(/Entregado/).parentElement).toHaveTextContent(
      "(pendiente)",
    );
  });

  // Regression: naively treating the reached status as merely "current"
  // (like every earlier step) instead of "done" would leave the final step
  // looking unfinished forever, since there's no later status to complete it.
  it("marca los cuatro pasos como completados una vez entregado, sin dejar el último como 'actual'", () => {
    render(<OrderStatusTimeline status="DELIVERED" />);

    expect(screen.getByText(/Pendiente/).parentElement).toHaveTextContent(
      "(completado)",
    );
    expect(screen.getByText(/Pagado/).parentElement).toHaveTextContent(
      "(completado)",
    );
    expect(screen.getByText(/Enviado/).parentElement).toHaveTextContent(
      "(completado)",
    );
    expect(screen.getByText(/Entregado/).parentElement).toHaveTextContent(
      "(completado)",
    );
    expect(screen.queryByText("(actual)")).not.toBeInTheDocument();
  });

  it("marca el paso actual con aria-current='step' para lectores de pantalla", () => {
    render(<OrderStatusTimeline status="SHIPPED" />);

    const currentStep = screen.getByText(/Enviado/).closest("li");
    expect(currentStep).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/Pendiente/).closest("li")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("muestra un aviso de cancelación en vez de la línea de tiempo cuando el pedido fue cancelado", () => {
    render(<OrderStatusTimeline status="CANCELLED" />);

    expect(screen.getByText("Pedido cancelado.")).toBeInTheDocument();
    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument();
    expect(screen.queryByText("Entregado")).not.toBeInTheDocument();
  });
});
