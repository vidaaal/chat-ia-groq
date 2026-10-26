/**
 * Mini LECOM — servidor Node.js puro (sem dependências npm)
 * Serve o frontend e API REST com persistência em data/db.json
 *
 * Uso:  node server.js
 * URL:  http://localhost:3000/workspace.html
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
// Frontend: prefer public/, senão a raiz do projeto (clone incompleto do GitHub)
const PUBLIC_CANDIDATES = [
  path.join(ROOT, "public"),
  ROOT
];
function resolvePublic() {
  for (const dir of PUBLIC_CANDIDATES) {
    if (fs.existsSync(path.join(dir, "workspace.html")) || fs.existsSync(path.join(dir, "index.html"))) {
      return dir;
    }
  }
  return path.join(ROOT, "public");
}
const PUBLIC = resolvePublic();
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
/** Se definido, exige header X-API-Key ou ?key= nas rotas de escrita e GET /api/db */
const API_KEY = process.env.API_KEY || "";
const DEMO_OPEN = process.env.DEMO_OPEN !== "0"; // demo local aberta por padrão

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json"
};

const DEFAULT_DB = {
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
  currentUserId: "u1",
  nextProcCode: 1
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function writeDb(db) {
  ensureDb();
  const payload = JSON.stringify(db, null, 2);
  const tmp = DB_PATH + ".tmp";
  const bak = DB_PATH + ".bak";
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, bak);
    }
  } catch (_) {}
  fs.writeFileSync(tmp, payload, "utf8");
  fs.renameSync(tmp, DB_PATH);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "workspace.html" : pathname.replace(/^\/+/, "");
  let filePath = path.normalize(path.join(PUBLIC, rel));
  if (!filePath.startsWith(path.normalize(PUBLIC))) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // tenta na raiz do projeto
      const alt = path.normalize(path.join(ROOT, rel));
      if (alt.startsWith(path.normalize(ROOT)) && fs.existsSync(alt) && fs.statSync(alt).isFile()) {
        data = fs.readFileSync(alt);
        filePath = alt;
      } else {
        const hint = [
          "Not Found: " + pathname,
          "",
          "Pasta de frontend em uso: " + PUBLIC,
          "Arquivos esperados: workspace.html, studio.html, lecom-core.js, ...",
          "",
          "Se clonou do GitHub, extraia o mini-lecom.zip por cima da pasta",
          "ou baixe a pasta public/ completa.",
          "",
          "URLs corretas:",
          "  http://localhost:" + PORT + "/workspace.html",
          "  http://localhost:" + PORT + "/index.html",
          "  http://localhost:" + PORT + "/api/health"
        ].join("\n");
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end(hint);
      }
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}


function checkApiAuth(req, res, pathname) {
  // Leitura de health sempre livre
  if (pathname === "/api/health") return true;
  // Sem API_KEY: modo demo local (aviso no log na subida)
  if (!API_KEY) {
    if (!DEMO_OPEN && req.method !== "GET") {
      sendJson(res, 401, { error: "API_KEY não configurada e DEMO_OPEN=0" });
      return false;
    }
    return true;
  }
  const hdr = req.headers["x-api-key"] || "";
  const url = new URL(req.url || "/", "http://localhost");
  const q = url.searchParams.get("key") || "";
  if (hdr === API_KEY || q === API_KEY) return true;
  sendJson(res, 401, { error: "Não autorizado. Envie X-API-Key." });
  return false;
}

async function handleApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key"
    });
    return res.end();
  }

  if (!checkApiAuth(req, res, pathname)) return;

  if (pathname === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, name: "mini-lecom", runtime: "node" });
  }

  if (pathname === "/api/db" && req.method === "GET") {
    return sendJson(res, 200, readDb());
  }

  if (pathname === "/api/db" && req.method === "PUT") {
    try {
      const body = await readBody(req);
      if (!body || typeof body !== "object") return sendJson(res, 400, { error: "Body inválido" });
      const current = readDb();
      const next = {
        users: body.users ?? current.users,
        groups: body.groups ?? current.groups,
        processes: body.processes ?? current.processes,
        instances: body.instances ?? current.instances,
        audit: body.audit ?? current.audit,
        currentUserId: body.currentUserId ?? current.currentUserId,
        nextProcCode: body.nextProcCode ?? current.nextProcCode
      };
      writeDb(next);
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 400, { error: "JSON inválido" });
    }
  }

  if (pathname === "/api/users" && req.method === "GET") return sendJson(res, 200, readDb().users);
  if (pathname === "/api/groups" && req.method === "GET") return sendJson(res, 200, readDb().groups);
  if (pathname === "/api/processes" && req.method === "GET") return sendJson(res, 200, readDb().processes);
  if (pathname === "/api/instances" && req.method === "GET") return sendJson(res, 200, readDb().instances);

  if (pathname === "/api/processes" && req.method === "POST") {
    try {
      const proc = await readBody(req);
      if (!proc || !proc.id) return sendJson(res, 400, { error: "processo inválido" });
      const db = readDb();
      const i = db.processes.findIndex((p) => p.id === proc.id);
      if (i >= 0) db.processes[i] = proc;
      else db.processes.push(proc);
      writeDb(db);
      return sendJson(res, 200, proc);
    } catch {
      return sendJson(res, 400, { error: "JSON inválido" });
    }
  }

  if (pathname === "/api/instances" && req.method === "POST") {
    try {
      const inst = await readBody(req);
      if (!inst || !inst.id) return sendJson(res, 400, { error: "instância inválida" });
      const db = readDb();
      const i = db.instances.findIndex((x) => x.id === inst.id);
      if (i >= 0) db.instances[i] = inst;
      else db.instances.unshift(inst);
      writeDb(db);
      return sendJson(res, 200, inst);
    } catch {
      return sendJson(res, 400, { error: "JSON inválido" });
    }
  }

  const instMatch = pathname.match(/^\/api\/instances\/([^/]+)$/);
  if (instMatch && req.method === "PATCH") {
    try {
      const body = await readBody(req);
      const db = readDb();
      const i = db.instances.findIndex((x) => x.id === instMatch[1]);
      if (i < 0) return sendJson(res, 404, { error: "não encontrada" });
      db.instances[i] = { ...db.instances[i], ...body };
      writeDb(db);
      return sendJson(res, 200, db.instances[i]);
    } catch {
      return sendJson(res, 400, { error: "JSON inválido" });
    }
  }

  sendJson(res, 404, { error: "API not found" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    return handleApi(req, res, pathname);
  }

  serveStatic(req, res, pathname);
});

ensureDb();
server.listen(PORT, () => {
  console.log("");
  console.log("  Mini LECOM (Node.js — zero deps)");
  console.log("  → static  " + PUBLIC);
  console.log("  → Workspace http://localhost:" + PORT + "/workspace.html");
  console.log("  → Atividades http://localhost:" + PORT + "/index.html");
  console.log("  → API       http://localhost:" + PORT + "/api/health");
  if (API_KEY) console.log("  → Auth     API_KEY ativo (header X-API-Key)");
  else console.log("  → Auth     DEMO aberta (defina API_KEY para proteger a API)");
  console.log("");
});
