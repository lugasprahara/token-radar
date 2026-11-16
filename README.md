# Token Radar

Ranks pre-token DeFi protocols by the value a token launch would imply, and
writes a costed airdrop farm plan for each one. Built for make.fun's
token-radar-01 bounty: Node 22, TypeScript, standard library only, fully
deterministic — the same snapshot always produces the same board, byte for
byte.

## Run it

```sh
node main.ts --input <snapshot.json | directory holding one>
```

`MAKEFUN_OUTPUT_DIR` (or `--output`) chooses where results land. The program
reads the sealed DefiLlama snapshot, scores every pre-token protocol it
carries, and writes:

- `board.json` — the ranked board: all 40 watchlist protocols plus every
  other rankable pre-token protocol above the snapshot's floor (226 rows on
  the 2026-11-14 snapshot).
- `data.js` — the same board as a script the dashboard reads.
- `dashboard/` — a static page (no framework, no network) that renders the
  board: sortable, searchable, filterable by category, with a per-protocol
  detail view.
- `screenshots/` — renders of that dashboard.
- `dossier.json` — the summary the bounty judge reads, built with the
  vendored make.fun library.

## The model (radar-2)

A protocol's implied token value is its TVL priced the way the market
already prices live protocols **in the same category**:

```text
implied value = TVL x category multiple x growth multiplier x maturity multiplier
```

- **Category multiple** — the median market-cap/TVL of live-token protocols
  in the protocol's own category, computed from the snapshot itself (226
  protocols registered across categories; the global median is 0.223).
  Thin categories are shrunk toward that global median, so a multiple
  resting on one or two live protocols cannot dominate a ranking.
- **Growth multiplier** — rewards protocols whose TVL is actually growing
  (7-day change), damped so a single hot week cannot double a valuation.
- **Maturity multiplier** — a protocol that has held serious TVL for a long
  time without a token is a different bet from a two-week-old one; age with
  no token adjusts the price accordingly.

Every row of the board carries its own arithmetic — TVL, the multiple it
used, both multipliers — so any rank can be checked by hand against the
snapshot.

## Farm plans

Each protocol gets a plan of 6–8 concrete steps: wallet hygiene, the
qualifying deposits or actions on the chains the protocol actually runs on,
cadence to stay active, and the costs (capital, gas, time) written next to
each step. The plans are generated from the row's own data — chains,
category, TVL — not pasted boilerplate.

## Layout

- `main.ts` — the entry point: parse, score, write the outputs and dossier.
- `lib/model.ts` — snapshot parsing, the radar-2 model, the farm plans.
- `dashboard/` — the static board (`index.html`, `app.css`, `app.js`).
- `vendor/` — the make.fun dossier library, copied from the bounty kit
  unchanged.
- `screenshots/` — dashboard renders, first is the cover.

MIT licensed — see `LICENSE`.
