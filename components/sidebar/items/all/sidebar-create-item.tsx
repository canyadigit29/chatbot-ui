import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { ChatbotUIContext } from "@/context/context"
import { createAssistantCollections } from "@/db/assistant-collections"
import { createAssistantFiles } from "@/db/assistant-files"
import { createAssistantTools } from "@/db/assistant-tools"
import { createAssistant, updateAssistant } from "@/db/assistants"
import { createChat } from "@/db/chats"
import { createCollectionFiles } from "@/db/collection-files"
import { createCollection } from "@/db/collections"
import { processFileUploadOperation, FileUploadOperationParams, DBFile } from "@/db/files"
import { createModel } from "@/db/models"
import { createPreset } from "@/db/presets"
import { createPrompt } from "@/db/prompts"
import {
  getAssistantImageFromStorage,
  uploadAssistantImage
} from "@/db/storage/assistant-images"
import { createTool } from "@/db/tools"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import { Tables, TablesInsert } from "@/supabase/types"
import { ContentType } from "@/types"
import React, { FC, useContext, useRef, useState } from "react"
import { toast } from "sonner"
import { SelectedFileData } from "@/components/sidebar/items/files/create-file"

interface SidebarCreateItemProps {
  isOpen: boolean
  isTyping: boolean
  onOpenChange: (isOpen: boolean) => void
  contentType: ContentType
  renderInputs: () => JSX.Element
  createState: any // For files, this will be FileUploadOperationParams[]
  disableCreate?: boolean
}

