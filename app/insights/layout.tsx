"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Camera, Share2, PlayCircle } from "lucide-react";

const PLATFORM_TABS = [
  { href: "/insights", label: "Instagram", icon: Camera, exact: true },
  { href: "/insights/facebook", label: "Facebook", icon: Share2 },
  { href: "/insights/youtube", label: "YouTube", icon: PlayCircle },
];

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar currentPath={pathname} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card px-6 flex items-center gap-1">
          {PLATFORM_TABS.map(tab => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link key={tab.href} href={tab.href}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  active ? "border-amber-400 text-amber-600 dark:text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <tab.icon className="w-4 h-4" />{tab.label}
              </Link>
            );
          })}
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
