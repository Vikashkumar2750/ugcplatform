"use client";

import { useState } from "react";
import { Copy, CheckCircle2, Zap, Filter, Search, BookOpen } from "lucide-react";

const NICHES = ["All", "Fitness", "Finance", "Travel", "Tech", "Food", "Beauty", "Education", "Lifestyle", "Comedy"];
const EMOTIONS = ["All", "Curiosity", "Fear", "Relatability", "Aspiration", "Shock", "FOMO", "Authority", "Humor"];

const HOOKS = [
  {
    id: 1,
    text: "Yaar, 3 mahine pehle main bhi exactly yahi kar raha tha — zero results. Phir yeh ek cheez try ki...",
    emotion: "Relatability",
    niche: "Fitness",
    format: "Reel",
    engagementScore: 92,
  },
  {
    id: 2,
    text: "90% Indian creators yeh galti karte hain aur phir wonder karte hain ki growth kyun nahi ho rahi...",
    emotion: "Fear",
    niche: "All",
    format: "Reel",
    engagementScore: 89,
  },
  {
    id: 3,
    text: "Maine ₹0 invest karke ₹50,000 kamaye — yeh koi click-bait nahi, main poora proof dikhaunga 👇",
    emotion: "Curiosity",
    niche: "Finance",
    format: "Reel",
    engagementScore: 95,
  },
  {
    id: 4,
    text: "Agar tumhara Instagram account ek mahine mein 1000 followers nahi laya to yeh video zaroor dekho...",
    emotion: "FOMO",
    niche: "All",
    format: "Reel",
    engagementScore: 87,
  },
  {
    id: 5,
    text: "Yeh phone 2024 ka sabse underrated phone hai — aur koi nahi baat kar raha iska...",
    emotion: "Curiosity",
    niche: "Tech",
    format: "Reel",
    engagementScore: 91,
  },
  {
    id: 6,
    text: "Wait mat karo — yeh offer kal se khatam ho raha hai. Main khud yahi sochta tha ki baad mein karunga...",
    emotion: "FOMO",
    niche: "All",
    format: "Story",
    engagementScore: 83,
  },
  {
    id: 7,
    text: "Doctor ne bola tha yeh khana mat khao — main roz khata tha. Phir yeh hua...",
    emotion: "Shock",
    niche: "Fitness",
    format: "Reel",
    engagementScore: 88,
  },
  {
    id: 8,
    text: "Mujhe 10 saal lage yeh seekhne mein — tumhe sirf 60 seconds chahiye...",
    emotion: "Authority",
    niche: "All",
    format: "Reel",
    engagementScore: 90,
  },
  {
    id: 9,
    text: "Bhai yeh dekh — teri problem ka solution main ek line mein bata sakta hoon...",
    emotion: "Humor",
    niche: "Comedy",
    format: "Reel",
    engagementScore: 85,
  },
  {
    id: 10,
    text: "Jab meri salary ₹18,000 thi tab main bhi yahi sochta tha ki invest karna mere liye nahi hai...",
    emotion: "Relatability",
    niche: "Finance",
    format: "Reel",
    engagementScore: 93,
  },
  {
    id: 11,
    text: "Yeh ek travel hack hai jo airlines nahi chahte tum jaano...",
    emotion: "Curiosity",
    niche: "Travel",
    format: "Reel",
    engagementScore: 86,
  },
  {
    id: 12,
    text: "Main 5 kg badhana chahta tha — 6 mahine baad meri body ne kuch aisa kiya jo expect nahi tha...",
    emotion: "Aspiration",
    niche: "Fitness",
    format: "Reel",
    engagementScore: 88,
  },
];

const emotionColors: Record<string, string> = {
  Curiosity: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Fear: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Relatability: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Aspiration: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Shock: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  FOMO: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Authority: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Humor: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

function HookCard({ hook }: { hook: typeof HOOKS[0] }) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);

  const copy = () => {
    navigator.clipboard.writeText(hook.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateVariations = async () => {
    setGenerating(true);
    // Simulating API call — real impl calls /api/hooks/variations
    await new Promise(r => setTimeout(r, 1500));
    setVariations([
      `${hook.text.split("—")[0]}— aur phir sab kuch badal gaya...`,
      `Sach bolun? Main khud yeh nahi maanta tha jab tak...`,
      `3 saal ki research ke baad mujhe pata chala ki...`,
      `Comment karo agar tum bhi yahi kar rahe ho 👇`,
      `Yeh dekhke mujhe shock laga — tumhe bhi hoga...`,
    ]);
    setGenerating(false);
  };

  return (
    <div className="p-5 rounded-2xl border border-border bg-card hover:border-foreground/20 transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${emotionColors[hook.emotion] || "bg-muted text-muted-foreground"}`}>
            {hook.emotion}
          </span>
          {hook.niche !== "All" && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              {hook.niche}
            </span>
          )}
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {hook.format}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          {hook.engagementScore}% score
        </div>
      </div>

      <p className="text-sm leading-relaxed font-medium mb-4 italic">"{hook.text}"</p>

      <div className="flex items-center gap-2">
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/60 transition"
        >
          {copied ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
        </button>
        <button
          onClick={generateVariations}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-400/10 transition disabled:opacity-50"
        >
          {generating ? (
            <><Zap className="w-3.5 h-3.5 animate-pulse" /> Generating...</>
          ) : (
            <><Zap className="w-3.5 h-3.5" /> 5 Variations banao</>
          )}
        </button>
      </div>

      {variations.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="text-xs font-bold text-muted-foreground">AI VARIATIONS</p>
          {variations.map((v, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-amber-400/15 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-muted-foreground italic">"{v}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HooksPage() {
  const [selectedNiche, setSelectedNiche] = useState("All");
  const [selectedEmotion, setSelectedEmotion] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = HOOKS.filter(h => {
    const matchNiche = selectedNiche === "All" || h.niche === selectedNiche || h.niche === "All";
    const matchEmotion = selectedEmotion === "All" || h.emotion === selectedEmotion;
    const matchSearch = !search || h.text.toLowerCase().includes(search.toLowerCase());
    return matchNiche && matchEmotion && matchSearch;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-500" />
            Hook Library
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {HOOKS.length}+ proven hooks — copy, filter, aur Claude se variations banao
          </p>
        </div>
        <div className="text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-muted font-medium">
          {filtered.length} results
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Hook search karo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Niche:</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {NICHES.map(n => (
              <button
                key={n}
                onClick={() => setSelectedNiche(n)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedNiche === n
                    ? "bg-amber-400 text-black"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium w-16">Emotion:</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {EMOTIONS.map(e => (
              <button
                key={e}
                onClick={() => setSelectedEmotion(e)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedEmotion === e
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hooks grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Koi hooks nahi mile</p>
          <p className="text-sm mt-1">Filter change karo ya search clear karo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(hook => <HookCard key={hook.id} hook={hook} />)}
        </div>
      )}
    </div>
  );
}