export const SidebarCreateItem: FC<SidebarCreateItemProps> = ({
  isOpen,
  onOpenChange,
  contentType,
  renderInputs,
  createState,
  isTyping,
  disableCreate // Added prop
}) => {
  const {
    selectedWorkspace,
    setChats,
    setPresets,
    setPrompts,
    setFiles,
    setCollections,
    setAssistants,
    setAssistantImages,
    setTools,
    setModels
  } = useContext(ChatbotUIContext)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const [creating, setCreating] = useState(false)

  const createFunctions = {
    chats: createChat,
    presets: createPreset,
    prompts: createPrompt,
    files: async (
      fileOpsParams: FileUploadOperationParams[] // Expect an array of FileUploadOperationParams
    ): Promise<DBFile[]> => {
      if (!selectedWorkspace) throw new Error("No workspace selected");
      if (!processFileUploadOperation) {
        toast.error("File processing function is not available. Please update the application.");
        throw new Error("processFileUploadOperation not available");
      }

      // The `createState` (now `fileOpsParams`) is already the array of operations.
      // Each operation in `fileOpsParams` should already have workspaceId and userId.
      const results = await processFileUploadOperation(fileOpsParams);
      return results; // Returns an array of processed DBFile objects or throws an error
    },
    collections: async (
      createState: {
        image: File
        collectionFiles: TablesInsert<"collection_files">[]
      } & Tables<"collections">,
      workspaceId: string
    ) => {
      const { collectionFiles, ...rest } = createState
      const createdCollection = await createCollection(rest, workspaceId)
      const finalCollectionFiles = collectionFiles.map(collectionFile => ({
        ...collectionFile,
        collection_id: createdCollection.id
      }))
      await createCollectionFiles(finalCollectionFiles)
      return createdCollection
    },
    assistants: async (
      createState: {
        image: File
        files: Tables<"files">[]
        collections: Tables<"collections">[]
        tools: Tables<"tools">[]
      } & Tables<"assistants">,
      workspaceId: string
    ) => {
      const { image, files, collections, tools, ...rest } = createState
      const createdAssistant = await createAssistant(rest, workspaceId)
      let updatedAssistant = createdAssistant
      if (image) {
        const filePath = await uploadAssistantImage(createdAssistant, image)
        updatedAssistant = await updateAssistant(createdAssistant.id, {
          image_path: filePath
        })
        const url = (await getAssistantImageFromStorage(filePath)) || ""
        if (url) {
          const response = await fetch(url)
          const blob = await response.blob()
          const base64 = await convertBlobToBase64(blob)
          setAssistantImages((prev: any) => [
            ...prev,
            {
              assistantId: updatedAssistant.id,
              path: filePath,
              base64,
              url
            }
          ])
        }
      }
      const assistantFiles = files.map(file => ({
        user_id: rest.user_id,
        assistant_id: createdAssistant.id,
        file_id: file.id
      }))
      const assistantCollections = collections.map(collection => ({
        user_id: rest.user_id,
        assistant_id: createdAssistant.id,
        collection_id: collection.id
      }))
      const assistantTools = tools.map(tool => ({
        user_id: rest.user_id,
        assistant_id: createdAssistant.id,
        tool_id: tool.id
      }))
      await createAssistantFiles(assistantFiles)
      await createAssistantCollections(assistantCollections)
      await createAssistantTools(assistantTools)
      return updatedAssistant
    },
    tools: createTool,
    models: createModel
  }

  const stateUpdateFunctions = {
    chats: setChats,
    presets: setPresets,
    prompts: setPrompts,
    files: setFiles, // This will need to handle an array of results
    collections: setCollections,
    assistants: setAssistants,
    tools: setTools,
    models: setModels
  }

  const handleCreate = async () => {
    try {
      if (!selectedWorkspace) return
      if (disableCreate) return;

      const createFunction = createFunctions[contentType]
      const setStateFunction = stateUpdateFunctions[contentType]

      if (!createFunction || !setStateFunction) return

      setCreating(true)

      if (contentType === "files") {
        // createState for files is FileUploadOperationParams[]
        const fileCreationResults = await (createFunction as (params: FileUploadOperationParams[]) => Promise<DBFile[]>)(createState);

        const successfulUploads = fileCreationResults.filter(Boolean); // Filter out any potential null/undefined from errors not throwing

        if (successfulUploads.length > 0) {
            setStateFunction((prevItems: DBFile[]) => {
                const updatedItems = [...prevItems];
                successfulUploads.forEach((newItem) => {
                    const existingIndex = updatedItems.findIndex(item => item.id === newItem.id);
                    if (existingIndex > -1) {
                        updatedItems[existingIndex] = newItem; // Update existing
                    } else {
                        updatedItems.push(newItem); // Add new
                    }
                });
                return updatedItems;
            });
        }
        
        // Compare successful uploads to the number of operations that were not 'skip'
        const attemptedOpsCount = (createState as FileUploadOperationParams[]).filter(op => op.action !== 'skip').length;
        if (successfulUploads.length === attemptedOpsCount && attemptedOpsCount > 0) {
            toast.success("All files processed successfully!")
        } else if (successfulUploads.length > 0) {
            toast.warning("Some files processed. Check notifications for details.")
        } else if (attemptedOpsCount > 0) {
            toast.error("No files were processed successfully. Check notifications.")
        } else {
            // All were skips or no files to process
            toast.info("No files were uploaded or overwritten.")
        }

      } else {
        // Original logic for other content types
        const newItem = await createFunction(createState, selectedWorkspace.id)
        setStateFunction((prevItems: any) => [...prevItems, newItem])
        toast.success(`${contentType.slice(0, -1)} created successfully!`)
      }

      onOpenChange(false)
      setCreating(false)
    } catch (error: any) {
      toast.error(`Error creating ${contentType.slice(0, -1)}. ${error.message}`)
      setCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // The global isTyping might not be reliable for multiple inputs in CreateFile.
    // Rely on disableCreate for the button state.
    if (e.key === "Enter" && !e.shiftKey && !disableCreate && !creating) {
      e.preventDefault()
      buttonRef.current?.click()
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex min-w-[450px] flex-col justify-between overflow-auto"
        side="left"
        onKeyDown={handleKeyDown}
      >
        <div className="grow overflow-auto">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold">
              Create{" "}
              {contentType.charAt(0).toUpperCase() + contentType.slice(1, -1)}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">{renderInputs()}</div>
        </div>

        <SheetFooter className="mt-2 flex justify-between">
          <div className="flex grow justify-end space-x-2">
            <Button
              disabled={creating}
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            {/* Use disableCreate prop here */}
            <Button disabled={creating || disableCreate} ref={buttonRef} onClick={handleCreate}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
