/**
 * Intraday "T trade" math for both trade sequences: sell then buy, or buy then
 * sell. Everything here is pure and unit-agnostic — rates are decimals
 * (0.00025 means 0.025%).
 */

export type TradeDirection = "sell-first" | "buy-first";

export type FeeConfig = {
  /** Broker commission, charged on both sides. */
  commissionRate: number;
  /** Minimum commission per side, in currency units. */
  commissionMin: number;
  /** Stamp duty, charged on the sell side only (A-share rule). */
  stampDutyRate: number;
  /** Transfer fee, charged on both sides. */
  transferFeeRate: number;
  /** Smallest price increment an order can use. */
  tickSize: number;
};

/** Default A-share retail rates. Every field stays user-editable in the UI. */
export const A_SHARE_FEES: FeeConfig = {
  commissionRate: 0.00025,
  commissionMin: 5,
  stampDutyRate: 0.0005,
  transferFeeRate: 0.00001,
  tickSize: 0.01,
};

export type SellBreakdown = {
  gross: number;
  commission: number;
  stampDuty: number;
  transferFee: number;
  totalFee: number;
  /** Cash actually received after fees. */
  net: number;
};

export type BuyBreakdown = {
  gross: number;
  commission: number;
  transferFee: number;
  totalFee: number;
  /** Cash actually spent including fees. */
  total: number;
};

type TargetOutcomeBase = {
  key: string;
  /** Profit the target asked for, in currency units. */
  targetProfit: number;
  /** Second-leg price that hits the target exactly. */
  exactPrice: number;
  /** `exactPrice` rounded toward the profitable side to a placeable tick. */
  price: number;
  reachable: boolean;
  /** Profit realised at `price`, not at `exactPrice`. */
  profit: number;
  profitRate: number;
  /** Required price move in the profitable direction, always positive. */
  move: number;
  moveRate: number;
};

export type SellFirstTargetOutcome = TargetOutcomeBase & {
  direction: "sell-first";
  buy: BuyBreakdown;
};

export type BuyFirstTargetOutcome = TargetOutcomeBase & {
  direction: "buy-first";
  sell: SellBreakdown;
};

export type TargetOutcome = SellFirstTargetOutcome | BuyFirstTargetOutcome;

const commissionFor = (amount: number, fees: FeeConfig) =>
  amount <= 0 ? 0 : Math.max(amount * fees.commissionRate, fees.commissionMin);

export function computeSell(
  shares: number,
  price: number,
  fees: FeeConfig
): SellBreakdown {
  const gross = shares * price;
  const commission = commissionFor(gross, fees);
  const stampDuty = gross * fees.stampDutyRate;
  const transferFee = gross * fees.transferFeeRate;
  const totalFee = commission + stampDuty + transferFee;
  return { gross, commission, stampDuty, transferFee, totalFee, net: gross - totalFee };
}

export function computeBuy(
  shares: number,
  price: number,
  fees: FeeConfig
): BuyBreakdown {
  const gross = shares * price;
  const commission = commissionFor(gross, fees);
  const transferFee = gross * fees.transferFeeRate;
  const totalFee = commission + transferFee;
  return { gross, commission, transferFee, totalFee, total: gross + totalFee };
}

/**
 * Invert `computeBuy`: find the price whose all-in buy cost equals `targetCost`.
 *
 * Total cost is piecewise linear in price — the commission switches from a rate
 * to a flat minimum below a threshold price — but it is continuous and strictly
 * increasing, so exactly one of the two branches holds.
 */
export function solveBuyPrice(
  targetCost: number,
  shares: number,
  fees: FeeConfig
): number {
  if (shares <= 0) return Number.NaN;

  const threshold =
    fees.commissionMin <= 0
      ? 0
      : fees.commissionRate > 0
        ? fees.commissionMin / (shares * fees.commissionRate)
        : Number.POSITIVE_INFINITY;

  const rateBranch =
    targetCost / (shares * (1 + fees.commissionRate + fees.transferFeeRate));
  if (rateBranch >= threshold) return rateBranch;

  return (targetCost - fees.commissionMin) / (shares * (1 + fees.transferFeeRate));
}

