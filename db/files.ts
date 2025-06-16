import { supabase } from "@/lib/supabase/browser-client"
import { TablesInsert, TablesUpdate, Tables } from "@/supabase/types" // Added Tables
import mammoth from "mammoth"
import { toast } from "sonner"
import { uploadFile } from "./storage/files"
import {
  SelectedFileData,
  FileActionType
} from "@/components/sidebar/items/files/create-file" // Import types

export type DBFile = Tables<"files">; // Moved DBFile type definition up for clarity

// Define FileOperationResult based on usage
export interface FileOperationResult {
  file: DBFile | null;
  action: FileActionType | "skip"; // "skip" is a possible action
  success: boolean;
  message: string | null;
  originalName?: string; // For skip action, to identify which file
}

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

// Modify processFileUploadOperation to use module-scoped supabase client
export async function processFileUploadOperation(
  profile: Tables<"profiles">,
  workspaceId: string,
  filesToProcess: SelectedFileData[],
  fileOperation: FileActionType, // This is the batch operation (upload, overwrite, skip from UI)
  source: "chat" | "chunks" // Keep source if used, otherwise can be removed
): Promise<FileOperationResult[]> {
  console.log(
    "processFileUploadOperation: Received profile.user_id:",
    profile.user_id
  );
  console.log(
    "processFileUploadOperation: Received workspaceId:",
    workspaceId
  );
  console.log(
    "processFileUploadOperation: Received filesToProcess count:",
    filesToProcess.length
  );
  console.log("processFileUploadOperation: Received batch fileOperation:", fileOperation);

  const operationResults: FileOperationResult[] = [];

  for (const selectedFile of filesToProcess) {
    const { file, name: currentName, description, originalFilename, action: individualAction } = selectedFile;
    let resolvedName = currentName; // Name, possibly updated by user during rename flow
    
    // Determine the actual operation for this specific file.
    // It could be the batch operation, or an individual action from conflict resolution.
    let currentFileAction = individualAction || fileOperation;
    if (individualAction === "rename_initiate") { // If rename was chosen
        resolvedName = selectedFile.name; // Use the new name provided by user
        currentFileAction = "upload"; // After rename, it's an upload
        console.log(`File ${originalFilename} will be uploaded as ${resolvedName} after rename.`);
    } else if (individualAction === "upload" && fileOperation === "overwrite") {
        // If user chose to "Upload as new" for a duplicate during a batch "overwrite"
        currentFileAction = "upload";
    }


    if (currentFileAction === "skip") {
      console.log(`Skipping file ${originalFilename} as per operation.`);
      operationResults.push({
        file: null,
        action: "skip",
        success: true,
        message: `File "${originalFilename}" was skipped.`,
        originalName: originalFilename
      });
      continue;
    }

    try {
      if (currentFileAction === "upload") {
        const fileRecordInsert: TablesInsert<"files"> = {
          user_id: profile.user_id,
          description: description || "",
          name: resolvedName,
          type: file.type,
          size: file.size,
          tokens: 0, // Initialize, will be updated later if needed
          file_path: "" // Initialize, will be set after upload
        };

        // 1. Insert initial record to get an ID
        console.log("Attempting to insert initial file record for:", resolvedName, "User ID:", profile.user_id);
        const initialFile = await insertFileRecordIntoSupabase(profile, fileRecordInsert); // Pass profile
        console.log("Initial file record inserted:", initialFile.id, "for", initialFile.name);
        
        // 2. Upload file to storage using the new file ID
        const filePath = await uploadFile(file, {
          user_id: initialFile.user_id, // Use user_id from the confirmed inserted record
          file_id: initialFile.id
        });
        console.log("File uploaded to storage path:", filePath);

        // 3. Update file record with the actual file_path
        const finalFile = await updateFile(initialFile.id, {
          file_path: filePath
        });
        console.log("File record updated with path:", finalFile.id);
        
        // TODO: Create file_workspaces entry
        await createFileWorkspace({
            user_id: finalFile.user_id,
            file_id: finalFile.id,
            workspace_id: workspaceId
        });
        console.log("File_workspace entry created for file:", finalFile.id, "workspace:", workspaceId);


        operationResults.push({
          file: finalFile,
          action: "upload",
          success: true,
          message: `File "${finalFile.name}" uploaded successfully.`,
        });
        toast.success(`File "${finalFile.name}" uploaded.`);

      } else if (currentFileAction === "overwrite") {
        if (!selectedFile.id) { // existingFileId should be on selectedFile if it's a confirmed duplicate
          toast.error(`Error overwriting "${resolvedName}": Missing existing file ID.`);
          throw new Error("Existing file ID not found for overwrite action.");
        }
        const existingFileId = selectedFile.id;

        const fileRecordUpdate: TablesUpdate<"files"> = {
          // user_id is not updated, it's fixed for the file
          description: description || "",
          name: resolvedName, // Name might have been changed by user even for overwrite
          type: file.type,
          size: file.size,
          // tokens might need re-calculation, file_path will be updated
        };

        // 1. Update metadata (name, description, size, type)
        // Note: uploadFile will replace the actual file in storage.
        // We use the existingFileId to ensure we're overwriting the correct storage object.
        console.log("Attempting to upload new version for file ID:", existingFileId);
        const newFilePath = await uploadFile(file, {
          user_id: profile.user_id, // RLS check for storage write if policies apply there
          file_id: existingFileId, 
          // upsert: true, // uploadFile should handle this, or its type needs to allow it. Assuming it does.
        });
        console.log("File overwritten in storage, new path (should be same if ID-based):", newFilePath);

        // 2. Update DB record with new metadata and potentially new path (if it changed, though unlikely if ID-based)
        const updatedFile = await updateFile(existingFileId, {
            ...fileRecordUpdate,
            file_path: newFilePath // Ensure path is updated
        });
        console.log("File record updated for overwrite:", updatedFile.id);

        operationResults.push({
          file: updatedFile,
          action: "overwrite",
          success: true,
          message: `File "${updatedFile.name}" overwritten successfully.`,
        });
        toast.success(`File "${updatedFile.name}" overwritten.`);
      }
    } catch (error: any) {
      console.error("Error processing file:", originalFilename, error);
      toast.error(`Failed to process "${originalFilename}": ${error.message}`);
      operationResults.push({
        file: null, // Or some representation of the failed file
        action: currentFileAction,
        success: false,
        message: `Failed for "${originalFilename}": ${error.message || "Unknown error"}`,
        originalName: originalFilename
      });
    }
  }
  return operationResults;
}

