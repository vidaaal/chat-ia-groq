# Mini LECOM (Node.js)

MVP inspirado na plataforma **LECOM** + **Controle pessoal de atividades**.

Stack: **Node.js nativo** (`http` / `fs` / `path`). **Sem Python. Sem `npm install`.**

## Execução

```bash
node server.js
# ou: npm start
```

| URL | App |
|-----|-----|
| http://localhost:3000/workspace.html | **Mini LECOM** (oficial) — processos, caixa de entrada |
| http://localhost:3000/studio.html | Studio — diagrama, atividades, campos |
| http://localhost:3000/admin.html | Pessoas e grupos |
| http://localhost:3000/analises.html | Indicadores |
| http://localhost:3000/index.html | Controle pessoal de atividades (Kanban, calendário) |

Porta: `PORT=3456 node server.js`

## Segurança (demo)

Por padrão a API fica **aberta** (uso local).

Para exigir chave:

```bash
API_KEY=minha-chave-secreta node server.js
```

Envie header `X-API-Key: minha-chave-secreta` (ou `?key=`) nas chamadas à API.

**Não exponha este servidor na internet sem autenticação real (sessão/SSO).** O seletor de usuário na UI **não** é autenticação.

## Persistência

- Estado LECOM: `data/db.json` (gravação **atômica** + `db.json.bak`)
- Cache no navegador: `localStorage` (fallback offline)
- Controle de atividades: só `localStorage` no browser

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health |
| GET/PUT | `/api/db` | Estado completo |
| GET | `/api/users` ` /processes` `/instances` | Listas |
| POST | `/api/processes` `/instances` | Upsert |

## Apps no mesmo projeto

1. **Mini LECOM (oficial):** `workspace.html` + `studio.html` + `lecom-core.js` + API
2. **Controle de atividades:** `index.html` + `app.js` (uso pessoal)
3. **Legado:** `processo.html` redireciona para o Workspace — não use

## Documentação extra

- `docs/DEVOLUTIVA_ANALISE.md` — análise de riscos e melhorias
- `docs/IDEIAS_FUNCOES_SERVICOS_AUTOMACAO_INOVACAO.md` — roadmap de funções, serviços e automação

## Estrutura

```
mini-lecom/
├── server.js
├── package.json
├── data/           # db.json (gerado)
├── docs/
└── public/
    ├── workspace.html / workspace.js
    ├── studio.html / studio.js
    ├── lecom-core.js
    ├── index.html / app.js
    └── ...
```

Protótipo de estudo — não é o produto LECOM oficial.
