import { ApiError } from "./api";
import { supabase } from "./supabase";

export type UploadResult = {
  id: string;
  title: string;
  filename: string;
};

type UploadInput = {
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

/** Upload a lecture file to the API (multipart POST /api/documents). */
export async function uploadDocument(input: UploadInput): Promise<UploadResult> {
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
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Aether-Authorization": `Bearer ${token}`,
    },
  });

  const text = await res.text();
  type Payload = {
    success: boolean;
    data?: UploadResult;
    error?: { message: string; code: string };
  };

  let json: Payload;
  try {
    json = JSON.parse(text) as Payload;
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
