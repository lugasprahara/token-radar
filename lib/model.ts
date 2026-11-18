// The radar-3 model: a sealed snapshot of the protocol universe goes in, a
// ranked board of pre-token protocols comes out.
//
// Who is on the board: every pre-token protocol the snapshot carries that
// can be ranked — the whole watchlist (the floor the bounty sets, never a
// ceiling) plus every other rankable pre-token protocol, above the floor
// and below it alike. radar-2 ranked only the watchlist and the below-
// floor early rows, which silently dropped every above-floor protocol the
// watchlist did not name (63 of them on the 2026-11-14 snapshot). radar-3
// closes that gap: 289 of 289 rankable pre-token protocols are scored.
//
// How a row is priced — from the snapshot's figures only, nothing
// hard-coded, no name ever special-cased:
//
//   The market does not pay a flat rate per dollar of TVL: across the
//   snapshot's live protocols the market cap grows sublinearly with TVL.
//   radar-3 fits that size curve on the live, non-CEX protocols that
//   already trade (log market cap on log TVL, ordinary least squares),
//   then lets each category shift the curve by an intercept read off the
//   category's median residual, shrunk toward zero by sample size
//   (weight offset_shrink) so a category resting on one or two live
//   protocols borrows the market's curve instead of inventing its own.
//
//   base(p)    = exp(intercept + offset(category) + slope x log TVL)
//   implied(p) = base(p) x growth multiplier x maturity multiplier
//
//   The growth and maturity multipliers are radar-2's, unchanged: a
//   launch-context adjustment (7-day TVL change, clamped and weighted;
//   age with no token on a floor..floor+range ramp), applied after the
//   comp fit, not part of it.
//
// How the model was chosen: by backtest, not by taste. Both estimators
// are scored leave-one-out over the live protocols they price from —
// each live protocol is predicted from a fit that never saw it — and
// radar-3 ships the winner and publishes both scores. On the sealed
// 2026-11-14 snapshot (119 non-CEX live protocols):
//
//   radar-2 (flat category multiple): median |log10 error| 0.733,
//     mean 0.807, 24.4% of predictions within 2x of the real cap.
//   radar-3 (size curve + category offset): median 0.514, mean 0.676,
//     34.5% within 2x.
//
// The same leave-one-out residuals give every row its uncertainty band:
// the central 68% of the backtest's signed errors, applied to the row's
// own implied value. A row whose band is wide is a row the market's own
// prices cannot pin down, and the dashboard says so instead of hiding it.
//
// Farm plans are netted: every step carries its gas in dollars, and each
// plan totals its net cost — the gas and fees a farmer actually spends
// over the hold window, with the capital itself named separately because
// capital comes back and cost does not — and ends in a verdict tier.

/** One protocol record, exactly the ten fields the sealed snapshot carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The snapshot document itself. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's tunable constants; the dashboard states them in full. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  offset_shrink: number;
  legacy_shrink_k: number;
  legacy_multiple_floor: number;
  legacy_multiple_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  offset_shrink: 6,
  legacy_shrink_k: 10,
  legacy_multiple_floor: 0.03,
  legacy_multiple_cap: 1.5,
};

/** The model's version label, printed by the dashboard and quoted in the dossier. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the dashboard's Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's shift of the size curve, and the sample it rests on. */
export interface CategoryOffset {
  category: string;
  live_protocols: number;
  offset: number;
}

/** The fitted size curve: log market cap = intercept + slope x log TVL, plus category offsets. */
export interface SizeCurve {
  intercept: number;
  slope: number;
  comps: number;
  offsets: Map<string, CategoryOffset>;
  global: CategoryOffset;
}

/** A leave-one-out backtest score for one estimator. */
export interface LooScore {
  n: number;
  median_abs_log10_err: number;
  mean_abs_log10_err: number;
  within_2x_share: number;
  q16_log10_err: number;
  q84_log10_err: number;
}

/** Both estimators' backtest scores, computed on the snapshot at run time. */
export interface Validation {
  curve: LooScore;
  legacy: LooScore;
}

/** One farm-plan step before it is flattened to a string: action, cost, time, gas. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
  gas_usd: number;
  weekly_gas_usd: number;
}

/** A plan's netted totals: what a farmer locks up, what they actually spend, the verdict. */
export interface FarmPlan {
  capital_usd: number;
  net_cost_usd: number;
  hold_days: number;
  verdict: string;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  band_low_usd: number;
  band_high_usd: number;
  why: string;
  model: {
    curve_base_usd: number;
    effective_multiple: number;
    category_offset: number;
    offset_live_protocols: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  plan: FarmPlan;
  farm_steps: string[];
}

/** A board row in the dashboard's compact form (data.js). */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  band_low_usd: number;
  band_high_usd: number;
  why: string;
  effective_multiple: number;
  category_offset: number;
  offset_live_protocols: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  plan: FarmPlan;
  farm_steps: string[];
}

