import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "../notification-bell";
import { TestProviders } from "@/test-utils/TestProviders";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Request failed",
}));

import { api } from "@/lib/api";

const mockNotifications = [
  {
    id: "notif1",
    userId: "user1",
    type: "ORDER_SHIPPED" as const,
    message: "Tu pedido fue enviado. Número de guía: ABC123",
    orderId: "order1",
    read: false,
    createdAt: "2026-08-17T12:00:00.000Z",
  },
  {
    id: "notif2",
    userId: "user1",
    type: "ORDER_STATUS_CHANGED" as const,
    message: "Tu pedido cambió de estado a Pagado.",
    orderId: "order2",
    read: true,
    createdAt: "2026-08-16T12:00:00.000Z",
  },
];

function mockGet(unreadCount: number, notifications = mockNotifications) {
  return async (url: string) => {
    if (url === "/notifications/unread-count") {
      return { data: { count: unreadCount } };
    }
    if (url === "/notifications") {
      return {
        data: {
          data: notifications,
          meta: { total: notifications.length, page: 1, limit: 10, pages: 1 },
        },
      };
    }
    return { data: {} };
  };
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no muestra la insignia cuando no hay notificaciones sin leer", async () => {
    vi.mocked(api.get).mockImplementation(mockGet(0));
    render(
      <TestProviders>
        <NotificationBell />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/notifications/unread-count");
    });
    expect(
      screen.getByRole("button", { name: "Notificaciones" }),
    ).toBeInTheDocument();
  });

  it("muestra el conteo de notificaciones sin leer en la insignia", async () => {
    vi.mocked(api.get).mockImplementation(mockGet(2));
    render(
      <TestProviders>
        <NotificationBell />
      </TestProviders>,
    );

    expect(
      await screen.findByRole("button", { name: "Notificaciones, 2 sin leer" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("recorta el conteo a '9+' cuando hay más de 9 sin leer", async () => {
    vi.mocked(api.get).mockImplementation(mockGet(15));
    render(
      <TestProviders>
        <NotificationBell />
      </TestProviders>,
    );

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  it("abre el panel y lista las notificaciones al hacer click", async () => {
    vi.mocked(api.get).mockImplementation(mockGet(1));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <NotificationBell />
      </TestProviders>,
    );

    await user.click(await screen.findByRole("button", { name: /notificaciones/i }));

    expect(
      await screen.findByText("Tu pedido fue enviado. Número de guía: ABC123"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tu pedido cambió de estado a Pagado."),
    ).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando no hay notificaciones", async () => {
    vi.mocked(api.get).mockImplementation(mockGet(0, []));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <NotificationBell />
      </TestProviders>,
    );

    await user.click(await screen.findByRole("button", { name: /notificaciones/i }));
    expect(
      await screen.findByText("No tienes notificaciones"),
    ).toBeInTheDocument();
  });

  it("marca una notificación como leída al hacer click sobre ella", async () => {
    vi.mocked(api.get).mockImplementation(mockGet(1));
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <NotificationBell />
      </TestProviders>,
    );

    await user.click(await screen.findByRole("button", { name: /notificaciones/i }));
    const unread = await screen.findByText(
      "Tu pedido fue enviado. Número de guía: ABC123",
    );
    await user.click(unread);

    expect(api.patch).toHaveBeenCalledWith("/notifications/notif1/read");
  });

  it("no vuelve a marcar como leída una notificación ya leída", async () => {
    vi.mocked(api.get).mockImplementation(mockGet(1));
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <NotificationBell />
      </TestProviders>,
    );

    await user.click(await screen.findByRole("button", { name: /notificaciones/i }));
    const read = await screen.findByText("Tu pedido cambió de estado a Pagado.");
    await user.click(read);

    expect(api.patch).not.toHaveBeenCalled();
  });

  it('marca todas como leídas al hacer click en "Marcar todas como leídas"', async () => {
    vi.mocked(api.get).mockImplementation(mockGet(2));
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <NotificationBell />
      </TestProviders>,
    );

    await user.click(await screen.findByRole("button", { name: /notificaciones/i }));
    await user.click(
      await screen.findByRole("button", { name: /marcar todas como leídas/i }),
    );

    expect(api.patch).toHaveBeenCalledWith("/notifications/read-all");
  });

  it("cierra el panel al presionar Escape", async () => {
    vi.mocked(api.get).mockImplementation(mockGet(1));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <NotificationBell />
      </TestProviders>,
    );

    const trigger = await screen.findByRole("button", { name: /notificaciones/i });
    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Notificaciones" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
