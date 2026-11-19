import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getStore } from "@/lib/tenant";
import { can, getCurrentUser } from "@/lib/store-auth";

// Product photos and store logos go straight from the browser to Vercel Blob.
// This route only hands out a short-lived upload token, and only to signed-in staff
// who may edit the catalog or settings of this store.
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;
// F-12 digital products: the files customers download after buying.
const FILE_TYPES = [
  "application/pdf", "application/zip", "application/x-zip-compressed", "application/epub+zip",
  "audio/mpeg", "audio/mp4", "audio/wav", "video/mp4", "image/jpeg", "image/png", "image/webp",
  "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const MAX_FILE_BYTES = 200 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ site: string }> }) {
  const store = await getStore((await params).site);
  if (!store) return Response.json({ error: "Store not found." }, { status: 404 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "Image uploads aren't set up for this platform yet." }, { status: 503 });

  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser(store);
        if (!user || !(can(user.role, "catalog") || can(user.role, "settings"))) throw new Error("Sign in as store staff to upload images.");
        // Keep every store's files in its own folder.
        if (!pathname.startsWith(`stores/${store.id}/`) || pathname.includes("..")) throw new Error("Invalid upload path.");
        // Downloads get a long random suffix so their address can't be guessed.
        if (pathname.startsWith(`stores/${store.id}/downloads/`))
          return { allowedContentTypes: FILE_TYPES, maximumSizeInBytes: MAX_FILE_BYTES, addRandomSuffix: true };
        return { allowedContentTypes: IMAGE_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 400 });
  }
}

export const dynamic = "force-dynamic";
