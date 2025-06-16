import { supabaseAdmin } from "@/lib/supabase/admin-client"
import { NextResponse } from "next/server"
import { getServerProfile } from "@/lib/server/server-chat-helpers"

export async function POST(req: Request) {
  try {
    const profile = await getServerProfile()
    if (!profile) {
      return new NextResponse(JSON.stringify({ message: "Unauthorized" }), {
        status: 401
      })
    }

    const { workspaceId, filenames } = (await req.json()) as {
      workspaceId: string
      filenames: string[]
    }

    if (!workspaceId || !filenames || filenames.length === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Missing workspaceId or filenames" }),
        {
          status: 400
        }
      )
    }

    const { data: existingFiles, error } = await supabaseAdmin
      .from("files")
      .select("name")
      .eq("workspace_id", workspaceId)
      .eq("user_id", profile.user_id)
      .in("name", filenames)

    if (error) {
      console.error("Error checking duplicates:", error)
      return new NextResponse(
        JSON.stringify({ message: "Error checking for duplicate files" }),
        {
          status: 500
        }
      )
    }

    const existingFilenames = existingFiles?.map(file => file.name) || []

    return NextResponse.json({ existingFilenames })
  } catch (error: any) {
    console.error("API Error check-duplicates:", error)
    const errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new NextResponse(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
