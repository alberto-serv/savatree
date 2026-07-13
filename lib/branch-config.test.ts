/**
 * Guards for the branch config layer.
 *
 * The rule these enforce: a branch's config OVERRIDES the catalog, it does not
 * REPLACE it. A branch that has never been configured must price exactly like
 * corporate, and a config saved before a program existed must not leave that
 * program priced at $0 — which is the failure mode that would quietly give a
 * customer a free year of Plant Health Care.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultConfig, mergeConfig, resolveProgram, resolveAddons, branchAddonsFor,
  enabledServices, enabledTreeJobs, treeOptions,
} from "./branch-config";
import { PROGRAMS, quoteProgram, getProgram } from "./savatree-catalog";
import { estimateTreeWork } from "./tree-care";

const phc = getProgram("phc_program")!;

test("an unconfigured branch prices exactly like the catalog", () => {
  const cfg = defaultConfig();
  const inputs = { plantCount: 6, plantSize: "medium" as const };

  // The San Jose default deliberately changes the TREE labor index, not the plan
  // rates — so plans must be untouched.
  for (const program of PROGRAMS) {
    const resolved = resolveProgram(cfg, program);
    for (const tier of program.tiers) {
      const corporate = quoteProgram(program.id, tier.level, inputs);
      const branch = quoteProgram(program.id, tier.level, inputs, {
        program: resolved,
        addons: resolveAddons(cfg),
      });
      assert.deepEqual(
        branch.annual,
        corporate.annual,
        `${program.id}/${tier.level} drifted from the catalog on a default config`,
      );
    }
  }
});

test("a branch rate change moves the customer's price, and only that program's", () => {
  const cfg = defaultConfig();
  cfg.programs.phc_program.tiers.better.rateLow = 400; // was 220
  cfg.programs.phc_program.tiers.better.rateHigh = 700; // was 400

  const inputs = { plantCount: 6, plantSize: "medium" as const };
  const branch = quoteProgram("phc_program", "better", inputs, {
    program: resolveProgram(cfg, phc),
    addons: resolveAddons(cfg),
  });
  assert.deepEqual(branch.annual, { low: 2400, high: 4200 }, "6 plants × $400–700");

  // The lawn program must not have moved.
  const lawn = getProgram("lawn_program")!;
  const lawnBranch = quoteProgram("lawn_program", "better", { turfSqft: 5000 }, {
    program: resolveProgram(cfg, lawn),
    addons: resolveAddons(cfg),
  });
  const lawnCorporate = quoteProgram("lawn_program", "better", { turfSqft: 5000 });
  assert.deepEqual(lawnBranch.annual, lawnCorporate.annual);
});

test("the annual floor still protects a small property at branch rates", () => {
  const cfg = defaultConfig();
  cfg.programs.phc_program.tiers.good.annualFloor = 900;

  const q = quoteProgram("phc_program", "good", { plantCount: 1, plantSize: "small" }, {
    program: resolveProgram(cfg, phc),
    addons: resolveAddons(cfg),
  });
  assert.equal(q.annual.low, 900, "one small shrub must not be quoted below the branch's floor");
});

test("San Jose's labor index moves tree work — and never the city's fees", () => {
  const cfg = defaultConfig();
  assert.ok(cfg.tree.rateIndex > 1, "the Bay Area default must open above the national anchors");

  const tree = { job: "removal" as const, heightFt: 40, diameterInches: 14, access: "moderate" as const };

  const national = estimateTreeWork(tree, { ...treeOptions(cfg), rateIndex: 1 });
  const sanJose = estimateTreeWork(tree, treeOptions(cfg));
  assert.ok(sanJose.estimate.high > national.estimate.high, "the index must reach the customer's price");

  // A permit fee is set by a city council. It does not rise because our climbers
  // cost more — if this ever couples, we are inventing municipal fees.
  const withPermit = (rateIndex: number) =>
    estimateTreeWork({ ...tree, species: "native_oak" }, { ...treeOptions(cfg), rateIndex });

  const cheap = withPermit(1);
  const pricey = withPermit(2);
  const permitLine = (e: ReturnType<typeof estimateTreeWork>) =>
    e.lines.find((l) => /filing fee/i.test(l.label))!.band;

  assert.deepEqual(
    permitLine(cheap),
    permitLine(pricey),
    "the city's filing fee moved with our labor index — it must not",
  );
});

test("the branch's ordinance reaches the customer's estimate", () => {
  const cfg = defaultConfig();
  const tree = {
    job: "removal" as const, heightFt: 30, diameterInches: 8,
    species: "native_oak" as const, access: "open" as const,
  };

  // Default: an 8" oak is over the 6" threshold → protected.
  const strict = estimateTreeWork(tree, treeOptions(cfg));
  assert.equal(strict.permit?.isProtected, true);

  // A city that only protects oaks from 12" → the same tree is not protected.
  cfg.permit.speciesDbh.native_oak = 12;
  const lenient = estimateTreeWork(tree, treeOptions(cfg));
  assert.equal(lenient.permit?.isProtected, false);
  assert.ok(
    lenient.estimate.high < strict.estimate.high,
    "dropping the permit must drop the price the customer is quoted",
  );

  // And the city's own name is what the customer reads.
  cfg.permit.speciesDbh.native_oak = 6;
  cfg.permit.cityLabel = "Los Gatos";
  const named = estimateTreeWork(tree, treeOptions(cfg));
  assert.ok(
    named.permit!.reasons.some((r) => r.includes("Los Gatos")),
    "the estimate must cite the city whose rules it applied",
  );
});

test("a service the branch switched off is gone — from the tiles and the jobs", () => {
  const cfg = defaultConfig();
  assert.ok(enabledServices(cfg).includes("deer"));

  cfg.serviceEnabled.deer = false;
  assert.ok(!enabledServices(cfg).includes("deer"), "a withdrawn service must not be offered");

  // Storm work is dispatch, not a product. It survives a manager turning every
  // other tree job off — someone with a limb on the roof still needs the number.
  cfg.tree.jobs.tree_removal = false;
  cfg.tree.jobs.tree_pruning = false;
  cfg.tree.jobs.stump_grinding = false;
  cfg.tree.jobs.cabling_bracing = false;
  assert.deepEqual(enabledTreeJobs(cfg), ["storm_emergency"]);
});

test("withdrawing an add-on removes it from that plan only", () => {
  const cfg = defaultConfig();
  assert.ok(branchAddonsFor(cfg, "phc_program").some((a) => a.id === "eab_treatment"));

  cfg.addonEnabled.phc_program.eab_treatment = false;
  assert.ok(!branchAddonsFor(cfg, "phc_program").some((a) => a.id === "eab_treatment"));

  // soil_testing attaches to both PHC and lawn — withdrawing it from one must not
  // withdraw it from the other.
  cfg.addonEnabled.phc_program.soil_testing = false;
  assert.ok(!branchAddonsFor(cfg, "phc_program").some((a) => a.id === "soil_testing"));
  assert.ok(branchAddonsFor(cfg, "lawn_program").some((a) => a.id === "soil_testing"));
});

test("a stale save can never leave a program priced at zero", () => {
  // A config saved before `pest_program` existed, with a partial tier record.
  const stale = {
    identity: { branchName: "SavATree — San Jose" },
    serviceOrder: ["lawn", "tree_work"],
    programs: {
      phc_program: { tiers: { better: { rateLow: 999 } } },
    },
  };

  const cfg = mergeConfig(stale);

  // The saved field wins…
  assert.equal(cfg.programs.phc_program.tiers.better.rateLow, 999);
  // …and every field the save never mentioned falls back to a real default.
  assert.equal(cfg.programs.phc_program.tiers.better.rateHigh, 400);
  assert.ok(cfg.programs.pest_program.tiers.good.annualFloor > 0, "a program the save never saw must still have a floor");
  assert.ok((cfg.permit.speciesDbh.native_oak ?? 0) > 0);
  assert.ok(cfg.tree.rateIndex > 0);

  // A truncated order must not lose the services it never listed.
  assert.equal(cfg.serviceOrder.length, defaultConfig().serviceOrder.length);
  assert.equal(cfg.serviceOrder[0], "lawn", "the manager's order is still respected");
  assert.ok(cfg.serviceOrder.includes("deer"));

  // And the quote engine must produce a real number for the program it never saw.
  const pest = getProgram("pest_program")!;
  const q = quoteProgram("pest_program", "good", { propertySqft: 8000 }, {
    program: resolveProgram(cfg, pest),
    addons: resolveAddons(cfg),
  });
  assert.ok(q.annual.low > 0, "a stale save quoted a program at $0 — this is the free-service bug");
});

test("garbage in storage falls back to the default branch", () => {
  assert.deepEqual(mergeConfig(null), defaultConfig());
  assert.deepEqual(mergeConfig("not a config"), defaultConfig());
  assert.deepEqual(mergeConfig(42), defaultConfig());
});
