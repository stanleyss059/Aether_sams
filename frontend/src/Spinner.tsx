type SpinnerSize = "sm" | "md" | "lg";

const SIZES: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
};

export function Spinner({
  size = "md",
  className = "",
  label = "Loading",
}: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 animate-spin rounded-full border-current border-t-transparent ${SIZES[size]} ${className}`}
      role="status"
      aria-label={label}
    />
  );
}

export function LoadingState({ className = "flex min-h-48 items-center justify-center p-8" }: { className?: string }) {
  return (
    <div className={className}>
      <Spinner size="lg" className="text-forest" />
    </div>
  );
}
