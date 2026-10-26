const DIAGRAM_LANE_HEIGHT = 200;

function ensureEdges(p) {
  if (!Array.isArray(p.steps)) p.steps = [];
  if (!Array.isArray(p.edges)) p.edges = [];
  if (!Array.isArray(p.lanes)) p.lanes = [];
  if (!p.lanes.length) p.lanes.push({ id: L.uid("lane"), name: "Participante 1" });
  p.lanes = p.lanes.map((value, i) => {
    if (typeof value === "string") return { id: L.uid("lane"), name: value };
    const lane = value && typeof value === "object" ? value : {};
    return { ...lane, id: lane.id || L.uid("lane"), name: lane.name || `Participante ${i + 1}` };
  });
  if (!p.formId) p.formId = `FORM_${String(p.code || p.id || "PROCESSO").replace(/[^a-zA-Z0-9_]/g, "_")}`;
  p.steps.forEach((s, i) => {
    if (s.x == null) s.x = 60 + i * 140;
    if (s.y == null) s.y = 80 + (i % 2) * 40;
    if (s.type === "gateway" && !s.gatewayKind) s.gatewayKind = "xor";
    if (["form", "approve"].includes(s.type) && !s.formId) s.formId = p.formId;
    if (!p.lanes.some(lane => lane.id === s.laneId)) s.laneId = p.lanes[0].id;
  });
}

function laneForY(y, create) {
  const target = Math.max(0, Math.floor((Number(y) || 0) / DIAGRAM_LANE_HEIGHT));
  while (create && target >= draft.lanes.length) {
    draft.lanes.push({ id: L.uid("lane"), name: `Participante ${draft.lanes.length + 1}` });
  }
  return draft.lanes[Math.min(target, draft.lanes.length - 1)];
}

function orthoPath(x1, y1, x2, y2) {
  const mx = Math.round((x1 + x2) / 2);
  return "M" + x1 + "," + y1 + " L" + mx + "," + y1 + " L" + mx + "," + y2 + " L" + x2 + "," + y2;
}

function nodeCenter(s) {
  if (s.type === "start" || s.type === "end") return { x: s.x + 13, y: s.y + 13 };
  if (s.type === "gateway") return { x: s.x + 17, y: s.y + 17 };
  return { x: s.x + 80, y: s.y + 31 };
}

function removeDiagramNode(index) {
  if (!draft || !draft.steps[index]) return;
  const node = draft.steps[index];
  draft.edges = (draft.edges || []).filter(edge => edge.from !== node.id && edge.to !== node.id);
  draft.steps.splice(index, 1);
  selectedStepIdx = Math.max(0, Math.min(index - 1, draft.steps.length - 1));
  render();
}

function insertProcessActivity(node) {
  const endIndex = draft.steps.findIndex(step => step.type === "end");
  const insertAt = endIndex < 0 ? draft.steps.length : endIndex;
  draft.steps.splice(insertAt, 0, node);
  selectedStepIdx = insertAt;
}




const L = window.LECOM;
document.getElementById("topbar").innerHTML = L.topBar("Studio");
L.bindTopBar("studio");

let mode = "list"; // list | edit
let editId = null;
let wizStep = 0; // 0 prop, 1 diagrama, 2 atividades, 3 campos, 4 regras, 5 publicar
let selectedStepIdx = 0;
let draft = null;

const WIZ = [
  { id: "prop", label: "Propriedades", icon: "fa-file-alt" },
  { id: "diag", label: "Diagrama", icon: "fa-project-diagram" },
  { id: "ativ", label: "Atividades", icon: "fa-tasks" },
  { id: "campos", label: "Campos do formulário", icon: "fa-th-list" },
  { id: "regras", label: "Regras de formulário", icon: "fa-code" },
  { id: "pub", label: "Publicar e testar", icon: "fa-check" }
];

function render() {
  const app = document.getElementById("app");
  if (mode === "list") app.innerHTML = renderList();
  else app.innerHTML = renderEditor();
  bind();
}

function statusIcon(p) {
  if (p.published && p.active) return '<span class="text-emerald-600" title="Publicado"><i class="fas fa-check-circle"></i></span>';
  if (p.published === false) return '<span class="text-amber-500" title="Rascunho"><i class="fas fa-file"></i></span>';
  return '<span class="text-neutral-400" title="Inativo"><i class="fas fa-lock"></i></span>';
}

function renderList() {
  const procs = L.state.processes;
  const rows = procs.map(p => `
    <tr class="border-b border-neutral-200 hover:bg-violet-50/50 cursor-pointer text-sm" data-open="${p.id}">
      <td class="px-3 py-2 font-mono text-xs text-neutral-500">${L.esc(p.code || "—")}</td>
      <td class="px-3 py-2 font-medium text-violet-800">${L.esc(p.name || "(sem nome)")}</td>
      <td class="px-3 py-2 text-center">${(p.version || 1).toFixed(1)}</td>
      <td class="px-3 py-2 text-center">${statusIcon(p)} <span class="text-amber-600 ml-1"><i class="fas fa-flask text-xs"></i></span></td>
    </tr>`).join("");

  return `
  <div class="bg-white border-b border-neutral-200 px-4 py-2 flex items-center gap-3">
    <h1 class="text-lg font-semibold text-violet-900">Studio</h1>
    <span class="text-sm text-neutral-500">Processos · ${procs.length} processo(s)</span>
  </div>
  <div class="flex flex-1 overflow-hidden min-h-0" style="height:calc(100vh - 6.5rem)">
    <div class="w-full lg:w-[55%] bg-white border-r border-neutral-200 flex flex-col">
      <div class="px-3 py-2 border-b border-neutral-200 flex flex-wrap gap-2 items-center bg-[#f7f8fa]">
        <button id="btnNew" class="text-sm bg-violet-700 hover:bg-violet-800 text-white px-3 py-1.5 rounded flex items-center gap-1.5"><i class="fas fa-plus text-xs"></i> Novo processo</button>
        <button class="text-sm border border-neutral-300 px-3 py-1.5 rounded text-neutral-600 hover:bg-neutral-50" disabled title="Demo"><i class="fas fa-table text-xs mr-1"></i> Gerar tabelas</button>
        <button class="text-sm border border-neutral-300 px-3 py-1.5 rounded text-neutral-600 hover:bg-neutral-50" disabled title="Demo"><i class="fas fa-file-import text-xs mr-1"></i> Importar</button>
      </div>
      <div class="overflow-auto flex-1">
        <table class="w-full text-left">
          <thead class="sticky top-0 bg-[#f0f1f3] text-[11px] uppercase text-neutral-500">
            <tr>
              <th class="px-3 py-2 font-medium">Código</th>
              <th class="px-3 py-2 font-medium">Nome</th>
              <th class="px-3 py-2 font-medium text-center">Versão</th>
              <th class="px-3 py-2 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" class="px-4 py-16 text-center text-neutral-400 text-sm">Nenhum processo. Clique em <strong>Novo processo</strong> para começar pelo fluxo.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="hidden lg:flex flex-1 items-center justify-center text-neutral-400 text-sm bg-[#f7f8fa]">
      <div class="text-center">
        <i class="fas fa-hand-pointer text-3xl mb-3 opacity-40"></i>
        <p>Nenhum processo selecionado.</p>
        <p class="text-xs mt-1">Clique em um processo ou crie um novo.</p>
      </div>
    </div>
  </div>`;
}

