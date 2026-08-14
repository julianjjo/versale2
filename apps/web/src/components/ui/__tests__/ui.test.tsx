import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Button,
  Input,
  Textarea,
  Select,
  Spinner,
  EmptyState,
  Card,
  Badge,
  PageContainer,
  SectionHeader,
  Price,
  StarRating,
  Divider,
  Modal,
} from "../index";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: /click me/i }),
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("respects the disabled prop", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders full-width when fullWidth is set", () => {
    render(<Button fullWidth>Wide</Button>);
    expect(screen.getByRole("button").className).toContain("w-full");
  });

  it("applies the size sm class for small buttons", () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("h-8");
  });

  it("defaults to type=button to avoid form submit", () => {
    render(<Button>Safe</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("supports a submit type when needed", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("renders the accent variant", () => {
    render(<Button variant="accent">Acento</Button>);
    const button = screen.getByRole("button", { name: "Acento" });
    expect(button.className).toContain("bg-terracotta-deep");
    expect(button.className).toContain("text-paper");
    expect(button.className).toContain("hover:brightness-95");
    expect(button.className).toContain("active:brightness-90");
  });
});

describe("Input", () => {
  it("renders with a label", () => {
    render(<Input label="Email" name="email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("forwards value and onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Input label="Name" value="" onChange={onChange} />);
    await user.type(screen.getByLabelText("Name"), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows the error message when error is set", () => {
    render(<Input label="X" error="required" />);
    expect(screen.getByText("required")).toBeInTheDocument();
  });

  it("shows the hint when set and no error", () => {
    render(<Input label="X" hint="some hint" />);
    expect(screen.getByText("some hint")).toBeInTheDocument();
  });
});

describe("Textarea", () => {
  it("renders with a label", () => {
    render(<Textarea label="Bio" name="bio" />);
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
  });

  it("shows the error message when error is set", () => {
    render(<Textarea label="X" error="too short" />);
    expect(screen.getByText("too short")).toBeInTheDocument();
  });
});

describe("Select", () => {
  it("renders options and forwards change events", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select label="Size" onChange={onChange}>
        <option value="">Select</option>
        <option value="M">M</option>
      </Select>,
    );
    await user.selectOptions(screen.getByLabelText("Size"), "M");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Spinner", () => {
  it("renders with role=status", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title, description, and action", () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Come back later"
        action={<button>Go</button>}
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Come back later")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go/i })).toBeInTheDocument();
  });
});

describe("Card", () => {
  it("renders children inside a card", () => {
    render(<Card>Hello card</Card>);
    expect(screen.getByText("Hello card")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("renders children with a default style", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("renders each variant without throwing", () => {
    const variants = [
      "default",
      "primary",
      "success",
      "warning",
      "danger",
      "info",
    ] as const;
    for (const v of variants) {
      const { unmount } = render(<Badge variant={v}>{v}</Badge>);
      expect(screen.getByText(v)).toBeInTheDocument();
      unmount();
    }
  });
});

describe("PageContainer", () => {
  it("renders children with default max width", () => {
    render(<PageContainer>Hello</PageContainer>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});

describe("SectionHeader", () => {
  it("renders title and description", () => {
    render(
      <SectionHeader
        title="Section"
        description="Subtitle"
        action={<button>Action</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /section/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Subtitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /action/i })).toBeInTheDocument();
  });
});

describe("Price", () => {
  it("formats with COP currency", () => {
    render(<Price value={45000} data-testid="p" />);
    const el = screen.getByTestId("p");
    // es-CO locale outputs "$ 45.000" (or "$45.000") — both are valid
    expect(el.textContent).toMatch(/45[\s.]000/);
  });

  it("renders in the display font with tabular numerals, not mono", () => {
    render(<Price value={45000} data-testid="p" />);
    const el = screen.getByTestId("p");
    expect(el.className).toContain("font-display");
    expect(el.className).toContain("tabular-nums");
    expect(el.className).not.toContain("font-mono");
  });
});

describe("StarRating", () => {
  it("renders a label with the value", () => {
    render(<StarRating value={4.5} />);
    expect(
      screen.getByLabelText(/4\.5 de 5 estrellas/i),
    ).toBeInTheDocument();
  });

  it("renders five stars for an in-range value", () => {
    render(<StarRating value={3} />);
    const el = screen.getByRole("img", { name: "3.0 de 5 estrellas" });
    expect(el.textContent).toBe("★".repeat(5));
  });

  // Regression: an average rating above 5 made `"★".repeat(5 - rounded)` throw
  // `RangeError: Invalid count value` and blanked the whole product page.
  it("no lanza y se limita a 5 estrellas con un valor fuera de rango", () => {
    render(<StarRating value={3336} />);
    const el = screen.getByRole("img", { name: "5.0 de 5 estrellas" });
    expect(el.textContent).toBe("★".repeat(5));
  });

  it("no lanza con un valor negativo", () => {
    render(<StarRating value={-7} />);
    const el = screen.getByRole("img", { name: "0.0 de 5 estrellas" });
    expect(el.textContent).toBe("★".repeat(5));
  });

  it("no lanza con NaN o sin valor", () => {
    const { unmount } = render(<StarRating value={Number.NaN} />);
    expect(
      screen.getByRole("img", { name: "0.0 de 5 estrellas" }),
    ).toBeInTheDocument();
    unmount();

    render(<StarRating value={undefined as unknown as number} />);
    expect(
      screen.getByRole("img", { name: "0.0 de 5 estrellas" }),
    ).toBeInTheDocument();
  });
});

describe("Divider", () => {
  it("renders an hr", () => {
    const { container } = render(<Divider />);
    expect(container.querySelector("hr")).toBeInTheDocument();
  });
});

describe("Modal", () => {
  it("no renderiza nada cuando open es false", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Título">
        <p>Contenido</p>
      </Modal>,
    );
    expect(screen.queryByText("Contenido")).not.toBeInTheDocument();
  });

  it("enfoca el primer elemento enfocable del panel al abrirse", async () => {
    render(
      <Modal open={true} onClose={() => {}} title="Título">
        <input aria-label="Motivo" />
        <button>Cancelar</button>
      </Modal>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Motivo")).toHaveFocus();
    });
  });

  // Regresión: el efecto de foco dependía de `[open, onClose]`. El único
  // consumidor (el diálogo de rechazo en admin/products) pasa un `onClose`
  // como arrow function inline, con una identidad nueva en cada render de esa
  // página — así que cualquier re-render ajeno mientras el diálogo estaba
  // abierto (escribir en un campo controlado dentro de él, un refetch de
  // react-query terminando en segundo plano) desmontaba y volvía a montar el
  // efecto, y su cleanup mandaba el foco fuera del diálogo antes de que el
  // setup lo devolviera al primer elemento enfocable — arrastrando el foco
  // lejos de donde el usuario lo había dejado con Tab.
  it("no le quita el foco al usuario en un re-render con un onClose de identidad nueva", async () => {
    const { rerender } = render(
      <Modal open={true} onClose={() => {}} title="Título">
        <input aria-label="Motivo" />
        <button>Cancelar</button>
      </Modal>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Motivo")).toHaveFocus();
    });

    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();

    // Misma llamada, pero con un `onClose` de identidad nueva: así es como se
    // ve, desde el punto de vista del Modal, un re-render de una página que
    // pasa `onClose={() => ...}` inline.
    rerender(
      <Modal open={true} onClose={() => {}} title="Título">
        <input aria-label="Motivo" />
        <button>Cancelar</button>
      </Modal>,
    );

    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("Escape llama siempre a la versión más reciente de onClose", async () => {
    const onCloseFirst = vi.fn();
    const onCloseLatest = vi.fn();
    const { rerender } = render(
      <Modal open={true} onClose={onCloseFirst} title="Título">
        <button>Cancelar</button>
      </Modal>,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    });

    // Re-render con un `onClose` distinto, sin cambiar `open`: el efecto no se
    // vuelve a montar, pero el handler de Escape debe seguir viendo la última
    // función pasada, no la que capturó al montar.
    rerender(
      <Modal open={true} onClose={onCloseLatest} title="Título">
        <button>Cancelar</button>
      </Modal>,
    );

    const user = userEvent.setup();
    await user.keyboard("{Escape}");

    expect(onCloseLatest).toHaveBeenCalledTimes(1);
    expect(onCloseFirst).not.toHaveBeenCalled();
  });
});
