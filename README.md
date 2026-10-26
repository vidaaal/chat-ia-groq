# Chat IA · Groq

Chat de inteligência artificial simples feito em HTML + JavaScript puro, usando a API da [Groq](https://groq.com).

**Modelo atual:** `openai/gpt-oss-120b`

## Como usar

1. Abra o arquivo `index.html` no navegador **ou** acesse a versão online (se você ativar o GitHub Pages).
2. Cole sua chave de API da Groq no campo no topo.
3. Clique em **Salvar chave** (ela fica salva só no seu navegador).
4. Comece a conversar!

A resposta aparece **em tempo real** (streaming).

## Como pegar a chave da Groq

1. Acesse [console.groq.com](https://console.groq.com)
2. Crie uma conta / faça login
3. Vá em **API Keys** e gere uma nova chave

## Observação de segurança

A chave de API fica **apenas no seu navegador** (localStorage). Ela nunca é enviada para nenhum servidor além da própria Groq.

> **Atenção**: Como a chave fica no frontend, não use este projeto em sites públicos com muita gente. É ideal para uso pessoal.

## Ativar GitHub Pages (opcional)

1. Vá em **Settings** → **Pages**
2. Em **Source**, escolha a branch `main`
3. Salve
4. Depois de alguns minutos o site ficará disponível em:
   `https://vidaaal.github.io/chat-ia-groq/`

---

Feito com ❤️