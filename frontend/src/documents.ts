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

async function parseUploadResponse(res: Response): Promise<DocumentSummary> {
  const text = await res.text();
  let json: ApiPayload<DocumentSummary>;
  try {
    json = JSON.parse(text) as ApiPayload<DocumentSummary>;
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

/** POST /api/documents — upload a lecture file (no auth required; spaceId identifies the target). */
export async function uploadDocument(input: UploadInput): Promise<DocumentSummary> {
  const body = new FormData();
  body.append("file", input.file, input.file.name);
  body.append("spaceId", input.spaceId);
  body.append("title", input.title ?? (input.file.name.replace(/\.[^.]+$/, "") || input.file.name));

  const res = await fetch("/api/documents", {
    method: "POST",
    body,
    credentials: "include",
    cache: "no-store",
  });

  return parseUploadResponse(res);
}
