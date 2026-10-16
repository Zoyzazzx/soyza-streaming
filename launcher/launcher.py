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
import re

if getattr(sys, "frozen", False):
    _EXE_DIR = os.path.dirname(sys.executable)
else:
    _EXE_DIR = os.path.dirname(os.path.abspath(__file__))

CONFIG_PATH = os.path.join(_EXE_DIR, "config.json")

SERVICE_DEFAULTS = [
    {
        "key": "mediamtx",
        "name": "MediaMTX",
        "subtitle": "Streaming Server  ·  Ports 8888 / 8889 / 9997",
        "color": "#38BDF8",
        "icon": "📡",
        "cmd": ["mediamtx.exe"],
        "admin": False,
        "hint": "Folder that contains  mediamtx.exe",
        "default_subdir": "mediamtx",
        "kill_port": 1935,
    },
    {
        "key": "monitor",
        "name": "Python Monitor",
        "subtitle": "Network Failover Monitor  ·  Requires Admin",
        "color": "#FBBF24",
        "icon": "🐍",
        "cmd": ["py", "monitor.py"],
        "admin": True,
        "hint": "Folder that contains  monitor.py",
        "default_subdir": "monitor",
    },
    {
        "key": "upload_worker",
        "name": "Upload Worker",
        "subtitle": "Node.js/Database Uploader",
        "color": "#34D399",
        "icon": "☁↑",
        "cmd": ["node", "worker.js"],
        "admin": False,
        "hint": "Folder that contains  worker.js",
        "default_subdir": "upload-worker",
    },
    {
        "key": "dashboard",
        "name": "Dashboard",
        "subtitle": "Next.js Dev Server  ·  localhost:3000",
        "color": "#60A5FA",
        "icon": "⊞",
        "cmd": ["npm.cmd", "run", "dev"],
        "admin": False,
        "hint": "Folder that contains  package.json  (dashboard)",
        "default_subdir": "dashboard",
        "kill_port": 3000,
    },
    {
        "key": "cloudflared",
        "name": "Cloudflare Tunnel",
        "subtitle": "Exposes MediaMTX to the Internet",
        "color": "#38BDF8",
        "icon": "☁",
        "cmd": ["cloudflared.exe", "tunnel", "--url", "http://localhost:8888"],
        "admin": False,
        "hint": "Folder containing cloudflared.exe (or empty if in PATH)",
        "default_subdir": "..",
    },
]

BG_MAIN = "#080C14"
BG_SIDEBAR = "#090D18"
BG_TOPBAR = "#0A0E1A"
BG_CARD = "#0D1220"
BG_CARD_BORDER = "#182236"
BG_LOG = "#050810"
BG_LOG_BORDER = "#141B2D"
BG_BTN_DARK = "#141A29"
BG_BTN_BORDER = "#1F293D"

COLOR_ACCENT = "#4F46E5"
COLOR_ACCENT_HOVER = "#4338CA"
COLOR_PRIMARY_BLUE = "#2563EB"
COLOR_SUCCESS = "#10B981"
COLOR_SUCCESS_BG = "#052E20"
COLOR_SUCCESS_BORDER = "#065F46"
COLOR_DANGER = "#EF4444"
COLOR_DANGER_DARK = "#DC2626"
COLOR_WARNING = "#F59E0B"
COLOR_WARNING_DARK = "#D97706"

COLOR_TEXT_WHITE = "#F8FAFC"
COLOR_TEXT_DIM = "#94A3B8"
COLOR_TEXT_MUTED = "#64748B"
COLOR_TEXT_DARK = "#475569"

FONT_MAIN_TITLE = ("Segoe UI", 18, "bold")
FONT_CARD_TITLE = ("Segoe UI", 12, "bold")
FONT_SUBTITLE = ("Segoe UI", 8)
FONT_CLOCK_TIME = ("Segoe UI", 12, "bold")
FONT_CLOCK_DATE = ("Segoe UI", 8)
FONT_BTN = ("Segoe UI", 9, "bold")
FONT_BTN_SM = ("Segoe UI", 8, "bold")
FONT_MONO = ("Consolas", 9)
FONT_BADGE = ("Segoe UI", 8, "bold")

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False

def relaunch_as_admin():
    script = os.path.abspath(sys.argv[0])
    params = " ".join(f'"{a}"' for a in sys.argv[1:])
    ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, f'"{script}" {params}', None, 1)
    sys.exit(0)

def ts():
    return datetime.now().strftime("%H:%M:%S")

def resolve_cmd(cmd: list, cwd: str) -> list:
    exe = cmd[0]
    if exe in ("py", "python", "python3"):
        venv_py = os.path.join(cwd, "venv", "Scripts", "python.exe")
        if not os.path.exists(venv_py):
            venv_py = os.path.join(cwd, "venv", "bin", "python")
        if os.path.exists(venv_py):
            return [venv_py] + cmd[1:]
    if os.path.dirname(exe):
        return cmd
    candidate = os.path.join(cwd, exe)
    if os.path.isfile(candidate):
        return [candidate] + cmd[1:]
    return cmd

def subprocess_env() -> dict:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    env["PYTHONUNBUFFERED"] = "1"
    return env

def kill_port_processes(port: int) -> list[int]:
    killed = []
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) < 5:
                continue
            addr = parts[1]
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
    parent = os.path.dirname(_EXE_DIR)
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

