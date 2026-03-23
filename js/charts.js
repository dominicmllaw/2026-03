// Tax Adviser Arena — Charts & S/D Diagram Renderer
// Uses Canvas API for S/D diagrams, Chart.js for scatter/bar charts

import { COLOURS, ROUNDS } from './config.js';
import { generateCurvePoints, simulate } from './simulation.js';

// ── S/D Diagram (Canvas) ──

/**
 * Draw a supply/demand diagram on a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} roundConfig - { a, b, c, d, ... }
 * @param {number} taxRate - 0 for original, non-zero for shifted
 * @param {Object} options - { animate, showRevenue, showBurden, showLabels, isSubsidy }
 */
export function drawSDDiagram(canvas, roundConfig, taxRate = 0, options = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const showShift = taxRate !== 0 && options.showShift !== false;
  const isPerfInelastic = roundConfig.perfectlyInelastic;

  // Compute equilibria
  let Q0, P0, Qt, Pc, Ps;
  if (isPerfInelastic) {
    const { c, d, fixedQuantity } = roundConfig;
    Q0 = fixedQuantity;
    P0 = c + d * Q0;
    Qt = Q0; // quantity never changes
    Pc = P0 + taxRate;
    Ps = P0;
  } else {
    const { a, b, c, d } = roundConfig;
    Q0 = (a - c) / (b + d);
    P0 = a - b * Q0;
    Qt = taxRate !== 0 ? Math.max(0, (a - c - taxRate) / (b + d)) : Q0;
    Pc = a - b * Qt;
    Ps = Pc - taxRate;
  }

  // Chart area with margins (extra space for tick labels)
  const margin = { top: 30, right: 30, bottom: 55, left: 65 };
  const cw = w - margin.left - margin.right;
  const ch = h - margin.top - margin.bottom;

  // Scale ranges
  const qMax = Q0 * 1.6;
  const a = roundConfig.a || 0;
  const c = roundConfig.c || 0;
  const d = roundConfig.d || 0;
  const pMaxCandidates = isPerfInelastic
    ? [P0 + Math.abs(taxRate) + 5, c + d * qMax]
    : [a, c + d * qMax, a + Math.abs(taxRate)];
  const pMax = Math.max(...pMaxCandidates) * 1.1;
  const pMin = 0; // always start from 0
  const pRange = pMax - pMin;

  const scaleX = (q) => margin.left + (q / qMax) * cw;
  const scaleY = (p) => margin.top + ch - ((p - pMin) / pRange) * ch;

  // Clear
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  // ── Grid and tick marks ──
  const xTicks = niceTicks(0, qMax, 5);
  const yTicks = niceTicks(pMin, pMax, 5);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 0.5;
  // Horizontal grid lines
  yTicks.forEach(p => {
    const y = scaleY(p);
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + cw, y);
    ctx.stroke();
  });
  // Vertical grid lines
  xTicks.forEach(q => {
    const x = scaleX(q);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + ch);
    ctx.stroke();
  });

  // Axes
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + ch);
  ctx.lineTo(margin.left + cw, margin.top + ch);
  ctx.stroke();

  // Tick marks and labels on Y axis
  ctx.fillStyle = COLOURS.textMuted;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  yTicks.forEach(p => {
    const y = scaleY(p);
    ctx.beginPath();
    ctx.moveTo(margin.left - 4, y);
    ctx.lineTo(margin.left, y);
    ctx.stroke();
    ctx.fillText(formatNum(p), margin.left - 7, y + 4);
  });

  // Tick marks and labels on X axis
  ctx.textAlign = 'center';
  xTicks.forEach(q => {
    const x = scaleX(q);
    ctx.beginPath();
    ctx.moveTo(x, margin.top + ch);
    ctx.lineTo(x, margin.top + ch + 4);
    ctx.stroke();
    ctx.fillText(formatNum(q), x, margin.top + ch + 16);
  });

  // Axis labels with units (Issue 3)
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Q (units)', margin.left + cw / 2, h - 5);
  ctx.save();
  ctx.translate(14, margin.top + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('P ($)', 0, 0);
  ctx.restore();

  // ── Revenue rectangle (if showing) ──
  if (showShift && options.showRevenue && Qt > 0) {
    ctx.fillStyle = COLOURS.revenue;
    const x1 = scaleX(0);
    const x2 = scaleX(Qt);
    const y1 = scaleY(Pc);
    const y2 = scaleY(Ps);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  }

  // ── Burden shading ──
  if (showShift && options.showBurden && Qt > 0 && taxRate > 0) {
    // Consumer burden (above P0, below Pc)
    ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
    ctx.fillRect(scaleX(0), scaleY(Pc), scaleX(Qt) - scaleX(0), scaleY(P0) - scaleY(Pc));
    // Producer burden (above Ps, below P0)
    ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
    ctx.fillRect(scaleX(0), scaleY(P0), scaleX(Qt) - scaleX(0), scaleY(Ps) - scaleY(P0));
  }

  // ── Draw curves ──
  function drawLine(points, colour, dashed = false) {
    if (points.length < 2) return;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dashed ? [6, 4] : []);
    ctx.beginPath();
    ctx.moveTo(scaleX(points[0].x), scaleY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(scaleX(points[i].x), scaleY(points[i].y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const curves = generateCurvePoints(roundConfig, showShift ? taxRate : 0);
  drawLine(curves.demand, COLOURS.demand);
  drawLine(curves.supply, COLOURS.supply);
  if (showShift) {
    drawLine(curves.supplyShifted, COLOURS.supplyShifted, true);
  }

  // ── Equilibrium dots and dashed lines ──
  function drawEquilibriumPoint(q, p, colour, label) {
    // Dashed lines to axes
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(scaleX(q), scaleY(p));
    ctx.lineTo(scaleX(q), scaleY(pMin));
    ctx.moveTo(scaleX(q), scaleY(p));
    ctx.lineTo(margin.left, scaleY(p));
    ctx.stroke();
    ctx.setLineDash([]);

    // Dot
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(scaleX(q), scaleY(p), 5, 0, Math.PI * 2);
    ctx.fill();

    // Label
    if (label) {
      ctx.fillStyle = colour;
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, scaleX(q) + 8, scaleY(p) - 8);
    }
  }

  // Original equilibrium with coordinates (Issue 3)
  const eqLabel = options.showLabels
    ? `E\u2080 (${formatNum(Q0)}, ${formatNum(P0)})`
    : 'E\u2080';
  drawEquilibriumPoint(Q0, P0, '#1e293b', eqLabel);

  if (showShift && Qt > 0) {
    const pcLabel = options.showLabels
      ? `Pc=$${Pc.toFixed(1)}`
      : 'Pc';
    const psLabel = options.showLabels
      ? `Ps=$${Ps.toFixed(1)}`
      : 'Ps';
    drawEquilibriumPoint(Qt, Pc, COLOURS.consumerBurden, pcLabel);
    drawEquilibriumPoint(Qt, Ps, COLOURS.producerBurden, psLabel);

    // Tax wedge bracket
    if (options.showLabels) {
      const xWedge = scaleX(Qt) + 40;
      const yTop = scaleY(Pc);
      const yBot = scaleY(Ps);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xWedge - 5, yTop);
      ctx.lineTo(xWedge, yTop);
      ctx.lineTo(xWedge, yBot);
      ctx.lineTo(xWedge - 5, yBot);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      const wedgeLabel = 'tax';
      ctx.fillText(`${wedgeLabel}=$${Math.abs(taxRate).toFixed(1)}`, xWedge + 4, (yTop + yBot) / 2 + 4);
    }

    // New equilibrium label with coordinates
    if (options.showLabels) {
      ctx.fillStyle = COLOURS.supplyShifted;
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`E\u2081 (${formatNum(Qt)}, ${formatNum(Pc)})`, scaleX(Qt) + 8, scaleY(Pc) + 18);
    }
  }

  // Curve labels
  ctx.font = 'bold 13px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  const dEnd = curves.demand[curves.demand.length - 1];
  if (dEnd) {
    ctx.fillStyle = COLOURS.demand;
    ctx.fillText('D', scaleX(dEnd.x) + 5, scaleY(dEnd.y));
  }
  const sEnd = curves.supply[curves.supply.length - 1];
  if (sEnd) {
    ctx.fillStyle = COLOURS.supply;
    ctx.fillText('S', scaleX(sEnd.x) + 5, scaleY(sEnd.y));
  }
  if (showShift && curves.supplyShifted.length > 0) {
    const ssEnd = curves.supplyShifted[curves.supplyShifted.length - 1];
    ctx.fillStyle = COLOURS.supplyShifted;
    ctx.fillText('S + tax', scaleX(ssEnd.x) + 5, scaleY(ssEnd.y));
  }
}

