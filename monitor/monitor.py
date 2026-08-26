"""
Soyza Project — Network Monitor & Failover Script
==================================================
Monitors two network interfaces (5G Ethernet + 4G WiFi).
Switches Windows routing when the primary link degrades.
Logs all readings and failover events to Supabase.

MUST be run as Administrator (required for Set-NetIPInterface).

Usage:
    python monitor.py
"""

import os
import re
import subprocess
import time
import socket
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

# ─────────────────────────────────────────────────────────────────────────────
# Load config from .env
# ─────────────────────────────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY")
PRIMARY_IF    = os.getenv("PRIMARY_INTERFACE", "Ethernet")      # 5G
BACKUP_IF     = os.getenv("BACKUP_INTERFACE",  "Wi-Fi")         # 4G
PRIMARY_LABEL = os.getenv("PRIMARY_LABEL",     "5G Ethernet")
BACKUP_LABEL  = os.getenv("BACKUP_LABEL",      "4G WiFi")
LATENCY_THRESH   = float(os.getenv("LATENCY_THRESHOLD_MS",           "150"))
LOSS_THRESH      = float(os.getenv("PACKET_LOSS_THRESHOLD_PERCENT",  "20"))
POLL_INTERVAL    = float(os.getenv("POLL_INTERVAL_SECONDS",          "5"))
RECOVERY_CHECKS  = int(  os.getenv("RECOVERY_CHECKS",               "3"))
PING_TARGET      = os.getenv("PING_TARGET", "8.8.8.8")

# ─────────────────────────────────────────────────────────────────────────────
# Supabase client
# ─────────────────────────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─────────────────────────────────────────────────────────────────────────────
# State
# ─────────────────────────────────────────────────────────────────────────────
active_interface = "primary"   # "primary" | "backup"
recovery_counter = 0           # counts consecutive good readings when on backup


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_interface_ip(interface_alias: str) -> str | None:
    """Get the IPv4 address bound to a named Windows network interface."""
    try:
        result = subprocess.run(
            ["powershell", "-Command",
             f'(Get-NetIPAddress -InterfaceAlias "{interface_alias}" '
             f'-AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress'],
            capture_output=True, text=True, timeout=10
        )
        ip = result.stdout.strip()
        return ip if ip else None
    except Exception as e:
        print(f"[WARN] Could not get IP for {interface_alias}: {e}")
        return None


def ping_interface(interface_alias: str, source_ip: str | None) -> dict:
    """
    Ping PING_TARGET via a specific interface.
    Returns: { latency_ms: float|None, packet_loss: float }
    """
    PACKETS = 4

    if source_ip is None:
        # Interface has no IP (disconnected)
        return {"latency_ms": None, "packet_loss": 100.0}

    try:
        # Windows ping with -S to bind to a specific source IP
        result = subprocess.run(
            ["ping", "-n", str(PACKETS), "-S", source_ip, PING_TARGET],
            capture_output=True, text=True, timeout=20
        )
        output = result.stdout

        # Parse packet loss
        loss_match = re.search(r"(\d+)%\s+loss", output)
        packet_loss = float(loss_match.group(1)) if loss_match else 100.0

        # Parse average latency
        avg_match = re.search(r"Average\s*=\s*(\d+)ms", output)
        if avg_match:
            latency_ms = float(avg_match.group(1))
        else:
            latency_ms = None  # No response

        return {"latency_ms": latency_ms, "packet_loss": packet_loss}

    except subprocess.TimeoutExpired:
        return {"latency_ms": None, "packet_loss": 100.0}
    except Exception as e:
        print(f"[WARN] Ping error on {interface_alias}: {e}")
        return {"latency_ms": None, "packet_loss": 100.0}


def is_degraded(ping_result: dict) -> bool:
    """Returns True if a ping result exceeds the configured thresholds."""
    if ping_result["packet_loss"] >= LOSS_THRESH:
        return True
    if ping_result["latency_ms"] is None:
        return True
    if ping_result["latency_ms"] >= LATENCY_THRESH:
        return True
    return False


def set_interface_metric(interface_alias: str, metric: int):
    """Change the Windows routing metric for an interface (requires Admin)."""
    try:
        subprocess.run(
            ["powershell", "-Command",
             f'Set-NetIPInterface -InterfaceAlias "{interface_alias}" '
             f'-InterfaceMetric {metric}'],
            capture_output=True, text=True, timeout=10, check=True
        )
        print(f"[ROUTE] Set {interface_alias} metric → {metric}")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Failed to set metric for {interface_alias}: {e.stderr}")


def insert_network_reading(interface_label: str, ping_result: dict, is_active: bool):
    """Insert a single network reading row into Supabase."""
    healthy = not is_degraded(ping_result)
    try:
        supabase.table("network_readings").insert({
            "interface":   interface_label,
            "latency_ms":  ping_result["latency_ms"],
            "packet_loss": ping_result["packet_loss"],
            "is_active":   is_active,
            "is_healthy":  healthy,
        }).execute()
    except Exception as e:
        print(f"[WARN] Failed to insert network reading: {e}")


