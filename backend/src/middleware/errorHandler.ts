import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.user) {
    next(new AppError(401, "You must be signed in.", "UNAUTHORIZED"));
    return;
  }
  next();
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: { message: err.message, code: err.code } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: { message: err.issues[0]?.message ?? "Invalid request.", code: "VALIDATION" },
    });
    return;
  }
  console.error(err);
  res.status(500).json({
    success: false,
    error: { message: "Something went wrong. Please try again.", code: "INTERNAL" },
  });
}
