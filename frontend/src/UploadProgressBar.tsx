import { useEffect, useState } from "react";

export type UploadProgress = {
  completed: number;
  total: number;
  filename: string;
};

export function UploadProgressBar({ completed, total, filename }: UploadProgress) {
  const safeTotal = Math.max(total, 1);
  const done = completed >= safeTotal;
  const current = Math.min(Math.max(completed + 1, 1), safeTotal);
  const target = done ? 100 : Math.round((current / safeTotal) * 100);
  const [width, setWidth] = useState(8);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(Math.max(target, 8)));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div
      className="upload-progress overflow-hidden rounded-xl bg-forest/10 ring-1 ring-forest/10"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-busy={!done}
      aria-label={done ? `Uploaded ${safeTotal} files` : `Uploading ${current} of ${safeTotal}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <p
          key={`${done ? "done" : filename}:${completed}`}
          className="upload-progress-label min-w-0 truncate text-sm font-semibold text-forest"
        >
          {done ? "Uploaded" : filename ? `Uploading ${filename}` : "Uploading"}
        </p>
        <p className="shrink-0 text-sm font-semibold text-forest">
          <span key={current} className="upload-progress-label inline-block tabular-nums">
            {done ? safeTotal : current} / {safeTotal}
          </span>
          <span className="ml-2 text-xs font-bold text-forest/65">{Math.round(width)}%</span>
        </p>
      </div>
      <div className="px-4 pb-3">
        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/70">
          <div
            className="upload-progress-fill absolute inset-y-0 left-0 h-full min-w-2.5 rounded-full"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </div>
  );
}
