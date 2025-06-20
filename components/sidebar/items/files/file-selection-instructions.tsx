import { useFileSelection } from "@/context/file-selection-context"
import { FC } from "react"

export const FileSelectionInstructions: FC = () => {
  const { isMultiSelectMode, selectedFiles } = useFileSelection()

  if (!isMultiSelectMode) {
    return (
      <div className="text-xs text-muted-foreground p-2 border-b">
        💡 Hold Shift and click to select multiple files for deletion
      </div>
    )
  }

  return (
    <div className="text-xs bg-blue-50 text-blue-700 p-2 border-b border-blue-200">
      📋 Multi-select mode: {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
      <br />
      Click files to toggle selection • Delete button will appear at bottom-right
    </div>
  )
}
