// @ts-nocheck
import React, { FC, useContext, useState, useRef, useEffect } from "react"
import { ACCEPTED_FILE_TYPES } from "@/components/chat/chat-hooks/use-select-file-handler"
import { SidebarCreateItem } from "@/components/sidebar/items/all/sidebar-create-item"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChatbotUIContext } from "@/context/context"
import { FILE_DESCRIPTION_MAX, FILE_NAME_MAX } from "@/db/limits"
import { TablesInsert } from "@/supabase/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getFileByNameInWorkspace, deleteFile } from "@/db/files"

interface CreateFileProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export const CreateFile: FC<CreateFileProps> = ({ isOpen, onOpenChange }) => {
  const { profile, selectedWorkspace } = useContext(ChatbotUIContext)

  const [name, setName] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [description, setDescription] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [duplicateFile, setDuplicateFile] = useState<any>(null)
  const [queueActive, setQueueActive] = useState(false)
  const pendingCreateState = useRef<any>(null)
  const pendingWorkspaceId = useRef<string | null>(null)
  const skipNext = useRef(false)

  // Prepare the current file for upload
  const currentFile = selectedFiles[currentFileIndex] || null

  // Start the queue when files are selected
  useEffect(() => {
    if (selectedFiles.length > 0 && !queueActive) {
      setQueueActive(true)
      setCurrentFileIndex(0)
    }
  }, [selectedFiles, queueActive]) // Added queueActive to dependencies as good practice

  // When queueActive or currentFileIndex changes, process the next file
  useEffect(() => {
    console.log("Queue/Index Effect: queueActive=", queueActive, "currentFile=", currentFile); // DEBUG LINE 1
    if (queueActive && currentFile) {
      console.log("Calling processCurrentFile for:", currentFile.name); // DEBUG LINE 2
      processCurrentFile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueActive, currentFile]) // Changed dependency from currentFileIndex to currentFile for more directness

  const handleSelectedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    console.log("Files selected:", files); // DEBUG LINE 3
    if (files.length > 0) {
      setSelectedFiles(files)
      setName(files[0].name.split(".").slice(0, -1).join("."))
      setDescription("")
    } else {
      setSelectedFiles([])
    }
  }

  // Main file processing logic
  const processCurrentFile = async () => {
    console.log("Inside processCurrentFile for:", currentFile?.name); // DEBUG LINE 4
    if (!currentFile || !selectedWorkspace) {
      console.log("processCurrentFile: currentFile or selectedWorkspace is missing"); // DEBUG LINE 5
      return
    }
    // Check for duplicate
    const existing = await getFileByNameInWorkspace(currentFile.name, selectedWorkspace.id)
    console.log("Result of getFileByNameInWorkspace:", existing)
    if (existing) {
      setDuplicateFile(existing)
      setShowDuplicateDialog(true)
      return
    }
    // No duplicate, trigger upload
    triggerUpload()
  }

  // Called by SidebarCreateItem onSuccess
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

  // Actually trigger the upload for SidebarCreateItem
  const triggerUpload = () => {
    console.log("Inside triggerUpload for:", currentFile?.name); // NEW DEBUG LINE
    if (!currentFile || !profile || !selectedWorkspace) {
      console.error("triggerUpload: Missing currentFile, profile, or selectedWorkspace");
      // Potentially advance queue or show error
      advanceQueueOrEnd();
      return;
    }

    const fileRecord: TablesInsert<"files"> = {
      user_id: profile.id,
      name: currentFile.name, // Using original name for the record
      description: description,
      file_path: "", // Will be updated after upload
      size: currentFile.size,
      tokens: 0, // Will be updated after processing
      type: currentFile.type
    };

    // Call the createFunction passed from SidebarCreateItem
    // This is expected to be `customCreateHandler`
    pendingCreateState.current = { file: currentFile, record: fileRecord };
    pendingWorkspaceId.current = selectedWorkspace.id;

    // Directly call the createFunction which should be customCreateHandler
    if (createFunction) { // createFunction is customCreateHandler
        console.log("Calling createFunction (customCreateHandler) from triggerUpload"); // NEW DEBUG LINE
        createFunction(fileRecord, selectedWorkspace.id, currentFile);
    } else {
        console.error("createFunction is not defined in triggerUpload");
        advanceQueueOrEnd();
    }
  };

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

  const customCreateHandler = async (
    fileRecord: TablesInsert<"files">,
    workspaceId: string,
    fileData: File
  ) => {
    console.log("Inside customCreateHandler for:", fileData.name); // NEW DEBUG LINE
    if (!profile) {
      console.error("customCreateHandler: Profile is not available.");
      advanceQueueOrEnd();
      return;
    }
    if (!workspaceId) {
      console.error("customCreateHandler: Workspace ID is not available.");
      advanceQueueOrEnd();
      return;
    }

    try {
      setIsTyping(true); // Show loading state

      const createdFile = await createFileBasedOnExtension(
        fileData,
        fileRecord,
        workspaceId,
        // @ts-ignore
        profile.embeddingsProvider // Assuming profile has this
      );

      console.log("File created in DB and processed:", createdFile.name); // NEW DEBUG LINE

      // Update global state - this should be handled by the context or a global state manager
      // For now, let's assume setFiles is available and works correctly
      // setFiles((prevFiles: Tables<"files">[]) => [...prevFiles, createdFile]);

      toast.success(`File "${createdFile.name}" uploaded and processed.`);
      advanceQueueOrEnd(true); // Indicate success
    } catch (error) {
      console.error("Error in customCreateHandler:", error); // NEW DEBUG LINE
      toast.error(`Error uploading file "${fileData.name}": ${(error as Error).message}`);
      advanceQueueOrEnd(false); // Indicate failure
    } finally {
      setIsTyping(false);
    }
  };

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
        createState={pendingCreateState.current || {
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
        createFunction={customCreateHandler}
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
