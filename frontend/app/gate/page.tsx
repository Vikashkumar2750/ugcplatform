"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function GatePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [gateData, setGateData] = useState<{
    username: string;
    link: string;
    message: string;
    buttonLabel: string;
  } | null>(null);
  const [step, setStep] = useState<"loading" | "follow" | "confirmed">("loading");
  const [error, setError] = useState("");
  const [followClicked, setFollowClicked] = useState(false);

  useEffect(() => {
    if (!token) { setError("Invalid link"); setStep("follow"); return; }
    fetch(`/api/gate?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setStep("follow"); return; }
        setGateData(data);
        setStep("follow");
      })
      .catch(() => { setError("Failed to load"); setStep("follow"); });
  }, [token]);

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-white/50 text-lg">Loading...</div>
      </div>
    );
  }

  if (error || !gateData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">😕 {error || "Something went wrong"}</p>
          <p className="text-white/40 text-sm">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  if (step === "confirmed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-emerald-950/30 to-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-gray-900/80 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-8 text-center shadow-2xl shadow-emerald-500/5">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">You're in! 🎉</h1>
            <p className="text-white/60 text-sm mb-6">Thanks for following @{gateData.username}</p>
            
            {gateData.message && (
              <p className="text-white/80 text-sm mb-6 whitespace-pre-wrap">{gateData.message}</p>
            )}

            <a
              href={gateData.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-semibold rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/25"
            >
              {gateData.buttonLabel || "Get Access →"}
            </a>

            <p className="text-white/30 text-xs mt-4">Powered by ContentEngineer</p>
          </div>
        </div>
      </div>
    );
  }

  // Step: follow
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-violet-950/20 to-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-gray-900/80 backdrop-blur-xl border border-violet-500/20 rounded-3xl p-8 text-center shadow-2xl shadow-violet-500/5">
          {/* Instagram icon */}
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-pink-500/20">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Almost there! 🎁</h1>
          <p className="text-white/60 text-sm mb-8">Follow to unlock exclusive access</p>

          {/* Step 1: Follow */}
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-3 text-left">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${followClicked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-400'}`}>
                {followClicked ? '✓' : '1'}
              </div>
              <p className="text-white/80 text-sm">Follow <span className="text-violet-400 font-semibold">@{gateData.username}</span> on Instagram</p>
            </div>
            <a
              href={`https://instagram.com/${gateData.username}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setFollowClicked(true)}
              className={`block w-full py-3.5 px-6 rounded-2xl font-semibold transition-all transform hover:scale-[1.02] active:scale-95 ${
                followClicked
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-400 hover:via-pink-400 hover:to-orange-400 text-white shadow-lg shadow-pink-500/25'
              }`}
            >
              {followClicked ? '✅ Profile Opened' : 'Follow on Instagram →'}
            </a>
          </div>

          {/* Step 2: Confirm */}
          <div className={`transition-all duration-500 ${followClicked ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-2 pointer-events-none'}`}>
            <div className="flex items-center gap-3 mb-3 text-left">
              <div className="w-8 h-8 bg-violet-500/20 text-violet-400 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <p className="text-white/80 text-sm">Confirm you&apos;re following</p>
            </div>
            <button
              onClick={() => setStep("confirmed")}
              disabled={!followClicked}
              className="block w-full py-3.5 px-6 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white font-semibold rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25"
            >
              I&apos;m Following ✅
            </button>
          </div>

          <p className="text-white/20 text-xs mt-6">Powered by ContentEngineer</p>
        </div>
      </div>
    </div>
  );
}
