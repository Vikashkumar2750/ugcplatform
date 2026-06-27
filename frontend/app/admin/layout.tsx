import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin-dashboard";

function isAdminCookieValid(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  try {
    const dotIdx = cookieValue.lastIndexOf(".");
    if (dotIdx === -1) return false;
    const payloadB64 = cookieValue.substring(0, dotIdx);
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const emailMatch = payload.email?.toLowerCase().trim() === adminEmail;
    const roleMatch = payload.role === "admin";
    const isExpired = Date.now() - payload.ts > 7 * 24 * 60 * 60 * 1000;
    return emailMatch && roleMatch && !isExpired;
  } catch {
    return false;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get("admin_session")?.value;

  if (!isAdminCookieValid(adminSession)) {
    redirect("/login?reason=admin_required");
  }

  return <AdminDashboard>{children}</AdminDashboard>;
}
