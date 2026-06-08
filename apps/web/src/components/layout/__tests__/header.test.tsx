import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "../header";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const authState = {
  user: null as null | { id: string; email: string; name: string; role: "USER" | "ADMIN" },
  isLoading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => authState,
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
  });

  it("shows the brand on every viewport", () => {
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    expect(screen.getByText("Versale")).toBeInTheDocument();
  });

  it("shows Login and Sign up buttons when not authenticated", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const loginBtn = screen.getByRole("button", { name: /^login$/i });
    const signupBtn = screen.getByRole("button", { name: /sign up/i });
    expect(loginBtn).toBeInTheDocument();
    expect(signupBtn).toBeInTheDocument();

    await user.click(loginBtn);
    expect(pushMock).toHaveBeenCalledWith("/login");

    await user.click(signupBtn);
    expect(pushMock).toHaveBeenCalledWith("/signup");
  });

  it("shows Cart, Orders, Sell, and the user name when authenticated", () => {
    authState.user = {
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    };
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    // Cart appears in the inline nav (sm+) and the mobile-icon button (<sm).
    // Both point to /cart; assert that at least one Cart link/button exists.
    const cartTargets = screen.getAllByRole("link", { name: /cart/i });
    expect(cartTargets.length).toBeGreaterThan(0);
    expect(cartTargets[0]).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("link", { name: /^orders$/i })).toHaveAttribute(
      "href",
      "/orders",
    );
    expect(screen.getByRole("link", { name: /^sell$/i })).toHaveAttribute(
      "href",
      "/sell",
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows the admin link only for ADMIN users", () => {
    authState.user = {
      id: "admin1",
      email: "admin@b.c",
      name: "Admin User",
      role: "ADMIN",
    };
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const adminLink = screen.getByRole("link", { name: /^admin$/i });
    expect(adminLink).toHaveAttribute("href", "/admin");
  });

  it("does not show the admin link for non-admin users", () => {
    authState.user = {
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    };
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
  });

  it("logs out and routes to home when Logout is clicked", async () => {
    authState.user = {
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    };
    const user = userEvent.setup();
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    await user.click(screen.getByRole("button", { name: /logout/i }));
    expect(authState.logout).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("exposes a mobile menu trigger with proper aria attributes", () => {
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const trigger = screen.getByRole("button", { name: /open menu/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "mobile-menu");
  });

  it("toggles the mobile menu when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const trigger = screen.getByRole("button", { name: /open menu/i });
    await user.click(trigger);
    expect(
      screen.getByRole("button", { name: /close menu/i }),
    ).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: /mobile navigation/i });
    expect(dialog).toBeInTheDocument();
  });
});
