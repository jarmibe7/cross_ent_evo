// ============================================================================
// CONSTANTS & STATE
// ============================================================================

const xMin = -10;
const xMax = 10;
const gridPoints = 500;
const epsilon = 1e-8;

const muP = 0.0;
const sigmaP = 1.0;
let muQ0 = 3.0;
let sigmaQ0 = 2.5;

const state = {
  isPlaying: false,
  direction: 1,
  t: 0,
};

const elements = {};

// ============================================================================
// MATHEMATICAL FUNCTIONS
// ============================================================================

function gaussianPdf(x, mu, sigma) {
  const variance = sigma * sigma;
  const diff = x - mu;
  return (1 / Math.sqrt(2 * Math.PI * variance)) * Math.exp(-(diff * diff) / (2 * variance));
}

function muQAt(t) {
  return (1 - t) * muQ0 + t * muP;
}

function sigmaQAt(t) {
  return (1 - t) * sigmaQ0 + t * sigmaP;
}

function entropyOfP() {
  return 0.5 * Math.log(2 * Math.PI * Math.E * sigmaP * sigmaP);
}

function klAt(t) {
  const sigmaQ = sigmaQAt(t);
  const mu = muQAt(t);
  return (
    Math.log(sigmaQ / sigmaP) +
    (sigmaP * sigmaP + (muP - mu) * (muP - mu)) / (2 * sigmaQ * sigmaQ) -
    0.5
  );
}

function crossEntropyAt(t) {
  return entropyOfP() + klAt(t);
}

function buildGrid() {
  const xs = [];
  const step = (xMax - xMin) / (gridPoints - 1);
  for (let i = 0; i < gridPoints; i += 1) {
    xs.push(xMin + i * step);
  }
  return xs;
}

// ============================================================================
// INITIALIZATION & UI CONTROL
// ============================================================================

function init() {
  elements.toggleButton = document.getElementById("toggleButton");
  elements.resetButton = document.getElementById("resetButton");
  elements.tSlider = document.getElementById("tSlider");
  elements.tValue = document.getElementById("tValue");
  elements.distPlot = document.getElementById("distPlot");
  elements.metricPlot = document.getElementById("metricPlot");
  elements.tStat = document.getElementById("tStat");
  elements.muQStat = document.getElementById("muQStat");
  elements.sigmaQStat = document.getElementById("sigmaQStat");
  elements.entropyStat = document.getElementById("entropyStat");
  elements.kldStat = document.getElementById("kldStat");
  elements.crossStat = document.getElementById("crossStat");

  elements.toggleButton.addEventListener("click", () => {
    state.isPlaying = !state.isPlaying;
    updateToggleLabel();
  });

  elements.resetButton.addEventListener("click", () => {
    state.t = 0;
    state.direction = 1;
    state.isPlaying = false;
    updateToggleLabel();
    syncSliderFromState();
    render();
  });

  elements.tSlider.addEventListener("input", () => {
    state.t = parseFloat(elements.tSlider.value);
    state.isPlaying = false;
    updateToggleLabel();
    syncSliderFromState();
    render();
  });

  const setParam = (btn, otherId, update) => {
    update();
    btn.classList.add("active");
    document.getElementById(otherId).classList.remove("active");
    render();
  };
  document.getElementById("btnNarrow").onclick = (e) => setParam(e.currentTarget, "btnWide", () => { sigmaQ0 = 0.5; });
  document.getElementById("btnWide").onclick = (e) => setParam(e.currentTarget, "btnNarrow", () => { sigmaQ0 = 2.5; });
  document.getElementById("btnClose").onclick = (e) => setParam(e.currentTarget, "btnFar", () => { muQ0 = 1.0; });
  document.getElementById("btnFar").onclick = (e) => setParam(e.currentTarget, "btnClose", () => { muQ0 = 3.0; });

  updateToggleLabel();
  syncSliderFromState();
  render();
  requestAnimationFrame(step);
}

function updateToggleLabel() {
  elements.toggleButton.textContent = state.isPlaying ? "Pause" : "Play";
}

