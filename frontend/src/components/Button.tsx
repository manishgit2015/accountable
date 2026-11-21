import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "destructive";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Primary: Sea Green with Midnight text. Secondary: white with a shadow. Destructive: delete dialogs only. */
export function Button({ variant = "secondary", className, type = "button", ...rest }: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");
  return <button type={type} className={classes} {...rest} />;
}
