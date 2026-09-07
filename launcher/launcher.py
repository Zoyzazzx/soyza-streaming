"""
SOYZA Streaming Launcher
========================
GUI launcher for all 4 services with persistent path configuration.

Config is stored in  config.json  next to the exe (or next to launcher.py
when running as a plain script).  On first launch the Settings screen opens
automatically so the user can point each service at the correct folder.
"""

import tkinter as tk
from tkinter import messagebox, scrolledtext, filedialog
import subprocess
import threading
import os
import sys
import ctypes
import time
import json
from datetime import datetime
import shutil

# ── Config file lives next to the exe (or script) — survives moves ────────────
if getattr(sys, "frozen", False):
    _EXE_DIR = os.path.dirname(sys.executable)
else:
    _EXE_DIR = os.path.dirname(os.path.abspath(__file__))

CONFIG_PATH = os.path.join(_EXE_DIR, "config.json")

# ── Service definitions ────────────────────────────────────────────────────────
SERVICE_DEFAULTS = [
    {
        "key":            "mediamtx",
        "name":           "MediaMTX",
        "subtitle":       "Streaming Server  ·  Ports 8888 / 8889 / 9997",
        "color":          "#6C63FF",
        "cmd":            ["mediamtx.exe"],
        "admin":          False,
        "hint":           "Folder that contains  mediamtx.exe",
        "default_subdir": "mediamtx",
        "kill_port":      1935,
    },
    {
        "key":            "monitor",
        "name":           "Python Monitor",
        "subtitle":       "Network Failover Monitor  ·  Requires Admin",
        "color":          "#FF6B6B",
        "cmd":            ["py", "monitor.py"],
        "admin":          True,
        "hint":           "Folder that contains  monitor.py",
        "default_subdir": "monitor",
    },
    {
        "key":            "upload_worker",
        "name":           "Upload Worker",
        "subtitle":       "Node.js Supabase Uploader",
        "color":          "#43D9AD",
        "cmd":            ["node", "worker.js"],
        "admin":          False,
        "hint":           "Folder that contains  worker.js",
        "default_subdir": "upload-worker",
    },
    {
        "key":            "dashboard",
        "name":           "Dashboard",
        "subtitle":       "Next.js Dev Server  ·  localhost:3000",
        "color":          "#F7B731",
        "cmd":            ["npm.cmd", "run", "dev"],
        "admin":          False,
        "hint":           "Folder that contains  package.json  (dashboard)",
        "default_subdir": "dashboard",
        "kill_port":      3000,   # kill any existing process on this port before starting
    },
]

# ── Colours ────────────────────────────────────────────────────────────────────
BG         = "#0D0F14"
PANEL      = "#13161E"
SURFACE    = "#1A1D28"
BORDER     = "#252836"
TEXT       = "#E8EAF0"
TEXT_DIM   = "#6B7280"
TEXT_MUTED = "#374151"
LOG_BG     = "#0A0C10"
LOG_FG     = "#A8B5C8"
SUCCESS    = "#43D9AD"
DANGER     = "#FF6B6B"
WARNING    = "#F7B731"
ACCENT     = "#6C63FF"

FONT_TITLE = ("Segoe UI", 13, "bold")
FONT_SUB   = ("Segoe UI", 9)
FONT_MONO  = ("Consolas", 9)
FONT_BTN   = ("Segoe UI", 9, "bold")
FONT_HEAD  = ("Segoe UI", 18, "bold")
FONT_SMALL = ("Segoe UI", 8)
FONT_LABEL = ("Segoe UI", 10, "bold")


# ── Helpers ────────────────────────────────────────────────────────────────────

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False


def relaunch_as_admin():
    script = os.path.abspath(sys.argv[0])
    params = " ".join(f'"{a}"' for a in sys.argv[1:])
    ctypes.windll.shell32.ShellExecuteW(
        None, "runas", sys.executable, f'"{script}" {params}', None, 1)
    sys.exit(0)


def ts():
    return datetime.now().strftime("%H:%M:%S")


def resolve_cmd(cmd: list, cwd: str) -> list:
    """
    If cmd[0] is a bare filename (no directory), check whether it exists
    inside the cwd and if so use the full path.  This handles e.g.
    mediamtx.exe which lives in the cwd but is NOT on %PATH%.
    """
    exe = cmd[0]
    
    # Check for local python virtual environment
    if exe in ("py", "python", "python3"):
        venv_py = os.path.join(cwd, "venv", "Scripts", "python.exe")
        if not os.path.exists(venv_py):
            venv_py = os.path.join(cwd, "venv", "bin", "python") # linux fallback
        if os.path.exists(venv_py):
            return [venv_py] + cmd[1:]

    if os.path.dirname(exe):          # already has a path component
        return cmd
    candidate = os.path.join(cwd, exe)
    if os.path.isfile(candidate):
        return [candidate] + cmd[1:]
    return cmd


