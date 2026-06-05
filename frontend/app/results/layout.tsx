"use client";

import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar currentPath={pathname} />
      <main className="flex-1 overflow-auto flex flex-col">{children}</main>
    </div>
  );
}
