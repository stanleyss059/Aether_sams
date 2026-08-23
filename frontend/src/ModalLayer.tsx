import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalLayerProps = {
  open: boolean;
  labelledBy: string;
  describedBy?: string;
  busy?: boolean;
  onCancel: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
};

export function ModalLayer({
  open,
  labelledBy,
  describedBy,
  busy = false,
  onCancel,
  children,
  maxWidthClassName = "max-w-md",
}: ModalLayerProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="overlay-in absolute inset-0 bg-ink/55 backdrop-blur-md"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`card morph-in relative max-h-[min(90dvh,44rem)] w-full overflow-y-auto overscroll-contain rounded-3xl border border-line bg-surface shadow-panel ${maxWidthClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
