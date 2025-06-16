import { ACCEPTED_FILE_TYPES } from "@/components/chat/chat-hooks/use-select-file-handler"
import { SidebarCreateItem } from "@/components/sidebar/items/all/sidebar-create-item"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ChatbotUIContext } from "@/context/context"
import { FILE_DESCRIPTION_MAX, FILE_NAME_MAX } from "@/db/limits"
// import { TablesInsert } from "@/supabase/types" // Not directly used for createStates anymore
import React, { FC, useContext, useState, useEffect, useCallback } from "react"
import { IconTrash, IconAlertCircle, IconCircleCheck } from "@tabler/icons-react"
import { toast } from "sonner"

export interface SelectedFileData {
  id: string
  file: File
  name: string
  originalFilename: string
  description: string
  status: "new" | "checking" | "unique" | "duplicate" | "renaming_checking"
  action?: "upload" | "overwrite" | "skip" | "rename_initiate"
  apiError?: string
}

interface CreateFileProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export const CreateFile: FC<CreateFileProps> = ({ isOpen, onOpenChange }) => {
  const { profile, selectedWorkspace } = useContext(ChatbotUIContext)
  const [selectedFilesData, setSelectedFilesData] = useState<SelectedFileData[]>([])
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedFilesData([])
      setIsTyping(false)
      setIsLoading(false)
    } else {
      // Clear selection when modal is closed to ensure fresh state next time
      setSelectedFilesData([])
    }
  }, [isOpen])

  const handleSelectedFiles = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files) return

    const filesArray: File[] = Array.from(e.target.files) // Explicitly type as File[]
    const newFilesData: SelectedFileData[] = filesArray.map((file: File) => {
      const fileNameWithoutExtension = file.name
        .split(".")
        .slice(0, -1)
        .join(".")
      return {
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        name: fileNameWithoutExtension,
        originalFilename: file.name,
        description: "",
        status: "new", // Mark as new for initial duplicate check
        action: "upload" // Default action
      }
    })
    setSelectedFilesData((prev: SelectedFileData[]) => [...prev, ...newFilesData])
    if (e.target) {
      e.target.value = "" // Reset file input
    }
  }

  const checkDuplicates = useCallback(async () => {
    if (!selectedWorkspace || selectedFilesData.length === 0) return

    const filesToCheck: SelectedFileData[] = selectedFilesData.filter(
      (item: SelectedFileData) => item.status === "new" || item.status === "renaming_checking"
    )

    if (filesToCheck.length === 0) return

    // Mark files as 'checking' or 'renaming_checking'
    setSelectedFilesData((prev: SelectedFileData[]) =>
      prev.map((item: SelectedFileData) =>
        filesToCheck.find((f: SelectedFileData) => f.id === item.id)
          ? { ...item, status: item.status === "new" ? "checking" : "renaming_checking" }
          : item
      )
    )
    setIsLoading(true)

    const filenamesToCheck: string[] = filesToCheck.map((item: SelectedFileData) => item.name + "." + item.file.name.split(".").pop()) // Append extension for check

    try {
      const response = await fetch("/api/files/check-duplicates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          workspaceId: selectedWorkspace.id,
          filenames: filenamesToCheck
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to check duplicates")
      }

      const responseData = await response.json();
      // Ensure existingFilenames is always an array, even if API response is malformed
      const existingFilenames = (responseData?.existingFilenames || []) as string[];
      
      setSelectedFilesData((prev: SelectedFileData[]) =>
        prev.map((item: SelectedFileData) => {
          const currentFullFilename = item.name + "." + item.file.name.split(".").pop()
          if (filesToCheck.find((f: SelectedFileData) => f.id === item.id)) {
            // Only update files that were part of this check batch
            const isDuplicate = existingFilenames.includes(currentFullFilename)
            return {
              ...item,
              status: isDuplicate ? "duplicate" : "unique",
              action: isDuplicate ? "skip" : "upload" // Default for duplicates is skip
            }
          }
          return item
        })
      )
    } catch (error: any) {
      toast.error(`Error checking duplicates: ${error.message}`)
      // Revert status for files that were being checked if API fails
      setSelectedFilesData((prev: SelectedFileData[]) =>
        prev.map((item: SelectedFileData) =>
          filesToCheck.find((f: SelectedFileData) => f.id === item.id)
            ? { ...item, status: "new", apiError: error.message }
            : item
        )
      )
    }
    setIsLoading(false)
  }, [selectedFilesData, selectedWorkspace?.id])

  // Automatically check for duplicates when new files are added or names change
  useEffect(() => {
    const hasNewOrRenamingFiles = selectedFilesData.some(
      (item: SelectedFileData) => item.status === "new" || item.status === "renaming_checking"
    )
    if (hasNewOrRenamingFiles && !isLoading) {
      checkDuplicates()
    }
  }, [selectedFilesData, checkDuplicates, isLoading])

  const handleRemoveFile = (id: string) => {
    setSelectedFilesData((prev: SelectedFileData[]) => prev.filter((item: SelectedFileData) => item.id !== id))
  }

  const handleNameChange = (id: string, newName: string) => {
    setSelectedFilesData((prev: SelectedFileData[]) =>
      prev.map((item: SelectedFileData) =>
        item.id === id
          ? { ...item, name: newName, status: "new", action: "upload", apiError: undefined } // Reset status to 'new' to trigger re-check
          : item
      )
    )
  }

  const handleDescriptionChange = (id: string, newDescription: string) => {
    setSelectedFilesData((prev: SelectedFileData[]) =>
      prev.map((item: SelectedFileData) =>
        item.id === id ? { ...item, description: newDescription } : item
      )
    )
  }

  const handleDuplicateAction = (
    id: string,
    action: "overwrite" | "skip" | "rename_initiate"
  ) => {
    setSelectedFilesData((prev: SelectedFileData[]) =>
      prev.map((item: SelectedFileData) => {
        if (item.id === id && item.status === "duplicate") {
          if (action === "rename_initiate") {
            return { ...item, action, status: "new" } // status 'new' will trigger re-check on next name edit
          } else {
            // For "overwrite" or "skip", mark as unique as user has resolved it.
            // The actual action field will determine backend behavior.
            return { ...item, action, status: "unique" } // Mark as 'unique' conceptually as user has resolved it
          }
        }
        return item
      })
    )
  }

  if (!profile || !selectedWorkspace) return null

  const createStates = selectedFilesData
    .filter((item: SelectedFileData) => item.action !== "skip" && (item.status === "unique" || item.action === "overwrite"))
    .map((item: SelectedFileData) => ({
      file: item.file,
      user_id: profile.user_id,
      name: item.name, // This is the name to be saved (original or user-edited)
      description: item.description,
      file_path: "",
      size: item.file.size,
      tokens: 0,
      type: item.file.type,
      action: item.action // Pass the action for backend processing
    }))

  const allFilesResolvedOrSkipped = selectedFilesData.every(
    (item: SelectedFileData) => item.status === "unique" || item.action === "skip" || item.action === "overwrite"
  );
  
  const noFilesSelected = selectedFilesData.length === 0;
  const noFilesReadyForUpload = createStates.length === 0;

  // Create button should be disabled if:
  // 1. isLoading (API call in progress)
  // 2. No files are selected
  // 3. Not all selected files are resolved (i.e., some are still 'new', 'checking', 'duplicate' without action, 'renaming_checking')
  // 4. After filtering for skips, no files are left to upload/overwrite.
  const disableCreateButton = 
    isLoading || 
    noFilesSelected || 
    !allFilesResolvedOrSkipped ||
    noFilesReadyForUpload;

  return (
    <SidebarCreateItem
      contentType="files"
      createState={createStates as any} // Will be updated later
      isOpen={isOpen}
      isTyping={isTyping}
      onOpenChange={onOpenChange}
      disableCreate={disableCreateButton} // Updated disable logic
      renderInputs={() => (
        <>
          <div className="space-y-1">
            <Label>Files</Label>
            <Input
              type="file"
              multiple
              onChange={handleSelectedFiles}
              accept={ACCEPTED_FILE_TYPES}
              disabled={isLoading}
            />
          </div>

          {selectedFilesData.length > 0 && (
            <div className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {selectedFilesData.map((fileData: SelectedFileData) => (
                <div key={fileData.id} className="space-y-3 border p-3 rounded-md relative">
                  { (fileData.status === "checking" || fileData.status === "renaming_checking") && (
                    <div className="absolute inset-0 bg-opacity-50 bg-gray-500 flex items-center justify-center rounded-md z-10">
                      <p className="text-white font-semibold">Checking...</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <Label className="truncate text-sm" title={fileData.originalFilename}>
                      {fileData.originalFilename} ({(fileData.file.size / 1024).toFixed(2)} KB)
                    </Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(fileData.id)}
                      disabled={isLoading}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`fileName-${fileData.id}`}>Name (without extension)</Label>
                    <Input
                      id={`fileName-${fileData.id}`}
                      placeholder="Enter file name..."
                      value={fileData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNameChange(fileData.id, e.target.value)}
                      maxLength={FILE_NAME_MAX}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      disabled={isLoading || fileData.status === "checking" || fileData.status === "renaming_checking"}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`fileDescription-${fileData.id}`}>
                      Description (Optional)
                    </Label>
                    <Input
                      id={`fileDescription-${fileData.id}`}
                      placeholder="File description..."
                      value={fileData.description}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleDescriptionChange(fileData.id, e.target.value)
                      }
                      maxLength={FILE_DESCRIPTION_MAX}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      disabled={isLoading || fileData.status === "checking" || fileData.status === "renaming_checking"}
                    />
                  </div>

                  {fileData.apiError && (
                    <p className="text-xs text-red-500">Error: {fileData.apiError}</p>
                  )}

                  {fileData.status === "unique" && fileData.action !== 'skip' && (
                    <div className="flex items-center text-xs text-green-600">
                      <IconCircleCheck className="h-4 w-4 mr-1" /> Ready to {fileData.action === 'overwrite' ? 'overwrite' : 'upload'}.
                    </div>
                  )}
                   {fileData.action === 'skip' && (
                    <div className="flex items-center text-xs text-gray-500">
                       Skipped.
                    </div>
                  )}

                  {fileData.status === "duplicate" && (
                    <div className="space-y-2">
                      <div className="flex items-center text-xs text-red-500">
                        <IconAlertCircle className="h-4 w-4 mr-1" /> File "{fileData.name}.{fileData.file.name.split('.').pop()}" already exists.
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDuplicateAction(fileData.id, "overwrite")}
                          disabled={isLoading}
                        >
                          Overwrite
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            handleDuplicateAction(fileData.id, "rename_initiate")
                            document.getElementById(`fileName-${fileData.id}`)?.focus()
                          }}
                          disabled={isLoading}
                        >
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDuplicateAction(fileData.id, "skip")}
                          disabled={isLoading}
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    />
  )
}
