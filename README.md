# NPC & CAP — The Rookery 🐧

An interactive, AI-enabled 3D stage for two penguin personas:

- **NPC** — *Non-Playable Character. Allegedly.* Stoic, goes with the flow, and lands
  perfectly timed, slightly sarcastic one-liners that are secretly the wisest thing in
  the room.
- **CAP** — *Captain of his own story.* Intentional, engaging, inspirational — a
  dialectic companion who challenges your thinking toward success and usually ends
  with a question or a small concrete challenge.

Both are fully rigged, animated, real-time 3D characters (procedural toon shading,
no external assets) who chat with you — and with each other.

## Features

- **3D stage** — cel-shaded penguins with seamless idle/waddle/wave/laugh/think/
  shrug/excited animations, blinking, talking beaks, and speech bubbles pinned above
  their heads. Drag to orbit, scroll to zoom.
- **AI brain** — add your Anthropic API key in *Settings* and the penguins respond
  in-persona via Claude, drawing on their editable backstories and memories. Replies
  start with an emote tag (`[wave]`, `[think]`, …) that drives their animation.
  Without a key, a built-in scripted personality engine keeps the page fully working.
- **Character Studio** — edit each penguin's name, tagline, personality, backstory,
  and key memories. Everything persists in your browser; export/import as JSON.
- **Duo mode** — talk to *Both*, or hit *“Let them chat”* and watch NPC & CAP riff
  with each other (AI-driven when a key is set, scripted otherwise).
- **Character sheet export** — one click renders a full model sheet per character
  (turnaround views, 8 poses, 8 expression close-ups) as a PNG for thumbnails,
  posts, and your site. Click any cell to download that single render as a
  transparent 1024×1024 PNG.

## Run it

It's a fully static site — no build step.

**Locally:**

```bash
python3 -m http.server 8080   # or any static server
# open http://localhost:8080
```

(Opening `index.html` directly from disk won't work — ES modules need a server.)

**Publish on GitHub Pages:**

1. Merge this branch to `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) deploys on every push to
   `main`. Your page appears at `https://<user>.github.io/<repo>/`.

## Using the AI mode

1. Get an API key at [console.anthropic.com](https://console.anthropic.com).
2. Open **Settings**, paste the key, pick a model, **Save**, then **Test connection**.
3. The key is stored only in your browser's localStorage and is sent only to
   `api.anthropic.com` (using Anthropic's CORS-enabled direct browser access).
   Don't use a shared/production key on a public computer.

## Project layout

```
index.html            page shell + tabs (Stage / Characters / Sheet / Settings)
css/style.css         all styling
js/three.module.min.js  vendored Three.js r160
js/penguin.js         procedural penguin builder, expressions, poses, animation FSM
js/brain.js           Claude API client, system-prompt builder, scripted fallback
js/sheet.js           character-sheet renderer/exporter
js/app.js             scene, chat orchestration, editors, UI wiring
data/personas.js      default character minds + localStorage persistence
```
