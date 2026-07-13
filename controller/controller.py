#!/usr/bin/env python3
"""Iceberg Control Tower - a tiny local controller for your local web apps.

Reads apps.json (same folder, unless --config points elsewhere), serves a
dashboard, and starts/stops the configured apps on this machine.

    python3 controller.py                 # dashboard on http://localhost:9500
    python3 controller.py --port 9600
    python3 controller.py --config /path/to/apps.json

No dependencies beyond the Python 3.8+ standard library. Works on
Linux, macOS, and Windows (use `py controller.py` if `python3` is missing).
"""

import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import URLError
from urllib.request import urlopen

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")
IS_WINDOWS = os.name == "nt"

CONFIG = {"apps": []}
STATE = {}  # app id -> {"proc": Popen, "started": float}
STATE_LOCK = threading.Lock()


# ---------------------------------------------------------------- config ---

def load_config(path):
    try:
        with open(path, encoding="utf-8") as f:
            cfg = json.load(f)
    except OSError as exc:
        sys.exit(f"cannot read config {path}: {exc}")
    except json.JSONDecodeError as exc:
        sys.exit(f"{path} is not valid JSON: {exc}")
    apps = cfg.get("apps", [])
    ids = [a.get("id") for a in apps]
    if not all(ids):
        sys.exit("apps.json: every app needs an 'id'")
    if len(ids) != len(set(ids)):
        sys.exit("apps.json: duplicate app ids")
    return cfg


def find_app(app_id):
    for app in CONFIG["apps"]:
        if app["id"] == app_id:
            return app
    return None


def log_path(app_id):
    return os.path.join(LOG_DIR, f"{app_id}.log")


# ---------------------------------------------------------------- status ---

def port_reachable(port, timeout=0.4):
    try:
        with socket.create_connection(("127.0.0.1", int(port)), timeout=timeout):
            return True
    except OSError:
        return False


def app_reachable(app):
    """True if the app answers on its healthUrl or port, False if not,
    None when the app has nothing configured to probe."""
    url = app.get("healthUrl")
    if url:
        try:
            with urlopen(url, timeout=1.0) as resp:
                return resp.status < 500
        except (URLError, OSError, ValueError):
            return False
    if app.get("port"):
        return port_reachable(app["port"])
    return None


def app_status(app):
    with STATE_LOCK:
        rec = STATE.get(app["id"])
    managed = bool(rec and rec["proc"].poll() is None)
    reachable = app_reachable(app)

    if managed:
        # 'starting' = process is up but the port isn't answering yet
        status = "running" if reachable in (True, None) else "starting"
    elif reachable:
        status = "external"  # answering on its port, but not launched by us
    else:
        status = "stopped"

    return {
        "id": app["id"],
        "name": app.get("name", app["id"]),
        "description": app.get("description", ""),
        "status": status,
        "reachable": reachable,
        "pid": rec["proc"].pid if managed else None,
        "uptime": round(time.time() - rec["started"]) if managed else None,
        "exitCode": rec["proc"].returncode if (rec and not managed) else None,
        "port": app.get("port"),
        "openUrl": app.get("openUrl"),
        "canStop": managed or bool(app.get("stopCommand")),
        "hasLog": os.path.exists(log_path(app["id"])),
    }


# --------------------------------------------------------------- actions ---

def start_app(app):
    st = app_status(app)
    if st["status"] in ("running", "starting"):
        return False, "already running (managed by this controller)"
    if st["status"] == "external":
        return False, "already running outside the controller"

    cmd = app.get("startCommand")
    if not cmd:
        return False, "no startCommand configured in apps.json"
    cwd = os.path.expanduser(app.get("cwd") or BASE_DIR)
    if not os.path.isdir(cwd):
        return False, f"working directory not found: {cwd}"

    os.makedirs(LOG_DIR, exist_ok=True)
    logf = open(log_path(app["id"]), "ab", buffering=0)
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    logf.write(f"\n----- started {stamp} -----\n".encode())

    kwargs = {}
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True  # own process group, survives us
    try:
        proc = subprocess.Popen(
            cmd, shell=True, cwd=cwd,
            stdout=logf, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
            **kwargs,
        )
    except OSError as exc:
        logf.close()
        return False, f"failed to launch: {exc}"

    with STATE_LOCK:
        STATE[app["id"]] = {"proc": proc, "started": time.time()}
    return True, f"started (pid {proc.pid})"


