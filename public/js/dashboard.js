const SALA_NAMES = [
  'Lab Inovacao', 'Sala de Reuniao A', 'Auditorio Principal',
  'Sala Makers', 'Biblioteca', 'Lab Computacao',
  'Sala de Aula 201', 'Coworking'
];

// Estado dos sensores — preenchido pela API
let sensorState = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  device_id: `presence0${i + 1}`,
  topic: `v3/espm/devices/presence0${i + 1}/up`,
  nome: SALA_NAMES[i],
  ocupado: 0,
  bateria: 0,
  delta: null,
  ultima_data: null
}));

const liveHistory = [];

// ─── Busca dados reais da API ───────────────────────────────────────────────
async function fetchSensorData() {
  try {
    const res = await fetch('/monitoramentoTempoReal');
    if (!res.ok) throw new Error('Erro na resposta');
    const json = await res.json();
    const dados = json.sensorState || [];

    dados.forEach(row => {
      const s = sensorState.find(s => s.id === row.id_sensor);
      if (!s) return;
      s.ocupado    = row.ocupado ?? 0;
      s.bateria    = row.bateria ?? 0;
      s.delta      = row.delta_agora ?? null;
      s.ultima_data = new Date();
    });

    const occ = sensorState.filter(s => s.ocupado).length;
    liveHistory.push({ t: new Date(), occ });
    if (liveHistory.length > 40) liveHistory.shift();

    document.getElementById('last-update').textContent = 'Atualizado agora';
  } catch (err) {
    console.warn('Erro ao buscar dados:', err);
    document.getElementById('last-update').textContent = 'Erro ao atualizar';
  }
}

// ─── Histórico do banco ──────────────────────────────────────────────────────
let historico = [];

async function fetchHistorico(dias = 30) {
  try {
    const res = await fetch(`/historico?dias=${dias}`);
    if (!res.ok) return;
    const json = await res.json();
    historico = json.historico || [];
  } catch (err) {
    console.warn('Histórico indisponível:', err);
  }
}

// ─── Utilitários ────────────────────────────────────────────────────────────
function fmt(sec) {
  if (sec === null || sec === undefined) return '--';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function padZ(n) { return String(n).padStart(2, '0'); }
function lerp(a, b, t) { return a + (b - a) * t; }

// ─── Relógio ─────────────────────────────────────────────────────────────────
function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    `${padZ(n.getHours())}:${padZ(n.getMinutes())}:${padZ(n.getSeconds())}`;
  document.getElementById('date-label').textContent =
    n.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}
updateClock(); setInterval(updateClock, 1000);

// ─── Navegação ───────────────────────────────────────────────────────────────
const pages = {};
document.querySelectorAll('.page').forEach(p => { pages[p.id.replace('page-', '')] = p; });
const navItems = document.querySelectorAll('.nav-item');

function goTo(name) {
  navItems.forEach(n => n.classList.toggle('active', n.dataset.page === name));
  Object.entries(pages).forEach(([k, el]) => el.classList.toggle('active', k === name));
  if (name === 'dashboard') renderDashboard();
  if (name === 'salas')     renderSalasTable();
  if (name === 'historico') renderHistorico();
  if (name === 'heatmap')   renderHeatmap();
  if (name === 'sensores')  renderSensores();
}

navItems.forEach(n => n.addEventListener('click', () => goTo(n.dataset.page)));

// ─── Cores dos gráficos ──────────────────────────────────────────────────────
const C = {
  BG: '#111820', BORDER: '#1e2d3d', TEXT: '#5e7a91',
  ACCENT: '#00e5ff', GREEN: '#00ff88', RED: '#ff4560', MUTED: '#3a5068'
};

// ─── Canvas helpers ──────────────────────────────────────────────────────────
function clearChart(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

function resizeCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width  = rect.width  || 600;
  canvas.height = parseInt(canvas.getAttribute('height')) || 200;
  return canvas;
}

function drawGrid(ctx, w, h, pad, rows) {
  ctx.strokeStyle = C.BORDER; ctx.lineWidth = 1;
  for (let i = 0; i <= rows; i++) {
    const y = pad.top + (h - pad.top - pad.bottom) * (i / rows);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
  }
}

