import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Checks if the stream is currently active.
 * 1. Checks local MediaMTX REST API if reachable.
 * 2. If running on Netlify in Tunneled mode, directly probes the Cloudflare Tunnel HLS endpoint!
 *    This gives 100% real-time ground truth whether video packets are actively arriving from your PC.
 * 3. Checks Supabase system_settings as a fallback.
 */
export async function GET() {
  const MEDIAMTX_API = process.env.NEXT_PUBLIC_MEDIAMTX_API || "http://localhost:9997";

  // 1. Attempt local MediaMTX REST API (when running on broadcaster PC)
  try {
    const res = await fetch(`${MEDIAMTX_API}/v3/paths/list`, {
      signal: AbortSignal.timeout(1200),
    });

    if (res.ok) {
      const data = await res.json();
      const paths: Array<{ name: string; ready: boolean }> = data.items ?? [];
      const streamPath = paths.find((p) => p.name === "live/stream");

      return NextResponse.json({
        online: true,
        streaming: streamPath?.ready ?? false,
        paths: paths.map((p) => ({ name: p.name, ready: p.ready })),
      });
    }
  } catch {
    // Local port 9997 unreachable (common on Netlify)
  }

  // 2. Proactive Cloudflare Tunnel Probe (Perfect for Netlify)
  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["use_tunnel", "hls_tunnel_url", "is_streaming"]);

      if (data && data.length > 0) {
        const map = new Map(data.map((item: any) => [item.key, item.value]));
        const useTunnel = map.get("use_tunnel") === "true";
        const tunnelUrl = (map.get("hls_tunnel_url") || "").trim().replace(/\/+$/, "");
        const isStreamingSetting = map.get("is_streaming") === "true";

        // If in tunneled mode and we have a tunnel URL, directly test the HLS index
        if (useTunnel && tunnelUrl) {
          try {
            const probeRes = await fetch(`${tunnelUrl}/live/stream/index.m3u8`, {
              method: "GET",
              redirect: "follow",
              signal: AbortSignal.timeout(2500),
            });

            if (probeRes.ok) {
              return NextResponse.json({
                online: true,
                streaming: true,
                source: "tunnel-probe",
                paths: [{ name: "live/stream", ready: true }],
              });
            }
          } catch {
            // Tunnel probe timeout / unreachable
          }
        }

        // Fallback to is_streaming flag from Supabase
        return NextResponse.json({
          online: true,
          streaming: isStreamingSetting,
          source: "supabase",
          paths: isStreamingSetting ? [{ name: "live/stream", ready: true }] : [],
        });
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ online: false, streaming: false, paths: [] });
}
