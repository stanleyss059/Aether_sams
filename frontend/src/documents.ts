import { ApiError, accessAuthHeaders } from "./api";

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

function isRetryableStatus(status: number) {
  return status === 0 || status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (isRetryableStatus(error.status)) return true;
  return error.status >= 500 && (error.code === "HTTP" || error.code === "UNAVAILABLE" || error.code === "DATABASE");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === attempts - 1) throw error;
      await sleep(600 * (attempt + 1));
    }
  }
  throw lastError;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: ApiPayload<T>;
  try {
    json = JSON.parse(text) as ApiPayload<T>;
  } catch {
    const unavailable = isRetryableStatus(res.status) || res.status >= 500;
    throw new ApiError(
      unavailable
        ? "The API was briefly unavailable. Try again in a moment."
        : "Unexpected response from the server.",
      unavailable ? "UNAVAILABLE" : "HTTP",
      res.status,
    );
  }

  if (!json.success || !json.data) {
    throw new ApiError(json.error?.message ?? "Upload failed.", json.error?.code ?? "HTTP", res.status);
  }

  return json.data;
}

async function jsonPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(await accessAuthHeaders()),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("The API was briefly unavailable. Try again in a moment.", "UNAVAILABLE", 0);
  }
  return parseJson<T>(res);
}

/** Upload a lecture file directly to Supabase Storage, then register it with the API. */
export async function uploadDocument(input: UploadInput): Promise<DocumentSummary> {
  const title = input.title ?? (input.file.name.replace(/\.[^.]+$/, "") || input.file.name);
  const prepared = await withRetry(() =>
    jsonPost<PreparedUpload>("/api/documents/prepare", {
      spaceId: input.spaceId,
      filename: input.file.name,
      title,
    }),
  );

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

  return withRetry(() =>
    jsonPost<DocumentSummary>("/api/documents/complete", {
      documentId: prepared.documentId,
      spaceId: prepared.spaceId,
      filename: prepared.filename,
      title: prepared.title,
      mimeType: input.file.type,
      storagePath: prepared.storagePath,
      fileUrl: prepared.fileUrl,
    }),
  );
}
