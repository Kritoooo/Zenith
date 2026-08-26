"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, SecondaryButton } from "@/components/Button";
import { ToolInputInset } from "@/components/ToolInputInset";
import { ToolPanel } from "@/components/ToolPanel";
import { cn } from "@/lib/cn";
import { useClipboard } from "@/lib/useClipboard";
import {
  A_SHARE_FEES,
  computeBuy,
  computeSell,
  decimalsForTick,
  evaluateBuyFirstTarget,
  evaluateSellFirstTarget,
  type FeeConfig,
  type TargetOutcome,
  type TradeDirection,
} from "./calc";

const STORAGE_KEY = "zenith.t-trade-calculator.fees";

/** Preset expected returns, measured against the first-leg gross amount. */
const PRESET_RATES = [0, 0.003, 0.005, 0.01, 0.015, 0.02, 0.03];

const LOT_SIZE = 100;

const DECIMAL_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;

type CustomMode = "rate" | "amount";

type NumericIssue = "invalidNumber" | "nonNegative" | "positive";

/** Fee settings are kept as strings so partial input ("0.", "") stays editable. */
type FeeInputs = {
  commissionRate: string;
  commissionMin: string;
  stampDutyRate: string;
  transferFeeRate: string;
  tickSize: string;
};

const toPercentText = (rate: number) => String(Number((rate * 100).toFixed(6)));

const DEFAULT_FEE_INPUTS: FeeInputs = {
  commissionRate: toPercentText(A_SHARE_FEES.commissionRate),
  commissionMin: String(A_SHARE_FEES.commissionMin),
  stampDutyRate: toPercentText(A_SHARE_FEES.stampDutyRate),
  transferFeeRate: toPercentText(A_SHARE_FEES.transferFeeRate),
  tickSize: String(A_SHARE_FEES.tickSize),
};

