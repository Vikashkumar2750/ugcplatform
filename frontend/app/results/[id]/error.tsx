"use client";

import { useEffect } from "react";

export default function ResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[results/[id] error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold">Results Load Nahi Hui</h1>
        <p className="text-sm text-muted-foreground">
          Ek JavaScript error aaya jo page load hone se roki.
          Browser console mein details hongi.
        </p>
        {error?.message && (
          <pre className="text-xs bg-muted p-3 rounded-xl text-left overflow-auto max-h-40 text-red-500">
            {error.message}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-amber-400 text-black font-bold text-sm hover:bg-amber-300 transition"
          >
            Try Again
          </button>
          <a
            href="/analyze"
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition"
          >
            Naya Analysis
          </a>
          <a
            href="/history"
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition"
          >
            History Dekho
          </a>
        </div>
      </div>
    </div>
  );
}
