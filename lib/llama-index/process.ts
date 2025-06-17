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

export async function deleteFileFromLlamaIndex(fileId: string) {
  try {
    const response = await fetch(`/api/llama-index/delete/${fileId}`, {
      method: "DELETE"
    })

    if (!response.ok) {
      const error = await response.json()
      console.warn(`Warning: LlamaIndex deletion issue: ${error.message || "Unknown error"}`)
      // We don't throw here to allow the frontend deletion to continue
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error deleting file from LlamaIndex:", error)
    // We don't rethrow to allow the frontend deletion to continue
    return { success: false, message: "Failed to delete from LlamaIndex" }
  }
}
