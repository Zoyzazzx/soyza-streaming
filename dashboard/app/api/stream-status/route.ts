import { NextResponse } from "next/server";

/**
 * Proxies the MediaMTX REST API so the browser doesn't need to
 * call localhost:9997 directly (which would fail from a deployed origin).
 * GET /api/stream-status → returns MediaMTX path list
 */
export async function GET() {
  const MEDIAMTX_API = process.env.NEXT_PUBLIC_MEDIAMTX_API || "http://localhost:9997";

  try {
    const res = await fetch(`${MEDIAMTX_API}/v3/paths/list`, {
      // Short timeout — if MediaMTX is offline we want a fast "offline" response
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      return NextResponse.json({ online: false, paths: [] }, { status: 200 });
    }

    const data = await res.json();
    const paths: Array<{ name: string; ready: boolean }> = data.items ?? [];
    const streamPath = paths.find((p) => p.name === "live/stream");

    return NextResponse.json({
      online: true,
      streaming: streamPath?.ready ?? false,
      paths: paths.map((p) => ({ name: p.name, ready: p.ready })),
    });
  } catch {
    // MediaMTX not running
    return NextResponse.json({ online: false, streaming: false, paths: [] });
  }
}
