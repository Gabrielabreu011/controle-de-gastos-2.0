/* =========================================================
   COFRE — storage.js
   Camada de persistência usando localStorage.
   ========================================================= */

const STORAGE_KEY = 'cofre_data_v1';

const DEFAULT_CATEGORIES = [
  'Alimentação', 'Moradia', 'Transporte', 'Saúde',
  'Lazer', 'Educação', 'Compras', 'Assinaturas', 'Outros'
];

function getDefaultData() {
  return {
    transactions: [],   // { id, type: 'income'|'expense', desc, value, category, date }
    investments: [],    // { id, name, type, value, date }
    goals: [],          // { id, name, target, current }
    config: {
      expectedIncome: 0,
      reservePercent: 10
    }
  };
}

const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultData();
      const parsed = JSON.parse(raw);
      // garante estrutura completa mesmo se algo faltar
      return { ...getDefaultData(), ...parsed };
    } catch (e) {
      console.error('Erro ao carregar dados do Cofre:', e);
      return getDefaultData();
    }
  },

  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar dados do Cofre:', e);
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
};
/* =========================================================
   COFRE — charts.js
   Gráficos desenhados em <canvas> puro, sem bibliotecas externas.
   ========================================================= */

const ChartColors = {
  brass: '#C9A24B',
  brassLight: '#E4C97A',
  positive: '#6FA97C',
  negative: '#D4776A',
  grid: 'rgba(243, 237, 224, 0.08)',
  text: 'rgba(243, 237, 224, 0.55)',
  palette: ['#C9A24B', '#6FA97C', '#D4776A', '#8FB8D4', '#D4A2E4', '#E4C97A', '#7FA88F', '#B48ED4']
};

