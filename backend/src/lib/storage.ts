import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { Errors } from "./errors.js";

export const FILES_BUCKET = "files";

function requireConfig() {
  if (!config) throw new Error("Aether config is missing. Set Vercel environment variables.");
  return config;
}

function storageClient(accessToken?: string): SupabaseClient {
  const resolved = requireConfig();
  if (resolved.supabaseServiceRoleKey) {
    return createClient(resolved.supabaseUrl, resolved.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  if (resolved.isProd) {
    throw Errors.validation(
      "Storage uploads are not configured. Set SUPABASE_SERVICE_ROLE_KEY on the backend service, then redeploy.",
    );
  }
  return createClient(resolved.supabaseUrl, resolved.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

function safeFilename(filename: string) {
  const base = path.basename(filename).replace(/[^\w.\- ()[\]]+/g, "_").trim();
  return base.slice(0, 120) || "file";
}

export function storageObjectPath(userId: string, documentId: string, filename: string) {
  return `${userId}/${documentId}/${safeFilename(filename)}`;
}

export function newDocumentId() {
  return randomUUID();
}

function storageErrorMessage(raw: string) {
  const message = raw.toLowerCase();
  if (message.includes("bucket") && message.includes("not found")) {
    return 'The Supabase Storage bucket "files" was not found. Create it in Storage, then try again.';
  }
  if (
    message.includes("row-level security") ||
    message.includes("unauthorized") ||
    message.includes("invalid jwt") ||
    message.includes("403")
  ) {
    return "Could not save the file to Storage. Set SUPABASE_SERVICE_ROLE_KEY on the backend, then redeploy.";
  }
  return `Could not save the file to Storage: ${raw}`;
}

export async function createSignedUpload(objectPath: string) {
  const client = storageClient();
  const { data, error } = await client.storage.from(FILES_BUCKET).createSignedUploadUrl(objectPath);
  if (error || !data?.signedUrl || !data.token) {
    console.error("Supabase signed upload URL failed:", error?.message ?? "missing signed URL");
    throw Errors.validation(storageErrorMessage(error?.message ?? "Could not create a signed upload URL."));
  }
  const { data: pub } = client.storage.from(FILES_BUCKET).getPublicUrl(data.path);
  return {
    storagePath: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    fileUrl: pub.publicUrl,
  };
}

export async function uploadUserFile(input: {
  userId: string;
  documentId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  accessToken?: string;
}) {
  const objectPath = storageObjectPath(input.userId, input.documentId, input.filename);
  const client = storageClient(input.accessToken);
  const { error } = await client.storage.from(FILES_BUCKET).upload(objectPath, input.buffer, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (error) {
    console.error("Supabase Storage upload failed:", error.message);
    throw Errors.validation(storageErrorMessage(error.message));
  }

  const { data } = client.storage.from(FILES_BUCKET).getPublicUrl(objectPath);
  return { storagePath: objectPath, fileUrl: data.publicUrl };
}

export async function downloadStoredFile(storagePath: string, accessToken?: string) {
  const { data, error } = await storageClient(accessToken).storage.from(FILES_BUCKET).download(storagePath);
  if (error || !data) {
    throw Errors.notFound("The original file is no longer in Storage.");
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function removeStoredFile(storagePath: string, accessToken?: string) {
  if (!storagePath) return;
  const { error } = await storageClient(accessToken).storage.from(FILES_BUCKET).remove([storagePath]);
  if (error) {
    console.error("Failed to remove Storage object:", storagePath, error.message);
  }
}
