const defaultControls = {
  arms: 5,
  epsilon: 0.1,
  steps: 250,
  seed: 7,
};

const experimentalGuideEndpoint = "/experimental/ollama/guide";
const guidedStepCap = 60;

function initApp(doc = globalThis.document, win = globalThis.window) {
  if (!doc) {
    return false;
  }

  const controlsForm = doc.querySelector("#controls");
  const resetButton = doc.querySelector("#reset-controls");
  const summaryRoot = doc.querySelector("#summary");
  const chartRoot = doc.querySelector("#chart");
  const insightsRoot = doc.querySelector("#insights");
  const historyRoot = doc.querySelector("#history");
  const experimentalOptIn = doc.querySelector("#experimental-ollama-opt-in");
  const experimentalStatus = doc.querySelector("#experimental-status");

  if (
    !controlsForm
    || !resetButton
    || !summaryRoot
    || !chartRoot
    || !insightsRoot
    || !historyRoot
    || !experimentalOptIn
    || !experimentalStatus
  ) {
    return false;
  }

  const runtimeConfig = readRuntimeConfig(win);
  const roots = {
    controlsForm,
    summaryRoot,
    chartRoot,
    insightsRoot,
    historyRoot,
  };
  const submitButton = controlsForm.querySelector('button[type="submit"]');

  controlsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const config = readControls(controlsForm);
    await runConfiguredSimulation({
      config,
      roots,
      runtimeConfig,
      experimentalOptIn,
      experimentalStatus,
      submitButton,
      resetButton,
      fetchImpl: resolveFetch(win),
    });
  });

  experimentalOptIn.addEventListener("change", () => {
    applyExperimentalAvailability(runtimeConfig, experimentalOptIn, experimentalStatus);
  });

  resetButton.addEventListener("click", () => {
    writeControls(controlsForm, defaultControls);
    experimentalOptIn.checked = false;
    applyExperimentalAvailability(runtimeConfig, experimentalOptIn, experimentalStatus);
    runSimulation(defaultControls, roots);
  });

  writeControls(controlsForm, defaultControls);
  experimentalOptIn.checked = false;
  applyExperimentalAvailability(runtimeConfig, experimentalOptIn, experimentalStatus);
  runSimulation(defaultControls, roots);
  return true;
}

function writeControls(controlsForm, values) {
  controlsForm.elements.arms.value = String(values.arms);
  controlsForm.elements.epsilon.value = values.epsilon.toFixed(2);
  controlsForm.elements.steps.value = String(values.steps);
  controlsForm.elements.seed.value = String(values.seed);
}

function readControls(controlsForm) {
  const arms = clampInteger(Number(controlsForm.elements.arms.value), 2, 12, defaultControls.arms);
  const epsilon = clampNumber(Number(controlsForm.elements.epsilon.value), 0, 1, defaultControls.epsilon);
  const steps = clampInteger(Number(controlsForm.elements.steps.value), 10, 5000, defaultControls.steps);
  const seed = clampInteger(Number(controlsForm.elements.seed.value), 1, 999999, defaultControls.seed);

  const normalized = { arms, epsilon, steps, seed };
  writeControls(controlsForm, normalized);
  return normalized;
}

function readRuntimeConfig(source = globalThis.window) {
  const config = source?.rewardLabConfig;

  return {
    experimentalOllamaEnabled: config?.experimentalOllamaEnabled === true,
    ollamaModel: typeof config?.ollamaModel === "string" ? config.ollamaModel.trim() : "",
  };
}

function resolveFetch(source = globalThis.window) {
  if (typeof source?.fetch === "function") {
    return source.fetch.bind(source);
  }

  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  return null;
}

function setExperimentalStatus(experimentalStatus, message, state) {
  if (!experimentalStatus) {
    return;
  }

  experimentalStatus.textContent = message;
  experimentalStatus.dataset.state = state;
}