function setupCanvasDPI(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssHeight = canvas.height; // valor definido via atributo height é usado como CSS px alvo
  const width = rect.width || canvas.parentElement.clientWidth;
  const height = cssHeight;

  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ---------------- DONUT: Gastos por categoria ---------------- */
function drawCategoryDonut(canvas, dataMap) {
  const entries = Object.entries(dataMap).filter(([, v]) => v > 0);
  const noDataEl = document.getElementById('noCategoryData');

  if (entries.length === 0) {
    canvas.style.display = 'none';
    if (noDataEl) noDataEl.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  if (noDataEl) noDataEl.style.display = 'none';

  const { ctx, width, height } = setupCanvasDPI(canvas);
  ctx.clearRect(0, 0, width, height);

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const cx = width / 2 - 70;
  const cy = height / 2;
  const rOuter = Math.min(height / 2 - 10, 80);
  const rInner = rOuter * 0.6;

  let startAngle = -Math.PI / 2;

  entries.forEach(([cat, val], i) => {
    const angle = (val / total) * Math.PI * 2;
    const color = ChartColors.palette[i % ChartColors.palette.length];

    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, startAngle, startAngle + angle);
    ctx.arc(cx, cy, rInner, startAngle + angle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle += angle;
  });

  // Legenda
  const legendX = width - 130;
  let legendY = 20;
  ctx.font = '12px "Space Grotesk", sans-serif';
  ctx.textBaseline = 'middle';

  entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .forEach(([cat, val], i) => {
      const color = ChartColors.palette[entries.findIndex(e => e[0] === cat) % ChartColors.palette.length];
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY - 5, 10, 10);
      ctx.fillStyle = ChartColors.text;
      const pct = ((val / total) * 100).toFixed(0);
      ctx.fillText(`${cat} (${pct}%)`, legendX + 16, legendY);
      legendY += 20;
    });
}

/* ---------------- LINHA: Fluxo mensal ---------------- */
function drawFlowChart(canvas, months, incomes, expenses) {
  const { ctx, width, height } = setupCanvasDPI(canvas);
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(1, ...incomes, ...expenses);
  const stepX = chartW / (months.length - 1 || 1);

  // grid horizontal
  ctx.strokeStyle = ChartColors.grid;
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const val = maxVal - (maxVal / gridLines) * i;
    ctx.fillStyle = ChartColors.text;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0), padding.left - 8, y);
  }

  function plotLine(values, color) {
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = padding.left + stepX * i;
      const y = padding.top + chartH - (v / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // pontos
    values.forEach((v, i) => {
      const x = padding.left + stepX * i;
      const y = padding.top + chartH - (v / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  plotLine(incomes, ChartColors.positive);
  plotLine(expenses, ChartColors.negative);

  // labels eixo X
  ctx.fillStyle = ChartColors.text;
  ctx.font = '10.5px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  months.forEach((m, i) => {
    const x = padding.left + stepX * i;
    ctx.fillText(m, x, height - padding.bottom + 8);
  });
}

/* ---------------- BARRA HORIZONTAL: Investimentos por tipo ---------------- */
function drawInvestmentChart(canvas, dataMap) {
  const entries = Object.entries(dataMap).filter(([, v]) => v > 0);
  const noDataEl = document.getElementById('noInvData');

  if (entries.length === 0) {
    canvas.style.display = 'none';
    if (noDataEl) noDataEl.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  if (noDataEl) noDataEl.style.display = 'none';

  const { ctx, width, height } = setupCanvasDPI(canvas);
  ctx.clearRect(0, 0, width, height);

  const maxVal = Math.max(...entries.map(([, v]) => v));
  const barHeight = Math.min(28, (height - 20) / entries.length - 10);
  const gap = (height - entries.length * barHeight) / (entries.length + 1);
  const leftPad = 130;
  const rightPad = 80;

  entries.forEach(([label, val], i) => {
    const y = gap + i * (barHeight + gap);
    const barW = ((width - leftPad - rightPad) * val) / maxVal;
    const color = ChartColors.palette[i % ChartColors.palette.length];

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(leftPad, y, Math.max(barW, 2), barHeight, 6);
    ctx.fill();

    ctx.fillStyle = ChartColors.text;
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, leftPad - 10, y + barHeight / 2);

    ctx.textAlign = 'left';
    ctx.font = '11.5px "JetBrains Mono", monospace';
    ctx.fillStyle = ChartColors.brassLight;
    ctx.fillText(formatBRL(val), leftPad + barW + 8, y + barHeight / 2);
  });
}
/* =========================================================
   COFRE — app.js
   Lógica principal: navegação, CRUD, cálculos e renderização.
   ========================================================= */

let DATA = Storage.load();
let currentDate = new Date();
currentDate.setDate(1);

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/* ================= HELPERS ================= */
function formatBRL2(value) {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isSameMonth(txDateStr, date) {
  return txDateStr.slice(0, 7) === monthKey(date);
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function daysRemainingInMonth(date) {
  const total = daysInMonth(date);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth();
  if (!isCurrentMonth) return total; // mês futuro/passado: considera mês inteiro
  return Math.max(1, total - now.getDate() + 1);
}

/* ================= NAVEGAÇÃO ================= */
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
  document.querySelector(`.nav-item[data-view="${viewName}"]`).classList.add('active');
  renderAll();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.goto));
});

/* ================= MODAIS ================= */
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
});

document.getElementById('openTxModal').addEventListener('click', () => {
  document.getElementById('txDate').value = todayISO();
  populateCategorySelect();
  openModal('txModal');
});
document.getElementById('openInvModal').addEventListener('click', () => openModal('invModal'));
document.getElementById('openGoalModal').addEventListener('click', () => openModal('goalModal'));

/* ================= MÊS ================= */
document.getElementById('prevMonth').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderAll();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderAll();
});

