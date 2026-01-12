import type {
  ButtonHTMLAttributes,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/cn";

type SelectVariant = "default" | "ghost";
type SelectSize = "sm" | "md";

type SelectProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "onClick" | "onKeyDown" | "value" | "defaultValue"
> & {
  variant?: SelectVariant;
  uiSize?: SelectSize;
  optionClassName?: string;
  className?: string;
  buttonClassName?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string } }) => void;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  children: ReactNode;
};

type ParsedOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  group?: string;
};

const toValue = (value: unknown) =>
  typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);

const parseOptions = (children: ReactNode, group?: string): ParsedOption[] => {
  const options: ParsedOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const element = child as { type: unknown; props: Record<string, unknown> };
    if (typeof element.type === "string" && element.type === "option") {
      const optionValue = toValue(element.props.value ?? element.props.children);
      options.push({
        value: optionValue,
        label: element.props.children as ReactNode,
        disabled: element.props.disabled as boolean | undefined,
        group,
      });
      return;
    }
    if (typeof element.type === "string" && element.type === "optgroup") {
      options.push(
        ...parseOptions(
          element.props.children as ReactNode,
          (element.props.label as string | undefined) ?? group
        )
      );
    }
  });
  return options;
};

const baseButtonClasses =
  "flex items-center justify-between gap-1.5 rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-blue)]";

const sizeButtonClasses: Record<SelectSize, string> = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
};

const variantButtonClasses: Record<SelectVariant, string> = {
  default: "w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
  ghost:
    "border-transparent bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-1",
};

const dropdownClasses =
  "absolute left-0 z-50 mt-2 max-h-60 min-w-full w-max max-w-[80vw] sm:max-w-[360px] overflow-auto rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1 shadow-[0_24px_60px_-40px_rgba(15,20,25,0.65)] backdrop-blur-[24px]";

const sizeOptionClasses: Record<SelectSize, string> = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
};

export function Select({
  variant = "default",
  uiSize = "sm",
  optionClassName,
  className,
  buttonClassName,
  onChange,
  value,
  defaultValue,
  disabled,
  name,
  id,
  onKeyDown: onKeyDownProp,
  onClick: onClickProp,
  children,
  ...props
}: SelectProps) {
  const options = useMemo(() => parseOptions(children), [children]);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => {
    const initial = toValue(defaultValue ?? options[0]?.value ?? "");
    return initial;
  });
  const currentValue = toValue(isControlled ? value : internalValue);
  const selectedOption =
    options.find((option) => option.value === currentValue) ?? options[0];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => {
    const index = options.findIndex((option) => option.value === currentValue);
    return index >= 0 ? index : 0;
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const listboxId = `${id ?? uid}-listbox`;
  const getIndexForValue = (valueToMatch: string) => {
    const index = options.findIndex((option) => option.value === valueToMatch);
    return index >= 0 ? index : 0;
  };

  useEffect(() => {
    if (!open) return;
    const handlePointer = (
      event: globalThis.MouseEvent | globalThis.TouchEvent
    ) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const node = listRef.current.querySelector(
      `[data-index="${activeIndex}"]`
    ) as HTMLElement | null;
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const emitChange = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.({ target: { value: nextValue } });
  };

  const selectOption = (option: ParsedOption) => {
    if (disabled || option.disabled) return;
    emitChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    onClickProp?.(event);
    if (event.defaultPrevented) return;
    if (disabled) return;
    setOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen) {
        setActiveIndex(getIndexForValue(currentValue));
      }
      return nextOpen;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDownProp?.(event);
    if (event.defaultPrevented) return;
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const baseIndex = open ? activeIndex : getIndexForValue(currentValue);
      setOpen(true);
      setActiveIndex(Math.min(baseIndex + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const baseIndex = open ? activeIndex : getIndexForValue(currentValue);
      setOpen(true);
      setActiveIndex(Math.max(baseIndex - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        const option = options[activeIndex];
        if (option) selectOption(option);
      } else {
        setOpen(true);
        setActiveIndex(getIndexForValue(currentValue));
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          baseButtonClasses,
          sizeButtonClasses[uiSize],
          variantButtonClasses[variant],
          disabled && "cursor-not-allowed opacity-70",
          buttonClassName
        )}
        {...props}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {selectedOption?.label ?? ""}
        </span>
        <span className="text-[10px] text-[color:var(--text-secondary)]">▾</span>
      </button>
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      {open ? (
        <div ref={listRef} role="listbox" id={listboxId} className={dropdownClasses}>
          {options.map((option, index) => {
            const isSelected = option.value === currentValue;
            const isActive = index === activeIndex;
            return (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-index={index}
                disabled={option.disabled}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center rounded-[12px] text-left transition-colors",
                  sizeOptionClasses[uiSize],
                  isSelected && "bg-[color:var(--glass-hover-bg)]",
                  isActive && !isSelected && "bg-[color:var(--glass-hover-bg)]",
                  option.disabled
                    ? "cursor-not-allowed text-[color:var(--text-secondary)]"
                    : "text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]",
                  optionClassName
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
