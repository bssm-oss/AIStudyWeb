const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clampInteger,
  clampNumber,
  defaultControls,
  formatSigned,
  readControls,
  renderArms,
  renderHistory,
  renderInsights,
  simulateBandit,
} = require("./app.js");

test("simulateBandit is deterministic for the same seeded config", () => {
  const config = { arms: 4, epsilon: 0.15, steps: 40, seed: 11 };
  const first = simulateBandit(config);
  const second = simulateBandit(config);

  assert.deepEqual(second, first);
});

test("simulateBandit returns a complete lesson result", () => {
  const config = { arms: 5, epsilon: 0.1, steps: 120, seed: 7 };
  const result = simulateBandit(config);

  assert.equal(result.config.seed, 7);
  assert.equal(result.arms.length, 5);
  assert.equal(result.history.length, 120);
  assert.equal(result.exploreCount + result.exploitCount, 120);
  assert.equal(result.arms.reduce((sum, arm) => sum + arm.pulls, 0), 120);
  assert.ok(result.optimalArmIndex >= 0 && result.optimalArmIndex < result.arms.length);
  assert.ok(result.latestArmIndex >= 0 && result.latestArmIndex < result.arms.length);
});

test("renderArms highlights the optimal and most recent arm", () => {
  const result = simulateBandit({ arms: 3, epsilon: 0.2, steps: 25, seed: 5 });
  const html = renderArms(result);

  assert.match(html, /Optimal/);
  assert.match(html, /Last pulled/);
  assert.match(html, /True mean/);
  assert.match(html, /Estimate/);
});

test("renderInsights explains epsilon and convergence context", () => {
  const result = simulateBandit({ arms: 4, epsilon: 0.25, steps: 60, seed: 9 });
  const averageReward = result.totalReward / result.config.steps;
  const optimalSelectionRate = (result.history.filter((entry) => entry.optimal).length / result.config.steps) * 100;
  const explorationRate = (result.exploreCount / result.config.steps) * 100;
  const html = renderInsights(result, averageReward, optimalSelectionRate, explorationRate);

  assert.match(html, /Epsilon in practice/);
  assert.match(html, /What the learner believes/);
  assert.match(html, /Did it find the best arm\?/);
  assert.match(html, /ε = 0\.25/);
});

test("renderHistory lists recent explore and exploit decisions", () => {
  const result = simulateBandit({ arms: 4, epsilon: 0.3, steps: 18, seed: 13 });
  const html = renderHistory(result.history);

  assert.match(html, /<table>/);
  assert.match(html, /Step/);
  assert.match(html, /Choice/);
  assert.match(html, /Reward/);
  assert.ok(html.includes("Explore") || html.includes("Exploit"));
});

test("numeric helpers keep lesson controls within supported bounds", () => {
  assert.equal(clampInteger(100, 2, 12, defaultControls.arms), 12);
  assert.equal(clampInteger(Number.NaN, 2, 12, defaultControls.arms), defaultControls.arms);
  assert.equal(clampNumber(-1, 0, 1, defaultControls.epsilon), 0);
  assert.equal(clampNumber(Number.NaN, 0, 1, defaultControls.epsilon), defaultControls.epsilon);
});

test("readControls normalizes form values back into supported bounds", () => {
  const form = {
    elements: {
      arms: { value: "100" },
      epsilon: { value: "-0.5" },
      steps: { value: "6000" },
      seed: { value: "NaN" },
    },
  };

  const normalized = readControls(form);

  assert.deepEqual(normalized, {
    arms: 12,
    epsilon: 0,
    steps: 5000,
    seed: defaultControls.seed,
  });

  assert.equal(form.elements.arms.value, "12");
  assert.equal(form.elements.epsilon.value, "0.00");
  assert.equal(form.elements.steps.value, "5000");
  assert.equal(form.elements.seed.value, String(defaultControls.seed));
});

test("formatSigned keeps explicit sign information for lesson summaries", () => {
  assert.equal(formatSigned(1.234), "+1.23");
  assert.equal(formatSigned(-1.234), "-1.23");
});