function updateMonthLabel() {
  document.getElementById('currentMonthLabel').textContent =
    `${MONTH_NAMES[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
}

/* ================= CATEGORIAS ================= */
function getAllCategories() {
  const used = DATA.transactions.map(t => t.category);
  return [...new Set([...DEFAULT_CATEGORIES, ...used])];
}

function populateCategorySelect() {
  const sel = document.getElementById('txCategory');
  sel.innerHTML = '';
  getAllCategories().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
}

function populateFilterCategory() {
  const sel = document.getElementById('filterCategory');
  const current = sel.value;
  sel.innerHTML = '<option value="all">Todas as categorias</option>';
  getAllCategories().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
  sel.value = current || 'all';
}

/* ================= FORM: LANÇAMENTO ================= */
document.getElementById('txForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = document.querySelector('input[name="txType"]:checked').value;
  const desc = document.getElementById('txDesc').value.trim();
  const value = parseFloat(document.getElementById('txValue').value);
  const category = document.getElementById('txCategory').value;
  const date = document.getElementById('txDate').value;

  if (!desc || !value || value <= 0 || !date) return;

  DATA.transactions.push({
    id: Storage.uid(),
    type, desc, value, category, date
  });
  Storage.save(DATA);

  e.target.reset();
  closeModal('txModal');
  renderAll();
});

function deleteTx(id) {
  DATA.transactions = DATA.transactions.filter(t => t.id !== id);
  Storage.save(DATA);
  renderAll();
}

/* ================= FORM: INVESTIMENTO ================= */
document.getElementById('invForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('invName').value.trim();
  const type = document.getElementById('invType').value;
  const value = parseFloat(document.getElementById('invValue').value);

  if (!name || !value || value <= 0) return;

  DATA.investments.push({
    id: Storage.uid(),
    name, type, value, date: todayISO()
  });
  Storage.save(DATA);

  e.target.reset();
  closeModal('invModal');
  renderAll();
});

function deleteInv(id) {
  DATA.investments = DATA.investments.filter(i => i.id !== id);
  Storage.save(DATA);
  renderAll();
}

/* ================= FORM: METAS ================= */
document.getElementById('goalForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const current = parseFloat(document.getElementById('goalCurrent').value) || 0;

  if (!name || !target || target <= 0) return;

  DATA.goals.push({ id: Storage.uid(), name, target, current });
  Storage.save(DATA);

  e.target.reset();
  closeModal('goalModal');
  renderAll();
});

function deleteGoal(id) {
  DATA.goals = DATA.goals.filter(g => g.id !== id);
  Storage.save(DATA);
  renderAll();
}

let activeGoalId = null;
function openGoalAdd(id) {
  activeGoalId = id;
  document.getElementById('goalAddId').value = id;
  openModal('goalAddModal');
}

document.getElementById('goalAddForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('goalAddId').value;
  const value = parseFloat(document.getElementById('goalAddValue').value);
  const goal = DATA.goals.find(g => g.id === id);
  if (goal && value > 0) {
    goal.current = Math.min(goal.target, goal.current + value);
    Storage.save(DATA);
  }
  e.target.reset();
  closeModal('goalAddModal');
  renderAll();
});

/* ================= CONFIGURAÇÕES ================= */
document.getElementById('saveConfig').addEventListener('click', () => {
  DATA.config.expectedIncome = parseFloat(document.getElementById('expectedIncome').value) || 0;
  DATA.config.reservePercent = parseFloat(document.getElementById('reservePercent').value) || 0;
  Storage.save(DATA);
  renderAll();
  alert('Configurações salvas.');
});

document.getElementById('exportData').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cofre-dados.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('clearData').addEventListener('click', () => {
  if (confirm('Tem certeza que deseja apagar todos os dados? Essa ação não pode ser desfeita.')) {
    Storage.clear();
    DATA = Storage.load();
    renderAll();
  }
});

/* ================= FILTROS DE LANÇAMENTOS ================= */
document.getElementById('searchTx').addEventListener('input', renderTxTable);
document.getElementById('filterType').addEventListener('change', renderTxTable);
document.getElementById('filterCategory').addEventListener('change', renderTxTable);

/* ================= CÁLCULOS PRINCIPAIS ================= */
function getMonthTransactions(date) {
  return DATA.transactions.filter(t => isSameMonth(t.date, date));
}

function calcMonthStats(date) {
  const txs = getMonthTransactions(date);
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.value, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.value, 0);
  return { income, expense };
}

function calcSafeToSpend(date) {
  const { income, expense } = calcMonthStats(date);
  const baseIncome = income > 0 ? income : (DATA.config.expectedIncome || 0);
  const reserve = baseIncome * ((DATA.config.reservePercent || 0) / 100);
  const available = Math.max(0, baseIncome - reserve - expense);
  const days = daysRemainingInMonth(date);
  return { perDay: available / days, available, baseIncome, reserve };
}

/* ================= RENDER: DASHBOARD ================= */
function renderDashboard() {
  const { income, expense } = calcMonthStats(currentDate);
  const totalSaved = DATA.goals.reduce((s, g) => s + g.current, 0);
  const totalInvested = DATA.investments.reduce((s, i) => s + i.value, 0);

  document.getElementById('statIncome').textContent = formatBRL2(income);
  document.getElementById('statExpense').textContent = formatBRL2(expense);
  document.getElementById('statSaved').textContent = formatBRL2(totalSaved);
  document.getElementById('statInvested').textContent = formatBRL2(totalInvested);

  // saldo em conta = todas entradas - todas saídas (histórico completo, não só o mês)
  const allIncome = DATA.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.value, 0);
  const allExpense = DATA.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.value, 0);
  const accountBalance = allIncome - allExpense;
  const balanceEl = document.getElementById('accountBalanceValue');
  balanceEl.textContent = formatBRL2(accountBalance);
  balanceEl.classList.toggle('positive', accountBalance >= 0);
  balanceEl.classList.toggle('negative', accountBalance < 0);

  const safe = calcSafeToSpend(currentDate);
  document.getElementById('safeToSpendValue').textContent = formatBRL2(safe.perDay);

  const days = daysRemainingInMonth(currentDate);
  document.getElementById('safeToSpendSub').textContent =
    `por dia · ${days} dia${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`;

  // dial: proporção do disponível vs renda base
  const circumference = 653; // 2 * PI * 104
  const ratio = safe.baseIncome > 0 ? Math.min(1, safe.available / safe.baseIncome) : 0;
  const offset = circumference - ratio * circumference;
  const dial = document.getElementById('dialProgress');
  dial.style.strokeDashoffset = offset;
  dial.style.stroke = ratio < 0.15 ? getComputedStyle(document.documentElement).getPropertyValue('--negative') : '';

  // gráfico categorias (mês atual)
  const catMap = {};
  getMonthTransactions(currentDate).filter(t => t.type === 'expense').forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.value;
  });

  // gráfico fluxo últimos 6 meses
  const months = [];
  const incomes = [];
  const expenses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const stats = calcMonthStats(d);
    months.push(MONTH_NAMES[d.getMonth()].slice(0, 3));
    incomes.push(stats.income);
    expenses.push(stats.expense);
  }

  // Os canvases só têm largura real quando visíveis (o app pode estar escondido
  // atrás da tela de login). Se ainda não há largura, aguarda o próximo frame.
  const catCanvas = document.getElementById('categoryChart');
  const flowCanvas = document.getElementById('flowChart');

  function drawChartsWhenVisible(attempt) {
    const visible = catCanvas.getBoundingClientRect().width > 0;
    if (!visible) {
      if (attempt < 30) requestAnimationFrame(() => drawChartsWhenVisible(attempt + 1));
      return;
    }
    drawCategoryDonut(catCanvas, catMap);
    drawFlowChart(flowCanvas, months, incomes, expenses);
  }
  drawChartsWhenVisible(0);

  // últimos lançamentos
  const recentList = document.getElementById('recentList');
  const recent = [...DATA.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  recentList.innerHTML = recent.length ? recent.map(txRowHTML).join('') :
    '<p class="empty-note">Nenhum lançamento ainda.</p>';
}

function txRowHTML(t) {
  const sign = t.type === 'income' ? '+' : '−';
  const cls = t.type === 'income' ? 'income' : 'expense';
  const dateFmt = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
  return `
    <div class="tx-row">
      <div class="tx-info">
        <span class="tx-desc">${escapeHTML(t.desc)}</span>
        <span class="tx-meta">${escapeHTML(t.category)} · ${dateFmt}</span>
      </div>
      <span class="tx-amount ${cls}">${sign} ${formatBRL2(t.value)}</span>
    </div>
  `;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ================= RENDER: LANÇAMENTOS (tabela) ================= */
function renderTxTable() {
  populateFilterCategory();
  const search = document.getElementById('searchTx').value.toLowerCase();
  const type = document.getElementById('filterType').value;
  const category = document.getElementById('filterCategory').value;

  let list = [...DATA.transactions].sort((a, b) => b.date.localeCompare(a.date));

  if (search) list = list.filter(t => t.desc.toLowerCase().includes(search));
  if (type !== 'all') list = list.filter(t => t.type === type);
  if (category !== 'all') list = list.filter(t => t.category === category);

  const tbody = document.getElementById('txTableBody');
  const noData = document.getElementById('noTxData');

  if (list.length === 0) {
    tbody.innerHTML = '';
    noData.style.display = 'block';
    return;
  }
  noData.style.display = 'none';

  tbody.innerHTML = list.map(t => {
    const sign = t.type === 'income' ? '+' : '−';
    const cls = t.type === 'income' ? 'income' : 'expense';
    const dateFmt = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
    return `
      <tr>
        <td>${escapeHTML(t.desc)}</td>
        <td><span class="cat-tag">${escapeHTML(t.category)}</span></td>
        <td>${dateFmt}</td>
        <td class="tx-amount ${cls}">${sign} ${formatBRL2(t.value)}</td>
        <td><button class="del-btn" onclick="deleteTx('${t.id}')">✕</button></td>
      </tr>
    `;
  }).join('');
}

/* ================= RENDER: INVESTIMENTOS ================= */
function renderInvestments() {
  const total = DATA.investments.reduce((s, i) => s + i.value, 0);
  document.getElementById('totalInvestedBig').textContent = formatBRL2(total);

  const typeMap = {};
  DATA.investments.forEach(i => {
    typeMap[i.type] = (typeMap[i.type] || 0) + i.value;
  });

  const invCanvas = document.getElementById('invChart');
  function drawInvChartWhenVisible(attempt) {
    const visible = invCanvas.getBoundingClientRect().width > 0;
    if (!visible) {
      if (attempt < 30) requestAnimationFrame(() => drawInvChartWhenVisible(attempt + 1));
      return;
    }
    drawInvestmentChart(invCanvas, typeMap);
  }
  drawInvChartWhenVisible(0);

  const listEl = document.getElementById('invList');
  if (DATA.investments.length === 0) {
    listEl.innerHTML = '<p class="empty-note">Nenhum investimento cadastrado ainda.</p>';
    return;
  }
  listEl.innerHTML = [...DATA.investments].reverse().map(i => `
    <div class="tx-row">
      <div class="tx-info">
        <span class="tx-desc">${escapeHTML(i.name)}</span>
        <span class="tx-meta">${escapeHTML(i.type)}</span>
      </div>
      <span class="tx-amount income">${formatBRL2(i.value)}</span>
      <button class="del-btn" onclick="deleteInv('${i.id}')">✕</button>
    </div>
  `).join('');
}

/* ================= RENDER: METAS ================= */
function renderGoals() {
  const grid = document.getElementById('goalsGrid');
  const noData = document.getElementById('noGoalData');

  if (DATA.goals.length === 0) {
    grid.innerHTML = '';
    noData.style.display = 'block';
    return;
  }
  noData.style.display = 'none';

  grid.innerHTML = DATA.goals.map(g => {
    const pct = Math.min(100, (g.current / g.target) * 100);
    return `
      <div class="goal-card">
        <h4 class="goal-name">${escapeHTML(g.name)}</h4>
        <div class="goal-amounts">${formatBRL2(g.current)} de ${formatBRL2(g.target)} · ${pct.toFixed(0)}%</div>
        <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" style="margin:0; flex:1;" onclick="openGoalAdd('${g.id}')">+ Guardar</button>
          <button class="del-btn" onclick="deleteGoal('${g.id}')">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ================= RENDER: CONFIG ================= */
function renderConfig() {
  document.getElementById('expectedIncome').value = DATA.config.expectedIncome || '';
  document.getElementById('reservePercent').value = DATA.config.reservePercent || 0;
}

/* ================= RENDER ALL ================= */
function renderAll() {
  updateMonthLabel();
  renderDashboard();
  renderTxTable();
  renderInvestments();
  renderGoals();
  renderConfig();
  populateCategorySelect();
}

/* ================= INIT ================= */
document.getElementById('txDate').value = todayISO();
renderAll();
