# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lugasprahara/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lugasprahara/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Ranks every pre-token DeFi protocol in the snapshot by the value a token launch would imply, prices it off a size curve fitted to the protocols that already trade and validated by a leave-one-out backtest, and writes a farm plan netted to the dollar for each one.

## Run it

```sh
node main.ts --input <snapshot.json | directory holding one>
```

`MAKEFUN_OUTPUT_DIR` (or `--output`) chooses where results land. The program
reads the sealed DefiLlama snapshot, scores every rankable pre-token protocol
it carries, and writes:

- `board.json` — the ranked board: all 289 rankable pre-token protocols on
  the 2026-11-14 snapshot, the 40-protocol watchlist included in full.
- `data.js` — the same board as a script the dashboard reads.
- `dashboard/` — a static page (no framework, no network) that renders the
  board: sortable, searchable, filterable by category, with a per-protocol
  detail view and the backtest the model had to pass.
- `screenshots/` — renders of that dashboard.
- `dossier.json` — the summary the bounty judge reads, built with the
  vendored make.fun library.

Node 22, TypeScript, standard library only, fully deterministic — the same
snapshot always produces the same board, byte for byte.

## The model (radar-3)

A flat market-cap/TVL multiple misprices size: across the snapshot's live
protocols, market cap grows sublinearly with TVL. radar-3 fits that size
curve instead:

```text
base value = exp(intercept + category offset + slope x log TVL)
implied    = base value x growth multiplier x maturity multiplier
```

- **Size curve** — ordinary least squares of log market cap on log TVL over
  the 119 live, non-exchange protocols with a cap and a TVL (slope 0.472 on
  the 2026-11-14 snapshot: a protocol ten times larger is worth about three
  times more, not ten times).
- **Category offset** — each category shifts the curve by the median of its
  live protocols' residuals, shrunk toward zero by sample size (k = 6), so a
  category resting on one or two live protocols borrows the market's curve
  instead of inventing its own.
- **Growth multiplier** — rewards protocols whose TVL is actually growing
  (7-day change), damped so a single hot week cannot double a valuation.
- **Maturity multiplier** — a protocol that has held serious TVL for a long
  time without a token is a different bet from a two-week-old one; age with
  no token adjusts the price accordingly.

Every row carries its own arithmetic — curve base, effective multiple at
its size, category offset and the sample behind it, both multipliers — plus
a one-sentence "why this rank", so any rank can be checked by hand against
the snapshot.

## The backtest

The estimator was chosen by leave-one-out validation over the live
protocols, not by taste: each live protocol is priced by a fit that never
saw it, and the error is measured against its real market cap.

| Estimator | Median \|log10 err\| | Mean \|log10 err\| | Within 2x |
| --- | --- | --- | --- |
| Size curve + category offset (radar-3) | 0.514 | 0.676 | 34.5% |
| Flat category multiple (radar-2) | 0.733 | 0.807 | 24.4% |

Each row's band is the central 68% of the winning backtest's signed errors
applied to that row's own value — the honest uncertainty the market's own
prices leave, printed instead of hidden. The run recomputes both scores on
whatever snapshot it is given and the dashboard publishes them.

## Farm plans, netted

Each protocol gets a plan of 6–8 concrete steps: wallet hygiene, the
qualifying deposits or actions on the chains the protocol actually runs on,
cadence to stay active, and the costs written next to each step. The plans
are generated from the row's own data — chains, category, TVL, age,
momentum — not pasted boilerplate. Every plan is also netted to the dollar:
the capital it locks (returned at the end, so named apart) and the net cost
— one-off gas plus the weekly cadence gas across the hold window — with a
verdict tier on the total.

## Layout

- `main.ts` — the entry point: parse, score, write the outputs and dossier.
- `lib/model.ts` — snapshot parsing, the radar-3 model, the backtest, the
  farm plans.
- `dashboard/` — the static board (`index.html`, `app.css`, `app.js`).
- `vendor/` — the make.fun dossier library, copied from the bounty kit
  unchanged.
- `screenshots/` — dashboard renders, first is the cover.

MIT licensed — see `LICENSE`.

---
<sub>Entered on [make.fun](https://make.fun/?ref=aes5np1n&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