function renderEditor() {
  const p = draft;
  const wiz = WIZ.map((w, i) => `
    <button data-wiz="${i}" class="wiz-step ${i === wizStep ? "active" : "text-neutral-600"} ${i < wizStep ? "complete" : ""}">
      <span class="wiz-ico"><i class="fas ${i < wizStep ? "fa-check" : w.icon}"></i></span>
      <span>${w.label}</span>
    </button>
  `).join("");

  return `
  <div class="studio-editor-head bg-white border-b border-neutral-200 px-4 py-2 flex items-center gap-2 flex-wrap">
    <button id="btnBackList" class="text-sm text-neutral-500 hover:text-violet-700"><i class="fas fa-arrow-left mr-1"></i></button>
    <h1 class="text-base font-semibold text-violet-900">${L.esc(p.code || "")} — ${L.esc(p.name || "Novo processo")} <span class="text-neutral-400 font-normal">v${p.version || 1}</span></h1>
    <div class="ml-auto flex gap-2">
      <button id="btnSaveDraft" class="text-sm border border-neutral-300 px-3 py-1.5 rounded hover:bg-neutral-50"><i class="fas fa-save mr-1"></i>Salvar</button>
    </div>
  </div>
  <div class="studio-wizard border-b border-neutral-300 overflow-x-auto">${wiz}</div>
  <div class="flex-1 overflow-auto p-4" style="height:calc(100vh - 9rem)">
    ${renderWizBody()}
  </div>
  <div class="bg-white border-t border-neutral-200 px-4 py-2 flex justify-between">
    <button id="btnWizPrev" class="text-sm px-3 py-1.5 rounded border border-neutral-300 ${wizStep === 0 ? "opacity-40 pointer-events-none" : "hover:bg-neutral-50"}">← Anterior</button>
    <button id="btnWizNext" class="text-sm px-4 py-1.5 rounded bg-violet-700 text-white hover:bg-violet-800">${wizStep === WIZ.length - 1 ? "Concluir" : "Próximo →"}</button>
  </div>`;
}

function renderWizBody() {
  if (wizStep === 0) return renderProp();
  if (wizStep === 1) return renderDiagrama();
  if (wizStep === 2) return renderAtividades();
  if (wizStep === 3) return renderCampos();
  if (wizStep === 4) return renderRegras();
  return renderPublicar();
}

function renderProp() {
  const p = draft;
  return `
  <div class="max-w-3xl bg-white border border-neutral-200 rounded shadow-sm">
    <div class="px-4 py-2 border-b border-neutral-200 bg-[#f7f8fa] text-sm font-medium text-violet-900">Propriedades do processo</div>
    <div class="p-4 space-y-3 text-sm">
      <div class="grid grid-cols-[180px_1fr] gap-2 items-center">
        <label class="text-neutral-600">Título do processo <span class="text-red-500">*</span></label>
        <input id="pName" value="${L.esc(p.name)}" class="border border-neutral-300 rounded px-2 py-1.5 w-full"/>
      </div>
      <div class="grid grid-cols-[180px_1fr] gap-2 items-center">
        <label class="text-neutral-600">Subtítulo</label>
        <input id="pSubtitle" value="${L.esc(p.subtitle || "")}" class="border border-neutral-300 rounded px-2 py-1.5 w-full"/>
      </div>
      <div class="grid grid-cols-[180px_1fr] gap-2 items-start">
        <label class="text-neutral-600 pt-1.5">Descrição</label>
        <textarea id="pDesc" rows="3" class="border border-neutral-300 rounded px-2 py-1.5 w-full">${L.esc(p.description || "")}</textarea>
      </div>
      <div class="grid grid-cols-[180px_1fr] gap-2 items-start">
        <label class="text-neutral-600 pt-1.5">Texto de ajuda</label>
        <textarea id="pHelp" rows="2" class="border border-neutral-300 rounded px-2 py-1.5 w-full">${L.esc(p.helpText || "")}</textarea>
      </div>
      <div class="grid grid-cols-[180px_1fr] gap-2 items-center">
        <label class="text-neutral-600">Situação do processo</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-1.5"><input type="radio" name="situacao" value="normal" ${p.situation !== "test" ? "checked" : ""}/> Modo normal</label>
          <label class="flex items-center gap-1.5"><input type="radio" name="situacao" value="test" ${p.situation === "test" ? "checked" : ""}/> Modo teste</label>
        </div>
      </div>
      <div class="grid grid-cols-[180px_1fr] gap-2 items-center">
        <label class="text-neutral-600">Departamento que podem abrir</label>
        <input id="pDept" value="${L.esc(p.deptOpen || "Administrativo")}" class="border border-neutral-300 rounded px-2 py-1.5 w-full"/>
      </div>
      <div class="grid grid-cols-[180px_1fr] gap-2 items-center">
        <label class="text-neutral-600">Categoria</label>
        <input id="pCat" value="${L.esc(p.category || "Geral")}" class="border border-neutral-300 rounded px-2 py-1.5 w-full"/>
      </div>
      <div class="grid grid-cols-[180px_1fr] gap-2 items-center">
        <label class="text-neutral-600">Proprietário</label>
        <select id="pOwner" class="border border-neutral-300 rounded px-2 py-1.5 w-full">
          ${L.state.users.map(u => `<option value="${u.id}" ${p.ownerId === u.id ? "selected" : ""}>${L.esc(u.name)}</option>`).join("")}
        </select>
      </div>
      <div class="grid grid-cols-[180px_1fr] gap-2 items-center">
        <label class="text-neutral-600">Nome da tabela <span class="text-red-500">*</span></label>
        <input id="pTable" value="${L.esc(p.tableName || "")}" placeholder="ex: devolucao" class="border border-neutral-300 rounded px-2 py-1.5 w-full font-mono text-xs"/>
      </div>
      <div class="grid grid-cols-[180px_1fr] gap-2 items-center">
        <label class="text-neutral-600">Versão</label>
        <input id="pVer" type="number" min="1" step="1" value="${p.version || 1}" class="border border-neutral-300 rounded px-2 py-1.5 w-24"/>
      </div>
    </div>
  </div>`;
}

