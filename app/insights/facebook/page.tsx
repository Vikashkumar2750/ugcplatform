"use client";

import Link from "next/link";
import { Share2 } from "lucide-react";

export default function FacebookInsightsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto mt-12 text-center space-y-4">
      <Share2 className="w-14 h-14 mx-auto text-muted-foreground/30" />
      <h2 className="font-heading text-xl font-bold">Connect Facebook to see Page insights</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        Connect your Facebook Business Page to see reach, engagement, post performance, and audience data.
      </p>
      <Link href="/connect" className="btn-amber px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2">
        <Share2 className="w-4 h-4" /> Connect Facebook Page
      </Link>
    </div>
  );
}
