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
    const message = error.message.toLowerCase();
    if (message.includes("bucket") && message.includes("not found")) {
      throw Errors.serviceUnavailable(
        'The Supabase Storage bucket "files" was not found. Create it in Storage, then try again.',
        "STORAGE",
      );
    }
    if (message.includes("row-level security") || message.includes("unauthorized") || message.includes("403")) {
      throw Errors.serviceUnavailable(
        "Could not save the file to Storage. Add SUPABASE_SERVICE_ROLE_KEY, or allow uploads to the files bucket.",
        "STORAGE",
      );
    }
    throw Errors.serviceUnavailable(`Could not save the file to Storage: ${error.message}`, "STORAGE");
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