def stop_app(app):
    with STATE_LOCK:
        rec = STATE.get(app["id"])

    if rec and rec["proc"].poll() is None:
        proc = rec["proc"]
        if IS_WINDOWS:
            subprocess.run(
                ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                capture_output=True,
            )
        else:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
        for _ in range(40):  # give it ~8s to exit gracefully
            if proc.poll() is not None:
                break
            time.sleep(0.2)
        if proc.poll() is None and not IS_WINDOWS:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                return False, "process did not exit"
        return True, "stopped"

    if app.get("stopCommand"):
        cwd = os.path.expanduser(app.get("cwd") or BASE_DIR)
        subprocess.run(app["stopCommand"], shell=True, cwd=cwd, capture_output=True)
        return True, "stop command sent"

    return False, "not started by this controller and no stopCommand configured"


def tail(path, max_bytes=65536, lines=200):
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - max_bytes))
            data = f.read().decode("utf-8", "replace")
    except OSError:
        return ""
    return "\n".join(data.splitlines()[-lines:])


# ------------------------------------------------------------------ HTTP ---

class Handler(BaseHTTPRequestHandler):
    server_version = "IcebergControl/1.0"

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _not_found(self):
        self._json({"ok": False, "error": "not found"}, 404)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            try:
                with open(os.path.join(BASE_DIR, "index.html"), "rb") as f:
                    body = f.read()
            except OSError:
                return self._json({"ok": False, "error": "index.html missing"}, 500)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
        elif path == "/api/apps":
            self._json({"ok": True, "apps": [app_status(a) for a in CONFIG["apps"]]})
        elif path.startswith("/api/apps/") and path.endswith("/logs"):
            app_id = path[len("/api/apps/"):-len("/logs")]
            app = find_app(app_id)
            if not app:
                return self._not_found()
            self._json({"ok": True, "log": tail(log_path(app_id))})
        else:
            self._not_found()

    def do_POST(self):
        parts = self.path.strip("/").split("/")
        if len(parts) != 4 or parts[0] != "api" or parts[1] != "apps":
            return self._not_found()
        app, action = find_app(parts[2]), parts[3]
        if not app or action not in ("start", "stop", "restart"):
            return self._not_found()
        if action == "start":
            ok, msg = start_app(app)
        elif action == "stop":
            ok, msg = stop_app(app)
        else:
            stop_app(app)
            time.sleep(0.5)
            ok, msg = start_app(app)
        self._json({"ok": ok, "message": msg}, 200 if ok else 409)

    def log_message(self, fmt, *args):
        if self.command == "GET":  # keep dashboard polling out of the log
            return
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {self.command} {self.path}\n")


# ------------------------------------------------------------------ main ---

def main():
    global CONFIG
    ap = argparse.ArgumentParser(description="Iceberg Control Tower")
    ap.add_argument("--config", default=os.path.join(BASE_DIR, "apps.json"),
                    help="path to apps.json (default: next to this script)")
    ap.add_argument("--host", default=None, help="bind address (default 127.0.0.1)")
    ap.add_argument("--port", type=int, default=None, help="dashboard port (default 9500)")
    args = ap.parse_args()

    CONFIG = load_config(args.config)
    ctl = CONFIG.get("controller", {})
    host = args.host or ctl.get("host", "127.0.0.1")
    port = args.port or ctl.get("port", 9500)

    server = ThreadingHTTPServer((host, port), Handler)
    shown = "localhost" if host in ("127.0.0.1", "0.0.0.0") else host
    print(f"Iceberg Control Tower  ->  http://{shown}:{port}   ({len(CONFIG['apps'])} apps configured)")
    print("Ctrl+C stops the controller. Apps it started keep running and will "
          "show as 'external' next time it runs.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nController stopped.")


if __name__ == "__main__":
    main()
