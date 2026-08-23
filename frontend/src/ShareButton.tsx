import { useEffect, useRef, useState, type MouseEvent } from "react";

export function ShareButton({
  path,
  label = "Share",
  className = "rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink",
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copyLink(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this quiz link", url);
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className={className} onClick={copyLink}>
      {copied ? "Link copied" : label}
    </button>
  );
}
