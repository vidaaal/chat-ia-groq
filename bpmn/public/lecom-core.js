
/* LECOM MVP shared core */
window.LECOM = (function () {
  const KEY = "mini_lecom_v3";
  const SEED = {
    users: [
      { id: "u1", name: "Rafael", email: "rafael@empresa.com", role: "Analista TI", dept: "TI", active: true },
      { id: "u2", name: "Tyago", email: "tyago@empresa.com", role: "Gestor", dept: "TI", active: true },
      { id: "u3", name: "Thyago", email: "thyago@empresa.com", role: "Analista", dept: "Controladoria", active: true },
      { id: "u4", name: "Eliezer", email: "eliezer@empresa.com", role: "Solicitante", dept: "Operações", active: true },
      { id: "u5", name: "Administrador", email: "admin@empresa.com", role: "Administrador", dept: "Administrativo", active: true }
    ],
    groups: [
      { id: "g1", name: "Aprovadores TI", memberIds: ["u2"] },
      { id: "g2", name: "Controladoria", memberIds: ["u3"] },
      { id: "g3", name: "Administrativo", memberIds: ["u5", "u1"] }
    ],
    processes: [],
    instances: [],
    audit: [],
    delegations: [],
    savedFilters: [],
    currentUserId: "u1",
    nextProcCode: 1
  };

  function loadLocal() {
    try {
      const r = localStorage.getItem(KEY);
      if (r) {
        const p = JSON.parse(r);
        if (p.users) return p;
      }
      for (const k of ["mini_lecom_v2", "mini_bpm_v1"]) {
        const o = localStorage.getItem(k);
        if (o) {
          const old = JSON.parse(o);
          return {
            ...SEED,
            users: old.users || SEED.users,
            groups: old.groups || SEED.groups,
            processes: (old.processes || []).map((pr, i) => ({
              code: String(i + 1).padStart(6, "0"),
              subtitle: "",
              category: "Geral",
              ownerId: "u5",
              tableName: "proc_" + (pr.id || i),
              situation: "normal",
              ...pr
            })),
            instances: old.instances || [],
            audit: old.audit || [],
            currentUserId: old.currentUserId || "u1",
            nextProcCode: (old.processes || []).length + 1
          };
        }
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(SEED));
  }

  let state = loadLocal();
  let apiReady = false;
  function normalizeState(s) {
    if (!s.delegations) s.delegations = [];
    if (!s.savedFilters) s.savedFilters = [];
    if (!s.audit) s.audit = [];
    (s.instances || []).forEach(i => {
      if (!i.comments) i.comments = [];
      if (!i.history) i.history = [];
      if (!i.data) i.data = {};
    });
    return s;
  }
  state = normalizeState(state);


  async function pullFromApi() {
    try {
      const res = await fetch("/api/db");
      if (!res.ok) return false;
      const data = await res.json();
      if (data && data.users) {
        state = data;
        localStorage.setItem(KEY, JSON.stringify(state));
        apiReady = true;
        return true;
      }
    } catch (e) { /* offline: localStorage */ }
    return false;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    if (apiReady || typeof fetch !== "undefined") {
      fetch("/api/db", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      }).then((r) => { if (r.ok) apiReady = true; }).catch(() => {});
    }
  }

  // boot: tenta API Node; se falhar, usa localStorage
  pullFromApi().then((ok) => {
    if (ok && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lecom-ready", { detail: { source: "api" } }));
    }
  });
  function uid(p) { return (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function userById(id) { return state.users.find(u => u.id === id); }
  function groupById(id) { return (state.groups || []).find(g => g.id === id); }
  function processById(id) { return state.processes.find(p => p.id === id); }
  function me() { return userById(state.currentUserId) || state.users[0]; }
  function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function fmt(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return iso; }
  }
  function audit(text, extra) {
    state.audit = state.audit || [];
    state.audit.unshift({ at: new Date().toISOString(), userId: state.currentUserId, text, ...(extra || {}) });
    if (state.audit.length > 300) state.audit.length = 300;
  }
  function nextCode() {
    const n = state.nextProcCode || (state.processes.length + 1);
    state.nextProcCode = n + 1;
    return String(n).padStart(6, "0");
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

  function inboxFor(userId) {
    const ids = typeof actingAsIds === "function" ? actingAsIds(userId) : [userId];
    return state.instances.filter(i => {
      if (i.status === "Concluído" || i.status === "Cancelado") return false;
      const proc = processById(i.processId);
      if (!proc) return false;
      const step = proc.steps.find(s => s.id === i.stepId);
      if (!step || step.type === "end") return false;
      const assignees = stepAssigneeIds(step, i);
      return assignees.some(a => ids.includes(a));
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

  function newProcessTemplate() {
    return {
      id: uid("p"),
      code: nextCode(),
      lanes: [],
      edges: [],
      name: "",
      subtitle: "",
      description: "",
      helpText: "",
      version: 1,
      active: true,
      published: false,
      situation: "test",
      category: "Geral",
      ownerId: state.currentUserId,
      tableName: "",
      deptOpen: "Administrativo",
      steps: [
        { id: uid("s"), name: "Solicitar", ref: "SOLICITAR", type: "form", assigneeType: "starter", actions: ["enviar"], description: "", prazoAlerta: "", prazoMax: "", script: "", x: 80, y: 40 },
        { id: uid("s"), name: "Aprovar", ref: "APROVAR", type: "approve", assigneeType: "group", assigneeId: (state.groups[0] || {}).id || "", actions: ["aprovar", "devolver", "rejeitar"], description: "", prazoAlerta: "", prazoMax: "", script: "", x: 280, y: 40 },
        { id: uid("s"), name: "Fim", ref: "FIM", type: "end", assigneeType: null, actions: [], description: "", script: "", x: 480, y: 40 }
      ],
      form: [
        { id: "TX_TITULO", label: "Título", type: "text", required: true, section: "Dados gerais", active: true },
        { id: "TX_DESCRICAO", label: "Descrição", type: "textarea", required: true, section: "Dados gerais", active: true }
      ],
      statusIcon: "draft"
    };
  }

  // Module nav HTML
  function moduleMenu(current) {
    const items = [
      { id: "workspace", href: "workspace.html", icon: "fa-th-list", title: "Workspace", sub: "Abra e gerencie atividades" },
      { id: "analises", href: "analises.html", icon: "fa-chart-bar", title: "Análises", sub: "Analise graficamente seus dados" },
      { id: "documentos", href: "documentos.html", icon: "fa-folder", title: "Documentos", sub: "Acesse arquivos e pastas" },
      { id: "studio", href: "studio.html", icon: "fa-th", title: "Studio", sub: "Crie e edite os seus processos" },
      { id: "admin", href: "admin.html", icon: "fa-user", title: "Admin", sub: "Administre sua equipe" },
      { id: "login", href: "login.html", icon: "fa-key", title: "Login", sub: "Configure seus acessos" },
      { id: "cadastros", href: "cadastros.html", icon: "fa-book", title: "Cadastros", sub: "Crie e utilize cadastros auxiliares" },
      { id: "rpa", href: "rpa.html", icon: "fa-robot", title: "RPA", sub: "Automatize tarefas" }
    ];
    return items.map(it => `
      <a href="${it.href}" class="${current === it.id ? "on" : ""}">
        <span class="ico"><i class="fas ${it.icon}"></i></span>
        <span><span class="t">${it.title}</span><span class="s">${it.sub}</span></span>
      </a>`).join("");
  }

  function topBar(moduleName) {
    return `
    <header class="lc-top">
      <button type="button" id="btnModules" class="brand"><i class="fas fa-layer-group"></i> Mini LECOM</button>
      <span class="mod-label">${moduleName || ""}</span>
      <div class="lc-search-wrap">
        <i class="fas fa-search"></i>
        <input type="search" id="globalSearch" class="lc-search" placeholder="Buscar protocolo, processo..."/>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <select id="currentUser" class="lc-user-select"></select>
        <button type="button" id="btnDarkMode" class="lc-icon-btn" title="Modo escuro"><i class="fas fa-moon"></i></button>
        <button type="button" id="btnModuleMenu" class="lc-icon-btn" title="Módulos"><i class="fas fa-th"></i></button>
      </div>
      <div id="moduleDropdown" class="lc-dd hidden">
        ${moduleMenu("")}
        <div style="border-top:1px solid #eee;margin-top:6px;padding-top:6px">
          <a href="index.html"><span class="ico" style="background:#334155"><i class="fas fa-check-double"></i></span>
            <span><span class="t">Controle pessoal</span><span class="s">Kanban e calendário</span></span></a>
        </div>
      </div>
    </header>`;
  }

  function bindTopBar(currentModule) {
    try {
      if (localStorage.getItem("mini_lecom_dark") === "1") document.documentElement.classList.add("dark");
    } catch (_) {}
    const darkBtn = document.getElementById("btnDarkMode");
    if (darkBtn) {
      const syncIcon = () => {
        const on = document.documentElement.classList.contains("dark");
        darkBtn.innerHTML = on ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
      };
      syncIcon();
      darkBtn.onclick = () => {
        document.documentElement.classList.toggle("dark");
        const on = document.documentElement.classList.contains("dark");
        try { localStorage.setItem("mini_lecom_dark", on ? "1" : "0"); } catch (_) {}
        syncIcon();
      };
    }
    const sel = document.getElementById("currentUser");
    if (sel) {
      sel.innerHTML = state.users.filter(u => u.active !== false).map(u =>
        `<option value="${u.id}" ${u.id === state.currentUserId ? "selected" : ""}>${esc(u.name)}</option>`
      ).join("");
      sel.onchange = e => { state.currentUserId = e.target.value; save(); location.reload(); };
    }
    const btn = document.getElementById("btnModuleMenu") || document.getElementById("btnModules");
    const dd = document.getElementById("moduleDropdown");
    if (btn && dd) {
      // highlight current
      dd.querySelectorAll("a").forEach(a => {
        if (a.getAttribute("href") && a.getAttribute("href").includes(currentModule)) {
          a.classList.add("bg-violet-50");
        }
      });
      btn.onclick = e => { e.stopPropagation(); dd.classList.toggle("hidden"); };
      document.addEventListener("click", () => dd.classList.add("hidden"));
      dd.onclick = e => e.stopPropagation();
    }
  }


  function toast(msg) {
    const el = document.createElement("div");
    el.className = "lc-toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function activeDelegationsFor(userId, at) {
    const t = at ? new Date(at).getTime() : Date.now();
    return (state.delegations || []).filter(d => {
      if (d.revoked) return false;
      if (d.toUserId !== userId && d.fromUserId !== userId) return false;
      const a = new Date(d.from).getTime();
      const b = new Date(d.to).getTime();
      return t >= a && t <= b;
    });
  }

  /** Usuários cujas filas o userId atual pode atender (ele + quem delegou para ele) */
  function actingAsIds(userId) {
    const ids = new Set([userId]);
    const now = Date.now();
    (state.delegations || []).forEach(d => {
      if (d.revoked) return;
      if (d.toUserId !== userId) return;
      const a = new Date(d.from).getTime();
      const b = new Date(d.to).getTime();
      if (now >= a && now <= b) ids.add(d.fromUserId);
    });
    return [...ids];
  }

  function createDelegation({ fromUserId, toUserId, from, to, scope, note }) {
    const d = {
      id: uid("del"),
      fromUserId: fromUserId || state.currentUserId,
      toUserId,
      from: from || new Date().toISOString().slice(0, 10),
      to,
      scope: scope || "all",
      note: note || "",
      createdAt: new Date().toISOString(),
      revoked: false
    };
    state.delegations = state.delegations || [];
    state.delegations.push(d);
    audit("delegação", `${userById(d.fromUserId)?.name} → ${userById(d.toUserId)?.name} até ${d.to}`);
    save();
    return d;
  }

  function revokeDelegation(id) {
    const d = (state.delegations || []).find(x => x.id === id);
    if (!d) return;
    d.revoked = true;
    d.revokedAt = new Date().toISOString();
    audit("delegação revogada", d.id);
    save();
  }

  function addComment(instId, text) {
    const inst = state.instances.find(i => i.id === instId);
    if (!inst || !String(text || "").trim()) return null;
    if (!inst.comments) inst.comments = [];
    const c = {
      id: uid("c"),
      text: String(text).trim().slice(0, 4000),
      userId: state.currentUserId,
      at: new Date().toISOString(),
      stepId: inst.stepId
    };
    inst.comments.push(c);
    inst.history.push({ at: c.at, text: "Comentário: " + c.text.slice(0, 80) });
    save();
    return c;
  }

  function saveFilter(name, query) {
    state.savedFilters = state.savedFilters || [];
    const f = { id: uid("sf"), name: String(name).slice(0, 80), query: query || {}, userId: state.currentUserId, at: new Date().toISOString() };
    state.savedFilters.push(f);
    save();
    return f;
  }

  function deleteFilter(id) {
    state.savedFilters = (state.savedFilters || []).filter(f => f.id !== id);
    save();
  }

  const SERVICE_CATALOG = [
    { id: "svc_acesso", name: "Solicitação de acesso", desc: "Conceder ou alterar acesso a sistemas e pastas com aprovação do gestor.", sla: "2 dias úteis", icon: "fa-key", template: "acesso" },
    { id: "svc_compra", name: "Solicitação de compra", desc: "Justificativa, centro de custo e alçadas por valor.", sla: "3–5 dias", icon: "fa-cart-shopping", template: "compra" },
    { id: "svc_produto", name: "Cadastro de produto", desc: "Coleta padronizada e encaminhamento às áreas envolvidas.", sla: "4 dias", icon: "fa-box", template: "produto" },
    { id: "svc_prod", name: "Liberação para produção", desc: "Checklist técnico, aprovações e registro de implantação.", sla: "conforme janela", icon: "fa-rocket", template: "producao" },
    { id: "svc_suporte", name: "Suporte e manutenção", desc: "Chamado com categoria, impacto e evidência.", sla: "conforme prioridade", icon: "fa-headset", template: "suporte" }
  ];

  function ensureTemplateProcess(templateKey) {
    const existing = state.processes.find(p => p.templateKey === templateKey && p.published);
    if (existing) return existing;
    const defs = {
      acesso: {
        name: "Solicitação de acesso",
        category: "TI",
        steps: [
          { id: "s1", name: "Preencher pedido", type: "form", assigneeType: "starter", actions: ["enviar"] },
          { id: "s2", name: "Aprovação do gestor", type: "approve", assigneeType: "user", assigneeId: "u2", actions: ["aprovar", "devolver", "rejeitar"] },
          { id: "s3", name: "Execução TI", type: "form", assigneeType: "group", assigneeId: "g3", actions: ["enviar"] },
          { id: "s4", name: "Fim", type: "end" }
        ],
        form: [
          { id: "TX_TITULO", label: "Título", type: "text", required: true },
          { id: "TX_SISTEMA", label: "Sistema / recurso", type: "text", required: true },
          { id: "TX_PERFIL", label: "Perfil solicitado", type: "text", required: true },
          { id: "TX_JUST", label: "Justificativa", type: "textarea", required: true }
        ]
      },
      compra: {
        name: "Solicitação de compra",
        category: "Compras",
        steps: [
          { id: "s1", name: "Solicitar", type: "form", assigneeType: "starter", actions: ["enviar"] },
          { id: "s2", name: "Aprovação gestor", type: "approve", assigneeType: "user", assigneeId: "u2", actions: ["aprovar", "devolver", "rejeitar"] },
          { id: "s3", name: "Compras", type: "form", assigneeType: "group", assigneeId: "g3", actions: ["enviar"] },
          { id: "s4", name: "Fim", type: "end" }
        ],
        form: [
          { id: "TX_TITULO", label: "Item / serviço", type: "text", required: true },
          { id: "NU_VALOR", label: "Valor estimado", type: "number", required: true },
          { id: "TX_CC", label: "Centro de custo", type: "text", required: true },
          { id: "TX_JUST", label: "Justificativa", type: "textarea", required: true }
        ]
      },
      produto: {
        name: "Cadastro de produto",
        category: "Cadastros",
        steps: [
          { id: "s1", name: "Dados do produto", type: "form", assigneeType: "starter", actions: ["enviar"] },
          { id: "s2", name: "Análise", type: "approve", assigneeType: "group", assigneeId: "g2", actions: ["aprovar", "devolver"] },
          { id: "s3", name: "Fim", type: "end" }
        ],
        form: [
          { id: "TX_TITULO", label: "Nome do produto", type: "text", required: true },
          { id: "TX_CATEGORIA", label: "Categoria", type: "text", required: true },
          { id: "TX_DESC", label: "Descrição", type: "textarea", required: false }
        ]
      },
      producao: {
        name: "Liberação para produção",
        category: "TI",
        steps: [
          { id: "s1", name: "Checklist", type: "form", assigneeType: "starter", actions: ["enviar"] },
          { id: "s2", name: "Aprovação técnica", type: "approve", assigneeType: "user", assigneeId: "u2", actions: ["aprovar", "devolver"] },
          { id: "s3", name: "Fim", type: "end" }
        ],
        form: [
          { id: "TX_TITULO", label: "Sistema / fluxo", type: "text", required: true },
          { id: "TX_VERSAO", label: "Versão", type: "text", required: true },
          { id: "TX_JANELA", label: "Janela desejada", type: "text", required: true },
          { id: "TX_DESC", label: "Descrição da mudança", type: "textarea", required: true }
        ]
      },
      suporte: {
        name: "Suporte e manutenção",
        category: "Suporte",
        steps: [
          { id: "s1", name: "Abrir chamado", type: "form", assigneeType: "starter", actions: ["enviar"] },
          { id: "s2", name: "Atendimento", type: "form", assigneeType: "group", assigneeId: "g3", actions: ["enviar"] },
          { id: "s3", name: "Fim", type: "end" }
        ],
        form: [
          { id: "TX_TITULO", label: "Resumo", type: "text", required: true },
          { id: "TX_IMPACTO", label: "Impacto", type: "text", required: true },
          { id: "TX_DESC", label: "Descrição", type: "textarea", required: true }
        ]
      }
    };
    const def = defs[templateKey];
    if (!def) return null;
    const proc = {
      id: uid("proc"),
      code: String(state.nextProcCode++).padStart(6, "0"),
      name: def.name,
      subtitle: "Modelo de catálogo",
      category: def.category,
      ownerId: "u5",
      tableName: "tpl_" + templateKey,
      situation: "normal",
      published: true,
      version: 1,
      templateKey,
      steps: def.steps.map((s, i) => ({ ...s, order: i, slaHours: s.type === "end" ? 0 : 48 })),
      form: def.form.map(f => ({ ...f, vis: {} })),
      diagram: def.steps.map((s, i) => ({ id: s.id, x: 80 + i * 160, y: 120 }))
    };
    // default field visibility: normal on all non-end steps
    proc.form.forEach(f => {
      f.vis = {};
      proc.steps.forEach(s => { if (s.type !== "end") f.vis[s.id] = "normal"; });
    });
    state.processes.push(proc);
    save();
    return proc;
  }

  function escalateOverdue() {
    let n = 0;
    (state.instances || []).forEach(inst => {
      if (inst.status !== "Em andamento") return;
      if (instSla(inst) !== "atrasado") return;
      if (inst.escalated) return;
      inst.escalated = true;
      inst.history.push({ at: new Date().toISOString(), text: "SLA: escalonado automaticamente (atraso)" });
      audit("sla_escalonamento", codeOf(inst));
      n++;
    });
    if (n) save();
    return n;
  }

  return {
    get state() { return state; },
    set state(v) { state = v; },
    save, uid, userById, groupById, processById, me, esc, fmt, audit, nextCode,
    stepAssigneeIds, inboxFor, instDeadline, instSla, codeOf,
    newProcessTemplate, topBar, bindTopBar, moduleMenu,
    toast, activeDelegationsFor, actingAsIds, createDelegation, revokeDelegation,
    addComment, saveFilter, deleteFilter, SERVICE_CATALOG, ensureTemplateProcess, escalateOverdue
  };
})();
