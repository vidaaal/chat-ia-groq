// Controle Pessoal v4 — calendar, dual status, reports
const STORAGE_KEY = 'controle_atividades_rafael_v4';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const SEED = {
  projects: [
    { id: 'p1', name: 'Trabalho Geral', description: 'Lecom, IAF, SKU, VPN...', color: '#2563eb' }
  ],
  tasks: [
    {
      id: 't1', title: 'Diagnosticar falha no disparo automático de e-mails de SKU',
      priority: 'Média', startDate: '2026-10-16', deadline: '2026-10-16', endDate: '2026-10-16',
      status: 'Concluída', deliveryStatus: 'Entregue', progress: 100,
      notes: 'Grid GRID_CAD_SKU vazia na solicitação 1256.',
      projectId: 'p1', tags: ['SKU', 'e-mail'],
      subtasks: [], history: [
        { at: '2026-10-16T10:00:00', text: 'Problema identificado: grid vazia.' },
        { at: '2026-10-16T12:00:00', text: 'Diagnóstico concluído e entregue.' }
      ],
      estimateHours: 2, spentHours: 1.5,
      autoProgress: false, archived: false, updatedAt: '2026-10-16T12:00:00'
    },
    {
      id: 't2', title: 'Realizar manutenção no fluxo de aprovação da IAF',
      priority: 'Alta', startDate: '2026-10-16', deadline: '2026-10-16', endDate: '',
      status: 'Concluída', deliveryStatus: 'Aguardando produção', progress: 100,
      notes: 'Aguardando confirmação do Tyago para jogar em produção.',
      projectId: 'p1', tags: ['IAF', 'fluxo'],
      subtasks: [
        { id: 's1', text: 'Analisar fluxo', done: true },
        { id: 's2', text: 'Atualizar cargo do usuário', done: true },
        { id: 's3', text: 'Jogar para produção (aguardando Tyago)', done: false }
      ],
      history: [
        { at: '2026-10-16T09:00:00', text: 'Problema: solicitação aberta antes da atribuição de cargo.' },
        { at: '2026-10-16T11:00:00', text: 'Correção aplicada e fluxo normalizado.' },
        { at: '2026-10-16T14:00:00', text: 'Validado. Aguardando Tyago para produção.' }
      ],
      estimateHours: 4, spentHours: 3,
      autoProgress: false, archived: false, updatedAt: '2026-10-16T14:00:00'
    },
    {
      id: 't3', title: 'Inclusão do nome da ficha no e-mail do SKU',
      priority: 'Média', startDate: '2026-10-16', deadline: '2026-10-20', endDate: '2026-10-19',
      status: 'Concluída', deliveryStatus: 'Entregue', progress: 100,
      notes: 'TX_NOM_FICHA como título, logo Eucatex. Branch develop.',
      projectId: 'p1', tags: ['SKU', 'e-mail', 'UI'],
      subtasks: [], history: [
        { at: '2026-10-16T15:00:00', text: 'Reunião com Thyago (Controladoria).' },
        { at: '2026-10-19T10:00:00', text: 'Publicado na develop.' }
      ],
      estimateHours: 3, spentHours: 2.5,
      autoProgress: false, archived: false, updatedAt: '2026-10-19T10:00:00'
    },
    {
      id: 't4', title: 'Configurar e testar o acesso à VPN da Lecom',
      priority: 'Baixa', startDate: '', deadline: '2026-10-31', endDate: '',
      status: 'Não iniciada', deliveryStatus: 'Em aberto', progress: 0,
      notes: 'Confirmar e-mail com Infra. OpenVPN + 2FA. Guardar códigos.',
      projectId: 'p1', tags: ['VPN', 'infra'],
      subtasks: [
        { id: 's4', text: 'Confirmar e-mail com Infraestrutura', done: false },
        { id: 's5', text: 'Instalar cliente OpenVPN', done: false },
        { id: 's6', text: 'Configurar conexão + 2FA', done: false },
        { id: 's7', text: 'Testar acesso e guardar códigos', done: false }
      ],
      history: [],
      estimateHours: 2, spentHours: 0,
      autoProgress: true, archived: false, updatedAt: '2026-10-16T09:00:00'
    }
  ],
  nav: 'all',
  currentProjectId: null,
  viewMode: 'list',
  calMonth: null
};

let state = loadState();
let drawerTaskId = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.projects && p.tasks) {
        p.tasks.forEach(normalizeTask);
        return Object.assign({}, SEED, p, { calMonth: p.calMonth || null });
      }
    }
    for (const k of ['controle_atividades_rafael_v3', 'controle_atividades_rafael_v2']) {
      const old = localStorage.getItem(k);
      if (old) {
        const o = JSON.parse(old);
        o.tasks.forEach(normalizeTask);
        return { projects: o.projects, tasks: o.tasks, nav: 'all', currentProjectId: null, viewMode: 'list', calMonth: null };
      }
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(SEED));
}