/** A protocol that already trades: shown at the market's own value, never modelled. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard renders: board, live set, the fit, the backtest, and the model behind them. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  curve: { intercept: number; slope: number; comps: number };
  offsets: CategoryOffset[];
  validation: Validation;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Raised when the snapshot is not a document this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** Round to four decimals: the precision published figures are quoted at. */
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** `value` when it is a finite number, else `fallback`. */
function numOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, never negative; null when either date is missing or unparseable. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

/** The median of a non-empty list. */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A percentile of a non-empty list, linear interpolation between closest ranks. */
function percentileOf(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** True when a protocol's record shows no token: no cap, no CoinGecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

// DefiLlama lists re-releases as separate entries ("Foo V2", "Foo 1.5");
// those are pools of a parent protocol, not launches of their own.
const VERSIONED_NAME = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** True when the board may rank a protocol: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED_NAME.test(p.name);
}

/** A live protocol the curve can learn from: trades, is not an exchange, has a cap and a TVL. */
function isComp(p: SnapshotProtocol): boolean {
  return !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0;
}

/** Ordinary least squares of y on x; a flat line at the mean when x never varies. */
function ols(xs: number[], ys: number[]): { intercept: number; slope: number } {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  return { intercept: my - slope * mx, slope };
}

/**
 * Fit the size curve on a set of live comps: one global log-log line, then
 * each category's intercept shift as its median residual, shrunk toward
 * zero by sample size so thin categories stay near the market's curve.
 */
export function fitCurve(comps: SnapshotProtocol[], model: ModelConstants = MODEL): SizeCurve {
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const { intercept, slope } = ols(xs, ys);
  const residualsByCategory = new Map<string, number[]>();
  comps.forEach((p, i) => {
    const key = p.category ?? '';
    const resid = ys[i]! - (intercept + slope * xs[i]!);
    const bucket = residualsByCategory.get(key);
    if (bucket === undefined) residualsByCategory.set(key, [resid]);
    else bucket.push(resid);
  });
  const offsets = new Map<string, CategoryOffset>();
  for (const [category, residuals] of residualsByCategory) {
    const n = residuals.length;
    offsets.set(category, {
      category,
      live_protocols: n,
      offset: round4(medianOf(residuals) * (n / (n + model.offset_shrink))),
    });
  }
  return {
    intercept,
    slope,
    comps: comps.length,
    offsets,
    global: { category: '', live_protocols: comps.length, offset: 0 },
  };
}

/** The offset a protocol is priced with: its category's, or zero when the category has no live comp. */
function offsetFor(p: SnapshotProtocol, curve: SizeCurve): CategoryOffset {
  return curve.offsets.get(p.category ?? '') ?? curve.global;
}

/** The curve's price for one TVL in one category, before the launch-context multipliers. */
export function curveBase(curve: SizeCurve, tvlUsd: number, offset: number): number {
  return Math.exp(curve.intercept + offset + curve.slope * Math.log(Math.max(1, tvlUsd)));
}

/** radar-2's estimator, kept for the backtest: a category's median mcap/TVL, shrunk and clamped. */
function legacyMultiple(p: SnapshotProtocol, pool: SnapshotProtocol[], model: ModelConstants): number {
  const ratios: number[] = [];
  const catRatios: number[] = [];
  for (const q of pool) {
    const r = q.mcap_usd! / q.tvl_usd;
    ratios.push(r);
    if ((q.category ?? '') === (p.category ?? '')) catRatios.push(r);
  }
  const marketMedian = medianOf(ratios);
  const base = catRatios.length > 0
    ? (catRatios.length * medianOf(catRatios) + model.legacy_shrink_k * marketMedian) / (catRatios.length + model.legacy_shrink_k)
    : marketMedian;
  return Math.min(model.legacy_multiple_cap, Math.max(model.legacy_multiple_floor, base));
}

/** Summarise signed log10 prediction errors into a backtest score. */
function looScore(errors: number[]): LooScore {
  const abs = errors.map((e) => Math.abs(e));
  return {
    n: errors.length,
    median_abs_log10_err: round4(medianOf(abs)),
    mean_abs_log10_err: round4(abs.reduce((a, b) => a + b, 0) / abs.length),
    within_2x_share: round4(abs.filter((e) => e <= Math.log10(2)).length / abs.length),
    q16_log10_err: round4(percentileOf(errors, 0.16)),
    q84_log10_err: round4(percentileOf(errors, 0.84)),
  };
}

