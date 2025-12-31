import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--accent-blue)] text-white font-semibold shadow-[0_12px_24px_-14px_rgba(0,122,255,0.6)]",
  secondary:
    "border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] hover:bg-[color:var(--glass-hover-bg)]",
  ghost:
    "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]",
  danger:
    "border border-transparent bg-rose-500/10 text-rose-500 hover:bg-rose-500/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2 text-sm",
};

const disabledClasses =
  "disabled:cursor-not-allowed disabled:bg-[color:var(--glass-recessed-bg)] disabled:text-[color:var(--text-secondary)] disabled:shadow-none disabled:border-[color:var(--glass-border)]";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full transition-colors",
        variantClasses[variant],
        sizeClasses[size],
        disabledClasses,
        className
      )}
      {...props}
    />
  );
}

// 预设的按钮组合，方便直接使用
export function PrimaryButton({
  className,
  size = "lg",
  ...props
}: Omit<ButtonProps, "variant">) {
  return <Button variant="primary" size={size} className={className} {...props} />;
}

export function SecondaryButton({
  className,
  ...props
}: Omit<ButtonProps, "variant">) {
  return <Button variant="secondary" className={className} {...props} />;
}

export function GhostButton({
  className,
  ...props
}: Omit<ButtonProps, "variant">) {
  return <Button variant="ghost" className={className} {...props} />;
}

export function DangerButton({
  className,
  size = "sm",
  ...props
}: Omit<ButtonProps, "variant">) {
  return <Button variant="danger" size={size} className={className} {...props} />;
}
