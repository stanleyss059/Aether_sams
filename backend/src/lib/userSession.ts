import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE = "sf.user";

type SessionUser = { id: string; name: string; email: string };

function sign(value: string, secret: string) {
  const hmac = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${hmac}`;
}

function unsign(signed: string, secret: string) {
  const i = signed.lastIndexOf(".");
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const hmac = signed.slice(i + 1);
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

declare module "express-serve-static-core" {
  interface Request {
    session: {
      user?: SessionUser;
      destroy: (cb?: (err?: Error) => void) => void;
    };
  }
}

export function userSession(secret: string, isProd: boolean) {
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    let user: SessionUser | undefined;
    const raw = req.cookies?.[COOKIE];
    if (typeof raw === "string" && raw) {
      try {
        const payload = unsign(raw, secret);
        if (payload) user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
      } catch {
        user = undefined;
      }
    }

    const write = (nextUser: SessionUser | undefined) => {
      user = nextUser;
      if (!nextUser) {
        res.clearCookie(COOKIE, { path: "/", secure: isProd, sameSite: "lax" });
        return;
      }
      const payload = Buffer.from(JSON.stringify(nextUser), "utf8").toString("base64url");
      res.cookie(COOKIE, sign(payload, secret), cookieOpts);
    };

    req.session = {
      get user() {
        return user;
      },
      set user(value) {
        write(value);
      },
      destroy(cb) {
        write(undefined);
        cb?.();
      },
    };
    next();
  };
}