function applyExperimentalAvailability(runtimeConfig, experimentalOptIn, experimentalStatus) {
  const enabled = runtimeConfig.experimentalOllamaEnabled === true;

  if (experimentalOptIn) {
    experimentalOptIn.disabled = !enabled;
    if (!enabled) {
      experimentalOptIn.checked = false;
    }
  }

  if (!enabled) {
    setExperimentalStatus(
      experimentalStatus,
      "Experimental local Ollama guidance is unavailable on this server. RewardLab will keep using epsilon-greedy.",
      "disabled"
    );
    return;
  }

  const modelLabel = runtimeConfig.ollamaModel ? ` using ${runtimeConfig.ollamaModel}` : "";
  const selected = Boolean(experimentalOptIn?.checked);

  setExperimentalStatus(
    experimentalStatus,
    selected
      ? `Experimental local Ollama guidance is enabled${modelLabel}. Rewards still stay in your browser, and guided runs are capped at ${guidedStepCap} steps.`
      : `Experimental local Ollama guidance is available${modelLabel}. Leave it unchecked to keep epsilon-greedy, or opt in for a capped guided run.`,
    "ready"
  );
}

function shouldUseExperimentalMode(runtimeConfig, experimentalOptIn) {
  return runtimeConfig.experimentalOllamaEnabled === true
    && Boolean(experimentalOptIn?.checked)
    && experimentalOptIn?.disabled !== true;
}

function setRunBusyState(submitButton, resetButton, busy) {
  if (submitButton) {
    submitButton.disabled = busy;
  }

  if (resetButton) {
    resetButton.disabled = busy;
  }
}

async function runConfiguredSimulation(options) {
  const {
    config,
    roots,
    runtimeConfig = readRuntimeConfig(),
    experimentalOptIn,
    experimentalStatus,
    submitButton,
    resetButton,
    fetchImpl = resolveFetch(),
  } = options;

  if (!shouldUseExperimentalMode(runtimeConfig, experimentalOptIn)) {
    applyExperimentalAvailability(runtimeConfig, experimentalOptIn, experimentalStatus);
    return runSimulation(config, roots);
  }

  const modelLabel = runtimeConfig.ollamaModel ? ` using ${runtimeConfig.ollamaModel}` : "";
  setRunBusyState(submitButton, resetButton, true);
  setExperimentalStatus(
    experimentalStatus,
    `Requesting experimental local Ollama guidance${modelLabel}. Reward simulation stays in your browser.`,
    "running"
  );

  try {
    const result = await simulateGuidedBandit(config, { fetchImpl, runtimeConfig });
    if (roots) {
      render(result, roots);
    }

    const capped = result.requestedSteps > result.config.steps
      ? ` Requested ${result.requestedSteps} steps and capped the guide at ${result.config.steps} calls.`
      : "";
    setExperimentalStatus(
      experimentalStatus,
      `Experimental local Ollama guidance completed.${capped}`.trim(),
      "success"
    );
    return result;
  } catch (error) {
    const fallback = runSimulation(config, roots);
    setExperimentalStatus(
      experimentalStatus,
      `Experimental local Ollama guidance failed: ${toErrorMessage(error)}. RewardLab used epsilon-greedy for this run instead.`,
      "error"
    );
    return fallback;
  } finally {
    setRunBusyState(submitButton, resetButton, false);
  }
}

function runSimulation(config, roots) {
  const result = simulateBandit(config);
  if (roots) {
    render(result, roots);
  }
  return result;
}

function simulateBandit(config) {
  const state = createBanditState(config);

  for (let step = 1; step <= config.steps; step += 1) {
    const exploring = state.rng() < config.epsilon || state.arms.every((arm) => arm.pulls === 0);
    const chosenArmIndex = exploring
      ? Math.floor(state.rng() * state.arms.length)
      : argMax(state.arms, (arm) => arm.estimate);

    applyBanditSelection(state, chosenArmIndex, { exploring });
  }

  return finalizeBanditState(state, { mode: "epsilon-greedy" });
}

async function simulateGuidedBandit(config, options = {}) {
  const { fetchImpl = resolveFetch(), runtimeConfig = readRuntimeConfig() } = options;
  const cappedSteps = Math.min(config.steps, guidedStepCap);
  const guidedConfig = {
    ...config,
    steps: cappedSteps,
  };
  const state = createBanditState(guidedConfig);

  for (let step = 1; step <= guidedConfig.steps; step += 1) {
    const response = await requestGuidedArm({
      state,
      step,
      totalSteps: guidedConfig.steps,
      fetchImpl,
    });

    applyBanditSelection(state, response.armIndex, {
      guided: true,
      reason: response.reason,
    });
  }

  return finalizeBanditState(state, {
    mode: "experimental-ollama-guided",
    requestedSteps: config.steps,
    ollamaModel: runtimeConfig.ollamaModel,
  });
}

