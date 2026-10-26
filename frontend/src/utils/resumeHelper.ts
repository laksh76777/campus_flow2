/**
 * Normalizes resume URLs for reliable, error-free viewing in browser tabs.
 */
export const getResumeViewUrl = (url?: string | null): string => {
  if (!url || typeof url !== "string") return "";

  // Cloudinary image upload pointing to .pdf
  if (
    url.includes("res.cloudinary.com") &&
    url.includes("/image/upload/") &&
    url.toLowerCase().endsWith(".pdf")
  ) {
    // Return high-resolution rendered image of the document
    return url.replace(/\.pdf$/i, ".png");
  }

  return url;
};
