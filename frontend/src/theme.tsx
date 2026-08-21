import { createContext, useContext, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { IconMoon, IconSun } from "./nav-icons";

export type Theme = "light" | "dark";

const STORAGE_KEY = "aether.theme";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: (origin?: { x: number; y: number }) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme still applies for this session if storage is blocked.
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: (origin?: { x: number; y: number }) => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        const root = document.documentElement;
        const run = () => {
          applyTheme(next);
          flushSync(() => setTheme(next));
        };

        if (origin) {
          root.style.setProperty("--theme-x", `${origin.x}px`);
          root.style.setProperty("--theme-y", `${origin.y}px`);
        }

        const doc = document as Document & {
          startViewTransition?: (update: () => void) => { finished: Promise<void> };
        };

        if (!prefersReducedMotion() && typeof doc.startViewTransition === "function") {
          root.classList.add("theme-switching");
          const transition = doc.startViewTransition(run);
          void transition.finished.finally(() => root.classList.remove("theme-switching"));
          return;
        }

        run();
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    toggleTheme({ x: event.clientX, y: event.clientY });
  }

  return (
    <button
      type="button"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink ${className}`}
      onClick={onClick}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <span className="theme-glyph" aria-hidden>
        <IconSun className={`theme-glyph-icon h-4 w-4 ${dark ? "is-on" : "is-off"}`} />
        <IconMoon className={`theme-glyph-icon h-4 w-4 ${dark ? "is-off" : "is-on"}`} />
      </span>
    </button>
  );
}
