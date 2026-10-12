import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/* Botões com "volume": brilho interno no topo, sombra na cor do botão e um leve afundar no clique.
   Só transform, opacity, cor e sombra animam; curva de mola (--ease-out). */
const variants = {
  primary:
    "fx-shine bg-accent text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_1px_2px_rgba(14,26,58,.25),0_6px_16px_-6px_rgba(29,78,216,.6)] hover:bg-accent-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_1px_2px_rgba(14,26,58,.25),0_10px_24px_-8px_rgba(29,78,216,.7)]",
  secondary:
    "bg-bg text-fg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(14,26,58,.06)] hover:shadow-[0_0_0_1px_var(--border-input),0_2px_6px_-2px_rgba(14,26,58,.12)] hover:bg-surface",
  ghost: "bg-transparent text-fg hover:bg-surface",
  danger:
    "bg-danger text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_6px_16px_-8px_rgba(196,43,43,.6)] hover:brightness-95",
  inverse: "bg-inverse-bg text-on-inverse shadow-[inset_0_1px_0_rgba(255,255,255,.12)] hover:bg-nav-hover",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-sm",
  md: "h-9 px-4 text-base gap-2 rounded-sm",
  lg: "h-11 px-5 text-md gap-2 rounded-md",
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
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-[background-color,box-shadow,transform,filter] duration-fast ease-out active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
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
        "inline-flex shrink-0 items-center justify-center rounded-sm transition-[background-color,color,transform] duration-fast ease-out active:scale-95",
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
