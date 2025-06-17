import React from "react"
import { Badge } from "@/components/ui/badge"
import { IconBooks } from "@tabler/icons-react"

interface LlamaIndexSearchBadgeProps {
  visible: boolean
}

export const LlamaIndexSearchBadge: React.FC<LlamaIndexSearchBadgeProps> = ({
  visible
}) => {
  if (!visible) return null

  return (
    <Badge className="bg-blue-500 hover:bg-blue-600 transition-colors flex items-center gap-1 text-white">
      <IconBooks size={14} />
      <span>LlamaIndex Search</span>
    </Badge>
  )
}
