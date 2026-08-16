import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const links = useMemo(() => {
    const items = [
      { to: "/", label: "Dashboard", match: (path: string) => path === "/" },
      { to: "/spaces", label: "Spaces", match: (path: string) => path.startsWith("/spaces") },
      {
        to: "/uploads",
        label: "My uploads",
        match: (path: string) => path.startsWith("/uploads") || path.startsWith("/documents"),
      },
      { to: "/profile", label: "Profile", match: (path: string) => path === "/profile" },
    ];
    if (user?.role === "ADMIN") {
      items.push({
        to: "/admin",
        label: "Admin",
        match: (path: string) => path.startsWith("/admin"),
      });
    }
    return items;
  }, [user?.role]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-white/90 text-ink shadow-[0_1px_12px_rgb(15_23_42/0.04)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 font-bold text-ink no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-extrabold text-white shadow-sm">
            A
          </span>
          <span className="text-lg tracking-[-0.03em]">Aether</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={`rounded-lg px-3 py-2 text-sm font-semibold no-underline transition ${
                link.match(pathname) ? "bg-forest/10 text-forest" : "text-muted hover:bg-slate/10 hover:text-ink"
              }`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/profile" className="hidden text-sm font-medium text-muted no-underline hover:text-ink sm:inline">
            {user?.name}
          </Link>
          <button
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            Sign out
          </button>
          <button
            type="button"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            Menu
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-line bg-white px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold no-underline ${
                  link.match(pathname) ? "bg-forest/10 text-forest" : "text-muted hover:bg-slate/10 hover:text-ink"
                }`}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
