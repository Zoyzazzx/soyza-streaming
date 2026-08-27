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
        healthy ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
      }`}
    />
  );
}

function LatencyBar({ latencyMs, threshold = 150 }: { latencyMs: number | null; threshold?: number }) {
  if (latencyMs === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200">
          <div className="h-full w-full rounded-full bg-red-500" />
        </div>
        <span className="text-xs font-semibold text-red-600 w-20 text-right">UNREACHABLE</span>
      </div>
    );
  }

  const pct = Math.min((latencyMs / (threshold * 2)) * 100, 100);
  const color = latencyMs < threshold * 0.5
    ? "bg-emerald-500"
    : latencyMs < threshold
    ? "bg-yellow-500"
    : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-16 text-right tabular-nums">{latencyMs.toFixed(0)} ms</span>
    </div>
  );
}

export default function NetworkStatus() {
  const [readings, setReadings] = useState<NetworkReading[]>([]);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const supabase = createClient();

  // Initial fetch and polling for readings
  useEffect(() => {
    const fetchReadings = () => {
      supabase
        .from("network_readings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }) => {
          if (data) setReadings(data);
        });
    };
    
    fetchReadings();
    const interval = setInterval(fetchReadings, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active config to filter out stale interfaces
  useEffect(() => {
    const fetchConfig = () => {
      fetch("/api/settings")
        .then(res => res.json())
        .then(data => {
          if (data.primaryLabel && data.backupLabel) {
            setActiveLabels([data.primaryLabel, data.backupLabel]);
          }
        })
        .catch(() => {});
    };
    fetchConfig();
    const interval = setInterval(fetchConfig, 5000);
    return () => clearInterval(interval);
  }, []);

  const latest = getLatestPerInterface(readings).filter(r => 
    activeLabels.length === 0 || activeLabels.includes(r.interface)
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Network Status</h2>
        <span className="text-xs font-medium text-gray-400 tabular-nums">
          {readings[0]
            ? new Date(readings[0].created_at).toLocaleTimeString()
            : "—"}
        </span>
      </div>

      {latest.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-400 font-medium text-sm py-4 justify-center">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          Waiting for monitor...
        </div>
      ) : (
        <div className="space-y-4">
          {latest.map((r) => (
            <div key={r.interface} className={`rounded-xl p-4 border transition-all ${
              r.is_active
                ? "border-indigo-200 bg-indigo-50/50 shadow-sm"
                : "border-gray-100 bg-gray-50"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StatusDot healthy={r.is_healthy} />
                  <span className="text-sm font-bold text-gray-900">{r.interface}</span>
                  {r.is_active && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                      ACTIVE
                    </span>
                  )}
                </div>
                <span className={`text-xs font-bold ${r.is_healthy ? "text-emerald-600" : "text-red-600"}`}>
                  {r.is_healthy ? "Healthy" : "Degraded"}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Latency</p>
                  <LatencyBar latencyMs={r.latency_ms} />
                </div>
                <div className="flex justify-between text-xs font-medium mt-1">
                  <span className="text-gray-500">Packet Loss</span>
                  <span className={r.packet_loss > 20 ? "text-red-600 font-bold" : "text-gray-700"}>
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
