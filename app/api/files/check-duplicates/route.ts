import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers" // Import cookies

export async function POST(request: Request) {
  const cookieStore = cookies() // Get cookie store
  const supabase = createClient(cookieStore) // Create Supabase client instance

  const { fileNames, workspaceId } = await request.json()

  if (!fileNames || !Array.isArray(fileNames) || !workspaceId) {
    return NextResponse.json(
      { error: "Missing fileNames array or workspaceId" },
      { status: 400 }
    )
  }

  try {
    const { data: existingFiles, error } = await supabase
      .from("files")
      .select("name")
      .in("name", fileNames)
      .eq("workspace_id", workspaceId)

    if (error) {
      console.error("Error checking duplicate files:", error)
      return NextResponse.json(
        { error: "Error checking duplicate files", details: error.message },
        { status: 500 }
      )
    }

    const conflictingFileNames =
      existingFiles?.map((file: { name: string }) => file.name) || []

    return NextResponse.json({ conflictingFileNames }, { status: 200 })
  } catch (error: any) {
    console.error("Error in check-duplicates route:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