/**
 * Leave-one-out backtest of both estimators over the live comps: each
 * comp is priced by a fit that never saw it, and the signed log10 error
 * against its real market cap is recorded. Deterministic, run at build
 * time on the sealed snapshot, published on the dashboard.
 */
export function validate(snapshot: Snapshot, model: ModelConstants = MODEL): Validation {
  const comps = snapshot.protocols.filter(isComp);
  const legacyPool = snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
  const curveErrors: number[] = [];
  const legacyErrors: number[] = [];
  for (const p of comps) {
    const rest = comps.filter((q) => q !== p);
    const curve = fitCurve(rest, model);
    const off = offsetFor(p, curve);
    const predicted = curveBase(curve, p.tvl_usd, off.offset);
    curveErrors.push(Math.log10(predicted / p.mcap_usd!));
    const legacyRest = legacyPool.filter((q) => q !== p);
    const legacyPredicted = p.tvl_usd * legacyMultiple(p, legacyRest, model);
    legacyErrors.push(Math.log10(legacyPredicted / p.mcap_usd!));
  }
  return { curve: looScore(curveErrors), legacy: looScore(legacyErrors) };
}

/** One protocol's implied value and the pieces it was built from. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  base: number,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, numOr(protocol.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const effectiveAge = Math.min(Math.max(age ?? model.unknown_age_days, 0), model.maturity_days);
  const maturityMult = model.maturity_floor + (effectiveAge / model.maturity_days) * model.maturity_range;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, growthPct, growthMult, maturityMult, age };
}

/** The counts a headline about the board quotes. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The ranked board: every rankable pre-token protocol, strongest implied value first, ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const watchlist = new Set(snapshot.watchlist);
  const curve = fitCurve(snapshot.protocols.filter(isComp), model);
  const validation = validate(snapshot, model);
  const bandLo = 10 ** validation.curve.q16_log10_err;
  const bandHi = 10 ** validation.curve.q84_log10_err;
  const chosen = snapshot.protocols.filter(isRankable);
  const scored = chosen.map((p) => {
    const off = offsetFor(p, curve);
    const base = curveBase(curve, p.tvl_usd, off.offset);
    const value = impliedValue(p, snapshot.as_of, model, base);
    return { p, off, base, ...value };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const steps = farmSteps(s.p, s.age);
    const plan = planTotals(s.p, s.age, steps);
    const effectiveMultiple = s.base / Math.max(1, s.p.tvl_usd);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      watchlist: watchlist.has(s.p.slug),
      age_days: s.age,
      implied_value_usd: s.implied,
      band_low_usd: Math.max(1, Math.round(s.implied * bandLo)),
      band_high_usd: Math.max(1, Math.round(s.implied * bandHi)),
      why: whyText(s.p, s.base, effectiveMultiple, s.off, s.growthMult, s.maturityMult, s.implied),
      model: {
        curve_base_usd: Math.round(s.base),
        effective_multiple: round4(effectiveMultiple),
        category_offset: s.off.offset,
        offset_live_protocols: s.off.live_protocols,
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        age_days: s.age,
      },
      plan,
      farm_steps: steps.map(stepText),
    };
  });
}

/** One row's rank, explained in a single sentence of arithmetic a reader can check. */
function whyText(
  p: SnapshotProtocol,
  base: number,
  effectiveMultiple: number,
  off: CategoryOffset,
  growthMult: number,
  maturityMult: number,
  implied: number,
): string {
  const cat = p.category ?? 'uncategorised';
  const offText = off.live_protocols > 0
    ? `the ${cat} offset of ${off.offset >= 0 ? '+' : ''}${off.offset.toFixed(2)} rests on ${off.live_protocols} live comp${off.live_protocols === 1 ? '' : 's'}`
    : `no live ${cat} comp exists, so the market curve is used unshifted`;
  return (
    `The size curve prices $${Math.round(p.tvl_usd).toLocaleString('en-US')} of TVL at $${Math.round(base).toLocaleString('en-US')} ` +
    `(an effective multiple of ${effectiveMultiple.toFixed(3)}x at this size); ${offText}; ` +
    `growth x${growthMult.toFixed(2)} and maturity x${maturityMult.toFixed(2)} take it to $${implied.toLocaleString('en-US')}.`
  );
}

