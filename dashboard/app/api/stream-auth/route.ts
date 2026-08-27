import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST: Verify credentials submitted by the viewer
export async function POST(req: Request) {
  try {
    const { streamId, password } = await req.json();
    if (!streamId || !password) {
      return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check database
    const { data, error } = await supabase
      .from("stream_credentials")
      .select("stream_id, password")
      .eq("id", 1)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "No active stream found" }, { status: 404 });
    }

    if (data.stream_id === streamId && data.password === password) {
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
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Update the credentials (called by the Broadcaster)
export async function PUT(req: Request) {
  try {
    const { streamId, password } = await req.json();
    
    if (!streamId || !password) {
      return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error } = await supabase
      .from("stream_credentials")
      .upsert({
        id: 1,
        stream_id: streamId,
        password: password,
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// GET: Check if user is authenticated
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("stream_access_token");
  
  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const [streamId, password] = token.value.split(":");
  const supabase = createClient(supabaseUrl, supabaseKey);
    
  const { data } = await supabase
    .from("stream_credentials")
    .select("stream_id, password")
    .eq("id", 1)
    .single();

  if (data && data.stream_id === streamId && data.password === password) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false });
}
