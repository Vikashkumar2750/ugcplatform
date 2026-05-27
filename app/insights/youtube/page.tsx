"use client";

import Link from "next/link";
import { PlayCircle } from "lucide-react";

export default function YouTubeInsightsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto mt-12 text-center space-y-4">
      <PlayCircle className="w-14 h-14 mx-auto text-muted-foreground/30" />
      <h2 className="font-heading text-xl font-bold">Connect YouTube to see channel analytics</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        Connect your YouTube channel to see views, watch time, subscriber growth, top videos, and traffic sources.
      </p>
      <Link href="/connect" className="btn-amber px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2">
        <PlayCircle className="w-4 h-4" /> Connect YouTube
      </Link>
    </div>
  );
}
