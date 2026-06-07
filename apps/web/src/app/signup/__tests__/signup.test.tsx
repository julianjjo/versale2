import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "../page";
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

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signupMock.mockReset();
    signupMock.mockResolvedValue(undefined);
  });

  function renderSignup() {
    return render(
      <TestProviders>
        <SignupPage />
      </TestProviders>,
    );
  }

  it("renders the signup form", () => {
    renderSignup();
    expect(
      screen.getByRole("heading", { name: /create an account/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("calls signup with name, email, and password", async () => {
    const user = userEvent.setup();
    renderSignup();

    await user.type(screen.getByLabelText("Name"), "Alice");
    await user.type(screen.getByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(signupMock).toHaveBeenCalledWith(
        "alice@example.com",
        "Alice",
        "password123",
      );
    });
  });

  it("shows an error message when signup fails", async () => {
    signupMock.mockRejectedValueOnce(new Error("Email taken"));
    const user = userEvent.setup();
    renderSignup();

    await user.type(screen.getByLabelText("Name"), "Alice");
    await user.type(screen.getByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText("Email taken")).toBeInTheDocument();
    });
  });

  it("links to the login page", () => {
    renderSignup();
    expect(
      screen.getByRole("link", { name: /log in/i }),
    ).toHaveAttribute("href", "/login");
  });
});
