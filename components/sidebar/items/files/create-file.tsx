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

  // Overwrite handler
  const handleOverwrite = async () => {
    setShowDuplicateDialog(false)
    if (duplicateFile) {
      await deleteFile((duplicateFile as { id: string }).id)
    }
    setDuplicateFile(null)
    triggerUpload()
  }

  // Skip handler
  const handleSkip = () => {
    setShowDuplicateDialog(false)
    setDuplicateFile(null)
    handleSuccess()
  }

  // Actually trigger the upload for SidebarCreateItem
  const triggerUpload = () => {
    // This will cause SidebarCreateItem to call its createFunction
    setIsTyping(false)
    pendingCreateState.current = {
      file: currentFile,
      user_id: profile.user_id,
      name: currentFile.name.split(".").slice(0, -1).join("."),
      description,
      file_path: "",
      size: currentFile.size || 0,
      tokens: 0,
      type: currentFile.type || 0
    }
    pendingWorkspaceId.current = selectedWorkspace.id
    setTimeout(() => setIsTyping(true), 0) // force rerender
  }

  // Custom create handler for SidebarCreateItem
  const customCreateHandler = async (createState: any, workspaceId: string): Promise<any> => {
    // Only upload if triggered by triggerUpload
    if (!pendingCreateState.current || !pendingWorkspaceId.current) return null
    const state = pendingCreateState.current
    const wsId = pendingWorkspaceId.current
    pendingCreateState.current = null
    pendingWorkspaceId.current = null
    // ...existing file upload logic...
    return undefined // Let SidebarCreateItem handle the rest
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