function createBanditState(config) {
  const rng = createMulberry32(config.seed);
  const arms = Array.from({ length: config.arms }, (_, index) => ({
    index,
    trueMean: randomNormal(rng),
    pulls: 0,
    estimate: 0,
    rewardSum: 0,
  }));

  return {
    config,
    rng,
    arms,
    optimalArmIndex: argMax(arms, (arm) => arm.trueMean),
    latestArmIndex: 0,
    history: [],
    exploreCount: 0,
    exploitCount: 0,
    totalReward: 0,
    latestGuideReason: "",
  };
}

function applyBanditSelection(state, chosenArmIndex, options = {}) {
  const { exploring = false, guided = false, reason = "" } = options;
  const chosenArm = state.arms[chosenArmIndex];
  const reward = chosenArm.trueMean + randomNormal(state.rng);

  chosenArm.pulls += 1;
  chosenArm.rewardSum += reward;
  chosenArm.estimate += (reward - chosenArm.estimate) / chosenArm.pulls;

  state.latestArmIndex = chosenArmIndex;
  state.totalReward += reward;

  if (exploring) {
    state.exploreCount += 1;
  } else if (!guided) {
    state.exploitCount += 1;
  }

  const entry = {
    step: state.history.length + 1,
    armIndex: chosenArmIndex,
    reward,
    guided,
    optimal: chosenArmIndex === state.optimalArmIndex,
  };

  if (!guided) {
    entry.exploring = exploring;
  }

  if (reason) {
    entry.reason = reason;
    state.latestGuideReason = reason;
  }

  state.history.push(entry);
}

function finalizeBanditState(state, extra = {}) {
  return {
    config: state.config,
    arms: state.arms,
    optimalArmIndex: state.optimalArmIndex,
    latestArmIndex: state.latestArmIndex,
    history: state.history,
    exploreCount: state.exploreCount,
    exploitCount: state.exploitCount,
    totalReward: state.totalReward,
    latestGuideReason: state.latestGuideReason,
    ...extra,
  };
}

async function requestGuidedArm({ state, step, totalSteps, fetchImpl }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("local experimental bridge is unavailable");
  }

  const response = await fetchImpl(experimentalGuideEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createGuideRequest(state, step, totalSteps)),
  });

  if (!response?.ok) {
    throw new Error(`bridge returned ${response?.status ?? "an unknown status"}`);
  }

  const payload = await response.json();
  if (!Number.isInteger(payload?.armIndex)) {
    throw new Error("bridge returned an invalid arm index");
  }

  if (payload.armIndex < 0 || payload.armIndex >= state.arms.length) {
    throw new Error("bridge returned an out-of-range arm index");
  }

  return {
    armIndex: payload.armIndex,
    reason: typeof payload.reason === "string" ? payload.reason : "",
  };
}

function createGuideRequest(state, step, totalSteps) {
  return {
    step,
    totalSteps,
    arms: state.arms.map((arm) => ({
      index: arm.index,
      pulls: arm.pulls,
      estimate: arm.estimate,
      rewardSum: arm.rewardSum,
    })),
    history: state.history.map((entry) => {
      const shapedEntry = {
        step: entry.step,
        armIndex: entry.armIndex,
        reward: entry.reward,
      };

      if (typeof entry.exploring === "boolean") {
        shapedEntry.exploring = entry.exploring;
      }

      return shapedEntry;
    }),
  };
}

