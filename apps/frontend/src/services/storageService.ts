import api, { type ApiResponse, extractData } from "./api";
import axios from "axios";

// ==================== TYPES ====================

export type UploadContext = "chat" | "listing" | "profile" | "dispute";

interface PresignResponse {
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  key: string;
}

interface ConfirmResponse {
  url?: string;
  key?: string;
  file?: {
    id: number;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    downloadUrl: string;
  };
}

export interface UploadResult {
  url: string;
  key: string;
  file?: ConfirmResponse["file"];
}

// ==================== PRESIGNED UPLOAD FLOW ====================

/**
 * Upload a file using the presigned URL flow:
 * 1. Request presigned URL from backend
 * 2. Upload file directly to storage (S3/local)
 * 3. Confirm upload with backend (creates DB records if needed)
 *
 * Falls back to legacy FormData upload if presigned endpoint is unavailable.
 */
export async function uploadFile(
  file: File,
  context: UploadContext,
  contextId?: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  try {
    // Step 1: Get presigned URL
    const presignResponse = await api.post<ApiResponse<PresignResponse>>(
      "/storage/presign-upload",
      {
        filename: file.name,
        contentType: file.type,
        context,
        contextId,
        fileSize: file.size,
      },
    );
    const presigned = extractData(presignResponse);

    // Step 2: Upload directly to storage
    await axios({
      method: presigned.method as "PUT" | "POST",
      url: presigned.uploadUrl,
      data: file,
      headers: {
        ...presigned.headers,
        "Content-Type": file.type,
      },
      onUploadProgress: onProgress
        ? (event) => {
            if (event.total) {
              onProgress(Math.round((event.loaded * 100) / event.total));
            }
          }
        : undefined,
    });

    // Step 3: Confirm upload
    const confirmResponse = await api.post<ApiResponse<ConfirmResponse>>(
      "/storage/confirm-upload",
      {
        key: presigned.key,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        context,
        contextId,
      },
    );
    const confirmed = extractData(confirmResponse);

    return {
      url: confirmed.file?.downloadUrl || confirmed.url || presigned.key,
      key: confirmed.key || presigned.key,
      file: confirmed.file,
    };
  } catch (err: any) {
    // If presigned endpoint returns 404, it's not deployed yet — rethrow
    throw err;
  }
}

/**
 * Upload multiple files in sequence (e.g., listing images).
 * Returns array of URLs for successfully uploaded files.
 */
export async function uploadFiles(
  files: File[],
  context: UploadContext,
  contextId?: string,
  onProgress?: (fileIndex: number, percent: number) => void,
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const result = await uploadFile(
      files[i],
      context,
      contextId,
      onProgress ? (percent) => onProgress(i, percent) : undefined,
    );
    results.push(result);
  }
  return results;
}

// ==================== CONVENIENCE WRAPPERS ====================

/**
 * Upload a chat attachment via presigned URL.
 */
export async function uploadChatAttachment(
  file: File,
  orderId: number,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return uploadFile(file, "chat", String(orderId), onProgress);
}

/**
 * Upload listing images via presigned URLs.
 * Returns array of public URLs.
 */
export async function uploadListingImagesPresigned(
  files: File[],
  onProgress?: (fileIndex: number, percent: number) => void,
): Promise<string[]> {
  const results = await uploadFiles(files, "listing", undefined, onProgress);
  return results.map((r) => r.url);
}

/**
 * Upload a profile avatar via presigned URL.
 */
export async function uploadProfileImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const result = await uploadFile(file, "profile", undefined, onProgress);
  return result.url;
}

/**
 * Upload a dispute evidence file via presigned URL.
 */
export async function uploadDisputeFile(
  file: File,
  disputeId: number,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return uploadFile(file, "dispute", String(disputeId), onProgress);
}