function normalizeTask(t) {
  if (!t.tags) t.tags = [];
  if (!t.subtasks) t.subtasks = [];
  if (!t.history) t.history = [];
  if (!t.deliveryStatus) {
    t.deliveryStatus = t.status === 'Concluída' ? 'Entregue' : 'Em aberto';
  }
  if (t.estimateHours === undefined) t.estimateHours = 0;
  if (t.spentHours === undefined) t.spentHours = 0;
  if (t.autoProgress === undefined) t.autoProgress = false;
  if (t.archived === undefined) t.archived = false;
  if (!t.updatedAt) t.updatedAt = new Date().toISOString();
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { return new Date().toISOString().slice(0, 10); }
function nowISO() { return new Date().toISOString(); }

function parseDate(d) {
  if (!d) return null;
  const dt = new Date(d + 'T12:00:00');
  return isNaN(dt) ? null : dt;
}

function computeSituacao(task) {
  if (task.status === 'Concluída' && task.deliveryStatus === 'Entregue') return 'Concluída';
  const dl = parseDate(task.deadline);
  if (!dl) return 'No prazo';
  const now = new Date(); now.setHours(12, 0, 0, 0);
  if (dl < now && task.status !== 'Concluída') return 'Atrasada';
  const diff = Math.floor((dl - now) / 86400000);
  if (diff <= 7 && task.status !== 'Concluída') return 'Vence em 7 dias';
  return 'No prazo';
}

function applyAutoProgress(task) {
  if (!task.autoProgress || !task.subtasks || !task.subtasks.length) return;
  const done = task.subtasks.filter(s => s.done).length;
  task.progress = Math.round((done / task.subtasks.length) * 100);
  if (task.progress === 100 && task.status !== 'Concluída') {
    task.status = 'Concluída';
    if (!task.endDate) task.endDate = today();
    if (task.deliveryStatus === 'Em aberto') task.deliveryStatus = 'Aguardando produção';
  } else if (task.progress > 0 && task.status === 'Não iniciada') {
    task.status = 'Em andamento';
  }
}

function getVisibleTasks() {
  let list = state.tasks.filter(t => !t.archived);
  if (state.currentProjectId) list = list.filter(t => t.projectId === state.currentProjectId);

  if (state.nav === 'pendentes') list = list.filter(t => t.status === 'Não iniciada');
  if (state.nav === 'andamento') list = list.filter(t => t.status === 'Em andamento');
  if (state.nav === 'aguardando') list = list.filter(t => t.deliveryStatus === 'Aguardando produção');
  if (state.nav === 'concluidas') list = list.filter(t => t.status === 'Concluída' && t.deliveryStatus === 'Entregue');

  const q = (document.getElementById('searchInput') && document.getElementById('searchInput').value || '').toLowerCase().trim();
  const pr = document.getElementById('filterPriority') && document.getElementById('filterPriority').value || '';
  const sort = document.getElementById('sortBy') && document.getElementById('sortBy').value || 'deadline';

  if (q) {
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q) ||
      (t.tags || []).some(tg => tg.toLowerCase().includes(q))
    );
  }
  if (pr) list = list.filter(t => t.priority === pr);

  const prio = { Alta: 0, 'Média': 1, Baixa: 2 };
  list.sort((a, b) => {
    if (sort === 'priority') return (prio[a.priority] != null ? prio[a.priority] : 9) - (prio[b.priority] != null ? prio[b.priority] : 9);
    if (sort === 'updated') return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    const da = parseDate(a.deadline) || new Date('9999-12-31');
    const db = parseDate(b.deadline) || new Date('9999-12-31');
    if (a.status === 'Concluída' && b.status !== 'Concluída') return 1;
    if (b.status === 'Concluída' && a.status !== 'Concluída') return -1;
    return da - db;
  });
  return list;
}

function counts() {
  const base = state.currentProjectId
    ? state.tasks.filter(t => t.projectId === state.currentProjectId && !t.archived)
    : state.tasks.filter(t => !t.archived);
  return {
    all: base.length,
    pendentes: base.filter(t => t.status === 'Não iniciada').length,
    andamento: base.filter(t => t.status === 'Em andamento').length,
    aguardando: base.filter(t => t.deliveryStatus === 'Aguardando produção').length,
    concluidas: base.filter(t => t.status === 'Concluída' && t.deliveryStatus === 'Entregue').length
  };
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(d) {
  if (!d) return '—';
  const parts = d.split('-');
  return parts[2] + '/' + parts[1];
}
function priorityDot(p) {
  const c = { Alta: 'bg-red-500', 'Média': 'bg-amber-400', Baixa: 'bg-neutral-300 dark:bg-neutral-600' };
  return '<span class="w-1.5 h-1.5 rounded-full ' + (c[p] || c.Baixa) + ' shrink-0" title="' + p + '"></span>';
}

function renderKPIs() {
  const c = counts();
  const items = [
    { label: 'Total', value: c.all },
    { label: 'Pendentes', value: c.pendentes },
    { label: 'Em andamento', value: c.andamento },
    { label: 'Aguardando', value: c.aguardando },
    { label: 'Concluídas', value: c.concluidas }
  ];
  document.getElementById('kpiRow').innerHTML = items.map(i =>
    '<div class="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5 bg-neutral-50/50 dark:bg-neutral-900/50">' +
    '<p class="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">' + i.label + '</p>' +
    '<p class="text-xl font-semibold tabular-nums mt-0.5">' + i.value + '</p></div>'
  ).join('');
  document.getElementById('navCountAll').textContent = c.all || '';
  document.getElementById('navCountPend').textContent = c.pendentes || '';
  document.getElementById('navCountAnd').textContent = c.andamento || '';
  document.getElementById('navCountAguard').textContent = c.aguardando || '';
  document.getElementById('navCountConc').textContent = c.concluidas || '';
}

function renderProjects() {
  const ul = document.getElementById('projectList');
  ul.innerHTML = state.projects.map(p => {
    const n = state.tasks.filter(t => t.projectId === p.id && !t.archived).length;
    const active = state.currentProjectId === p.id ? 'active' : '';
    return '<button class="nav-item w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 ' + active + '" data-project="' + p.id + '">' +
      '<span class="w-2 h-2 rounded-full shrink-0" style="background:' + p.color + '"></span>' +
      '<span class="flex-1 truncate">' + escapeHtml(p.name) + '</span>' +
      '<span class="text-xs text-neutral-400 tabular-nums">' + (n || '') + '</span></button>';
  }).join('');
  ul.querySelectorAll('[data-project]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentProjectId = btn.dataset.project;
      state.nav = 'all';
      saveState();
      refresh();
    });
  });
}

