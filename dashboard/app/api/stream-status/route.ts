import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Checks if the stream is currently active.
 * 1. Queries MediaMTX REST API if accessible (when running locally).
 * 2. If MediaMTX is not accessible (e.g. deployed on Netlify), checks Supabase system_settings.
 */
export async function GET() {
  const MEDIAMTX_API = process.env.NEXT_PUBLIC_MEDIAMTX_API || "http://localhost:9997";

  // Attempt local MediaMTX REST API first
  try {
    const res = await fetch(`${MEDIAMTX_API}/v3/paths/list`, {
      signal: AbortSignal.timeout(1500),
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

  // Fallback: Query Supabase system_settings for cloud-synced stream state
  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["is_streaming", "use_tunnel"]);

      if (!error && data) {
        const map = new Map(data.map((item: any) => [item.key, item.value]));
        const isStreaming = map.get("is_streaming") === "true";
        return NextResponse.json({
          online: true,
          streaming: isStreaming,
          source: "supabase",
          paths: isStreaming ? [{ name: "live/stream", ready: true }] : [],
        });
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ online: false, streaming: false, paths: [] });
}
