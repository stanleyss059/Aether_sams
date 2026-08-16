export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: (message = "You must be signed in.") => new AppError(401, message, "UNAUTHORIZED"),
  forbidden: (message = "You do not have permission to do that.") => new AppError(403, message, "FORBIDDEN"),
  notFound: (message = "Not found.") => new AppError(404, message, "NOT_FOUND"),
  validation: (message: string) => new AppError(400, message, "VALIDATION"),
  conflict: (message: string) => new AppError(409, message, "CONFLICT"),
  serviceUnavailable: (message: string, code = "UPSTREAM") => new AppError(503, message, code),
};
