import session from "express-session";
import { prisma } from "./prisma.js";

export class PrismaSessionStore extends session.Store {
  async get(sid: string, cb: (err?: unknown, sess?: session.SessionData | null) => void) {
    try {
      const rec = await prisma.session.findUnique({ where: { sid } });
      if (!rec || rec.expiresAt < new Date()) {
        if (rec) await prisma.session.delete({ where: { sid } }).catch(() => undefined);
        cb(null, null);
        return;
      }
      cb(null, JSON.parse(rec.data) as session.SessionData);
    } catch (error) {
      cb(error);
    }
  }

  async set(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void) {
    try {
      const expiresAt = sess.cookie.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 8 * 60 * 60 * 1000);
      await prisma.session.upsert({
        where: { sid },
        update: { data: JSON.stringify(sess), expiresAt, userId: sess.user?.id ?? null },
        create: { sid, data: JSON.stringify(sess), expiresAt, userId: sess.user?.id ?? null },
      });
      cb?.();
    } catch (error) {
      cb?.(error);
    }
  }

  async destroy(sid: string, cb?: (err?: unknown) => void) {
    try {
      await prisma.session.deleteMany({ where: { sid } });
      cb?.();
    } catch (error) {
      cb?.(error);
    }
  }
}

declare module "express-session" {
  interface SessionData {
    user?: { id: string; name: string; email: string };
  }
}
