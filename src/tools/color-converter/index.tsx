"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

const PRESETS = [
  { name: "Coral", hex: "#FF6B6B" },
  { name: "Sky", hex: "#4DA3FF" },
  { name: "Mint", hex: "#34C759" },
  { name: "Amber", hex: "#FF9500" },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;

const formatRgbInput = ({ r, g, b }: Rgb) => `${r}, ${g}, ${b}`;
const formatRgbCopy = ({ r, g, b }: Rgb) => `rgb(${r}, ${g}, ${b})`;

const formatHslInput = ({ h, s, l }: Hsl) => `${h}, ${s}%, ${l}%`;
const formatHslCopy = ({ h, s, l }: Hsl) => `hsl(${h}, ${s}%, ${l}%)`;

const parseHex = (value: string): Rgb | null => {
  const cleaned = value.trim().replace(/^#/, "");
  if (cleaned.length !== 3 && cleaned.length !== 6) return null;
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) return null;
  const hex =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : cleaned;
  const int = Number.parseInt(hex, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const parseRgb = (value: string): Rgb | null => {
  const matches = value.match(/-?\d+(\.\d+)?/g);
  if (!matches || matches.length < 3) return null;
  const [r, g, b] = matches.slice(0, 3).map(Number);
  if ([r, g, b].some((part) => Number.isNaN(part))) return null;
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) return null;
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
};

const parseHsl = (value: string): Hsl | null => {
  const matches = value.match(/-?\d+(\.\d+)?/g);
  if (!matches || matches.length < 3) return null;
  const [hRaw, sRaw, lRaw] = matches.slice(0, 3).map(Number);
  if ([hRaw, sRaw, lRaw].some((part) => Number.isNaN(part))) return null;
  if (sRaw < 0 || sRaw > 100 || lRaw < 0 || lRaw > 100) return null;
  const hue = ((hRaw % 360) + 360) % 360;
  return { h: Math.round(hue), s: Math.round(sRaw), l: Math.round(lRaw) };
};

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      hue = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      hue = (bNorm - rNorm) / delta + 2;
    } else {
      hue = (rNorm - gNorm) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
};

const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = (h % 360) / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (huePrime >= 0 && huePrime < 1) {
    r1 = chroma;
    g1 = x;
  } else if (huePrime >= 1 && huePrime < 2) {
    r1 = x;
    g1 = chroma;
  } else if (huePrime >= 2 && huePrime < 3) {
    g1 = chroma;
    b1 = x;
  } else if (huePrime >= 3 && huePrime < 4) {
    g1 = x;
    b1 = chroma;
  } else if (huePrime >= 4 && huePrime < 5) {
    r1 = x;
    b1 = chroma;
  } else {
    r1 = chroma;
    b1 = x;
  }
  const match = lightness - chroma / 2;
  return {
    r: Math.round((r1 + match) * 255),
    g: Math.round((g1 + match) * 255),
    b: Math.round((b1 + match) * 255),
  };
};

type InputRowProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onCopy: () => void;
};

function InputRow({
  label,
  value,
  placeholder,
  onChange,
  onCopy,
}: InputRowProps) {
  return (
    <div className="rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          {label}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1 text-[11px] text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
        >
          Copy
        </button>
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        placeholder={placeholder}
        className="mt-3 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
      />
    </div>
  );
}

const initialRgb: Rgb = { r: 255, g: 107, b: 107 };

