# Orbit AI

Landing page e workspace de inteligência artificial feitos em HTML, CSS e JavaScript puro, usando a API da [Groq](https://groq.com).

## Experiência

- `index.html` redireciona para a landing page do Orbit
- `main/landing.html` é a página pública com animações GSAP e apresentação do produto
- `main/index.html` é o workspace completo com chat, agentes, visão, voz, tarefas, GitHub e configurações

## Modelos disponíveis

### OpenAI
- `openai/gpt-oss-120b` (padrão)
- `openai/gpt-oss-20b`
- `openai/gpt-oss-safeguard-20b`

### Alibaba Cloud
- `qwen/qwen3.8-27b`

### Canopy Labs
- `canopylabs/orpheus-v1-english`
- `canopylabs/orpheus-arabic-saudi`

### Meta (Guard)
- `meta-llama/llama-prompt-guard-2-22m`
- `meta-llama/llama-prompt-guard-2-86m`

## Como usar

1. Abra o `index.html` ou ative o GitHub Pages
2. Cole sua chave da Groq e clique em **Salvar**
3. Escolha o modelo e converse

A resposta aparece em **streaming** (tempo real). A chave é usada somente no navegador e não deve ser exposta em um site público.

## Ativar GitHub Pages

1. Settings → Pages
2. Source: branch `main`
3. Aguarde alguns minutos
4. Acesse: `https://vidaaal.github.io/chat-ia-groq/`

---

Feito com ❤️