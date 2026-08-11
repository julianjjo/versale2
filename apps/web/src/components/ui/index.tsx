"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type HTMLAttributes,
} from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  size?: ButtonSize;
  pill?: boolean;
}

const buttonClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-secondary text-text-inverse hover:bg-secondary/90 active:bg-secondary/95",
  // Solid terracotta (--color-terracotta) under paper or ink text falls short
  // of 4.5:1 at button text sizes — terracotta-deep + paper text clears it
  // (~5.3:1) while staying recognizably the brand accent. Hover/active darken
  // via brightness (not opacity toward the page bg) so contrast only grows.
  accent:
    "bg-terracotta-deep text-paper hover:brightness-95 active:brightness-90",
  secondary:
    "bg-surface text-text-primary border border-border hover:bg-surface-muted active:bg-surface-muted/80",
  danger:
    "bg-danger text-text-inverse hover:bg-danger/90 active:bg-danger/95",
  ghost:
    "bg-transparent text-text-primary hover:bg-surface-muted active:bg-surface-muted/80",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  fullWidth,
  size = "md",
  pill = false,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const radius = pill ? "rounded-full" : "rounded-md";
  return (
    <button
      type={type}
      className={`${base} ${radius} ${sizeClasses[size]} ${buttonClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Classes for the outer wrapper (e.g. grid/flex placement like col-span-2).
   *  `className` stays scoped to the control itself (width, height, etc). */
  wrapperClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  id,
  className = "",
  wrapperClassName = "",
  "aria-describedby": ariaDescribedBy,
  ...props
}: InputProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy =
    [ariaDescribedBy, error ? errorId : hintId].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}
      <input
        id={fieldId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 ${className}`}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export function Textarea({
  label,
  error,
  hint,
  id,
  className = "",
  wrapperClassName = "",
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy =
    [ariaDescribedBy, error ? errorId : hintId].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 ${className}`}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  children: ReactNode;
}

export function Select({
  label,
  error,
  hint,
  id,
  className = "",
  wrapperClassName = "",
  "aria-describedby": ariaDescribedBy,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy =
    [ariaDescribedBy, error ? errorId : hintId].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}
      <select
        id={fieldId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary transition-colors focus:border-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({
  label,
  id,
  className = "",
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const input = (
    <input
      type="checkbox"
      id={fieldId}
      style={{ accentColor: "var(--color-ink)" }}
      className={`h-4 w-4 rounded border-border-strong text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );

  if (!label) return input;

  return (
    <label
      htmlFor={fieldId}
      className="inline-flex items-center gap-2 text-sm text-text-primary"
    >
      {input}
      {label}
    </label>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-muted/40 px-6 py-12 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-muted">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="heading-card text-text-primary">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-text-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[0_20px_50px_-20px_rgba(26,26,26,0.25)] focus:outline-none"
      >
        <h2 id={titleId} className="heading-card text-text-primary">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <Tag
      className={`rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

const badgeClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-muted text-text-muted border-border",
  primary: "bg-primary/15 text-primary-foreground border-primary/30",
  success:
    "bg-success/10 text-success border-success/20",
  warning:
    "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  info: "bg-info/10 text-info border-info/20",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PageContainer({
  children,
  className = "",
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "narrow" | "default" | "wide";
}) {
  const widths: Record<string, string> = {
    narrow: "max-w-2xl",
    default: "max-w-5xl",
    wide: "max-w-6xl",
  };
  return (
    <div
      className={`mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 ${widths[size]} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="heading-section text-text-primary">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// Format a numeric value as Colombian pesos (COP):
//   $ 1.234.567
// Whole pesos only — the marketplace doesn't list items with decimals.
const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function Price({
  value,
  className = "",
  ...rest
}: {
  value: number;
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`font-display font-medium tabular-nums text-text-primary ${className}`}
      {...rest}
    >
      {copFormatter.format(value)}
    </span>
  );
}

export function StarRating({
  value,
  size = "sm",
  className = "text-warning",
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const rounded = Math.round(value);
  return (
    <span
      role="img"
      aria-label={`${value.toFixed(1)} de 5 estrellas`}
      className={`inline-flex items-center gap-0.5 ${className} ${
        size === "md" ? "text-base" : "text-sm"
      }`}
    >
      <span aria-hidden="true">{"★".repeat(rounded)}</span>
      <span aria-hidden="true" className="text-border">
        {"★".repeat(5 - rounded)}
      </span>
    </span>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return (
    <hr className={`border-0 border-t border-border ${className}`} />
  );
}
