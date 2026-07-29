/**
 * Intraday "T trade" math: sell part of an existing position first, then buy the
 * same amount back later in the day. Everything here is pure and unit-agnostic —
 * rates are decimals (0.00025 means 0.025%).
 */

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

export type TargetOutcome = {
  key: string;
  /** Profit the target asked for, in currency units. */
  targetProfit: number;
  /** Buy-back price that hits the target exactly. */
  exactPrice: number;
  /** `exactPrice` rounded down to a placeable tick, so profit is never short. */
  price: number;
  reachable: boolean;
  buy: BuyBreakdown;
  /** Profit realised at `price`, not at `exactPrice`. */
  profit: number;
  profitRate: number;
  drop: number;
  dropRate: number;
};

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

/** Round down to a placeable price so the realised profit meets or beats the target. */
export function floorToTick(price: number, tick: number): number {
  if (!Number.isFinite(price)) return price;
  if (!(tick > 0)) return price;
  return Math.floor(price / tick + 1e-9) * tick;
}

export function evaluateTarget(
  key: string,
  targetProfit: number,
  shares: number,
  sellPrice: number,
  sell: SellBreakdown,
  fees: FeeConfig
): TargetOutcome {
  const exactPrice = solveBuyPrice(sell.net - targetProfit, shares, fees);
  const price = floorToTick(exactPrice, fees.tickSize);
  const reachable = Number.isFinite(price) && price > 0;
  const buy = computeBuy(shares, reachable ? price : 0, fees);
  const profit = reachable ? sell.net - buy.total : Number.NaN;

  return {
    key,
    targetProfit,
    exactPrice,
    price,
    reachable,
    buy,
    profit,
    profitRate: reachable && sell.gross > 0 ? profit / sell.gross : Number.NaN,
    drop: reachable ? sellPrice - price : Number.NaN,
    dropRate: reachable && sellPrice > 0 ? (sellPrice - price) / sellPrice : Number.NaN,
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
