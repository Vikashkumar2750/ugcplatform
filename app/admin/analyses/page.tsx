"use client";

import Link from "next/link";
import { BarChart3, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

const ANALYSES = [
  { id: "a1", user: "Rahul Kumar", platform: "YouTube", niche: "Finance", phases: 4, scripts: 7, status: "complete", er: "5.1%", date: "26 May 2026 · 9:14 PM" },
  { id: "a2", user: "Priya Sharma", platform: "Instagram", niche: "Fitness", phases: 3, scripts: 7, status: "complete", er: "3.2%", date: "26 May 2026 · 8:32 PM" },
  { id: "a3", user: "Aryan Mehta", platform: "Instagram", niche: "Tech", phases: 1, scripts: 0, status: "failed", er: "—", date: "25 May 2026 · 7:45 PM" },
  { id: "a4", user: "Neha Joshi", platform: "YouTube", niche: "Beauty", phases: 4, scripts: 14, status: "complete", er: "4.8%", date: "25 May 2026 · 6:20 PM" },
  { id: "a5", user: "Sneha Singh", platform: "Facebook", niche: "Food", phases: 2, scripts: 7, status: "complete", er: "2.9%", date: "24 May 2026 · 5:10 PM" },
];

const platformColors: Record<string, string> = {
  Instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  YouTube: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Facebook: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function AdminAnalysesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">All Analyses</h1>
        <p className="text-sm text-muted-foreground">{ANALYSES.length} total · {ANALYSES.filter(a => a.status === "complete").length} successful</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["User", "Platform", "Niche", "Phases", "Scripts", "ER", "Status", "Date", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ANALYSES.map(a => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                  <td className="px-4 py-3 font-medium">{a.user}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${platformColors[a.platform]}`}>{a.platform}</span>
                  </td>
                  <td className="px-4 py-3">{a.niche}</td>
                  <td className="px-4 py-3 text-center">{a.phases}</td>
                  <td className="px-4 py-3 text-center">{a.scripts}</td>
                  <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">{a.er}</td>
                  <td className="px-4 py-3">
                    {a.status === "complete"
                      ? <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</span>
                      : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3.5 h-3.5" /> Failed</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{a.date}</td>
                  <td className="px-4 py-3">
                    {a.status === "complete" && (
                      <Link href={`/results/${a.id}`} className="text-muted-foreground hover:text-foreground transition">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