/**
 * Invert `computeSell`: find the price whose net sell proceeds equal `targetNet`.
 *
 * Net proceeds are piecewise linear because commission changes from a flat
 * minimum to a rate. A valid candidate must also fall inside its branch.
 */
export function solveSellPrice(
  targetNet: number,
  shares: number,
  fees: FeeConfig
): number {
  if (shares <= 0 || !Number.isFinite(targetNet)) return Number.NaN;

  const nonCommissionFactor = 1 - fees.stampDutyRate - fees.transferFeeRate;
  if (!(nonCommissionFactor > 0)) return Number.NaN;

  if (fees.commissionRate > 0) {
    const threshold = fees.commissionMin / (shares * fees.commissionRate);
    const rateFactor = nonCommissionFactor - fees.commissionRate;

    if (rateFactor > 0) {
      const rateBranch = targetNet / (shares * rateFactor);
      if (rateBranch >= threshold) return rateBranch;
    }

    const minimumBranch =
      (targetNet + fees.commissionMin) / (shares * nonCommissionFactor);
    if (minimumBranch <= threshold) return minimumBranch;

    return Number.NaN;
  }

  return (targetNet + fees.commissionMin) / (shares * nonCommissionFactor);
}

/** Round down to a placeable price so the realised profit meets or beats the target. */
export function floorToTick(price: number, tick: number): number {
  if (!Number.isFinite(price)) return price;
  if (!(tick > 0)) return price;
  return Math.floor(price / tick + 1e-9) * tick;
}

/** Round up to a placeable price so the realised profit meets or beats the target. */
export function ceilToTick(price: number, tick: number): number {
  if (!Number.isFinite(price)) return price;
  if (!(tick > 0)) return price;
  return Math.ceil(price / tick - 1e-9) * tick;
}

export function evaluateSellFirstTarget(
  key: string,
  targetProfit: number,
  shares: number,
  sellPrice: number,
  sell: SellBreakdown,
  fees: FeeConfig
): SellFirstTargetOutcome {
  const exactPrice = solveBuyPrice(sell.net - targetProfit, shares, fees);
  const price = floorToTick(exactPrice, fees.tickSize);
  const reachable = Number.isFinite(price) && price > 0;
  const buy = computeBuy(shares, reachable ? price : 0, fees);
  const profit = reachable ? sell.net - buy.total : Number.NaN;

  return {
    direction: "sell-first",
    key,
    targetProfit,
    exactPrice,
    price,
    reachable,
    buy,
    profit,
    profitRate: reachable && sell.gross > 0 ? profit / sell.gross : Number.NaN,
    move: reachable ? sellPrice - price : Number.NaN,
    moveRate:
      reachable && sellPrice > 0 ? (sellPrice - price) / sellPrice : Number.NaN,
  };
}

export function evaluateBuyFirstTarget(
  key: string,
  targetProfit: number,
  shares: number,
  buyPrice: number,
  buy: BuyBreakdown,
  fees: FeeConfig
): BuyFirstTargetOutcome {
  const exactPrice = solveSellPrice(buy.total + targetProfit, shares, fees);
  const price = ceilToTick(exactPrice, fees.tickSize);
  const reachable = Number.isFinite(price) && price > 0;
  const sell = computeSell(shares, reachable ? price : 0, fees);
  const profit = reachable ? sell.net - buy.total : Number.NaN;

  return {
    direction: "buy-first",
    key,
    targetProfit,
    exactPrice,
    price,
    reachable,
    sell,
    profit,
    profitRate: reachable && buy.gross > 0 ? profit / buy.gross : Number.NaN,
    move: reachable ? price - buyPrice : Number.NaN,
    moveRate:
      reachable && buyPrice > 0 ? (price - buyPrice) / buyPrice : Number.NaN,
  };
}

/** Decimal places implied by a tick size, e.g. 0.001 -> 3. */
export function decimalsForTick(tick: number): number {
  if (!(tick > 0)) return 3;
  const text = tick.toFixed(8).replace(/0+$/, "");
  const dot = text.indexOf(".");
  if (dot < 0) return 0;
  return Math.min(6, Math.max(2, text.length - dot - 1));
}