function render(result, roots) {
  const { summaryRoot, chartRoot, insightsRoot, historyRoot } = roots;
  const optimalSelections = result.history.filter((entry) => entry.optimal).length;
  const stepCount = Math.max(result.history.length, 1);
  const averageReward = result.totalReward / stepCount;
  const optimalSelectionRate = (optimalSelections / stepCount) * 100;
  const explorationRate = (result.exploreCount / stepCount) * 100;

  summaryRoot.innerHTML = renderSummary(result, averageReward, optimalSelectionRate, explorationRate);

  chartRoot.innerHTML = renderArms(result);
  insightsRoot.innerHTML = renderInsights(result, averageReward, optimalSelectionRate, explorationRate);
  historyRoot.innerHTML = renderHistory(result.history);
}

function renderSummary(result, averageReward, optimalSelectionRate, explorationRate) {
  const cards = [
    metricCard("Average reward", formatSigned(averageReward), "Reward earned per step."),
    metricCard("Optimal arm", `Arm ${result.optimalArmIndex + 1}`, "The hidden best arm under this seed."),
    metricCard("Optimal picks", `${optimalSelectionRate.toFixed(1)}%`, "How often the run found the best arm."),
  ];

  if (result.mode === "experimental-ollama-guided") {
    const detail = result.requestedSteps > result.config.steps
      ? `Requested ${result.requestedSteps} steps and capped the guide at ${result.config.steps} calls.`
      : "The experimental guide chose each arm while rewards stayed local to this lesson.";
    cards.push(metricCard("Execution mode", "Experimental Ollama", detail));
    return cards.join("");
  }

  cards.push(metricCard("Exploration share", `${explorationRate.toFixed(1)}%`, "Random probes caused by epsilon."));
  return cards.join("");
}

function metricCard(label, value, detail) {
  return `
    <article class="metric-card">
      <p class="metric-label">${label}</p>
      <p class="metric-value">${value}</p>
      <p class="history-meta">${detail}</p>
    </article>
  `;
}

function renderArms(result) {
  const values = result.arms.flatMap((arm) => [arm.trueMean, arm.estimate]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 0.0001);

  return result.arms
    .map((arm) => {
      const trueWidth = `${((arm.trueMean - minValue) / range) * 100}%`;
      const estimateWidth = `${((arm.estimate - minValue) / range) * 100}%`;
      const badges = [
        arm.index === result.optimalArmIndex ? '<span class="badge badge-optimal">Optimal</span>' : "",
        arm.index === result.latestArmIndex ? '<span class="badge badge-latest">Last pulled</span>' : "",
      ].join("");

      return `
        <article class="arm-card">
          <div class="arm-header">
            <div>
              <p class="metric-value">Arm ${arm.index + 1}</p>
              <p class="arm-meta">Pulled ${arm.pulls} times</p>
            </div>
            <div class="badge-row">${badges}</div>
          </div>

          <div class="bar-group">
            <div class="bar-row">
              <span class="bar-label">True mean</span>
              <div class="bar-track"><div class="bar-fill bar-fill-true" style="--bar-size: ${trueWidth};"></div></div>
            </div>
            <div class="bar-row">
              <span class="bar-label">Estimate</span>
              <div class="bar-track"><div class="bar-fill bar-fill-estimate" style="--bar-size: ${estimateWidth};"></div></div>
            </div>
          </div>

          <p class="history-meta">True = <span class="code">${arm.trueMean.toFixed(2)}</span> · Estimate = <span class="code">${arm.estimate.toFixed(2)}</span> · Total reward = <span class="code">${arm.rewardSum.toFixed(2)}</span></p>
        </article>
      `;
    })
    .join("");
}

