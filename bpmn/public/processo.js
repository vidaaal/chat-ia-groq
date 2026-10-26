
/* Mini LECOM MVP — baseado no Guia Técnico LECOM 5.70
   Módulos: Workspace | Studio | Admin | Análises
   Conceitos: Processo, Instância, Atividade/Etapa, Ação, Formulário, Grupo
*/
const KEY = "mini_lecom_v2";

const SEED = {
  users: [
    { id: "u1", name: "Rafael", email: "rafael@empresa.com", role: "Analista TI", dept: "TI", active: true },
    { id: "u2", name: "Tyago", email: "tyago@empresa.com", role: "Gestor", dept: "TI", active: true },
    { id: "u3", name: "Thyago", email: "thyago@empresa.com", role: "Analista", dept: "Controladoria", active: true },
    { id: "u4", name: "Eliezer", email: "eliezer@empresa.com", role: "Solicitante", dept: "Operações", active: true }
  ],
  groups: [
    { id: "g1", name: "Aprovadores TI", memberIds: ["u2"] },
    { id: "g2", name: "Controladoria", memberIds: ["u3"] },
    { id: "g3", name: "Solicitantes", memberIds: ["u1", "u4"] }
  ],
  processes: [{
    id: "p1",
    name: "Aprovação simples",
    description: "Solicitar → revisar/aprovar → concluir (blueprint MVP do guia)",
    version: 1,
    active: true,
    published: true,
    steps: [
      { id: "s1", name: "Preencher solicitação", type: "form", assigneeType: "starter", actions: ["enviar"] },
      { id: "s2", name: "Aprovar solicitação", type: "approve", assigneeType: "group", assigneeId: "g1", actions: ["aprovar", "devolver", "rejeitar"] },
      { id: "s3", name: "Concluído", type: "end", assigneeType: null, actions: [] }
    ],
    form: [
      { id: "TX_TITULO", label: "Título", type: "text", required: true, section: "Dados gerais" },
      { id: "TX_AREA", label: "Área", type: "select", required: true, section: "Dados gerais", options: ["TI", "Controladoria", "Comercial", "Operações"] },
      { id: "TX_PRIORIDADE", label: "Prioridade", type: "select", required: true, section: "Dados gerais", options: ["Baixa", "Média", "Alta"] },
      { id: "TX_DESCRICAO", label: "Descrição / justificativa", type: "textarea", required: true, section: "Detalhes" },
      { id: "DT_PRAZO", label: "Prazo desejado", type: "date", required: false, section: "Detalhes" },
      { id: "VL_ESTIMADO", label: "Valor estimado (R$)", type: "number", required: false, section: "Detalhes" }
    ]
  }],
  instances: [],
  audit: [],
  currentUserId: "u1"
};

let state = load();
let view = "inbox";
let openInstId = null;
let editProcessId = null;

