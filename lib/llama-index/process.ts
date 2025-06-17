import { ChatSettings } from "@/types"

export async function processFileWithLlamaIndex(fileId: string) {
  try {
    const response = await fetch("/api/llama-index/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fileId
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to process file with LlamaIndex")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error processing file with LlamaIndex:", error)
    throw error
  }
}
