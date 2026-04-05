const defaultControls = {
  arms: 5,
  epsilon: 0.1,
  steps: 250,
  seed: 7,
};

const controlsForm = document.querySelector("#controls");
const resetButton = document.querySelector("#reset-controls");
const summaryRoot = document.querySelector("#summary");
const chartRoot = document.querySelector("#chart");
const insightsRoot = document.querySelector("#insights");
const historyRoot = document.querySelector("#history");

controlsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSimulation(readControls());
});

resetButton.addEventListener("click", () => {
  writeControls(defaultControls);
  runSimulation(defaultControls);
});

writeControls(defaultControls);
runSimulation(defaultControls);

function writeControls(values) {
  controlsForm.elements.arms.value = String(values.arms);
  controlsForm.elements.epsilon.value = values.epsilon.toFixed(2);
  controlsForm.elements.steps.value = String(values.steps);
  controlsForm.elements.seed.value = String(values.seed);
}

function readControls() {
  const arms = clampInteger(Number(controlsForm.elements.arms.value), 2, 12, defaultControls.arms);
  const epsilon = clampNumber(Number(controlsForm.elements.epsilon.value), 0, 1, defaultControls.epsilon);
  const steps = clampInteger(Number(controlsForm.elements.steps.value), 10, 5000, defaultControls.steps);
  const seed = clampInteger(Number(controlsForm.elements.seed.value), 1, 999999, defaultControls.seed);

  const normalized = { arms, epsilon, steps, seed };
  writeControls(normalized);
  return normalized;
}

function runSimulation(config) {
  const rng = createMulberry32(config.seed);
  const arms = Array.from({ length: config.arms }, (_, index) => ({
    index,
    trueMean: randomNormal(rng),
    pulls: 0,
    estimate: 0,
    rewardSum: 0,
  }));

  const optimalArmIndex = argMax(arms, (arm) => arm.trueMean);
  const history = [];
  let exploreCount = 0;
  let exploitCount = 0;
  let totalReward = 0;
  let latestArmIndex = 0;

  for (let step = 1; step <= config.steps; step += 1) {
    const exploring = rng() < config.epsilon || arms.every((arm) => arm.pulls === 0);
    const chosenArmIndex = exploring
      ? Math.floor(rng() * arms.length)
      : argMax(arms, (arm) => arm.estimate);
    const chosenArm = arms[chosenArmIndex];
    const reward = chosenArm.trueMean + randomNormal(rng);

    chosenArm.pulls += 1;
    chosenArm.rewardSum += reward;
    chosenArm.estimate += (reward - chosenArm.estimate) / chosenArm.pulls;

    latestArmIndex = chosenArmIndex;
    totalReward += reward;

    if (exploring) {
      exploreCount += 1;
    } else {
      exploitCount += 1;
    }

    history.push({
      step,
      armIndex: chosenArmIndex,
      reward,
      exploring,
      optimal: chosenArmIndex === optimalArmIndex,
    });
  }

  render({
    config,
    arms,
    optimalArmIndex,
    latestArmIndex,
    history,
    exploreCount,
    exploitCount,
    totalReward,
  });
}

function render(result) {
  const optimalSelections = result.history.filter((entry) => entry.optimal).length;
  const averageReward = result.totalReward / result.config.steps;
  const optimalSelectionRate = (optimalSelections / result.config.steps) * 100;
  const explorationRate = (result.exploreCount / result.config.steps) * 100;

  summaryRoot.innerHTML = [
    metricCard("Average reward", formatSigned(averageReward), "Reward earned per step."),
    metricCard("Optimal arm", `Arm ${result.optimalArmIndex + 1}`, "The hidden best arm under this seed."),
    metricCard("Optimal picks", `${optimalSelectionRate.toFixed(1)}%`, "How often the algorithm found the best arm."),
    metricCard("Exploration share", `${explorationRate.toFixed(1)}%`, "Random probes caused by epsilon."),
  ].join("");

  chartRoot.innerHTML = renderArms(result);
  insightsRoot.innerHTML = renderInsights(result, averageReward, optimalSelectionRate, explorationRate);
  historyRoot.innerHTML = renderHistory(result.history);
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
          <td>${entry.exploring ? "Explore" : "Exploit"}</td>
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