function load() {
  try {
    const r = localStorage.getItem(KEY);
    if (r) { const p = JSON.parse(r); if (p.users && p.processes) return p; }
    // migrate from old key
    const old = localStorage.getItem("mini_bpm_v1");
    if (old) {
      const o = JSON.parse(old);
      return { ...SEED, users: o.users || SEED.users, processes: o.processes || SEED.processes, instances: o.instances || [], currentUserId: o.currentUserId || "u1", groups: SEED.groups, audit: [] };
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(SEED));
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function uid(p) { return (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function userById(id) { return state.users.find(u => u.id === id); }
function groupById(id) { return (state.groups || []).find(g => g.id === id); }
function processById(id) { return state.processes.find(p => p.id === id); }
function me() { return userById(state.currentUserId) || state.users[0]; }

function audit(text, extra) {
  state.audit = state.audit || [];
  state.audit.unshift({ at: new Date().toISOString(), userId: state.currentUserId, text, ...(extra || {}) });
  if (state.audit.length > 200) state.audit.length = 200;
}

function stepAssigneeIds(step, inst) {
  if (!step) return [];
  if (step.assigneeType === "starter") return [inst.createdById];
  if (step.assigneeType === "user") return step.assigneeId ? [step.assigneeId] : [];
  if (step.assigneeType === "group") {
    const g = groupById(step.assigneeId);
    return g ? (g.memberIds || []) : [];
  }
  return [];
}

function userCanAct(inst) {
  if (inst.status !== "Em andamento") return false;
  const proc = processById(inst.processId);
  if (!proc) return false;
  const step = proc.steps.find(s => s.id === inst.stepId);
  if (!step || step.type === "end") return false;
  return stepAssigneeIds(step, inst).includes(state.currentUserId);
}

function inboxFor(userId) {
  return state.instances.filter(i => {
    if (i.status === "Concluído" || i.status === "Cancelado") return false;
    const proc = processById(i.processId);
    if (!proc) return false;
    const step = proc.steps.find(s => s.id === i.stepId);
    if (!step || step.type === "end") return false;
    return stepAssigneeIds(step, i).includes(userId);
  });
}

function instDeadline(inst) {
  if (inst.data && (inst.data.DT_PRAZO || inst.data.prazo)) return inst.data.DT_PRAZO || inst.data.prazo;
  try {
    const d = new Date(inst.createdAt);
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  } catch (e) { return null; }
}
function instSla(inst) {
  if (inst.status === "Concluído" || inst.status === "Cancelado") return "ok";
  const dl = instDeadline(inst);
  if (!dl) return "ok";
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const d = new Date(dl + "T12:00:00");
  const diff = Math.floor((d - now) / 86400000);
  if (diff < 0) return "atrasado";
  if (diff <= 1) return "alerta";
  return "ok";
}
function codeOf(inst) {
  const n = parseInt(String(inst.id).replace(/\D/g, "").slice(-4) || "0", 10);
  return String(n || Math.abs(hashCode(inst.id)) % 9000 + 1000);
}
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0; return h; }
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function fmt(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return iso; }
}
function fmtDate(d) {
  if (!d) return "Sem prazo";
  if (d.length === 10) { const [y, m, day] = d.split("-"); return day + "/" + m + "/" + y; }
  return fmt(d).split(" ")[0];
}

function refreshUserSelect() {
  document.getElementById("currentUser").innerHTML = state.users.filter(u => u.active !== false).map(u =>
    `<option value="${u.id}" ${u.id === state.currentUserId ? "selected" : ""}>${esc(u.name)}</option>`
  ).join("");
}

function setView(v) { view = v; openInstId = null; editProcessId = null; render(); }

function render() {
  refreshUserSelect();
  document.querySelectorAll(".nav").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  const n = inboxFor(state.currentUserId).length;
  const badge = document.getElementById("badgeInbox");
  if (n) { badge.textContent = n; badge.classList.remove("hidden"); } else badge.classList.add("hidden");

  const main = document.getElementById("main");
  if (openInstId) { main.innerHTML = renderInstance(); bindInstance(); return; }
  if (editProcessId !== null) { main.innerHTML = renderProcessEditor(); bindProcessEditor(); return; }

  if (view === "inbox") main.innerHTML = renderDashboard();
  else if (view === "caixa" || view === "alerta" || view === "atraso") main.innerHTML = renderCaixa(view);
  else if (view === "abrir") main.innerHTML = renderCatalog();
  else if (view === "mine") main.innerHTML = renderMine();
  else if (view === "geridos") main.innerHTML = renderGeridos();
  else if (view === "studio") main.innerHTML = renderStudio();
  else if (view === "users") main.innerHTML = renderUsersAdmin();
  else if (view === "groups") main.innerHTML = renderGroupsAdmin();
  else if (view === "analises") main.innerHTML = renderAnalises();
  else if (view === "auditoria") main.innerHTML = renderAuditoria();
  bindMain();
}

function cardInst(i) {
  const proc = processById(i.processId);
  const step = proc && proc.steps.find(s => s.id === i.stepId);
  const title = i.data.TX_TITULO || i.data.titulo || (proc && proc.name) || "Solicitação";
  const stepName = step ? step.name : i.status;
  const color = i.status === "Concluído" ? "text-emerald-600" : step && step.type === "approve" ? "text-violet-600" : "text-blue-600";
  return `<button data-open="${i.id}" class="w-full text-left bg-white border border-neutral-200 rounded-lg px-4 py-3 hover:border-violet-300 transition">
    <div class="flex justify-between gap-2"><p class="font-medium text-sm truncate">${esc(title)}</p>
    <span class="text-[11px] font-medium ${color} shrink-0">${esc(stepName)}</span></div>
    <p class="text-xs text-neutral-400 mt-1">#${codeOf(i)} · ${esc(proc ? proc.name : "")} · ${esc((userById(i.createdById) || {}).name || "")} · ciclo ${i.ciclo || 1}</p></button>`;
}

/* ——— Workspace ——— */
function renderDashboard() {
  const items = inboxFor(state.currentUserId);
  const total = items.length;
  const atrasados = items.filter(i => instSla(i) === "atrasado").length;
  const alertas = items.filter(i => instSla(i) === "alerta").length;
  const noPrazo = total - atrasados - alertas;
  const byProc = {};
  items.forEach(i => {
    if (!byProc[i.processId]) byProc[i.processId] = { items: [], process: processById(i.processId) };
    byProc[i.processId].items.push(i);
  });
  const rows = Object.values(byProc).map(g => {
    const name = (g.process && g.process.name) || "Processo";
    const ver = (g.process && g.process.version) || 1;
    const n = g.items.length;
    const atr = g.items.filter(i => instSla(i) === "atrasado").length;
    const ok = n - atr;
    return `<div class="bg-white border border-neutral-200 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 hover:border-violet-300 cursor-pointer" data-goto-caixa>
      <div class="flex-1 min-w-[180px]"><p class="font-medium text-sm text-violet-700">${esc(name)}</p>
      <p class="text-[11px] text-neutral-400">Versão ${ver}</p></div>
      <span class="text-xs bg-neutral-100 px-2 py-1 rounded">${n} atividade${n !== 1 ? "s" : ""}</span>
      ${ok ? `<span class="text-xs bg-sky-100 text-sky-800 px-2 py-1 rounded">${ok} no prazo</span>` : ""}
      ${atr ? `<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">${atr} em atraso</span>` : ""}
    </div>`;
  }).join("");

  return `<div class="p-6 max-w-5xl">
    <h1 class="text-xl font-semibold mb-1">Minhas atividades</h1>
    <p class="text-sm text-neutral-500 mb-5">Workspace · carga de <strong>${esc(me().name)}</strong></p>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <div class="bg-white border border-neutral-200 rounded-lg p-4"><p class="text-xs text-neutral-500 font-medium">Atividades</p><p class="text-3xl font-semibold mt-1 tabular-nums">${total}</p></div>
      <div class="bg-sky-100 rounded-lg p-4"><p class="text-xs text-sky-800 font-medium">No prazo</p><p class="text-3xl font-semibold mt-1 tabular-nums text-sky-900">${noPrazo}</p></div>
      <div class="bg-amber-100 rounded-lg p-4"><p class="text-xs text-amber-800 font-medium">Em alerta</p><p class="text-3xl font-semibold mt-1 tabular-nums text-amber-900">${alertas}</p></div>
      <div class="bg-red-100 rounded-lg p-4"><p class="text-xs text-red-800 font-medium">Atrasado</p><p class="text-3xl font-semibold mt-1 tabular-nums text-red-900">${atrasados}</p></div>
    </div>
    <h2 class="text-sm font-semibold text-neutral-600 mb-3">Por processo</h2>
    <div class="space-y-2">${rows || '<p class="text-sm text-neutral-400 py-8 text-center">Nenhuma atividade na sua fila</p>'}</div>
  </div>`;
}

function renderCaixa(mode) {
  let items = inboxFor(state.currentUserId);
  if (mode === "alerta") items = items.filter(i => instSla(i) === "alerta");
  if (mode === "atraso") items = items.filter(i => instSla(i) === "atrasado");
  const q = (document.getElementById("globalSearch") || {}).value || "";
  if (q.trim()) {
    const qq = q.toLowerCase();
    items = items.filter(i => {
      const proc = processById(i.processId);
      const step = proc && proc.steps.find(s => s.id === i.stepId);
      const title = i.data.TX_TITULO || i.data.titulo || "";
      return codeOf(i).includes(qq) || title.toLowerCase().includes(qq) || (proc && proc.name.toLowerCase().includes(qq)) || (step && step.name.toLowerCase().includes(qq));
    });
  }
  const title = mode === "alerta" ? "Em alerta" : mode === "atraso" ? "Em atraso" : "Caixa de entrada";
  const rows = items.map(i => {
    const proc = processById(i.processId);
    const step = proc && proc.steps.find(s => s.id === i.stepId);
    const opener = userById(i.createdById);
    const dl = instDeadline(i);
    const sla = instSla(i);
    const statusBadge = i.status === "Concluído"
      ? '<span class="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Concluído</span>'
      : '<span class="text-[11px] px-2 py-0.5 rounded bg-sky-100 text-sky-800">Em andamento</span>';
    const prazoCls = sla === "atrasado" ? "text-red-600 font-medium" : sla === "alerta" ? "text-amber-600 font-medium" : "text-neutral-500";
    return `<tr data-open="${i.id}" class="hover:bg-violet-50/60 cursor-pointer border-b border-neutral-100">
      <td class="px-3 py-2.5 text-sm text-neutral-500 tabular-nums">${codeOf(i)}</td>
      <td class="px-3 py-2.5 text-sm font-medium text-violet-700">${esc(step ? step.name : (i.data.TX_TITULO || "—"))}</td>
      <td class="px-3 py-2.5 text-sm text-neutral-600">${esc(proc ? proc.name : "")}</td>
      <td class="px-3 py-2.5 text-sm text-neutral-500">${esc((opener && opener.name) || "—")}</td>
      <td class="px-3 py-2.5 text-xs text-neutral-500 tabular-nums whitespace-nowrap">${fmt(i.createdAt)}</td>
      <td class="px-3 py-2.5 text-xs text-neutral-500 tabular-nums">${i.ciclo || 1}</td>
      <td class="px-3 py-2.5 text-xs ${prazoCls} whitespace-nowrap">${fmtDate(dl)}</td>
      <td class="px-3 py-2.5">${statusBadge}</td>
    </tr>`;
  }).join("");

  return `<div class="p-6 max-w-[1200px]">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-semibold">${title}</h1>
      <span class="text-xs text-neutral-400">${items.length} registro${items.length !== 1 ? "s" : ""}</span>
    </div>
    <div class="flex flex-wrap gap-2 mb-4">
      <span class="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600">Fila de ${esc(me().name)}</span>
      <span class="text-xs px-2.5 py-1 rounded-full bg-sky-100 text-sky-800">Em andamento</span>
    </div>
    <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left min-w-[860px]">
          <thead><tr class="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500 border-b border-neutral-200">
            <th class="px-3 py-2.5 font-medium">Código</th>
            <th class="px-3 py-2.5 font-medium">Atividade</th>
            <th class="px-3 py-2.5 font-medium">Processo</th>
            <th class="px-3 py-2.5 font-medium">Aberto por</th>
            <th class="px-3 py-2.5 font-medium">Aberto em</th>
            <th class="px-3 py-2.5 font-medium">Ciclo</th>
            <th class="px-3 py-2.5 font-medium">Prazo</th>
            <th class="px-3 py-2.5 font-medium">Status</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="8" class="px-4 py-12 text-center text-sm text-neutral-400">Nenhuma atividade</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function renderCatalog() {
  const active = state.processes.filter(p => p.active && p.published !== false);
  return `<div class="p-6 max-w-3xl">
    <h1 class="text-xl font-semibold mb-1">Abrir</h1>
    <p class="text-sm text-neutral-500 mb-6">Iniciar processo como <strong>${esc(me().name)}</strong></p>
    <div class="space-y-3">${active.map(p => `
      <div class="bg-white border border-neutral-200 rounded-xl p-4 flex gap-4 items-start">
        <div class="w-10 h-10 rounded-lg bg-violet-700 text-white flex items-center justify-center shrink-0"><i class="fas fa-file-signature"></i></div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm">${esc(p.name)}</p>
          <p class="text-xs text-neutral-500 mt-0.5">${esc(p.description || "")}</p>
          <p class="text-[11px] text-neutral-400 mt-1">Versão ${p.version || 1} · ${p.steps.length} etapas</p>
        </div>
        <button data-start="${p.id}" class="bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium px-3 py-1.5 rounded-md shrink-0">Iniciar</button>
      </div>`).join("") || '<p class="text-sm text-neutral-400">Nenhum processo publicado. Vá em Studio.</p>'}
    </div></div>`;
}

function renderMine() {
  const items = state.instances.filter(i => i.createdById === state.currentUserId);
  return `<div class="p-6 max-w-3xl"><h1 class="text-xl font-semibold mb-1">Abertos por mim</h1>
    <p class="text-sm text-neutral-500 mb-4">Instâncias iniciadas por ${esc(me().name)}</p>
    <div class="space-y-2">${items.map(cardInst).join("") || '<p class="text-sm text-neutral-400 py-10 text-center">Nenhuma ainda</p>'}</div></div>`;
}

function renderGeridos() {
  // managed = instances where current user is in an approve group/user on any step of process, or created
  const items = state.instances.filter(i => {
    if (i.createdById === state.currentUserId) return true;
    const proc = processById(i.processId);
    if (!proc) return false;
    return proc.steps.some(s => stepAssigneeIds(s, i).includes(state.currentUserId));
  });
  return `<div class="p-6 max-w-3xl"><h1 class="text-xl font-semibold mb-1">Geridos por mim</h1>
    <p class="text-sm text-neutral-500 mb-4">Processos em que você participa como responsável</p>
    <div class="space-y-2">${items.map(cardInst).join("") || '<p class="text-sm text-neutral-400 py-10 text-center">Nenhum</p>'}</div></div>`;
}

/* ——— Studio ——— */
function renderStudio() {
  return `<div class="p-6 max-w-3xl">
    <div class="flex items-center justify-between mb-4">
      <div><h1 class="text-xl font-semibold">Studio — Processos</h1>
      <p class="text-sm text-neutral-500">Modelar etapas, formulário, responsáveis e ações</p></div>
      <button id="btnNewProcess" class="bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium px-3 py-1.5 rounded-md"><i class="fas fa-plus mr-1"></i>Novo processo</button>
    </div>
    <div class="space-y-2">${state.processes.map(p => {
      const who = (s) => s.assigneeType === "starter" ? "Solicitante" : s.assigneeType === "user" ? ((userById(s.assigneeId) || {}).name || "?") : s.assigneeType === "group" ? ((groupById(s.assigneeId) || {}).name || "?") : "—";
      return `<div class="bg-white border border-neutral-200 rounded-xl p-4">
        <div class="flex items-start gap-3"><div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-semibold text-sm">${esc(p.name)}</p>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">v${p.version || 1}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}">${p.active ? "Ativo" : "Inativo"}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded ${p.published !== false ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}">${p.published !== false ? "Publicado" : "Rascunho"}</span>
          </div>
          <p class="text-xs text-neutral-500 mt-0.5">${esc(p.description || "")}</p>
          <div class="flex flex-wrap gap-1.5 mt-2">${p.steps.map((s, i) =>
            `<span class="text-[11px] bg-neutral-100 px-2 py-0.5 rounded">${i + 1}. ${esc(s.name)} <span class="text-neutral-400">(${esc(who(s))})</span></span>`
          ).join('<span class="text-neutral-300 text-[11px]">→</span>')}</div>
        </div>
        <button data-edit-proc="${p.id}" class="text-xs text-violet-700 hover:underline shrink-0">Configurar</button>
      </div></div>`;
    }).join("") || '<p class="text-sm text-neutral-400">Nenhum processo</p>'}</div>
  </div>`;
}

function renderProcessEditor() {
  const isNew = editProcessId === "new";
  const p = isNew ? {
    name: "", description: "", version: 1, active: true, published: true,
    steps: [
      { id: uid("s"), name: "Preencher formulário", type: "form", assigneeType: "starter", actions: ["enviar"] },
      { id: uid("s"), name: "Aprovar", type: "approve", assigneeType: "group", assigneeId: (state.groups[0] || {}).id || "", actions: ["aprovar", "devolver", "rejeitar"] },
      { id: uid("s"), name: "Fim", type: "end", assigneeType: null, actions: [] }
    ],
    form: [
      { id: "TX_TITULO", label: "Título", type: "text", required: true, section: "Geral" },
      { id: "TX_DESCRICAO", label: "Descrição", type: "textarea", required: true, section: "Geral" }
    ]
  } : JSON.parse(JSON.stringify(processById(editProcessId)));
  window._editProc = p;

  return `<div class="p-6 max-w-3xl">
    <button id="btnBackProc" class="text-sm text-neutral-500 hover:text-neutral-800 mb-3"><i class="fas fa-arrow-left mr-1"></i> Voltar</button>
    <h1 class="text-xl font-semibold mb-4">${isNew ? "Novo processo" : "Configurar processo"}</h1>
    <div class="space-y-6">
      <div class="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <div><label class="text-xs font-medium text-neutral-500">Nome *</label>
          <input id="procName" value="${esc(p.name)}" class="mt-1 w-full px-3 py-2 text-sm rounded-md border border-neutral-200"/></div>
        <div><label class="text-xs font-medium text-neutral-500">Descrição</label>
          <input id="procDesc" value="${esc(p.description || "")}" class="mt-1 w-full px-3 py-2 text-sm rounded-md border border-neutral-200"/></div>
        <div class="flex flex-wrap gap-4">
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="procActive" ${p.active ? "checked" : ""} class="rounded"/> Ativo</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="procPublished" ${p.published !== false ? "checked" : ""} class="rounded"/> Publicado (aparece em Abrir)</label>
          <div class="text-sm flex items-center gap-2"><label class="text-xs text-neutral-500">Versão</label>
            <input type="number" id="procVersion" min="1" value="${p.version || 1}" class="w-16 px-2 py-1 text-sm rounded border border-neutral-200"/></div>
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-2"><h2 class="text-sm font-semibold">Etapas e ações</h2>
          <button id="btnAddStep" class="text-xs text-violet-700 hover:underline">+ etapa</button></div>
        <div id="stepsList" class="space-y-2"></div>
        <p class="text-[11px] text-neutral-400 mt-2">Responsável: Solicitante · Usuário · <strong>Grupo</strong> (recomendado no guia). Ações: enviar, aprovar, devolver, rejeitar.</p>
      </div>
      <div>
        <div class="flex items-center justify-between mb-2"><h2 class="text-sm font-semibold">Campos do formulário (IDs técnicos)</h2>
          <button id="btnAddField" class="text-xs text-violet-700 hover:underline">+ campo</button></div>
        <div id="fieldsList" class="space-y-2"></div>
        <p class="text-[11px] text-neutral-400 mt-2">Use IDs estáveis tipo TX_TITULO, DT_PRAZO (como no guia LECOM).</p>
      </div>
      <div class="flex justify-end gap-2">
        ${!isNew ? '<button id="btnDelProc" class="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md">Excluir</button>' : ""}
        <button id="btnSaveProc" class="px-4 py-1.5 text-sm bg-violet-700 hover:bg-violet-800 text-white rounded-md font-medium">Salvar processo</button>
      </div>
    </div>
  </div>`;
}

function renderStepsList() {
  const p = window._editProc;
  const cont = document.getElementById("stepsList");
  if (!cont) return;
  cont.innerHTML = p.steps.map((s, i) => `
    <div class="bg-white border border-neutral-200 rounded-lg p-3" data-step="${i}">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs text-neutral-400 w-5">${i + 1}.</span>
        <input class="flex-1 text-sm px-2 py-1 rounded border border-neutral-200 step-name" value="${esc(s.name)}"/>
        <select class="text-xs rounded border border-neutral-200 px-2 py-1 step-type">
          <option value="form" ${s.type === "form" ? "selected" : ""}>Formulário</option>
          <option value="approve" ${s.type === "approve" ? "selected" : ""}>Aprovação</option>
          <option value="end" ${s.type === "end" ? "selected" : ""}>Fim</option>
        </select>
        ${p.steps.length > 1 ? '<button class="text-neutral-400 hover:text-red-500 step-del text-xs"><i class="fas fa-times"></i></button>' : ""}
      </div>
      <div class="flex flex-wrap items-center gap-2 pl-5 ${s.type === "end" ? "opacity-40 pointer-events-none" : ""}">
        <span class="text-[11px] text-neutral-400">Responsável:</span>
        <select class="text-xs rounded border border-neutral-200 px-2 py-1 step-assign-type">
          <option value="starter" ${s.assigneeType === "starter" ? "selected" : ""}>Solicitante</option>
          <option value="user" ${s.assigneeType === "user" ? "selected" : ""}>Usuário</option>
          <option value="group" ${s.assigneeType === "group" ? "selected" : ""}>Grupo</option>
        </select>
        <select class="text-xs rounded border border-neutral-200 px-2 py-1 step-assign-user ${s.assigneeType !== "user" ? "hidden" : ""}">
          ${state.users.map(u => `<option value="${u.id}" ${s.assigneeId === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}
        </select>
        <select class="text-xs rounded border border-neutral-200 px-2 py-1 step-assign-group ${s.assigneeType !== "group" ? "hidden" : ""}">
          ${(state.groups || []).map(g => `<option value="${g.id}" ${s.assigneeId === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}
        </select>
      </div>
    </div>`).join("");
  cont.querySelectorAll("[data-step]").forEach(row => {
    const i = +row.dataset.step;
    row.querySelector(".step-name").oninput = e => { p.steps[i].name = e.target.value; };
    row.querySelector(".step-type").onchange = e => {
      p.steps[i].type = e.target.value;
      if (e.target.value === "form") p.steps[i].actions = ["enviar"];
      if (e.target.value === "approve") p.steps[i].actions = ["aprovar", "devolver", "rejeitar"];
      if (e.target.value === "end") p.steps[i].actions = [];
      renderStepsList();
    };
    row.querySelector(".step-assign-type").onchange = e => {
      p.steps[i].assigneeType = e.target.value;
      if (e.target.value === "user") p.steps[i].assigneeId = state.users[0]?.id;
      if (e.target.value === "group") p.steps[i].assigneeId = state.groups[0]?.id;
      renderStepsList();
    };
    const su = row.querySelector(".step-assign-user");
    if (su) su.onchange = e => { p.steps[i].assigneeId = e.target.value; };
    const sg = row.querySelector(".step-assign-group");
    if (sg) sg.onchange = e => { p.steps[i].assigneeId = e.target.value; };
    const del = row.querySelector(".step-del");
    if (del) del.onclick = () => { p.steps.splice(i, 1); renderStepsList(); };
  });
}

function renderFieldsList() {
  const p = window._editProc;
  const cont = document.getElementById("fieldsList");
  if (!cont) return;
  cont.innerHTML = p.form.map((f, i) => `
    <div class="bg-white border border-neutral-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2" data-field="${i}">
      <input class="text-xs px-2 py-1 rounded border border-neutral-200 font-mono field-id" placeholder="ID (TX_...)" value="${esc(f.id)}"/>
      <input class="text-sm px-2 py-1 rounded border border-neutral-200 field-label" placeholder="Rótulo" value="${esc(f.label)}"/>
      <select class="text-xs rounded border border-neutral-200 px-2 py-1 field-type">
        <option value="text" ${f.type === "text" ? "selected" : ""}>Texto</option>
        <option value="textarea" ${f.type === "textarea" ? "selected" : ""}>Texto longo</option>
        <option value="number" ${f.type === "number" ? "selected" : ""}>Número</option>
        <option value="date" ${f.type === "date" ? "selected" : ""}>Data</option>
        <option value="select" ${f.type === "select" ? "selected" : ""}>Lista</option>
      </select>
      <div class="flex items-center gap-2">
        <label class="text-xs flex items-center gap-1"><input type="checkbox" class="rounded field-req" ${f.required ? "checked" : ""}/> Obrig.</label>
        <button class="ml-auto text-neutral-400 hover:text-red-500 field-del text-xs"><i class="fas fa-times"></i></button>
      </div>
      <input class="text-xs px-2 py-1 rounded border border-neutral-200 col-span-2 field-section" value="${esc(f.section || "Geral")}"/>
      <input class="text-xs px-2 py-1 rounded border border-neutral-200 col-span-2 field-options ${f.type !== "select" ? "hidden" : ""}" placeholder="Opções (vírgula)" value="${esc((f.options || []).join(", "))}"/>
    </div>`).join("") || '<p class="text-xs text-neutral-400">Nenhum campo</p>';
  cont.querySelectorAll("[data-field]").forEach(row => {
    const i = +row.dataset.field;
    row.querySelector(".field-id").oninput = e => { p.form[i].id = e.target.value.trim() || p.form[i].id; };
    row.querySelector(".field-label").oninput = e => { p.form[i].label = e.target.value; };
    row.querySelector(".field-type").onchange = e => { p.form[i].type = e.target.value; renderFieldsList(); };
    row.querySelector(".field-req").onchange = e => { p.form[i].required = e.target.checked; };
    row.querySelector(".field-section").oninput = e => { p.form[i].section = e.target.value; };
    const opt = row.querySelector(".field-options");
    if (opt) opt.oninput = e => { p.form[i].options = e.target.value.split(",").map(x => x.trim()).filter(Boolean); };
    row.querySelector(".field-del").onclick = () => { p.form.splice(i, 1); renderFieldsList(); };
  });
}

function bindProcessEditor() {
  renderStepsList(); renderFieldsList();
  document.getElementById("btnBackProc").onclick = () => { editProcessId = null; render(); };
  document.getElementById("btnAddStep").onclick = () => {
    window._editProc.steps.splice(window._editProc.steps.length - 1, 0, {
      id: uid("s"), name: "Nova etapa", type: "approve", assigneeType: "group",
      assigneeId: state.groups[0]?.id, actions: ["aprovar", "devolver", "rejeitar"]
    });
    renderStepsList();
  };
  document.getElementById("btnAddField").onclick = () => {
    window._editProc.form.push({ id: "TX_NOVO_" + Date.now().toString(36).slice(-4).toUpperCase(), label: "Novo campo", type: "text", required: false, section: "Geral" });
    renderFieldsList();
  };
  document.getElementById("btnSaveProc").onclick = () => {
    const p = window._editProc;
    p.name = document.getElementById("procName").value.trim();
    p.description = document.getElementById("procDesc").value.trim();
    p.active = document.getElementById("procActive").checked;
    p.published = document.getElementById("procPublished").checked;
    p.version = parseInt(document.getElementById("procVersion").value, 10) || 1;
    if (!p.name) { alert("Informe o nome"); return; }
    if (editProcessId === "new") { p.id = uid("p"); state.processes.push(p); audit("Processo criado: " + p.name); }
    else {
      const idx = state.processes.findIndex(x => x.id === editProcessId);
      if (idx >= 0) state.processes[idx] = p;
      audit("Processo alterado: " + p.name);
    }
    save(); editProcessId = null; render();
  };
  const del = document.getElementById("btnDelProc");
  if (del) del.onclick = () => {
    if (!confirm("Excluir processo?")) return;
    const name = (processById(editProcessId) || {}).name;
    state.processes = state.processes.filter(x => x.id !== editProcessId);
    audit("Processo excluído: " + name);
    save(); editProcessId = null; render();
  };
}

/* ——— Admin ——— */
function renderUsersAdmin() {
  return `<div class="p-6 max-w-3xl">
    <div class="flex items-center justify-between mb-4">
      <div><h1 class="text-xl font-semibold">Admin — Pessoas</h1><p class="text-sm text-neutral-500">Usuários, departamento e função</p></div>
      <button id="btnNewUser" class="bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium px-3 py-1.5 rounded-md"><i class="fas fa-plus mr-1"></i>Nova pessoa</button>
    </div>
    <div class="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
      ${state.users.map(u => `
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="w-9 h-9 rounded-full bg-violet-100 text-violet-800 flex items-center justify-center text-sm font-semibold">${esc(u.name.slice(0, 1))}</div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm">${esc(u.name)} ${u.active === false ? '<span class="text-[10px] text-red-500">inativo</span>' : ""}</p>
            <p class="text-xs text-neutral-400">${esc(u.email || "")} · ${esc(u.role || "")} · ${esc(u.dept || "")}</p>
          </div>
          <button data-edit-user="${u.id}" class="text-xs text-neutral-500 hover:text-violet-700 px-2 py-1">Editar</button>
          <button data-del-user="${u.id}" class="text-xs text-neutral-500 hover:text-red-600 px-2 py-1">Excluir</button>
        </div>`).join("")}
    </div></div>`;
}

function openUserModal(id) {
  const u = id ? userById(id) : { name: "", email: "", role: "", dept: "", active: true };
  showModal(id ? "Editar pessoa" : "Nova pessoa", `
    <form id="userForm" class="space-y-3">
      <input type="hidden" id="userId" value="${id || ""}"/>
      <div><label class="text-xs font-medium text-neutral-500">Nome *</label>
        <input id="userName" required value="${esc(u.name)}" class="mt-1 w-full px-3 py-2 text-sm rounded-md border border-neutral-200"/></div>
      <div><label class="text-xs font-medium text-neutral-500">E-mail</label>
        <input id="userEmail" type="email" value="${esc(u.email || "")}" class="mt-1 w-full px-3 py-2 text-sm rounded-md border border-neutral-200"/></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-medium text-neutral-500">Função</label>
          <input id="userRole" value="${esc(u.role || "")}" class="mt-1 w-full px-3 py-2 text-sm rounded-md border border-neutral-200"/></div>
        <div><label class="text-xs font-medium text-neutral-500">Departamento</label>
          <input id="userDept" value="${esc(u.dept || "")}" class="mt-1 w-full px-3 py-2 text-sm rounded-md border border-neutral-200"/></div>
      </div>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="userActive" ${u.active !== false ? "checked" : ""} class="rounded"/> Ativo</label>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" id="modalCancel" class="px-3 py-1.5 text-sm rounded-md text-neutral-600 hover:bg-neutral-100">Cancelar</button>
        <button type="submit" class="px-3 py-1.5 text-sm rounded-md bg-violet-700 text-white">Salvar</button>
      </div></form>`);
  document.getElementById("userForm").onsubmit = e => {
    e.preventDefault();
    const data = {
      name: document.getElementById("userName").value.trim(),
      email: document.getElementById("userEmail").value.trim(),
      role: document.getElementById("userRole").value.trim(),
      dept: document.getElementById("userDept").value.trim(),
      active: document.getElementById("userActive").checked
    };
    if (!data.name) return;
    const existing = document.getElementById("userId").value;
    if (existing) {
      const idx = state.users.findIndex(x => x.id === existing);
      if (idx >= 0) state.users[idx] = { ...state.users[idx], ...data };
      audit("Usuário alterado: " + data.name);
    } else {
      state.users.push({ id: uid("u"), ...data });
      audit("Usuário criado: " + data.name);
    }
    save(); hideModal(); render();
  };
}

function renderGroupsAdmin() {
  return `<div class="p-6 max-w-3xl">
    <div class="flex items-center justify-between mb-4">
      <div><h1 class="text-xl font-semibold">Admin — Grupos</h1>
      <p class="text-sm text-neutral-500">Atribuição coletiva de atividades (recomendado no guia)</p></div>
      <button id="btnNewGroup" class="bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium px-3 py-1.5 rounded-md"><i class="fas fa-plus mr-1"></i>Novo grupo</button>
    </div>
    <div class="space-y-2">${(state.groups || []).map(g => `
      <div class="bg-white border border-neutral-200 rounded-xl p-4 flex items-start gap-3">
        <div class="flex-1">
          <p class="font-semibold text-sm">${esc(g.name)}</p>
          <p class="text-xs text-neutral-500 mt-1">${(g.memberIds || []).map(id => esc((userById(id) || {}).name || id)).join(", ") || "Sem membros"}</p>
        </div>
        <button data-edit-group="${g.id}" class="text-xs text-violet-700 hover:underline">Editar</button>
        <button data-del-group="${g.id}" class="text-xs text-red-600 hover:underline">Excluir</button>
      </div>`).join("") || '<p class="text-sm text-neutral-400">Nenhum grupo</p>'}
    </div></div>`;
}

function openGroupModal(id) {
  const g = id ? groupById(id) : { name: "", memberIds: [] };
  const members = g.memberIds || [];
  showModal(id ? "Editar grupo" : "Novo grupo", `
    <form id="groupForm" class="space-y-3">
      <input type="hidden" id="groupId" value="${id || ""}"/>
      <div><label class="text-xs font-medium text-neutral-500">Nome *</label>
        <input id="groupName" required value="${esc(g.name)}" class="mt-1 w-full px-3 py-2 text-sm rounded-md border border-neutral-200"/></div>
      <div><label class="text-xs font-medium text-neutral-500">Membros</label>
        <div class="mt-1 space-y-1 max-h-48 overflow-y-auto border border-neutral-200 rounded-md p-2">
          ${state.users.map(u => `
            <label class="flex items-center gap-2 text-sm py-0.5">
              <input type="checkbox" class="rounded group-member" value="${u.id}" ${members.includes(u.id) ? "checked" : ""}/>
              ${esc(u.name)} <span class="text-xs text-neutral-400">${esc(u.role || "")}</span>
            </label>`).join("")}
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" id="modalCancel" class="px-3 py-1.5 text-sm rounded-md text-neutral-600 hover:bg-neutral-100">Cancelar</button>
        <button type="submit" class="px-3 py-1.5 text-sm rounded-md bg-violet-700 text-white">Salvar</button>
      </div></form>`);
  document.getElementById("groupForm").onsubmit = e => {
    e.preventDefault();
    const name = document.getElementById("groupName").value.trim();
    if (!name) return;
    const memberIds = [...document.querySelectorAll(".group-member:checked")].map(c => c.value);
    const existing = document.getElementById("groupId").value;
    if (existing) {
      const idx = state.groups.findIndex(x => x.id === existing);
      if (idx >= 0) state.groups[idx] = { ...state.groups[idx], name, memberIds };
      audit("Grupo alterado: " + name);
    } else {
      state.groups.push({ id: uid("g"), name, memberIds });
      audit("Grupo criado: " + name);
    }
    save(); hideModal(); render();
  };
}

/* ——— Análises ——— */
function renderAnalises() {
  const all = state.instances;
  const abertos = all.filter(i => i.status === "Em andamento");
  const concluidos = all.filter(i => i.status === "Concluído");
  const cancelados = all.filter(i => i.status === "Cancelado");
  const atrasados = abertos.filter(i => instSla(i) === "atrasado");
  const byProc = {};
  all.forEach(i => {
    if (!byProc[i.processId]) byProc[i.processId] = { process: processById(i.processId), total: 0, open: 0, done: 0, late: 0 };
    byProc[i.processId].total++;
    if (i.status === "Em andamento") byProc[i.processId].open++;
    if (i.status === "Concluído") byProc[i.processId].done++;
    if (i.status === "Em andamento" && instSla(i) === "atrasado") byProc[i.processId].late++;
  });

  return `<div class="p-6 max-w-4xl">
    <h1 class="text-xl font-semibold mb-1">Análises</h1>
    <p class="text-sm text-neutral-500 mb-6">Volume, situação e atrasos (guia cap. 14)</p>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <div class="bg-white border border-neutral-200 rounded-lg p-4"><p class="text-xs text-neutral-500">Instâncias</p><p class="text-2xl font-semibold mt-1">${all.length}</p></div>
      <div class="bg-sky-50 border border-sky-100 rounded-lg p-4"><p class="text-xs text-sky-700">Em andamento</p><p class="text-2xl font-semibold mt-1 text-sky-900">${abertos.length}</p></div>
      <div class="bg-emerald-50 border border-emerald-100 rounded-lg p-4"><p class="text-xs text-emerald-700">Concluídas</p><p class="text-2xl font-semibold mt-1 text-emerald-900">${concluidos.length}</p></div>
      <div class="bg-red-50 border border-red-100 rounded-lg p-4"><p class="text-xs text-red-700">Atrasadas</p><p class="text-2xl font-semibold mt-1 text-red-900">${atrasados.length}</p></div>
    </div>
    <h2 class="text-sm font-semibold mb-3">Por processo</h2>
    <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead><tr class="bg-neutral-50 text-[11px] uppercase text-neutral-500 border-b">
          <th class="px-3 py-2 text-left">Processo</th><th class="px-3 py-2 text-right">Total</th><th class="px-3 py-2 text-right">Abertos</th><th class="px-3 py-2 text-right">Concluídos</th><th class="px-3 py-2 text-right">Atrasados</th>
        </tr></thead>
        <tbody>${Object.values(byProc).map(g => `
          <tr class="border-b border-neutral-100">
            <td class="px-3 py-2">${esc((g.process && g.process.name) || "—")}</td>
            <td class="px-3 py-2 text-right tabular-nums">${g.total}</td>
            <td class="px-3 py-2 text-right tabular-nums">${g.open}</td>
            <td class="px-3 py-2 text-right tabular-nums">${g.done}</td>
            <td class="px-3 py-2 text-right tabular-nums ${g.late ? "text-red-600 font-medium" : ""}">${g.late}</td>
          </tr>`).join("") || '<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-400">Sem dados</td></tr>'}
        </tbody>
      </table>
    </div>
    ${atrasados.length ? `<h2 class="text-sm font-semibold mt-8 mb-3">Painel de atrasos</h2>
      <div class="space-y-2">${atrasados.map(cardInst).join("")}</div>` : ""}
  </div>`;
}

function renderAuditoria() {
  const logs = state.audit || [];
  return `<div class="p-6 max-w-3xl">
    <h1 class="text-xl font-semibold mb-1">Auditoria</h1>
    <p class="text-sm text-neutral-500 mb-6">Trilha de alterações e ações (Studio + execução)</p>
    <div class="space-y-2">${logs.length ? logs.map(l => `
      <div class="bg-white border border-neutral-200 rounded-lg px-4 py-2.5 text-sm">
        <p class="text-[11px] text-neutral-400">${fmt(l.at)} · ${esc((userById(l.userId) || {}).name || "sistema")}</p>
        <p class="mt-0.5">${esc(l.text)}</p>
      </div>`).join("") : '<p class="text-sm text-neutral-400 py-8 text-center">Sem eventos ainda</p>'}
    </div>
  </div>`;
}

/* ——— Runtime instance ——— */
function startProcess(processId) {
  const proc = processById(processId);
  if (!proc) return;
  const first = proc.steps.find(s => s.type !== "end") || proc.steps[0];
  const inst = {
    id: uid("i"), processId: proc.id, stepId: first.id, status: "Em andamento",
    createdById: state.currentUserId, createdAt: new Date().toISOString(),
    ciclo: 1, data: {}, history: [{ at: new Date().toISOString(), text: "Instância aberta por " + me().name }]
  };
  state.instances.unshift(inst);
  audit("Instância #" + codeOf(inst) + " iniciada — " + proc.name, { instanceId: inst.id });
  save(); openInstId = inst.id; render();
}

function renderInstance() {
  const inst = state.instances.find(i => i.id === openInstId);
  if (!inst) return '<div class="p-6">Instância não encontrada</div>';
  const proc = processById(inst.processId);
  if (!proc) return '<div class="p-6">Processo removido</div>';
  const step = proc.steps.find(s => s.id === inst.stepId);
  const stepIdx = proc.steps.findIndex(s => s.id === inst.stepId);
  const canAct = userCanAct(inst);
  const assignees = step ? stepAssigneeIds(step, inst).map(id => (userById(id) || {}).name).filter(Boolean) : [];

  const stepsHtml = proc.steps.map((s, idx) => {
    let cls = "step-todo";
    if (idx < stepIdx || inst.status === "Concluído" || inst.status === "Cancelado") cls = "step-done";
    if (s.id === inst.stepId && inst.status === "Em andamento") cls = "step-active";
    return `<div class="flex items-center gap-1.5 text-xs text-neutral-500">
      <span class="step-dot ${cls}"></span>
      <span class="${s.id === inst.stepId ? "font-medium text-neutral-800" : ""}">${esc(s.name)}</span>
      ${idx < proc.steps.length - 1 ? '<span class="text-neutral-300 mx-1">→</span>' : ""}
    </div>`;
  }).join("");

  let body = "";
  if (step && step.type === "form" && canAct) {
    body = renderForm(proc, inst, true);
  } else if (step && step.type === "approve" && canAct) {
    const actions = step.actions || ["aprovar", "devolver", "rejeitar"];
    body = `<div class="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div class="bg-violet-700 text-white text-center font-semibold py-3 text-sm">APROVAÇÃO · ciclo ${inst.ciclo || 1}</div>
      <div class="p-5 space-y-4">
        <p class="text-sm text-neutral-600">Atribuído a: <strong>${esc(assignees.join(", ") || me().name)}</strong></p>
        ${readonlyForm(proc, inst)}
        <div class="flex flex-wrap justify-end gap-2">
          ${actions.includes("devolver") ? '<button data-action="devolver" class="border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-medium px-4 py-2 rounded-md">Devolver</button>' : ""}
          ${actions.includes("rejeitar") ? '<button data-action="rejeitar" class="border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-md">Rejeitar</button>' : ""}
          ${actions.includes("aprovar") ? '<button data-action="aprovar" class="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-md">Aprovar</button>' : ""}
        </div>
      </div>
    </div>`;
  } else if (step && step.type === "end" || inst.status === "Concluído") {
    body = `<div class="bg-white border border-neutral-200 rounded-xl p-6 text-center">
      <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3"><i class="fas fa-check"></i></div>
      <p class="font-semibold">Processo concluído</p>
      <p class="text-xs text-neutral-400 mt-1">Ciclo ${inst.ciclo || 1}</p>
    </div><div class="mt-4">${readonlyForm(proc, inst)}</div>`;
  } else if (inst.status === "Cancelado") {
    body = `<div class="bg-white border border-neutral-200 rounded-xl p-6 text-center">
      <p class="font-semibold text-red-600">Processo cancelado</p>
    </div><div class="mt-4">${readonlyForm(proc, inst)}</div>`;
  } else {
    body = `<div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm mb-4">
      Aguardando <strong>${esc(assignees.join(", ") || "outro responsável")}</strong> em “${esc(step ? step.name : "")}”.
      <br/><span class="text-xs text-neutral-500">Troque o usuário no topo para simular outro perfil.</span>
    </div>${readonlyForm(proc, inst)}`;
  }

  const hist = (inst.history || []).slice().reverse().map(h => `
    <div class="flex gap-2 text-sm"><div class="w-1 rounded-full bg-neutral-200 shrink-0"></div>
    <div><p class="text-[11px] text-neutral-400">${fmt(h.at)}</p><p>${esc(h.text)}</p></div></div>`).join("");

  return `<div>
    <div class="bg-white border-b border-neutral-200 px-6 py-3">
      <button id="btnBackInst" class="text-sm text-neutral-500 hover:text-neutral-800 mb-2"><i class="fas fa-arrow-left mr-1"></i> Voltar</button>
      <h1 class="font-semibold">#${codeOf(inst)} · ${esc(inst.data.TX_TITULO || inst.data.titulo || proc.name)}</h1>
      <p class="text-xs text-neutral-500 mt-0.5">${esc(proc.name)} v${proc.version || 1} · Aberto por ${esc((userById(inst.createdById) || {}).name || "")} · ${fmt(inst.createdAt)} · ciclo ${inst.ciclo || 1}</p>
      <div class="flex flex-wrap items-center gap-2 mt-3">${stepsHtml}</div>
    </div>
    <div class="p-6 max-w-2xl mx-auto space-y-6">${body}
      <div><p class="text-xs font-semibold text-neutral-500 mb-2">Histórico / evidência</p><div class="space-y-2">${hist}</div></div>
    </div>
  </div>`;
}

function renderForm(proc, inst, editable) {
  const sections = [...new Set(proc.form.map(f => f.section || "Geral"))];
  return `<div class="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
    <div class="bg-violet-700 text-white text-center font-semibold py-3 text-sm tracking-wide">${esc(proc.name).toUpperCase()}</div>
    <div class="p-5 space-y-5">
      <p class="text-xs text-red-500">(*) Campos de preenchimento obrigatório</p>
      ${sections.map(sec => `
        <div>
          <div class="bg-violet-100 text-violet-900 text-xs font-semibold px-3 py-1.5 rounded-t-md">${esc(sec)}</div>
          <div class="border border-t-0 border-neutral-200 rounded-b-md p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${proc.form.filter(f => (f.section || "Geral") === sec).map(f => fieldInput(f, inst.data[f.id])).join("")}
          </div>
        </div>`).join("")}
      ${editable ? `<div class="flex justify-end"><button id="btnSubmitForm" class="bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium px-4 py-2 rounded-md">Enviar</button></div>` : ""}
    </div>
  </div>`;
}

function fieldInput(f, val) {
  const req = f.required ? ' <span class="text-red-500">*</span>' : "";
  const full = f.type === "textarea" ? "sm:col-span-2" : "";
  let input;
  if (f.type === "textarea") input = `<textarea id="f_${f.id}" rows="3" class="w-full px-3 py-2 text-sm rounded-md border border-neutral-200">${esc(val || "")}</textarea>`;
  else if (f.type === "select") input = `<select id="f_${f.id}" class="w-full px-3 py-2 text-sm rounded-md border border-neutral-200">
    <option value="">Selecione</option>${(f.options || []).map(o => `<option value="${esc(o)}" ${val === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  else input = `<input type="${f.type}" id="f_${f.id}" value="${esc(val || "")}" class="w-full px-3 py-2 text-sm rounded-md border border-neutral-200"/>`;
  return `<div class="${full}"><label class="block text-xs font-medium text-neutral-600 mb-1">${esc(f.label)}${req} <span class="text-neutral-300 font-mono text-[10px]">${esc(f.id)}</span></label>${input}</div>`;
}

function readonlyForm(proc, inst) {
  const sections = [...new Set(proc.form.map(f => f.section || "Geral"))];
  return `<div class="bg-white border border-neutral-200 rounded-xl overflow-hidden">
    ${sections.map(sec => `
      <div class="bg-neutral-100 text-xs font-semibold px-3 py-1.5">${esc(sec)}</div>
      <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-b border-neutral-100">
        ${proc.form.filter(f => (f.section || "Geral") === sec).map(f => `
          <div class="${f.type === "textarea" ? "sm:col-span-2" : ""}">
            <p class="text-[11px] text-neutral-400">${esc(f.label)}</p>
            <p class="font-medium whitespace-pre-wrap">${esc(String(inst.data[f.id] ?? "—"))}</p>
          </div>`).join("")}
      </div>`).join("")}
  </div>`;
}

function advanceInstance(inst, proc) {
  const idx = proc.steps.findIndex(s => s.id === inst.stepId);
  const next = proc.steps[idx + 1];
  if (!next || next.type === "end") {
    inst.stepId = (next && next.id) || inst.stepId;
    inst.status = "Concluído";
    inst.history.push({ at: new Date().toISOString(), text: "Concluído" });
    audit("Instância #" + codeOf(inst) + " concluída");
  } else {
    inst.stepId = next.id;
    const who = stepAssigneeIds(next, inst).map(id => (userById(id) || {}).name).filter(Boolean).join(", ");
    inst.history.push({ at: new Date().toISOString(), text: `Avançou para “${next.name}”` + (who ? " → " + who : "") });
  }
  save(); render();
}

function bindInstance() {
  const back = document.getElementById("btnBackInst");
  if (back) back.onclick = () => { openInstId = null; render(); };

  const submit = document.getElementById("btnSubmitForm");
  if (submit) submit.onclick = () => {
    const inst = state.instances.find(i => i.id === openInstId);
    const proc = processById(inst.processId);
    let ok = true;
    proc.form.forEach(f => {
      const el = document.getElementById("f_" + f.id); if (!el) return;
      const v = el.value;
      if (f.required && !String(v || "").trim()) { ok = false; el.classList.add("ring-2", "ring-red-400"); }
      else el.classList.remove("ring-2", "ring-red-400");
      inst.data[f.id] = v;
    });
    if (!ok) { alert("Preencha os campos obrigatórios"); return; }
    inst.history.push({ at: new Date().toISOString(), text: "Formulário enviado por " + me().name + " (ação: enviar)" });
    audit("Ação enviar · #" + codeOf(inst));
    advanceInstance(inst, proc);
  };

  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.action;
      const inst = state.instances.find(i => i.id === openInstId);
      const proc = processById(inst.processId);
      if (action === "aprovar") {
        inst.history.push({ at: new Date().toISOString(), text: "Aprovado por " + me().name });
        audit("Ação aprovar · #" + codeOf(inst));
        advanceInstance(inst, proc);
      } else if (action === "devolver") {
        const motivo = prompt("Motivo da devolução:") || "Sem motivo";
        const formStep = proc.steps.find(s => s.type === "form");
        inst.stepId = formStep ? formStep.id : proc.steps[0].id;
        inst.ciclo = (inst.ciclo || 1) + 1;
        inst.history.push({ at: new Date().toISOString(), text: "Devolvido por " + me().name + " (ciclo " + inst.ciclo + "): " + motivo });
        audit("Ação devolver · #" + codeOf(inst));
        save(); render();
      } else if (action === "rejeitar") {
        const motivo = prompt("Motivo da rejeição:") || "Sem motivo";
        inst.status = "Cancelado";
        inst.history.push({ at: new Date().toISOString(), text: "Rejeitado/cancelado por " + me().name + ": " + motivo });
        audit("Ação rejeitar · #" + codeOf(inst));
        save(); render();
      }
    };
  });
}

function bindMain() {
  document.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { openInstId = b.dataset.open; render(); });
  document.querySelectorAll("[data-goto-caixa]").forEach(b => b.onclick = () => setView("caixa"));
  document.querySelectorAll("[data-start]").forEach(b => b.onclick = () => startProcess(b.dataset.start));
  const nu = document.getElementById("btnNewUser");
  if (nu) nu.onclick = () => openUserModal(null);
  document.querySelectorAll("[data-edit-user]").forEach(b => b.onclick = () => openUserModal(b.dataset.editUser));
  document.querySelectorAll("[data-del-user]").forEach(b => b.onclick = () => {
    if (state.users.length <= 1) { alert("Precisa de pelo menos uma pessoa"); return; }
    if (!confirm("Excluir?")) return;
    const name = (userById(b.dataset.delUser) || {}).name;
    state.users = state.users.filter(u => u.id !== b.dataset.delUser);
    if (state.currentUserId === b.dataset.delUser) state.currentUserId = state.users[0].id;
    audit("Usuário excluído: " + name);
    save(); render();
  });
  const ng = document.getElementById("btnNewGroup");
  if (ng) ng.onclick = () => openGroupModal(null);
  document.querySelectorAll("[data-edit-group]").forEach(b => b.onclick = () => openGroupModal(b.dataset.editGroup));
  document.querySelectorAll("[data-del-group]").forEach(b => b.onclick = () => {
    if (!confirm("Excluir grupo?")) return;
    const name = (groupById(b.dataset.delGroup) || {}).name;
    state.groups = state.groups.filter(g => g.id !== b.dataset.delGroup);
    audit("Grupo excluído: " + name);
    save(); render();
  });
  const np = document.getElementById("btnNewProcess");
  if (np) np.onclick = () => { editProcessId = "new"; render(); };
  document.querySelectorAll("[data-edit-proc]").forEach(b => b.onclick = () => { editProcessId = b.dataset.editProc; render(); });
}

function showModal(title, bodyHtml) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modal").classList.remove("hidden");
  const c = document.getElementById("modalCancel");
  if (c) c.onclick = hideModal;
}
function hideModal() { document.getElementById("modal").classList.add("hidden"); }
document.getElementById("modalClose").onclick = hideModal;
document.getElementById("modalBg").onclick = hideModal;
document.querySelectorAll(".nav").forEach(b => b.onclick = () => setView(b.dataset.view));
document.getElementById("currentUser").onchange = e => {
  state.currentUserId = e.target.value; save(); openInstId = null; render();
};
document.getElementById("globalSearch").oninput = () => {
  if (view === "caixa" || view === "alerta" || view === "atraso") render();
};

render();
