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
    <header className="sticky top-0 z-20 border-b border-forest-800 bg-forest text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="shrink-0 font-serif text-xl text-white no-underline">
          StudyForge
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold no-underline ${
                link.match(pathname) ? "bg-white/15 text-gold" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/profile" className="hidden text-sm text-white/80 no-underline hover:text-white sm:inline">
            {user?.name}
          </Link>
          <button
            className="rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-forest"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            Sign out
          </button>
          <button
            type="button"
            className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-semibold md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            Menu
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-white/10 px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-5xl flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={`rounded-md px-3 py-2 text-sm font-semibold no-underline ${
                  link.match(pathname) ? "bg-white/15 text-gold" : "text-white/80"
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
