import { useState } from "react";
import { ApiError, downloadDocument } from "./api";

const STYLES: Record<string, string> = {
  pdf: "bg-danger/10 text-danger",
  docx: "bg-forest/10 text-forest",
  doc: "bg-forest/10 text-forest",
  txt: "bg-slate/10 text-slate",
  md: "bg-gold/10 text-slate",
};

function extensionOf(filename: string) {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return match ? match[1].toLowerCase() : "file";
}

export function FileBadge({ filename, className = "" }: { filename: string; className?: string }) {
  const extension = extensionOf(filename);
  const look = STYLES[extension] ?? "bg-slate/10 text-slate";
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold uppercase ${look} ${className}`}
      aria-hidden="true"
    >
      {extension.slice(0, 4)}
    </span>
  );
}

export function SaveDocumentButton({
  documentId,
  filename,
  admin = false,
  className = "rounded-lg border border-forest/40 px-4 py-2 text-sm font-semibold text-forest hover:bg-forest/5 disabled:opacity-60",
}: {
  documentId: string;
  filename: string;
  admin?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onDownload() {
    if (busy) return;
    setBusy(true);
    try {
      await downloadDocument(documentId, filename, { admin });
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} disabled={busy} onClick={onDownload}>
      {busy ? "Saving…" : "Save"}
    </button>
  );
}