export default function ColorConverterTool() {
  const [rgb, setRgb] = useState<Rgb>(initialRgb);
  const [hexInput, setHexInput] = useState(() => formatHex(initialRgb));
  const [rgbInput, setRgbInput] = useState(() => formatRgbInput(initialRgb));
  const [hslInput, setHslInput] = useState(() =>
    formatHslInput(rgbToHsl(initialRgb))
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const syncFromRgb = (nextRgb: Rgb) => {
    const nextHsl = rgbToHsl(nextRgb);
    setRgb(nextRgb);
    setHexInput(formatHex(nextRgb));
    setRgbInput(formatRgbInput(nextRgb));
    setHslInput(formatHslInput(nextHsl));
  };

  const setStatus = (message: string | null) => {
    setError(message);
    if (message) setCopied(null);
  };

  const handleHexChange = (value: string) => {
    setHexInput(value);
    setCopied(null);
    const cleaned = value.trim();
    if (!cleaned) {
      setStatus(null);
      return;
    }
    const parsed = parseHex(cleaned);
    if (!parsed) {
      if (cleaned.replace(/^#/, "").length < 3) {
        setStatus(null);
        return;
      }
      setStatus("Invalid hex value.");
      return;
    }
    setStatus(null);
    syncFromRgb(parsed);
  };

  const handleRgbChange = (value: string) => {
    setRgbInput(value);
    setCopied(null);
    const cleaned = value.trim();
    if (!cleaned) {
      setStatus(null);
      return;
    }
    const parsed = parseRgb(cleaned);
    if (!parsed) {
      setStatus("Invalid RGB value.");
      return;
    }
    setStatus(null);
    syncFromRgb(parsed);
  };

  const handleHslChange = (value: string) => {
    setHslInput(value);
    setCopied(null);
    const cleaned = value.trim();
    if (!cleaned) {
      setStatus(null);
      return;
    }
    const parsed = parseHsl(cleaned);
    if (!parsed) {
      setStatus("Invalid HSL value.");
      return;
    }
    setStatus(null);
    syncFromRgb(hslToRgb(parsed));
  };

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setError(null);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setError("Clipboard unavailable. Copy manually.");
    }
  };

  const applyPreset = (hex: string) => {
    const parsed = parseHex(hex);
    if (!parsed) return;
    setStatus(null);
    setCopied(null);
    syncFromRgb(parsed);
  };

  const randomize = () => {
    const nextRgb = {
      r: Math.floor(Math.random() * 256),
      g: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256),
    };
    setStatus(null);
    setCopied(null);
    syncFromRgb(nextRgb);
  };

  const previewColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const hsl = rgbToHsl(rgb);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset.hex)}
              className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1 text-xs text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
            >
              {preset.name}
            </button>
          ))}
          <button
            type="button"
            onClick={randomize}
            className="rounded-full bg-[color:var(--accent-orange)] px-3 py-1 text-xs font-semibold text-white shadow-[0_12px_24px_-14px_rgba(255,149,0,0.6)]"
          >
            Random
          </button>
        </div>
        <p
          className={cn(
            "text-xs",
            error
              ? "text-rose-500/80"
              : "text-[color:var(--text-secondary)]"
          )}
          aria-live="polite"
        >
          {error ?? (copied ? `Copied ${copied}.` : "Paste or type a color.")}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-col gap-4">
          <InputRow
            label="Hex"
            value={hexInput}
            placeholder="#FF6B6B"
            onChange={handleHexChange}
            onCopy={() => copyValue("Hex", formatHex(rgb))}
          />
          <InputRow
            label="RGB"
            value={rgbInput}
            placeholder="255, 107, 107"
            onChange={handleRgbChange}
            onCopy={() => copyValue("RGB", formatRgbCopy(rgb))}
          />
          <InputRow
            label="HSL"
            value={hslInput}
            placeholder="0, 100%, 71%"
            onChange={handleHslChange}
            onCopy={() => copyValue("HSL", formatHslCopy(hsl))}
          />
        </div>
        <div className="flex min-h-[240px] flex-1 flex-col justify-between rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5 shadow-[var(--glass-shadow)] lg:max-w-[260px]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Preview
            </p>
            <span className="text-xs text-[color:var(--text-secondary)]">
              {formatHex(rgb)}
            </span>
          </div>
          <div className="mt-4 flex flex-1 items-center justify-center">
            <div
              className="h-28 w-28 rounded-[26px] shadow-[0_18px_30px_-18px_rgba(0,0,0,0.6)]"
              style={{ backgroundColor: previewColor }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-[color:var(--text-secondary)]">
            <div className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2 py-1 text-center">
              R {rgb.r}
            </div>
            <div className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2 py-1 text-center">
              G {rgb.g}
            </div>
            <div className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2 py-1 text-center">
              B {rgb.b}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
