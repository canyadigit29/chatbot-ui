import { ACCEPTED_FILE_TYPES } from "@/components/chat/chat-hooks/use-select-file-handler"
import { SidebarCreateItem } from "@/components/sidebar/items/all/sidebar-create-item"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChatbotUIContext } from "@/context/context"
import { FILE_DESCRIPTION_MAX, FILE_NAME_MAX } from "@/db/limits"
import { TablesInsert } from "@/supabase/types"
import { FC, useContext, useState } from "react"

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

  const handleSelectedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    setSelectedFiles(files)
    if (files.length > 0) {
      const fileNameWithoutExtension = files[0].name.split(".").slice(0, -1).join(".")
      setName(fileNameWithoutExtension)
    }
  }

  // Prepare the current file for upload
  const currentFile = selectedFiles[currentFileIndex] || null

  if (!profile) return null
  if (!selectedWorkspace) return null

  return (
    <SidebarCreateItem
      contentType="files"
      createState={
        {
          file: currentFile,
          user_id: profile.user_id,
          name,
          description,
          file_path: "",
          size: currentFile?.size || 0,
          tokens: 0,
          type: currentFile?.type || 0
        } as TablesInsert<"files">
      }
      isOpen={isOpen}
      isTyping={isTyping}
      onOpenChange={isOpen => {
        onOpenChange(isOpen)
        if (!isOpen) {
          setSelectedFiles([])
          setCurrentFileIndex(0)
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
      // After a file is uploaded, move to the next file in the queue
      onSuccess={() => {
        if (currentFileIndex < selectedFiles.length - 1) {
          setCurrentFileIndex(currentFileIndex + 1)
          const nextFile = selectedFiles[currentFileIndex + 1]
          setName(nextFile.name.split(".").slice(0, -1).join("."))
        } else {
          setSelectedFiles([])
          setCurrentFileIndex(0)
        }
      }}
    />
  )
}
