import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error("Error getting session:", sessionError);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = sessionData.session.user;

  // workspaceId is received from the client, but not used in this query
  // as files table does not have a direct workspace_id column.
  // The check is based on user_id and filename.
  const { filenames /*, workspaceId */ } = await request.json();

  if (!filenames || !Array.isArray(filenames)) {
    return NextResponse.json(
      { error: "Missing filenames array" },
      { status: 400 }
    );
  }

  if (filenames.length === 0) {
    return NextResponse.json({ existingFilenames: [] }, { status: 200 });
  }

  try {
    const { data: existingFiles, error } = await supabase
      .from("files")
      .select("name")
      .eq("user_id", user.id) // Check against user_id
      .in("name", filenames);

    if (error) {
      console.error("Error checking duplicate files:", error);
      return NextResponse.json(
        { error: "Error checking duplicate files", details: error.message, code: error.code },
        { status: 500 }
      );
    }

    const existingFilenames = existingFiles?.map((file: { name: string }) => file.name) || [];
    return NextResponse.json({ existingFilenames }, { status: 200 });

  } catch (error: any) {
    console.error("Error in check-duplicates route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
