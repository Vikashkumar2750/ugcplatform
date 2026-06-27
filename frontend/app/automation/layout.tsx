"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import {
  MessageSquare, MessageCircle, Calendar, Activity,
  Shield, BarChart3, Inbox, Radio
} from "lucide-react";

const AUTOMATION_NAV = [
  { href: "/automation", label: "Overview", icon: Activity, exact: true },
  { href: "/automation/dm", label: "DM Automation", icon: MessageSquare },
  { href: "/automation/comments", label: "Comments", icon: MessageCircle },
  { href: "/automation/schedule", label: "Scheduler", icon: Calendar },
  { href: "/automation/flows", label: "Flows", icon: Radio },
  { href: "/automation/inbox", label: "AI Inbox", icon: Inbox },
  { href: "/automation/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/automation/compliance", label: "Compliance", icon: Shield },
];

export default function AutomationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar currentPath={pathname} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Automation sub-nav */}
        <div className="border-b border-border bg-card px-6 flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {AUTOMATION_NAV.map(item => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3.5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? "border-amber-400 text-amber-600 dark:text-amber-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
