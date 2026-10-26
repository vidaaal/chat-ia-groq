const L = window.LECOM;
document.getElementById("topbar").innerHTML = L.topBar("Workspace");
L.bindTopBar("workspace");

let view = "inbox";
let openInstId = null;
let filterQ = { text: "", processId: "" };

try { L.escalateOverdue(); } catch (_) {}

function setView(v) { view = v; openInstId = null; render(); }

function fieldMode(field, stepId) {
  if (!field.vis || !stepId) return "normal";
  const m = field.vis[stepId];
  return (m === "oculto" || m === "normal" || m === "leitura") ? m : "oculto";
}

function applyInitValues(proc, inst, step) {
  if (!step) return;
  (proc.form || []).forEach(f => {
    if (fieldMode(f, step.id) === "oculto") return;
    const init = (f.init || {})[step.id];
    const val = (f.initVal || {})[step.id];
    if (init === "fixed" && val != null && val !== "" && (inst.data[f.id] == null || inst.data[f.id] === "")) {
      inst.data[f.id] = val;
    }
  });
}

function runStepScript(inst, proc, step) {
  if (!step || !step.script || !String(step.script).trim()) return { ok: true };
  try {
    const fn = new Function("form", "instance", "step", "user", "getField", "setField", "log", step.script);
    fn(inst.data, inst, step, L.me(), (id) => inst.data[id], (id, v) => { inst.data[id] = v; }, (m) => {
      inst.history.push({ at: new Date().toISOString(), text: "[script] " + m });
    });
    return { ok: true };
  } catch (err) {
    inst.history.push({ at: new Date().toISOString(), text: "[script ERRO] " + err.message });
    return { ok: false, error: err.message };
  }
}

function userCanAct(inst) {
  if (inst.status !== "Em andamento") return false;
  const proc = L.processById(inst.processId);
  if (!proc) return false;
  const step = proc.steps.find(s => s.id === inst.stepId);
  if (!step || step.type === "end") return false;
  const ids = L.actingAsIds(L.state.currentUserId);
  return L.stepAssigneeIds(step, inst).some(a => ids.includes(a));
}

function slaPill(inst) {
  const s = L.instSla(inst);
  if (s === "atrasado") return '<span class="lc-pill red">Atrasado</span>';
  if (s === "alerta") return '<span class="lc-pill amber">Alerta SLA</span>';
  if (inst.escalated) return '<span class="lc-pill red">Escalonado</span>';
  return '<span class="lc-pill green">No prazo</span>';
}

function cardInst(i) {
  const proc = L.processById(i.processId);
  const step = proc && proc.steps.find(s => s.id === i.stepId);
  const title = i.data.TX_TITULO || i.data.titulo || (proc && proc.name) || "Solicitação";
  const stepName = step ? step.name : i.status;
  return `<button type="button" data-open="${i.id}" class="lc-row">
    <div class="flex justify-between gap-2 items-start">
      <span class="t truncate">${L.esc(title)}</span>
      <span class="lc-pill violet shrink-0">${L.esc(stepName)}</span>
    </div>
    <div class="m flex flex-wrap gap-2 items-center">
      <span>#${L.codeOf(i)}</span>
      <span>·</span>
      <span>${L.esc(proc ? proc.name : "")}</span>
      <span>·</span>
      <span>${L.esc((L.userById(i.createdById) || {}).name || "")}</span>
      ${slaPill(i)}
      ${(i.comments || []).length ? `<span class="lc-pill"><i class="fas fa-comment text-[10px]"></i> ${i.comments.length}</span>` : ""}
    </div>
  </button>`;
}

