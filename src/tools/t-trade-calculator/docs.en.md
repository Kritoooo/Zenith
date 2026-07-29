# T Trade Calculator

Intraday "T trade" math for the sell-first, buy-back-later direction. Enter the shares sold and the sell price to get the break-even buy-back price, plus the price needed to hit a target return or a target profit.

## Features
- Net proceeds and a fee breakdown using default A-share rates
- Sold shares are limited to multiples of 100 (one lot) in this first version
- Break-even price plus 0.3% / 0.5% / 1% / 1.5% / 2% / 3% targets
- Custom target by return rate or by amount
- Commission rate, minimum commission, stamp duty, transfer fee, and price tick are all editable and stored locally

## Steps
1. Enter the shares sold and the sell price; the sold shares must be a multiple of 100.
2. Adjust the fee settings if your broker differs; settings are saved in the browser.
3. Read the buy-back price, required drop, buy cost, net P&L, and actual return per target.
4. Use the custom row for any other target, either as a percentage or an amount.

## How it works
- Sell fees = max(sell amount × commission rate, minimum commission) + sell amount × stamp duty + sell amount × transfer fee
- Net proceeds = sell amount − sell fees
- Buy cost = buy amount + max(buy amount × commission rate, minimum commission) + buy amount × transfer fee
- Net P&L = net proceeds − buy cost
- Return = net P&L ÷ sell amount
- Target prices are solved from `buy cost = net proceeds − target P&L`, then rounded down to the price tick so the realised P&L meets or beats the target. The small text shows the exact, unrounded solution.

## Default rates (A-share)
| Item | Default | Charged on |
| --- | --- | --- |
| Commission | 0.025%, min 5 CNY per order | Buy + sell |
| Stamp duty | 0.05% | Sell only |
| Transfer fee | 0.001% | Buy + sell |
| Price tick | 0.01 CNY | — |

## Notes
- Defaults reflect common retail terms; your broker agreement is the source of truth. Exchange and regulatory fees are usually bundled into the commission — raise the commission rate if yours are billed separately.
- Exchange-traded funds pay no stamp duty (set it to 0) and normally tick at 0.001 CNY.
- Daily price limits are not modelled. A target needing a larger drop than the limit (10% main board, 20% ChiNext/STAR, 30% BSE) cannot fill that day.
- This first version requires the sold shares to be a multiple of 100 and calculates the buy-back for the same quantity; market-specific order-size rules such as STAR Market increments are not modelled separately.
- Results are theoretical and exclude dividends, margin interest, partial fills, and sub-cent rounding. Not investment advice.