class ToggleSwitch(tk.Canvas):
    def __init__(self, parent, width=38, height=20, is_on=True, command=None, bg=BG_SIDEBAR):
        super().__init__(parent, width=width, height=height, bg=bg, highlightthickness=0, bd=0, cursor="hand2")
        self.w = width
        self.h = height
        self.is_on = is_on
        self.command = command
        self.bind("<Button-1>", self._toggle)
        self.render()

    def _toggle(self, event=None):
        self.is_on = not self.is_on
        self.render()
        if self.command:
            self.command(self.is_on)

    def set_state(self, is_on):
        self.is_on = is_on
        self.render()

    def render(self):
        self.delete("all")
        pad = 2
        r = (self.h - pad * 2) // 2
        track_color = COLOR_ACCENT if self.is_on else BG_BTN_BORDER
        x1, y1 = pad, pad
        x2, y2 = self.w - pad, self.h - pad
        self.create_arc(x1, y1, x1 + r * 2, y2, start=90, extent=180, fill=track_color, outline="")
        self.create_arc(x2 - r * 2, y1, x2, y2, start=270, extent=180, fill=track_color, outline="")
        self.create_rectangle(x1 + r, y1, x2 - r, y2, fill=track_color, outline="")
        knob_r = r - 2
        if self.is_on:
            knob_center_x = x2 - r
        else:
            knob_center_x = x1 + r
        knob_center_y = self.h // 2
        self.create_oval(
            knob_center_x - knob_r,
            knob_center_y - knob_r,
            knob_center_x + knob_r,
            knob_center_y + knob_r,
            fill="#FFFFFF",
            outline=""
        )

class SettingsWindow(tk.Toplevel):
    def __init__(self, parent, current_cfg: dict, on_save, first_run=False):
        super().__init__(parent)
        self.on_save = on_save
        self.current_cfg = dict(current_cfg)
        self._entries: dict[str, tk.StringVar] = {}

        self.title("Z-Live Launcher — Settings")
        self.configure(bg=BG_MAIN)
        self.resizable(True, True)
        self.grab_set()
        self.focus_set()

        self._build(first_run)
        self.update_idletasks()

        w = 800
        h = min(self.winfo_reqheight() + 40, int(self.winfo_screenheight() * 0.90))
        self.geometry(f"{w}x{h}")

        pw, ph = parent.winfo_width(), parent.winfo_height()
        px, py = parent.winfo_rootx(), parent.winfo_rooty()
        self.geometry(f"+{px + max(0, (pw - w) // 2)}+{py + max(0, (ph - h) // 2)}")

    def _build(self, first_run: bool):
        hdr = tk.Frame(self, bg=BG_CARD, pady=16, padx=24)
        hdr.pack(fill="x")

        tk.Label(
            hdr,
            text="Service Paths Configuration",
            font=("Segoe UI", 14, "bold"),
            fg=COLOR_TEXT_WHITE,
            bg=BG_CARD,
            anchor="w",
        ).pack(fill="x")

        msg = (
            "Set working directories for each streaming service. "
            "Settings persist inside config.json."
        )
        tk.Label(
            hdr,
            text=msg,
            font=("Segoe UI", 9),
            fg=COLOR_TEXT_DIM,
            bg=BG_CARD,
            justify="left",
            anchor="w",
        ).pack(fill="x", pady=(4, 2))

        tk.Label(
            hdr,
            text=f"Config Path: {CONFIG_PATH}",
            font=FONT_SUBTITLE,
            fg=COLOR_TEXT_MUTED,
            bg=BG_CARD,
            anchor="w",
        ).pack(fill="x")

        tk.Frame(self, bg=BG_CARD_BORDER, height=1).pack(fill="x")

        outer = tk.Frame(self, bg=BG_MAIN)
        outer.pack(fill="both", expand=True)

        canvas = tk.Canvas(outer, bg=BG_MAIN, highlightthickness=0, bd=0)
        scrollbar = tk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)

        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        body = tk.Frame(canvas, bg=BG_MAIN)
        body_id = canvas.create_window((0, 0), window=body, anchor="nw")

        def _on_resize(event):
            canvas.itemconfig(body_id, width=event.width)
        canvas.bind("<Configure>", _on_resize)

        def _on_content_change(event=None):
            canvas.configure(scrollregion=canvas.bbox("all"))
        body.bind("<Configure>", _on_content_change)

        def _on_wheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_wheel)

        for i, svc in enumerate(SERVICE_DEFAULTS):
            self._build_row(body, svc, i, last=(i == len(SERVICE_DEFAULTS) - 1))

        tk.Frame(self, bg=BG_CARD_BORDER, height=1).pack(fill="x")

        footer = tk.Frame(self, bg=BG_CARD, pady=14, padx=24)
        footer.pack(fill="x")

        tk.Button(
            footer,
            text="Save Settings",
            font=FONT_BTN,
            bg=COLOR_ACCENT,
            fg=COLOR_TEXT_WHITE,
            activebackground=COLOR_ACCENT_HOVER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            padx=20,
            pady=8,
            cursor="hand2",
            command=self._save,
        ).pack(side="right", padx=(8, 0))

        if not first_run:
            tk.Button(
                footer,
                text="Cancel",
                font=FONT_BTN,
                bg=BG_BTN_DARK,
                fg=COLOR_TEXT_DIM,
                activebackground=BG_BTN_BORDER,
                activeforeground=COLOR_TEXT_WHITE,
                relief="flat",
                bd=0,
                padx=16,
                pady=8,
                cursor="hand2",
                command=self.destroy,
            ).pack(side="right")

        tk.Label(
            footer,
            text="Type directory path directly or use Browse to choose a folder.",
            font=FONT_SUBTITLE,
            fg=COLOR_TEXT_MUTED,
            bg=BG_CARD,
        ).pack(side="left")

    def _build_row(self, parent, svc: dict, idx: int, last: bool):
        wrapper = tk.Frame(parent, bg=BG_MAIN, padx=24, pady=14)
        wrapper.pack(fill="x")

        name_row = tk.Frame(wrapper, bg=BG_MAIN)
        name_row.pack(fill="x", pady=(0, 6))

        tk.Label(name_row, text=svc["icon"], font=("Segoe UI", 11), fg=svc["color"], bg=BG_MAIN).pack(side="left", padx=(0, 8))
        tk.Label(name_row, text=svc["name"], font=FONT_CARD_TITLE, fg=COLOR_TEXT_WHITE, bg=BG_MAIN).pack(side="left")
        tk.Label(name_row, text=f"  —  {svc['hint']}", font=FONT_SUBTITLE, fg=COLOR_TEXT_MUTED, bg=BG_MAIN).pack(side="left")

        path_row = tk.Frame(wrapper, bg=BG_MAIN)
        path_row.pack(fill="x")

        var = tk.StringVar(value=self.current_cfg.get(svc["key"], ""))
        self._entries[svc["key"]] = var

        entry = tk.Entry(
            path_row,
            textvariable=var,
            font=FONT_MONO,
            bg=BG_CARD,
            fg=COLOR_TEXT_WHITE,
            insertbackground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            highlightbackground=BG_CARD_BORDER,
            highlightcolor=COLOR_ACCENT,
            highlightthickness=1,
        )
        entry.pack(side="left", fill="x", expand=True, ipady=6, padx=(0, 10))

        tk.Button(
            path_row,
            text="Browse…",
            font=FONT_BTN_SM,
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_DIM,
            activebackground=BG_BTN_BORDER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            padx=14,
            pady=6,
            cursor="hand2",
            command=lambda v=var, s=svc: self._browse(v, s),
        ).pack(side="right")

        if not last:
            tk.Frame(wrapper, bg=BG_CARD_BORDER, height=1).pack(fill="x", pady=(12, 0))

    def _browse(self, var: tk.StringVar, svc: dict):
        initial = var.get().strip()
        if not initial or not os.path.isdir(initial):
            initial = _EXE_DIR
        chosen = filedialog.askdirectory(parent=self, title=f"Select folder for {svc['name']}", initialdir=initial)
        if chosen:
            var.set(os.path.normpath(chosen))

    def _save(self):
        cfg = {}
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
            messagebox.showerror("Invalid Paths", "Please fix the following:\n\n" + "\n".join(errors), parent=self)
            return

        save_config(cfg)
        self.on_save(cfg)
        self.destroy()

