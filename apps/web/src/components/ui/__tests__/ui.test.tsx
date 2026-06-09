import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    render(<Button variant="accent">Accent</Button>);
    expect(screen.getByRole("button").className).toContain("bg-primary");
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
});

describe("StarRating", () => {
  it("renders a label with the value", () => {
    render(<StarRating value={4.5} />);
    expect(
      screen.getByLabelText(/4\.5 de 5 estrellas/i),
    ).toBeInTheDocument();
  });
});

describe("Divider", () => {
  it("renders an hr", () => {
    const { container } = render(<Divider />);
    expect(container.querySelector("hr")).toBeInTheDocument();
  });
});
