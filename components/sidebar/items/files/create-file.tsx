// @ts-nocheck
import React, { FC, useContext, useState, useRef, useEffect } from "react"
import { ChatbotUIContext } from "@/context/context"
import { Tables, TablesInsert } from "@/supabase/types"
import { getFileByNameInWorkspace } from "@/db/files" // Assuming this is still needed for duplicate check
import { toast } from "sonner"
import { ACCEPTED_FILE_TYPES } from "@/components/chat/chat-hooks/use-select-file-handler"
import { SidebarCreateItem } from "@/components/sidebar/items/all/sidebar-create-item"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface CreateFileProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  createFunction: (
    fileRecord: TablesInsert<"files">,
    fileData: File
  ) => Promise<Tables<"files"> | void> // Adjusted return type to match handleFileCreate
}

export const CreateFile: FC<CreateFileProps> = ({
  isOpen,
  onOpenChange,
  createFunction // Destructured prop, should now be correctly passed
}) => {
  console.log("CreateFile component: createFunction prop is", typeof createFunction, createFunction); // DEBUG LINE A - Keep for one more test

  const { profile, selectedWorkspace, setFiles } = useContext(ChatbotUIContext)

  const [name, setName] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [description, setDescription] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [duplicateFile, setDuplicateFile] = useState<Tables<"files"> | null>(null)
  const [queueActive, setQueueActive] = useState(false)
  // const pendingCreateState = useRef<any>(null) // No longer needed here
  // const pendingWorkspaceId = useRef<string | null>(null) // No longer needed here
  const skipNext = useRef(false)

  const currentFile = selectedFiles[currentFileIndex] || null

  useEffect(() => {
    if (selectedFiles.length > 0 && !queueActive) {
      setQueueActive(true)
      setCurrentFileIndex(0)
    }
  }, [selectedFiles, queueActive])

  useEffect(() => {
    // console.log("Queue/Index Effect: queueActive=", queueActive, "currentFile=", currentFile); // Can be removed
    if (queueActive && currentFile) {
      // console.log("Calling processCurrentFile for:", currentFile.name); // Can be removed
      processCurrentFile()
    }
  }, [queueActive, currentFile])

  const handleSelectedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    // console.log("Files selected:", files); // Can be removed
    if (files.length > 0) {
      setSelectedFiles(files)
      setName(files[0].name.split(".").slice(0, -1).join("."))
      setDescription("")
    } else {
      setSelectedFiles([])
    }
  }

  const processCurrentFile = async () => {
    // console.log("Inside processCurrentFile for:", currentFile?.name); // Can be removed
    if (!currentFile || !selectedWorkspace) {
      // console.log("processCurrentFile: currentFile or selectedWorkspace is missing"); // Can be removed
      advanceQueueOrEnd(false) // Ensure queue advances if critical data is missing
      return
    }

    const existing = await getFileByNameInWorkspace(currentFile.name, selectedWorkspace.id)
    // console.log("Result of getFileByNameInWorkspace:", existing); // Can be removed
    if (existing) {
      setDuplicateFile(existing)
      setShowDuplicateDialog(true)
      return
    }
    // console.log("processCurrentFile: typeof createFunction before calling triggerUpload is", typeof createFunction); // DEBUG LINE B - Keep for one more test
    triggerUpload(createFunction) 
  }

  const triggerUpload = async (passedCreateFunction: typeof createFunction) => { // Changed to async
    // console.log("Inside triggerUpload for:", currentFile?.name);
    if (!currentFile || !profile || !selectedWorkspace) {
      console.error("triggerUpload: Missing currentFile, profile, or selectedWorkspace");
      advanceQueueOrEnd(false);
      return;
    }

    const fileRecord: TablesInsert<"files"> = {
      user_id: profile.id,
      name: currentFile.name, 
      description: description,
      file_path: "", 
      size: currentFile.size,
      tokens: 0, 
      type: currentFile.type
    };

    if (passedCreateFunction) {
      // console.log("Calling passedCreateFunction from triggerUpload");
      try {
        setIsTyping(true);
        // Call the createFunction prop (which is handleFileCreate from parent)
        const createdFile = await passedCreateFunction(fileRecord, currentFile);
        // console.log("File created and processed via prop:", createdFile?.name); // Can be removed
        toast.success(`File "${currentFile.name}" uploaded and processed.`);
        advanceQueueOrEnd(true);
      } catch (error) {
        console.error("Error calling createFunction prop:", error);
        toast.error(`Error uploading file "${currentFile.name}": ${(error as Error).message}`);
        advanceQueueOrEnd(false);
      } finally {
        setIsTyping(false);
      }
    } else {
      console.error("createFunction prop is not defined in triggerUpload");
      toast.error(`Upload failed for "${currentFile.name}": Configuration error.`);
      advanceQueueOrEnd(false);
    }
  };

  // customCreateHandler is removed as its logic is now in the parent (SidebarCreateButtons)

  const advanceQueueOrEnd = (success = false) => {
    if (success) {
      console.log("File processed successfully:", currentFile?.name);
    } else {
      console.log("File processing failed or skipped:", currentFile?.name);
    }
    // Move to the next file in the queue
    if (currentFileIndex < selectedFiles.length - 1) {
      setCurrentFileIndex(idx => idx + 1)
    } else {
      // Reset state
      setSelectedFiles([])
      setCurrentFileIndex(0)
      setQueueActive(false)
    }
  }

  const handleSuccess = async () => {
    if (currentFileIndex < selectedFiles.length - 1) {
      setCurrentFileIndex(idx => idx + 1)
    } else {
      setSelectedFiles([])
      setCurrentFileIndex(0)
      setQueueActive(false)
    }
  }

  // Skip handler
  const handleSkip = () => {
    setShowDuplicateDialog(false)
    setDuplicateFile(null)
    handleSuccess()
  }

  // Overwrite handler
  const handleOverwrite = async () => {
    setShowDuplicateDialog(false)
    if (duplicateFile) {
      await deleteFile((duplicateFile as { id: string }).id)
    }
    setDuplicateFile(null)
    triggerUpload()
  }

  const renderFileListItem = (file: File, index: number) => {
    return (
      <li key={file.name + index} style={{ fontWeight: index === currentFileIndex ? 'bold' : 'normal' }}>
        {file.name}
      </li>
    )
  }

  if (!profile) return null
  if (!selectedWorkspace) return null

  return (
    <>
      <SidebarCreateItem
        contentType="files"
        createState={{
          file: currentFile,
          user_id: profile.user_id,
          name,
          description,
          file_path: "",
          size: currentFile?.size || 0,
          tokens: 0,
          type: currentFile?.type || 0
        } as TablesInsert<"files">}
        isOpen={isOpen}
        isTyping={isTyping}
        onOpenChange={isOpen => {
          onOpenChange(isOpen)
          if (!isOpen) {
            setSelectedFiles([])
            setCurrentFileIndex(0)
            setQueueActive(false)
          }
        }}
        renderInputs={() => (
          <>
            <div className="space-y-1">
              <Label>Files</Label>
              <Input
                type="file"
                multiple
                onChange={handleSelectedFile}
                accept={ACCEPTED_FILE_TYPES}
              />
              {selectedFiles.length > 1 && (
                <div className="text-xs mt-2">
                  <b>Files to upload:</b>
                  <ul>
                    {selectedFiles.map((file, idx) => (
                      <li key={file.name + idx} style={{ fontWeight: idx === currentFileIndex ? 'bold' : 'normal' }}>
                        {file.name}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1">Uploading file {currentFileIndex + 1} of {selectedFiles.length}</div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                placeholder="File name..."
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={FILE_NAME_MAX}
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                placeholder="File description..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={FILE_DESCRIPTION_MAX}
              />
            </div>
          </>
        )}
        onSuccess={handleSuccess}
        createFunction={createFunction} // Directly pass the createFunction prop
      />
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate File Detected</DialogTitle>
          </DialogHeader>
          <div>
            A file named <b>{currentFile?.name}</b> already exists in this workspace. What would you like to do?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleSkip}>Skip</Button>
            <Button variant="destructive" onClick={handleOverwrite}>Overwrite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
