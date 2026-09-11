const PALETTE = ['#2f6f4f', '#c26a00', '#b3261e', '#a68b00', '#3a7d3a', '#5b7fa6', '#8a5aa6', '#a65a5a'];

function formatHours(hours) {
  if (hours == null) return '—';
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

async function loadSummary() {
  const res = await fetch('/api/dashboard/summary');
  const s = await res.json();
  const cardsEl = document.getElementById('cards');
  cardsEl.innerHTML = `
    <div class="card"><div class="value">${s.total}</div><div class="label">Total</div></div>
    <div class="card"><div class="value">${s.open}</div><div class="label">Open</div></div>
    <div class="card"><div class="value">${s.in_progress}</div><div class="label">In Progress</div></div>
    <div class="card"><div class="value">${s.resolved}</div><div class="label">Resolved</div></div>
    <div class="card overdue"><div class="value">${s.overdue}</div><div class="label">Overdue</div></div>
    <div class="card"><div class="value">${formatHours(s.avg_resolution_hours)}</div><div class="label">Avg Resolution</div></div>
  `;
}

async function loadStatusChart() {
  const res = await fetch('/api/dashboard/status');
  const rows = await res.json();
  new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: {
      labels: rows.map((r) => r.status),
      datasets: [{ data: rows.map((r) => r.count), backgroundColor: PALETTE }],
    },
  });
}

async function loadPlantChart() {
  const res = await fetch('/api/dashboard/by-plant');
  const rows = await res.json();
  new Chart(document.getElementById('chart-plant'), {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.plant),
      datasets: [{ label: 'Complaints', data: rows.map((r) => r.count), backgroundColor: PALETTE[0] }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });
}

async function loadSkuChart() {
  const res = await fetch('/api/dashboard/by-sku');
  const rows = await res.json();
  new Chart(document.getElementById('chart-sku'), {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.sku),
      datasets: [{ label: 'Complaints', data: rows.map((r) => r.count), backgroundColor: PALETTE[1] }],
    },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
  });
}

async function loadTrendChart() {
  const res = await fetch('/api/dashboard/trend');
  const rows = await res.json();
  new Chart(document.getElementById('chart-trend'), {
    type: 'line',
    data: {
      labels: rows.map((r) => r.date.slice(5)),
      datasets: [{ label: 'Complaints logged', data: rows.map((r) => r.count), borderColor: PALETTE[0], tension: 0.2 }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });
}

loadSummary();
loadStatusChart();
loadPlantChart();
loadSkuChart();
loadTrendChart();
