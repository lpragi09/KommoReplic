import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: string;
  adornment?: ReactNode;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hideLabel, error, hint, adornment, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const msgId = `${inputId}-msg`;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className={cn("text-sm font-medium text-fg", hideLabel && "sr-only")}>
        {label}
      </label>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-md border bg-[color-mix(in_srgb,var(--surface)_55%,var(--bg))] px-3.5 text-base shadow-[inset_0_1px_2px_rgba(20,28,24,.05)] transition-[border-color,box-shadow,background-color] duration-fast ease-out",
          "hover:bg-bg focus-within:border-focus focus-within:bg-bg focus-within:shadow-[0_0_0_4px_rgba(31,122,85,.15)]",
          error ? "border-danger" : "border-border hover:border-border-input",
          props.disabled && "bg-surface opacity-70",
        )}
      >
        {adornment && <span className="text-muted">{adornment}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted"
          {...props}
        />
      </div>
      {(error || hint) && (
        <p id={msgId} className={cn("text-xs", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
