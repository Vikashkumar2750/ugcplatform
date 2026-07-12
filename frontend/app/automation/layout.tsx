"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import {
  MessageSquare, MessageCircle, Calendar, Activity,
  Shield, Inbox, Radio, CalendarPlus
} from "lucide-react";

const AUTOMATION_NAV = [
  { href: "/automation", label: "Overview", icon: Activity, exact: true },
  { href: "/automation/dm", label: "DM Automation", icon: MessageSquare },
  { href: "/automation/comments", label: "Comments", icon: MessageCircle },
  { href: "/automation/schedule", label: "Scheduler", icon: Calendar },
  { href: "/automation/flows", label: "Flows", icon: Radio },
  { href: "/automation/inbox", label: "AI Inbox", icon: Inbox },
  { href: "/automation/compliance", label: "Compliance", icon: Shield },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram", color: "text-pink-400 border-pink-400", bg: "bg-pink-500/10" },
  { id: "facebook", label: "Facebook", color: "text-blue-400 border-blue-400", bg: "bg-blue-500/10" },
  { id: "youtube", label: "YouTube", color: "text-red-400 border-red-400", bg: "bg-red-500/10" },
  { id: "linkedin", label: "LinkedIn", color: "text-sky-400 border-sky-400", bg: "bg-sky-500/10" },
];

export default function AutomationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentPlatform = searchParams.get("platform") || "instagram";

  const setPlatform = (platform: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("platform", platform);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar currentPath={pathname} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Platform Selector */}
        <div className="border-b border-border bg-card/80 px-6 py-2.5 flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Platform:</span>
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                currentPlatform === p.id
                  ? `${p.color} ${p.bg} border-current`
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Automation sub-nav */}
        <div className="border-b border-border bg-card px-6 flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {AUTOMATION_NAV.map(item => {
            const targetHref = `${item.href}?platform=${currentPlatform}`;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={targetHref}
                prefetch={true}
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