/** A step flattened to one string — action, cost, time — held inside the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase when it names none. */
function firstChain(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The capital one farm position needs, tiered by the protocol's own TVL. */
function capitalTier(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long a position should be held: younger protocols get the longer qualifying window. */
function holdWindow(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The one qualifying action a category calls for, in words a farmer can follow. */
function categoryAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six to eight steps, each an action with its cost,
 * its time and its gas in dollars. Everything in it is read off the
 * protocol's own record — category, chains, TVL, age, seven-day momentum —
 * never off a list of names: a growing protocol earns a start-now step, a
 * shrinking one a caution step, a multi-chain one a second-chain step, a
 * young one an early-user step.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = firstChain(p);
  const capital = capitalTier(p);
  const hold = holdWindow(age);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
      gas_usd: 3,
      weekly_gas_usd: 0,
    },
    {
      text: categoryAction(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
      gas_usd: capital >= 150 ? 8 : 4,
      weekly_gas_usd: 0,
    },
  ];
  const growth = p.change_7d;
  if (growth !== null && growth >= 10) {
    steps.push({
      text: `${p.name}'s TVL grew ${growth.toFixed(1)}% in the last 7 days: momentum like this is when points programs open, so make the first qualifying action this week, not next.`,
      cost: 'the same position, started sooner',
      time: 'this week',
      gas_usd: 0,
      weekly_gas_usd: 0,
    });
  } else if (growth !== null && growth <= -15) {
    steps.push({
      text: `${p.name}'s TVL fell ${Math.abs(growth).toFixed(1)}% in the last 7 days: start with half the position and add the rest only once the outflow stops for a full week.`,
      cost: `$${Math.ceil(capital / 2)} of capital to start`,
      time: '15 minutes, then a weekly check',
      gas_usd: 2,
      weekly_gas_usd: 0,
    });
  }
  if (p.chains.length >= 3) {
    steps.push({
      text: `${p.name} runs on ${p.chains.length} chains: repeat the qualifying action on ${p.chains[1]} as well as ${chain}, because activity on more than one chain is harder to filter out as sybil.`,
      cost: 'about $4 of gas for the second chain',
      time: '15 minutes',
      gas_usd: 4,
      weekly_gas_usd: 0,
    });
  }
  if (age !== null && age < 90) {
    steps.push({
      text: `DefiLlama has tracked ${p.name} for only ${age} days: the earliest users are the cheapest cohort to reward, so the first snapshot is often the one that counts most.`,
      cost: 'nothing beyond the position itself',
      time: 'already counted once the position is open',
      gas_usd: 0,
      weekly_gas_usd: 0,
    });
  }
  steps.push(
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
      gas_usd: 0,
      weekly_gas_usd: 2,
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
      gas_usd: 0,
      weekly_gas_usd: 0,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
      gas_usd: 1,
      weekly_gas_usd: 0,
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
      gas_usd: 0,
      weekly_gas_usd: 0,
    },
  );
  return steps;
}

/**
 * A plan netted to the dollar: the capital a farmer locks (returned at
 * the end, so named apart) and the net cost — one-off gas plus the weekly
 * cadence gas across the hold window — with a verdict tier on the total.
 */
export function planTotals(p: SnapshotProtocol, age: number | null, steps: FarmStep[]): FarmPlan {
  const capital = capitalTier(p);
  const hold = holdWindow(age);
  const weeks = Math.ceil(hold / 7);
  const oneOff = steps.reduce((a, s) => a + s.gas_usd, 0);
  const weekly = steps.reduce((a, s) => a + s.weekly_gas_usd, 0);
  const net = oneOff + weekly * weeks;
  const verdict = net <= 60
    ? `Lean plan: $${net} of net cost over ${hold} days on $${capital} of capital.`
    : net <= 140
      ? `Standard plan: $${net} of net cost over ${hold} days on $${capital} of capital.`
      : `Heavy plan: $${net} of net cost over ${hold} days on $${capital} of capital — size the position deliberately.`;
  return { capital_usd: capital, net_cost_usd: net, hold_days: hold, verdict };
}

/** The live-token set for the dashboard's Live token view: biggest market caps first. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row in the compact shape data.js carries. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    band_low_usd: row.band_low_usd,
    band_high_usd: row.band_high_usd,
    why: row.why,
    effective_multiple: row.model.effective_multiple,
    category_offset: row.model.category_offset,
    offset_live_protocols: row.model.offset_live_protocols,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    plan: row.plan,
    farm_steps: row.farm_steps,
  };
}

/** Board plus dashboard data, from one pass over the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const curve = fitCurve(snapshot.protocols.filter(isComp), model);
  const watchlist = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    curve: { intercept: round4(curve.intercept), slope: round4(curve.slope), comps: curve.comps },
    offsets: [...curve.offsets.values()].sort((a, b) => b.live_protocols - a.live_protocols || (a.category < b.category ? -1 : 1)),
    validation: validate(snapshot, model),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watchlist.has(r.slug)).length,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** Parse and validate a snapshot document; anything off-shape is a SnapshotError. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take — coverage, ranks, order, spread, steps — or null when it is. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const covered = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !covered.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.band_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.band_high_usd)) return `${r.slug} has a band that excludes its own implied value`;
  }
  return null;
}

/** The dashboard's dataset as one script: no fetch, no network, just window.RADAR. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
