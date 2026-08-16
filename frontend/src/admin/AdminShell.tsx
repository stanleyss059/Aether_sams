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
    <div className="space-y-7">
      <div className="rounded-2xl border border-line bg-white p-6">
        <span className="inline-flex rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest">ADMIN</span>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Activity console</h1>
        <p className="mt-1 text-muted">Monitor accounts, content, and every meaningful action across StudyForge.</p>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1.5">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-semibold no-underline transition ${
                isActive ? "bg-forest text-white shadow-sm" : "text-muted hover:bg-slate/10 hover:text-ink"
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
