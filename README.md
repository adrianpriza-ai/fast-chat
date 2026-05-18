<div align="center">
  <img src="fast-chat.svg" width="80">
  
  # fast-chat
</div>

A lightweight, single-file AI chat interface. No server, no build step, no tracking — just visit **[fastchat-ai.pages.dev](https://fastchat-ai.pages.dev)** in a browser.

<div align="center">
  <img src="https://adrianpriza-ai.github.io/fast-chat.png" alt="screenshot" height="450">
</div>

## Features

- **4 providers** — Groq, OpenRouter, Google Gemini, and Ollama (local)
- **Streaming responses** with live rendering
- **Markdown** — headings, tables, code blocks with syntax highlighting, math (KaTeX), blockquotes
- **Thinking blocks** — collapsible `<think>` sections for reasoning models
- **Image input** — attach images to your messages (vision models)
- **Multiple chat sessions** — up to 50, with rename, clone, and export
- **Dark / Light / System theme** — dark is properly dark, light is easy on the eyes
- **Customizable accent color**
- **System prompt** support
- **Export** chats as `.md` or `.txt`
- Zero dependencies to install — CDN assets only

## Getting Started

Visit **[fastchat-ai.pages.dev](https://fastchat-ai.pages.dev)** — no install, no signup, just open and chat.

Or self-host by cloning the repo and opening `index.html` in any browser.

### API Keys

Go to **Settings → API Keys** and paste your key for whichever provider you want to use.

| Provider | Where to get a key |
|---|---|
| Groq | [console.groq.com](https://console.groq.com) |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Ollama | No key needed — runs locally |

Keys can be saved to `localStorage` (persists across sessions) or kept in `sessionStorage` (cleared when the tab closes).

### Ollama (local)

Start Ollama with CORS enabled so the browser can reach it:

```bash
OLLAMA_ORIGINS=* ollama serve
```

Then in Settings → Model, select **Ollama**, enter your base URL (default `http://localhost:11434`), and click **Fetch models**.

## Image Assets

The following images are expected alongside `index.html`:

| File | Used for |
|---|---|
| `fast-chat.svg` | App icon / logo |
| `groq.png` | Groq provider button and topbar |
| `openrouter-dark.png` | OpenRouter logo (dark theme) |
| `openrouter-light.png` | OpenRouter logo (light theme) |
| `google.png` | Gemini provider button and topbar |
| `ollama-dark.png` | Ollama logo (dark theme) |
| `ollama-light.png` | Ollama logo (light theme) |

## Sessions

- A session is only created when you send your first message — no empty slots
- Every reload starts at a fresh new chat (previous chats are still in the sidebar)
- At 45 sessions a warning appears; at 50 the oldest is automatically removed

## License

MIT