def subprocess_env() -> dict:
    """Environment for child processes — forces UTF-8 I/O."""
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"]        = "1"
    env["PYTHONUNBUFFERED"]  = "1"
    return env


def kill_port_processes(port: int) -> list[int]:
    """
    Find every PID listening on *port* and kill it.
    Returns a list of PIDs that were killed.
    Uses netstat so it works without admin on most Windows setups.
    """
    killed = []
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        for line in result.stdout.splitlines():
            # Match lines like:  TCP  0.0.0.0:3000  ...  LISTENING  <pid>
            parts = line.split()
            if len(parts) < 5:
                continue
            addr = parts[1]          # e.g. 0.0.0.0:3000 or [::]:3000
            state = parts[3] if len(parts) >= 4 else ""
            pid_str = parts[-1]
            if not addr.endswith(f":{port}"):
                continue
            if "LISTENING" not in state:
                continue
            try:
                pid = int(pid_str)
            except ValueError:
                continue
            if pid in killed:
                continue
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/F"],
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            killed.append(pid)
    except Exception:
        pass
    return killed


# ── Config persistence ─────────────────────────────────────────────────────────

def load_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        return {}
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_config(cfg: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


def try_autodetect(cfg: dict) -> dict:
    parent      = os.path.dirname(_EXE_DIR)
    grandparent = os.path.dirname(parent)
    for svc in SERVICE_DEFAULTS:
        if svc["key"] in cfg:
            continue
        for root in [parent, grandparent, _EXE_DIR]:
            candidate = os.path.join(root, svc["default_subdir"])
            if os.path.isdir(candidate):
                cfg[svc["key"]] = candidate
                break
    return cfg


# ══════════════════════════════════════════════════════════════════════════════
class SettingsWindow(tk.Toplevel):
    """
    Modal settings window with a scrollable body so it works on any screen.
    Each service has:  colour dot + name, a hint, a typed entry, and Browse.
    """

    def __init__(self, parent, current_cfg: dict, on_save, first_run=False):
        super().__init__(parent)
        self.on_save     = on_save
        self.current_cfg = dict(current_cfg)
        self._entries: dict[str, tk.StringVar] = {}

        self.title("SOYZA Launcher — Settings")
        self.configure(bg=BG)
        self.resizable(True, True)
        self.grab_set()
        self.focus_set()

        self._build(first_run)
        self.update_idletasks()

        # Size: fixed wide enough for entries; height = content or 90% screen
        w = 780
        h = min(self.winfo_reqheight() + 40, int(self.winfo_screenheight() * 0.90))
        self.geometry(f"{w}x{h}")

        # Centre over parent
        pw, ph = parent.winfo_width(), parent.winfo_height()
        px, py = parent.winfo_rootx(), parent.winfo_rooty()
        self.geometry(f"+{px + max(0, (pw - w) // 2)}+{py + max(0, (ph - h) // 2)}")

    # ── Layout ───────────────────────────────────────────────────────────────

    def _build(self, first_run: bool):
        # ── Static header (never scrolls) ────────────────────────────────
        hdr = tk.Frame(self, bg=PANEL, pady=18, padx=28)
        hdr.pack(fill="x")

        tk.Label(hdr, text="  Service Paths",
                 font=("Segoe UI", 15, "bold"), fg=TEXT, bg=PANEL,
                 anchor="w").pack(fill="x")

        msg = (
            "First launch!  Set the working directory for each service below.\n"
            "Settings are saved to  config.json  next to the exe — they survive\n"
            "moving the launcher to a different PC."
            if first_run else
            "Set the working directory for each service.\n"
            "Settings are saved to  config.json  next to the launcher exe."
        )
        tk.Label(hdr, text=msg, font=FONT_SUB, fg=TEXT_DIM, bg=PANEL,
                 justify="left", anchor="w").pack(fill="x", pady=(6, 2))
        tk.Label(hdr, text=f"Config file:  {CONFIG_PATH}",
                 font=FONT_SMALL, fg=TEXT_MUTED, bg=PANEL, anchor="w").pack(fill="x")

        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")

        # ── Scrollable body ───────────────────────────────────────────────
        outer = tk.Frame(self, bg=BG)
        outer.pack(fill="both", expand=True)

        canvas = tk.Canvas(outer, bg=BG, highlightthickness=0, bd=0)
        scrollbar = tk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)

        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        body = tk.Frame(canvas, bg=BG)
        body_id = canvas.create_window((0, 0), window=body, anchor="nw")

        def _on_resize(event):
            canvas.itemconfig(body_id, width=event.width)
        canvas.bind("<Configure>", _on_resize)

        def _on_content_change(event=None):
            canvas.configure(scrollregion=canvas.bbox("all"))
        body.bind("<Configure>", _on_content_change)

        # Mouse-wheel scrolling
        def _on_wheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_wheel)

        # Build one row per service
        for i, svc in enumerate(SERVICE_DEFAULTS):
            self._build_row(body, svc, i, last=(i == len(SERVICE_DEFAULTS) - 1))

        # ── Static footer (never scrolls) ────────────────────────────────
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")

        footer = tk.Frame(self, bg=PANEL, pady=14, padx=28)
        footer.pack(fill="x")

        tk.Button(
            footer, text="  Save  ", font=FONT_BTN,
            bg=ACCENT, fg="white",
            activebackground="#5750D4", activeforeground="white",
            relief="flat", bd=0, padx=24, pady=9, cursor="hand2",
            command=self._save,
        ).pack(side="right", padx=(8, 0))

        if not first_run:
            tk.Button(
                footer, text="Cancel", font=FONT_BTN,
                bg=SURFACE, fg=TEXT_DIM,
                activebackground=BORDER, activeforeground=TEXT,
                relief="flat", bd=0, padx=20, pady=9, cursor="hand2",
                command=self.destroy,
            ).pack(side="right")

        tk.Label(
            footer,
            text="Tip: type a path directly or use Browse to pick a folder.",
            font=FONT_SMALL, fg=TEXT_MUTED, bg=PANEL,
        ).pack(side="left")

    def _build_row(self, parent, svc: dict, idx: int, last: bool):
        wrapper = tk.Frame(parent, bg=BG, padx=28, pady=16)
        wrapper.pack(fill="x")

        # ── Name row ─────────────────────────────────────────────────────
        name_row = tk.Frame(wrapper, bg=BG)
        name_row.pack(fill="x", pady=(0, 6))

        tk.Label(name_row, text="●", font=("Segoe UI", 12),
                 fg=svc["color"], bg=BG).pack(side="left", padx=(0, 8))
        tk.Label(name_row, text=svc["name"], font=FONT_LABEL,
                 fg=TEXT, bg=BG).pack(side="left")
        tk.Label(name_row, text=f"  {svc['hint']}",
                 font=FONT_SUB, fg=TEXT_DIM, bg=BG).pack(side="left")

        # ── Path entry + Browse button ────────────────────────────────────
        path_row = tk.Frame(wrapper, bg=BG)
        path_row.pack(fill="x")

        var = tk.StringVar(value=self.current_cfg.get(svc["key"], ""))
        self._entries[svc["key"]] = var

        # Entry field — expands to fill available width
        entry = tk.Entry(
            path_row,
            textvariable=var,
            font=FONT_MONO,
            bg=SURFACE, fg=TEXT,
            insertbackground=TEXT,
            relief="flat", bd=0,
            highlightbackground=BORDER,
            highlightthickness=1,
        )
        entry.pack(side="left", fill="x", expand=True, ipady=7, padx=(0, 10))

        tk.Button(
            path_row,
            text="  Browse…  ",
            font=FONT_BTN,
            bg=SURFACE, fg=TEXT_DIM,
            activebackground=BORDER, activeforeground=TEXT,
            relief="flat", bd=0,
            padx=14, pady=6,
            cursor="hand2",
            command=lambda v=var, s=svc: self._browse(v, s),
        ).pack(side="right")

        # Separator
        if not last:
            tk.Frame(wrapper, bg=BORDER, height=1).pack(fill="x", pady=(12, 0))

    def _browse(self, var: tk.StringVar, svc: dict):
        initial = var.get().strip()
        if not initial or not os.path.isdir(initial):
            initial = _EXE_DIR
        chosen = filedialog.askdirectory(
            parent=self,
            title=f"Select folder for  {svc['name']}",
            initialdir=initial,
        )
        if chosen:
            var.set(os.path.normpath(chosen))

    def _save(self):
        cfg    = {}
        errors = []
        for svc in SERVICE_DEFAULTS:
            path = self._entries[svc["key"]].get().strip()
            if not path:
                errors.append(f"• {svc['name']}: path is empty")
            elif not os.path.isdir(path):
                errors.append(f"• {svc['name']}: folder not found —\n    {path}")
            else:
                cfg[svc["key"]] = os.path.normpath(path)

        if errors:
            messagebox.showerror(
                "Invalid Paths",
                "Please fix the following:\n\n" + "\n".join(errors),
                parent=self,
            )
            return

        save_config(cfg)
        self.on_save(cfg)
        self.destroy()


