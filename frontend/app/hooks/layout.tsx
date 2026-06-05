"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function HooksLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar currentPath={pathname} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
