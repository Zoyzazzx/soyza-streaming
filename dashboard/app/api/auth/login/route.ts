import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { email, password, activeTab } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { success: false, error: signInError.message },
        { status: 401 }
      );
    }

    const userRole = data.user?.user_metadata?.role || "streamer";

    if (activeTab === "streamer" && userRole === "viewer") {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          success: false,
          error: "Access Denied: This account only has Viewer privileges. Please use the Viewer Login tab.",
        },
        { status: 403 }
      );
    }

    const redirectUrl = activeTab === "viewer" || userRole === "viewer" ? "/viewer" : "/";

    return NextResponse.json({
      success: true,
      role: userRole,
      redirectUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
