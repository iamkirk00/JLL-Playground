# Iceberg Control Tower 🧊

A single-file local controller for the web apps you run on your own machine
(HTML editor, AI video generation, pricing tool, WhisperFlow, …). It serves a
dashboard that shows whether each app is up, and lets you **start / stop /
restart** them and tail their logs — from one page.

It has **no dependencies** beyond Python 3.8+ — no pip installs, no build.

> Why a script and not just a webpage? Browsers can't launch or kill
> processes on your machine. The controller is a tiny local server that does
> that on the dashboard's behalf — the page talks to it at
> `http://localhost:9500`.

## Quick start

1. Get this folder onto the machine where your apps live (clone the repo or
   copy the `controller/` folder — it's self-contained).
2. Edit **`apps.json`**: for each app set its real folder, start command, and
   port (see below). Remove the placeholder entries you don't need.
3. Run it:

   ```bash
   python3 controller.py        # Windows: py controller.py
   ```

4. Open **http://localhost:9500**.

## Configuring your apps (`apps.json`)

```jsonc
{
  "controller": { "host": "127.0.0.1", "port": 9500 },
  "apps": [
    {
      "id": "whisperflow",                    // required, unique, no spaces
      "name": "WhisperFlow",                  // shown on the card
      "description": "Whisper speech-to-text",
      "cwd": "~/projects/whisperflow",        // folder to start it from
      "startCommand": "python3 app.py",       // shell command that runs it
      "port": 5000,                           // used to detect "is it up?"
      "openUrl": "http://localhost:5000",     // the Open ↗ button
      "healthUrl": "http://localhost:5000/health",  // optional, beats port check
      "stopCommand": ""                       // optional, see below
    }
  ]
}
```

| Field | Required | Purpose |
|---|---|---|
| `id` | yes | Unique slug; also names the log file (`logs/<id>.log`). |
| `name`, `description` | no | Card title and subtitle. |
| `cwd` | no | Working directory for `startCommand` (`~` is expanded). |
| `startCommand` | yes* | Shell command that launches the app (*required to use Start). |
| `port` | no | Local port to probe for status detection. |
| `healthUrl` | no | URL to probe instead of the port (any response < 500 = healthy). |
| `openUrl` | no | Link for the **Open ↗** button. |
| `stopCommand` | no | Lets Stop work even for apps the controller didn't launch. |

## How status works

- **Running** — the controller launched it and its port/health URL answers.
- **Starting…** — launched, but the port isn't answering yet.
- **Running (external)** — something answers on the app's port, but the
  controller didn't launch it (e.g. you started it from a terminal). Stop is
  disabled unless you configure a `stopCommand`.
- **Stopped** — no managed process and nothing on the port. The last exit
  code is shown if the app crashed.

Stop sends a graceful terminate to the app's whole process tree, then
force-kills after ~8 s (`taskkill /T /F` on Windows).

## Good to know

- **Logs**: each app's stdout/stderr goes to `controller/logs/<id>.log`; the
  **Logs** button live-tails the last 200 lines.
- **Restarting the controller doesn't kill your apps** — they run in their own
  process group and simply show as *external* on the next run.
- **Security**: it binds to `127.0.0.1` only, so it's reachable just from the
  machine it runs on. Anyone who can reach the port can run the configured
  commands, so only use `--host 0.0.0.0` on a network you trust.
- Overrides: `--port 9600`, `--config /path/to/apps.json`.
- Start on login (optional): add `python3 /path/to/controller.py` to your OS
  startup items / Task Scheduler; the dashboard is then always available.
