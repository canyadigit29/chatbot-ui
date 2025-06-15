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
import { getFileByNameInWorkspace, deleteFile, createFileBasedOnExtension } from "@/db/files"
import { toast } from "sonner"

interface CreateFileProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export const CreateFile: FC<CreateFileProps> = ({
  isOpen,
  onOpenChange
}) => {
  const { profile, selectedWorkspace, setFiles } = useContext(ChatbotUIContext)

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
  }, [selectedFiles, queueActive])

  // When queueActive or currentFileIndex changes, process the next file
  useEffect(() => {
    if (queueActive && currentFile) {
      processCurrentFile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueActive, currentFile])

  const handleSelectedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
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
    if (!currentFile || !selectedWorkspace) {
      return
    }
    // Check for duplicate
    const existing = await getFileByNameInWorkspace(currentFile.name, selectedWorkspace.id)
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
  const triggerUpload = async () => {
    if (!currentFile || !profile || !selectedWorkspace) {
      advanceQueueOrEnd();
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

    pendingCreateState.current = { file: currentFile, record: fileRecord };
    pendingWorkspaceId.current = selectedWorkspace.id;

    try {
      setIsTyping(true);
      const createdFile = await createFileBasedOnExtension(
        currentFile,
        fileRecord,
        selectedWorkspace.id,
        // @ts-ignore
        profile.embeddingsProvider
      );
      setFiles((prevFiles: any[]) => [...prevFiles, createdFile]);
      toast.success(`File "${createdFile.name}" uploaded and processed.`);
      advanceQueueOrEnd(true);
    } catch (error) {
      toast.error(`Error uploading file "${currentFile.name}": ${(error as Error).message}`);
      advanceQueueOrEnd(false);
    } finally {
      setIsTyping(false);
    }
  };

  const advanceQueueOrEnd = (success = false) => {
    if (currentFileIndex < selectedFiles.length - 1) {
      setCurrentFileIndex(idx => idx + 1)
    } else {
      setSelectedFiles([])
      setCurrentFileIndex(0)
      setQueueActive(false)
    }
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
