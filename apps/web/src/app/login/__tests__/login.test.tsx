import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const loginMock = vi.fn();
const signupMock = vi.fn();
const logoutMock = vi.fn();
const refreshAuthMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      isLoading: false,
      login: loginMock,
      signup: signupMock,
      logout: logoutMock,
      refresh: refreshAuthMock,
    }),
  };
});

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginMock.mockReset();
    loginMock.mockResolvedValue(undefined);
  });

  function renderLogin() {
    return render(
      <TestProviders>
        <LoginPage />
      </TestProviders>,
    );
  }

  it("renders the login form", () => {
    renderLogin();
    expect(
      screen.getByRole("heading", { name: /log in/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^log in$/i }),
    ).toBeInTheDocument();
  });

  it("calls login with the entered email and password", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("alice@example.com", "secret123");
    });
  });

  it("shows an error message when login fails", async () => {
    loginMock.mockRejectedValueOnce(new Error("Invalid credentials"));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("disables the submit button while submitting", async () => {
    let resolveLogin: () => void = () => {};
    loginMock.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          resolveLogin = r;
        }),
    );

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "a@b.c");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });
    expect(screen.getByRole("button").textContent).toMatch(/logging in/i);

    resolveLogin();
  });

  it("links to the signup page", () => {
    renderLogin();
    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link).toHaveAttribute("href", "/signup");
  });
});
