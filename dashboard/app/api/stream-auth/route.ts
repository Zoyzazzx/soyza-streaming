import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// In-memory fallback if database table columns are being updated
let streamMeta = {
  streamId: "123456",
  password: "admin",
  isPublic: false,
  title: "Live Stream Broadcast",
  recordEnabled: true,
};

// POST: Verify credentials submitted by the viewer
export async function POST(req: Request) {
  try {
    const { streamId, password } = await req.json();
    if (!streamId || !password) {
      return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check database
    const { data } = await supabase
      .from("stream_credentials")
      .select("*")
      .eq("id", 1)
      .single();

    const expectedStreamId = data?.stream_id || streamMeta.streamId;
    const expectedPassword = data?.password || streamMeta.password;

    if (expectedStreamId === streamId && expectedPassword === password) {
      // Set secure HTTP-only cookie
      const cookieStore = await cookies();
      cookieStore.set("stream_access_token", `${streamId}:${password}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Invalid stream ID or password" }, { status: 401 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Update the credentials & stream settings (called by Broadcaster)
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { streamId, password, isPublic, title, recordEnabled } = body;
    
    streamMeta = {
      streamId: streamId || streamMeta.streamId,
      password: password || streamMeta.password,
      isPublic: isPublic !== undefined ? isPublic : streamMeta.isPublic,
      title: title || streamMeta.title,
      recordEnabled: recordEnabled !== undefined ? recordEnabled : streamMeta.recordEnabled,
    };

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try updating DB (gracefully ignoring if schema lacks new columns)
    try {
      await supabase
        .from("stream_credentials")
        .upsert({
          id: 1,
          stream_id: streamMeta.streamId,
          password: streamMeta.password,
          updated_at: new Date().toISOString()
        });
    } catch (e) {
      console.warn("DB credentials sync notice:", e);
    }

    return NextResponse.json({ success: true, streamMeta });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// GET: Check stream privacy and viewer authentication state
export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check Supabase system_settings for cloud-synced public mode & title
  let isPublicMode = streamMeta.isPublic;
  let activeTitle = streamMeta.title;

  try {
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["is_public", "stream_title"]);

    if (settingsData && settingsData.length > 0) {
      const map = new Map(settingsData.map((item: any) => [item.key, item.value]));
      if (map.has("is_public")) {
        isPublicMode = map.get("is_public") === "true";
      }
      if (map.has("stream_title")) {
        activeTitle = map.get("stream_title") || activeTitle;
      }
    }
  } catch {}

  // If public, viewers can access immediately
  if (isPublicMode) {
    return NextResponse.json({
      authenticated: true,
      isPublic: true,
      title: activeTitle,
      streamId: streamMeta.streamId,
      recordEnabled: streamMeta.recordEnabled
    });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("stream_access_token");
  
  if (!token) {
    return NextResponse.json({
      authenticated: false,
      isPublic: false,
      title: activeTitle,
    });
  }

  const [streamId, password] = token.value.split(":");
    
  const { data } = await supabase
    .from("stream_credentials")
    .select("stream_id, password")
    .eq("id", 1)
    .single();

  const expectedStreamId = data?.stream_id || streamMeta.streamId;
  const expectedPassword = data?.password || streamMeta.password;

  if (expectedStreamId === streamId && expectedPassword === password) {
    return NextResponse.json({
      authenticated: true,
      isPublic: false,
      title: streamMeta.title,
      streamId: streamMeta.streamId,
      recordEnabled: streamMeta.recordEnabled
    });
  }

  return NextResponse.json({
    authenticated: false,
    isPublic: false,
    title: streamMeta.title,
  });
}

// DELETE: Delete / Discard the active stream configuration
export async function DELETE() {
  try {
    streamMeta = {
      streamId: "",
      password: "",
      isPublic: false,
      title: "Live Stream Broadcast",
      recordEnabled: true,
    };

    const supabase = createClient(supabaseUrl, supabaseKey);
    try {
      await supabase
        .from("stream_credentials")
        .upsert({
          id: 1,
          stream_id: "",
          password: "",
          updated_at: new Date().toISOString()
        });
    } catch (e) {
      console.warn("DB credentials delete notice:", e);
    }

    return NextResponse.json({ success: true, message: "Stream deleted and reset." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
