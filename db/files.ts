import { supabase } from "@/lib/supabase/browser-client"
import { TablesInsert, TablesUpdate, Tables } from "@/supabase/types" // Added Tables
import mammoth from "mammoth"
import { toast } from "sonner"
import { uploadFile } from "./storage/files"
import { 추출 } from "@tanstack/react-query" // This seems like an unrelated import, might be a copy-paste artifact. Keeping for now.
import {
  SelectedFileData,
  FileActionType
} from "@/components/sidebar/items/files/create-file" // Import types

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

  // Diagnostic log: Check Supabase auth state before insert
  const session = supabase.auth.getSession()
  const currentUser = supabase.auth.getUser()
  console.log("createFile: About to insert. Client session:", session);
  console.log("createFile: About to insert. Client user:", currentUser);
  console.log("createFile: About to insert. FileRecord user_id:", fileRecord.user_id);

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

export async function processFileUploadOperation(
  profile: Tables<"profiles">, // Profile object which includes user_id
  workspaceId: string,
  filesToProcess: SelectedFileData[], // Use SelectedFileData[]
  fileOperation: FileActionType, // Use FileActionType
  source: "chat" | "chunks"
) {
  console.log(
    "processFileUploadOperation: Received profile:",
    JSON.stringify(profile, null, 2)
  )
  console.log(
    "processFileUploadOperation: Received profile.user_id:", // Log the critical part
    profile.user_id
  );
  console.log(
    "processFileUploadOperation: Received workspaceId:",
    workspaceId
  )
  console.log(
    "processFileUploadOperation: Received filesToProcess:",
    JSON.stringify(filesToProcess, null, 2)
  );
  console.log("processFileUploadOperation: Received fileOperation:", fileOperation);

  const operationResults: FileOperationResult[] = [];

  for (const selectedFile of filesToProcess) {
    const { file, name: originalName, description } = selectedFile
    let resolvedName = originalName
    let operation = fileOperation

    // If the individual file has a specific action due to conflict resolution, it might override the batch operation.
    // This part depends on how `selectedFile.action` is managed and if it should take precedence.
    // For now, assuming `fileOperation` is the determined action for this item if part of a batch.
    if (selectedFile.action && selectedFile.action !== "rename_initiate" && selectedFile.action !== "upload") {
        operation = selectedFile.action;
    }
    
    if (operation === "skip") {
      operationResults.push({
        fileRecord: null,
        success: true,
        error: null,
        action: "skip",
        originalName: selectedFile.originalFilename
      })
      console.log(`Skipping file ${selectedFile.originalFilename} as per operation.`);
      continue
    }

    if (selectedFile.action === "rename_initiate") {
        // The 'name' field in SelectedFileData should be the new, user-confirmed unique name
        resolvedName = selectedFile.name;
        operation = "upload"; // After renaming, it's an upload operation
        console.log(`File ${selectedFile.originalFilename} will be uploaded as ${resolvedName} after rename.`);
    }


    const filePath = await uploadFile(file, {
      user_id: profile.user_id, // Use user_id from profile
      workspace_id: workspaceId, // workspace_id is not part of FileItemChunk interface, but used for path
      name: resolvedName, // Use the resolved name (original or new)
      type: file.type
    })

    // Prepare file record for Supabase
    const fileRecord: TablesInsert<"files"> = {
      user_id: profile.user_id, // Ensure this is being set from the passed profile
      description: description || "",
      file_path: filePath,
      name: resolvedName,
      type: file.type,
      size: file.size,
      tokens: 0, // Initialize as 0, will be updated after embedding
    };

    try {
      if (operation === "upload") {
        // Insert new file record into Supabase
        const newFile = await insertFileRecordIntoSupabase(supabase, profile, fileRecord);
        operationResults.push({
          file: newFile,
          action: "upload",
          success: true,
          message: `File "${newFile.name}" uploaded successfully.`,
        });
      } else if (operation === "overwrite") {
        // For overwrite, we need the existing file ID
        if (!selectedFile.id) {
          throw new Error("Existing file ID not found for overwrite action.");
        }

        // Update file record in Supabase
        const { data: updatedFile, error: updateError } = await supabase
          .from("files")
          .update(fileRecord)
          .eq("id", selectedFile.id)
          .select("*")
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Upload the new file version
        const newFilePath = await uploadFile(file, {
          user_id: profile.user_id,
          file_id: selectedFile.id, // Use the existing file ID
          upsert: true,
        });

        // Update file path if it has changed
        if (newFilePath !== updatedFile.file_path) {
          await supabase
            .from("files")
            .update({ file_path: newFilePath })
            .eq("id", selectedFile.id);
        }

        operationResults.push({
          file: updatedFile,
          action: "overwrite",
          success: true,
          message: `File "${updatedFile.name}" overwritten successfully.`,
        });
      }
    } catch (error: any) {
      console.error("Error processing file:", error);
      operationResults.push({
        file: file.file,
        action: fileOperation.action,
        success: false,
        message: error.message || "Unknown error",
      });
    }
  }

  return operationResults;
}

async function insertFileRecordIntoSupabase(
  supabase: SupabaseClient,
  profile: Tables<"profiles">, // Pass full profile
  fileRecord: TablesInsert<"files">
): Promise<DBFile> {
  console.log(
    "insertFileRecordIntoSupabase: About to insert. Profile user_id:",
    profile?.user_id, 
    "FileRecord user_id:",
    fileRecord.user_id 
  )
  console.log(
    "insertFileRecordIntoSupabase: Full fileRecord:",
    JSON.stringify(fileRecord, null, 2)
  )

  const { data, error } = await supabase
    .from("files")
    .insert([fileRecord])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