function renderNavActive() {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === state.nav && !state.currentProjectId);
  });
  if (state.currentProjectId) {
    document.querySelectorAll('[data-nav]').forEach(b => b.classList.remove('active'));
  }
}

function updateHeader() {
  const title = document.getElementById('pageTitle');
  const sub = document.getElementById('pageSubtitle');
  const btnBpmn = document.getElementById('btnBpmn');
  if (btnBpmn) {
    if (state.currentProjectId) {
      btnBpmn.classList.remove('hidden');
      btnBpmn.classList.add('flex');
    } else {
      btnBpmn.classList.add('hidden');
      btnBpmn.classList.remove('flex');
    }
  }
  if (state.viewMode === 'reports') {
    title.textContent = 'Relatórios';
    sub.textContent = 'Produtividade e visão geral';
    return;
  }
  if (state.currentProjectId) {
    const p = state.projects.find(x => x.id === state.currentProjectId);
    title.textContent = (p && p.name) || 'Projeto';
    sub.textContent = (p && p.description) || 'Atividades do projeto';
  } else {
    const map = {
      all: ['Todas as atividades', 'Organize e acompanhe suas entregas'],
      pendentes: ['Pendentes', 'Ainda não iniciadas'],
      andamento: ['Em andamento', 'Em execução'],
      aguardando: ['Aguardando entrega', 'Feitas, mas ainda não publicadas'],
      concluidas: ['Concluídas', 'Finalizadas e entregues']
    };
    const m = map[state.nav] || map.all;
    title.textContent = m[0];
    sub.textContent = m[1];
  }
}

function taskRow(t) {
  const proj = state.projects.find(p => p.id === t.projectId);
  const sit = computeSituacao(t);
  const overdue = sit === 'Atrasada';
  const soon = sit === 'Vence em 7 dias';
  const waiting = t.deliveryStatus === 'Aguardando produção';
  const subDone = (t.subtasks || []).filter(s => s.done).length;
  const subTotal = (t.subtasks || []).length;
  const active = drawerTaskId === t.id ? 'active' : '';
  const done = t.status === 'Concluída' && t.deliveryStatus === 'Entregue';
  const barColor = done ? 'bg-emerald-500' : waiting ? 'bg-violet-500' : 'bg-blue-500';

  return '<div class="task-row flex items-center gap-3 px-3 py-2.5 cursor-pointer ' + active + '" data-id="' + t.id + '">' +
    priorityDot(t.priority) +
    '<div class="flex-1 min-w-0">' +
      '<p class="text-sm font-medium truncate ' + (done ? 'text-neutral-400 line-through' : '') + '">' + escapeHtml(t.title) + '</p>' +
      '<div class="flex items-center gap-2 mt-0.5 text-xs text-neutral-400">' +
        (proj ? '<span>' + escapeHtml(proj.name) + '</span>' : '') +
        (t.tags && t.tags.length ? '<span class="text-neutral-300 dark:text-neutral-600">·</span><span>' + t.tags.slice(0, 2).map(escapeHtml).join(', ') + '</span>' : '') +
        (subTotal ? '<span class="text-neutral-300 dark:text-neutral-600">·</span><span>' + subDone + '/' + subTotal + '</span>' : '') +
        (waiting ? '<span class="text-violet-500 font-medium">· Aguardando produção</span>' : '') +
      '</div></div>' +
    '<div class="flex items-center gap-3 shrink-0">' +
      (overdue ? '<span class="text-[11px] text-red-500 font-medium">Atrasada</span>' : '') +
      (soon && !overdue ? '<span class="text-[11px] text-orange-500 font-medium">7 dias</span>' : '') +
      '<span class="text-xs text-neutral-400 tabular-nums w-10 text-right">' + formatDate(t.deadline) + '</span>' +
      '<div class="w-12 h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">' +
        '<div class="h-full rounded-full ' + barColor + '" style="width:' + (t.progress || 0) + '%"></div>' +
      '</div></div></div>';
}

function hideAllViews() {
  ['listView', 'kanbanView', 'calendarView', 'reportsView', 'emptyState'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
  });
}

function renderList() {
  hideAllViews();
  document.getElementById('listView').classList.remove('hidden');
  const tasks = getVisibleTasks();
  const empty = document.getElementById('emptyState');
  const list = document.getElementById('listView');

  if (!tasks.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    empty.classList.add('flex');
    return;
  }

  if (state.nav === 'all' && !state.currentProjectId) {
    const groups = [
      { label: 'Pendentes', items: tasks.filter(t => t.status === 'Não iniciada') },
      { label: 'Em andamento', items: tasks.filter(t => t.status === 'Em andamento') },
      { label: 'Aguardando entrega', items: tasks.filter(t => t.deliveryStatus === 'Aguardando produção') },
      { label: 'Concluídas', items: tasks.filter(t => t.status === 'Concluída' && t.deliveryStatus === 'Entregue') }
    ].filter(g => g.items.length);

    list.innerHTML = groups.map(g =>
      '<section><div class="flex items-center gap-2 mb-2">' +
      '<h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-400">' + g.label + '</h2>' +
      '<span class="text-xs text-neutral-400">' + g.items.length + '</span></div>' +
      '<div class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">' +
      g.items.map(taskRow).join('') + '</div></section>'
    ).join('');
  } else {
    list.innerHTML = '<div class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">' +
      tasks.map(taskRow).join('') + '</div>';
  }

  list.querySelectorAll('.task-row').forEach(row => {
    row.addEventListener('click', () => openDrawer(row.dataset.id));
  });
}

