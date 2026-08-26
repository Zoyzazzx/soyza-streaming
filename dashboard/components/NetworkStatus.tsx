"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface NetworkReading {
  id: number;
  created_at: string;
  interface: string;
  latency_ms: number | null;
  packet_loss: number;
  is_active: boolean;
  is_healthy: boolean;
}

// Consolidate the two most recent readings (one per interface) for display
function getLatestPerInterface(readings: NetworkReading[]) {
  const map = new Map<string, NetworkReading>();
  for (const r of readings) {
    if (!map.has(r.interface)) map.set(r.interface, r);
  }
  return Array.from(map.values());
}

function StatusDot({ healthy }: { healthy: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${
        healthy ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
      }`}
    />
  );
}

function LatencyBar({ latencyMs, threshold = 150 }: { latencyMs: number | null; threshold?: number }) {
  if (latencyMs === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10">
          <div className="h-full w-full rounded-full bg-red-500/60" />
        </div>
        <span className="text-xs text-red-400 w-20 text-right">UNREACHABLE</span>
      </div>
    );
  }

  const pct = Math.min((latencyMs / (threshold * 2)) * 100, 100);
  const color = latencyMs < threshold * 0.5
    ? "bg-emerald-400"
    : latencyMs < threshold
    ? "bg-yellow-400"
    : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-white/60 w-16 text-right tabular-nums">{latencyMs.toFixed(0)} ms</span>
    </div>
  );
}

export default function NetworkStatus() {
  const [readings, setReadings] = useState<NetworkReading[]>([]);
  const supabase = createClient();

  // Initial fetch
  useEffect(() => {
    supabase
      .from("network_readings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setReadings(data);
      });
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("network-readings-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "network_readings" },
        (payload) => {
          setReadings((prev) => [payload.new as NetworkReading, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const latest = getLatestPerInterface(readings);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Network Status</h2>
        <span className="text-xs text-white/30 tabular-nums">
          {readings[0]
            ? new Date(readings[0].created_at).toLocaleTimeString()
            : "—"}
        </span>
      </div>

      {latest.length === 0 ? (
        <div className="flex items-center gap-2 text-white/30 text-sm py-4 justify-center">
          <div className="w-4 h-4 border border-white/20 border-t-transparent rounded-full animate-spin" />
          Waiting for monitor...
        </div>
      ) : (
        <div className="space-y-4">
          {latest.map((r) => (
            <div key={r.interface} className={`rounded-xl p-4 border transition-all ${
              r.is_active
                ? "border-indigo-500/40 bg-indigo-500/5"
                : "border-white/5 bg-white/3"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StatusDot healthy={r.is_healthy} />
                  <span className="text-sm font-medium text-white">{r.interface}</span>
                  {r.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      ACTIVE
                    </span>
                  )}
                </div>
                <span className={`text-xs font-medium ${r.is_healthy ? "text-emerald-400" : "text-red-400"}`}>
                  {r.is_healthy ? "Healthy" : "Degraded"}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-white/40 mb-1">Latency</p>
                  <LatencyBar latencyMs={r.latency_ms} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Packet Loss</span>
                  <span className={r.packet_loss > 20 ? "text-red-400" : "text-white/60"}>
                    {r.packet_loss.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
