import { useMemo } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { IconAdmin, IconDashboard, IconProfile, IconSpaces, IconUploads } from "./nav-icons";
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

function NavItemLink({
  item,
  pathname,
  stacked = false,
}: {
  item: NavItem;
  pathname: string;
  stacked?: boolean;
}) {
  const active = item.match(pathname);
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      viewTransition
      className={
        stacked
          ? `flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[10px] font-bold tracking-wide no-underline ${
              active ? "bg-forest text-white shadow-sm shadow-forest/25" : "text-muted hover:bg-parchment hover:text-ink"
            }`
          : `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold no-underline transition ${
              active
                ? "nav-active bg-forest text-white shadow-sm shadow-forest/25"
                : "text-muted hover:bg-surface/80 hover:text-ink"
            }`
      }
    >
      <Icon className={stacked ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function NavBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const links = useMemo(() => {
    const items: NavItem[] = [
      { to: "/", label: "Home", icon: IconDashboard, end: true, match: (p) => p === "/" },
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

  const inAdmin = pathname.startsWith("/admin");

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[4.75rem] flex-col border-r border-line/70 bg-surface/95 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        <Link to="/" className="mx-auto mb-3 flex h-11 w-11 items-center justify-center no-underline" aria-label="Aether home">
          <BrandLogo className="h-9 w-9" />
        </Link>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5">
          {links.map((item) => (
            <NavItemLink key={item.to} item={item} pathname={pathname} stacked />
          ))}
        </nav>
        <div className="mt-2 flex flex-col items-center gap-2 px-1.5">
          <ThemeToggle />
          <Link
            to="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-xs font-bold text-forest no-underline"
            aria-label={user?.name ?? "Profile"}
          >
            {initials(user?.name ?? "?")}
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 hidden border-b border-line/70 bg-surface/85 backdrop-blur-xl md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 no-underline">
            <BrandLogo className="h-9 w-9" />
            <span className="text-lg font-bold tracking-[-0.03em] text-ink">Aether</span>
          </Link>

          <nav className="flex flex-1 items-center justify-center">
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
                className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted no-underline hover:text-ink"
              >
                Exit admin
              </Link>
            ) : null}
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 no-underline"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest/10 text-xs font-bold text-forest">
                {initials(user?.name ?? "?")}
              </span>
              <span className="max-w-[9rem] truncate text-sm font-semibold text-ink">{user?.name}</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
    </>
  );
}