function renderKanban() {
  hideAllViews();
  document.getElementById('kanbanView').classList.remove('hidden');
  const tasks = getVisibleTasks();
  const cols = [
    { key: 'Não iniciada', label: 'Pendentes', match: t => t.status === 'Não iniciada' },
    { key: 'Em andamento', label: 'Em andamento', match: t => t.status === 'Em andamento' },
    { key: 'Aguardando', label: 'Aguardando entrega', match: t => t.deliveryStatus === 'Aguardando produção' },
    { key: 'Concluída', label: 'Entregues', match: t => t.status === 'Concluída' && t.deliveryStatus === 'Entregue' }
  ];

  const board = document.getElementById('kanbanBoard');
  board.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4';
  board.innerHTML = cols.map(col => {
    const items = tasks.filter(col.match);
    return '<div class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col min-h-[240px]">' +
      '<div class="px-3 py-2.5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">' +
      '<span class="text-xs font-semibold text-neutral-500 uppercase tracking-wider">' + col.label + '</span>' +
      '<span class="text-xs text-neutral-400 tabular-nums">' + items.length + '</span></div>' +
      '<div class="flex-1 p-2 space-y-1.5 drop-zone" data-col="' + col.key + '">' +
      items.map(t => {
        const proj = state.projects.find(p => p.id === t.projectId);
        return '<div class="kanban-card bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-3 py-2.5 shadow-sm" data-id="' + t.id + '" draggable="true">' +
          '<p class="text-sm font-medium leading-snug">' + escapeHtml(t.title) + '</p>' +
          '<div class="flex items-center gap-2 mt-2 text-xs text-neutral-400">' +
          priorityDot(t.priority) +
          (proj ? '<span class="truncate">' + escapeHtml(proj.name) + '</span>' : '') +
          '<span class="ml-auto tabular-nums">' + formatDate(t.deadline) + '</span></div></div>';
      }).join('') + '</div></div>';
  }).join('');

  let dragId = null;
  board.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', () => { dragId = card.dataset.id; card.classList.add('opacity-50'); });
    card.addEventListener('dragend', () => { card.classList.remove('opacity-50'); dragId = null; });
    card.addEventListener('click', () => openDrawer(card.dataset.id));
  });
  board.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('bg-blue-50', 'dark:bg-blue-950/30'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('bg-blue-50', 'dark:bg-blue-950/30'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('bg-blue-50', 'dark:bg-blue-950/30');
      if (!dragId) return;
      const task = state.tasks.find(t => t.id === dragId);
      if (!task) return;
      const col = zone.dataset.col;
      const prevS = task.status, prevD = task.deliveryStatus;
      if (col === 'Não iniciada') { task.status = 'Não iniciada'; task.deliveryStatus = 'Em aberto'; }
      if (col === 'Em andamento') { task.status = 'Em andamento'; task.deliveryStatus = 'Em aberto'; }
      if (col === 'Aguardando') { task.status = 'Concluída'; task.deliveryStatus = 'Aguardando produção'; task.progress = 100; if (!task.endDate) task.endDate = today(); }
      if (col === 'Concluída') { task.status = 'Concluída'; task.deliveryStatus = 'Entregue'; task.progress = 100; if (!task.endDate) task.endDate = today(); }
      if (prevS !== task.status || prevD !== task.deliveryStatus) {
        task.history = task.history || [];
        task.history.push({ at: nowISO(), text: 'Status: ' + prevS + '/' + prevD + ' → ' + task.status + '/' + task.deliveryStatus });
      }
      task.updatedAt = nowISO();
      saveState();
      refresh();
    });
  });
}

function ensureCalMonth() {
  if (!state.calMonth) {
    const n = new Date();
    state.calMonth = { y: n.getFullYear(), m: n.getMonth() };
  }
}

