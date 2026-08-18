import { api, ApiError } from "./api";
import { supabase } from "./supabase";

export type DocumentSummary = {
  id: string;
  title: string;
  filename: string;
};

export type UploadInput = {
  file: File;
  spaceId?: string;
  title?: string;
};

async function accessToken() {
  let { data } = await supabase.auth.getSession();
  let session = data.session;

  const expiresSoon = (session?.expires_at ?? 0) * 1000 < Date.now() + 60_000;
  if (!session || expiresSoon) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session ?? null;
  }

  const token = session?.access_token;
  if (!token) {
    throw new ApiError("Your session expired. Please sign in again.", "UNAUTHORIZED", 401);
  }
  return token;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Aether-Authorization": `Bearer ${token}`,
  };
}

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  error?: { message: string; code: string };
};

async function parseUploadResponse(res: Response): Promise<DocumentSummary> {
  const text = await res.text();
  let json: ApiPayload<DocumentSummary>;
  try {
    json = JSON.parse(text) as ApiPayload<DocumentSummary>;
  } catch {
    throw new ApiError(
      res.status >= 500 ? "The server hit an error. Try again." : "Unexpected response from the server.",
      "HTTP",
      res.status,
    );
  }

  if (!json.success || !json.data) {
    if (json.error?.code === "UNAUTHORIZED") await supabase.auth.signOut();
    throw new ApiError(json.error?.message ?? "Upload failed.", json.error?.code ?? "HTTP", res.status);
  }

  return json.data;
}

/** POST /api/documents — upload a lecture file. */
export async function uploadDocument(input: UploadInput): Promise<DocumentSummary> {
  const token = await accessToken();
  const body = new FormData();
  body.append("file", input.file, input.file.name);
  if (input.spaceId) body.append("spaceId", input.spaceId);
  body.append("title", input.title ?? (input.file.name.replace(/\.[^.]+$/, "") || input.file.name));

  const res = await fetch("/api/documents", {
    method: "POST",
    body,
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(token),
  });

  return parseUploadResponse(res);
}

/** GET /api/documents */
export function listDocuments() {
  return api<DocumentSummary[]>("/api/documents");
}

/** GET /api/documents/:id */
export function getDocument(id: string) {
  return api(`/api/documents/${id}`);
}

/** DELETE /api/documents/:id */
export function deleteDocument(id: string) {
  return api<{ id: string }>(`/api/documents/${id}`, { method: "DELETE" });
}

/** POST /api/documents/:id/notes */
export function generateDocumentNotes(id: string) {
  return api<{ id: string; summary: string }>(`/api/documents/${id}/notes`, { method: "POST" });
}

/** POST /api/documents/:id/generate */
export function generateDocumentQuiz(id: string, count = 50) {
  return api<{ quizId: string }>(`/api/documents/${id}/generate`, {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}
