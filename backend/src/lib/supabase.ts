import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import { config } from "../config.js";
import { prisma } from "./prisma.js";

export const supabaseAuth = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const SUPABASE_PASSWORD_PLACEHOLDER = "supabase-auth";

export type AppUser = { id: string; name: string; email: string };

function displayName(user: SupabaseUser) {
  const metaName = user.user_metadata?.name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  return user.email?.split("@")[0] ?? "Student";
}

export async function ensureLocalUser(supabaseUser: SupabaseUser): Promise<AppUser> {
  const email = (supabaseUser.email ?? "").toLowerCase();
  if (!email) throw new Error("Supabase user is missing an email.");

  const name = displayName(supabaseUser);
  const existing = await prisma.user.findUnique({ where: { id: supabaseUser.id } });
  if (existing) {
    if (existing.name !== name || existing.email !== email) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { name, email },
      });
      return { id: updated.id, name: updated.name, email: updated.email };
    }
    return { id: existing.id, name: existing.name, email: existing.email };
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    // Prefer the Supabase auth id going forward.
    const updated = await prisma.user.update({
      where: { id: byEmail.id },
      data: { name },
    });
    return { id: updated.id, name: updated.name, email: updated.email };
  }

  const created = await prisma.user.create({
    data: {
      id: supabaseUser.id,
      name,
      email,
      passwordHash: SUPABASE_PASSWORD_PLACEHOLDER,
    },
  });
  return { id: created.id, name: created.name, email: created.email };
}
