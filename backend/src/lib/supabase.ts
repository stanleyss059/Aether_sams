import { createClient, type User as SupabaseUser, type SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "./prisma.js";

let client: SupabaseClient | null = null;

function getSupabaseAuth() {
  if (!config) throw new Error("Aether config is missing. Set Vercel environment variables.");
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return client;
}

const SUPABASE_PASSWORD_PLACEHOLDER = "supabase-auth";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  suspendedAt: string | null;
};

function displayName(user: SupabaseUser) {
  const metaName = user.user_metadata?.name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  return user.email?.split("@")[0] ?? "Student";
}

function toAppUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  suspendedAt: Date | null;
}): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    suspendedAt: user.suspendedAt ? user.suspendedAt.toISOString() : null,
  };
}

function desiredRole(email: string, current: UserRole): UserRole {
  if (config?.adminEmail && email === config.adminEmail) return "ADMIN";
  return current;
}

export async function ensureLocalUser(supabaseUser: SupabaseUser): Promise<AppUser> {
  const email = (supabaseUser.email ?? "").toLowerCase();
  if (!email) throw new Error("Supabase user is missing an email.");

  const name = displayName(supabaseUser);
  const existing = await prisma.user.findUnique({ where: { id: supabaseUser.id } });
  if (existing) {
    const role = desiredRole(email, existing.role);
    if (existing.name !== name || existing.email !== email || existing.role !== role) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { name, email, role },
      });
      return toAppUser(updated);
    }
    return toAppUser(existing);
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    const role = desiredRole(email, byEmail.role);
    const updated = await prisma.user.update({
      where: { id: byEmail.id },
      data: { name, role },
    });
    return toAppUser(updated);
  }

  const created = await prisma.user.create({
    data: {
      id: supabaseUser.id,
      name,
      email,
      passwordHash: SUPABASE_PASSWORD_PLACEHOLDER,
      role: desiredRole(email, "USER"),
    },
  });
  return toAppUser(created);
}

export const supabaseAuth = {
  auth: {
    getUser(token: string) {
      return getSupabaseAuth().auth.getUser(token);
    },
  },
};
