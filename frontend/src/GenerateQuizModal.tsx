import { useEffect, useState } from "react";
import { ModalLayer } from "./ModalLayer";
import { Spinner } from "./Spinner";

export const QUIZ_SIZE_OPTIONS = [
  { label: "10–15", hint: "Quick recap", count: 12 },
  { label: "15–20", hint: "Short practice", count: 18 },
  { label: "20–30", hint: "Standard set", count: 25 },
  { label: "30–40", hint: "Longer drill", count: 35 },
  { label: "40–50", hint: "Full exam style", count: 50 },
] as const;

type GenerateQuizModalProps = {
  open: boolean;
  title?: string;
  busy?: boolean;
  onCancel: () => void;
  onGenerate: (count: number) => void;
};

export function GenerateQuizModal({
  open,
  title,
  busy = false,
  onCancel,
  onGenerate,
}: GenerateQuizModalProps) {
  const [count, setCount] = useState<number>(QUIZ_SIZE_OPTIONS[2].count);

  useEffect(() => {
    if (open) setCount(QUIZ_SIZE_OPTIONS[2].count);
  }, [open]);

  return (
    <ModalLayer
      open={open}
      labelledBy="generate-quiz-title"
      describedBy="generate-quiz-desc"
      busy={busy}
      onCancel={onCancel}
      maxWidthClassName="max-w-lg"
    >
      <div className="p-5 sm:p-6">
        <span className="inline-flex rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest">
          QUIZ LENGTH
        </span>
        <h2 id="generate-quiz-title" className="mt-3 text-2xl font-bold tracking-[-0.03em] text-ink">
          How many questions?
        </h2>
        <p id="generate-quiz-desc" className="mt-1.5 text-sm leading-relaxed text-muted">
          {title ? (
            <>
              Pick a range for <span className="font-semibold text-ink">“{title}”</span>. Questions stay on this file only.
            </>
          ) : (
            "Pick a range. Aether will write questions from this file only."
          )}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {QUIZ_SIZE_OPTIONS.map((option, index) => {
            const active = count === option.count;
            const wide = index === QUIZ_SIZE_OPTIONS.length - 1;
            return (
              <button
                key={option.count}
                type="button"
                disabled={busy}
                onClick={() => setCount(option.count)}
                className={`rounded-2xl border px-3 py-3 text-left ${wide ? "col-span-2" : ""} ${
                  active
                    ? "border-forest bg-forest/10 ring-2 ring-forest"
                    : "card-inset hover:border-forest/40"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold tracking-tight text-ink">{option.label}</span>
                  {active ? <span className="text-xs font-bold text-forest">Selected</span> : null}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex min-w-32 items-center justify-center rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => onGenerate(count)}
          >
            {busy ? <Spinner size="sm" /> : "Generate quiz"}
          </button>
        </div>
      </div>
    </ModalLayer>
  );
}
