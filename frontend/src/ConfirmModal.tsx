import { ModalLayer } from "./ModalLayer";
import { Spinner } from "./Spinner";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <ModalLayer
      open={open}
      labelledBy="confirm-modal-title"
      describedBy="confirm-modal-desc"
      busy={busy}
      onCancel={onCancel}
    >
      <div className="p-6">
        <span className="inline-flex rounded-full bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger">CONFIRM</span>
        <h2 id="confirm-modal-title" className="mt-4 text-2xl font-bold tracking-[-0.03em] text-ink">
          {title}
        </h2>
        <p id="confirm-modal-desc" className="mt-2 text-sm leading-relaxed text-muted">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-danger px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <Spinner size="sm" /> : confirmLabel}
          </button>
        </div>
      </div>
    </ModalLayer>
  );
}
