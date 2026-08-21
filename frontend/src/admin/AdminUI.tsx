import type { InputHTMLAttributes, ReactNode } from "react";
import { LoadingState } from "../Spinner";

export type Tone = "accent" | "neutral" | "danger" | "warn";

const CHIP_TONES: Record<Tone, string> = {
  accent: "bg-forest/10 text-forest",
  neutral: "bg-slate/10 text-slate",
  danger: "bg-danger/10 text-danger",
  warn: "bg-clay/10 text-clay",
};

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${CHIP_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-parchment px-2.5 py-1 text-xs font-semibold text-muted">
      {children}
    </span>
  );
}

export function FilterBar({
  onSubmit,
  submitLabel = "Search",
  children,
}: {
  onSubmit: () => void;
  submitLabel?: string;
  children: ReactNode;
}) {
  return (
    <form
      className="rounded-2xl border border-line bg-surface p-3 sm:p-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button
          type="submit"
          className="rounded-lg bg-forest px-5 py-2.5 text-sm font-semibold text-white"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function FilterInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-w-[180px] flex-1 rounded-lg border border-line px-3.5 py-2.5 text-sm ${className}`}
    />
  );
}

export function ResultCount({ total, unit }: { total: number; unit: string }) {
  return (
    <p className="px-1 text-xs font-bold tracking-[0.12em] text-muted uppercase">
      {total} {total === 1 ? unit : `${unit}s`}
    </p>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">{message}</p>;
}

export function LoadingRows(_props: { rows?: number } = {}) {
  return <LoadingState className="flex items-center justify-center py-12" />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-12 text-center">
      <p className="font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

export function RowCard({ children }: { children: ReactNode }) {
  return (
    <div className="lift-card flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      {children}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-sm font-bold text-forest"
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

export function RowButton({
  tone = "neutral",
  disabled,
  onClick,
  children,
}: {
  tone?: "neutral" | "accent" | "danger";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const styles = {
    neutral: "border-line text-ink hover:bg-slate/5",
    accent: "border-forest/40 text-forest hover:bg-forest/5",
    danger: "border-danger/30 text-danger hover:bg-danger/5",
  }[tone];
  return (
    <button
      type="button"
      className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition disabled:opacity-60 ${styles}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Pager({
  page,
  totalPages,
  total,
  unit,
  onChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  unit?: string;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5">
      <button
        type="button"
        className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <p className="text-sm text-muted">
        Page {page} of {totalPages}
        {typeof total === "number" && unit ? ` · ${total} ${total === 1 ? unit : `${unit}s`}` : ""}
      </p>
      <button
        type="button"
        className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
