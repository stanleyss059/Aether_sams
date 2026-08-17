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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isForm && options.body) headers.set("Content-Type", "application/json");
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(path, { ...options, credentials: "include", headers });
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
    throw new ApiError(
      res.status >= 500
        ? "The API crashed. Open Vercel → Logs and redeploy the latest commit."
        : "Unexpected response from the server.",
      "HTTP",
      res.status,
    );
  }
  if (!json.success) throw new ApiError(json.error.message, json.error.code, res.status);
  return json.data;
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
  createdAt: string;
  space: { id: string; title: string; courseCode: string } | null;
  quizzes: QuizSummary[];
};
