import { supabase } from "@/lib/supabase/browser-client"
import { TablesInsert, TablesUpdate, Tables } from "@/supabase/types" // Added Tables
import mammoth from "mammoth"
import { toast } from "sonner"
import { uploadFile } from "./storage/files"

export const getFileById = async (fileId: string) => {
  const { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .single()

  if (!file) {
    throw new Error(error.message)
  }

  return file
}

export const getFileWorkspacesByWorkspaceId = async (workspaceId: string) => {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `
      id,
      name,
      files (*)
    `
    )
    .eq("id", workspaceId)
    .single()

  if (!workspace) {
    throw new Error(error.message)
  }

  return workspace
}

export const getFileWorkspacesByFileId = async (fileId: string) => {
  const { data: file, error } = await supabase
    .from("files")
    .select(
      `
      id, 
      name, 
      workspaces (*)
    `
    )
    .eq("id", fileId)
    .single()

  if (!file) {
    throw new Error(error.message)
  }

  return file
}

// For non-docx files
export const createFile = async (
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string
) => {
  let validFilename = fileRecord.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
  const extension = file.name.split(".").pop()
  const extensionIndex = validFilename.lastIndexOf(".")
  const baseName = validFilename.substring(0, (extensionIndex < 0) ? undefined : extensionIndex)
  const maxBaseNameLength = 100 - (extension?.length || 0) - 1
  if (baseName.length > maxBaseNameLength) {
    fileRecord.name = baseName.substring(0, maxBaseNameLength) + "." + extension
  } else {
    fileRecord.name = baseName + "." + extension
  }
  const { data: createdFile, error } = await supabase
    .from("files")
    .insert([fileRecord])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await createFileWorkspace({
    user_id: createdFile.user_id,
    file_id: createdFile.id,
    workspace_id
  })

  const filePath = await uploadFile(file, {
    user_id: createdFile.user_id,
    file_id: createdFile.id // Use the actual file ID for the path
  })

  await updateFile(createdFile.id, {
    file_path: filePath
  })

  const fetchedFile = await getFileById(createdFile.id)

  return fetchedFile
}

// // Handle docx files
export const createDocXFile = async (
  text: string,
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string
) => {
  const { data: createdFile, error } = await supabase
    .from("files")
    .insert([fileRecord])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await createFileWorkspace({
    user_id: createdFile.user_id,
    file_id: createdFile.id,
    workspace_id
  })

  const filePath = await uploadFile(file, {
    user_id: createdFile.user_id,
    file_id: createdFile.id // Use the actual file ID for the path
  })

  await updateFile(createdFile.id, {
    file_path: filePath
  })

  const fetchedFile = await getFileById(createdFile.id)

  return fetchedFile
}

export const createFiles = async (
  files: TablesInsert<"files">[],
  workspace_id: string
) => {
  const { data: createdFiles, error } = await supabase
    .from("files")
    .insert(files)
    .select("*")

  if (error) {
    throw new Error(error.message)
  }

  await createFileWorkspaces(
    createdFiles.map((file: TablesInsert<"files">) => ({
      user_id: file.user_id!,
      file_id: file.id!,
      workspace_id
    }))
  )

  return createdFiles
}

export const createFileWorkspace = async (item: {
  user_id: string
  file_id: string
  workspace_id: string
}) => {
  const { data: createdFileWorkspace, error } = await supabase
    .from("file_workspaces")
    .insert([item])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return createdFileWorkspace
}

export const createFileWorkspaces = async (
  items: { user_id: string; file_id: string; workspace_id: string }[]
) => {
  const { data: createdFileWorkspaces, error } = await supabase
    .from("file_workspaces")
    .insert(items)
    .select("*")

  if (error) throw new Error(error.message)

  return createdFileWorkspaces
}

export const updateFile = async (
  fileId: string,
  file: TablesUpdate<"files">
) => {
  const { data: updatedFile, error } = await supabase
    .from("files")
    .update(file)
    .eq("id", fileId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updatedFile
}

export const deleteFile = async (fileId: string) => {
  const { error } = await supabase.from("files").delete().eq("id", fileId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export const deleteFileWorkspace = async (
  fileId: string,
  workspaceId: string
) => {
  const { error } = await supabase
    .from("file_workspaces")
    .delete()
    .eq("file_id", fileId)
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(error.message)

  return true
}

// New Type Definitions and Function

export interface FileUploadOperationParams {
  file: File;
  name: string;
  description: string | null;
  action: "upload" | "overwrite" | "skip";
  workspaceId: string;
  userId: string;
  existingFileId?: string; // Required for "overwrite"
}

export type DBFile = Tables<"files">;

export const processFileUploadOperation = async (
  operations: FileUploadOperationParams[]
): Promise<DBFile[]> => {
  const processedFiles: DBFile[] = [];

  for (const op of operations) {
    try {
      if (op.action === "skip") {
        console.log(`Skipping file: ${op.name}`);
        // Optionally, you could toast.info or some other feedback for skipped files
        continue;
      }

      if (op.action === "upload") {
        const fileRecord: TablesInsert<"files"> = {
          user_id: op.userId,
          name: op.name,
          description: op.description === null ? "" : op.description, // Handle null with empty string
          type: op.file.type,
          size: op.file.size,
          file_path: "", // Initialize as empty, will be updated by createFile/createDocXFile
          tokens: 0 // Initialize as 0, will be updated after embedding
        };

        let newFile;
        const fileExtension = op.file.name.split(".").pop()?.toLowerCase();
        if (fileExtension === "docx") {
          const arrayBuffer = await op.file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          newFile = await createDocXFile(
            result.value, // This text is currently unused in createDocXFile
            op.file,
            fileRecord,
            op.workspaceId
          );
        } else {
          newFile = await createFile(
            op.file,
            fileRecord,
            op.workspaceId
          );
        }
        processedFiles.push(newFile);
        toast.success(`File "${newFile.name}" uploaded successfully.`);

      } else if (op.action === "overwrite") {
        if (!op.existingFileId) {
          toast.error(`Error overwriting "${op.name}": Missing existing file ID.`);
          throw new Error("existingFileId is required for overwrite action.");
        }

        const updatePayload: TablesUpdate<"files"> = {
          name: op.name,
          description: op.description === null ? undefined : op.description, // For update, undefined might be acceptable to not change if null
          size: op.file.size,
          type: op.file.type
        };
        
        // Update metadata first
        let updatedFileMeta = await updateFile(op.existingFileId, updatePayload);

        // Re-upload the file to storage.
        // uploadFile uses user_id and file_id for the path and has upsert:true.
        const newFilePath = await uploadFile(op.file, {
          user_id: updatedFileMeta.user_id,
          file_id: op.existingFileId,
        });

        // Ensure file_path in DB is correct.
        // It should be consistent if derived from file_id, but this ensures it.
        if (updatedFileMeta.file_path !== newFilePath) {
          updatedFileMeta = await updateFile(op.existingFileId, { file_path: newFilePath });
        }
        
        processedFiles.push(updatedFileMeta);
        toast.success(`File "${updatedFileMeta.name}" overwritten successfully.`);
      }
    } catch (error: any) {
      console.error(`Failed to process file "${op.name}":`, error);
      toast.error(`Failed to process file "${op.name}": ${error.message || "Unknown error"}`);
      // Continue to the next file operation
    }
  }

  return processedFiles;
};
