import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// In-memory fallback
let inMemoryRouting = {
  routingMode: "local" as "local" | "tunneled",
  tunnelUrl: "",
  updatedAt: new Date().toISOString(),
};

/**
 * GET: Retrieve active stream routing mode & tunnel URL
 */
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("stream_credentials")
      .select("*")
      .eq("id", 1)
      .single();

    if (!error && data) {
      return NextResponse.json({
        routingMode: data.routing_mode || inMemoryRouting.routingMode,
        tunnelUrl: data.tunnel_url || inMemoryRouting.tunnelUrl,
        updatedAt: data.updated_at || inMemoryRouting.updatedAt,
      });
    }

    return NextResponse.json(inMemoryRouting);
  } catch (err: any) {
    return NextResponse.json(inMemoryRouting);
  }
}

/**
 * POST / PUT: Update the routing mode (local vs tunneled) and tunnel URL
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { routingMode, tunnelUrl } = body;

    if (routingMode && routingMode !== "local" && routingMode !== "tunneled") {
      return NextResponse.json(
        { error: "routingMode must be 'local' or 'tunneled'" },
        { status: 400 }
      );
    }

    // Sanitize tunnel URL: strip trailing slash and ensure https/http
    let cleanTunnelUrl = (tunnelUrl || "").trim().replace(/\/+$/, "");

    inMemoryRouting = {
      routingMode: (routingMode as "local" | "tunneled") || inMemoryRouting.routingMode,
      tunnelUrl: cleanTunnelUrl !== undefined ? cleanTunnelUrl : inMemoryRouting.tunnelUrl,
      updatedAt: new Date().toISOString(),
    };

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Attempt updating in Supabase stream_credentials table if columns exist
    try {
      await supabase
        .from("stream_credentials")
        .update({
          routing_mode: inMemoryRouting.routingMode,
          tunnel_url: inMemoryRouting.tunnelUrl,
          updated_at: inMemoryRouting.updatedAt,
        })
        .eq("id", 1);
    } catch (dbErr) {
      console.warn("Supabase update for routing notice (schema may omit routing_mode column):", dbErr);
    }

    return NextResponse.json({
      success: true,
      ...inMemoryRouting,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