const parseDecimal = (value: string) => {
  const normalized = value.trim();
  if (!normalized || !DECIMAL_PATTERN.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const validateDecimal = (
  value: string,
  requirement: "nonNegative" | "positive"
): { value: number | null; issue: NumericIssue | null } => {
  const parsed = parseDecimal(value);
  if (parsed === null) return { value: null, issue: "invalidNumber" };
  if (requirement === "positive" && parsed <= 0) {
    return { value: parsed, issue: "positive" };
  }
  if (requirement === "nonNegative" && parsed < 0) {
    return { value: parsed, issue: "nonNegative" };
  }
  return { value: parsed, issue: null };
};

const group = (text: string) => {
  const [intPart, fracPart] = text.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${fracPart ? `.${fracPart}` : ""}`;
};

const formatMoney = (value: number) =>
  Number.isFinite(value) ? group(value.toFixed(2)) : "—";

const formatSigned = (value: number) =>
  Number.isFinite(value)
    ? `${value > 0 ? "+" : ""}${group(value.toFixed(2))}`
    : "—";

const formatPercent = (value: number, digits = 2) =>
  Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "—";

const formatPrice = (value: number, decimals: number) =>
  Number.isFinite(value) ? value.toFixed(decimals) : "—";

/** Per-share price move, signed so a required rise reads as "+". */
const formatSignedPrice = (value: number, decimals: number) =>
  Number.isFinite(value)
    ? `${value > 0 ? "+" : ""}${value.toFixed(decimals)}`
    : "—";

const GRID_CLASS =
  "grid grid-cols-[minmax(92px,1fr)_minmax(100px,1.1fr)_minmax(92px,1fr)_minmax(108px,1.2fr)_minmax(96px,1fr)_minmax(92px,1fr)] items-center gap-2";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  suffix?: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
};

function Field({
  label,
  value,
  onChange,
  error,
  hint,
  suffix,
  placeholder,
  inputMode = "decimal",
}: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2 text-xs text-[color:var(--text-secondary)]">
        <span>{label}</span>
        {hint ? <span className="text-[11px] opacity-75">{hint}</span> : null}
      </span>
      <span className="relative flex items-center">
        <ToolInputInset
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          className={cn(
            "text-sm",
            suffix ? "pr-10" : undefined,
            error ? "border-rose-500/60 focus:border-rose-500" : undefined
          )}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 text-xs text-[color:var(--text-secondary)]">
            {suffix}
          </span>
        ) : null}
      </span>
      {error ? (
        <span className="text-[11px] text-rose-500" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2">
      <p className="text-[11px] text-[color:var(--text-secondary)]">{label}</p>
      <p
        className="mt-1 truncate text-sm font-semibold text-[color:var(--text-primary)]"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

export default function TTradeCalculatorTool() {
  const t = useTranslations("tools.t-trade-calculator.ui");
  const [direction, setDirection] = useState<TradeDirection>("sell-first");
  const [sharesInput, setSharesInput] = useState("1000");
  const [firstPriceInput, setFirstPriceInput] = useState("10.00");
  const [feeInputs, setFeeInputs] = useState<FeeInputs>(DEFAULT_FEE_INPUTS);
  const [customMode, setCustomMode] = useState<CustomMode>("rate");
  const [customValue, setCustomValue] = useState("0.8");
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useClipboard({
    onError: () => setError(t("errors.clipboard")),
  });

  const parsedShares = parseDecimal(sharesInput);
  const sharesError =
    parsedShares === null
      ? t("errors.invalidNumber")
      : parsedShares <= 0
        ? t("errors.sharesPositive")
        : !Number.isInteger(parsedShares)
          ? t("errors.sharesInteger")
          : parsedShares % LOT_SIZE !== 0
            ? t("errors.sharesLot")
            : undefined;
  const firstPriceValidation = validateDecimal(firstPriceInput, "positive");

  const feeValidations = {
    commissionRate: validateDecimal(feeInputs.commissionRate, "nonNegative"),
    commissionMin: validateDecimal(feeInputs.commissionMin, "nonNegative"),
    stampDutyRate: validateDecimal(feeInputs.stampDutyRate, "nonNegative"),
    transferFeeRate: validateDecimal(feeInputs.transferFeeRate, "nonNegative"),
    tickSize: validateDecimal(feeInputs.tickSize, "positive"),
  };
  const feeErrors = {
    commissionRate: feeValidations.commissionRate.issue
      ? t(`errors.${feeValidations.commissionRate.issue}`)
      : undefined,
    commissionMin: feeValidations.commissionMin.issue
      ? t(`errors.${feeValidations.commissionMin.issue}`)
      : undefined,
    stampDutyRate: feeValidations.stampDutyRate.issue
      ? t(`errors.${feeValidations.stampDutyRate.issue}`)
      : undefined,
    transferFeeRate: feeValidations.transferFeeRate.issue
      ? t(`errors.${feeValidations.transferFeeRate.issue}`)
      : undefined,
    tickSize: feeValidations.tickSize.issue
      ? t(`errors.${feeValidations.tickSize.issue}`)
      : undefined,
  };
  const customValidation = validateDecimal(customValue, "nonNegative");
  const customError = customValidation.issue
    ? t(`errors.${customValidation.issue}`)
    : undefined;
  const firstPriceError = firstPriceValidation.issue
    ? t(`errors.${firstPriceValidation.issue}`)
    : undefined;
  const coreInputErrors = [
    sharesError,
    firstPriceError,
    ...Object.values(feeErrors),
  ];
  const hasCoreInputError = coreInputErrors.some(Boolean);
  const hasAnyInputError = hasCoreInputError || Boolean(customError);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        setFeeInputs((prev) => {
          const next = { ...prev };
          (Object.keys(DEFAULT_FEE_INPUTS) as (keyof FeeInputs)[]).forEach((key) => {
            const value = parsed[key];
            if (typeof value === "string") next[key] = value;
          });
          return next;
        });
      }
    } catch {
      setFeeInputs(DEFAULT_FEE_INPUTS);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(feeInputs));
    } catch {
      // Storage may be unavailable (private mode); settings simply stay per-session.
    }
  }, [feeInputs, hydrated]);

  const fees: FeeConfig = useMemo(
    () => ({
      commissionRate: (feeValidations.commissionRate.value ?? 0) / 100,
      commissionMin: feeValidations.commissionMin.value ?? 0,
      stampDutyRate: (feeValidations.stampDutyRate.value ?? 0) / 100,
      transferFeeRate: (feeValidations.transferFeeRate.value ?? 0) / 100,
      tickSize: feeValidations.tickSize.value ?? 0,
    }),
    [
      feeValidations.commissionMin.value,
      feeValidations.commissionRate.value,
      feeValidations.stampDutyRate.value,
      feeValidations.tickSize.value,
      feeValidations.transferFeeRate.value,
    ]
  );

  const shares = parsedShares ?? 0;
  const firstPrice = firstPriceValidation.value ?? 0;
  const isReady = !hasCoreInputError && shares > 0 && firstPrice > 0;
  const priceDecimals = decimalsForTick(fees.tickSize);

  const firstTrade = useMemo(
    () =>
      direction === "sell-first"
        ? { side: "sell" as const, breakdown: computeSell(shares, firstPrice, fees) }
        : { side: "buy" as const, breakdown: computeBuy(shares, firstPrice, fees) },
    [direction, fees, firstPrice, shares]
  );
  const firstGross = firstTrade.breakdown.gross;
  const firstCashAmount =
    firstTrade.side === "sell" ? firstTrade.breakdown.net : firstTrade.breakdown.total;

  const customProfit = useMemo(() => {
    const raw = customValidation.value;
    if (raw === null || customError) return null;
    return customMode === "rate" ? (firstGross * raw) / 100 : raw;
  }, [customError, customMode, customValidation.value, firstGross]);

  const rows = useMemo(() => {
    const evaluate = (key: string, targetProfit: number) =>
      firstTrade.side === "sell"
        ? evaluateSellFirstTarget(
            key,
            targetProfit,
            shares,
            firstPrice,
            firstTrade.breakdown,
            fees
          )
        : evaluateBuyFirstTarget(
            key,
            targetProfit,
            shares,
            firstPrice,
            firstTrade.breakdown,
            fees
          );
    const presets = PRESET_RATES.map((rate) =>
      evaluate(rate === 0 ? "breakEven" : `rate-${rate}`, firstGross * rate)
    );
    if (customProfit === null) return presets;
    return [...presets, evaluate("custom", customProfit)];
  }, [customProfit, fees, firstGross, firstPrice, firstTrade, shares]);

  const breakEven = rows[0];
  const sellFirst = direction === "sell-first";
  const directionLabel = t(sellFirst ? "actions.sellFirst" : "actions.buyFirst");
  const firstSectionLabel = t(
    sellFirst ? "labels.sellSection" : "labels.buySection"
  );
  const firstPriceLabel = t(sellFirst ? "labels.sellPrice" : "labels.buyPrice");
  const firstAmountLabel = t(
    sellFirst ? "labels.sellAmount" : "labels.buyAmount"
  );
  const firstCashLabel = t(
    sellFirst ? "labels.netProceeds" : "labels.totalCost"
  );
  const summaryLabel = t(
    sellFirst ? "labels.sellSummary" : "labels.buySummary"
  );
  const breakEvenLabel = t(
    sellFirst ? "labels.breakEvenBuyPrice" : "labels.breakEvenSellPrice"
  );
  const targetsLabel = t(
    sellFirst ? "labels.buyTargets" : "labels.sellTargets"
  );
  const targetPriceLabel = t(
    sellFirst ? "labels.targetBuyPrice" : "labels.targetSellPrice"
  );
  const moveLabel = t(sellFirst ? "labels.drop" : "labels.rise");
  const secondCashLabel = t(
    sellFirst ? "labels.buyCost" : "labels.sellNetProceeds"
  );
  const basisNote = t(
    sellFirst ? "labels.basisSellFirst" : "labels.basisBuyFirst"
  );
  const roundingNote = t(
    sellFirst ? "labels.roundingSellFirst" : "labels.roundingBuyFirst"
  );

  const rowLabel = (row: TargetOutcome, index: number) => {
    if (row.key === "custom") {
      const raw = customValidation.value ?? 0;
      const detail =
        customMode === "rate"
          ? formatPercent(raw / 100)
          : `${formatMoney(raw)} ${t("units.currency")}`;
      return `${t("labels.custom")} ${detail}`;
    }
    if (row.key === "breakEven") return t("labels.breakEven");
    return formatPercent(PRESET_RATES[index]);
  };

  const resetFees = () => {
    setFeeInputs(DEFAULT_FEE_INPUTS);
    setError(null);
  };

  const updateShares = (value: string) => {
    setSharesInput(value);
    setError(null);
  };

  const updateFirstPrice = (value: string) => {
    setFirstPriceInput(value);
    setError(null);
  };

  const updateDirection = (value: TradeDirection) => {
    setDirection(value);
    setError(null);
  };

  const updateFeeInput = (key: keyof FeeInputs, value: string) => {
    setFeeInputs((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const updateCustomValue = (value: string) => {
    setCustomValue(value);
    setError(null);
  };

  const copySummary = async () => {
    if (!isReady || hasAnyInputError) {
      setError(null);
      return;
    }
    setError(null);
    const header = [
      `${t("labels.direction")}: ${directionLabel}`,
      `${t("labels.shares")}: ${shares}`,
      `${firstPriceLabel}: ${formatPrice(firstPrice, priceDecimals)}`,
      `${firstAmountLabel}: ${formatMoney(firstGross)}`,
      `${t("labels.totalFee")}: ${formatMoney(firstTrade.breakdown.totalFee)}`,
      `${firstCashLabel}: ${formatMoney(firstCashAmount)}`,
    ].join("\n");
    const table = rows
      .map((row, index) =>
        [
          rowLabel(row, index),
          `${targetPriceLabel} ${formatPrice(row.price, priceDecimals)}`,
          `${moveLabel} ${formatPercent(row.moveRate)}`,
          `${t("labels.profit")} ${formatSigned(row.profit)}`,
        ].join(" | ")
      )
      .join("\n");
    await copy(`${header}\n\n${table}`);
  };

  const status = error
    ? error
    : hasAnyInputError
      ? t("status.fixInput")
      : copied
        ? t("status.copied")
        : isReady
          ? t("status.ready")
          : t("status.needInput");

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[color:var(--text-secondary)]">
            {t("labels.direction")}
          </span>
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={t("labels.direction")}
          >
            <Button
              size="sm"
              variant={sellFirst ? "primary" : "secondary"}
              aria-pressed={sellFirst}
              onClick={() => updateDirection("sell-first")}
            >
              {t("actions.sellFirst")}
            </Button>
            <Button
              size="sm"
              variant={sellFirst ? "secondary" : "primary"}
              aria-pressed={!sellFirst}
              onClick={() => updateDirection("buy-first")}
            >
              {t("actions.buyFirst")}
            </Button>
          </div>
          <span className="text-xs text-[color:var(--text-secondary)]">
            {basisNote}
          </span>
        </div>
        <p
          className={cn(
            "text-xs",
            error || hasAnyInputError
              ? "text-rose-500/80"
              : "text-[color:var(--text-secondary)]"
          )}
          aria-live="polite"
        >
          {status}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex w-full flex-col gap-4 lg:max-w-[300px]">
          <ToolPanel title={firstSectionLabel} className="flex-none">
            <div className="mt-3 flex flex-col gap-3">
              <Field
                label={t("labels.shares")}
                value={sharesInput}
                onChange={updateShares}
                error={sharesError}
                suffix={t("units.shares")}
                placeholder="1000"
                inputMode="numeric"
                hint={
                  isReady
                    ? t("labels.lots", {
                        count: String(Number((shares / LOT_SIZE).toFixed(2))),
                      })
                    : undefined
                }
              />
              <Field
                label={firstPriceLabel}
                value={firstPriceInput}
                onChange={updateFirstPrice}
                error={firstPriceError}
                suffix={t("units.currency")}
                placeholder="10.00"
              />
            </div>
          </ToolPanel>

          <ToolPanel
            title={t("labels.feeSection")}
            headerClassName="flex items-center justify-between"
            actions={
              <SecondaryButton size="sm" onClick={resetFees}>
                {t("actions.reset")}
              </SecondaryButton>
            }
            className="flex-none"
          >
            <div className="mt-3 flex flex-col gap-3">
              <Field
                label={t("labels.commissionRate")}
                value={feeInputs.commissionRate}
                onChange={(value) => updateFeeInput("commissionRate", value)}
                error={feeErrors.commissionRate}
                suffix="%"
                hint={
                  feeErrors.commissionRate
                    ? undefined
                    : t("labels.bps", {
                        value: String(
                          Number(
                            ((feeValidations.commissionRate.value ?? 0) * 100).toFixed(
                              4
                            )
                          )
                        ),
                      })
                }
              />
              <Field
                label={t("labels.commissionMin")}
                value={feeInputs.commissionMin}
                onChange={(value) => updateFeeInput("commissionMin", value)}
                error={feeErrors.commissionMin}
                suffix={t("units.currency")}
              />
              <Field
                label={t("labels.stampDuty")}
                value={feeInputs.stampDutyRate}
                onChange={(value) => updateFeeInput("stampDutyRate", value)}
                error={feeErrors.stampDutyRate}
                suffix="%"
              />
              <Field
                label={t("labels.transferFee")}
                value={feeInputs.transferFeeRate}
                onChange={(value) => updateFeeInput("transferFeeRate", value)}
                error={feeErrors.transferFeeRate}
                suffix="%"
              />
              <Field
                label={t("labels.tickSize")}
                value={feeInputs.tickSize}
                onChange={(value) => updateFeeInput("tickSize", value)}
                error={feeErrors.tickSize}
                suffix={t("units.currency")}
              />
            </div>
          </ToolPanel>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <ToolPanel title={summaryLabel} className="flex-none">
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label={firstAmountLabel}
                value={isReady ? formatMoney(firstGross) : "—"}
              />
              <Stat
                label={t("labels.totalFee")}
                value={isReady ? formatMoney(firstTrade.breakdown.totalFee) : "—"}
              />
              <Stat
                label={firstCashLabel}
                value={isReady ? formatMoney(firstCashAmount) : "—"}
              />
              <Stat
                label={breakEvenLabel}
                value={
                  isReady && breakEven?.reachable
                    ? formatPrice(breakEven.price, priceDecimals)
                    : "—"
                }
                accent="var(--accent-blue)"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--text-secondary)]">
              <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1">
                {t("labels.commission")}{" "}
                {isReady ? formatMoney(firstTrade.breakdown.commission) : "—"}
              </span>
              {firstTrade.side === "sell" ? (
                <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1">
                  {t("labels.stampDutyShort")}{" "}
                  {isReady ? formatMoney(firstTrade.breakdown.stampDuty) : "—"}
                </span>
              ) : null}
              <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1">
                {t("labels.transferFeeShort")}{" "}
                {isReady ? formatMoney(firstTrade.breakdown.transferFee) : "—"}
              </span>
            </div>
          </ToolPanel>

          <ToolPanel
            title={targetsLabel}
            headerClassName="flex items-center justify-between"
            actions={
              <SecondaryButton size="sm" onClick={copySummary}>
                {t("actions.copy")}
              </SecondaryButton>
            }
          >
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[color:var(--text-secondary)]">
                {t("labels.custom")}
              </span>
              <div
                className="flex items-center gap-1"
                role="group"
                aria-label={t("labels.custom")}
              >
                <Button
                  size="sm"
                  variant={customMode === "rate" ? "primary" : "secondary"}
                  aria-pressed={customMode === "rate"}
                  onClick={() => setCustomMode("rate")}
                >
                  {t("actions.modeRate")}
                </Button>
                <Button
                  size="sm"
                  variant={customMode === "amount" ? "primary" : "secondary"}
                  aria-pressed={customMode === "amount"}
                  onClick={() => setCustomMode("amount")}
                >
                  {t("actions.modeAmount")}
                </Button>
              </div>
              <span className="w-24">
                <ToolInputInset
                  value={customValue}
                  onChange={(event) => updateCustomValue(event.target.value)}
                  inputMode="decimal"
                  spellCheck={false}
                  aria-label={t("labels.custom")}
                  aria-invalid={customError ? true : undefined}
                  className={cn(
                    "text-sm",
                    customError ? "border-rose-500/60 focus:border-rose-500" : undefined
                  )}
                />
              </span>
              <span className="text-xs text-[color:var(--text-secondary)]">
                {customMode === "rate" ? "%" : t("units.currency")}
              </span>
              {customError ? (
                <span className="w-full text-[11px] text-rose-500" role="alert">
                  {customError}
                </span>
              ) : null}
            </div>

            <div className="mt-3 overflow-x-auto">
              <div className="flex min-w-[640px] flex-col gap-1">
                <div
                  className={cn(
                    GRID_CLASS,
                    "px-3 pb-1 text-[11px] uppercase tracking-wide text-[color:var(--text-secondary)]"
                  )}
                >
                  <span>{t("labels.target")}</span>
                  <span>{targetPriceLabel}</span>
                  <span>{moveLabel}</span>
                  <span>{secondCashLabel}</span>
                  <span>{t("labels.profit")}</span>
                  <span>{t("labels.profitRate")}</span>
                </div>
                {rows.map((row, index) => {
                  const positive = row.reachable && row.profit >= 0;
                  return (
                    <div
                      key={row.key}
                      className={cn(
                        GRID_CLASS,
                        "rounded-[12px] border px-3 py-2 text-sm",
                        row.key === "custom"
                          ? "border-[color:var(--accent-blue)]/35 bg-[color:var(--accent-blue)]/5"
                          : "border-transparent bg-[color:var(--glass-recessed-bg)]"
                      )}
                    >
                      <span className="text-xs font-semibold text-[color:var(--text-primary)]">
                        {rowLabel(row, index)}
                      </span>
                      <span className="flex flex-col">
                        <span className="font-semibold text-[color:var(--text-primary)]">
                          {isReady && row.reachable
                            ? formatPrice(row.price, priceDecimals)
                            : "—"}
                        </span>
                        {isReady && row.reachable ? (
                          <span className="text-[10px] text-[color:var(--text-secondary)]">
                            {formatPrice(row.exactPrice, priceDecimals + 2)}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-[color:var(--text-primary)]">
                          {isReady && row.reachable ? formatPercent(row.moveRate) : "—"}
                        </span>
                        {isReady && row.reachable ? (
                          <span className="text-[10px] text-[color:var(--text-secondary)]">
                            {formatSignedPrice(
                              sellFirst ? -row.move : row.move,
                              priceDecimals + 2
                            )}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[color:var(--text-primary)]">
                        {isReady && row.reachable
                          ? formatMoney(
                              row.direction === "sell-first"
                                ? row.buy.total
                                : row.sell.net
                            )
                          : "—"}
                      </span>
                      <span
                        className={cn(
                          "font-semibold",
                          isReady && row.reachable
                            ? positive
                              ? "text-[color:var(--accent-green)]"
                              : "text-rose-500"
                            : "text-[color:var(--text-secondary)]"
                        )}
                      >
                        {isReady && row.reachable ? formatSigned(row.profit) : "—"}
                      </span>
                      <span className="text-[color:var(--text-primary)]">
                        {isReady && row.reachable ? formatPercent(row.profitRate) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[color:var(--text-secondary)]">
              {roundingNote}
            </p>
          </ToolPanel>
        </div>
      </div>
    </div>
  );
}