function renderDiagrama() {
  const p = draft;
  ensureEdges(p);
  const tool = window.__bzTool || "select";
  const stroke = "#9ca3af";
  const zoom = Math.max(0.5, Math.min(1.5, Number(window.__bzZoom) || 1));
  const maxX = Math.max(1200, ...p.steps.map(s => (Number(s.x) || 0) + 220));
  const maxY = Math.max(p.lanes.length * DIAGRAM_LANE_HEIGHT, ...p.steps.map(s => (Number(s.y) || 0) + 140));
  const width = Math.ceil(maxX / 100) * 100;
  const height = Math.ceil(maxY / 100) * 100;

  let paths = "";
  (p.edges || []).forEach((e, ei) => {
    const a = p.steps.find(s => s.id === e.from);
    const b = p.steps.find(s => s.id === e.to);
    if (!a || !b) return;
    const c1 = nodeCenter(a), c2 = nodeCenter(b);
    const rightward = b.x >= a.x;
    const x1 = rightward ? a.x + (a.type === "gateway" ? 36 : a.type === "start" || a.type === "end" ? 26 : 160) : a.x;
    const x2 = rightward ? b.x : b.x + (b.type === "gateway" ? 36 : b.type === "start" || b.type === "end" ? 26 : 160);
    const mx = Math.round((x1 + x2) / 2), my = Math.round((c1.y + c2.y) / 2);
    paths += `<path class="bz-edge" data-ed="${ei}" d="${orthoPath(x1, c1.y, x2, c2.y)}" fill="none" stroke="${stroke}" stroke-width="1.25" marker-end="url(#bzArr)"/>`;
    if (e.label) paths += `<text class="bz-edge-label" data-ed="${ei}" x="${mx}" y="${my - 7}" text-anchor="middle">${L.esc(e.label)}</text>`;
  });

  const nodes = p.steps.map((s, i) => {
    const sel = i === selectedStepIdx ? "sel" : "";
    if (s.type === "start") {
      return `<div class="bz-node ${sel}" data-node="${i}" style="left:${s.x}px;top:${s.y}px">
        <div class="bz-start"></div><div class="bz-cap">Evento inicial</div></div>`;
    }
    if (s.type === "end") {
      return `<div class="bz-node ${sel}" data-node="${i}" style="left:${s.x}px;top:${s.y}px">
        <div class="bz-end"></div><div class="bz-cap">${L.esc(s.name || "Fim")}</div></div>`;
    }
    if (s.type === "gateway") {
      const sym = s.gatewayKind === "and" ? "+" : s.gatewayKind === "or" ? "○" : "×";
      return `<div class="bz-node ${sel}" data-node="${i}" style="left:${s.x}px;top:${s.y}px">
        <div class="bz-gw"><span>${sym}</span></div>
        <div class="bz-cap">${L.esc(s.name || "Gateway")}</div></div>`;
    }
    const isForm = s.type === "form" || s.type === "approve";
    const kind = s.type === "approve" ? "Aprovação · formulário" : s.type === "script" ? "Automação" : "Atividade de formulário";
    const formId = isForm ? (s.formId || p.formId) : "";
    return `<div class="bz-node ${sel}" data-node="${i}" style="left:${s.x}px;top:${s.y}px">
      <div class="bz-task ${isForm ? "bz-task-form" : "bz-task-auto"}">
        <span class="bz-task-kind"><i class="fas ${isForm ? "fa-file-alt" : "fa-bolt"}"></i> ${kind}</span>
        <strong>${L.esc(s.name || "Atividade")}</strong>
        ${isForm ? `<span class="bz-task-formid">Formulário: ${L.esc(formId)}</span>` : ""}
      </div></div>`;
  }).join("");

  const tip = {
    select: "Selecione para editar; arraste os blocos para organizar o fluxo. Duplo clique abre a atividade.",
    task: "Clique no quadro branco para criar uma atividade vinculada ao formulário do processo.",
    start: "Clique para colocar o início.",
    end: "Clique para colocar o fim.",
    gateway: "Clique para colocar um gateway (decisão).",
    connect: "Clique na origem e depois no destino."
  };
  const selectedNode = p.steps[selectedStepIdx];
  const lanes = p.lanes.map((lane, i) => `<div class="bz-lane ${i % 2 ? "alt" : ""}" style="top:${i * DIAGRAM_LANE_HEIGHT}px;height:${DIAGRAM_LANE_HEIGHT}px">
    <span class="bz-lane-label" data-lane="${L.esc(lane.id)}" title="Duplo clique para renomear"><i class="fas fa-users"></i> ${L.esc(lane.name)}</span>
  </div>`).join("");

  return `
  <div class="bz-editor-wrap">
   <div class="bz-commandbar">
    <span class="bz-command-state"><i class="fas fa-circle"></i> Versão rascunho</span>
    <span class="bz-command-version">v${L.esc(p.version || 1)}</span>
    ${p.published ? '<span class="bz-command-published"><i class="fas fa-check-circle"></i> Versão publicada</span>' : ""}
    <span class="bz-command-spacer"></span>
    <button type="button" id="bzDiagramSave" title="Salvar diagrama"><i class="fas fa-save"></i> Salvar</button>
    <button type="button" id="bzFullscreen" title="Tela cheia"><i class="fas fa-expand"></i> Tela cheia</button>
   </div>
  <div class="bz-root">
    <div class="bz-tools">
      <button type="button" data-tool="select" class="${tool==="select"?"on":""}" title="Selecionar">↖</button>
      <button type="button" data-tool="start" class="${tool==="start"?"on":""}" title="Evento inicial"><i class="fas fa-play-circle"></i></button>
      <button type="button" data-tool="task" class="${tool==="task"?"on":""}" title="Atividade com formulário"><i class="fas fa-file-alt"></i></button>
      <button type="button" data-tool="gateway" class="${tool==="gateway"?"on":""}" title="Gateway"><i class="fas fa-diamond"></i></button>
      <button type="button" data-tool="end" class="${tool==="end"?"on":""}" title="Evento final"><i class="fas fa-stop-circle"></i></button>
      <button type="button" data-tool="connect" class="${tool==="connect"?"on":""}" title="Conectar elementos"><i class="fas fa-share"></i></button>
      <span class="bz-tool-divider"></span>
      <button type="button" id="bzAutoLayout" title="Organizar automaticamente"><i class="fas fa-diagram-project"></i></button>
      <button type="button" id="bzEditStep" title="Editar atividade selecionada"><i class="fas fa-sliders-h"></i></button>
      <button type="button" id="bzEditForm" title="Editar campos do formulário"><i class="fas fa-list-check"></i></button>
      <button type="button" id="bzDel" title="Excluir selecionado"><i class="fas fa-trash"></i></button>
    </div>
    <div class="bz-stage" id="diagCanvas">
      <div class="bz-stagebar">
        <span class="bz-stage-hint">Arraste para posicionar · conecte com a ferramenta <i class="fas fa-share"></i></span>
        <button type="button" id="bzAddLane" class="bz-add-lane"><i class="fas fa-plus"></i> Raia</button>
        ${selectedNode && selectedNode.type === "gateway" ? `<label class="bz-gateway-control">Tipo de decisão
          <select id="bzGatewayKind" title="Tipo de gateway">
            <option value="xor" ${selectedNode.gatewayKind === "xor" ? "selected" : ""}>Exclusivo</option>
            <option value="or" ${selectedNode.gatewayKind === "or" ? "selected" : ""}>Inclusivo</option>
            <option value="and" ${selectedNode.gatewayKind === "and" ? "selected" : ""}>Paralelo</option>
          </select>
        </label>` : ""}
        <div class="bz-zoom-controls">
          <button type="button" data-zoom="out" title="Diminuir zoom">−</button>
          <span>${Math.round(zoom * 100)}%</span>
          <button type="button" data-zoom="in" title="Aumentar zoom">+</button>
          <button type="button" data-zoom="fit" title="Ajustar ao quadro">Ajustar</button>
        </div>
      </div>
      <div class="bz-viewport">
       <div class="bz-world" style="width:${Math.ceil(width * zoom)}px;height:${Math.ceil(height * zoom)}px">
        <div class="bz-pool" id="bzPool" style="width:${width}px;height:${height}px;transform:scale(${zoom})">
          <div class="bz-lanes">${lanes}</div>
          <svg width="${width}" height="${height}" style="position:absolute;left:0;top:0;z-index:2;overflow:visible">
            <defs><marker id="bzArr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="${stroke}"/></marker></defs>
            <g>${paths}</g>
          </svg>
          <div class="bz-node-layer" style="width:${width}px;height:${height}px">${nodes}</div>
        </div>
       </div>
      </div>
      <div class="bz-status">${tip[tool] || ""} · ${p.lanes.length} raias · ${p.steps.filter(s => ["form", "approve"].includes(s.type)).length} atividades com formulário · ${p.steps.length} elementos · ${(p.edges||[]).length} fluxos</div>
    </div>
  </div>`;
}

