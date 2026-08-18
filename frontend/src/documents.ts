import { ApiError } from "./api";

export type DocumentSummary = {
  id: string;
  title: string;
  filename: string;
  fileUrl?: string | null;
};

export type UploadInput = {
  file: File;
  spaceId: string;
  title?: string;
};

type ApiPayload<T> = {
  success: boolean;
  data?: T;
  error?: { message: string; code: string };
};

type PreparedUpload = {
  documentId: string;
  spaceId: string;
  filename: string;
  title: string;
  storagePath: string;
  token: string;
  signedUrl: string;
  fileUrl: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: ApiPayload<T>;
  try {
    json = JSON.parse(text) as ApiPayload<T>;
  } catch {
    throw new ApiError(
      res.status === 503
        ? "Upload failed because the API is unavailable. Redeploy or try again in a moment."
        : res.status >= 500
          ? "The server hit an error. Try again."
          : "Unexpected response from the server.",
      "HTTP",
      res.status,
    );
  }

  if (!json.success || !json.data) {
    throw new ApiError(json.error?.message ?? "Upload failed.", json.error?.code ?? "HTTP", res.status);
  }

  return json.data;
}

async function jsonPost<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res);
}

/** Upload a lecture file directly to Supabase Storage, then register it with the API. */
export async function uploadDocument(input: UploadInput): Promise<DocumentSummary> {
  const title = input.title ?? (input.file.name.replace(/\.[^.]+$/, "") || input.file.name);
  const prepared = await jsonPost<PreparedUpload>("/api/documents/prepare", {
    spaceId: input.spaceId,
    filename: input.file.name,
    title,
  });

  const put = await fetch(prepared.signedUrl, {
    method: "PUT",
    body: input.file,
    headers: {
      "Content-Type": input.file.type || "application/octet-stream",
      Authorization: `Bearer ${prepared.token}`,
    },
  });
  if (!put.ok) {
    const detail = await put.text().catch(() => "");
    throw new ApiError(detail || "Could not upload the file to Storage.", "STORAGE", put.status || 400);
  }

  return jsonPost<DocumentSummary>("/api/documents/complete", {
    documentId: prepared.documentId,
    spaceId: prepared.spaceId,
    filename: prepared.filename,
    title: prepared.title,
    mimeType: input.file.type,
    storagePath: prepared.storagePath,
    fileUrl: prepared.fileUrl,
  });
}
