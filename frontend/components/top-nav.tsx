"use client";

import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";

interface TopNavProps {
  backHref?: string;
  backLabel?: string;
  title?: string;
}

export function TopNav({ backHref, backLabel = "Back", title }: TopNavProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            {backHref ? (
              <Link
                href={backHref}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
              </Link>
            ) : (
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-black" />
                </div>
                <span className="font-bold text-lg tracking-tight">
                  Content<span className="text-amber-500">Engineer</span>
                </span>
              </Link>
            )}
          </div>
          {title && (
            <p className="hidden sm:block text-sm font-semibold text-foreground">{title}</p>
          )}
          <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
