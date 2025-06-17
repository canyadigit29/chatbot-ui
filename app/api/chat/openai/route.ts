import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { isSemanticSearchRequest } from "@/lib/llama-index/search"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    // Check if this is a search request by looking at the last user message
    const lastUserMessage = messages.findLast((msg) => msg.role === "user");
    const isSearchRequest = lastUserMessage && isSemanticSearchRequest(lastUserMessage.content);

    // If this is a search request, redirect to LlamaIndex
    if (isSearchRequest && lastUserMessage) {
      console.log("Detected search request, using LlamaIndex backend");
      
      // Get the LlamaIndex backend URL from environment variables
      const llamaIndexUrl = process.env.NEXT_PUBLIC_LLAMAINDEX_URL || 
        "https://llamaindex-production-633d.up.railway.app";

      try {
        // Forward the request to the LlamaIndex backend
        const llamaResponse = await fetch(`${llamaIndexUrl}/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            question: lastUserMessage.content
          })
        });

        if (!llamaResponse.ok) {
          const errorData = await llamaResponse.json();
          throw new Error(errorData.message || "Failed to get response from LlamaIndex");
        }

        // Get the response from LlamaIndex
        const result = await llamaResponse.json();
        
        // Create a "fake" stream that just returns the LlamaIndex result
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(encoder.encode(result.answer));
            controller.close();
          }
        });

        return new StreamingTextResponse(stream);
      } catch (llamaError: any) {
        console.error("LlamaIndex search error:", llamaError);
        
        // Fall back to OpenAI if LlamaIndex fails
        console.log("Falling back to OpenAI due to LlamaIndex error");
      }
    }

    // Regular OpenAI processing
    const profile = await getServerProfile()

    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    const response = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages: messages as ChatCompletionCreateParamsBase["messages"],
      temperature: chatSettings.temperature,
      max_tokens:
        chatSettings.model === "gpt-4-vision-preview" ||
        chatSettings.model === "gpt-4o"
          ? 4096
          : null, // TODO: Fix
      stream: true
    })

    const stream = OpenAIStream(response)

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "OpenAI API Key not found. Please set it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("incorrect api key")) {
      errorMessage =
        "OpenAI API Key is incorrect. Please fix it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
