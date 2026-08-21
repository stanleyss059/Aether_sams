import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  IconAdmin,
  IconArrowLeft,
  IconAudit,
  IconDashboard,
  IconProfile,
  IconSpaces,
  IconUploads,
  IconUsers,
} from "../nav-icons";

const TABS: Array<{
  to: string;
  label: string;
  icon: typeof IconDashboard;
  end?: boolean;
}> = [
  { to: "/admin", label: "Overview", icon: IconDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: IconUsers },
  { to: "/admin/uploads", label: "Uploads", icon: IconUploads },
  { to: "/admin/spaces", label: "Spaces", icon: IconSpaces },
  { to: "/admin/audit-logs", label: "Audit", icon: IconAudit },
  { to: "/admin/profile", label: "Settings", icon: IconProfile },
];

export function AdminShell() {
  const { pathname } = useLocation();
  const activeTab = TABS.find((tab) =>
    tab.end ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-forest">
              <IconAdmin className="h-3.5 w-3.5" />
              Admin
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">
            {activeTab?.label ?? "Console"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Monitor accounts, uploads, spaces, and audit activity across Aether.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted no-underline hover:text-ink"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to app
        </Link>
      </div>

      <nav className="overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 shadow-sm">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                viewTransition
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold no-underline whitespace-nowrap transition ${
                    isActive
                      ? "nav-active bg-forest text-white shadow-sm shadow-forest/20"
                      : "text-muted hover:bg-parchment hover:text-ink"
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div key={pathname} className="page-enter">
        <Outlet />
      </div>
    </div>
  );
}
