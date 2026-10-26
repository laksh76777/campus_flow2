import { v2 as cloudinary } from "cloudinary";
import { env } from "../../../config/env.js";

let isCloudinaryConfigured = false;

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET
    });
    isCloudinaryConfigured = true;
}

export const uploadToStorage = async (
    fileBuffer: Buffer,
    folder: string,
    filename: string,
    resourceType: "auto" | "image" | "raw" = "auto"
): Promise<{ url: string; publicId: string }> => {
    if (!isCloudinaryConfigured) {
        // Fallback for development / mock environments
        const mockPublicId = `${folder}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const mockUrl = `/uploads/${mockPublicId}`;
        return { url: mockUrl, publicId: mockPublicId };
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `campusflow/${folder}`,
                public_id: `${Date.now()}_${filename.replace(/\.[^/.]+$/, "")}`,
                resource_type: resourceType
            },
            (error, result) => {
                if (error || !result) {
                    return reject(error || new Error("Upload failed"));
                }
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id
                });
            }
        );
        uploadStream.end(fileBuffer);
    });
};
