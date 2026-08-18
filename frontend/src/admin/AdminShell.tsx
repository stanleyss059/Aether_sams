import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/admin", label: "Dashboard", icon: "📊", end: true },
  { to: "/admin/users", label: "Users", icon: "👥" },
  { to: "/admin/uploads", label: "Uploads", icon: "📁" },
  { to: "/admin/spaces", label: "Spaces", icon: "🏠" },
  { to: "/admin/profile", label: "Profile", icon: "⚙️" },
  { to: "/admin/audit-logs", label: "Audit logs", icon: "📋" },
];

export function AdminShell() {
  return (
    <div className="space-y-7">
      <div className="rounded-2xl border border-line bg-white p-6">
        <span className="inline-flex rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest">ADMIN</span>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Activity console</h1>
        <p className="mt-1 text-muted">Monitor accounts, content, and every meaningful action across Aether.</p>
      </div>

      <nav className="rounded-2xl border border-line bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-2 rounded-xl px-4 py-4 text-sm font-semibold no-underline transition-all ${
                  isActive
                    ? "bg-forest text-white shadow-md"
                    : "text-muted hover:bg-slate/50 hover:text-ink"
                }`
              }
            >
              <span className="text-2xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
