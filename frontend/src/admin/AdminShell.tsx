import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/uploads", label: "Uploads" },
  { to: "/admin/spaces", label: "Spaces" },
  { to: "/admin/profile", label: "Profile" },
  { to: "/admin/audit-logs", label: "Audit logs" },
];

export function AdminShell() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Admin</p>
        <h1 className="font-serif text-3xl">Activity console</h1>
        <p className="text-muted">Monitor accounts, content, and every meaningful action across StudyForge.</p>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-semibold no-underline ${
                isActive ? "bg-forest text-white" : "bg-white text-ink border border-line hover:border-forest/40"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