// ── Nice tick computation ──

function niceTicks(min, max, targetCount) {
  const range = max - min;
  if (range <= 0) return [min];
  const roughStep = range / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  let step;
  if (residual <= 1.5) step = magnitude;
  else if (residual <= 3.5) step = 2 * magnitude;
  else if (residual <= 7.5) step = 5 * magnitude;
  else step = 10 * magnitude;

  const ticks = [];
  const start = Math.ceil(min / step) * step;
  for (let t = start; t <= max + step * 0.01; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }
  return ticks;
}

function formatNum(n) {
  if (Number.isInteger(n)) return n.toString();
  if (Math.abs(n - Math.round(n)) < 0.01) return Math.round(n).toString();
  return n.toFixed(1);
}

// ── Chart.js Wrappers ──

let scatterChart = null;
let leaderboardChart = null;
let burdenChart = null;

/**
 * Render a scatter plot of group results.
 */
export function renderScatterPlot(canvas, data, options = {}) {
  if (scatterChart) scatterChart.destroy();

  const datasets = [{
    data: data.map(d => ({ x: d.x, y: d.y })),
    backgroundColor: COLOURS.primary,
    pointRadius: 8,
    pointHoverRadius: 12,
  }];

  scatterChart = new Chart(canvas, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = data[ctx.dataIndex];
              return `Group ${d.group}: ${options.xLabel || 'X'}=${d.x.toFixed(1)}, ${options.yLabel || 'Y'}=${d.y.toFixed(1)}`;
            }
          }
        },
        datalabels: {
          display: true,
          formatter: (value, ctx) => `G${data[ctx.dataIndex].group}`,
          color: '#fff',
          font: { weight: 'bold', size: 10 },
          anchor: 'center',
          align: 'center',
        }
      },
      scales: {
        x: {
          title: { display: true, text: options.xLabel || 'Tax Rate' },
          beginAtZero: true,
        },
        y: {
          title: { display: true, text: options.yLabel || 'Revenue' },
          beginAtZero: true,
        }
      },
      onClick: (event, elements) => {
        if (elements.length > 0 && options.onClickGroup) {
          const idx = elements[0].index;
          options.onClickGroup(data[idx].group);
        }
      }
    },
    plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [],
  });

  return scatterChart;
}

