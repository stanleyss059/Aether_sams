import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

type OnboardingGuideProps = {
  open: boolean;
  name: string;
  onClose: () => void;
};

const steps = [
  {
    number: "01",
    title: "Create a space",
    description: "Make a course space to keep related lecture material and quizzes together.",
  },
  {
    number: "02",
    title: "Upload your notes",
    description: "Add a PDF, Word, PowerPoint, or text file. Aether extracts the readable content.",
  },
  {
    number: "03",
    title: "Generate a quiz",
    description: "Turn your uploaded material into questions, then practise and review your answers.",
  },
];

export function OnboardingGuide({ open, name, onClose }: OnboardingGuideProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const firstName = name.split(" ")[0] || "there";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8" role="presentation">
      <button
        type="button"
        aria-label="Close welcome guide"
        className="overlay-in absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        className="morph-in relative w-full max-w-2xl rounded-3xl border border-line bg-surface p-6 shadow-panel sm:p-8"
      >
        <button
          type="button"
          aria-label="Close welcome guide"
          className="absolute top-5 right-5 rounded-lg px-3 py-2 text-muted hover:bg-slate/10 hover:text-ink"
          onClick={onClose}
        >
          ✕
        </button>
        <span className="inline-flex rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest">
          WELCOME TO AETHER
        </span>
        <h2 id="onboarding-title" className="mt-4 pr-10 text-3xl font-bold tracking-[-0.04em] text-ink">
          Let’s get you started, {firstName}
        </h2>
        <p id="onboarding-description" className="mt-2 max-w-xl leading-7 text-muted">
          Go from lecture notes to a study-ready quiz in three simple steps.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="rounded-2xl border border-line bg-slate/5 p-4">
              <span className="text-xs font-extrabold tracking-[0.12em] text-forest">{step.number}</span>
              <h3 className="mt-3 font-bold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
          <button type="button" className="px-4 py-2.5 text-sm font-semibold text-muted" onClick={onClose}>
            Explore on my own
          </button>
          <button
            type="button"
            className="rounded-md bg-forest px-5 py-2.5 text-sm font-semibold text-white"
            onClick={() => {
              onClose();
              navigate("/spaces");
            }}
          >
            Create my first space →
          </button>
        </div>
      </div>
    </div>
  );
}
