import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-bg text-fg border border-border hover:border-border-input",
  ghost: "bg-transparent text-fg hover:bg-surface",
  danger: "bg-danger text-on-accent hover:brightness-90",
  inverse: "bg-inverse-bg text-on-inverse hover:bg-nav-hover",
} as const;

const sizes = {
  sm: "h-7 px-3 text-sm gap-1.5",
  md: "h-9 px-4 text-base gap-2",
  lg: "h-11 px-5 text-md gap-2",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-sm font-medium",
        "transition-colors duration-fast active:translate-y-px",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  size?: 28 | 32 | 36;
  tone?: "default" | "success" | "accent" | "danger" | "nav";
};

const tones = {
  default: "text-muted hover:bg-surface hover:text-fg aria-pressed:bg-accent-soft aria-pressed:text-accent-text",
  success: "text-success hover:bg-success-soft",
  accent: "text-accent hover:bg-accent-soft",
  danger: "text-danger hover:bg-danger-soft",
  nav: "text-nav-muted hover:bg-nav-hover hover:text-nav-text",
} as const;

export function IconButton({ label, size = 32, tone = "default", className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm transition-colors duration-fast",
        "disabled:pointer-events-none disabled:opacity-50",
        size === 28 ? "size-7" : size === 32 ? "size-8" : "size-9",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
