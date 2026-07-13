# NPC & CAP — The Rookery 🐧

An interactive, AI-enabled 3D stage for two penguin personas:

- **NPC** — *Non-Playable Character. Allegedly.* Stoic, goes with the flow, and lands
  perfectly timed, slightly sarcastic one-liners that are secretly the wisest thing in
  the room.
- **CAP** — *Captain of his own story.* Intentional, engaging, inspirational — a
  dialectic companion who challenges your thinking toward success and usually ends
  with a question or a small concrete challenge.

Both are fully rigged, animated **living sketches** — layered pencil-style SVG
puppets faithful to the original concept art (graphite strokes, hatch shading,
cream paper), with a boiling-line effect that re-jitters the linework like
hand-drawn pencil animation. No external assets, no 3D engine.

## Features

- **Sketchbook stage** — the penguins live on cream paper with idle/waddle/wave/
  laugh/think/shrug/excited animations, blinking, talking beaks, and speech
  bubbles pinned above their heads.
- **AI brain** — pick a provider in *Settings* (Anthropic or Groq), paste your API
  key, and choose from recommended models. The penguins respond in-persona, drawing
  on their editable backstories and memories; replies start with an emote tag
  (`[wave]`, `[think]`, …) that drives their animation. Without a key, a built-in
  scripted personality engine keeps the page fully working.
- **Phone-friendly** — on small screens only the penguin you're talking to takes
  the stage (both appear in "Both" mode or during banter), with a compact layout.
- **Character Studio** — edit each penguin's name, tagline, personality, backstory,
  and key memories. Everything persists in your browser; export/import as JSON.
- **Duo mode** — talk to *Both*, or hit *“Let them chat”* and watch NPC & CAP riff
  with each other (AI-driven when a key is set, scripted otherwise).
- **Character sheet export** — one click renders a full model sheet per character
  (front/side/back turnaround, 8 poses, 8 expression close-ups) as a PNG for
  thumbnails, posts, and your site — in the same format as the original concept
  sheet. Click any cell to download that single render as a transparent
  1024×1024 PNG.

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

1. Get an API key: [console.anthropic.com](https://console.anthropic.com) (Claude)
   or [console.groq.com](https://console.groq.com) (Groq — has a free tier, handy
   for initial testing).
2. Open **Settings**, pick the provider, paste the key, pick a model (the
   recommended one is preselected), **Save**, then **Test connection**.
3. Keys are stored only in your browser's localStorage and sent only to the chosen
   provider's API. Don't use a shared/production key on a public computer.

## Bonus: local app controller

The `controller/` folder contains **Iceberg Control Tower** — a standalone,
dependency-free dashboard for the *other* local web apps you run on your own
machine: it shows each app's status and lets you start/stop/restart them and
tail their logs from one page. It's unrelated to the penguins; see
[`controller/README.md`](controller/README.md).

## Project layout

```
index.html            page shell + tabs (Stage / Characters / Sheet / Settings)
css/style.css         all styling incl. the paper stage
js/sketch-penguin.js  pencil-style SVG puppets: drawing, rig, expressions, poses, FSM
js/brain.js           Claude API client, system-prompt builder, scripted fallback
js/sheet.js           character-sheet renderer/exporter (SVG → PNG)
js/app.js             stage, chat orchestration, editors, UI wiring
data/personas.js      default character minds + localStorage persistence
```
