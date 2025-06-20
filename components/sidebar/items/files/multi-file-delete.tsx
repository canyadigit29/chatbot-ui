import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { ChatbotUIContext } from "@/context/context"
import { deleteFile } from "@/db/files"
import { deleteFileFromStorage } from "@/db/storage/files"
import { Tables } from "@/supabase/types"
import { IconTrash } from "@tabler/icons-react"
import { FC, useContext, useRef, useState } from "react"
import { toast } from "sonner"

interface MultiFileDeleteButtonProps {
  selectedFiles: Tables<"files">[]
  onDelete: () => void
}

export const MultiFileDeleteButton: FC<MultiFileDeleteButtonProps> = ({ 
  selectedFiles, 
  onDelete 
}) => {
  const { setFiles } = useContext(ChatbotUIContext)
  
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (selectedFiles.length === 0) {
    return null
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    
    try {
      // Delete each file
      for (const file of selectedFiles) {
        try {
          // First, try to delete from LlamaIndex if enabled
          try {
            // Check if LlamaIndex URL is configured, which indicates LlamaIndex is being used
            const llamaIndexUrl = process.env.NEXT_PUBLIC_LLAMAINDEX_URL;
            
            if (llamaIndexUrl) {
              // Import dynamically to avoid issues with SSR
              const { deleteFileFromLlamaIndex } = await import('@/lib/llama-index/process');
              await deleteFileFromLlamaIndex(file.id);
            }
          } catch (error) {
            console.error(`Error deleting file ${file.id} from LlamaIndex:`, error);
            // Continue with deletion even if LlamaIndex delete fails
          }
          
          // Continue with the normal deletion process
          await deleteFileFromStorage(file.file_path)
          await deleteFile(file.id)
        } catch (error) {
          console.error(`Error deleting file ${file.name}:`, error)
          toast.error(`Failed to delete ${file.name}`)
        }
      }

      // Remove deleted files from state
      setFiles((prevFiles: Tables<"files">[]) =>
        prevFiles.filter(prevFile => 
          !selectedFiles.some(selectedFile => selectedFile.id === prevFile.id)
        )
      )      // Clear selection and close dialog
      onDelete()
      setShowDialog(false)
      
      toast.success(`Successfully deleted ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`)
    } catch (error) {
      console.error("Error in bulk delete:", error)
      toast.error("Some files could not be deleted")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.stopPropagation()
      buttonRef.current?.click()
    }
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button 
          className="fixed bottom-4 right-4 z-50 shadow-lg"
          variant="destructive"
          size="lg"
        >
          <IconTrash className="mr-2" size={20} />
          Delete {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
        </Button>
      </DialogTrigger>

      <DialogContent onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Delete {selectedFiles.length} Files</DialogTitle>

          <DialogDescription>
            Are you sure you want to delete the following files?
            <ul className="mt-2 max-h-32 overflow-y-auto">
              {selectedFiles.map(file => (
                <li key={file.id} className="truncate">• {file.name}</li>
              ))}
            </ul>
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={() => setShowDialog(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button 
            ref={buttonRef} 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete All"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