function drawLineChart(canvas, labels, datasets) {
  resizeCanvas(canvas);
  const ctx = clearChart(canvas);
  const w = canvas.width, h = canvas.height;
  const pad = { top: 20, right: 20, bottom: 36, left: 52 };
  const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  let min = Infinity, max = -Infinity;
  datasets.forEach(ds => ds.data.forEach(v => { if (v < min) min = v; if (v > max) max = v; }));
  const range = max - min || 1;
  const minP = min - range * .1, maxP = max + range * .1, rangeP = maxP - minP || 1;
  drawGrid(ctx, w, h, pad, 4);
  ctx.fillStyle = C.TEXT; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = minP + rangeP * (1 - i / 4), y = pad.top + ch * (i / 4);
    ctx.fillText(Math.round(v), pad.left - 6, y + 4);
  }
  ctx.textAlign = 'center';
  const step = Math.ceil(labels.length / 8);
  labels.forEach((l, i) => {
    if (i % step !== 0) return;
    ctx.fillText(l, pad.left + cw * (i / (labels.length - 1)), h - pad.bottom + 16);
  });
  datasets.forEach(ds => {
    const pts = ds.data.map((v, i) => [
      pad.left + cw * (i / (ds.data.length - 1)),
      pad.top + ch * (1 - (v - minP) / rangeP)
    ]);
    if (ds.fill) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.lineTo(pts[pts.length - 1][0], pad.top + ch); ctx.lineTo(pts[0][0], pad.top + ch); ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
      grad.addColorStop(0, ds.color + '33'); grad.addColorStop(1, ds.color + '00');
      ctx.fillStyle = grad; ctx.fill();
    }
    ctx.strokeStyle = ds.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
    pts.forEach(([x, y], i) => {
      if (i === pts.length - 1) {
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = ds.color; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.strokeStyle = ds.color + '44'; ctx.lineWidth = 2; ctx.stroke();
      }
    });
  });
  if (datasets.length > 1) {
    let lx = pad.left; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'left';
    datasets.forEach(ds => {
      ctx.fillStyle = ds.color; ctx.fillRect(lx, 6, 12, 3);
      ctx.fillStyle = C.TEXT; ctx.fillText(ds.label || '', lx + 16, 12);
      lx += ctx.measureText(ds.label || '').width + 36;
    });
  }
}

