import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./theme";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="auth-card page-enter w-full max-w-md rounded-3xl border border-line bg-surface p-7 shadow-panel sm:p-9">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-12 w-12" />
          <p className="text-lg font-bold tracking-[-0.03em] text-ink">Aether</p>
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-[-0.04em]">{title}</h1>
        <p className="mt-2 mb-7 text-sm leading-6 text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
