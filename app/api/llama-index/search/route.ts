import { ChatSettings } from "@/types"
import { StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { query, chatSettings } = json as {
    query: string
    chatSettings: ChatSettings
  }

  try {
    // Get the LlamaIndex backend URL from environment variables
    const llamaIndexUrl = process.env.NEXT_PUBLIC_LLAMAINDEX_URL || 
      "https://llamaindex-production-633d.up.railway.app"    // Forward the request to the LlamaIndex backend
    const response = await fetch(`${llamaIndexUrl}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.LLAMAINDEX_API_KEY || ""}`
      },
      body: JSON.stringify({
        question: query
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || "Failed to get response from LlamaIndex")
    }

    // Get the response from LlamaIndex
    const result = await response.json()
    
    // Return the result directly
    return new Response(JSON.stringify({ answer: result.answer }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error("LlamaIndex search error:", error)
    
    return new Response(
      JSON.stringify({ 
        message: `Error from LlamaIndex: ${error.message}`,
        error: true 
      }), 
      { status: 500 }
    )
  }
}
