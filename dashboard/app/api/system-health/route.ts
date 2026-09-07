import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Health check endpoint for all 3 backend infrastructure components:
 * 1. MediaMTX (REST API proxy check on port 9997)
 * 2. Upload Worker (HTTP health check on port 4000)
 * 3. Network Monitor & Failover (Latest reading timestamp check in Supabase network_readings table)
 */
export async function GET() {
  const MEDIAMTX_API = process.env.NEXT_PUBLIC_MEDIAMTX_API || "http://localhost:9997";
  const WORKER_API = process.env.WORKER_API || "http://localhost:4000";
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // 1. MediaMTX Health Check
  const checkMediaMTX = async () => {
    try {
      const res = await fetch(`${MEDIAMTX_API}/v3/paths/list`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        const paths = data.items ?? [];
        const isStreaming = paths.some((p: any) => p.name === "live/stream" && p.ready);
        return { online: true, streaming: isStreaming, message: "Connected (port 9997)" };
      }
      return { online: false, streaming: false, message: `Response error: ${res.status}` };
    } catch {
      return { online: false, streaming: false, message: "Offline / Port 9997 unreachable" };
    }
  };

  // 2. Upload Worker Health Check
  const checkWorker = async () => {
    try {
      const res = await fetch(`${WORKER_API}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return { online: true, message: "Listening & Ready (port 4000)" };
      }
      return { online: false, message: `Response error: ${res.status}` };
    } catch {
      return { online: false, message: "Offline / Port 4000 unreachable" };
    }
  };

  // 3. Network Monitor / Connectivity Health Check (Heartbeat via Supabase)
  const checkMonitor = async () => {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return { online: false, message: "Missing Supabase configuration" };
      }
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data, error } = await supabase
        .from("network_readings")
        .select("created_at, interface, latency_ms, packet_loss, is_healthy, is_active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return { online: false, message: "No network readings found" };
      }

      // Check if last reading was within the last 20 seconds
      const lastPingTime = new Date(data.created_at).getTime();
      const now = Date.now();
      const diffSec = Math.floor((now - lastPingTime) / 1000);

      const isLive = diffSec <= 20;
      return {
        online: isLive,
        lastHeartbeatSecondsAgo: diffSec,
        lastReading: data,
        message: isLive
          ? `Active (${diffSec}s ago, ${data.interface})`
          : `Inactive (last seen ${diffSec}s ago)`,
      };
    } catch (err: any) {
      return { online: false, message: err.message || "Failed to check monitor heartbeat" };
    }
  };

  const [mediamtx, worker, monitor] = await Promise.all([
    checkMediaMTX(),
    checkWorker(),
    checkMonitor(),
  ]);

  const allHealthy = mediamtx.online && worker.online && monitor.online;

  return NextResponse.json({
    allHealthy,
    services: {
      mediamtx,
      worker,
      monitor,
    },
    timestamp: new Date().toISOString(),
  });
}