function drawBarChart(canvas, labels, datasets, opts = {}) {
  resizeCanvas(canvas);
  const ctx = clearChart(canvas);
  const w = canvas.width, h = canvas.height;
  const pad = { top: 20, right: 16, bottom: 40, left: 52 };
  const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  let max = 0;
  datasets.forEach(ds => ds.data.forEach(v => { if (v > max) max = v; }));
  max = max * 1.1 || 1;
  drawGrid(ctx, w, h, pad, 4);
  ctx.fillStyle = C.TEXT; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = max * (1 - i / 4), y = pad.top + ch * (i / 4);
    ctx.fillText(opts.fmtY ? opts.fmtY(Math.round(v)) : Math.round(v), pad.left - 6, y + 4);
  }
  const n = labels.length, ds = datasets[0];
  const barW = Math.max(6, cw / n * 0.55), gap = cw / n;
  labels.forEach((l, i) => {
    const x = pad.left + gap * i + gap / 2 - barW / 2;
    const bh = ch * (ds.data[i] / max), y = pad.top + ch - bh;
    const grad = ctx.createLinearGradient(0, y, 0, y + bh);
    grad.addColorStop(0, ds.color); grad.addColorStop(1, ds.color + '44');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(x, y, barW, bh, [3, 3, 0, 0]); ctx.fill();
    ctx.fillStyle = C.TEXT; ctx.textAlign = 'center'; ctx.font = '9px JetBrains Mono';
    ctx.fillText(l, pad.left + gap * i + gap / 2, h - pad.bottom + 14);
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function renderDashboard() {
  const livres   = sensorState.filter(s => !s.ocupado).length;
  const ocupados = sensorState.filter(s => s.ocupado).length;
  const taxa     = Math.round(ocupados / 8 * 100);

  document.getElementById('kpi-livre').textContent   = livres;
  document.getElementById('kpi-ocupado').textContent = ocupados;
  document.getElementById('kpi-taxa').textContent    = taxa + '%';
  document.getElementById('taxa-fill').style.width   = taxa + '%';

  document.getElementById('status-list').innerHTML = sensorState.map(s => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="status-indicator ${s.ocupado ? 'ocupado' : 'livre'}"></div>
        <span style="font-size:12px">${s.nome}</span>
      </div>
      <div class="tag ${s.ocupado ? 'ocupado' : 'livre'}">${s.ocupado ? 'Ocupado' : 'Livre'}</div>
    </div>
  `).join('');

  document.getElementById('salas-grid-dash').innerHTML = sensorState.map(s => `
    <div class="sala-card ${s.ocupado ? 'ocupado' : ''}" onclick="openModal(${s.id - 1})">
      <div class="sala-num">Sensor ${padZ(s.id)}</div>
      <div class="sala-name">${s.nome}</div>
      <div class="sala-status">
        <div class="status-indicator ${s.ocupado ? 'ocupado' : 'livre'}"></div>
        <span class="sala-status-text ${s.ocupado ? 'ocupado' : 'livre'}">${s.ocupado ? 'Ocupado' : 'Disponivel'}</span>
      </div>
      <div class="sala-meta">
        <div class="sala-battery">
          <div class="battery-bar">
            <span style="position:absolute;left:1px;top:1px;bottom:1px;border-radius:1px;background:${s.bateria < 20 ? 'var(--warn)' : 'var(--accent2)'};width:${s.bateria * 0.18}px"></span>
          </div>
          <span>${s.bateria > 0 ? s.bateria + '%' : '--'}</span>
        </div>
        <span>${s.delta !== null ? s.delta + 's ago' : '--'}</span>
      </div>
    </div>
  `).join('');

  const canvas = document.getElementById('chart-live');
  if (liveHistory.length > 1) {
    requestAnimationFrame(() => {
      drawLineChart(canvas,
        liveHistory.map((_, i) => i % 5 === 0 ? `${Math.floor(i * 0.5)}m` : ''),
        [{ data: liveHistory.map(h => h.occ), color: C.ACCENT, fill: true, label: 'Ocupadas' }]
      );
    });
  }
}

// ─── Atualização automática ──────────────────────────────────────────────────
async function refreshData() {
  await fetchSensorData();
  const activePage = document.querySelector('.nav-item.active')?.dataset.page;
  if (activePage === 'dashboard') renderDashboard();
  if (activePage === 'salas')     renderSalasTable();
  if (activePage === 'sensores')  renderSensores();
}

setInterval(refreshData, 5000);

// ─── Tabela de Salas ─────────────────────────────────────────────────────────
let filterSala = 'todas';
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterSala = btn.dataset.filter;
    renderSalasTable();
  });
});

function renderSalasTable() {
  const today_total = {};
  historico.filter(h => h.dia === new Date().toISOString().slice(0, 10))
    .forEach(h => { today_total[h.id_sensor] = h.presenca_total; });

  let rows = sensorState;
  if (filterSala === 'livre')   rows = rows.filter(s => !s.ocupado);
  if (filterSala === 'ocupado') rows = rows.filter(s => s.ocupado);

  document.getElementById('salas-tbody').innerHTML = rows.map(s => {
    const tot = today_total[s.id] || 0, pct = Math.min(100, Math.round(tot / 32400 * 100));
    return `<tr>
      <td><span style="color:var(--accent)">presence${padZ(s.id)}</span></td>
      <td style="color:#fff;font-weight:600">${s.nome}</td>
      <td><span class="tag ${s.ocupado ? 'ocupado' : 'livre'}">${s.ocupado ? 'Ocupado' : 'Livre'}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="prog-bar" style="width:50px"><div class="prog-fill ${s.bateria < 20 ? 'red' : 'green'}" style="width:${s.bateria}%"></div></div>
          ${s.bateria > 0 ? s.bateria + '%' : '--'}
        </div>
      </td>
      <td style="color:var(--text-dim)">${s.ultima_data ? s.ultima_data.toLocaleTimeString('pt-BR') : '--'}</td>
      <td style="color:var(--text-dim)">${s.delta !== null ? s.delta + 's' : '--'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="prog-bar" style="width:80px;flex-shrink:0"><div class="prog-fill accent" style="width:${pct}%"></div></div>
          <span>${tot ? fmt(tot) : '--'}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── Histórico ───────────────────────────────────────────────────────────────
let histPeriod = 7, histSensor = 0;
document.querySelectorAll('[data-period]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    histPeriod = parseInt(btn.dataset.period);
    renderHistorico();
  });
});
document.getElementById('hist-sensor-select').addEventListener('change', e => {
  histSensor = parseInt(e.target.value);
  renderHistorico();
});

function renderHistorico() {
  if (!historico.length) {
    // sem dados ainda
    ['chart-hist-total', 'chart-hist-media', 'chart-hist-comp'].forEach(id => {
      const c = document.getElementById(id);
      resizeCanvas(c);
      const ctx = clearChart(c);
      ctx.fillStyle = C.TEXT; ctx.font = '12px JetBrains Mono'; ctx.textAlign = 'center';
      ctx.fillText('Sem dados históricos', c.width / 2, c.height / 2);
    });
    return;
  }
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - histPeriod);
  const cutStr = cutoff.toISOString().slice(0, 10);
  let filtered = historico.filter(h => h.dia >= cutStr);
  if (histSensor > 0) filtered = filtered.filter(h => h.id_sensor === histSensor);
  const byDay = {};
  filtered.forEach(h => {
    if (!byDay[h.dia]) byDay[h.dia] = { total: 0, sum: 0, cnt: 0 };
    byDay[h.dia].total += h.presenca_total; byDay[h.dia].sum += h.presenca_media; byDay[h.dia].cnt++;
  });
  const days    = Object.keys(byDay).sort();
  const totals  = days.map(d => Math.round(byDay[d].total / 3600));
  const medias  = days.map(d => Math.round(byDay[d].sum / byDay[d].cnt / 60));
  const labels  = days.map(d => d.slice(5));
  setTimeout(() => {
    drawLineChart(document.getElementById('chart-hist-total'), labels, [{ data: totals, color: C.ACCENT, fill: true, label: 'Total (h)' }]);
    drawBarChart(document.getElementById('chart-hist-media'), labels, [{ data: medias, color: C.GREEN }], { fmtY: v => v + 'm' });
    const bySensor = {};
    for (let s = 1; s <= 8; s++) {
      bySensor[s] = historico.filter(h => h.dia >= cutStr && h.id_sensor === s).reduce((a, h) => a + h.presenca_total, 0);
    }
    drawBarChart(document.getElementById('chart-hist-comp'), Array.from({ length: 8 }, (_, i) => `S${padZ(i + 1)}`),
      [{ data: Object.values(bySensor).map(v => Math.round(v / 3600)), color: C.ACCENT }], { fmtY: v => v + 'h' });
  }, 50);
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
function renderHeatmap() {
  const container = document.getElementById('heatmap-container');
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const sensors = Array.from({ length: 8 }, (_, i) => i + 1);

  // monta heatmap a partir do historico real, ou zeros se vazio
  const hm = {};
  hours.forEach(h => { hm[h] = {}; sensors.forEach(s => { hm[h][s] = 0; }); });
  historico.forEach(row => {
    const h = new Date(row.dia).getHours();
    if (hm[h] && hm[h][row.id_sensor] !== undefined) {
      hm[h][row.id_sensor] = Math.min(1, (row.presenca_total || 0) / 3600);
    }
  });

  let html = '<div class="heatmap-grid"><div></div>';
  sensors.forEach(s => { html += `<div class="hm-header">S${padZ(s)}</div>`; });
  hours.forEach(h => {
    html += `<div class="hm-label">${padZ(h)}h</div>`;
    sensors.forEach(s => {
      const v = hm[h][s], opacity = 0.05 + v * 0.95;
      const r = Math.round(lerp(13, 0, v)), g = Math.round(lerp(24, 229, v)), b = Math.round(lerp(56, 255, v));
      html += `<div class="hm-cell" style="background:rgba(${r},${g},${b},${opacity})" data-h="${h}" data-s="${s}"
        onmouseenter="showTooltip(event,'Sensor ${padZ(s)} — ${padZ(h)}h — ${Math.round(v * 100)}% ocupacao')"
        onmouseleave="hideTooltip()"></div>`;
    });
  });
  html += '</div>';
  container.innerHTML = html;

  const hourTotals = hours.map(h => sensors.reduce((a, s) => a + hm[h][s], 0) / 8);
  setTimeout(() => {
    drawBarChart(document.getElementById('chart-peak-hour'), hours.map(h => padZ(h)),
      [{ data: hourTotals.map(v => Math.round(v * 100)), color: C.ACCENT }], { fmtY: v => v + '%' });
    drawBarChart(document.getElementById('chart-weekday'), ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'],
      [{ data: [0, 0, 0, 0, 0, 0, 0], color: C.GREEN }], { fmtY: v => v + '%' });
  }, 50);
}

// ─── Sensores ────────────────────────────────────────────────────────────────
function renderSensores() {
  const batMedia = Math.round(sensorState.reduce((a, s) => a + s.bateria, 0) / sensorState.length);
  const alerts   = sensorState.filter(s => s.bateria > 0 && s.bateria < 20).length;
  const online   = sensorState.filter(s => s.delta !== null).length;

  document.getElementById('sens-online').textContent  = online;
  document.getElementById('sens-offline').textContent = 8 - online;
  document.getElementById('sens-bat').textContent     = batMedia > 0 ? batMedia + '%' : '--';
  document.getElementById('sens-alerts').textContent  = alerts;

  document.getElementById('sens-tbody').innerHTML = sensorState.map(s => {
    const online  = s.delta !== null;
    const saude   = !online ? 'Offline' : s.bateria > 50 ? 'Otimo' : s.bateria > 20 ? 'Regular' : 'Critico';
    const cor     = !online ? 'var(--muted)' : s.bateria > 50 ? 'var(--accent2)' : s.bateria > 20 ? 'var(--accent)' : 'var(--warn)';
    return `<tr>
      <td><span style="color:var(--accent)">${s.device_id}</span></td>
      <td style="font-size:10px;color:var(--text-dim)">${s.topic}</td>
      <td><span class="tag ${online ? 'livre' : 'ocupado'}">${online ? 'Online' : 'Offline'}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="prog-bar" style="width:50px"><div class="prog-fill ${s.bateria < 20 ? 'red' : 'green'}" style="width:${s.bateria}%"></div></div>
          ${s.bateria > 0 ? s.bateria + '%' : '--'}
        </div>
      </td>
      <td style="color:var(--text-dim)">${s.ultima_data ? s.ultima_data.toLocaleTimeString('pt-BR') : '--'}</td>
      <td style="color:var(--text-dim)">${s.delta !== null ? s.delta + 's' : '--'}</td>
      <td style="color:${cor}">${saude}</td>
    </tr>`;
  }).join('');

  setTimeout(() => {
    drawBarChart(document.getElementById('chart-battery'),
      sensorState.map(s => `S${padZ(s.id)}`),
      [{ data: sensorState.map(s => s.bateria), color: C.GREEN }],
      { fmtY: v => v + '%' });
  }, 50);
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function openModal(idx) {
  const s = sensorState[idx];
  document.getElementById('modal-title').textContent  = s.nome;
  document.getElementById('modal-sub').textContent    = `Device: ${s.device_id} — Topic: ${s.topic}`;
  document.getElementById('modal-status').textContent = s.ocupado ? 'Ocupado' : 'Disponivel';
  document.getElementById('modal-status').style.color = s.ocupado ? 'var(--warn)' : 'var(--accent2)';
  document.getElementById('modal-bat').textContent    = s.bateria > 0 ? s.bateria + '%' : '--';
  document.getElementById('modal-delta').textContent  = s.delta !== null ? s.delta + 's' : '--';
  const today = historico.filter(h => h.id_sensor === s.id).slice(-7);
  document.getElementById('modal-ocup').textContent   = today.length ? fmt(today[today.length - 1].presenca_total) : '--';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => {
    if (today.length) {
      drawLineChart(document.getElementById('modal-chart'), today.map(h => h.dia.slice(5)),
        [{ data: today.map(h => Math.round(h.presenca_total / 3600 * 10) / 10), color: C.ACCENT, fill: true }]);
    }
  }, 50);
}

document.getElementById('modal-close').addEventListener('click', () =>
  document.getElementById('modal-overlay').classList.remove('open'));
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay'))
    document.getElementById('modal-overlay').classList.remove('open');
});

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');
function showTooltip(e, text) {
  tooltip.textContent = text; tooltip.style.display = 'block';
  tooltip.style.left = e.pageX + 12 + 'px'; tooltip.style.top = e.pageY - 28 + 'px';
}
function hideTooltip() { tooltip.style.display = 'none'; }
document.addEventListener('mousemove', e => {
  if (tooltip.style.display !== 'none') {
    tooltip.style.left = e.pageX + 12 + 'px'; tooltip.style.top = e.pageY - 28 + 'px';
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  await fetchSensorData();
  await fetchHistorico(30);
  renderDashboard();
})();