type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none px-3.5 py-2";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary:
    "border border-surface-border bg-surface text-foreground hover:border-accent/40 hover:bg-accent-soft/60",
  danger: "border border-danger/30 text-danger hover:bg-danger-soft",
  ghost: "text-muted hover:text-foreground hover:bg-surface-border/40",
};

export function button(variant: ButtonVariant = "secondary", className = "") {
  return [base, variants[variant], className].filter(Boolean).join(" ");
}

export const inputClass =
  "w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

export const labelClass = "mb-1.5 block text-xs font-medium text-muted";

export const cardClass = "rounded-xl border border-surface-border bg-surface shadow-sm";