function renderInsights(result, averageReward, optimalSelectionRate, explorationRate) {
  if (result.mode === "experimental-ollama-guided") {
    const bestEstimatedArm = argMax(result.arms, (arm) => arm.estimate) + 1;
    const estimateGap = Math.abs(result.arms[result.optimalArmIndex].estimate - result.arms[result.optimalArmIndex].trueMean);
    const cappedRun = result.requestedSteps > result.config.steps
      ? `RewardLab asked for <span class="code">${result.requestedSteps}</span> steps but capped the guide at <span class="code">${result.config.steps}</span> calls to keep the experiment modest.`
      : `This guided run used <span class="code">${result.config.steps}</span> local guide calls, with rewards and estimate updates still happening in the browser.`;

    return [
      insightCard(
        "Experimental guide",
        "RewardLab asked the experimental local guide to choose each arm, but the reward environment and running averages stayed inside the lesson UI."
      ),
      insightCard(
        "Call budget",
        cappedRun
      ),
      insightCard(
        "Did it find the best arm?",
        `The optimal arm was chosen <span class="code">${optimalSelectionRate.toFixed(1)}%</span> of the time. By the end, <span class="code">Arm ${bestEstimatedArm}</span> had the highest estimate, and the optimal arm's estimate missed its true mean by <span class="code">${estimateGap.toFixed(2)}</span> while average reward settled at <span class="code">${formatSigned(averageReward)}</span>.`
      ),
    ].join("");
  }

  const dominantMode = result.exploreCount > result.exploitCount ? "exploration" : "exploitation";
  const bestEstimatedArm = argMax(result.arms, (arm) => arm.estimate) + 1;
  const estimateGap = Math.abs(result.arms[result.optimalArmIndex].estimate - result.arms[result.optimalArmIndex].trueMean);

  return [
    insightCard(
      "Epsilon in practice",
      `With <span class="code">ε = ${result.config.epsilon.toFixed(2)}</span>, about <span class="code">${explorationRate.toFixed(1)}%</span> of decisions were random, so the policy stayed ${dominantMode === "exploration" ? "curious" : "mostly decisive"}.`
    ),
    insightCard(
      "What the learner believes",
      `After <span class="code">${result.config.steps}</span> steps, the highest estimated value belongs to <span class="code">Arm ${bestEstimatedArm}</span>. Compare that belief to the true-mean bar to see whether learning has converged.`
    ),
    insightCard(
      "Did it find the best arm?",
      `The optimal arm was chosen <span class="code">${optimalSelectionRate.toFixed(1)}%</span> of the time. Average reward settled at <span class="code">${formatSigned(averageReward)}</span>, and the optimal arm's estimate missed its true mean by <span class="code">${estimateGap.toFixed(2)}</span>.`
    ),
  ].join("");
}

function insightCard(title, body) {
  return `
    <article class="insight-card">
      <h3>${title}</h3>
      <p>${body}</p>
    </article>
  `;
}

function renderHistory(history) {
  const recent = history.slice(-10).reverse();
  if (recent.length === 0) {
    return '<p class="empty-state">Run a simulation to inspect the latest pulls.</p>';
  }

  const rows = recent
    .map(
      (entry) => `
        <tr>
          <td>${entry.step}</td>
          <td>Arm ${entry.armIndex + 1}</td>
          <td>${entry.guided ? "Guided" : entry.exploring ? "Explore" : "Exploit"}</td>
          <td>${formatSigned(entry.reward)}</td>
          <td>${entry.optimal ? "Yes" : "No"}</td>
        </tr>
      `
    )
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th>Step</th>
          <th>Choice</th>
          <th>Mode</th>
          <th>Reward</th>
          <th>Optimal?</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function clampInteger(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function createMulberry32(seed) {
  let state = seed >>> 0;

  return function next() {
    state += 0x6d2b79f5;
    let output = state;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function randomNormal(rng) {
  const u = Math.max(rng(), Number.MIN_VALUE);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function argMax(items, selector) {
  return items.reduce((bestIndex, item, index) => {
    if (selector(item) > selector(items[bestIndex])) {
      return index;
    }

    return bestIndex;
  }, 0);
}

function formatSigned(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function toErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "unknown error";
}

const rewardLabApp = {
  defaultControls,
  experimentalGuideEndpoint,
  guidedStepCap,
  initApp,
  writeControls,
  readControls,
  readRuntimeConfig,
  applyExperimentalAvailability,
  shouldUseExperimentalMode,
  runConfiguredSimulation,
  runSimulation,
  simulateBandit,
  simulateGuidedBandit,
  createGuideRequest,
  render,
  renderSummary,
  metricCard,
  renderArms,
  renderInsights,
  renderHistory,
  clampInteger,
  clampNumber,
  createMulberry32,
  randomNormal,
  argMax,
  formatSigned,
  toErrorMessage,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = rewardLabApp;
}

if (typeof window !== "undefined") {
  window.rewardLabApp = rewardLabApp;
}

initApp();