function render() {
  document.querySelectorAll(".lc-nav").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  const n = L.inboxFor(L.state.currentUserId).length;
  const badge = document.getElementById("badgeInbox");
  if (n) { badge.textContent = n; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");

  const main = document.getElementById("main");
  if (openInstId) { main.innerHTML = renderInstance(); bindInstance(); return; }
  if (view === "inbox") main.innerHTML = renderDashboard();
  else if (view === "caixa" || view === "alerta" || view === "atraso") main.innerHTML = renderCaixa(view);
  else if (view === "abrir") main.innerHTML = renderCatalog();
  else if (view === "mine") main.innerHTML = renderMine();
  else if (view === "delegar") main.innerHTML = renderDelegacao();
  bindMain();
}

function renderDashboard() {
  const items = L.inboxFor(L.state.currentUserId);
  const atr = items.filter(i => L.instSla(i) === "atrasado").length;
  const al = items.filter(i => L.instSla(i) === "alerta").length;
  const esc = items.filter(i => i.escalated).length;
  return `
  <div class="lc-page-title">
    <div>
      <h1>Minhas atividades</h1>
      <p>Fila de ${L.esc(L.me().name)} · inclui delegações ativas</p>
    </div>
  </div>
  <div class="lc-kpis">
    <div class="lc-kpi"><div class="l">Pendentes</div><div class="v">${items.length}</div></div>
    <div class="lc-kpi ok"><div class="l">No prazo</div><div class="v">${items.length - atr - al}</div></div>
    <div class="lc-kpi warn"><div class="l">Em alerta</div><div class="v">${al}</div></div>
    <div class="lc-kpi danger"><div class="l">Atrasados / escalonados</div><div class="v">${atr}${esc ? " · " + esc + " esc." : ""}</div></div>
  </div>
  <div class="lc-card">
    <div class="lc-card-hd">Aguardando você</div>
    <div class="lc-card-bd">
      ${items.length ? items.map(cardInst).join("") : `<div class="lc-empty"><i class="fas fa-check-circle"></i>Nada na fila. Abra um serviço no catálogo.</div>`}
    </div>
  </div>`;
}

function applyListFilter(items) {
  let list = items.slice();
  if (filterQ.text) {
    const q = filterQ.text.toLowerCase();
    list = list.filter(i => {
      const proc = L.processById(i.processId);
      const t = (i.data.TX_TITULO || "") + " " + (proc ? proc.name : "") + " " + L.codeOf(i);
      return t.toLowerCase().includes(q);
    });
  }
  if (filterQ.processId) list = list.filter(i => i.processId === filterQ.processId);
  return list;
}

function filterBar() {
  const procs = L.state.processes.filter(p => p.published);
  const mine = (L.state.savedFilters || []).filter(f => f.userId === L.state.currentUserId);
  return `<div class="lc-card mb-4"><div class="lc-card-bd flex flex-wrap gap-2 items-end">
    <div class="flex-1 min-w-[160px]">
      <label class="lc-label">Busca</label>
      <input class="lc-input" id="fText" value="${L.esc(filterQ.text)}" placeholder="Protocolo, título..."/>
    </div>
    <div class="w-48">
      <label class="lc-label">Processo</label>
      <select class="lc-select" id="fProc">
        <option value="">Todos</option>
        ${procs.map(p => `<option value="${p.id}" ${filterQ.processId === p.id ? "selected" : ""}>${L.esc(p.name)}</option>`).join("")}
      </select>
    </div>
    <button type="button" class="lc-btn" id="btnApplyFilter"><i class="fas fa-filter"></i> Filtrar</button>
    <button type="button" class="lc-btn" id="btnSaveFilter"><i class="fas fa-bookmark"></i> Salvar filtro</button>
  </div>
  ${mine.length ? `<div class="px-4 pb-3 flex flex-wrap gap-2">${mine.map(f =>
    `<button type="button" class="lc-btn sm" data-load-filter="${f.id}"><i class="fas fa-bookmark text-violet-600"></i> ${L.esc(f.name)}
      <span data-del-filter="${f.id}" class="text-red-400 ml-1">×</span></button>`
  ).join("")}</div>` : ""}
  </div>`;
}

function renderCaixa(mode) {
  let items = L.inboxFor(L.state.currentUserId);
  const title = mode === "alerta" ? "Em alerta" : mode === "atraso" ? "Em atraso" : "Caixa de entrada";
  if (mode === "alerta") items = items.filter(i => L.instSla(i) === "alerta");
  if (mode === "atraso") items = items.filter(i => L.instSla(i) === "atrasado" || i.escalated);
  items = applyListFilter(items);
  return `
  <div class="lc-page-title"><div><h1>${title}</h1><p>${items.length} solicitação(ões)</p></div></div>
  ${filterBar()}
  <div class="space-y-1">${items.length ? items.map(cardInst).join("") : `<div class="lc-empty"><i class="fas fa-inbox"></i>Vazio</div>`}</div>`;
}

function renderMine() {
  const items = L.state.instances.filter(i => i.createdById === L.state.currentUserId);
  return `
  <div class="lc-page-title"><div><h1>Abertos por mim</h1><p>Solicitações que você iniciou</p></div></div>
  <div class="space-y-1">${items.length ? items.map(cardInst).join("") : `<div class="lc-empty">Nenhuma</div>`}</div>`;
}

function renderCatalog() {
  const published = L.state.processes.filter(p => p.published);
  const catalog = L.SERVICE_CATALOG;
  return `
  <div class="lc-page-title">
    <div><h1>Catálogo de serviços</h1><p>Inicie um processo a partir de um modelo ou processo publicado</p></div>
  </div>
  <h2 class="text-sm font-semibold text-neutral-500 mb-3 uppercase tracking-wide">Modelos prontos</h2>
  <div class="lc-catalog mb-8">
    ${catalog.map(s => `
      <div class="lc-svc">
        <div class="ico"><i class="fas ${s.icon}"></i></div>
        <h3>${L.esc(s.name)}</h3>
        <p>${L.esc(s.desc)}</p>
        <div class="flex items-center justify-between mt-2">
          <span class="text-[11px] text-neutral-400">SLA: ${L.esc(s.sla)}</span>
          <button type="button" class="lc-btn primary sm" data-start-tpl="${s.template}"><i class="fas fa-play"></i> Iniciar</button>
        </div>
      </div>`).join("")}
  </div>
  <h2 class="text-sm font-semibold text-neutral-500 mb-3 uppercase tracking-wide">Processos publicados no Studio</h2>
  <div class="lc-catalog">
    ${published.length ? published.map(p => `
      <div class="lc-svc">
        <div class="ico" style="background:#ecfdf5;color:#059669"><i class="fas fa-diagram-project"></i></div>
        <h3>${L.esc(p.name)}</h3>
        <p>${L.esc(p.subtitle || p.category || "Processo customizado")} · v${p.version || 1}</p>
        <div class="flex justify-end mt-2">
          <button type="button" class="lc-btn primary sm" data-start-proc="${p.id}"><i class="fas fa-play"></i> Abrir</button>
        </div>
      </div>`).join("") : `<div class="lc-empty">Nenhum processo publicado. Crie no Studio ou use um modelo acima.</div>`}
  </div>`;
}

function renderDelegacao() {
  const list = (L.state.delegations || []).slice().reverse();
  const users = L.state.users.filter(u => u.active !== false && u.id !== L.state.currentUserId);
  return `
  <div class="lc-page-title">
    <div><h1>Delegação temporária</h1><p>Transfira sua fila para outra pessoa com período e auditoria</p></div>
  </div>
  <div class="lc-card mb-4">
    <div class="lc-card-hd">Nova delegação</div>
    <div class="lc-card-bd grid sm:grid-cols-2 gap-3">
      <div><label class="lc-label">De (você)</label>
        <input class="lc-input" disabled value="${L.esc(L.me().name)}"/></div>
      <div><label class="lc-label">Para</label>
        <select id="delTo" class="lc-select">${users.map(u => `<option value="${u.id}">${L.esc(u.name)}</option>`).join("")}</select></div>
      <div><label class="lc-label">Início</label><input type="date" id="delFrom" class="lc-input" value="${new Date().toISOString().slice(0,10)}"/></div>
      <div><label class="lc-label">Fim</label><input type="date" id="delToDate" class="lc-input"/></div>
      <div class="sm:col-span-2"><label class="lc-label">Observação</label><input id="delNote" class="lc-input" placeholder="Férias, ausência..."/></div>
      <div class="sm:col-span-2"><button type="button" id="btnDelSave" class="lc-btn primary"><i class="fas fa-user-clock"></i> Ativar delegação</button></div>
    </div>
  </div>
  <div class="lc-card">
    <div class="lc-card-hd">Histórico</div>
    <div class="lc-card-bd space-y-2">
      ${list.length ? list.map(d => {
        const from = L.userById(d.fromUserId);
        const to = L.userById(d.toUserId);
        return `<div class="flex flex-wrap items-center gap-2 text-sm border border-neutral-100 rounded-lg p-3">
          <span class="font-medium">${L.esc(from?.name)} → ${L.esc(to?.name)}</span>
          <span class="text-neutral-400 text-xs">${L.esc(d.from)} até ${L.esc(d.to)}</span>
          ${d.revoked ? '<span class="lc-pill red">Revogada</span>' : '<span class="lc-pill green">Ativa</span>'}
          ${!d.revoked ? `<button type="button" class="lc-btn sm ml-auto" data-revoke="${d.id}">Revogar</button>` : ""}
          ${d.note ? `<span class="w-full text-xs text-neutral-500">${L.esc(d.note)}</span>` : ""}
        </div>`;
      }).join("") : `<div class="lc-empty">Nenhuma delegação</div>`}
    </div>
  </div>`;
}

function renderInstance() {
  const inst = L.state.instances.find(i => i.id === openInstId);
  if (!inst) return `<div class="lc-empty">Instância não encontrada</div>`;
  const proc = L.processById(inst.processId);
  if (!proc) return `<div class="lc-empty">Processo removido</div>`;
  const step = proc.steps.find(s => s.id === inst.stepId);
  const can = userCanAct(inst);
  const stepsHtml = proc.steps.map((s, idx) => {
    const done = proc.steps.findIndex(x => x.id === inst.stepId) > idx || inst.status === "Concluído";
    const active = s.id === inst.stepId && inst.status === "Em andamento";
    const cls = active ? "step-active" : done ? "step-done" : "step-todo";
    return `<div class="flex items-center gap-2 text-xs ${active ? "font-semibold text-violet-700" : "text-neutral-400"}">
      <span class="step-dot ${cls}"></span>${L.esc(s.name)}</div>`;
  }).join('<span class="text-neutral-300 mx-1">›</span>');

  let body = "";
  if (can && step && step.type === "form") {
    body = renderForm(proc, inst, true);
  } else if (can && step && step.type === "approve") {
    const actions = step.actions || ["aprovar", "devolver", "rejeitar"];
    body = `<div class="lc-card"><div class="lc-card-bd space-y-4">
      ${readonlyForm(proc, inst)}
      <div class="flex flex-wrap justify-end gap-2">
        ${actions.includes("devolver") ? '<button data-action="devolver" class="lc-btn">Devolver</button>' : ""}
        ${actions.includes("rejeitar") ? '<button data-action="rejeitar" class="lc-btn danger">Rejeitar</button>' : ""}
        ${actions.includes("aprovar") ? '<button data-action="aprovar" class="lc-btn primary">Aprovar</button>' : ""}
      </div>
    </div></div>`;
  } else if (inst.status === "Concluído" || (step && step.type === "end")) {
    body = `<div class="lc-card"><div class="lc-card-bd text-center py-6">
      <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3"><i class="fas fa-check"></i></div>
      <p class="font-semibold">Processo concluído</p></div></div>
      <div class="mt-4">${readonlyForm(proc, inst)}</div>`;
  } else if (inst.status === "Cancelado") {
    body = `<div class="lc-card"><div class="lc-card-bd text-center text-red-600 font-semibold py-6">Cancelado</div></div>`;
  } else {
    const assignees = L.stepAssigneeIds(step, inst).map(id => (L.userById(id) || {}).name).filter(Boolean);
    body = `<div class="lc-card mb-4"><div class="lc-card-bd text-sm">
      Aguardando <strong>${L.esc(assignees.join(", ") || "responsável")}</strong> em “${L.esc(step ? step.name : "")}”.
      <span class="block text-xs text-neutral-400 mt-1">Troque o usuário no topo ou use delegação.</span>
    </div></div>${readonlyForm(proc, inst)}`;
  }

  const comments = (inst.comments || []).slice().reverse().map(c => {
    const u = L.userById(c.userId);
    return `<li><div class="when">${L.fmt(c.at)} · ${L.esc(u?.name || "")}</div>${L.esc(c.text)}</li>`;
  }).join("");

  const hist = (inst.history || []).slice().reverse().map(h =>
    `<li><div class="when">${L.fmt(h.at)}</div>${L.esc(h.text)}</li>`).join("");

  return `
  <button type="button" id="btnBackInst" class="lc-btn ghost sm mb-3"><i class="fas fa-arrow-left"></i> Voltar</button>
  <div class="lc-page-title">
    <div>
      <h1>#${L.codeOf(inst)} · ${L.esc(inst.data.TX_TITULO || inst.data.titulo || proc.name)}</h1>
      <p>${L.esc(proc.name)} v${proc.version || 1} · ${L.esc((L.userById(inst.createdById) || {}).name || "")} · ciclo ${inst.ciclo || 1} · ${slaPill(inst)}</p>
    </div>
  </div>
  <div class="flex flex-wrap gap-2 mb-5">${stepsHtml}</div>
  <div class="lc-split">
    <div class="space-y-4">${body}</div>
    <div class="space-y-4">
      <div class="lc-card">
        <div class="lc-card-hd"><i class="fas fa-comments text-violet-600"></i> Comentários</div>
        <div class="lc-card-bd">
          <ul class="lc-timeline mb-3">${comments || "<li class='text-neutral-400'>Nenhum comentário</li>"}</ul>
          <textarea id="commentText" class="lc-textarea" rows="2" placeholder="Escrever comentário..."></textarea>
          <button type="button" id="btnComment" class="lc-btn primary sm mt-2"><i class="fas fa-paper-plane"></i> Comentar</button>
        </div>
      </div>
      <div class="lc-card">
        <div class="lc-card-hd"><i class="fas fa-clock-rotate-left text-violet-600"></i> Histórico</div>
        <div class="lc-card-bd"><ul class="lc-timeline">${hist || "<li>—</li>"}</ul></div>
      </div>
    </div>
  </div>`;
}

function renderForm(proc, inst, editable) {
  const step = proc.steps.find(s => s.id === inst.stepId);
  applyInitValues(proc, inst, step);
  const stepId = step ? step.id : null;
  const visible = (proc.form || []).filter(f => fieldMode(f, stepId) !== "oculto");
  if (!visible.length) {
    return `<div class="lc-card"><div class="lc-card-bd text-sm text-neutral-500">Nenhum campo visível nesta etapa. Configure no Studio.</div></div>`;
  }
  return `<div class="lc-card overflow-hidden">
    <div class="bg-gradient-to-r from-violet-800 to-violet-600 text-white text-center font-semibold py-3 text-sm tracking-wide">${L.esc(proc.name).toUpperCase()}</div>
    <div class="lc-card-bd space-y-4">
      <p class="text-xs text-red-500">(*) obrigatórios · etapa “${L.esc(step ? step.name : "")}”</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${visible.map(f => fieldInput(f, inst.data[f.id], fieldMode(f, stepId), editable)).join("")}
      </div>
      ${editable ? `<div class="flex justify-end"><button type="button" id="btnSubmitForm" class="lc-btn primary">Enviar</button></div>` : ""}
    </div>
  </div>`;
}

function fieldInput(f, val, mode, editable) {
  const readOnly = !editable || mode === "leitura";
  const req = f.required && !readOnly ? ' <span class="text-red-500">*</span>' : "";
  const full = f.type === "textarea" ? "sm:col-span-2" : "";
  const ro = readOnly ? "disabled" : "";
  const v = val == null ? "" : String(val);
  let input = "";
  if (f.type === "textarea") {
    input = `<textarea data-field="${f.id}" class="lc-textarea" rows="3" ${ro}>${L.esc(v)}</textarea>`;
  } else if (f.type === "number") {
    input = `<input type="number" data-field="${f.id}" class="lc-input" value="${L.esc(v)}" ${ro}/>`;
  } else if (f.type === "date") {
    input = `<input type="date" data-field="${f.id}" class="lc-input" value="${L.esc(v)}" ${ro}/>`;
  } else {
    input = `<input type="text" data-field="${f.id}" class="lc-input" value="${L.esc(v)}" ${ro}/>`;
  }
  return `<div class="${full}"><label class="lc-label">${L.esc(f.label || f.id)}${req}</label>${input}</div>`;
}

function readonlyForm(proc, inst) { return renderForm(proc, inst, false); }

function collectFields(inst) {
  document.querySelectorAll("[data-field]").forEach(el => {
    if (el.disabled) return;
    inst.data[el.getAttribute("data-field")] = el.value;
  });
}

function advance(inst, action) {
  const proc = L.processById(inst.processId);
  const idx = proc.steps.findIndex(s => s.id === inst.stepId);
  const step = proc.steps[idx];
  collectFields(inst);
  runStepScript(inst, proc, step);

  if (action === "devolver") {
    const prev = proc.steps.slice(0, idx).reverse().find(s => s.type !== "end");
    if (prev) {
      inst.stepId = prev.id;
      inst.ciclo = (inst.ciclo || 1) + 1;
      inst.history.push({ at: new Date().toISOString(), text: `Devolvido por ${L.me().name} → ${prev.name}` });
    }
  } else if (action === "rejeitar") {
    inst.status = "Cancelado";
    inst.history.push({ at: new Date().toISOString(), text: `Rejeitado por ${L.me().name}` });
  } else {
    // segue edges do diagrama se existirem; senão ordem da lista
    let next = null;
    const outs = (proc.edges || []).filter(e => e.from === step.id);
    if (outs.length === 1) {
      next = proc.steps.find(s => s.id === outs[0].to);
    } else if (outs.length > 1) {
      // gateway: pega primeira saída (demo); label "não"/"nao" pula se action devolver already handled
      const preferred = outs.find(e => !/n[aã]o/i.test(e.label || "")) || outs[0];
      next = proc.steps.find(s => s.id === preferred.to);
    } else {
      next = proc.steps[idx + 1];
    }
    // pula gateways intermediários
    let guard = 0;
    while (next && next.type === "gateway" && guard++ < 10) {
      const gOut = (proc.edges || []).filter(e => e.from === next.id);
      const pick = gOut[0];
      next = pick ? proc.steps.find(s => s.id === pick.to) : null;
    }
    if (!next || next.type === "end") {
      inst.status = "Concluído";
      if (next) inst.stepId = next.id;
      inst.history.push({ at: new Date().toISOString(), text: `Concluído por ${L.me().name}` });
    } else {
      inst.stepId = next.id;
      inst.history.push({ at: new Date().toISOString(), text: `${action || "enviado"} por ${L.me().name} → ${next.name}` });
      runStepScript(inst, proc, next);
    }
  }
  L.save();
  L.toast("Ação registrada");
  render();
}

function startProcess(proc) {
  if (!proc || !proc.steps || !proc.steps.length) {
    L.toast("Processo sem etapas");
    return;
  }
  const startEvent = proc.steps.find(step => step.type === "start");
  const initialEdge = startEvent && (proc.edges || []).find(edge => edge.from === startEvent.id);
  let first = initialEdge ? proc.steps.find(step => step.id === initialEdge.to) : null;
  let guard = 0;
  while (first && first.type === "gateway" && guard++ < proc.steps.length) {
    const outgoing = (proc.edges || []).filter(edge => edge.from === first.id);
    const route = outgoing.find(edge => !/n[aã]o/i.test(edge.label || "")) || outgoing[0];
    first = route ? proc.steps.find(step => step.id === route.to) : null;
  }
  if (!first || ["start", "gateway", "end"].includes(first.type)) {
    first = proc.steps.find(step => !["start", "gateway", "end"].includes(step.type));
  }
  if (!first) {
    L.toast("Processo sem atividade de formulário para iniciar");
    return;
  }
  const inst = {
    id: L.uid("i"),
    processId: proc.id,
    stepId: first.id,
    status: "Em andamento",
    createdById: L.state.currentUserId,
    createdAt: new Date().toISOString(),
    ciclo: 1,
    data: {},
    history: [{ at: new Date().toISOString(), text: `Aberto por ${L.me().name}` }],
    comments: []
  };
  applyInitValues(proc, inst, first);
  runStepScript(inst, proc, first);
  L.state.instances.unshift(inst);
  L.audit("abertura", L.codeOf(inst) + " · " + proc.name);
  L.save();
  openInstId = inst.id;
  L.toast("Solicitação #" + L.codeOf(inst) + " criada");
  render();
}

function bindMain() {
  document.querySelectorAll("[data-view]").forEach(b => {
    b.onclick = () => setView(b.dataset.view);
  });
  document.querySelectorAll("[data-open]").forEach(b => {
    b.onclick = () => { openInstId = b.dataset.open; render(); };
  });
  document.querySelectorAll("[data-start-tpl]").forEach(b => {
    b.onclick = () => {
      const proc = L.ensureTemplateProcess(b.dataset.startTpl);
      if (proc) startProcess(proc);
    };
  });
  document.querySelectorAll("[data-start-proc]").forEach(b => {
    b.onclick = () => {
      const proc = L.processById(b.dataset.startProc);
      if (proc) startProcess(proc);
    };
  });
  const btnF = document.getElementById("btnApplyFilter");
  if (btnF) btnF.onclick = () => {
    filterQ.text = document.getElementById("fText").value.trim();
    filterQ.processId = document.getElementById("fProc").value;
    render();
  };
  const btnSF = document.getElementById("btnSaveFilter");
  if (btnSF) btnSF.onclick = () => {
    const name = prompt("Nome do filtro:");
    if (!name) return;
    filterQ.text = document.getElementById("fText")?.value.trim() || filterQ.text;
    filterQ.processId = document.getElementById("fProc")?.value || filterQ.processId;
    L.saveFilter(name, { ...filterQ });
    L.toast("Filtro salvo");
    render();
  };
  document.querySelectorAll("[data-load-filter]").forEach(b => {
    b.onclick = (e) => {
      if (e.target.closest("[data-del-filter]")) return;
      const f = (L.state.savedFilters || []).find(x => x.id === b.dataset.loadFilter);
      if (f) { filterQ = { ...f.query }; render(); }
    };
  });
  document.querySelectorAll("[data-del-filter]").forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); L.deleteFilter(b.dataset.delFilter); render(); };
  });
  const btnDel = document.getElementById("btnDelSave");
  if (btnDel) btnDel.onclick = () => {
    const to = document.getElementById("delTo").value;
    const toDate = document.getElementById("delToDate").value;
    if (!to || !toDate) { alert("Informe destinatário e data fim"); return; }
    L.createDelegation({
      toUserId: to,
      from: document.getElementById("delFrom").value,
      to: toDate,
      note: document.getElementById("delNote").value
    });
    L.toast("Delegação ativada");
    render();
  };
  document.querySelectorAll("[data-revoke]").forEach(b => {
    b.onclick = () => { L.revokeDelegation(b.dataset.revoke); L.toast("Revogada"); render(); };
  });
}

