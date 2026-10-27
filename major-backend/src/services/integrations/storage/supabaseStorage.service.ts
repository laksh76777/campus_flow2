import { getSupabaseAdmin } from "../../../database/supabase.js";

/**
 * Maps a folder/category name to an appropriate Supabase Storage bucket
 */
const getBucketName = (folder: string): string => {
    const clean = folder.toLowerCase().trim();
    if (clean.includes("resume")) return "resumes";
    if (clean.includes("avatar")) return "avatars";
    if (clean.includes("cert")) return "certificates";
    if (clean.includes("job") || clean.includes("jd")) return "job-descriptions";
    return "resumes";
};

/**
 * Determines MIME content type from filename or default
 */
const getContentType = (filename: string, resourceType: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "pdf":
            return "application/pdf";
        case "png":
            return "image/png";
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "webp":
            return "image/webp";
        case "svg":
            return "image/svg+xml";
        case "docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        case "doc":
            return "application/msword";
        default:
            return resourceType === "image" ? "image/jpeg" : "application/octet-stream";
    }
};

/**
 * Uploads a file buffer directly to Supabase Storage
 */
export const uploadToSupabaseStorage = async (
    fileBuffer: Buffer,
    folder: string,
    filename: string,
    resourceType: "auto" | "image" | "raw" = "auto"
): Promise<{ url: string; publicId: string }> => {
    const supabase = getSupabaseAdmin();
    const bucket = getBucketName(folder);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${Date.now()}_${sanitizedFilename}`;
    const contentType = getContentType(filename, resourceType);

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileBuffer, {
            contentType,
            upsert: true
        });

    if (uploadError) {
        console.error(`Supabase storage upload error in bucket [${bucket}]:`, uploadError.message);
        throw new Error(`Failed to upload file to Supabase Storage: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return {
        url: publicUrl,
        publicId: `${bucket}/${filePath}`
    };
};

/**
 * Deletes a file from Supabase Storage
 */
export const deleteFromSupabaseStorage = async (publicId: string): Promise<boolean> => {
    try {
        const supabase = getSupabaseAdmin();
        const parts = publicId.split("/");
        if (parts.length < 2) return false;
        const bucket = parts[0];
        const filePath = parts.slice(1).join("/");

        const { error } = await supabase.storage.from(bucket).remove([filePath]);
        if (error) {
            console.warn(`Supabase storage delete error:`, error.message);
            return false;
        }
        return true;
    } catch {
        return false;
    }
};

export const uploadToStorage = uploadToSupabaseStorage;
export const deleteFromStorage = deleteFromSupabaseStorage;