function renderAtividades() {
  const p = draft;
  const activityIndices = p.steps.map((st, i) => ({ st, i })).filter(({ st }) => !["start", "gateway", "end"].includes(st.type));
  if (selectedStepIdx >= p.steps.length) selectedStepIdx = 0;
  if (p.steps[selectedStepIdx] && ["start", "gateway", "end"].includes(p.steps[selectedStepIdx].type)) {
    selectedStepIdx = activityIndices.length ? activityIndices[0].i : -1;
  }
  const s = p.steps[selectedStepIdx];
  const list = activityIndices.map(({ st, i }) => `
    <button data-sel-step="${i}" class="w-full text-left px-3 py-2 text-sm border-b border-neutral-100 hover:bg-violet-50 ${i === selectedStepIdx ? "row-sel font-medium text-violet-900" : ""}">
      <span class="inline-block w-2 h-2 rounded-full mr-2 ${st.type === "approve" ? "bg-violet-500" : st.type === "script" ? "bg-amber-500" : "bg-sky-500"}"></span>
      ${L.esc(st.name)}
    </button>`).join("");

  return `
  <div class="flex gap-0 border border-neutral-200 rounded shadow-sm bg-white overflow-hidden min-h-[420px]">
    <div class="w-56 border-r border-neutral-200 bg-[#f7f8fa] flex flex-col">
      <div class="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase border-b border-neutral-200 flex justify-between items-center">
        Atividades
        <button id="btnAddAtiv" class="text-violet-700 hover:underline normal-case font-medium">+ nova</button>
      </div>
      <div class="overflow-y-auto flex-1">${list || '<p class="p-3 text-xs text-neutral-400">Adicione uma atividade de formulário pelo diagrama.</p>'}</div>
      ${s ? `<button id="btnDelAtiv" class="m-2 text-xs text-red-600 hover:underline">Excluir selecionada</button>` : ""}
    </div>
    ${s ? `<div class="flex-1 p-4 overflow-y-auto text-sm space-y-4">
      <div class="border border-neutral-200 rounded">
        <div class="px-3 py-1.5 bg-[#f0f1f3] text-xs font-semibold text-neutral-600">Dados básicos</div>
        <div class="p-3 space-y-3">
          <div class="grid grid-cols-[160px_1fr] gap-2 items-center">
            <label>Referência da atividade</label>
            <input id="sRef" value="${L.esc(s.ref || "")}" class="border border-neutral-300 rounded px-2 py-1 font-mono text-xs"/>
          </div>
          <div class="grid grid-cols-[160px_1fr] gap-2 items-center">
            <label>Título da atividade <span class="text-red-500">*</span></label>
            <input id="sName" value="${L.esc(s.name)}" class="border border-neutral-300 rounded px-2 py-1"/>
          </div>
          <div class="grid grid-cols-[160px_1fr] gap-2 items-start">
            <label class="pt-1">Descrição</label>
            <textarea id="sDesc" rows="2" class="border border-neutral-300 rounded px-2 py-1">${L.esc(s.description || "")}</textarea>
          </div>
          <div class="grid grid-cols-[160px_1fr] gap-2 items-center">
            <label>Tipo</label>
            <select id="sType" class="border border-neutral-300 rounded px-2 py-1">
              <option value="form" ${s.type === "form" ? "selected" : ""}>Formulário (humano)</option>
              <option value="approve" ${s.type === "approve" ? "selected" : ""}>Aprovação</option>
              <option value="script" ${s.type === "script" ? "selected" : ""}>Script JS (automático)</option>
              <option value="end" ${s.type === "end" ? "selected" : ""}>Fim</option>
            </select>
          </div>
          ${["form", "approve"].includes(s.type) ? `<div class="grid grid-cols-[160px_1fr] gap-2 items-center">
            <label>Formulário da atividade</label>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded bg-violet-50 border border-violet-200 px-2 py-1 font-mono text-xs text-violet-800"><i class="fas fa-file-alt mr-1"></i>${L.esc(s.formId || p.formId)}</span>
              <button type="button" id="btnOpenFormFromStep" class="text-xs text-violet-700 hover:underline">Editar campos do formulário</button>
            </div>
            <p class="col-start-2 text-xs text-neutral-500">Esta atividade abre o formulário do processo. Campos e regras são configurados nas etapas seguintes do Studio.</p>
          </div>` : ""}
          <div class="grid grid-cols-[160px_1fr] gap-2 items-center ${s.type === "end" ? "opacity-40 pointer-events-none" : ""}">
            <label>Responsável pela atividade</label>
            <div class="flex flex-wrap gap-2">
              <select id="sAssignType" class="border border-neutral-300 rounded px-2 py-1">
                <option value="starter" ${s.assigneeType === "starter" ? "selected" : ""}>Solicitante</option>
                <option value="user" ${s.assigneeType === "user" ? "selected" : ""}>Usuário</option>
                <option value="group" ${s.assigneeType === "group" ? "selected" : ""}>Grupo</option>
              </select>
              <select id="sAssignUser" class="border border-neutral-300 rounded px-2 py-1 ${s.assigneeType !== "user" ? "hidden" : ""}">
                ${L.state.users.map(u => `<option value="${u.id}" ${s.assigneeId === u.id ? "selected" : ""}>${L.esc(u.name)}</option>`).join("")}
              </select>
              <select id="sAssignGroup" class="border border-neutral-300 rounded px-2 py-1 ${s.assigneeType !== "group" ? "hidden" : ""}">
                ${(L.state.groups || []).map(g => `<option value="${g.id}" ${s.assigneeId === g.id ? "selected" : ""}>${L.esc(g.name)}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>
      </div>
      <div class="border border-neutral-200 rounded">
        <div class="px-3 py-1.5 bg-[#f0f1f3] text-xs font-semibold text-neutral-600">Prazos e monitoramento</div>
        <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label class="text-xs text-neutral-500">Prazo alerta</label>
            <input id="sPrazoAlerta" type="text" placeholder="000:00:00" value="${L.esc(s.prazoAlerta || "")}" class="mt-0.5 border border-neutral-300 rounded px-2 py-1 w-full font-mono text-xs"/></div>
          <div><label class="text-xs text-neutral-500">Prazo máximo</label>
            <input id="sPrazoMax" type="text" placeholder="000:00:00" value="${L.esc(s.prazoMax || "")}" class="mt-0.5 border border-neutral-300 rounded px-2 py-1 w-full font-mono text-xs"/></div>
        </div>
      </div>
      <div class="border border-neutral-200 rounded">
        <div class="px-3 py-1.5 bg-[#f0f1f3] text-xs font-semibold text-neutral-600">Ações da etapa</div>
        <div class="p-3 flex flex-wrap gap-3 text-sm">
          ${["enviar", "aprovar", "devolver", "rejeitar"].map(a => `
            <label class="flex items-center gap-1.5"><input type="checkbox" class="s-action" value="${a}" ${(s.actions || []).includes(a) ? "checked" : ""}/> ${a}</label>
          `).join("")}
        </div>
      </div>
      <div class="border border-amber-200 rounded overflow-hidden">
        <div class="px-3 py-1.5 bg-amber-50 text-xs font-semibold text-amber-900 flex items-center gap-2">
          <i class="fas fa-code"></i> Script JavaScript da atividade
        </div>
        <div class="p-3 space-y-2">
          <p class="text-[11px] text-neutral-500">Executado ao <strong>entrar</strong> na atividade (runtime). API demo: <code class="bg-neutral-100 px-1 rounded">form</code>, <code class="bg-neutral-100 px-1 rounded">instance</code>, <code class="bg-neutral-100 px-1 rounded">step</code>, <code class="bg-neutral-100 px-1 rounded">user</code>, <code class="bg-neutral-100 px-1 rounded">setField(id,val)</code>, <code class="bg-neutral-100 px-1 rounded">getField(id)</code>, <code class="bg-neutral-100 px-1 rounded">log(msg)</code>.</p>
          <textarea id="sScript" rows="8" class="w-full border border-neutral-300 rounded px-2 py-1.5 font-mono text-xs bg-neutral-900 text-green-400" placeholder="// Exemplo:&#10;if (!getField('TX_TITULO')) {&#10;  log('Título vazio');&#10;}&#10;setField('TX_AREA', 'TI');">${L.esc(s.script || "")}</textarea>
        </div>
      </div>
    </div>` : `<div class="flex-1 flex items-center justify-center text-sm text-neutral-400">Nenhuma atividade editável. Crie uma pelo Diagrama.</div>`}
  </div>`;
}

function renderCampos() {
  const p = draft;
  if (!Array.isArray(p.form)) p.form = [];
  const sections = [...new Set(p.form.map(f => f.section || "Geral"))];
  let html = `<div class="max-w-4xl space-y-4">
    <div class="flex justify-between items-start gap-3 flex-wrap">
      <div>
        <p class="text-sm font-medium text-neutral-800">Campos do formulário <span class="ml-2 rounded bg-violet-50 border border-violet-200 px-2 py-1 font-mono text-[11px] text-violet-800">${L.esc(p.formId)}</span></p>
        <p class="text-xs text-neutral-500 mt-1 max-w-xl">Crie quantos campos quiser (texto, lista, data…). Depois, em cada campo, defina por <strong>atividade/quadrado do fluxo</strong> se fica <strong>Oculto</strong>, <strong>Normal</strong> ou <strong>Somente leitura</strong> — igual a matriz do LECOM.</p>
      </div>
      <button id="btnAddField" class="text-sm bg-violet-700 text-white px-3 py-1.5 rounded hover:bg-violet-800 shrink-0">+ Novo campo</button>
    </div>`;

  sections.forEach(sec => {
    const fields = p.form.filter(f => (f.section || "Geral") === sec);
    html += `<div class="bg-white border border-neutral-200 rounded shadow-sm overflow-hidden">
      <div class="px-3 py-2 bg-[#f0f1f3] text-sm font-medium flex justify-between">
        <span>${L.esc(sec)}</span>
        <span class="text-xs text-neutral-400">${fields.length} ativo(s)</span>
      </div>
      <table class="w-full text-sm">
        <thead class="text-[11px] text-neutral-500 uppercase border-b">
          <tr><th class="px-3 py-1.5 text-left w-8">#</th><th class="px-3 py-1.5 text-left">Tipo</th><th class="px-3 py-1.5 text-left">ID</th><th class="px-3 py-1.5 text-left">Rótulo</th><th class="px-3 py-1.5 w-24"></th></tr>
        </thead>
        <tbody>`;
    fields.forEach((f, fi) => {
      const globalIdx = p.form.indexOf(f);
      const typeLabel = { text: "Linha de texto", textarea: "Texto longo", number: "Inteiro", date: "Data", select: "Lista" }[f.type] || f.type;
      html += `<tr class="border-b border-neutral-100 hover:bg-neutral-50" data-field-idx="${globalIdx}">
        <td class="px-3 py-1.5 text-neutral-400">${fi + 1}</td>
        <td class="px-3 py-1.5">${typeLabel}</td>
        <td class="px-3 py-1.5 font-mono text-xs">${L.esc(f.id)}</td>
        <td class="px-3 py-1.5">${L.esc(f.label)}</td>
        <td class="px-3 py-1.5 text-right space-x-1">
          <button data-edit-field="${globalIdx}" class="text-neutral-500 hover:text-violet-700" title="Editar"><i class="fas fa-pen text-xs"></i></button>
          <button data-del-field="${globalIdx}" class="text-neutral-500 hover:text-red-600" title="Excluir"><i class="fas fa-times text-xs"></i></button>
        </td>
      </tr>`;
    });
    html += `</tbody></table>
      <button data-add-section="${L.esc(sec)}" class="w-full text-left px-3 py-2 text-xs text-violet-700 hover:bg-violet-50 border-t border-neutral-100">+ Novo campo nesta seção</button>
    </div>`;
  });

  html += `<button id="btnAddSection" class="text-sm text-violet-700 hover:underline">+ Nova seção</button></div>`;
  return html;
}

function renderRegras() {
  return `
  <div class="max-w-2xl bg-white border border-neutral-200 rounded shadow-sm p-6">
    <h2 class="font-semibold text-violet-900 mb-2">Regras de formulário</h2>
    <p class="text-sm text-neutral-500 mb-4">No LECOM real usam-se scripts JavaScript do formulário (API Form.*). Neste MVP, a validação de obrigatórios já roda na execução.</p>
    <div class="bg-neutral-900 text-green-400 font-mono text-xs p-4 rounded overflow-x-auto">
<pre>// Exemplo didático (guia cap. 9)
Form.subscribe('SUBMIT', function (formId, actionId, reject) {
  var campo = Form.fields('TX_TITULO');
  if (!campo.value()) {
    campo.errors('Informe o título.');
    reject();
  }
});</pre>
    </div>
    <p class="text-xs text-neutral-400 mt-3">Scripts customizados completos exigem o runtime LECOM — aqui só documentação + validação nativa.</p>
  </div>`;
}

function renderPublicar() {
  const p = draft;
  const issues = [];
  if (!p.name) issues.push("Título do processo obrigatório");
  if (!p.tableName) issues.push("Nome da tabela obrigatório");
  if (!p.steps.length) issues.push("Inclua ao menos uma atividade");
  if (!p.form.length) issues.push("Inclua ao menos um campo");
  p.steps.forEach((s, i) => { if (!s.name) issues.push("Atividade " + (i + 1) + " sem título"); });

  return `
  <div class="max-w-xl bg-white border border-neutral-200 rounded shadow-sm p-6 space-y-4">
    <h2 class="font-semibold text-violet-900">Publicar e testar</h2>
    ${issues.length ? `<div class="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
      <p class="font-medium mb-1">Pendências antes de publicar:</p>
      <ul class="list-disc pl-5">${issues.map(x => `<li>${L.esc(x)}</li>`).join("")}</ul>
    </div>` : `<div class="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm text-emerald-800">Pronto para publicar.</div>`}
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="pActive" ${p.active ? "checked" : ""}/> Processo ativo</label>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="pPublished" ${p.published ? "checked" : ""}/> Publicado (aparece em Workspace → Abrir)</label>
    <div class="flex gap-2 pt-2">
      <button id="btnPublish" class="bg-violet-700 hover:bg-violet-800 text-white text-sm px-4 py-2 rounded font-medium" ${issues.length ? "disabled" : ""}>Salvar e publicar</button>
      <button id="btnSaveOnly" class="border border-neutral-300 text-sm px-4 py-2 rounded hover:bg-neutral-50">Salvar rascunho</button>
      <a href="workspace.html" class="text-sm text-violet-700 px-3 py-2 hover:underline ml-auto">Ir ao Workspace →</a>
    </div>
  </div>`;
}

function collectProp() {
  if (!draft) return;
  const el = id => document.getElementById(id);
  if (el("pName")) {
    draft.name = el("pName").value.trim();
    draft.subtitle = el("pSubtitle").value.trim();
    draft.description = el("pDesc").value.trim();
    draft.helpText = el("pHelp").value.trim();
    draft.deptOpen = el("pDept").value.trim();
    draft.category = el("pCat").value.trim();
    draft.ownerId = el("pOwner").value;
    draft.tableName = el("pTable").value.trim().replace(/[^a-zA-Z0-9_]/g, "");
    draft.version = parseInt(el("pVer").value, 10) || 1;
    const sit = document.querySelector('input[name="situacao"]:checked');
    if (sit) draft.situation = sit.value;
  }
  if (el("pActive")) draft.active = el("pActive").checked;
  if (el("pPublished")) draft.published = el("pPublished").checked;
}

function collectAtividade() {
  if (wizStep !== 2 || !draft) return;
  const s = draft.steps[selectedStepIdx];
  if (!s || ["start", "gateway", "end"].includes(s.type)) return;
  const el = id => document.getElementById(id);
  if (!el("sName")) return;
  s.ref = el("sRef").value.trim();
  s.name = el("sName").value.trim();
  s.description = el("sDesc").value.trim();
  s.type = el("sType").value;
  if (["form", "approve"].includes(s.type)) s.formId = draft.formId;
  s.assigneeType = el("sAssignType").value;
  if (s.assigneeType === "user") s.assigneeId = el("sAssignUser").value;
  if (s.assigneeType === "group") s.assigneeId = el("sAssignGroup").value;
  s.prazoAlerta = el("sPrazoAlerta").value.trim();
  s.prazoMax = el("sPrazoMax").value.trim();
  s.actions = [...document.querySelectorAll(".s-action:checked")].map(c => c.value);
  if (document.getElementById("sScript")) s.script = document.getElementById("sScript").value;
}

function persistDraft(publish) {
  collectProp();
  collectAtividade();
  if (publish) {
    draft.published = true;
    draft.active = true;
  }
  const idx = L.state.processes.findIndex(x => x.id === draft.id);
  if (idx >= 0) L.state.processes[idx] = JSON.parse(JSON.stringify(draft));
  else L.state.processes.push(JSON.parse(JSON.stringify(draft)));
  L.audit((publish ? "Processo publicado: " : "Processo salvo: ") + draft.name);
  L.save();
}

function bind() {
  document.getElementById("btnNew") && (document.getElementById("btnNew").onclick = () => {
    draft = L.newProcessTemplate();
    editId = draft.id;
    mode = "edit";
    wizStep = 0;
    selectedStepIdx = 0;
    render();
  });
  document.querySelectorAll("[data-open]").forEach(tr => {
    tr.onclick = () => {
      const p = L.processById(tr.dataset.open);
      if (!p) return;
      draft = JSON.parse(JSON.stringify(p));
      editId = p.id;
      mode = "edit";
      wizStep = 0;
      selectedStepIdx = 0;
      render();
    };
  });
  document.getElementById("btnBackList") && (document.getElementById("btnBackList").onclick = () => {
    if (confirm("Voltar à lista? Alterações não salvas nesta tela serão perdidas se não tiver clicado em Salvar.")) {
      mode = "list"; draft = null; render();
    }
  });
  document.getElementById("btnSaveDraft") && (document.getElementById("btnSaveDraft").onclick = () => {
    collectProp(); collectAtividade(); persistDraft(false); alert("Salvo.");
  });
  document.querySelectorAll("[data-wiz]").forEach(b => {
    b.onclick = () => {
      collectProp(); collectAtividade();
      wizStep = +b.dataset.wiz;
      render();
    };
  });
  document.getElementById("btnWizPrev") && (document.getElementById("btnWizPrev").onclick = () => {
    collectProp(); collectAtividade();
    if (wizStep > 0) { wizStep--; render(); }
  });
  document.getElementById("btnWizNext") && (document.getElementById("btnWizNext").onclick = () => {
    collectProp(); collectAtividade();
    if (wizStep < WIZ.length - 1) { wizStep++; render(); }
    else { persistDraft(true); mode = "list"; render(); }
  });
  // Diagrama do processo: cada atividade humana referencia o formulário do processo.
  if (draft) ensureEdges(draft);

  document.querySelectorAll("[data-tool]").forEach(b => {
    b.onclick = () => {
      window.__bzTool = b.dataset.tool;
      window.__linkFrom = null;
      render();
    };
  });

  const pool = document.getElementById("bzPool");
  if (pool) {
    pool.onclick = e => {
      if (e.target.closest("[data-node]")) return;
      const tool = window.__bzTool || "select";
      if (tool === "select" || tool === "connect") return;
      const rect = pool.getBoundingClientRect();
      const zoom = Math.max(0.5, Number(window.__bzZoom) || 1);
      const mapPoint = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
      const map = { task: "form", start: "start", end: "end", gateway: "gateway" };
      const type = map[tool];
      if (!type) return;
      const names = { form: "Nova atividade", start: "Início", end: "Fim", gateway: "Decisão" };
      const node = {
        id: L.uid("s"),
        name: names[type],
        ref: type.toUpperCase() + "_" + (draft.steps.length + 1),
        type,
        formId: type === "form" ? draft.formId : undefined,
        gatewayKind: type === "gateway" ? "xor" : undefined,
        assigneeType: type === "form" ? "starter" : null,
        assigneeId: null,
        actions: type === "form" ? ["enviar"] : [],
        script: "",
        slaHours: ["start", "end", "gateway"].includes(type) ? 0 : 48,
        x: Math.max(20, mapPoint.x - (type === "form" ? 80 : 14)),
        y: Math.max(20, mapPoint.y - (type === "form" ? 30 : 14))
      };
      node.laneId = laneForY(node.y, true).id;
      if (type === "form") insertProcessActivity(node);
      else {
        draft.steps.push(node);
        selectedStepIdx = draft.steps.indexOf(node);
      }
      window.__bzTool = "select";
      render();
    };
  }

  document.getElementById("bzDel") && (document.getElementById("bzDel").onclick = () => {
    removeDiagramNode(selectedStepIdx);
  });
  document.getElementById("bzDiagramSave") && (document.getElementById("bzDiagramSave").onclick = () => {
    collectProp();
    collectAtividade();
    persistDraft(false);
    L.toast("Diagrama salvo");
  });
  document.getElementById("bzFullscreen") && (document.getElementById("bzFullscreen").onclick = async () => {
    const editor = document.querySelector(".bz-editor-wrap");
    if (!editor) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (editor.requestFullscreen) await editor.requestFullscreen();
  });

  document.getElementById("bzEditStep") && (document.getElementById("bzEditStep").onclick = () => {
    const s = draft.steps[selectedStepIdx];
    if (!s || ["start", "gateway", "end"].includes(s.type)) return L.toast("Selecione uma atividade para editar");
    collectProp(); collectAtividade(); wizStep = 2; render();
  });
  document.getElementById("bzEditForm") && (document.getElementById("bzEditForm").onclick = () => {
    collectProp(); collectAtividade(); wizStep = 3; render();
  });
  document.getElementById("btnOpenFormFromStep") && (document.getElementById("btnOpenFormFromStep").onclick = () => {
    collectAtividade(); wizStep = 3; render();
  });
  document.getElementById("bzGatewayKind") && (document.getElementById("bzGatewayKind").onchange = e => {
    const s = draft.steps[selectedStepIdx];
    if (s && s.type === "gateway") { s.gatewayKind = e.target.value; render(); }
  });
  document.getElementById("bzAddLane") && (document.getElementById("bzAddLane").onclick = () => {
    const name = prompt("Nome da raia / participante:", `Participante ${draft.lanes.length + 1}`);
    if (name && name.trim()) draft.lanes.push({ id: L.uid("lane"), name: name.trim() });
    render();
  });
  document.querySelectorAll("[data-lane]").forEach(label => {
    label.ondblclick = e => {
      e.stopPropagation();
      const lane = draft.lanes.find(item => item.id === label.dataset.lane);
      if (!lane) return;
      const name = prompt("Nome da raia / participante:", lane.name);
      if (name && name.trim()) { lane.name = name.trim(); render(); }
    };
  });

  document.getElementById("bzAutoLayout") && (document.getElementById("bzAutoLayout").onclick = () => {
    const ordered = [...draft.steps].sort((a, b) => {
      const rank = s => s.type === "start" ? -1 : s.type === "end" ? 1 : 0;
      return rank(a) - rank(b) || draft.steps.indexOf(a) - draft.steps.indexOf(b);
    });
    ordered.forEach((s, i) => {
      const laneIndex = Math.max(0, draft.lanes.findIndex(lane => lane.id === s.laneId));
      s.x = 70 + i * 210;
      s.y = laneIndex * DIAGRAM_LANE_HEIGHT + 75;
    });
    render();
  });
  document.querySelectorAll("[data-zoom]").forEach(button => {
    button.onclick = () => {
      const action = button.dataset.zoom;
      if (action === "fit") {
        const viewport = document.querySelector(".bz-viewport");
        const width = Math.max(1200, ...draft.steps.map(s => (Number(s.x) || 0) + 220));
        const height = Math.max(draft.lanes.length * DIAGRAM_LANE_HEIGHT, ...draft.steps.map(s => (Number(s.y) || 0) + 140));
        window.__bzZoom = Math.max(0.5, Math.min(1.5, Math.min((viewport.clientWidth - 48) / width, (viewport.clientHeight - 48) / height)));
      } else {
        window.__bzZoom = Math.max(0.5, Math.min(1.5, (Number(window.__bzZoom) || 1) + (action === "in" ? 0.1 : -0.1)));
      }
      render();
    };
  });

  // edge label click via text in SVG - use document query on data-ed after render... SVG text in path group
  // handled via dblclick on nodes and prompt on connect labels stored in edges - click node

  let drag = null;
  document.querySelectorAll("[data-node]").forEach(el => {
    el.onmousedown = e => {
      if (e.button !== 0) return;
      const i = +el.dataset.node;
      const tool = window.__bzTool || "select";
      if (tool === "connect") {
        if (window.__linkFrom == null) {
          window.__linkFrom = i;
          L.toast && L.toast("Agora clique no destino");
        } else if (window.__linkFrom !== i) {
          const from = draft.steps[window.__linkFrom];
          const to = draft.steps[i];
          draft.edges = draft.edges || [];
          if (from && to && !draft.edges.some(ed => ed.from === from.id && ed.to === to.id)) {
            let label = "";
            if (from.type === "gateway") {
              const branch = prompt("Rótulo desta saída (por exemplo, Sim ou Não):", "");
              if (branch === null) { window.__linkFrom = null; window.__bzTool = "select"; render(); return; }
              label = branch.trim();
            }
            draft.edges.push({ id: L.uid("e"), from: from.id, to: to.id, label });
          }
          window.__linkFrom = null;
          window.__bzTool = "select";
          selectedStepIdx = i;
          render();
        }
        e.preventDefault();
        return;
      }
      selectedStepIdx = i;
      document.querySelectorAll("[data-node].sel").forEach(node => node.classList.remove("sel"));
      el.classList.add("sel");
      drag = { i, sx: e.clientX, sy: e.clientY, ox: draft.steps[i].x, oy: draft.steps[i].y, moved: false, zoom: Math.max(0.5, Number(window.__bzZoom) || 1) };
      e.preventDefault();
    };
    el.ondblclick = e => {
      e.stopPropagation();
      const i = +el.dataset.node;
      const s = draft.steps[i];
      selectedStepIdx = i;
      if (!["start", "gateway", "end"].includes(s.type)) {
        wizStep = 2;
        render();
      } else {
        const n = prompt(s.type === "gateway" ? "Pergunta da decisão:" : "Nome do evento:", s.name || "");
        if (n != null && n.trim()) { s.name = n.trim(); render(); }
      }
    };
  });

  window.onmousemove = e => {
    if (!drag) return;
    const dx = (e.clientX - drag.sx) / drag.zoom, dy = (e.clientY - drag.sy) / drag.zoom;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    draft.steps[drag.i].x = Math.max(10, drag.ox + dx);
    draft.steps[drag.i].y = Math.max(10, drag.oy + dy);
    const node = document.querySelector(`[data-node="${drag.i}"]`);
    if (node) {
      node.style.left = draft.steps[drag.i].x + "px";
      node.style.top = draft.steps[drag.i].y + "px";
    }
  };
  window.onmouseup = () => {
    if (drag && drag.moved) {
      const moved = draft.steps[drag.i];
      if (moved) moved.laneId = laneForY(moved.y, true).id;
      render();
    }
    drag = null;
  };
  window.onkeydown = e => {
    if (wizStep !== 1 || !draft || !["Delete", "Backspace"].includes(e.key)) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (selectedStepIdx < 0 || !draft.steps[selectedStepIdx]) return;
    e.preventDefault();
    removeDiagramNode(selectedStepIdx);
  };

  // clique no texto do edge (se renderizado no DOM - SVG text may not bubble easily)
  // allow edit label: when node selected, show quick action - keyboard L
  document.querySelectorAll("text[data-ed]").forEach(t => {
    t.style.pointerEvents = "all";
    t.style.cursor = "pointer";
    t.onclick = ev => {
      ev.stopPropagation();
      const ei = +t.getAttribute("data-ed");
      const edge = draft.edges[ei];
      if (!edge) return;
      const lab = prompt("Texto da seta:", edge.label || "");
      if (lab != null) { edge.label = lab.trim(); render(); }
    };
  });
  document.querySelectorAll("path[data-ed]").forEach(path => {
    path.onclick = ev => {
      ev.stopPropagation();
      const edge = draft.edges[+path.dataset.ed];
      if (!edge) return;
      const label = prompt("Rótulo do fluxo:", edge.label || "");
      if (label != null) { edge.label = label.trim(); render(); }
    };
  });

  // atividades
  document.querySelectorAll("[data-sel-step]").forEach(b => {
    b.onclick = () => { collectAtividade(); selectedStepIdx = +b.dataset.selStep; render(); };
  });
  document.getElementById("btnAddAtiv") && (document.getElementById("btnAddAtiv").onclick = () => {
    collectAtividade();
    insertProcessActivity({
      id: L.uid("s"), name: "Nova atividade", ref: "NOVA_ATIV", type: "form", formId: draft.formId,
      assigneeType: "starter", actions: ["enviar"], description: "", prazoAlerta: "", prazoMax: "", script: "",
      x: 80 + draft.steps.length * 190, y: 100, laneId: draft.lanes[0].id
    });
    render();
  });
  document.getElementById("btnDelAtiv") && (document.getElementById("btnDelAtiv").onclick = () => {
    collectAtividade();
    removeDiagramNode(selectedStepIdx);
  });
  document.getElementById("sAssignType") && (document.getElementById("sAssignType").onchange = () => {
    collectAtividade();
    draft.steps[selectedStepIdx].assigneeType = document.getElementById("sAssignType").value;
    render();
  });
  document.getElementById("sType") && (document.getElementById("sType").onchange = () => {
    collectAtividade();
    const t = document.getElementById("sType").value;
    draft.steps[selectedStepIdx].type = t;
    if (t === "form") draft.steps[selectedStepIdx].actions = ["enviar"];
    if (t === "approve") draft.steps[selectedStepIdx].actions = ["aprovar", "devolver", "rejeitar"];
    if (t === "script") draft.steps[selectedStepIdx].actions = [];
    if (t === "end") draft.steps[selectedStepIdx].actions = [];
    render();
  });
  // campos
  document.getElementById("btnAddField") && (document.getElementById("btnAddField").onclick = () => openFieldModal(null));
  document.querySelectorAll("[data-add-section]").forEach(b => {
    b.onclick = () => openFieldModal(null, b.dataset.addSection);
  });
  document.getElementById("btnAddSection") && (document.getElementById("btnAddSection").onclick = () => {
    const name = prompt("Nome da seção:");
    if (!name) return;
    draft.form.push({ id: "TX_NOVO", label: "Novo campo", type: "text", required: false, section: name, active: true });
    render();
  });
  document.querySelectorAll("[data-edit-field]").forEach(b => {
    b.onclick = e => { e.stopPropagation(); openFieldModal(+b.dataset.editField); };
  });
  document.querySelectorAll("[data-del-field]").forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      draft.form.splice(+b.dataset.delField, 1);
      render();
    };
  });
  document.getElementById("btnPublish") && (document.getElementById("btnPublish").onclick = () => {
    collectProp(); persistDraft(true); mode = "list"; render();
  });
  document.getElementById("btnSaveOnly") && (document.getElementById("btnSaveOnly").onclick = () => {
    collectProp(); persistDraft(false); alert("Rascunho salvo.");
  });
}

function openFieldModal(idx, section) {
  const isNew = idx === null || idx === undefined;
  const f = isNew
    ? { id: "TX_CAMPO", label: "Novo campo", type: "text", required: false, section: section || "Geral", active: true, options: [], vis: {} }
    : { ...draft.form[idx], vis: { ...(draft.form[idx].vis || {}) } };

  // default vis: first form step = normal, others = oculto (LECOM style)
  const formSteps = draft.steps.filter(s => s.type === "form" || s.type === "approve");
  formSteps.forEach((s, i) => {
    if (f.vis[s.id] == null) {
      f.vis[s.id] = (i === 0 && isNew) ? "normal" : (isNew ? "oculto" : "oculto");
    }
  });
  // if editing and no vis for a step, default oculto except if field has no vis at all use normal on first
  if (!isNew) {
    formSteps.forEach((s, i) => {
      if (f.vis[s.id] == null) f.vis[s.id] = "oculto";
    });
  }

  const presOpts = (cur) => `
    <option value="oculto" ${cur==="oculto"?"selected":""}>Oculto</option>
    <option value="normal" ${cur==="normal"?"selected":""}>Normal</option>
    <option value="leitura" ${cur==="leitura"?"selected":""}>Somente leitura</option>`;

  const rows = formSteps.map(s => `
    <tr class="border-b border-neutral-100">
      <td class="px-3 py-2 text-sm font-medium text-neutral-700">${L.esc(s.name)}</td>
      <td class="px-2 py-1.5">
        <select class="mf-vis border border-neutral-300 rounded px-2 py-1 text-sm w-full" data-step="${s.id}">
          ${presOpts(f.vis[s.id] || "oculto")}
        </select>
      </td>
      <td class="px-2 py-1.5">
        <select class="mf-init border border-neutral-300 rounded px-2 py-1 text-sm w-full" data-step="${s.id}">
          <option value="none" ${(f.init||{})[s.id]==="none"||!(f.init||{})[s.id]?"selected":""}>Sem valor inicial</option>
          <option value="fixed" ${(f.init||{})[s.id]==="fixed"?"selected":""}>Valor fixo</option>
        </select>
      </td>
      <td class="px-2 py-1.5">
        <input class="mf-initval border border-neutral-300 rounded px-2 py-1 text-sm w-full" data-step="${s.id}"
          value="${L.esc(((f.initVal||{})[s.id])||"")}" placeholder="Valor inicial"/>
      </td>
    </tr>`).join("");

  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50";
  overlay.innerHTML = `
    <div class="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
      <div class="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-[#f7f8fa] rounded-t-lg">
        <h3 class="font-semibold text-violet-900 text-sm">Propriedades do campo <span class="font-mono text-violet-700">${L.esc(f.id)}</span> nas atividades</h3>
        <button id="mfCancel" class="text-neutral-400 hover:text-neutral-700"><i class="fas fa-times"></i></button>
      </div>
      <div class="overflow-y-auto flex-1 p-4 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><label class="text-xs text-neutral-500">ID técnico *</label>
            <input id="mfId" value="${L.esc(f.id)}" class="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1.5 font-mono text-sm"/></div>
          <div><label class="text-xs text-neutral-500">Rótulo *</label>
            <input id="mfLabel" value="${L.esc(f.label)}" class="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"/></div>
          <div><label class="text-xs text-neutral-500">Tipo</label>
            <select id="mfType" class="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1.5 text-sm">
              <option value="text" ${f.type==="text"?"selected":""}>Linha de texto</option>
              <option value="textarea" ${f.type==="textarea"?"selected":""}>Texto longo</option>
              <option value="number" ${f.type==="number"?"selected":""}>Inteiro</option>
              <option value="date" ${f.type==="date"?"selected":""}>Data</option>
              <option value="select" ${f.type==="select"?"selected":""}>Lista</option>
            </select></div>
          <div><label class="text-xs text-neutral-500">Seção</label>
            <input id="mfSec" value="${L.esc(f.section||"Geral")}" class="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"/></div>
        </div>
        <div id="mfOptWrap" class="${f.type!=="select"?"hidden":""}">
          <label class="text-xs text-neutral-500">Opções da lista (vírgula)</label>
          <input id="mfOpt" value="${L.esc((f.options||[]).join(", "))}" class="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"/>
        </div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="mfReq" ${f.required?"checked":""}/> Obrigatório (quando visível e editável)</label>

        <div class="border border-neutral-200 rounded-lg overflow-hidden">
          <div class="px-3 py-2 bg-violet-700 text-white text-xs font-semibold flex items-center gap-2">
            <i class="fas fa-eye"></i> Apresentação por atividade
            <span class="font-normal opacity-80 ml-1">— onde o campo aparece em cada formulário</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left min-w-[560px]">
              <thead>
                <tr class="bg-[#f0f1f3] text-[11px] uppercase text-neutral-500 border-b">
                  <th class="px-3 py-2 font-medium">Atividade</th>
                  <th class="px-2 py-2 font-medium w-36">Apresentação</th>
                  <th class="px-2 py-2 font-medium w-36">Inicialização</th>
                  <th class="px-2 py-2 font-medium">Valor inicial</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="4" class="px-3 py-6 text-center text-sm text-neutral-400">Crie atividades (formulário/aprovação) no Diagrama antes.</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="px-3 py-2 bg-neutral-50 border-t text-[11px] text-neutral-500 flex flex-wrap gap-3">
            <span><strong>Oculto</strong> — não aparece</span>
            <span><strong>Normal</strong> — editável</span>
            <span><strong>Somente leitura</strong> — visível, não edita</span>
            <button type="button" id="mfApplyAll" class="ml-auto text-violet-700 hover:underline">Aplicar 1ª linha a todos</button>
          </div>
        </div>
      </div>
      <div class="px-4 py-3 border-t border-neutral-200 flex justify-end gap-2 bg-[#f7f8fa] rounded-b-lg">
        <button id="mfCancel2" class="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-white">Cancelar</button>
        <button id="mfOk" class="px-4 py-1.5 text-sm bg-violet-700 text-white rounded hover:bg-violet-800 font-medium"><i class="fas fa-save mr-1"></i>Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector("#mfType").onchange = e => {
    overlay.querySelector("#mfOptWrap").classList.toggle("hidden", e.target.value !== "select");
  };
  const close = () => overlay.remove();
  overlay.querySelector("#mfCancel").onclick = close;
  overlay.querySelector("#mfCancel2").onclick = close;
  overlay.querySelector("#mfApplyAll") && (overlay.querySelector("#mfApplyAll").onclick = () => {
    const first = overlay.querySelector(".mf-vis");
    if (!first) return;
    const v = first.value;
    overlay.querySelectorAll(".mf-vis").forEach(sel => { sel.value = v; });
  });
  overlay.querySelector("#mfOk").onclick = () => {
    const vis = {};
    const init = {};
    const initVal = {};
    overlay.querySelectorAll(".mf-vis").forEach(sel => { vis[sel.dataset.step] = sel.value; });
    overlay.querySelectorAll(".mf-init").forEach(sel => { init[sel.dataset.step] = sel.value; });
    overlay.querySelectorAll(".mf-initval").forEach(inp => { initVal[inp.dataset.step] = inp.value; });
    const data = {
      id: overlay.querySelector("#mfId").value.trim().toUpperCase().replace(/\s/g, "_") || "TX_CAMPO",
      label: overlay.querySelector("#mfLabel").value.trim() || "Campo",
      type: overlay.querySelector("#mfType").value,
      section: overlay.querySelector("#mfSec").value.trim() || "Geral",
      required: overlay.querySelector("#mfReq").checked,
      active: true,
      options: (overlay.querySelector("#mfOpt")?.value || "").split(",").map(x => x.trim()).filter(Boolean),
      vis,
      init,
      initVal
    };
    if (isNew) draft.form.push(data);
    else draft.form[idx] = data;
    overlay.remove();
    render();
  };
}

render();
