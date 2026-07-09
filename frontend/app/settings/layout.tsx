"use client";

import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar currentPath={pathname} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
