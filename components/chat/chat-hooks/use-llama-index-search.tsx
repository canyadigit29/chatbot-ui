import { ChatbotUIContext } from "@/context/context"
import { useContext } from "react"

export const useLlamaIndexSearch = () => {
  const { setIsGenerating } = useContext(ChatbotUIContext)

  const searchWithLlamaIndex = async (query: string) => {
    try {
      setIsGenerating(true)
      
      // Get the LlamaIndex backend URL from environment variables
      const llamaIndexUrl = process.env.NEXT_PUBLIC_LLAMAINDEX_URL || 
        "https://llamaindex-production-633d.up.railway.app"

      // Forward the request to the LlamaIndex backend
      const response = await fetch(`${llamaIndexUrl}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
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
      return result.answer
    } catch (error) {
      console.error("Error using LlamaIndex search:", error)
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  return { searchWithLlamaIndex }
}
