import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Default internal MediaMTX HLS base URL
const DEFAULT_MEDIAMTX_HLS =
  process.env.MEDIAMTX_HLS_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_HLS_URL?.replace(/\/live\/.*$/, "") ||
  "http://127.0.0.1:8888";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Determine the upstream target base:
 * 1. Checks if stream_credentials specifies a custom tunnel URL / routing_mode
 * 2. Falls back to DEFAULT_MEDIAMTX_HLS
 */
async function resolveUpstreamBase(): Promise<string> {
  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["use_tunnel", "hls_tunnel_url"]);

      if (data && data.length > 0) {
        const map = new Map(data.map((item: any) => [item.key, item.value]));
        if (map.get("use_tunnel") === "true" && map.get("hls_tunnel_url")) {
          return map.get("hls_tunnel_url")!.replace(/\/+$/, "");
        }
      }
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_MEDIAMTX_HLS;
}

/**
 * Catch-all proxy route for HLS streams:
 * Example:
 *   /api/streams/live/stream/index.m3u8
 *   /api/streams/live/stream/seg0.ts
 *   /api/streams/live/stream/init.mp4
 *   /api/streams/live/stream/stream_0_0.m4s
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;
    if (!path || path.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const subPath = path.join("/");
    const search = req.nextUrl.search;
    const upstreamBase = await resolveUpstreamBase();
    const targetUrl = `${upstreamBase}/${subPath}${search}`;

    // Forward range header if present (for seeking / players)
    const headers: Record<string, string> = {
      Accept: "*/*",
    };
    const range = req.headers.get("range");
    if (range) {
      headers["range"] = range;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(6000),
    });

    if (!upstreamRes.ok) {
      return new NextResponse(`Upstream error: ${upstreamRes.statusText}`, {
        status: upstreamRes.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const contentType =
      upstreamRes.headers.get("content-type") ||
      (subPath.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : subPath.endsWith(".ts")
        ? "video/mp2t"
        : subPath.endsWith(".m4s") || subPath.endsWith(".mp4")
        ? "video/mp4"
        : "application/octet-stream");

    // If it's a playlist (.m3u8), rewrite relative chunk URLs to stay on our proxy
    if (
      subPath.endsWith(".m3u8") ||
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegurl")
    ) {
      const playlistText = await upstreamRes.text();
      const origin = req.headers.get("x-forwarded-proto")
        ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("host")}`
        : req.nextUrl.origin;
      const basePathSegments = path.slice(0, -1);
      const proxyBasePath = `${origin}/api/streams/${basePathSegments.join("/")}`;

      // Rewrite line-by-line: any line that isn't a comment/tag and not an absolute URL
      const rewrittenLines = playlistText.split("\n").map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          // Check for URI in tags like #EXT-X-MAP:URI="init.mp4"
          return line.replace(/URI="([^"]+)"/g, (_, uri) => {
            if (uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("/")) {
              return `URI="${uri}"`;
            }
            return `URI="${proxyBasePath}/${uri}"`;
          });
        }
        // Segment file line
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
          return line;
        }
        return `${proxyBasePath}/${trimmed}`;
      });

      return new NextResponse(rewrittenLines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // Binary segment streaming (.ts, .m4s, .mp4)
    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "public, max-age=3600",
    };

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }
    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) {
      responseHeaders["Content-Range"] = contentRange;
    }

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch {
    return new NextResponse("Stream unavailable or MediaMTX offline", {
      status: 503,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
