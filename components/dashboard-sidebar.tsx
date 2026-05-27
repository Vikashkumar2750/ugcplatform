"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Search, History, BookOpen,
  Settings, LogOut, Zap, ChevronLeft, ChevronRight,
  Moon, Sun, Link2, BarChart2, Bot, LifeBuoy,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Analytics",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: Search, label: "Analyze", href: "/analyze" },
      { icon: BarChart2, label: "Insights", href: "/insights" },
      { icon: History, label: "History", href: "/history" },
      { icon: BookOpen, label: "Hook Library", href: "/hooks" },
    ],
  },
  {
    label: "Automation",
    items: [
      { icon: Bot, label: "Automation", href: "/automation" },
      { icon: Link2, label: "Connect", href: "/connect" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: LifeBuoy, label: "Support", href: "/support" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ],
  },
];

export function DashboardSidebar({ currentPath }: { currentPath: string }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const toggleDark = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  };

  return (
    <aside
      className={`relative flex flex-col bg-card border-r border-border transition-all duration-300 ${
        collapsed ? "w-16" : "w-56"
      } min-h-screen flex-shrink-0`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-5 border-b border-border ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="w-8 h-8 rounded-lg btn-amber flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-black" />
        </div>
        {!collapsed && (
          <span className="font-heading font-bold text-lg">
            Content<span className="text-gradient">IQ</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = currentPath === item.href || (item.href !== "/dashboard" && currentPath.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      active
                        ? "bg-amber-400/10 text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    } ${collapsed ? "justify-center px-2" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-amber-600 dark:text-amber-400" : ""} group-hover:scale-110 transition-transform`} />
                    {!collapsed && <span>{item.label}</span>}
                    {active && !collapsed && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className={`px-2 py-4 border-t border-border space-y-1 ${collapsed ? "items-center flex flex-col" : ""}`}>
        <button
          onClick={toggleDark}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all w-full ${collapsed ? "justify-center px-2" : ""}`}
          title="Toggle dark mode"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all w-full ${collapsed ? "justify-center px-2" : ""}`}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>{loggingOut ? "Signing out..." : "Sign Out"}</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
