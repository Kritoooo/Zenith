"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
  lockScroll?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  position?: "center" | "top";
  className?: string;
  overlayClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  actionsClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
};

type ModalFooterProps = {
  children: ReactNode;
  className?: string;
};

type ModalHeaderProps = {
  title?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  className?: string;
  titleClassName?: string;
  actionsClassName?: string;
};

type ModalBodyProps = {
  children: ReactNode;
  className?: string;
};

export function ModalHeader({
  title,
  actions,
  titleId,
  className,
  titleClassName,
  actionsClassName,
}: ModalHeaderProps) {
  if (!title && !actions) return null;
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {title ? (
        <p
          id={titleId}
          className={cn(
            "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]",
            titleClassName
          )}
        >
          {title}
        </p>
      ) : null}
      {actions ? (
        <div className={cn("flex items-center gap-2", actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return <div className={cn("mt-4", className)}>{children}</div>;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--glass-border)] pt-3 text-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  actions,
  footer,
  ariaLabel,
  children,
  closeOnOverlay = true,
  closeOnEsc = true,
  lockScroll = true,
  size = "md",
  position = "center",
  className,
  overlayClassName,
  headerClassName,
  titleClassName,
  actionsClassName,
  bodyClassName,
  footerClassName,
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open || !lockScroll || typeof document === "undefined") return;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [lockScroll, open]);

  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnEsc, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const hasHeader = Boolean(title || actions);
  const overlayPositionClasses =
    position === "top" ? "items-start pt-16" : "items-center";
  const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
    sm: "max-w-[420px]",
    md: "max-w-[560px]",
    lg: "max-w-[720px]",
    xl: "max-w-[900px]",
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-black/40 p-4",
        overlayPositionClasses,
        overlayClassName
      )}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={cn(
          "w-full rounded-[20px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4 shadow-[0_24px_60px_-40px_rgba(15,20,25,0.7)] backdrop-blur-[20px]",
          sizeClasses[size],
          className
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
      >
        {hasHeader ? (
          <ModalHeader
            title={title}
            actions={actions}
            titleId={titleId}
            className={headerClassName}
            titleClassName={titleClassName}
            actionsClassName={actionsClassName}
          />
        ) : null}
        <ModalBody className={cn(!hasHeader && "mt-0", bodyClassName)}>
          {children}
        </ModalBody>
        {footer ? (
          <div className={cn("mt-4", footerClassName)}>{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
