import { useLocation, Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Mail,
  Users,
  FileText,
  ClipboardList,
  Ban,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/campaigns", label: "Campaigns", icon: Mail },
  { path: "/contacts", label: "Contacts", icon: Users },
  { path: "/templates", label: "Templates", icon: FileText },
  { path: "/logs", label: "Logs", icon: ClipboardList },
  { path: "/suppressions", label: "Suppressions", icon: Ban },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-[#f0f2f5]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[240px] bg-[#1a3a5c] z-50 flex flex-col">
        {/* Brand */}
        <div className="px-6 pt-6 pb-4">
          <h1 className="text-white text-lg font-normal tracking-wide">
            Lexi Translation Lab
          </h1>
          <p className="text-[#8bafd4] text-[11px] uppercase tracking-[1.5px] mt-0.5">
            Email Campaigns
          </p>
          <div className="h-[3px] w-[60px] bg-[#c9a84c] mt-3" />
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 pt-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 h-11 px-4 rounded-sm text-sm transition-colors duration-150 ${
                  isActive
                    ? "bg-white/[0.06] text-white border-l-[3px] border-[#c9a84c]"
                    : "text-[#8bafd4] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="px-6 py-4 border-t border-white/[0.08]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-[#8bafd4] text-xs">SMTP: Ready</span>
          </div>
          {user && (
            <button
              onClick={logout}
              className="flex items-center gap-2 text-[#8bafd4] hover:text-white text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-[240px]">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 h-16 bg-white border-b border-[#e0e0e0] flex items-center justify-between px-8">
          <h1 className="text-[28px] font-semibold text-[#1a3a5c]">
            {navItems.find((n) => n.path === location.pathname)?.label || "Dashboard"}
          </h1>
          <div className="flex items-center gap-3">
            {user && (
              <div className="w-9 h-9 rounded-full bg-[#1a3a5c] flex items-center justify-center text-white text-sm font-medium">
                {user.name?.charAt(0) || "U"}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
