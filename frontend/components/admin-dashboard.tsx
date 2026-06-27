"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard,
  Receipt, LifeBuoy, BookOpen, LogOut,
  ChevronLeft, ChevronRight, ShieldCheck,
  TrendingUp, Settings,
} from "lucide-react";

const ADMIN_NAV = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
      { icon: TrendingUp, label: "Analytics", href: "/admin/analytics" },
    ],
  },
  {
    label: "Management",
    items: [
      { icon: Users, label: "Users", href: "/admin/users" },
      { icon: CreditCard, label: "Subscriptions", href: "/admin/subscriptions" },
      { icon: Receipt, label: "Transactions", href: "/admin/transactions" },
    ],
  },
  {
    label: "Support",
    items: [
      { icon: LifeBuoy, label: "Tickets", href: "/admin/tickets" },
    ],
  },
  {
    label: "Config",
    items: [
      { icon: BookOpen, label: "Setup Guide", href: "/admin/setup" },
      { icon: Settings, label: "Platform Settings", href: "/admin/settings" },
    ],
  },
];

function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    // Hard redirect clears all client state
    window.location.href = "/login";
  };

  return (
    <aside
      className={`relative flex flex-col bg-zinc-950 border-r border-zinc-800 transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      } min-h-screen flex-shrink-0`}
    >
      {/* Logo */}
      <div
        className={`flex items-center gap-2 px-4 py-5 border-b border-zinc-800 ${
          collapsed ? "justify-center px-0" : ""
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="font-heading font-bold text-sm text-white">Content Engineer</span>
            <span className="block text-[10px] text-red-400 font-bold uppercase tracking-wider">
              Super Admin
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4">
        {ADMIN_NAV.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      active
                        ? "bg-red-500/15 text-red-400 border border-red-500/20"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
                    } ${collapsed ? "justify-center px-2" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        active ? "text-red-400" : ""
                      } group-hover:scale-110 transition-transform`}
                    />
                    {!collapsed && <span>{item.label}</span>}
                    {active && !collapsed && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div
        className={`px-2 py-4 border-t border-zinc-800 space-y-1 ${
          collapsed ? "items-center flex flex-col" : ""
        }`}
      >
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-[10px] text-zinc-500 font-medium">Logged in as</p>
            <p className="text-xs text-zinc-300 font-semibold truncate">
              Admin
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-950/20 transition-all w-full ${
            collapsed ? "justify-center px-2" : ""
          }`}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 shadow-sm flex items-center justify-center hover:bg-zinc-800 transition-colors z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-zinc-400" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-zinc-400" />
        )}
      </button>
    </aside>
  );
}

export default function AdminDashboard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950">
      <AdminSidebar />
      <main className="flex-1 overflow-auto bg-zinc-900 text-zinc-100">
        {/* Top bar */}
        <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-3 flex items-center sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-bold text-zinc-100">Super Admin Panel</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold border border-red-500/20">
              Super Admin
            </span>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
