import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewsletterForm } from "../newsletter-form";

describe("NewsletterForm", () => {
  it("moves focus to the confirmation message after submitting", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);

    await user.type(screen.getByLabelText(/correo electrónico/i), "a@b.com");
    await user.click(screen.getByRole("button", { name: /suscribirme/i }));

    const confirmation = await screen.findByText(/gracias por suscribirte/i);
    expect(confirmation).toHaveFocus();
  });
});