function syncSliderFromState() {
  elements.tSlider.value = state.t.toFixed(3);
  elements.tValue.textContent = state.t.toFixed(3);
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

function renderDistPlot(pValues, qValues) {
  const width = 560;
  const height = 320;
  const padding = 24;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const maxVal = gaussianPdf(0, 0, Math.min(sigmaP, sigmaQ0));

  const pPoints = pValues.map((value, index) => {
    const x = padding + (index / (pValues.length - 1)) * innerWidth;
    const y = height - padding - (value / maxVal) * innerHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const qPoints = qValues.map((value, index) => {
    const x = padding + (index / (qValues.length - 1)) * innerWidth;
    const y = height - padding - (value / maxVal) * innerHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const baselineY = height - padding;
  elements.distPlot.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="transparent"></rect>
    <line x1="${padding}" y1="${baselineY}" x2="${width - padding}" y2="${baselineY}" stroke="rgba(255,255,255,0.25)" stroke-width="1"></line>
    <path d="M ${padding},${baselineY} L ${pPoints.join(" L ")} L ${width - padding},${baselineY} Z" fill="rgba(100,181,246,0.16)" stroke="none"></path>
    <path d="M ${padding},${baselineY} L ${qPoints.join(" L ")} L ${width - padding},${baselineY} Z" fill="rgba(74,222,128,0.12)" stroke="none"></path>
    <polyline points="${pPoints.join(" ")}" fill="none" stroke="#64b5f6" stroke-width="3"></polyline>
    <polyline points="${qPoints.join(" ")}" fill="none" stroke="#4ade80" stroke-width="3"></polyline>
  `;
}

function renderMetricPlot(tGrid, entropyLine, kldLine, crossLine) {
  const width = 560;
  const height = 320;
  const padding = 28;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const allVals = [...entropyLine, ...kldLine, ...crossLine];
  const maxVal = Math.max(...allVals, 0.01);
  const minVal = Math.min(...allVals, 0);
  const range = Math.max(maxVal - minVal, 0.01);

  function toPoints(values) {
    return values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * innerWidth;
      const y = height - padding - ((value - minVal) / range) * innerHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
  }

  const entropyPoints = toPoints(entropyLine);
  const kldPoints = toPoints(kldLine);
  const crossPoints = toPoints(crossLine);

  const tIndex = Math.min(tGrid.length - 1, Math.round(state.t * (tGrid.length - 1)));
  const trackerX = padding + (tIndex / (tGrid.length - 1)) * innerWidth;

  function markerY(values) {
    return height - padding - ((values[tIndex] - minVal) / range) * innerHeight;
  }

  const baselineY = height - padding;
  elements.metricPlot.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="transparent"></rect>
    <line x1="${padding}" y1="${baselineY}" x2="${width - padding}" y2="${baselineY}" stroke="rgba(255,255,255,0.25)" stroke-width="1"></line>
    <line x1="${trackerX.toFixed(2)}" y1="${padding}" x2="${trackerX.toFixed(2)}" y2="${baselineY}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-dasharray="4 4"></line>
    <polyline points="${entropyPoints.join(" ")}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-dasharray="6 4"></polyline>
    <polyline points="${kldPoints.join(" ")}" fill="none" stroke="#f5a623" stroke-width="3"></polyline>
    <polyline points="${crossPoints.join(" ")}" fill="none" stroke="#c792ea" stroke-width="3"></polyline>
    <circle cx="${trackerX.toFixed(2)}" cy="${markerY(entropyLine).toFixed(2)}" r="4" fill="rgba(255,255,255,0.8)" />
    <circle cx="${trackerX.toFixed(2)}" cy="${markerY(kldLine).toFixed(2)}" r="5" fill="#f5a623" />
    <circle cx="${trackerX.toFixed(2)}" cy="${markerY(crossLine).toFixed(2)}" r="5" fill="#c792ea" />
    <text x="${padding + 6}" y="${padding + 14}" fill="rgba(255,255,255,0.7)" font-size="12">H(P): ${entropyLine[0].toFixed(3)}</text>
    <text x="${padding + 6}" y="${padding + 30}" fill="#f5a623" font-size="12">D_KL: ${kldLine[tIndex].toFixed(3)}</text>
    <text x="${padding + 6}" y="${padding + 46}" fill="#c792ea" font-size="12">H(P,Q): ${crossLine[tIndex].toFixed(3)}</text>
  `;
}

function renderStats(t, muQ, sigmaQ, entropy, kld, crossEntropy) {
  elements.tStat.textContent = t.toFixed(3);
  elements.muQStat.textContent = muQ.toFixed(3);
  elements.sigmaQStat.textContent = sigmaQ.toFixed(3);
  elements.entropyStat.textContent = entropy.toFixed(3);
  elements.kldStat.textContent = kld.toFixed(3);
  elements.crossStat.textContent = crossEntropy.toFixed(3);
}

function render() {
  const t = state.t;
  const muQ = muQAt(t);
  const sigmaQ = sigmaQAt(t);

  const xs = buildGrid();
  const pValues = xs.map((x) => Math.max(gaussianPdf(x, muP, sigmaP), epsilon));
  const qValues = xs.map((x) => Math.max(gaussianPdf(x, muQ, sigmaQ), epsilon));
  renderDistPlot(pValues, qValues);

  const tSteps = 200;
  const tGrid = [];
  const entropyLine = [];
  const kldLine = [];
  const crossLine = [];
  const entropy = entropyOfP();
  for (let i = 0; i < tSteps; i += 1) {
    const tt = i / (tSteps - 1);
    tGrid.push(tt);
    entropyLine.push(entropy);
    kldLine.push(klAt(tt));
    crossLine.push(entropy + klAt(tt));
  }
  renderMetricPlot(tGrid, entropyLine, kldLine, crossLine);

  const kld = klAt(t);
  renderStats(t, muQ, sigmaQ, entropy, kld, entropy + kld);
}

// ============================================================================
// ANIMATION
// ============================================================================

function step() {
  if (state.isPlaying) {
    state.t += state.direction * 0.004;
    if (state.t >= 1) {
      state.t = 1;
      state.direction = -1;
    } else if (state.t <= 0) {
      state.t = 0;
      state.direction = 1;
    }
    syncSliderFromState();
    render();
  }
  requestAnimationFrame(step);
}

document.addEventListener("DOMContentLoaded", init);