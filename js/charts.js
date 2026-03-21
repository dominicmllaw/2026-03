// Tax Adviser Arena — Charts & S/D Diagram Renderer
// Uses Canvas API for S/D diagrams, Chart.js for scatter/bar charts

import { COLOURS } from './config.js';
import { generateCurvePoints, simulate } from './simulation.js';

// ── S/D Diagram (Canvas) ──

/**
 * Draw a supply/demand diagram on a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} roundConfig - { a, b, c, d, ... }
 * @param {number} taxRate - 0 for original, non-zero for shifted
 * @param {Object} options - { animate, showRevenue, showBurden, showLabels }
 */
export function drawSDDiagram(canvas, roundConfig, taxRate = 0, options = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const { a, b, c, d } = roundConfig;
  const showShift = taxRate !== 0 && options.showShift !== false;

  // Compute equilibria
  const Q0 = (a - c) / (b + d);
  const P0 = a - b * Q0;
  const Qt = taxRate !== 0 ? Math.max(0, (a - c - taxRate) / (b + d)) : Q0;
  const Pc = a - b * Qt;
  const Ps = Pc - taxRate;

  // Chart area with margins
  const margin = { top: 30, right: 30, bottom: 50, left: 55 };
  const cw = w - margin.left - margin.right;
  const ch = h - margin.top - margin.bottom;

  // Scale ranges
  const qMax = Q0 * 1.6;
  const pMax = Math.max(a, c + d * qMax, a + Math.abs(taxRate)) * 1.1;
  const pMin = Math.min(0, c - Math.abs(taxRate) * 0.5);
  const pRange = pMax - pMin;

  const scaleX = (q) => margin.left + (q / qMax) * cw;
  const scaleY = (p) => margin.top + ch - ((p - pMin) / pRange) * ch;

  // Clear
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  // Axes
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + ch);
  ctx.lineTo(margin.left + cw, margin.top + ch);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Quantity', margin.left + cw / 2, h - 8);
  ctx.save();
  ctx.translate(15, margin.top + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Price', 0, 0);
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
  if (showShift && options.showBurden && Qt > 0) {
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

  // Original equilibrium
  drawEquilibriumPoint(Q0, P0, '#1e293b', 'E₀');

  if (showShift && Qt > 0) {
    // New consumer price point (on demand curve)
    drawEquilibriumPoint(Qt, Pc, COLOURS.consumerBurden, options.showLabels ? `Pc=${Pc.toFixed(1)}` : 'Pc');
    // New producer price point
    drawEquilibriumPoint(Qt, Ps, COLOURS.producerBurden, options.showLabels ? `Ps=${Ps.toFixed(1)}` : 'Ps');
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
    ctx.fillText(taxRate > 0 ? 'S + tax' : 'S − sub', scaleX(ssEnd.x) + 5, scaleY(ssEnd.y));
  }

  // Price axis values
  ctx.fillStyle = COLOURS.textMuted;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  if (options.showLabels) {
    ctx.fillText(P0.toFixed(1), margin.left - 5, scaleY(P0) + 4);
    ctx.fillText(Q0.toFixed(1), scaleX(Q0), margin.top + ch + 15);
    if (showShift && Qt > 0) {
      ctx.fillText(Qt.toFixed(1), scaleX(Qt), margin.top + ch + 15);
    }
  }
}

// ── Chart.js Wrappers ──

let scatterChart = null;
let leaderboardChart = null;
let burdenChart = null;

/**
 * Render a scatter plot of group results.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} data - [{ group, x, y }]
 * @param {Object} options - { xLabel, yLabel, targetX, targetY }
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
        // Data labels plugin (if available)
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

  // Draw target lines if provided
  if (options.targetX != null || options.targetY != null) {
    const annotation = {
      type: 'line',
      borderColor: COLOURS.danger,
      borderWidth: 2,
      borderDash: [6, 4],
    };
    // We'll add annotations via plugin if available
  }

  return scatterChart;
}

/**
 * Render the leaderboard as a horizontal bar chart.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} leaderboard - sorted [{ group, total, rounds }]
 * @param {number} maxShow - max groups to show (default 8)
 */
export function renderLeaderboard(canvas, leaderboard, maxShow = 8) {
  if (leaderboardChart) leaderboardChart.destroy();

  const shown = leaderboard.slice(0, maxShow);
  const labels = shown.map(e => `Group ${e.group}`);

  // Stack by round
  const roundKeys = ['1', '2', '3', '4'];
  const roundColours = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];
  const roundLabels = ['R1: Tobacco', 'R2: Drinks', 'R3: Bags', 'R4: Subsidy'];

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
 * @param {HTMLCanvasElement} canvas
 * @param {Array} data - [{ group, predicted, actual }]
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
 * Draw a simple burden split bar (horizontal stacked bar, single row).
 * @param {HTMLCanvasElement} canvas
 * @param {number} consumerPct - consumer burden percentage
 */
export function drawBurdenBar(canvas, consumerPct) {
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

  // Consumer portion
  ctx.fillStyle = COLOURS.consumerBurden;
  ctx.fillRect(0, barY, consumerW, barH);

  // Producer portion
  ctx.fillStyle = COLOURS.producerBurden;
  ctx.fillRect(consumerW, barY, w - consumerW, barH);

  // Labels
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  if (consumerPct > 15) {
    ctx.fillText(`Consumer ${consumerPct}%`, consumerW / 2, barY + barH / 2 + 5);
  }
  if (producerPct > 15) {
    ctx.fillText(`Producer ${producerPct}%`, consumerW + (w - consumerW) / 2, barY + barH / 2 + 5);
  }

  // Top label
  ctx.fillStyle = COLOURS.text;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Burden Split', 0, 10);
}