// Modify insertFileRecordIntoSupabase to use module-scoped supabase client
async function insertFileRecordIntoSupabase(
  profile: Tables<"profiles">, // Keep profile for logging or if needed by RLS directly in function
  fileRecord: TablesInsert<"files">
): Promise<DBFile> { // Ensure it returns DBFile (Tables<"files">)
  console.log(
    "insertFileRecordIntoSupabase: About to insert. Profile user_id for record:",
    profile.user_id, 
    "FileRecord user_id being set:",
    fileRecord.user_id 
  );
  if (profile.user_id !== fileRecord.user_id) {
    console.warn("Mismatch between profile.user_id and fileRecord.user_id in insertFileRecordIntoSupabase!");
    // Potentially throw an error or align them, but fileRecord.user_id should be authoritative if set from profile earlier.
  }
  console.log(
    "insertFileRecordIntoSupabase: Full fileRecord:",
    JSON.stringify(fileRecord, null, 2)
  );

  const { data: insertedFile, error } = await supabase // Use module-scoped supabase
    .from("files")
    .insert(fileRecord) // fileRecord should be a single object, not an array unless API changed
    .select("*")
    .single();

  if (error) {
    console.error("insertFileRecordIntoSupabase error:", error);
    throw new Error(`Supabase insert error: ${error.message}`);
  }
  if (!insertedFile) {
    console.error("insertFileRecordIntoSupabase error: No data returned after insert.");
    throw new Error("No data returned after file insert.");
  }
  console.log("insertFileRecordIntoSupabase: Inserted file:", insertedFile.id);
  return insertedFile;
}