# ══════════════════════════════════════════════════════════════════════════════
class ServicePanel(tk.Frame):
    """One log panel per service."""

    def __init__(self, parent, svc_def: dict, cwd: str, **kw):
        super().__init__(parent, bg=PANEL, **kw)
        self.svc_def  = svc_def
        self._cwd     = cwd
        self.process  = None
        self._running = False

        self._build_header()
        self._build_footer()
        self._build_log()

    # ── cwd property (panels update when config changes) ──────────────────

    @property
    def cwd(self):
        return self._cwd

    @cwd.setter
    def cwd(self, value):
        self._cwd = value
        if hasattr(self, "_path_lbl"):
            self._path_lbl.config(
                text=value if value else "(not configured — click  Settings)",
                fg="#4B5563" if value else DANGER,
            )

    # ── Build ─────────────────────────────────────────────────────────────

    def _build_header(self):
        s   = self.svc_def
        hdr = tk.Frame(self, bg=PANEL, pady=10, padx=14)
        hdr.pack(fill="x")

        tk.Frame(hdr, bg=s["color"], width=4).pack(side="left", fill="y", padx=(0, 12))

        info = tk.Frame(hdr, bg=PANEL)
        info.pack(side="left", fill="both", expand=True)

        tk.Label(info, text=s["name"], font=FONT_TITLE,
                 fg=TEXT, bg=PANEL, anchor="w").pack(fill="x")
        tk.Label(info, text=s["subtitle"], font=FONT_SUB,
                 fg=TEXT_DIM, bg=PANEL, anchor="w").pack(fill="x")

        # Path display row
        prow = tk.Frame(info, bg=PANEL)
        prow.pack(fill="x", pady=(3, 0))
        tk.Label(prow, text="dir:", font=FONT_SMALL,
                 fg=TEXT_MUTED, bg=PANEL).pack(side="left")
        self._path_lbl = tk.Label(
            prow,
            text=self._cwd if self._cwd else "(not configured — click  Settings)",
            font=FONT_SMALL,
            fg="#4B5563" if self._cwd else DANGER,
            bg=PANEL, anchor="w",
        )
        self._path_lbl.pack(side="left", padx=(4, 0))

        # Status (top-right)
        right = tk.Frame(hdr, bg=PANEL)
        right.pack(side="right")
        self.status_lbl = tk.Label(right, text="Stopped", font=FONT_SUB,
                                    fg=TEXT_MUTED, bg=PANEL, width=8, anchor="e")
        self.status_lbl.pack()
        self.status_dot = tk.Label(right, text="●", font=("Segoe UI", 14),
                                    fg=TEXT_MUTED, bg=PANEL)
        self.status_dot.pack()

        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")

    def _build_log(self):
        self.log_txt = scrolledtext.ScrolledText(
            self, bg=LOG_BG, fg=LOG_FG, font=FONT_MONO,
            insertbackground=TEXT, relief="flat", bd=0,
            padx=12, pady=8, state="disabled", wrap="word",
        )
        self.log_txt.pack(fill="both", expand=True)
        self.log_txt.tag_config("ts",      foreground="#4B5563")
        self.log_txt.tag_config("info",    foreground=LOG_FG)
        self.log_txt.tag_config("warn",    foreground=WARNING)
        self.log_txt.tag_config("error",   foreground=DANGER)
        self.log_txt.tag_config("success", foreground=SUCCESS)
        self.log_txt.tag_config("system",  foreground="#818CF8")

    def _build_footer(self):
        footer = tk.Frame(self, bg=PANEL, pady=9, padx=14)
        footer.pack(side="bottom", fill="x")
        tk.Frame(self, bg=BORDER, height=1).pack(side="bottom", fill="x")

        self.start_btn = tk.Button(
            footer, text="  Start  ", font=FONT_BTN,
            bg=self.svc_def["color"], fg="white",
            activebackground=self.svc_def["color"], activeforeground="white",
            relief="flat", bd=0, padx=14, pady=6, cursor="hand2",
            command=self.start,
        )
        self.start_btn.pack(side="left", padx=(0, 8))

        self.stop_btn = tk.Button(
            footer, text="  Stop  ", font=FONT_BTN,
            bg=SURFACE, fg=TEXT_DIM,
            activebackground=BORDER, activeforeground=TEXT,
            relief="flat", bd=0, padx=14, pady=6, cursor="hand2",
            command=self.stop, state="disabled",
        )
        self.stop_btn.pack(side="left")

        self.restart_btn = tk.Button(
            footer, text="  Restart  ", font=FONT_BTN,
            bg=SURFACE, fg=TEXT_DIM,
            activebackground=BORDER, activeforeground=TEXT,
            relief="flat", bd=0, padx=14, pady=6, cursor="hand2",
            command=self.restart, state="disabled",
        )
        self.restart_btn.pack(side="left", padx=(8, 0))

        tk.Button(
            footer, text="Clear", font=FONT_BTN,
            bg=SURFACE, fg=TEXT_DIM,
            activebackground=BORDER, activeforeground=TEXT,
            relief="flat", bd=0, padx=12, pady=6, cursor="hand2",
            command=self.clear_log,
        ).pack(side="right")

    # ── Logging ──────────────────────────────────────────────────────────

    def log(self, line: str, tag: str = "info"):
        def _w():
            self.log_txt.config(state="normal")
            self.log_txt.insert("end", f"[{ts()}] ", "ts")
            self.log_txt.insert("end", line + "\n", tag)
            self.log_txt.see("end")
            self.log_txt.config(state="disabled")
        self.after(0, _w)

    def clear_log(self):
        self.log_txt.config(state="normal")
        self.log_txt.delete("1.0", "end")
        self.log_txt.config(state="disabled")

    # ── Status ───────────────────────────────────────────────────────────

    def _set_status(self, running: bool):
        if running:
            self.status_dot.config(fg=SUCCESS)
            self.status_lbl.config(fg=SUCCESS, text="Running")
            self.start_btn.config(state="disabled", bg=BORDER, fg=TEXT_MUTED)
            self.stop_btn.config(state="normal", bg=DANGER, fg="white",
                                  activebackground="#C0392B")
            if hasattr(self, "restart_btn"):
                self.restart_btn.config(state="normal", bg=WARNING, fg="black", activebackground="#D49A29")
        else:
            self.status_dot.config(fg=TEXT_MUTED)
            self.status_lbl.config(fg=TEXT_MUTED, text="Stopped")
            self.start_btn.config(state="normal", bg=self.svc_def["color"], fg="white",
                                   activebackground=self.svc_def["color"])
            self.stop_btn.config(state="disabled", bg=SURFACE, fg=TEXT_DIM)
            if hasattr(self, "restart_btn"):
                self.restart_btn.config(state="disabled", bg=SURFACE, fg=TEXT_DIM)

    # ── Process control ──────────────────────────────────────────────────

    def start(self):
        if self._running:
            return
        s = self.svc_def

        if not self._cwd or not os.path.isdir(self._cwd):
            messagebox.showerror(
                "Path Not Set",
                f"'{s['name']}' has no valid working directory.\n\n"
                f"Current: {self._cwd or '(empty)'}\n\n"
                "Open  Settings  and set the correct folder.",
            )
            return

        if s["admin"] and not is_admin():
            if messagebox.askyesno(
                "Admin Required",
                f"'{s['name']}' needs Administrator privileges.\n\n"
                "Restart the launcher as Administrator?\n"
                "(You will need to restart all services.)",
                icon="warning",
            ):
                relaunch_as_admin()
            return

        # Kill any process holding the required port (e.g. port 3000 for Dashboard)
        kill_port = s.get("kill_port")
        if kill_port:
            pids = kill_port_processes(kill_port)
            if pids:
                self.log(
                    f"Killed {len(pids)} existing process(es) on port {kill_port} "
                    f"(PID{'s' if len(pids) > 1 else ''}: {', '.join(map(str, pids))})",
                    "warn",
                )
                time.sleep(0.8)   # give OS a moment to release the port
            else:
                self.log(f"Port {kill_port} is free.", "system")

        # Resolve cmd — if the exe is in the cwd, build the full path
        cmd = resolve_cmd(list(s["cmd"]), self._cwd)

        self.log(f"Starting {s['name']}...", "system")
        self.log(f"  dir : {self._cwd}", "system")
        self.log(f"  cmd : {' '.join(cmd)}", "system")

        try:
            self.process = subprocess.Popen(
                cmd,
                cwd=self._cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                env=subprocess_env(),
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except FileNotFoundError as e:
            self.log(f"ERROR: {e}", "error")
            self.log(f"Make sure  '{cmd[0]}'  is installed and on your PATH.", "warn")
            return
        except Exception as e:
            self.log(f"Failed to start: {e}", "error")
            return

        self._running = True
        self._set_status(True)
        threading.Thread(target=self._read_output, daemon=True).start()

    def _read_output(self):
        try:
            for raw in self.process.stdout:
                line = raw.rstrip()
                if not line:
                    continue
                ll = line.lower()
                if any(k in ll for k in ("error", "fatal", "exception", "failed", "err ")):
                    tag = "error"
                elif any(k in ll for k in ("warn", "warning")):
                    tag = "warn"
                elif any(k in ll for k in ("ready", "started", "connected", "success",
                                            "uploaded", "listening", "compiled",
                                            "localhost", "running")):
                    tag = "success"
                else:
                    tag = "info"
                self.log(line, tag)
        except Exception:
            pass

        rc = self.process.wait() if self.process else -1
        self._running = False
        self.process  = None
        self.log(f"Process exited (code {rc})", "warn" if rc != 0 else "system")
        self.after(0, lambda: self._set_status(False))

    def stop(self):
        if not self._running or self.process is None:
            return
        self.log("Stopping...", "system")
        try:
            # Tell the process to stop
            self.process.terminate()
            
            # If this service runs on a specific port (like Next.js on 3000),
            # forcefully kill anything on that port to ensure child processes die.
            kill_port = self.svc_def.get("kill_port")
            if kill_port:
                kill_port_processes(kill_port)
                
            threading.Thread(target=self._force_kill, daemon=True).start()
        except Exception as e:
            self.log(f"Stop error: {e}", "error")

    def _force_kill(self):
        time.sleep(5)
        if self.process and self.process.poll() is None:
            self.process.kill()
            self.log("Process force-killed.", "warn")

    def restart(self):
        if not self._running:
            return
        self.log("Restarting...", "system")
        def _wait_and_start():
            self.stop()
            while self._running:
                time.sleep(0.2)
            # Give OS a tiny moment to release any ports
            time.sleep(0.5)
            self.after(0, self.start)
        threading.Thread(target=_wait_and_start, daemon=True).start()

    @property
    def is_running(self):
        return self._running


# ══════════════════════════════════════════════════════════════════════════════
class SystemCheckWindow(tk.Toplevel):
    def __init__(self, parent, cfg: dict):
        super().__init__(parent)
        self.cfg = cfg
        self.title("System Check")
        self.configure(bg=BG)
        self.geometry("700x500")
        self.resizable(True, True)
        self.grab_set()
        self.focus_set()

        # Centre over parent
        pw, ph = parent.winfo_width(), parent.winfo_height()
        px, py = parent.winfo_rootx(), parent.winfo_rooty()
        self.geometry(f"+{px + max(0, (pw - 700) // 2)}+{py + max(0, (ph - 500) // 2)}")

        self._build_ui()
        threading.Thread(target=self._run_checks, daemon=True).start()

    def _build_ui(self):
        hdr = tk.Frame(self, bg=PANEL, pady=14, padx=20)
        hdr.pack(fill="x")
        tk.Label(hdr, text="  System Check", font=("Segoe UI", 15, "bold"), fg=TEXT, bg=PANEL, anchor="w").pack(fill="x")
        tk.Label(hdr, text="Verifying and fixing dependencies...", font=FONT_SUB, fg=TEXT_DIM, bg=PANEL, anchor="w").pack(fill="x", pady=(4, 0))

        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")

        self.log_txt = scrolledtext.ScrolledText(
            self, bg=LOG_BG, fg=LOG_FG, font=FONT_MONO,
            insertbackground=TEXT, relief="flat", bd=0,
            padx=12, pady=12, state="disabled", wrap="word"
        )
        self.log_txt.pack(fill="both", expand=True)
        
        self.log_txt.tag_config("info", foreground=LOG_FG)
        self.log_txt.tag_config("warn", foreground=WARNING)
        self.log_txt.tag_config("error", foreground=DANGER)
        self.log_txt.tag_config("success", foreground=SUCCESS)
        self.log_txt.tag_config("header", foreground="#818CF8", font=("Consolas", 10, "bold"))

        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        footer = tk.Frame(self, bg=PANEL, pady=10, padx=20)
        footer.pack(fill="x", side="bottom")

        self.close_btn = tk.Button(
            footer, text="  Close  ", font=FONT_BTN,
            bg=SURFACE, fg=TEXT_DIM,
            activebackground=BORDER, activeforeground=TEXT,
            relief="flat", bd=0, padx=14, pady=7, cursor="hand2",
            command=self.destroy, state="disabled"
        )
        self.close_btn.pack(side="right")

    def _log(self, text: str, tag: str = "info"):
        def _w():
            self.log_txt.config(state="normal")
            self.log_txt.insert("end", text + "\n", tag)
            self.log_txt.see("end")
            self.log_txt.config(state="disabled")
        self.after(0, _w)

    def _run_checks(self):
        self._log("=== Starting System Check ===", "header")
        
        all_passed = True
        
        # 1. Python check
        self._log("\nChecking Python...", "header")
        if shutil.which("python") or shutil.which("py"):
            self._log("✔ Python is installed.", "success")
        else:
            self._log("✘ Python not found. Please install Python and add it to PATH.", "error")
            all_passed = False

        # 2. Node check
        self._log("\nChecking Node.js...", "header")
        if shutil.which("node"):
            self._log("✔ Node.js is installed.", "success")
        else:
            self._log("✘ Node.js not found. Please install Node.js.", "error")
            all_passed = False

        # 3. FFmpeg check
        self._log("\nChecking FFmpeg...", "header")
        worker_path = self.cfg.get("upload_worker", "")
        if shutil.which("ffmpeg"):
            self._log("✔ FFmpeg is installed in PATH.", "success")
        elif worker_path and os.path.isfile(os.path.join(worker_path, "ffmpeg.exe")):
            self._log("✔ FFmpeg found in Upload Worker folder.", "success")
        else:
            self._log("✘ FFmpeg not found. Please install FFmpeg and add it to PATH, or place ffmpeg.exe in the upload-worker folder.", "error")
            all_passed = False

        # 4. MediaMTX check
        self._log("\nChecking MediaMTX...", "header")
        mtx_path = self.cfg.get("mediamtx", "")
        if not mtx_path or not os.path.isdir(mtx_path):
            self._log("✘ MediaMTX path not configured in Settings.", "error")
            all_passed = False
        else:
            if os.path.isfile(os.path.join(mtx_path, "mediamtx.exe")):
                self._log("✔ mediamtx.exe found.", "success")
            else:
                self._log(f"✘ mediamtx.exe not found in {mtx_path}. Please download it.", "error")
                all_passed = False

        # 5. Dashboard npm install
        self._log("\nChecking Dashboard dependencies...", "header")
        dash_path = self.cfg.get("dashboard", "")
        if dash_path and os.path.isdir(dash_path):
            if os.path.isdir(os.path.join(dash_path, "node_modules")):
                self._log("✔ Dashboard node_modules exist.", "success")
            else:
                self._log("Running npm install in Dashboard...", "warn")
                try:
                    # Windows specific npm command handling
                    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
                    subprocess.run([npm_cmd, "install"], cwd=dash_path, check=True, capture_output=True, env=subprocess_env())
                    self._log("✔ Dashboard dependencies installed.", "success")
                except Exception as e:
                    self._log(f"✘ Failed to install Dashboard dependencies: {e}", "error")
                    all_passed = False
        else:
            self._log("✘ Dashboard path not configured in Settings.", "error")
            all_passed = False

        # 6. Upload Worker npm install
        self._log("\nChecking Upload Worker dependencies...", "header")
        worker_path = self.cfg.get("upload_worker", "")
        if worker_path and os.path.isdir(worker_path):
            if os.path.isdir(os.path.join(worker_path, "node_modules")):
                self._log("✔ Upload Worker node_modules exist.", "success")
            else:
                self._log("Running npm install in Upload Worker...", "warn")
                try:
                    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
                    subprocess.run([npm_cmd, "install"], cwd=worker_path, check=True, capture_output=True, env=subprocess_env())
                    self._log("✔ Upload Worker dependencies installed.", "success")
                except Exception as e:
                    self._log(f"✘ Failed to install Upload Worker dependencies: {e}", "error")
                    all_passed = False
        else:
            self._log("✘ Upload Worker path not configured in Settings.", "error")
            all_passed = False

        # 7. Monitor venv
        self._log("\nChecking Monitor dependencies...", "header")
        mon_path = self.cfg.get("monitor", "")
        if mon_path and os.path.isdir(mon_path):
            venv_path = os.path.join(mon_path, "venv")
            if os.path.isdir(venv_path):
                self._log("✔ Monitor virtual environment exists.", "success")
            else:
                self._log("Creating virtual environment in Monitor...", "warn")
                try:
                    py_cmd = shutil.which("python") or shutil.which("py") or sys.executable
                    subprocess.run([py_cmd, "-m", "venv", "venv"], cwd=mon_path, check=True, capture_output=True, env=subprocess_env())
                    self._log("✔ Virtual environment created.", "success")
                    
                    req_path = os.path.join(mon_path, "requirements.txt")
                    if os.path.isfile(req_path):
                        self._log("Installing Monitor requirements...", "warn")
                        pip_exe = os.path.join(venv_path, "Scripts", "pip.exe")
                        if not os.path.exists(pip_exe):
                            pip_exe = os.path.join(venv_path, "bin", "pip") # fallback for non-windows
                        subprocess.run([pip_exe, "install", "-r", "requirements.txt"], cwd=mon_path, check=True, capture_output=True, env=subprocess_env())
                        self._log("✔ Monitor requirements installed.", "success")
                    else:
                        self._log("⚠ requirements.txt not found, skipping pip install.", "warn")
                except Exception as e:
                    self._log(f"✘ Failed to setup Monitor venv: {e}", "error")
                    all_passed = False
        else:
            self._log("✘ Monitor path not configured in Settings.", "error")
            all_passed = False

        self._log("\n=== System Check Complete ===", "header")
        if all_passed:
            self._log("All checks passed successfully!", "success")
        else:
            self._log("Some checks failed. Please review the errors above.", "error")

        self.after(0, lambda: self.close_btn.config(state="normal", bg=SURFACE, fg=TEXT, cursor="hand2"))


# ══════════════════════════════════════════════════════════════════════════════
class LauncherApp(tk.Tk):

    def __init__(self, cfg: dict):
        super().__init__()
        self.cfg = cfg
        self.title(
            "SOYZA Streaming Launcher" + ("  [Administrator]" if is_admin() else "")
        )
        self.configure(bg=BG)
        self.geometry("1300x820")
        self.minsize(960, 640)

        self._build_titlebar()
        self._build_panels()
        self._build_statusbar()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── Title bar ─────────────────────────────────────────────────────────

    def _build_titlebar(self):
        bar = tk.Frame(self, bg=PANEL, pady=14, padx=20)
        bar.pack(fill="x")

        tk.Label(bar, text="SOYZA", font=("Segoe UI", 20, "bold"),
                 fg=ACCENT, bg=PANEL).pack(side="left")
        tk.Label(bar, text=" Streaming Launcher", font=FONT_HEAD,
                 fg=TEXT, bg=PANEL).pack(side="left")

        if is_admin():
            tk.Label(bar, text="   ADMIN", font=("Segoe UI", 9, "bold"),
                     fg=WARNING, bg=PANEL).pack(side="left", padx=(10, 0))
        else:
            tk.Label(bar,
                     text="   Not Admin — Python Monitor can't switch routes",
                     font=FONT_SUB, fg=WARNING, bg=PANEL).pack(side="left", padx=(10, 0))

        right = tk.Frame(bar, bg=PANEL)
        right.pack(side="right")

        tk.Button(right, text="  System Check  ", font=FONT_BTN,
                  bg=SURFACE, fg=TEXT_DIM,
                  activebackground=BORDER, activeforeground=TEXT,
                  relief="flat", bd=0, padx=14, pady=7, cursor="hand2",
                  command=self.run_system_check).pack(side="left", padx=(0, 8))

        tk.Button(right, text="  Settings  ", font=FONT_BTN,
                  bg=SURFACE, fg=TEXT_DIM,
                  activebackground=BORDER, activeforeground=TEXT,
                  relief="flat", bd=0, padx=14, pady=7, cursor="hand2",
                  command=self.open_settings).pack(side="left", padx=(0, 12))

        tk.Button(right, text="  Start All  ", font=FONT_BTN,
                  bg=ACCENT, fg="white",
                  activebackground="#5750D4", activeforeground="white",
                  relief="flat", bd=0, padx=18, pady=7, cursor="hand2",
                  command=self.start_all).pack(side="left", padx=(0, 8))

        tk.Button(right, text="  Stop All  ", font=FONT_BTN,
                  bg=SURFACE, fg=TEXT_DIM,
                  activebackground=BORDER, activeforeground=TEXT,
                  relief="flat", bd=0, padx=18, pady=7, cursor="hand2",
                  command=self.stop_all).pack(side="left")

        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")

    # ── 2×2 service panels ─────────────────────────────────────────────────

    def _build_panels(self):
        container = tk.Frame(self, bg=BG)
        container.pack(fill="both", expand=True, padx=12, pady=12)
        container.rowconfigure(0, weight=1)
        container.rowconfigure(1, weight=1)
        container.columnconfigure(0, weight=1)
        container.columnconfigure(1, weight=1)

        self.panels: list[ServicePanel] = []
        for i, svc in enumerate(SERVICE_DEFAULTS):
            row, col = divmod(i, 2)
            cwd = self.cfg.get(svc["key"], "")
            p   = ServicePanel(container, svc, cwd,
                                highlightbackground=BORDER,
                                highlightthickness=1)
            p.grid(row=row, column=col, sticky="nsew", padx=6, pady=6)
            self.panels.append(p)

    # ── Status bar ─────────────────────────────────────────────────────────

    def _build_statusbar(self):
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        bar = tk.Frame(self, bg=PANEL, pady=8, padx=16)
        bar.pack(fill="x")
        self.status_var = tk.StringVar(value="Ready.")
        tk.Label(bar, textvariable=self.status_var,
                 font=FONT_SUB, fg=TEXT_DIM, bg=PANEL, anchor="w").pack(side="left")
        tk.Label(bar, text=f"Config: {CONFIG_PATH}",
                 font=FONT_SMALL, fg=TEXT_MUTED, bg=PANEL).pack(side="right")

    # ── Settings & Tools ───────────────────────────────────────────────────

    def run_system_check(self):
        SystemCheckWindow(self, self.cfg)

    def open_settings(self, first_run=False):
        SettingsWindow(self, self.cfg, self._apply_config, first_run=first_run)

    def _apply_config(self, cfg: dict):
        self.cfg = cfg
        for panel in self.panels:
            panel.cwd = cfg.get(panel.svc_def["key"], "")
        self.status_var.set("Settings saved — paths updated.")

    # ── Global controls ────────────────────────────────────────────────────

    def start_all(self):
        for panel in self.panels:
            if not panel.is_running:
                panel.start()
                self.update_idletasks()
                time.sleep(0.4)
        self.status_var.set("All services started.")

    def stop_all(self):
        for p in self.panels:
            if p.is_running:
                p.stop()
        self.status_var.set("Stopping all services...")

    def _on_close(self):
        running = [p.svc_def["name"] for p in self.panels if p.is_running]
        if running:
            if not messagebox.askyesno(
                "Quit",
                "The following services are still running:\n  • " +
                "\n  • ".join(running) + "\n\nStop them and quit?",
            ):
                return
            self.stop_all()
            time.sleep(1.5)
        self.destroy()


# ══════════════════════════════════════════════════════════════════════════════
def main():
    cfg = load_config()
    cfg = try_autodetect(cfg)

    app = LauncherApp(cfg)

    missing = [s["key"] for s in SERVICE_DEFAULTS if not cfg.get(s["key"])]
    if missing:
        app.after(300, lambda: app.open_settings(first_run=True))
        app.status_var.set(
            "First run — configure service paths in the Settings window."
        )
    else:
        app.status_var.set("Paths loaded from config.json — ready to start.")

    app.mainloop()


if __name__ == "__main__":
    main()
