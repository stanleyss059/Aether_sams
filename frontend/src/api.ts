import { supabase } from "./supabase";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Ok<T> = { success: true; data: T };
type Fail = { success: false; error: { message: string; code: string } };

function isFail<T>(result: Ok<T> | Fail): result is Fail {
  return !result.success;
}

async function bearerToken() {
  let { data } = await supabase.auth.getSession();
  let session = data.session;

  const expiresSoon = (session?.expires_at ?? 0) * 1000 < Date.now() + 60_000;
  if (!session || expiresSoon) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session ?? null;
  }

  return session?.access_token ?? null;
}

function withAuthHeaders(headers: Headers, token: string | null) {
  if (!token) return;
  headers.set("Authorization", `Bearer ${token}`);
  // Vercel production may strip Authorization; this header survives the proxy.
  headers.set("X-Aether-Authorization", `Bearer ${token}`);
}

export async function accessAuthHeaders() {
  const headers: Record<string, string> = {};
  const token = await bearerToken();
  if (!token) return headers;
  headers.Authorization = `Bearer ${token}`;
  headers["X-Aether-Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isForm && options.body) headers.set("Content-Type", "application/json");
  withAuthHeaders(headers, await bearerToken());
  let res: Response;
  try {
    res = await fetch(path, { ...options, credentials: "include", headers, cache: "no-store" });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      "NETWORK",
      0,
    );
  }
  const text = await res.text();
  let json: Ok<T> | Fail | null = null;
  try {
    json = JSON.parse(text) as Ok<T> | Fail;
  } catch {
    const timedOut = res.status === 504 || res.status === 502 || res.status === 524 || !text.trim();
    throw new ApiError(
      timedOut
        ? "That took too long. If you just uploaded a file, it may still be saved — refresh and click View note."
        : res.status >= 500
          ? "The server hit an error. Refresh and try again."
          : "Unexpected response from the server.",
      timedOut ? "TIMEOUT" : "HTTP",
      res.status,
    );
  }
  if (isFail(json)) {
    if (json.error.code === "UNAUTHORIZED" && res.status === 401) {
      await supabase.auth.signOut();
    }
    const message =
      json.error.code === "UNAUTHORIZED"
        ? "Your session expired. Please sign in again."
        : json.error.message;
    throw new ApiError(message, json.error.code, res.status);
  }
  return json.data;
}

function filenameFromDisposition(header: string | null) {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : null;
}

export async function downloadDocument(
  id: string,
  fallbackFilename: string,
  options: { admin?: boolean } = {},
) {
  const path = options.admin ? `/api/admin/documents/${id}/download` : `/api/documents/${id}/download`;
  const headers = new Headers();
  withAuthHeaders(headers, await bearerToken());
  let res: Response;
  try {
    res = await fetch(path, { credentials: "include", headers, cache: "no-store" });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      "NETWORK",
      0,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as Fail;
      if (!json.success) throw new ApiError(json.error.message, json.error.code, res.status);
    } catch (error) {
      if (error instanceof ApiError) throw error;
    }
    throw new ApiError("Could not download that file.", "HTTP", res.status);
  }
  const blob = await res.blob();
  const name = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? fallbackFilename;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type UserRole = "USER" | "ADMIN";
export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  suspendedAt: string | null;
  createdAt: string;
};

export type AdminOwner = { id: string; name: string; email: string };

export type AdminDashboard = {
  stats: {
    users: number;
    spaces: number;
    documents: number;
    quizzes: number;
    attempts: number;
    suspended: number;
  };
  recentActivity: AuditLogEntry[];
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  suspendedAt: string | null;
  createdAt: string;
  spaceCount: number;
  documentCount: number;
  quizCount: number;
  attemptCount: number;
};

export type AdminDocument = {
  id: string;
  title: string;
  filename: string;
  createdAt: string;
  quizCount: number;
  owner: AdminOwner;
  space: { id: string; title: string; courseCode: string } | null;
};

export type AdminSpace = {
  id: string;
  title: string;
  courseCode: string;
  description: string;
  accent: string;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
  quizCount: number;
  owner: AdminOwner;
};

export type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Accent = "forest" | "gold" | "clay" | "slate";
export type SpaceSummary = {
  id: string;
  title: string;
  courseCode: string;
  description: string;
  accent: Accent | string;
  createdAt: string;
  documentCount: number;
  quizCount: number;
};
export type SpaceDoc = {
  id: string;
  title: string;
  filename: string;
  summary?: string;
  quizCount: number;
  latestQuizId?: string | null;
  createdAt: string;
};
export type SpaceDetail = SpaceSummary & { documents: SpaceDoc[] };
export type LibraryData = {
  spaces: SpaceSummary[];
  unfiled: SpaceDoc[];
};
export type DocListItem = {
  id: string;
  title: string;
  filename: string;
  summary: string;
  fileUrl?: string | null;
  createdAt: string;
  quizCount: number;
  latestQuizId: string | null;
  spaceId?: string | null;
  space?: { id: string; title: string; courseCode: string } | null;
};
export type QuizSummary = { id: string; title: string; questionCount: number; attemptCount: number; createdAt: string };
export type DocDetail = {
  id: string;
  title: string;
  filename: string;
  summary: string;
  excerpt: string;
  fileUrl?: string | null;
  createdAt: string;
  space: { id: string; title: string; courseCode: string } | null;
  quizzes: QuizSummary[];
};
