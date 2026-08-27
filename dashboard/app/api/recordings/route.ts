import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Create a Supabase client with the service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch all storage paths
    const { data: records, error: fetchError } = await supabase
      .from("recordings")
      .select("storage_path");

    if (fetchError) throw fetchError;

    const paths = records
      ?.map((r) => r.storage_path)
      .filter((path) => path) as string[];

    // 2. Delete from storage if we have paths
    if (paths && paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("recordings")
        .remove(paths);
      
      if (storageError) {
        console.error("Storage deletion error:", storageError);
      }
    }

    // 3. Delete from database
    const { error: dbError } = await supabase
      .from("recordings")
      .delete()
      .not("id", "is", null);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, message: "Recordings deleted" });
  } catch (error: any) {
    console.error("API error deleting recordings:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
