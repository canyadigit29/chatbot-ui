import { supabase } from "@/lib/supabase/browser-client"
import { toast } from "sonner"

export const uploadFile = async (
  file: File,
  payload: {
    user_id: string
    file_id: string // The actual ID of the file record from the 'files' table
  }
) => {
  const SIZE_LIMIT = parseInt(
    process.env.NEXT_PUBLIC_USER_FILE_SIZE_LIMIT || "10000000"
  )

  if (file.size > SIZE_LIMIT) {
    throw new Error(
      `File must be less than ${Math.floor(SIZE_LIMIT / 1000000)}MB`
    )
  }

  // Use a consistent and unique path based on user_id and file_id.
  // Encoding file_id can be good if it contains special characters, though UUIDs are generally safe.
  // Using a subfolder for the user_id and then the file_id as the object name.
  const filePath = `${payload.user_id}/${payload.file_id}`

  const { error } = await supabase.storage
    .from("files")
    .upload(filePath, file, {
      upsert: true // Use upsert: true for overwriting if the path is the same (e.g. during retry or explicit overwrite)
    })

  if (error) {
    console.error("Error uploading file to storage:", error)
    throw new Error("Error uploading file to storage: " + error.message)
  }

  return filePath
}

export const deleteFileFromStorage = async (filePath: string) => {
  const { error } = await supabase.storage.from("files").remove([filePath])

  if (error) {
    toast.error("Failed to remove file!")
    return
  }
}

export const getFileFromStorage = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(filePath, 60 * 60 * 24) // 24hrs

  if (error) {
    console.error(`Error uploading file with path: ${filePath}`, error)
    throw new Error("Error downloading file")
  }

  return data.signedUrl
}
