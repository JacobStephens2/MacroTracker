import { weight as weightApi } from '../api';
import { todayStr } from '../state';
import type { WeightLog } from '../types';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

let chartInstance: Chart | null = null;

export function weightView() {
  return {
    html: `
      <div class="page">
        <header class="page-header">
          <h1>Weight</h1>
        </header>

        <form id="weight-form" class="weight-form">
          <div class="weight-form-row">
            <div class="form-group" style="flex:1">
              <label for="weight-date">Date</label>
              <input type="date" id="weight-date" value="${todayStr()}" />
            </div>
            <div class="form-group" style="flex:1">
              <label for="weight-time">Time</label>
              <input type="time" id="weight-time" value="${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}" />
            </div>
          </div>
          <div class="form-group">
            <label for="weight-lbs">Weight (lbs)</label>
            <input type="number" id="weight-lbs" step="0.1" min="50" max="500" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block">Log Weight</button>
        </form>

        <div class="chart-container">
          <canvas id="weight-chart"></canvas>
        </div>

        <div id="weight-history" class="weight-history">
          <div class="loading-spinner">Loading...</div>
        </div>
      </div>
    `,
    init: () => {
      document.getElementById('weight-form')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = (document.getElementById('weight-date') as HTMLInputElement).value;
        const time = (document.getElementById('weight-time') as HTMLInputElement).value;
        const lbs = parseFloat((document.getElementById('weight-lbs') as HTMLInputElement).value);
        if (!date || !lbs) return;

        const btn = (e.target as HTMLFormElement).querySelector('button') as HTMLButtonElement;
        btn.disabled = true;
        try {
          await weightApi.log(date, lbs, time);
          (document.getElementById('weight-lbs') as HTMLInputElement).value = '';
          loadWeightData();
        } catch {
          alert('Failed to log weight');
        }
        btn.disabled = false;
      });

      loadWeightData();
    },
  };
}

async function loadWeightData() {
  try {
    const { logs } = await weightApi.list(90);
    renderChart(logs);
    renderHistory(logs);
  } catch {
    const container = document.getElementById('weight-history');
    if (container) container.innerHTML = '<p class="form-error">Failed to load weight data</p>';
  }
}

function renderChart(logs: WeightLog[]) {
  const canvas = document.getElementById('weight-chart') as HTMLCanvasElement;
  if (!canvas) return;

  // Sort chronologically
  const sorted = [...logs].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    return (a.time || '').localeCompare(b.time || '');
  });
  const labels = sorted.map((l) => {
    const d = new Date(l.date + 'T12:00:00');
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return l.time ? `${dateStr} ${l.time}` : dateStr;
  });
  const data = sorted.map((l) => l.weight_lbs);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weight (lbs)',
          data,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#10B981',
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} lbs`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (val) => `${val} lbs`,
          },
        },
        x: {
          ticks: {
            maxTicksLimit: 8,
          },
        },
      },
    },
  });
}

function renderHistory(logs: WeightLog[]) {
  const container = document.getElementById('weight-history');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = '<p class="text-muted">No weight entries yet. Log your first one above!</p>';
    return;
  }

  let html = '<h3>Recent Entries</h3>';
  for (const log of logs.slice(0, 14)) {
    const d = new Date(log.date + 'T12:00:00');
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = log.time ? ` at ${log.time}` : '';
    html += `
      <div class="weight-entry">
        <span class="weight-date">${dateStr}${timeStr}</span>
        <span class="weight-value">${log.weight_lbs} lbs</span>
        <button class="btn-icon btn-delete-weight" data-id="${log.id}">&times;</button>
      </div>
    `;
  }
  container.innerHTML = html;

  container.querySelectorAll('.btn-delete-weight').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt((btn as HTMLElement).dataset.id || '0');
      if (id && confirm('Delete this entry?')) {
        try {
          await weightApi.delete(id);
          loadWeightData();
        } catch {
          // Ignore
        }
      }
    });
  });
}
