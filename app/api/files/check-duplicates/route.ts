import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { filenames, workspaceId } = await request.json();

  if (!filenames || !Array.isArray(filenames) || !workspaceId) {
    return NextResponse.json(
      { error: "Missing filenames array or workspaceId" },
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
      .in("name", filenames)
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("Error checking duplicate files:", error);
      return NextResponse.json(
        { error: "Error checking duplicate files", details: error.message },
        { status: 500 }
      );
    }

    const existingFilenames =
      existingFiles?.map((file: { name: string }) => file.name) || [];
    return NextResponse.json({ existingFilenames }, { status: 200 });
  } catch (error: any) {
    console.error("Error in check-duplicates route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
