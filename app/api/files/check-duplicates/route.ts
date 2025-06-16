import { NextResponse } from "next/server";
import { cookies } from "next/headers"; // The import we are testing

export async function POST(request: Request) {
  console.log("Test route called. Attempting to use cookies from next/headers.");

  // Temporarily comment out the actual usage to isolate the import issue
  /*
  const cookieStore = cookies(); 
  // import { createClient } from "@/lib/supabase/server"; // Also comment out related imports if not used
  // const supabase = createClient(cookieStore);

  const { fileNames, workspaceId } = await request.json();

  if (!fileNames || !Array.isArray(fileNames) || !workspaceId) {
    return NextResponse.json(
      { error: "Missing fileNames array or workspaceId" },
      { status: 400 }
    );
  }

  try {
    // const { data: existingFiles, error } = await supabase
    //   .from("files")
    //   .select("name")
    //   .in("name", fileNames)
    //   .eq("workspace_id", workspaceId);

    // if (error) {
    //   console.error("Error checking duplicate files:", error);
    //   return NextResponse.json(
    //     { error: "Error checking duplicate files", details: error.message },
    //     { status: 500 }
    //   );
    // }

    // const conflictingFileNames = existingFiles?.map((file: { name: string }) => file.name) || [];
    // return NextResponse.json({ conflictingFileNames }, { status: 200 });
    return NextResponse.json({ message: "Test successful, cookies import was recognized if no build error." }, { status: 200 });

  } catch (error: any) {
    console.error("Error in test check-duplicates route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  */

  // Return a simple response for the test
  return NextResponse.json({ message: "API route is alive, next/headers import is present." }, { status: 200 });
}
