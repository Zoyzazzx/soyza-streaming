import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase admin configuration");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// GET: List all users and their assigned roles
export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.user_metadata?.role || "streamer", // default legacy/admin accounts to streamer
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));

    return NextResponse.json({ success: true, users: formattedUsers });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Create a new user (Viewer or Streamer)
export async function POST(req: Request) {
  try {
    const { email, password, role } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json(
        { success: false, error: "Email, password, and role are required." },
        { status: 400 }
      );
    }

    if (role !== "streamer" && role !== "viewer") {
      return NextResponse.json(
        { success: false, error: "Invalid role. Must be 'streamer' or 'viewer'." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true, // auto-confirm so user can log in immediately
      user_metadata: {
        role: role,
      },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || role,
        created_at: data.user.created_at,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Delete a user by ID
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "User deleted successfully." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