function renderCalendar() {
  hideAllViews();
  document.getElementById('calendarView').classList.remove('hidden');
  ensureCalMonth();
  const y = state.calMonth.y, m = state.calMonth.m;
  document.getElementById('calTitle').textContent = MONTHS[m] + ' ' + y;

  const first = new Date(y, m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();

  const tasks = state.tasks.filter(t => !t.archived && t.deadline);
  const byDay = {};
  const prefix = y + '-' + String(m + 1).padStart(2, '0');
  tasks.forEach(t => {
    if (!t.deadline.startsWith(prefix)) return;
    const day = parseInt(t.deadline.slice(8), 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(t);
  });

  const todayStr = today();
  let html = WEEKDAYS.map(d => '<div class="bg-neutral-50 dark:bg-neutral-900 py-2 text-center text-[11px] font-medium text-neutral-400">' + d + '</div>').join('');

  for (let i = startPad - 1; i >= 0; i--) {
    html += '<div class="cal-day other-month bg-white dark:bg-neutral-900 p-1.5"><span class="text-xs text-neutral-400">' + (prevDays - i) + '</span></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const isToday = dateStr === todayStr;
    const dayTasks = byDay[d] || [];
    html += '<div class="cal-day bg-white dark:bg-neutral-900 p-1.5 ' + (isToday ? 'today' : '') + (dayTasks.length ? ' has-tasks' : '') + '" data-date="' + dateStr + '">' +
      '<span class="text-xs font-medium ' + (isToday ? 'text-blue-600' : 'text-neutral-600 dark:text-neutral-300') + '">' + d + '</span>' +
      '<div class="mt-1 space-y-0.5">' +
      dayTasks.slice(0, 3).map(t => {
        const color = t.deliveryStatus === 'Entregue' ? 'bg-emerald-500' : t.deliveryStatus === 'Aguardando produção' ? 'bg-violet-500' : t.priority === 'Alta' ? 'bg-red-500' : 'bg-blue-500';
        return '<div class="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white ' + color + '" data-task="' + t.id + '" title="' + escapeHtml(t.title) + '">' + escapeHtml(t.title) + '</div>';
      }).join('') +
      (dayTasks.length > 3 ? '<div class="text-[10px] text-neutral-400 px-1">+' + (dayTasks.length - 3) + '</div>' : '') +
      '</div></div>';
  }

  const totalCells = startPad + daysInMonth;
  const remain = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remain; i++) {
    html += '<div class="cal-day other-month bg-white dark:bg-neutral-900 p-1.5"><span class="text-xs text-neutral-400">' + i + '</span></div>';
  }

  document.getElementById('calGrid').innerHTML = html;
  document.getElementById('calGrid').querySelectorAll('[data-task]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); openDrawer(el.dataset.task); });
  });
}

function renderReports() {
  hideAllViews();
  document.getElementById('reportsView').classList.remove('hidden');
  const tasks = state.tasks.filter(t => !t.archived);
  const c = counts();
  const totalEst = tasks.reduce((s, t) => s + (t.estimateHours || 0), 0);
  const totalSpent = tasks.reduce((s, t) => s + (t.spentHours || 0), 0);
  const byProject = state.projects.map(p => {
    const pts = tasks.filter(t => t.projectId === p.id);
    const done = pts.filter(t => t.deliveryStatus === 'Entregue').length;
    return { name: p.name, color: p.color, total: pts.length, done, pct: pts.length ? Math.round(done / pts.length * 100) : 0 };
  });
  const byPriority = ['Alta', 'Média', 'Baixa'].map(pr => ({
    name: pr,
    count: tasks.filter(t => t.priority === pr && t.deliveryStatus !== 'Entregue').length
  }));
  const overdue = tasks.filter(t => computeSituacao(t) === 'Atrasada').length;

  document.getElementById('reportsContent').innerHTML =
    '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">' +
    '<div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4"><p class="text-xs text-neutral-500">Taxa de entrega</p><p class="text-2xl font-semibold mt-1">' + (c.all ? Math.round(c.concluidas / c.all * 100) : 0) + '%</p></div>' +
    '<div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4"><p class="text-xs text-neutral-500">Aguardando produção</p><p class="text-2xl font-semibold mt-1 text-violet-600">' + c.aguardando + '</p></div>' +
    '<div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4"><p class="text-xs text-neutral-500">Atrasadas</p><p class="text-2xl font-semibold mt-1 ' + (overdue ? 'text-red-600' : '') + '">' + overdue + '</p></div>' +
    '<div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4"><p class="text-xs text-neutral-500">Horas (gasto / estimado)</p><p class="text-2xl font-semibold mt-1 tabular-nums">' + totalSpent + '<span class="text-sm text-neutral-400 font-normal"> / ' + totalEst + 'h</span></p></div>' +
    '</div>' +
    '<div><h3 class="text-sm font-semibold mb-3">Por projeto</h3><div class="space-y-2">' +
    (byProject.map(p =>
      '<div class="flex items-center gap-3"><span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:' + p.color + '"></span>' +
      '<span class="text-sm flex-1 truncate">' + escapeHtml(p.name) + '</span>' +
      '<span class="text-xs text-neutral-400 tabular-nums">' + p.done + '/' + p.total + '</span>' +
      '<div class="w-24 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden"><div class="h-full bg-blue-500 rounded-full" style="width:' + p.pct + '%"></div></div>' +
      '<span class="text-xs font-medium tabular-nums w-8 text-right">' + p.pct + '%</span></div>'
    ).join('') || '<p class="text-sm text-neutral-400">Nenhum projeto</p>') +
    '</div></div>' +
    '<div><h3 class="text-sm font-semibold mb-3">Abertas por prioridade</h3><div class="flex gap-3">' +
    byPriority.map(p =>
      '<div class="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 text-center"><p class="text-xs text-neutral-500">' + p.name + '</p><p class="text-xl font-semibold mt-1">' + p.count + '</p></div>'
    ).join('') + '</div></div>';
}

function updateViewBtns() {
  ['viewList', 'viewKanban', 'viewCalendar'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active');
    el.classList.add('text-neutral-500');
  });
  const map = { list: 'viewList', kanban: 'viewKanban', calendar: 'viewCalendar' };
  const active = document.getElementById(map[state.viewMode] || 'viewList');
  if (active && state.viewMode !== 'reports') {
    active.classList.add('active');
    active.classList.remove('text-neutral-500');
  }
}

