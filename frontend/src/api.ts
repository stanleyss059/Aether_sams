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
  const res = await fetch(path, { ...options, credentials: "include", headers });
  const json = (await res.json()) as Ok<T> | Fail;
  if (!json.success) throw new ApiError(json.error.message, json.error.code, res.status);
  return json.data;
}

export type User = { id: string; name: string; email: string };
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
