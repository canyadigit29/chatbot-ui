import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { fileId } = body
    
    if (!fileId) {
      return new NextResponse(JSON.stringify({ error: "File ID is required" }), {
        status: 400
      })
    }
    
    // Define max file size (30MB)
    const MAX_FILE_SIZE = 30 * 1024 * 1024;
    
    const profile = await getServerProfile()
    
    // Create a Supabase client with the service role key to get file details
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the file details from the Supabase database
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("id", fileId)
      .single()
    
    if (fileError || !fileData) {
      return new NextResponse(
        JSON.stringify({ error: `Failed to find file: ${fileError?.message || "File not found"}` }),
        { status: 404 }
      )
    }
    
    // Make sure the user owns this file
    if (fileData.user_id !== profile.user_id) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized: You do not have access to this file" }),
        { status: 403 }
      )
    }
    
    // Check file size
    if (fileData.size > MAX_FILE_SIZE) {
      return new NextResponse(
        JSON.stringify({ 
          error: `File is too large (${Math.round(fileData.size/1024/1024)}MB). Maximum size is ${Math.round(MAX_FILE_SIZE/1024/1024)}MB.` 
        }),
        { status: 413 }
      )
    }
    
    // Get the LlamaIndex backend URL from environment variables
    const llamaIndexUrl = process.env.NEXT_PUBLIC_LLAMAINDEX_URL || 
      "https://llamaindex-production-633d.up.railway.app"

    // Forward the request to the LlamaIndex backend
    const response = await fetch(`${llamaIndexUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file_id: fileId,
        supabase_file_path: fileData.file_path,
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        description: fileData.description,
        user_id: fileData.user_id
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
      throw new Error(errorData.message || `Failed to process file with LlamaIndex: ${response.statusText}`)
    }

    // Get the response from LlamaIndex
    const result = await response.json()
    
    // Return success
    return NextResponse.json({ success: true, message: "File processed successfully by LlamaIndex", ...result })
    
  } catch (error: any) {
    console.error("Error processing file with LlamaIndex:", error)
    
    return new NextResponse(
      JSON.stringify({ 
        error: true,
        message: `Error from LlamaIndex: ${error.message}`
      }), 
      { status: 500 }
    )
  }
}