class ServicePanel(tk.Frame):
    def __init__(self, parent, svc_def: dict, cwd: str, **kw):
        super().__init__(parent, bg=BG_CARD, **kw)
        self.svc_def = svc_def
        self._cwd = cwd
        self.process = None
        self._running = False
        self._detected_url = None
        self.is_single = False

        self._build_header()
        self._build_log()
        self._build_footer()

    @property
    def cwd(self):
        return self._cwd

    @cwd.setter
    def cwd(self, value):
        self._cwd = value

    def set_mode(self, is_single: bool):
        self.is_single = is_single
        if is_single:
            self.log_txt.config(height=26)
        else:
            self.log_txt.config(height=13)

    def _build_header(self):
        s = self.svc_def
        hdr = tk.Frame(self, bg=BG_CARD, pady=10, padx=14)
        hdr.pack(fill="x")

        left_side = tk.Frame(hdr, bg=BG_CARD)
        left_side.pack(side="left", fill="x", expand=True)

        icon_frame = tk.Frame(left_side, bg=BG_CARD)
        icon_frame.pack(side="left", padx=(0, 10))

        tk.Label(
            icon_frame,
            text=s["icon"],
            font=("Segoe UI", 16),
            fg=s["color"],
            bg=BG_CARD,
        ).pack()

        info_frame = tk.Frame(left_side, bg=BG_CARD)
        info_frame.pack(side="left", fill="x")

        tk.Label(
            info_frame,
            text=s["name"],
            font=FONT_CARD_TITLE,
            fg=COLOR_TEXT_WHITE,
            bg=BG_CARD,
            anchor="w",
        ).pack(fill="x")

        tk.Label(
            info_frame,
            text=s["subtitle"],
            font=FONT_SUBTITLE,
            fg=COLOR_TEXT_MUTED,
            bg=BG_CARD,
            anchor="w",
        ).pack(fill="x")

        self.status_pill = tk.Frame(
            hdr,
            bg=BG_BTN_DARK,
            highlightbackground=BG_BTN_BORDER,
            highlightthickness=1,
            padx=10,
            pady=3,
        )
        self.status_pill.pack(side="right")

        self.status_dot = tk.Label(
            self.status_pill,
            text="●",
            font=("Segoe UI", 8),
            fg=COLOR_TEXT_MUTED,
            bg=BG_BTN_DARK,
        )
        self.status_dot.pack(side="left", padx=(0, 5))

        self.status_lbl = tk.Label(
            self.status_pill,
            text="Stopped",
            font=FONT_BADGE,
            fg=COLOR_TEXT_MUTED,
            bg=BG_BTN_DARK,
        )
        self.status_lbl.pack(side="left")

    def _build_log(self):
        self.log_container = tk.Frame(
            self,
            bg=BG_LOG,
            highlightbackground=BG_LOG_BORDER,
            highlightthickness=1,
            padx=2,
            pady=2,
        )
        self.log_container.pack(fill="both", expand=True, padx=14, pady=(0, 10))

        self.log_txt = scrolledtext.ScrolledText(
            self.log_container,
            bg=BG_LOG,
            fg=COLOR_TEXT_DIM,
            font=FONT_MONO,
            insertbackground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            padx=10,
            pady=8,
            state="disabled",
            wrap="word",
            height=13,
        )
        self.log_txt.pack(fill="both", expand=True)

        self.log_txt.tag_config("ts", foreground="#38BDF8")
        self.log_txt.tag_config("info", foreground="#CBD5E1")
        self.log_txt.tag_config("warn", foreground=COLOR_WARNING)
        self.log_txt.tag_config("error", foreground=COLOR_DANGER)
        self.log_txt.tag_config("success", foreground=COLOR_SUCCESS)
        self.log_txt.tag_config("system", foreground="#818CF8")

    def _build_footer(self):
        footer = tk.Frame(self, bg=BG_CARD, padx=14, pady=8)
        footer.pack(fill="x", side="bottom")

        self.start_btn = tk.Button(
            footer,
            text="▶  Start",
            font=FONT_BTN_SM,
            bg=COLOR_SUCCESS,
            fg=COLOR_TEXT_WHITE,
            activebackground="#059669",
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            padx=14,
            pady=5,
            cursor="hand2",
            command=self.start,
        )
        self.start_btn.pack(side="left", padx=(0, 6))

        self.stop_btn = tk.Button(
            footer,
            text="⏹  Stop",
            font=FONT_BTN_SM,
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_DARK,
            activebackground=COLOR_DANGER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            highlightbackground=BG_BTN_BORDER,
            highlightthickness=1,
            padx=14,
            pady=5,
            cursor="hand2",
            command=self.stop,
            state="disabled",
        )
        self.stop_btn.pack(side="left", padx=(0, 6))

        self.restart_btn = tk.Button(
            footer,
            text="🔄  Restart",
            font=FONT_BTN_SM,
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_DARK,
            activebackground=COLOR_WARNING_DARK,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            highlightbackground=BG_BTN_BORDER,
            highlightthickness=1,
            padx=14,
            pady=5,
            cursor="hand2",
            command=self.restart,
            state="disabled",
        )
        self.restart_btn.pack(side="left")

        self.clear_btn = tk.Button(
            footer,
            text="🗑  Clear",
            font=FONT_BTN_SM,
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_MUTED,
            activebackground=BG_BTN_BORDER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            highlightbackground=BG_BTN_BORDER,
            highlightthickness=1,
            padx=12,
            pady=5,
            cursor="hand2",
            command=self.clear_log,
        )
        self.clear_btn.pack(side="right")

        self.copy_url_btn = tk.Button(
            footer,
            text="📋  Copy URL",
            font=FONT_BTN_SM,
            bg=COLOR_PRIMARY_BLUE,
            fg=COLOR_TEXT_WHITE,
            activebackground="#1D4ED8",
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            padx=12,
            pady=5,
            cursor="hand2",
            command=self.copy_url,
        )
        self.copy_url_btn.pack_forget()

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

    def _show_copy_url_btn(self):
        self.copy_url_btn.pack(side="right", padx=(0, 6))

    def copy_url(self):
        if self._detected_url:
            self.clipboard_clear()
            self.clipboard_append(self._detected_url)
            self.copy_url_btn.config(text="✔ Copied!", bg=COLOR_SUCCESS)
            self.after(2000, lambda: self.copy_url_btn.config(text="📋  Copy URL", bg=COLOR_PRIMARY_BLUE))

    def _set_status(self, running: bool):
        if running:
            self.status_pill.config(bg=COLOR_SUCCESS_BG, highlightbackground=COLOR_SUCCESS_BORDER)
            self.status_dot.config(fg=COLOR_SUCCESS, bg=COLOR_SUCCESS_BG)
            self.status_lbl.config(fg=COLOR_SUCCESS, bg=COLOR_SUCCESS_BG, text="Running")

            self.start_btn.config(
                state="disabled",
                bg=BG_BTN_DARK,
                fg=COLOR_TEXT_DARK,
                highlightbackground=BG_BTN_BORDER,
                highlightthickness=1,
            )
            self.stop_btn.config(
                state="normal",
                bg=COLOR_DANGER_DARK,
                fg=COLOR_TEXT_WHITE,
                highlightthickness=0,
            )
            self.restart_btn.config(
                state="normal",
                bg=COLOR_WARNING_DARK,
                fg=COLOR_TEXT_WHITE,
                highlightthickness=0,
            )
        else:
            self.status_pill.config(bg=BG_BTN_DARK, highlightbackground=BG_BTN_BORDER)
            self.status_dot.config(fg=COLOR_TEXT_MUTED, bg=BG_BTN_DARK)
            self.status_lbl.config(fg=COLOR_TEXT_MUTED, bg=BG_BTN_DARK, text="Stopped")

            self.start_btn.config(
                state="normal",
                bg=COLOR_SUCCESS,
                fg=COLOR_TEXT_WHITE,
                highlightthickness=0,
            )
            self.stop_btn.config(
                state="disabled",
                bg=BG_BTN_DARK,
                fg=COLOR_TEXT_DARK,
                highlightbackground=BG_BTN_BORDER,
                highlightthickness=1,
            )
            self.restart_btn.config(
                state="disabled",
                bg=BG_BTN_DARK,
                fg=COLOR_TEXT_DARK,
                highlightbackground=BG_BTN_BORDER,
                highlightthickness=1,
            )

    def start(self):
        if self._running:
            return
        s = self.svc_def

        if not self._cwd or not os.path.isdir(self._cwd):
            messagebox.showerror(
                "Path Not Set",
                f"'{s['name']}' has no valid working directory.\n\n"
                f"Current: {self._cwd or '(empty)'}\n\n"
                "Open Settings and set the correct folder.",
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

        kill_port = s.get("kill_port")
        if kill_port:
            pids = kill_port_processes(kill_port)
            if pids:
                self.log(
                    f"Killed {len(pids)} existing process(es) on port {kill_port} "
                    f"(PID{'s' if len(pids) > 1 else ''}: {', '.join(map(str, pids))})",
                    "warn",
                )
                time.sleep(0.8)
            else:
                self.log(f"Port {kill_port} is free.", "system")

        cmd = resolve_cmd(list(s["cmd"]), self._cwd)

        self._detected_url = None
        self.copy_url_btn.pack_forget()

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
            self.log(f"Make sure '{cmd[0]}' is installed and on your PATH.", "warn")
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
                elif any(k in ll for k in ("ready", "started", "connected", "success", "uploaded", "listening", "compiled", "localhost", "running")):
                    tag = "success"
                else:
                    tag = "info"

                url_match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
                if url_match:
                    self._detected_url = url_match.group(0)
                    self.after(0, self._show_copy_url_btn)

                self.log(line, tag)
        except Exception:
            pass

        rc = self.process.wait() if self.process else -1
        self._running = False
        self.process = None
        self.log(f"Process exited (code {rc})", "warn" if rc != 0 else "system")
        self.after(0, lambda: self._set_status(False))

    def stop(self):
        if not self._running or self.process is None:
            return
        self.log("Stopping...", "system")
        try:
            self.process.terminate()
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
            time.sleep(0.5)
            self.after(0, self.start)
        threading.Thread(target=_wait_and_start, daemon=True).start()

    @property
    def is_running(self):
        return self._running

class SystemCheckWindow(tk.Toplevel):
    def __init__(self, parent, cfg: dict):
        super().__init__(parent)
        self.cfg = cfg
        self.title("System Check")
        self.configure(bg=BG_MAIN)
        self.geometry("740x520")
        self.resizable(True, True)
        self.grab_set()
        self.focus_set()

        pw, ph = parent.winfo_width(), parent.winfo_height()
        px, py = parent.winfo_rootx(), parent.winfo_rooty()
        self.geometry(f"+{px + max(0, (pw - 740) // 2)}+{py + max(0, (ph - 520) // 2)}")

        self._build_ui()
        threading.Thread(target=self._run_checks, daemon=True).start()

    def _build_ui(self):
        hdr = tk.Frame(self, bg=BG_CARD, pady=16, padx=24)
        hdr.pack(fill="x")

        tk.Label(
            hdr,
            text="System Diagnostics & Check",
            font=("Segoe UI", 14, "bold"),
            fg=COLOR_TEXT_WHITE,
            bg=BG_CARD,
            anchor="w",
        ).pack(fill="x")

        tk.Label(
            hdr,
            text="Verifying environment runtime, tools, and dependencies...",
            font=FONT_SUBTITLE,
            fg=COLOR_TEXT_DIM,
            bg=BG_CARD,
            anchor="w",
        ).pack(fill="x", pady=(4, 0))

        tk.Frame(self, bg=BG_CARD_BORDER, height=1).pack(fill="x")

        self.log_txt = scrolledtext.ScrolledText(
            self,
            bg=BG_LOG,
            fg=COLOR_TEXT_DIM,
            font=FONT_MONO,
            insertbackground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            padx=14,
            pady=14,
            state="disabled",
            wrap="word",
        )
        self.log_txt.pack(fill="both", expand=True)

        self.log_txt.tag_config("info", foreground="#CBD5E1")
        self.log_txt.tag_config("warn", foreground=COLOR_WARNING)
        self.log_txt.tag_config("error", foreground=COLOR_DANGER)
        self.log_txt.tag_config("success", foreground=COLOR_SUCCESS)
        self.log_txt.tag_config("header", foreground="#818CF8", font=("Consolas", 10, "bold"))

        tk.Frame(self, bg=BG_CARD_BORDER, height=1).pack(fill="x")

        footer = tk.Frame(self, bg=BG_CARD, pady=12, padx=24)
        footer.pack(fill="x", side="bottom")

        self.close_btn = tk.Button(
            footer,
            text="Close",
            font=FONT_BTN,
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_DIM,
            activebackground=BG_BTN_BORDER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            padx=16,
            pady=7,
            cursor="hand2",
            command=self.destroy,
            state="disabled",
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
        self._log("=== Starting System Diagnostics ===", "header")
        all_passed = True

        self._log("\nChecking Python...", "header")
        if shutil.which("python") or shutil.which("py"):
            self._log("✔ Python is installed.", "success")
        else:
            self._log("✘ Python not found. Please install Python and add it to PATH.", "error")
            all_passed = False

        self._log("\nChecking Node.js...", "header")
        if shutil.which("node"):
            self._log("✔ Node.js is installed.", "success")
        else:
            self._log("✘ Node.js not found. Please install Node.js.", "error")
            all_passed = False

        self._log("\nChecking FFmpeg...", "header")
        worker_path = self.cfg.get("upload_worker", "")
        if shutil.which("ffmpeg"):
            self._log("✔ FFmpeg is installed in PATH.", "success")
        elif worker_path and os.path.isfile(os.path.join(worker_path, "ffmpeg.exe")):
            self._log("✔ FFmpeg found in Upload Worker folder.", "success")
        else:
            self._log("✘ FFmpeg not found in PATH or upload-worker folder.", "error")
            all_passed = False

        self._log("\nChecking MediaMTX...", "header")
        mtx_path = self.cfg.get("mediamtx", "")
        if not mtx_path or not os.path.isdir(mtx_path):
            self._log("✘ MediaMTX path not configured in Settings.", "error")
            all_passed = False
        else:
            if os.path.isfile(os.path.join(mtx_path, "mediamtx.exe")):
                self._log("✔ mediamtx.exe found.", "success")
            else:
                self._log(f"✘ mediamtx.exe not found in {mtx_path}.", "error")
                all_passed = False

        self._log("\nChecking Dashboard dependencies...", "header")
        dash_path = self.cfg.get("dashboard", "")
        if dash_path and os.path.isdir(dash_path):
            if os.path.isdir(os.path.join(dash_path, "node_modules")):
                self._log("✔ Dashboard node_modules exist.", "success")
            else:
                self._log("Running npm install in Dashboard...", "warn")
                try:
                    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
                    subprocess.run([npm_cmd, "install"], cwd=dash_path, check=True, capture_output=True, env=subprocess_env())
                    self._log("✔ Dashboard dependencies installed.", "success")
                except Exception as e:
                    self._log(f"✘ Failed to install Dashboard dependencies: {e}", "error")
                    all_passed = False
        else:
            self._log("✘ Dashboard path not configured in Settings.", "error")
            all_passed = False

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
                            pip_exe = os.path.join(venv_path, "bin", "pip")
                        subprocess.run([pip_exe, "install", "-r", "requirements.txt"], cwd=mon_path, check=True, capture_output=True, env=subprocess_env())
                        self._log("✔ Monitor requirements installed.", "success")
                except Exception as e:
                    self._log(f"✘ Failed to setup Monitor venv: {e}", "error")
                    all_passed = False
        else:
            self._log("✘ Monitor path not configured in Settings.", "error")
            all_passed = False

        self._log("\n=== System Diagnostics Complete ===", "header")
        if all_passed:
            self._log("All system checks passed successfully!", "success")
        else:
            self._log("Some checks failed. Review errors above.", "error")

        self.after(0, lambda: self.close_btn.config(state="normal", bg=COLOR_ACCENT, fg=COLOR_TEXT_WHITE, cursor="hand2"))

class LauncherApp(tk.Tk):
    def __init__(self, cfg: dict):
        super().__init__()
        self.cfg = cfg
        self.title("Z-Live Streaming Launcher" + ("  [Administrator]" if is_admin() else ""))
        self.configure(bg=BG_MAIN)
        self.geometry("1400x900")
        self.minsize(1080, 720)

        ico_path = os.path.join(_EXE_DIR, "logo.ico")
        if os.path.exists(ico_path):
            try:
                self.iconbitmap(ico_path)
            except Exception:
                pass

        self.panels: list[ServicePanel] = []
        self.nav_buttons: dict[str, tk.Button] = {}
        self.active_nav = "dashboard"
        self.sidebar_visible = True

        self._build_topbar()
        self._build_body()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self._start_clock()

    def _build_topbar(self):
        bar = tk.Frame(self, bg=BG_TOPBAR, height=62, padx=16, pady=10)
        bar.pack(fill="x")

        left = tk.Frame(bar, bg=BG_TOPBAR)
        left.pack(side="left", fill="y")

        self.sidebar_toggle_btn = tk.Button(
            left,
            text="☰",
            font=("Segoe UI", 12),
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_DIM,
            activebackground=BG_BTN_BORDER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            highlightbackground=BG_BTN_BORDER,
            highlightthickness=1,
            padx=10,
            pady=3,
            cursor="hand2",
            command=self.toggle_sidebar,
        )
        self.sidebar_toggle_btn.pack(side="left", padx=(0, 12))

        png_path = os.path.join(_EXE_DIR, "logo_icon.png")
        if os.path.exists(png_path):
            try:
                self.logo_img = tk.PhotoImage(file=png_path)
                tk.Label(left, image=self.logo_img, bg=BG_TOPBAR).pack(side="left", padx=(0, 10))
            except Exception:
                self._draw_logo_fallback(left)
        else:
            self._draw_logo_fallback(left)

        tk.Label(
            left,
            text="Z-Live",
            font=("Segoe UI", 16, "bold"),
            fg=COLOR_TEXT_WHITE,
            bg=BG_TOPBAR,
        ).pack(side="left")

        tk.Label(
            left,
            text=" Streaming Launcher",
            font=("Segoe UI", 11),
            fg=COLOR_TEXT_MUTED,
            bg=BG_TOPBAR,
        ).pack(side="left", padx=(0, 10))

        admin_badge = tk.Frame(
            left,
            bg="#261A45",
            highlightbackground="#6366F1",
            highlightthickness=1,
            padx=8,
            pady=2,
        )
        admin_badge.pack(side="left")

        tk.Label(
            admin_badge,
            text="ADMIN" if is_admin() else "ADMIN",
            font=("Segoe UI", 8, "bold"),
            fg="#A5B4FC",
            bg="#261A45",
        ).pack()

        right = tk.Frame(bar, bg=BG_TOPBAR)
        right.pack(side="right")

        status_frame = tk.Frame(right, bg=BG_TOPBAR)
        status_frame.pack(side="left", padx=(0, 20))

        tk.Label(status_frame, text="●", font=("Segoe UI", 9), fg=COLOR_SUCCESS, bg=BG_TOPBAR).pack(side="left", padx=(0, 4))
        tk.Label(status_frame, text="System Online", font=("Segoe UI", 9), fg=COLOR_TEXT_DIM, bg=BG_TOPBAR).pack(side="left")

        tk.Button(
            right,
            text="🛡  System Check",
            font=FONT_BTN_SM,
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_DIM,
            activebackground=BG_BTN_BORDER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            highlightbackground=BG_BTN_BORDER,
            highlightthickness=1,
            padx=14,
            pady=6,
            cursor="hand2",
            command=self.run_system_check,
        ).pack(side="left", padx=(0, 8))

        tk.Button(
            right,
            text="⚙  Settings",
            font=FONT_BTN_SM,
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_DIM,
            activebackground=BG_BTN_BORDER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            highlightbackground=BG_BTN_BORDER,
            highlightthickness=1,
            padx=14,
            pady=6,
            cursor="hand2",
            command=self.open_settings,
        ).pack(side="left", padx=(0, 12))

        tk.Button(
            right,
            text="▶  Start All",
            font=FONT_BTN,
            bg=COLOR_ACCENT,
            fg=COLOR_TEXT_WHITE,
            activebackground=COLOR_ACCENT_HOVER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            padx=18,
            pady=6,
            cursor="hand2",
            command=self.start_all,
        ).pack(side="left", padx=(0, 8))

        tk.Button(
            right,
            text="⏹  Stop All",
            font=FONT_BTN_SM,
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_DIM,
            activebackground=BG_BTN_BORDER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            highlightbackground=BG_BTN_BORDER,
            highlightthickness=1,
            padx=16,
            pady=6,
            cursor="hand2",
            command=self.stop_all,
        ).pack(side="left")

        tk.Frame(self, bg=BG_CARD_BORDER, height=1).pack(fill="x")

    def toggle_sidebar(self):
        if self.sidebar_visible:
            self.sidebar_wrapper.pack_forget()
            self.sidebar_visible = False
            self.sidebar_toggle_btn.config(bg=BG_BTN_DARK, fg=COLOR_TEXT_DIM)
        else:
            self.sidebar_wrapper.pack(side="left", fill="y", before=self.main_container)
            self.sidebar_visible = True
            self.sidebar_toggle_btn.config(bg=BG_BTN_BORDER, fg=COLOR_TEXT_WHITE)

    def _draw_logo_fallback(self, parent):
        c = tk.Canvas(parent, width=32, height=32, bg=BG_TOPBAR, highlightthickness=0, bd=0)
        c.pack(side="left", padx=(0, 10))
        c.create_rectangle(2, 2, 30, 30, fill=COLOR_ACCENT, outline="")
        c.create_text(16, 16, text="Z", fill="#FFFFFF", font=("Segoe UI", 16, "bold"))

    def _build_body(self):
        self.body_container = tk.Frame(self, bg=BG_MAIN)
        self.body_container.pack(fill="both", expand=True)

        self.sidebar_wrapper = tk.Frame(self.body_container, bg=BG_SIDEBAR)
        self.sidebar_wrapper.pack(side="left", fill="y")

        self._build_sidebar(self.sidebar_wrapper)

        self.sidebar_divider = tk.Frame(self.sidebar_wrapper, bg=BG_CARD_BORDER, width=1)
        self.sidebar_divider.pack(side="right", fill="y")

        self.main_container = tk.Frame(self.body_container, bg=BG_MAIN)
        self.main_container.pack(side="left", fill="both", expand=True)

        self._build_main_area(self.main_container)

    def _build_sidebar(self, parent):
        sidebar = tk.Frame(parent, bg=BG_SIDEBAR, width=220, padx=12, pady=16)
        sidebar.pack(side="left", fill="y")
        sidebar.pack_propagate(False)

        top_menu = tk.Frame(sidebar, bg=BG_SIDEBAR)
        top_menu.pack(fill="x", side="top")

        dash_btn = tk.Button(
            top_menu,
            text="   ⊞   Dashboard",
            font=FONT_BTN,
            bg=COLOR_PRIMARY_BLUE,
            fg=COLOR_TEXT_WHITE,
            activebackground=COLOR_PRIMARY_BLUE,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            anchor="w",
            padx=12,
            pady=9,
            cursor="hand2",
            command=lambda: self._select_nav("dashboard"),
        )
        dash_btn.pack(fill="x", pady=(0, 6))
        self.nav_buttons["dashboard"] = dash_btn

        for svc in SERVICE_DEFAULTS:
            btn = tk.Button(
                top_menu,
                text=f"   {svc['icon']}   {svc['name']}",
                font=("Segoe UI", 9),
                bg=BG_SIDEBAR,
                fg=COLOR_TEXT_DIM,
                activebackground=BG_BTN_DARK,
                activeforeground=COLOR_TEXT_WHITE,
                relief="flat",
                bd=0,
                anchor="w",
                padx=12,
                pady=9,
                cursor="hand2",
                command=lambda k=svc["key"]: self._select_nav(k),
            )
            btn.pack(fill="x", pady=(0, 4))
            self.nav_buttons[svc["key"]] = btn

        bottom_menu = tk.Frame(sidebar, bg=BG_SIDEBAR)
        bottom_menu.pack(fill="x", side="bottom")

        theme_row = tk.Frame(bottom_menu, bg=BG_SIDEBAR)
        theme_row.pack(fill="x", pady=(0, 16))

        tk.Label(theme_row, text="🌙", font=("Segoe UI", 10), fg=COLOR_TEXT_DIM, bg=BG_SIDEBAR).pack(side="left", padx=(0, 8))
        tk.Label(theme_row, text="Dark Mode", font=("Segoe UI", 9), fg=COLOR_TEXT_DIM, bg=BG_SIDEBAR).pack(side="left")

        self.toggle = ToggleSwitch(theme_row, width=38, height=20, is_on=True, bg=BG_SIDEBAR)
        self.toggle.pack(side="right")

        tk.Label(
            bottom_menu,
            text="Z-Live v1.0.0",
            font=FONT_SUBTITLE,
            fg=COLOR_TEXT_DARK,
            bg=BG_SIDEBAR,
            anchor="w",
        ).pack(fill="x")

    def _select_nav(self, key: str):
        self.active_nav = key
        for k, btn in self.nav_buttons.items():
            if k == key:
                btn.config(bg=COLOR_PRIMARY_BLUE, fg=COLOR_TEXT_WHITE, font=FONT_BTN)
            else:
                btn.config(bg=BG_SIDEBAR, fg=COLOR_TEXT_DIM, font=("Segoe UI", 9))

        if key == "dashboard":
            self._show_dashboard_view()
        else:
            self._show_single_service_view(key)

    def _show_dashboard_view(self):
        self.back_btn.pack_forget()
        self.header_title.config(text="Dashboard")
        self.header_subtitle.config(text="Manage and monitor your streaming services")

        self.grid_frame.rowconfigure(0, weight=1)
        self.grid_frame.rowconfigure(1, weight=1)
        self.grid_frame.rowconfigure(2, weight=1)
        self.grid_frame.columnconfigure(0, weight=1)
        self.grid_frame.columnconfigure(1, weight=1)

        for i, panel in enumerate(self.panels):
            panel.set_mode(is_single=False)
            if panel.svc_def["key"] == "cloudflared":
                panel.grid(row=2, column=0, columnspan=2, sticky="nsew", padx=8, pady=8)
            else:
                panel.grid(row=i // 2, column=i % 2, sticky="nsew", padx=8, pady=8)

        self.canvas.yview_moveto(0)

    def _show_single_service_view(self, key: str):
        target_panel = None
        for p in self.panels:
            if p.svc_def["key"] == key:
                target_panel = p
                break

        if not target_panel:
            return

        self.back_btn.pack(side="left", padx=(0, 12))
        self.header_title.config(text=target_panel.svc_def["name"])
        dir_text = f"dir: {target_panel.cwd}" if target_panel.cwd else "dir: (not configured)"
        self.header_subtitle.config(text=f"{target_panel.svc_def['subtitle']}   •   {dir_text}")

        self.grid_frame.rowconfigure(0, weight=1)
        self.grid_frame.rowconfigure(1, weight=0)
        self.grid_frame.rowconfigure(2, weight=0)
        self.grid_frame.columnconfigure(0, weight=1)
        self.grid_frame.columnconfigure(1, weight=0)

        for panel in self.panels:
            if panel == target_panel:
                panel.set_mode(is_single=True)
                panel.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=8, pady=8)
            else:
                panel.grid_forget()

        self.canvas.yview_moveto(0)

    def _build_main_area(self, parent):
        self.canvas = tk.Canvas(parent, bg=BG_MAIN, highlightthickness=0, bd=0)
        self.scrollbar = tk.Scrollbar(parent, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=self.scrollbar.set)

        self.scrollbar.pack(side="right", fill="y")
        self.canvas.pack(side="left", fill="both", expand=True)

        self.content_frame = tk.Frame(self.canvas, bg=BG_MAIN, padx=24, pady=20)
        self.content_window_id = self.canvas.create_window((0, 0), window=self.content_frame, anchor="nw")

        def _on_canvas_configure(event):
            self.canvas.itemconfig(self.content_window_id, width=event.width)
            if self.active_nav != "dashboard":
                req_h = self.content_frame.winfo_reqheight()
                self.canvas.itemconfig(self.content_window_id, height=max(event.height, req_h))
        self.canvas.bind("<Configure>", _on_canvas_configure)

        def _on_content_configure(event=None):
            self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        self.content_frame.bind("<Configure>", _on_content_configure)

        def _on_mousewheel(event):
            self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        self.canvas.bind_all("<MouseWheel>", _on_mousewheel)

        self._build_dashboard_header(self.content_frame)
        self._build_service_cards(self.content_frame)

    def _build_dashboard_header(self, parent):
        hdr = tk.Frame(parent, bg=BG_MAIN)
        hdr.pack(fill="x", pady=(0, 16))

        left_hdr = tk.Frame(hdr, bg=BG_MAIN)
        left_hdr.pack(side="left", fill="x", expand=True)

        self.back_btn = tk.Button(
            left_hdr,
            text="← Back to Dashboard",
            font=FONT_BTN_SM,
            bg=BG_BTN_DARK,
            fg=COLOR_TEXT_DIM,
            activebackground=BG_BTN_BORDER,
            activeforeground=COLOR_TEXT_WHITE,
            relief="flat",
            bd=0,
            highlightbackground=BG_BTN_BORDER,
            highlightthickness=1,
            padx=12,
            pady=5,
            cursor="hand2",
            command=lambda: self._select_nav("dashboard"),
        )

        title_box = tk.Frame(left_hdr, bg=BG_MAIN)
        title_box.pack(side="left", fill="x")

        self.header_title = tk.Label(
            title_box,
            text="Dashboard",
            font=FONT_MAIN_TITLE,
            fg=COLOR_TEXT_WHITE,
            bg=BG_MAIN,
            anchor="w",
        )
        self.header_title.pack(fill="x")

        self.header_subtitle = tk.Label(
            title_box,
            text="Manage and monitor your streaming services",
            font=("Segoe UI", 9),
            fg=COLOR_TEXT_MUTED,
            bg=BG_MAIN,
            anchor="w",
        )
        self.header_subtitle.pack(fill="x", pady=(2, 0))

        clock_box = tk.Frame(hdr, bg=BG_MAIN)
        clock_box.pack(side="right")

        time_row = tk.Frame(clock_box, bg=BG_MAIN)
        time_row.pack(side="top", anchor="e")

        tk.Label(time_row, text="●", font=("Segoe UI", 8), fg=COLOR_SUCCESS, bg=BG_MAIN).pack(side="left", padx=(0, 4))
        self.clock_time_lbl = tk.Label(time_row, text="--:--:--", font=FONT_CLOCK_TIME, fg=COLOR_TEXT_WHITE, bg=BG_MAIN)
        self.clock_time_lbl.pack(side="left")

        self.clock_date_lbl = tk.Label(
            clock_box,
            text="--- --, ----",
            font=FONT_CLOCK_DATE,
            fg=COLOR_TEXT_MUTED,
            bg=BG_MAIN,
            anchor="e",
        )
        self.clock_date_lbl.pack(side="top", anchor="e")

    def _start_clock(self):
        def _update():
            now = datetime.now()
            self.clock_time_lbl.config(text=now.strftime("%H:%M:%S"))
            self.clock_date_lbl.config(text=now.strftime("%b %d, %Y"))
            self.after(1000, _update)
        _update()

    def _build_service_cards(self, parent):
        self.grid_frame = tk.Frame(parent, bg=BG_MAIN)
        self.grid_frame.pack(fill="both", expand=True)

        self.grid_frame.columnconfigure(0, weight=1)
        self.grid_frame.columnconfigure(1, weight=1)

        for i, svc in enumerate(SERVICE_DEFAULTS):
            cwd = self.cfg.get(svc["key"], "")
            p = ServicePanel(
                self.grid_frame,
                svc,
                cwd,
                highlightbackground=BG_CARD_BORDER,
                highlightthickness=1,
            )

            if svc["key"] == "cloudflared":
                p.grid(row=2, column=0, columnspan=2, sticky="nsew", padx=8, pady=8)
            else:
                row = i // 2
                col = i % 2
                p.grid(row=row, column=col, sticky="nsew", padx=8, pady=8)

            self.panels.append(p)

    def run_system_check(self):
        SystemCheckWindow(self, self.cfg)

    def open_settings(self, first_run=False):
        SettingsWindow(self, self.cfg, self._apply_config, first_run=first_run)

    def _apply_config(self, cfg: dict):
        self.cfg = cfg
        for panel in self.panels:
            panel.cwd = cfg.get(panel.svc_def["key"], "")

    def start_all(self):
        for panel in self.panels:
            if not panel.is_running:
                panel.start()
                self.update_idletasks()
                time.sleep(0.4)

    def stop_all(self):
        for p in self.panels:
            if p.is_running:
                p.stop()

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

def main():
    cfg = load_config()
    cfg = try_autodetect(cfg)

    app = LauncherApp(cfg)

    missing = [s["key"] for s in SERVICE_DEFAULTS if not cfg.get(s["key"])]
    if missing:
        app.after(300, lambda: app.open_settings(first_run=True))

    app.mainloop()

if __name__ == "__main__":
    main()
