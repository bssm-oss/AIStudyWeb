const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyExperimentalAvailability,
  clampInteger,
  clampNumber,
  defaultControls,
  guidedStepCap,
  formatSigned,
  createGuideRequest,
  readControls,
  readRuntimeConfig,
  renderArms,
  renderHistory,
  renderInsights,
  runConfiguredSimulation,
  shouldUseExperimentalMode,
  simulateBandit,
  simulateGuidedBandit,
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

test("readRuntimeConfig keeps the experimental bridge opt-in by default", () => {
  assert.deepEqual(readRuntimeConfig({}), {
    experimentalOllamaEnabled: false,
    ollamaModel: "",
  });

  assert.deepEqual(readRuntimeConfig({
    rewardLabConfig: {
      experimentalOllamaEnabled: true,
      ollamaModel: " llama3.2 ",
    },
  }), {
    experimentalOllamaEnabled: true,
    ollamaModel: "llama3.2",
  });
});

test("experimental Ollama mode stays gated behind server config and explicit opt-in", () => {
  const optIn = { checked: true, disabled: false };
  const status = { textContent: "", dataset: {} };
  const disabledConfig = { experimentalOllamaEnabled: false, ollamaModel: "" };

  applyExperimentalAvailability(disabledConfig, optIn, status);

  assert.equal(optIn.disabled, true);
  assert.equal(optIn.checked, false);
  assert.equal(status.dataset.state, "disabled");
  assert.equal(shouldUseExperimentalMode(disabledConfig, optIn), false);

  const enabledConfig = { experimentalOllamaEnabled: true, ollamaModel: "llama3.2" };
  optIn.disabled = false;
  optIn.checked = false;
  applyExperimentalAvailability(enabledConfig, optIn, status);

  assert.equal(optIn.disabled, false);
  assert.equal(shouldUseExperimentalMode(enabledConfig, optIn), false);
  optIn.checked = true;
  assert.equal(shouldUseExperimentalMode(enabledConfig, optIn), true);
});

test("createGuideRequest shapes lesson state for the experimental guide endpoint", () => {
  const result = simulateBandit({ arms: 3, epsilon: 0.2, steps: 2, seed: 5 });
  const guideRequest = createGuideRequest({
    arms: result.arms,
    history: result.history,
  }, 3, 5);

  assert.deepEqual(guideRequest, {
    step: 3,
    totalSteps: 5,
    arms: result.arms.map((arm) => ({
      index: arm.index,
      pulls: arm.pulls,
      estimate: arm.estimate,
      rewardSum: arm.rewardSum,
    })),
    history: result.history.map((entry) => ({
      step: entry.step,
      armIndex: entry.armIndex,
      reward: entry.reward,
      exploring: entry.exploring,
    })),
  });
});

test("simulateGuidedBandit caps model calls and sends capped step totals", async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    return {
      ok: true,
      json: async () => ({ armIndex: 0, reason: `step ${body.step}` }),
    };
  };

  const result = await simulateGuidedBandit(
    { arms: 4, epsilon: 0.2, steps: guidedStepCap + 25, seed: 9 },
    { fetchImpl, runtimeConfig: { experimentalOllamaEnabled: true, ollamaModel: "llama3.2" } }
  );

  assert.equal(requests.length, guidedStepCap);
  assert.equal(result.history.length, guidedStepCap);
  assert.equal(result.config.steps, guidedStepCap);
  assert.equal(result.requestedSteps, guidedStepCap + 25);
  assert.equal(requests[0].totalSteps, guidedStepCap);
  assert.equal(requests[guidedStepCap - 1].step, guidedStepCap);
  assert.equal(requests[guidedStepCap - 1].totalSteps, guidedStepCap);
});

test("simulateGuidedBandit applies successful guide responses with local rewards", async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    return {
      ok: true,
      json: async () => ({ armIndex: body.step % 2, reason: `reason ${body.step}` }),
    };
  };

  const result = await simulateGuidedBandit(
    { arms: 3, epsilon: 0.1, steps: 4, seed: 21 },
    { fetchImpl, runtimeConfig: { experimentalOllamaEnabled: true, ollamaModel: "llama3.2" } }
  );

  assert.equal(result.mode, "experimental-ollama-guided");
  assert.equal(result.history.length, 4);
  assert.equal(result.arms.reduce((sum, arm) => sum + arm.pulls, 0), 4);
  assert.ok(result.history.every((entry) => entry.guided === true));
  assert.equal(result.latestGuideReason, "reason 4");
  assert.deepEqual(requests[0], {
    step: 1,
    totalSteps: 4,
    arms: [
      { index: 0, pulls: 0, estimate: 0, rewardSum: 0 },
      { index: 1, pulls: 0, estimate: 0, rewardSum: 0 },
      { index: 2, pulls: 0, estimate: 0, rewardSum: 0 },
    ],
    history: [],
  });
  assert.equal(requests[1].history.length, 1);
  assert.deepEqual(Object.keys(requests[1].history[0]).sort(), ["armIndex", "reward", "step"]);
});

test("runConfiguredSimulation falls back to epsilon-greedy when the guide fails", async () => {
  const roots = {
    summaryRoot: { innerHTML: "" },
    chartRoot: { innerHTML: "" },
    insightsRoot: { innerHTML: "" },
    historyRoot: { innerHTML: "" },
  };
  const experimentalOptIn = { checked: true, disabled: false };
  const experimentalStatus = { textContent: "", dataset: {} };
  const submitButton = { disabled: false };
  const resetButton = { disabled: false };

  const result = await runConfiguredSimulation({
    config: { arms: 4, epsilon: 0.15, steps: 12, seed: 17 },
    roots,
    runtimeConfig: { experimentalOllamaEnabled: true, ollamaModel: "llama3.2" },
    experimentalOptIn,
    experimentalStatus,
    submitButton,
    resetButton,
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });

  assert.equal(result.mode, "epsilon-greedy");
  assert.equal(result.history.length, 12);
  assert.equal(experimentalStatus.dataset.state, "error");
  assert.match(experimentalStatus.textContent, /failed/i);
  assert.match(experimentalStatus.textContent, /epsilon-greedy/i);
  assert.equal(submitButton.disabled, false);
  assert.equal(resetButton.disabled, false);
  assert.match(roots.summaryRoot.innerHTML, /Average reward/);
});

test("renderInsights and history explain the guided mode without renaming surfaces", async () => {
  const result = await simulateGuidedBandit(
    { arms: 3, epsilon: 0.1, steps: 3, seed: 7 },
    {
      fetchImpl: async () => ({ ok: true, json: async () => ({ armIndex: 0, reason: "steady" }) }),
      runtimeConfig: { experimentalOllamaEnabled: true, ollamaModel: "llama3.2" },
    }
  );
  const averageReward = result.totalReward / result.config.steps;
  const optimalSelectionRate = (result.history.filter((entry) => entry.optimal).length / result.config.steps) * 100;
  const html = renderInsights(result, averageReward, optimalSelectionRate, 0);
  const historyHtml = renderHistory(result.history);

  assert.match(html, /Experimental guide/);
  assert.match(html, /Call budget/);
  assert.match(historyHtml, /Guided/);
});

test("formatSigned keeps explicit sign information for lesson summaries", () => {
  assert.equal(formatSigned(1.234), "+1.23");
  assert.equal(formatSigned(-1.234), "-1.23");
});
