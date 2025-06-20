import { Tables } from "@/supabase/types"
import { FC, useState, useRef, useEffect } from "react"
import { FileItem } from "./file-item"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { IconTrash, IconX } from "@tabler/icons-react"
import { MultiFileDeleteButton } from "./multi-file-delete"

interface FileListWrapperProps {
  files: Tables<"files">[]
}

export const FileListWrapper: FC<FileListWrapperProps> = ({ files }) => {
  const [selectedFiles, setSelectedFiles] = useState<Tables<"files">[]>([])
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1)

  const toggleFileSelection = (file: Tables<"files">, index: number, isShiftClick = false) => {
    if (isShiftClick && lastClickedIndex !== -1 && selectedFiles.length > 0) {
      // Range selection
      const start = Math.min(lastClickedIndex, index)
      const end = Math.max(lastClickedIndex, index)
      const rangeFiles = files.slice(start, end + 1)
      
      setSelectedFiles(prev => {
        const newSelection = [...prev]
        rangeFiles.forEach(rangeFile => {
          if (!newSelection.find(f => f.id === rangeFile.id)) {
            newSelection.push(rangeFile)
          }
        })
        return newSelection
      })
    } else {
      // Single file toggle
      setSelectedFiles(prev => {
        const isSelected = prev.find(f => f.id === file.id)
        if (isSelected) {
          const newSelection = prev.filter(f => f.id !== file.id)
          if (newSelection.length === 0) {
            setIsMultiSelectMode(false)
          }
          return newSelection
        } else {
          if (!isMultiSelectMode) {
            setIsMultiSelectMode(true)
          }
          return [...prev, file]
        }
      })
    }
    setLastClickedIndex(index)
  }

  const clearSelection = () => {
    setSelectedFiles([])
    setIsMultiSelectMode(false)
    setLastClickedIndex(-1)
  }

  const handleFileClick = (file: Tables<"files">, index: number, e: React.MouseEvent) => {
    if (e.shiftKey || (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.stopPropagation()
      toggleFileSelection(file, index, e.shiftKey)
      return false
    }
    
    // If we're in multi-select mode and this is a regular click, toggle selection
    if (isMultiSelectMode) {
      e.preventDefault()
      e.stopPropagation()
      toggleFileSelection(file, index, false)
      return false
    }
    
    // Default behavior - let the file item handle it normally
    return true
  }

  const isFileSelected = (fileId: string) => {
    return selectedFiles.some(f => f.id === fileId)
  }

  return (    <div className="relative">
      {/* Instructions */}
      {!isMultiSelectMode && files.length > 1 && (
        <div className="mb-2 rounded-md bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
          💡 Hold Shift and click to select multiple files for bulk deletion
        </div>
      )}
      
      {isMultiSelectMode && (
        <div className="mb-2 rounded-md bg-blue-50 p-2 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          <div className="flex items-center justify-between">
            <span>
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected. 
              Hold Shift to select range, Ctrl/Cmd to add individual files.
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              className="h-6 w-6 p-0"
            >
              <IconX size={12} />
            </Button>
          </div>
        </div>
      )}

      {/* File List */}
      <div className="space-y-1">
        {files.map((file, index) => {
          const isSelected = isFileSelected(file.id)
          
          return (            <div
              key={file.id}
              className={cn(
                "relative",
                isSelected && "rounded border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
              )}
              onMouseDown={(e) => {
                // Handle the click at the mousedown level to intercept before sheet opens
                const result = handleFileClick(file, index, e)
                if (result === false) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute left-1 top-1 z-10 h-4 w-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                  ✓
                </div>
              )}
              
              <FileItem file={file} />
            </div>
          )
        })}
      </div>

      {/* Multi-delete button */}
      {isMultiSelectMode && selectedFiles.length > 0 && (
        <MultiFileDeleteButton 
          selectedFiles={selectedFiles}
          onDelete={clearSelection}
        />
      )}
    </div>
  )
}
