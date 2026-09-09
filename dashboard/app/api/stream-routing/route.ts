import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let inMemoryRouting = {
  routingMode: "local" as "local" | "tunneled",
  tunnelUrl: "",
  updatedAt: new Date().toISOString(),
};

/**
 * GET: Retrieve active stream routing mode & tunnel URL from Supabase system_settings
 */
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["use_tunnel", "hls_tunnel_url"]);

    if (!error && data && data.length > 0) {
      const settingsMap = new Map(data.map((item: any) => [item.key, item.value]));
      const useTunnel = settingsMap.get("use_tunnel") === "true";
      const tunnelUrl = settingsMap.get("hls_tunnel_url") || "";

      return NextResponse.json({
        routingMode: useTunnel ? "tunneled" : "local",
        tunnelUrl: tunnelUrl,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(inMemoryRouting);
  } catch {
    return NextResponse.json(inMemoryRouting);
  }
}

/**
 * POST: Update the routing mode and tunnel URL into Supabase system_settings
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { routingMode, tunnelUrl } = body;

    const isTunneled = routingMode === "tunneled";
    const cleanTunnelUrl = (tunnelUrl || "").trim().replace(/\/+$/, "");

    inMemoryRouting = {
      routingMode: isTunneled ? "tunneled" : "local",
      tunnelUrl: cleanTunnelUrl,
      updatedAt: new Date().toISOString(),
    };

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Upsert into Supabase system_settings table
    const updates = [
      {
        key: "use_tunnel",
        value: isTunneled ? "true" : "false",
        updated_at: new Date().toISOString(),
      },
      {
        key: "hls_tunnel_url",
        value: cleanTunnelUrl,
        updated_at: new Date().toISOString(),
      },
    ];

    await supabase.from("system_settings").upsert(updates, { onConflict: "key" });

    return NextResponse.json({
      success: true,
      routingMode: inMemoryRouting.routingMode,
      tunnelUrl: inMemoryRouting.tunnelUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
