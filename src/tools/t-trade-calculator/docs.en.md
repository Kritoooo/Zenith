# T Trade Calculator

Supports both intraday T-trade sequences for A-shares: sell then buy, or buy then sell. Enter the first-leg share count and execution price to see the break-even price and the second-leg price needed for a target return or target profit.

## Features

- Switch between sell-then-buy and buy-then-sell, with inputs and results adapting to the selected sequence
- First-leg gross amount, fees, and settled cash using default A-share rates
- Shares are limited to multiples of 100 (one lot), with the same quantity used for the second leg
- Break-even plus 0.3% / 0.5% / 1% / 1.5% / 2% / 3% target prices
- Custom target by return rate or by amount
- Commission rate, minimum commission, stamp duty, transfer fee, and price tick are editable and stored locally

## Steps

1. Select the trade sequence: sell then buy, or buy then sell.
2. Enter the first-leg share count and execution price; shares must be a multiple of 100.
3. Adjust the fee settings if your broker differs; settings are saved in the browser.
4. Read the second-leg price, required price move, settled amount, net P&L, and actual return for each target.
5. Use the custom row for any other target, either as a percentage or an amount.

## How it works

### Sell then buy

- Sell fees = max(sell amount × commission rate, minimum commission) + sell amount × stamp duty + sell amount × transfer fee
- Net sell proceeds = sell amount − sell fees
- Buy-back cost = buy amount + max(buy amount × commission rate, minimum commission) + buy amount × transfer fee
- Net P&L = net sell proceeds − buy-back cost
- The target buy-back price is solved from `buy-back cost = net sell proceeds − target P&L`, then rounded down to the price tick so realised P&L meets or beats the target

### Buy then sell

- Buy cost = buy amount + max(buy amount × commission rate, minimum commission) + buy amount × transfer fee
- Net sell proceeds = sell amount − max(sell amount × commission rate, minimum commission) − sell amount × stamp duty − sell amount × transfer fee
- Net P&L = net sell proceeds − buy cost
- The target sell price is solved from `net sell proceeds = buy cost + target P&L`, then rounded up to the price tick so realised P&L meets or beats the target

For both sequences, target return is `net P&L ÷ first-leg gross amount`. Small text in the result table shows the exact price before tick rounding.

## Default rates (A-share)

| Item | Default | Charged on |
| --- | --- | --- |
| Commission | 0.025%, min 5 CNY per order | Buy + sell |
| Stamp duty | 0.05% | Sell only |
| Transfer fee | 0.001% | Buy + sell |
| Price tick | 0.01 CNY | — |

## Notes

- A-shares bought today generally cannot be sold until the next trading day. Buy-then-sell therefore requires an existing sellable position in the same security. This calculator models cash P&L for equal quantities and does not validate available holdings.
- Defaults reflect common retail terms; your broker agreement is the source of truth. Exchange and regulatory fees are usually bundled into the commission — raise the commission rate if yours are billed separately.
- Exchange-traded funds pay no stamp duty (set it to 0) and normally tick at 0.001 CNY.
- Daily price limits are not modelled. A target move outside the applicable limit may not fill that day.
- Shares must be a multiple of 100; market-specific order-size rules such as STAR Market increments are not modelled separately.
- Results are theoretical and exclude dividends, margin interest, partial fills, and sub-cent rounding. Not investment advice.