function bindInstance() {
  document.getElementById("btnBackInst").onclick = () => { openInstId = null; render(); };
  const sub = document.getElementById("btnSubmitForm");
  if (sub) sub.onclick = () => {
    const inst = L.state.instances.find(i => i.id === openInstId);
    const proc = L.processById(inst.processId);
    const step = proc.steps.find(s => s.id === inst.stepId);
    collectFields(inst);
    const missing = (proc.form || []).filter(f => {
      if (fieldMode(f, step.id) === "oculto" || fieldMode(f, step.id) === "leitura") return false;
      return f.required && !String(inst.data[f.id] || "").trim();
    });
    if (missing.length) { alert("Preencha: " + missing.map(f => f.label).join(", ")); return; }
    advance(inst, "enviar");
  };
  document.querySelectorAll("[data-action]").forEach(b => {
    b.onclick = () => {
      const inst = L.state.instances.find(i => i.id === openInstId);
      advance(inst, b.dataset.action);
    };
  });
  const btnC = document.getElementById("btnComment");
  if (btnC) btnC.onclick = () => {
    const t = document.getElementById("commentText").value;
    if (!t.trim()) return;
    L.addComment(openInstId, t);
    L.toast("Comentário adicionado");
    render();
  };
}

render();
window.addEventListener("lecom-ready", () => render());
