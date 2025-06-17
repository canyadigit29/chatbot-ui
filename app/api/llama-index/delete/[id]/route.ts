import { NextResponse } from "next/server"

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const fileId = params.id

    if (!fileId) {
      return new NextResponse(
        JSON.stringify({ error: "File ID is required" }),
        { status: 400 }
      )
    }
    
    // Get the LlamaIndex backend URL from environment variables
    const llamaIndexUrl = process.env.NEXT_PUBLIC_LLAMAINDEX_URL || 
      "https://llamaindex-production-633d.up.railway.app"    // Forward the delete request to the LlamaIndex backend
    const response = await fetch(`${llamaIndexUrl}/delete/${fileId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${process.env.LLAMAINDEX_API_KEY || ""}`
      }
    })

    if (!response.ok) {
      // If the error is 404 (file not found in LlamaIndex), we can just continue
      // since it means the file wasn't indexed by LlamaIndex in the first place
      if (response.status === 404) {
        return NextResponse.json({ 
          success: true, 
          message: "File not found in LlamaIndex, continuing with deletion" 
        })
      }
      
      const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
      throw new Error(errorData.message || `Failed to delete file from LlamaIndex: ${response.statusText}`)
    }

    // Get the response from LlamaIndex
    const result = await response.json()
    
    // Return success
    return NextResponse.json({ 
      success: true, 
      message: "File deleted successfully from LlamaIndex", 
      ...result 
    })
    
  } catch (error: any) {
    console.error("Error deleting file from LlamaIndex:", error)
    
    // Return success anyway to allow the frontend to continue with its own deletion
    // This is important to prevent orphaned files in the frontend when LlamaIndex deletion fails
    return NextResponse.json({ 
      success: false,
      continued: true, 
      message: `Warning: File deletion in LlamaIndex failed: ${error.message}`,
      error: error.message
    })
  }
}
