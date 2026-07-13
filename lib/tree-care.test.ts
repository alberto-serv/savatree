/**
 * Calibration guards for the tree care estimator.
 *
 * The anchors below are REAL reported SavATree quotes. If you retune the rates
 * in tree-care.ts, these fail — that's the point. Do not "fix" a failure by
 * loosening the assertion; either the new rates are wrong, or you have a newer
 * real quote and should replace the anchor with it.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";
import { estimateTreeWork, triageEmergency } from "./tree-care";

// ─── Anchor 1 — real quote: large tree pruning, $3,890 ────────────────────────
// A ~70 ft specimen over a target, moderate access. A job at that price is at
// the TOP of what we'd quote, so $3,890 must land inside the band (with a little
// headroom on the high end — the real quote is a firm price, ours is a range).

test("anchor: real $3,890 large-tree pruning quote lands in the band", () => {
  const q = estimateTreeWork({
    job: "pruning",
    heightFt: 70,
    diameterInches: 26,
    access: "moderate",
    proximity: "over_structure_or_lines",
    condition: "healthy",
  });

  const REAL = 3890;
  assert.ok(
    REAL >= q.estimate.low && REAL <= q.estimate.high * 1.05,
    `real quote $${REAL} fell outside $${q.estimate.low}–$${q.estimate.high} (+5%) — rates have drifted`,
  );

  // It should sit near the top of the band, not the middle: this was an expensive job.
  const mid = (q.estimate.low + q.estimate.high) / 2;
  assert.ok(REAL > mid, `$${REAL} should sit above the midpoint $${mid}`);

  // Over a target → the arborist must see it. Never book this outright.
  assert.equal(q.nextStep, "book_assessment");
});

// ─── Anchor 2 — sanity ceiling ────────────────────────────────────────────────
// Worst realistic case: crane removal of a decayed severe-leaner over a house.
// Without MULT_CEILING the raw multipliers compound to ~6× and price this at
// ~$40,000, which is nonsense for a residential removal.

test("anchor: worst realistic case stays under $15k (the ceiling holds)", () => {
  const q = estimateTreeWork({
    job: "removal",
    heightFt: 70,
    diameterInches: 28,
    access: "tight",
    proximity: "over_structure_or_lines",
    condition: "dead_or_decayed",
    lean: "severe",
    addStumpGrinding: true,
  });

  assert.ok(
    q.estimate.high < 15000,
    `worst case topped out at $${q.estimate.high} — MULT_CEILING is not holding`,
  );

  // The hazard shows up as an honest wide band and a hard route to an arborist,
  // not as a confident number.
  assert.equal(q.confidence, "low");
  assert.equal(q.nextStep, "book_assessment");
  assert.ok(q.needsArboristBecause.length >= 3, "hazards must be named, not hidden");
  assert.match(q.disclaimer, /not a firm price/);
});

// ─── Baseline — the one case that books itself ────────────────────────────────

test("baseline: 25 ft healthy open-access removal is bookable and near market", () => {
  const q = estimateTreeWork({
    job: "removal",
    heightFt: 25,
    access: "open",
    proximity: "open_yard",
    condition: "healthy",
    addStumpGrinding: true,
  });

  const MARKET_AVG = 900;
  assert.ok(
    MARKET_AVG >= q.estimate.low && MARKET_AVG <= q.estimate.high,
    `market average $${MARKET_AVG} fell outside $${q.estimate.low}–$${q.estimate.high}`,
  );

  assert.equal(q.confidence, "high");
  assert.equal(q.nextStep, "book_job");
  assert.match(q.disclaimer, /Estimate only/);
  assert.deepEqual(q.factors, [], "a clean job has nothing to explain away");
});

// ─── The rules the model must never break ────────────────────────────────────

test("unknowns widen the band — they never narrow it", () => {
  const known = estimateTreeWork({ job: "removal", heightFt: 50, access: "open", proximity: "open_yard" });
  const unknown = estimateTreeWork({
    job: "removal",
    heightFt: 50,
    access: "tight",
    proximity: "over_structure_or_lines",
    condition: "dead_or_decayed",
  });

  assert.ok(unknown.spreadPct > known.spreadPct, "hazardous inputs must widen the band");
  assert.ok(unknown.factors.length > known.factors.length, "and must say why");
});

test("a big or hazardous job never books itself", () => {
  // Tall but otherwise pristine — still too big to book blind.
  const tall = estimateTreeWork({
    job: "removal",
    heightFt: 75,
    access: "open",
    proximity: "open_yard",
    condition: "healthy",
  });
  assert.equal(tall.nextStep, "book_assessment");

  // Small and clean, but decayed — internal decay is invisible from the ground.
  const decayed = estimateTreeWork({
    job: "removal",
    heightFt: 20,
    access: "open",
    proximity: "open_yard",
    condition: "dead_or_decayed",
  });
  assert.equal(decayed.nextStep, "book_assessment");
});

test("direct booking can be switched off entirely — the visit is the cross-sell", () => {
  const input = {
    job: "removal" as const,
    heightFt: 25,
    access: "open" as const,
    proximity: "open_yard" as const,
  };

  assert.equal(estimateTreeWork(input).nextStep, "book_job");
  assert.equal(
    estimateTreeWork(input, { allowDirectBooking: false }).nextStep,
    "book_assessment",
  );
});

test("the upsell encodes the business model", () => {
  // A removal of a living tree — always offer to save it first.
  const removal = estimateTreeWork({ job: "removal", heightFt: 40, condition: "declining" });
  assert.match(removal.upsell!, /often savable/);

  // No upsell for a tree that's already gone.
  const dead = estimateTreeWork({ job: "removal", heightFt: 40, condition: "dead_or_decayed" });
  assert.equal(dead.upsell, null);

  // Declining canopy is a plant health lead.
  const pruning = estimateTreeWork({ job: "pruning", heightFt: 40, condition: "declining" });
  assert.match(pruning.upsell!, /Plant Health Care/);

  const healthyPruning = estimateTreeWork({ job: "pruning", heightFt: 40, condition: "healthy" });
  assert.equal(healthyPruning.upsell, null);
});

test("emergencies are dispatched, never priced", () => {
  const t = triageEmergency();
  assert.equal(t.nextStep, "dispatch");
  assert.match(t.message, /Skip the estimate/);
  // There is no price anywhere in an emergency response.
  assert.doesNotMatch(t.message, /\$/);
});

test("count scales the job; stump grinding only attaches to removals", () => {
  const one = estimateTreeWork({ job: "removal", heightFt: 40, count: 1 });
  const three = estimateTreeWork({ job: "removal", heightFt: 40, count: 3 });

  // Totals are rounded from the raw figures rather than from a rounded per-tree
  // price, so allow a dollar of rounding slack — that's the correct behavior.
  assert.ok(
    Math.abs(three.estimate.low - one.estimate.low * 3) <= 1,
    `expected ~3× $${one.estimate.low}, got $${three.estimate.low}`,
  );
  assert.deepEqual(three.perTree, one.perTree, "per-tree price is unchanged by volume");

  const pruningWithStump = estimateTreeWork({ job: "pruning", heightFt: 40, addStumpGrinding: true });
  assert.equal(pruningWithStump.lines.length, 1, "you can't grind the stump of a tree you pruned");
});