/**
 * Render the leaderboard as a horizontal bar chart.
 */
export function renderLeaderboard(canvas, leaderboard, maxShow = 8) {
  if (leaderboardChart) leaderboardChart.destroy();

  const shown = leaderboard.slice(0, maxShow);
  const labels = shown.map(e => `Group ${e.group}`);

  const palette = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
  const roundKeys = [];
  const roundColours = [];
  const roundLabels = [];
  for (let i = 1; i < ROUNDS.length; i++) {
    if (!ROUNDS[i]) continue;
    roundKeys.push(String(i));
    roundColours.push(palette[(i - 1) % palette.length]);
    roundLabels.push(`R${i}: ${ROUNDS[i].subtitle.split(' ')[0]}`);
  }

  const datasets = roundKeys.map((key, i) => ({
    label: roundLabels[i],
    data: shown.map(e => e.rounds?.[key] || 0),
    backgroundColor: roundColours[i],
  }));

  leaderboardChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
      },
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: 'Total Score' },
          beginAtZero: true,
        },
        y: { stacked: true },
      },
    },
  });

  return leaderboardChart;
}

/**
 * Render burden prediction comparison (grouped bar).
 */
export function renderBurdenComparison(canvas, data) {
  if (burdenChart) burdenChart.destroy();

  const labels = data.map(d => `G${d.group}`);

  burdenChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Predicted (consumer %)',
          data: data.map(d => d.predicted),
          backgroundColor: 'rgba(249, 115, 22, 0.7)',
        },
        {
          label: 'Actual (consumer %)',
          data: data.map(d => d.actual),
          backgroundColor: 'rgba(139, 92, 246, 0.7)',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Consumer Burden %' },
        },
      },
    },
  });

  return burdenChart;
}

/**
 * Draw a simple burden/benefit split bar (horizontal stacked bar, single row).
 * @param {HTMLCanvasElement} canvas
 * @param {number} consumerPct - consumer burden/benefit percentage
 * @param {boolean} isSubsidy - use "benefit" labels instead of "burden"
 */
export function drawBurdenBar(canvas, consumerPct, isSubsidy = false) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const barH = Math.min(h - 30, 40);
  const barY = 15;
  const consumerW = (consumerPct / 100) * w;
  const producerPct = 100 - consumerPct;

  const consumerLabel = isSubsidy ? 'Consumer benefit' : 'Consumer burden';
  const producerLabel = isSubsidy ? 'Producer benefit' : 'Producer burden';

  // Consumer portion
  ctx.fillStyle = COLOURS.consumerBurden;
  ctx.fillRect(0, barY, consumerW, barH);

  // Producer portion
  ctx.fillStyle = COLOURS.producerBurden;
  ctx.fillRect(consumerW, barY, w - consumerW, barH);

  // Labels
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  if (consumerPct > 20) {
    ctx.fillText(`${consumerLabel} ${consumerPct}%`, consumerW / 2, barY + barH / 2 + 5);
  }
  if (producerPct > 20) {
    ctx.fillText(`${producerLabel} ${producerPct}%`, consumerW + (w - consumerW) / 2, barY + barH / 2 + 5);
  }

  // Top label
  ctx.fillStyle = COLOURS.text;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(isSubsidy ? 'Benefit Split' : 'Burden Split', 0, 10);
}