function refresh() {
  renderKPIs();
  renderProjects();
  renderNavActive();
  updateHeader();
  updateViewBtns();
  if (state.viewMode === 'kanban') renderKanban();
  else if (state.viewMode === 'calendar') renderCalendar();
  else if (state.viewMode === 'reports') renderReports();
  else renderList();
}

function openDrawer(id) {
  const task = id ? state.tasks.find(t => t.id === id) : null;
  drawerTaskId = id || 'new';
  const isNew = !task;
  const body = document.getElementById('drawerBody');
  const t = task || {
    title: '', projectId: state.currentProjectId || '', priority: 'Média',
    status: 'Não iniciada', deliveryStatus: 'Em aberto', progress: 0,
    startDate: '', deadline: '', endDate: '', notes: '', tags: [],
    subtasks: [], history: [], autoProgress: false, estimateHours: 0, spentHours: 0
  };

  body.innerHTML =
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Título</label>' +
    '<input type="text" id="dTitle" value="' + escapeHtml(t.title) + '" class="w-full px-3 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>' +
    '<div class="grid grid-cols-2 gap-3">' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Status técnico</label>' +
    '<select id="dStatus" class="w-full px-2.5 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">' +
    '<option value="Não iniciada"' + (t.status === 'Não iniciada' ? ' selected' : '') + '>Não iniciada</option>' +
    '<option value="Em andamento"' + (t.status === 'Em andamento' ? ' selected' : '') + '>Em andamento</option>' +
    '<option value="Concluída"' + (t.status === 'Concluída' ? ' selected' : '') + '>Concluída</option></select></div>' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Status de entrega</label>' +
    '<select id="dDelivery" class="w-full px-2.5 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">' +
    '<option value="Em aberto"' + (t.deliveryStatus === 'Em aberto' ? ' selected' : '') + '>Em aberto</option>' +
    '<option value="Aguardando produção"' + (t.deliveryStatus === 'Aguardando produção' ? ' selected' : '') + '>Aguardando produção</option>' +
    '<option value="Entregue"' + (t.deliveryStatus === 'Entregue' ? ' selected' : '') + '>Entregue</option></select></div></div>' +
    '<p class="text-[11px] text-neutral-400 -mt-3">Ex: código pronto, mas ainda aguardando publicar em produção.</p>' +
    '<div class="grid grid-cols-2 gap-3">' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Prioridade</label>' +
    '<select id="dPriority" class="w-full px-2.5 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">' +
    '<option value="Baixa"' + (t.priority === 'Baixa' ? ' selected' : '') + '>Baixa</option>' +
    '<option value="Média"' + (t.priority === 'Média' ? ' selected' : '') + '>Média</option>' +
    '<option value="Alta"' + (t.priority === 'Alta' ? ' selected' : '') + '>Alta</option></select></div>' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Progresso (%)</label>' +
    '<input type="number" id="dProgress" min="0" max="100" value="' + (t.progress || 0) + '" class="w-full px-2.5 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" /></div></div>' +
    '<div class="grid grid-cols-2 gap-3">' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Projeto</label>' +
    '<select id="dProject" class="w-full px-2.5 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">' +
    '<option value="">Sem projeto</option>' +
    state.projects.map(p => '<option value="' + p.id + '"' + (t.projectId === p.id ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>').join('') +
    '</select></div>' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Tags</label>' +
    '<input type="text" id="dTags" value="' + (t.tags || []).join(', ') + '" class="w-full px-2.5 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" placeholder="SKU, VPN..." /></div></div>' +
    '<div class="grid grid-cols-3 gap-2">' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Início</label><input type="date" id="dStart" value="' + (t.startDate || '') + '" class="w-full px-2 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" /></div>' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Prazo</label><input type="date" id="dDeadline" value="' + (t.deadline || '') + '" class="w-full px-2 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" /></div>' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Fim</label><input type="date" id="dEnd" value="' + (t.endDate || '') + '" class="w-full px-2 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" /></div></div>' +
    '<div class="grid grid-cols-2 gap-3">' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Estimativa (h)</label><input type="number" id="dEstimate" min="0" step="0.5" value="' + (t.estimateHours || 0) + '" class="w-full px-2.5 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" /></div>' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Tempo gasto (h)</label><input type="number" id="dSpent" min="0" step="0.5" value="' + (t.spentHours || 0) + '" class="w-full px-2.5 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800" /></div></div>' +
    '<div><div class="flex items-center justify-between mb-1.5"><label class="text-xs font-medium text-neutral-500">Subtarefas</label>' +
    '<button type="button" id="dAddSub" class="text-xs text-blue-600 hover:underline">+ adicionar</button></div>' +
    '<div id="dSubtasks" class="space-y-1.5"></div>' +
    '<label class="flex items-center gap-2 mt-2 text-xs text-neutral-500 cursor-pointer"><input type="checkbox" id="dAutoProg" class="rounded"' + (t.autoProgress ? ' checked' : '') + ' /> Progresso automático</label></div>' +
    '<div><label class="block text-xs font-medium text-neutral-500 mb-1">Observações</label>' +
    '<textarea id="dNotes" rows="3" class="w-full px-3 py-2 text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 resize-y">' + escapeHtml(t.notes || '') + '</textarea></div>' +
    '<div><div class="flex items-center justify-between mb-1.5"><label class="text-xs font-medium text-neutral-500">Histórico / linha do tempo</label>' +
    '<button type="button" id="dAddHist" class="text-xs text-blue-600 hover:underline">+ entrada</button></div>' +
    '<div id="dHistory" class="space-y-2"></div></div>';

  let subs = (t.subtasks || []).map(s => Object.assign({}, s));
  const renderSubs = () => {
    const cont = document.getElementById('dSubtasks');
    cont.innerHTML = subs.map((s, i) =>
      '<div class="flex items-center gap-2"><input type="checkbox" class="rounded d-sub-done" data-i="' + i + '"' + (s.done ? ' checked' : '') + ' />' +
      '<input type="text" class="flex-1 px-2 py-1 text-sm rounded border border-neutral-200 dark:border-neutral-700 bg-transparent d-sub-text" data-i="' + i + '" value="' + escapeHtml(s.text) + '" />' +
      '<button type="button" class="text-neutral-400 hover:text-red-500 d-sub-del" data-i="' + i + '"><i class="fas fa-times text-xs"></i></button></div>'
    ).join('') || '<p class="text-xs text-neutral-400">Nenhuma</p>';
    cont.querySelectorAll('.d-sub-del').forEach(btn => {
      btn.addEventListener('click', () => { subs.splice(+btn.dataset.i, 1); renderSubs(); });
    });
  };
  renderSubs();
  document.getElementById('dAddSub').onclick = () => { subs.push({ id: uid(), text: '', done: false }); renderSubs(); };

  let hist = (t.history || []).map(h => Object.assign({}, h));
  const renderHist = () => {
    const cont = document.getElementById('dHistory');
    if (!hist.length) { cont.innerHTML = '<p class="text-xs text-neutral-400">Sem histórico</p>'; return; }
    cont.innerHTML = hist.slice().reverse().map((h, i) => {
      const realIdx = hist.length - 1 - i;
      const d = h.at ? new Date(h.at) : null;
      const label = d ? String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') : '';
      return '<div class="flex gap-2 text-sm group"><div class="w-1 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0 mt-1"></div>' +
        '<div class="flex-1 min-w-0"><p class="text-xs text-neutral-400 mb-0.5">' + label + '</p>' +
        '<p class="text-neutral-700 dark:text-neutral-300 leading-snug">' + escapeHtml(h.text) + '</p></div>' +
        '<button type="button" class="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 d-hist-del" data-i="' + realIdx + '"><i class="fas fa-times text-xs"></i></button></div>';
    }).join('');
    cont.querySelectorAll('.d-hist-del').forEach(btn => {
      btn.addEventListener('click', () => { hist.splice(+btn.dataset.i, 1); renderHist(); });
    });
  };
  renderHist();
  document.getElementById('dAddHist').onclick = () => {
    const text = prompt('Entrada no histórico:');
    if (text && text.trim()) { hist.push({ at: nowISO(), text: text.trim() }); renderHist(); }
  };

  body._getSubs = () => {
    const texts = body.querySelectorAll('.d-sub-text');
    const dones = body.querySelectorAll('.d-sub-done');
    const out = [];
    texts.forEach((inp, i) => {
      const text = inp.value.trim();
      if (text) out.push({ id: (subs[i] && subs[i].id) || uid(), text, done: (dones[i] && dones[i].checked) || false });
    });
    return out;
  };
  body._getHist = () => hist;

  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
  document.getElementById('drawerArchive').style.display = isNew ? 'none' : '';
  document.getElementById('drawerDelete').style.display = isNew ? 'none' : '';
  if (state.viewMode === 'list') renderList();
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
  drawerTaskId = null;
  if (state.viewMode === 'list') renderList();
}

function saveDrawer() {
  const title = document.getElementById('dTitle').value.trim();
  if (!title) { alert('Informe o título'); return; }
  const body = document.getElementById('drawerBody');
  const data = {
    title,
    status: document.getElementById('dStatus').value,
    deliveryStatus: document.getElementById('dDelivery').value,
    priority: document.getElementById('dPriority').value,
    projectId: document.getElementById('dProject').value || null,
    progress: Math.min(100, Math.max(0, parseInt(document.getElementById('dProgress').value, 10) || 0)),
    startDate: document.getElementById('dStart').value,
    deadline: document.getElementById('dDeadline').value,
    endDate: document.getElementById('dEnd').value,
    tags: document.getElementById('dTags').value.split(',').map(s => s.trim()).filter(Boolean),
    notes: document.getElementById('dNotes').value.trim(),
    subtasks: body._getSubs(),
    history: body._getHist(),
    autoProgress: document.getElementById('dAutoProg').checked,
    estimateHours: parseFloat(document.getElementById('dEstimate').value) || 0,
    spentHours: parseFloat(document.getElementById('dSpent').value) || 0,
    updatedAt: nowISO()
  };
  if (data.status === 'Concluída' && data.progress < 100) data.progress = 100;
  if (data.status === 'Concluída' && !data.endDate) data.endDate = today();
  if (data.deliveryStatus === 'Entregue') { data.status = 'Concluída'; data.progress = 100; }
  applyAutoProgress(data);

  if (drawerTaskId && drawerTaskId !== 'new') {
    const idx = state.tasks.findIndex(t => t.id === drawerTaskId);
    if (idx >= 0) {
      const prev = state.tasks[idx];
      state.tasks[idx] = Object.assign({}, prev, data);
      if (prev.status !== data.status || prev.deliveryStatus !== data.deliveryStatus) {
        state.tasks[idx].history = state.tasks[idx].history || [];
        state.tasks[idx].history.push({ at: nowISO(), text: 'Status: ' + prev.status + '/' + prev.deliveryStatus + ' → ' + data.status + '/' + data.deliveryStatus });
      }
    }
  } else {
    state.tasks.push(Object.assign({ id: uid(), archived: false }, data));
  }
  saveState();
  closeDrawer();
  refresh();
}

function initTheme() {
  const dark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  updateThemeUI(dark);
}
function toggleTheme() {
  const dark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  updateThemeUI(dark);
}
function updateThemeUI(dark) {
  document.getElementById('themeIcon').className = dark ? 'fas fa-sun w-4 text-xs' : 'fas fa-moon w-4 text-xs';
  document.getElementById('themeLabel').textContent = dark ? 'Claro' : 'Escuro';
}

function exportData() {
  const blob = new Blob([JSON.stringify({ projects: state.projects, tasks: state.tasks }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'controle-' + today() + '.json';
  a.click();
}

function importData(file) {
  const r = new FileReader();
  r.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.tasks) throw new Error('Arquivo inválido');
      data.tasks.forEach(normalizeTask);
      state.projects = data.projects || state.projects;
      state.tasks = data.tasks;
      saveState();
      refresh();
      alert('Importado!');
    } catch (err) { alert(err.message); }
  };
  r.readAsText(file);
}

function openProjectModal() {
  document.getElementById('projectForm').reset();
  document.getElementById('projectId').value = '';
  document.getElementById('projectColor').value = '#2563eb';
  document.getElementById('projectModalTitle').textContent = 'Novo projeto';
  document.getElementById('projectModal').classList.remove('hidden');
}
function closeProjectModal() { document.getElementById('projectModal').classList.add('hidden'); }

document.getElementById('btnNewTask').onclick = () => openDrawer(null);
document.getElementById('btnEmptyNew').onclick = () => openDrawer(null);
document.getElementById('btnNewProject').onclick = openProjectModal;
document.getElementById('drawerClose').onclick = closeDrawer;
document.getElementById('drawerCancel').onclick = closeDrawer;
document.getElementById('drawerBackdrop').onclick = closeDrawer;
document.getElementById('drawerSave').onclick = saveDrawer;

document.getElementById('drawerDelete').onclick = () => {
  if (!drawerTaskId || drawerTaskId === 'new') return;
  if (!confirm('Excluir?')) return;
  state.tasks = state.tasks.filter(t => t.id !== drawerTaskId);
  saveState(); closeDrawer(); refresh();
};
document.getElementById('drawerArchive').onclick = () => {
  if (!drawerTaskId || drawerTaskId === 'new') return;
  const t = state.tasks.find(x => x.id === drawerTaskId);
  if (t) { t.archived = true; t.updatedAt = nowISO(); saveState(); closeDrawer(); refresh(); }
};

document.getElementById('viewList').onclick = () => { state.viewMode = 'list'; saveState(); refresh(); };
document.getElementById('viewKanban').onclick = () => { state.viewMode = 'kanban'; saveState(); refresh(); };
document.getElementById('viewCalendar').onclick = () => { state.viewMode = 'calendar'; saveState(); refresh(); };
document.getElementById('btnReports').onclick = () => { state.viewMode = 'reports'; state.currentProjectId = null; saveState(); refresh(); };

document.getElementById('calPrev').onclick = () => {
  ensureCalMonth();
  state.calMonth.m--;
  if (state.calMonth.m < 0) { state.calMonth.m = 11; state.calMonth.y--; }
  saveState(); renderCalendar();
};
document.getElementById('calNext').onclick = () => {
  ensureCalMonth();
  state.calMonth.m++;
  if (state.calMonth.m > 11) { state.calMonth.m = 0; state.calMonth.y++; }
  saveState(); renderCalendar();
};
document.getElementById('calToday').onclick = () => {
  const n = new Date();
  state.calMonth = { y: n.getFullYear(), m: n.getMonth() };
  saveState(); renderCalendar();
};

document.querySelectorAll('[data-nav]').forEach(btn => {
  btn.onclick = () => {
    state.nav = btn.dataset.nav;
    state.currentProjectId = null;
    if (state.viewMode === 'reports') state.viewMode = 'list';
    saveState();
    refresh();
  };
});

document.getElementById('btnTheme').onclick = toggleTheme;
document.getElementById('btnExport').onclick = exportData;
document.getElementById('btnImport').onclick = () => document.getElementById('importFile').click();
document.getElementById('importFile').onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; };

document.getElementById('projectForm').onsubmit = e => {
  e.preventDefault();
  const data = {
    name: document.getElementById('projectName').value.trim(),
    description: document.getElementById('projectDesc').value.trim(),
    color: document.getElementById('projectColor').value
  };
  state.projects.push(Object.assign({ id: uid() }, data));
  saveState();
  closeProjectModal();
  refresh();
};
document.getElementById('closeProjectModal').onclick = closeProjectModal;
document.getElementById('cancelProject').onclick = closeProjectModal;
document.getElementById('projectModalBg').onclick = closeProjectModal;

['searchInput', 'filterPriority', 'sortBy'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    if (state.viewMode === 'list') renderList();
    else if (state.viewMode === 'kanban') renderKanban();
  });
  el.addEventListener('change', () => {
    if (state.viewMode === 'list') renderList();
    else if (state.viewMode === 'kanban') renderKanban();
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); openDrawer(null); }
});


const btnBpmnEl = document.getElementById('btnBpmn');
if (btnBpmnEl) {
  btnBpmnEl.onclick = () => {
    if (!state.currentProjectId) return;
    window.location.href = 'bpmn.html?project=' + encodeURIComponent(state.currentProjectId);
  };
}

initTheme();
refresh();
