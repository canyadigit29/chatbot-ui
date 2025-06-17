import { ChatSettings } from "@/types"

export async function handleLlamaIndexSearch(
  query: string,
  chatSettings: ChatSettings
) {
  try {
    const response = await fetch("/api/llama-index/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        chatSettings
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to search with LlamaIndex")
    }

    const data = await response.json()
    return data.answer
  } catch (error) {
    console.error("Error using LlamaIndex search:", error)
    throw error
  }
}

// This function detects if the message is asking for semantic search
export function isSemanticSearchRequest(message: string): boolean {
  // Convert to lowercase for case-insensitive matching
  const lowerMessage = message.toLowerCase()
  
  // Check for various search intent patterns
  return (
    // Explicit commands
    lowerMessage.startsWith("/search") ||
    lowerMessage.startsWith("/find") ||
    lowerMessage.startsWith("/lookup") ||
    
    // Natural language patterns
    lowerMessage.includes("search for") ||
    lowerMessage.includes("find information about") ||
    lowerMessage.includes("look up") ||
    lowerMessage.includes("search the documents for") ||
    lowerMessage.includes("search my documents for") ||
    
    // Question patterns that likely need search
    (lowerMessage.includes("document") && 
     (lowerMessage.includes("what") || 
      lowerMessage.includes("where") || 
      lowerMessage.includes("how") || 
      lowerMessage.includes("when") || 
      lowerMessage.includes("who")))
  )
}
