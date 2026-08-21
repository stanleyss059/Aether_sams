import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { IconAdmin, IconClose, IconDashboard, IconMenu, IconProfile, IconSpaces, IconUploads } from "./nav-icons";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./theme";

type NavItem = {
  to: string;
  label: string;
  icon: typeof IconDashboard;
  end?: boolean;
  match: (path: string) => boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function NavItemLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = item.match(pathname);
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      viewTransition
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold no-underline transition ${
        active
          ? "nav-active bg-forest text-white shadow-sm shadow-forest/25"
          : "text-muted hover:bg-surface/80 hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function NavBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const links = useMemo(() => {
    const items: NavItem[] = [
      { to: "/", label: "Dashboard", icon: IconDashboard, end: true, match: (p) => p === "/" },
      { to: "/spaces", label: "Spaces", icon: IconSpaces, match: (p) => p.startsWith("/spaces") },
      {
        to: "/uploads",
        label: "Uploads",
        icon: IconUploads,
        match: (p) => p.startsWith("/uploads") || p.startsWith("/documents"),
      },
      { to: "/profile", label: "Profile", icon: IconProfile, match: (p) => p === "/profile" },
    ];
    if (user?.role === "ADMIN") {
      items.push({
        to: "/admin",
        label: "Admin",
        icon: IconAdmin,
        match: (p) => p.startsWith("/admin"),
      });
    }
    return items;
  }, [user?.role]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const inAdmin = pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 no-underline">
          <BrandLogo className="h-9 w-9" />
          <span className="hidden text-lg font-bold tracking-[-0.03em] text-ink sm:inline">Aether</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-1 rounded-2xl border border-line/80 bg-parchment/80 p-1">
            {links.map((item) => (
              <NavItemLink key={item.to} item={item} pathname={pathname} />
            ))}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {inAdmin ? (
            <Link
              to="/"
              className="hidden rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted no-underline hover:text-ink sm:inline"
            >
              Exit admin
            </Link>
          ) : null}
          <Link
            to="/profile"
            className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 no-underline sm:flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest/10 text-xs font-bold text-forest">
              {initials(user?.name ?? "?")}
            </span>
            <span className="max-w-[9rem] truncate text-sm font-semibold text-ink">{user?.name}</span>
          </Link>
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-line bg-surface p-2.5 text-ink md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-line/70 bg-surface px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {links.map((item) => (
              <NavItemLink key={item.to} item={item} pathname={pathname} onNavigate={() => setOpen(false)} />
            ))}
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink no-underline"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest/10 text-xs font-bold text-forest">
                {initials(user?.name ?? "?")}
              </span>
              {user?.name}
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