def insert_failover_event(event_type: str, from_label: str, to_label: str,
                          reason: str, latency: float | None, loss: float):
    """Insert a failover event row into Supabase."""
    try:
        supabase.table("failover_events").insert({
            "event_type":            event_type,
            "from_interface":        from_label,
            "to_interface":          to_label,
            "reason":                reason,
            "latency_at_switch":     latency,
            "packet_loss_at_switch": loss,
        }).execute()
        print(f"[SUPABASE] Logged failover event: {event_type}")
    except Exception as e:
        print(f"[WARN] Failed to insert failover event: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Startup: set initial routing (primary = 5G = lower metric)
# ─────────────────────────────────────────────────────────────────────────────

def initialize_routing():
    print(f"[INIT] Setting initial routing: {PRIMARY_IF} (metric=10), {BACKUP_IF} (metric=50)")
    set_interface_metric(PRIMARY_IF, 10)
    set_interface_metric(BACKUP_IF, 50)


# ─────────────────────────────────────────────────────────────────────────────
# Main monitoring loop
# ─────────────────────────────────────────────────────────────────────────────

def main():
    global active_interface, recovery_counter

    print("=" * 60)
    print("  Soyza Project — Network Monitor & Failover")
    print("=" * 60)
    print(f"  Primary  : {PRIMARY_LABEL} ({PRIMARY_IF})")
    print(f"  Backup   : {BACKUP_LABEL} ({BACKUP_IF})")
    print(f"  Target   : {PING_TARGET}")
    print(f"  Threshold: latency > {LATENCY_THRESH}ms | loss > {LOSS_THRESH}%")
    print(f"  Poll     : every {POLL_INTERVAL}s")
    print("=" * 60)

    initialize_routing()

    while True:
        now = datetime.now().strftime("%H:%M:%S")

        # Get current IPs for both interfaces
        primary_ip = get_interface_ip(PRIMARY_IF)
        backup_ip  = get_interface_ip(BACKUP_IF)

        # Ping both interfaces
        primary_result = ping_interface(PRIMARY_IF, primary_ip)
        backup_result  = ping_interface(BACKUP_IF,  backup_ip)

        primary_active = (active_interface == "primary")
        backup_active  = (active_interface == "backup")

        # Print status
        p_lat  = f"{primary_result['latency_ms']:.0f}ms" if primary_result["latency_ms"] is not None else "UNREACHABLE"
        b_lat  = f"{backup_result['latency_ms']:.0f}ms"  if backup_result["latency_ms"]  is not None else "UNREACHABLE"
        p_loss = f"{primary_result['packet_loss']:.0f}%"
        b_loss = f"{backup_result['packet_loss']:.0f}%"
        active_label = PRIMARY_LABEL if primary_active else BACKUP_LABEL

        print(f"[{now}] Active: {active_label}")
        print(f"  {PRIMARY_LABEL}: latency={p_lat}  loss={p_loss}")
        print(f"  {BACKUP_LABEL}:  latency={b_lat}  loss={b_loss}")

        # Log readings to Supabase
        insert_network_reading(PRIMARY_LABEL, primary_result, is_active=primary_active)
        insert_network_reading(BACKUP_LABEL,  backup_result,  is_active=backup_active)

        # ── Failover Decision ──────────────────────────────────────────────
        if active_interface == "primary" and is_degraded(primary_result):
            # Primary is bad → switch to backup
            reason = (
                f"Latency {p_lat} exceeded {LATENCY_THRESH}ms threshold"
                if primary_result["latency_ms"] and primary_result["latency_ms"] >= LATENCY_THRESH
                else f"Packet loss {p_loss} exceeded {LOSS_THRESH}% threshold"
            )
            print(f"\n[FAILOVER] ⚠️  {reason}")
            print(f"[FAILOVER] Switching: {PRIMARY_LABEL} → {BACKUP_LABEL}")

            set_interface_metric(PRIMARY_IF, 100)   # demote primary
            set_interface_metric(BACKUP_IF,  10)    # promote backup

            active_interface = "backup"
            recovery_counter = 0

            insert_failover_event(
                event_type="SWITCH_TO_BACKUP",
                from_label=PRIMARY_LABEL,
                to_label=BACKUP_LABEL,
                reason=reason,
                latency=primary_result["latency_ms"],
                loss=primary_result["packet_loss"],
            )
            print(f"[FAILOVER] ✅ Now routing via {BACKUP_LABEL}\n")

        elif active_interface == "backup":
            # We're on backup — check if primary has recovered
            if not is_degraded(primary_result):
                recovery_counter += 1
                print(f"[RECOVERY] Primary looks healthy ({recovery_counter}/{RECOVERY_CHECKS} checks)")
                if recovery_counter >= RECOVERY_CHECKS:
                    # Primary has been good for enough consecutive checks → restore
                    reason = f"Primary recovered: latency={p_lat}, loss={p_loss}"
                    print(f"\n[RECOVERY] ✅ Restoring primary: {BACKUP_LABEL} → {PRIMARY_LABEL}")

                    set_interface_metric(PRIMARY_IF, 10)   # restore primary
                    set_interface_metric(BACKUP_IF,  50)   # demote backup

                    active_interface = "primary"
                    recovery_counter = 0

                    insert_failover_event(
                        event_type="RESTORED_PRIMARY",
                        from_label=BACKUP_LABEL,
                        to_label=PRIMARY_LABEL,
                        reason=reason,
                        latency=primary_result["latency_ms"],
                        loss=primary_result["packet_loss"],
                    )
                    print(f"[RECOVERY] ✅ Now routing via {PRIMARY_LABEL}\n")
            else:
                # Primary still bad on backup — reset recovery counter
                recovery_counter = 0

        print()
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
