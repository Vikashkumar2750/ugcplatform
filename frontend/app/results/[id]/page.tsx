"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Download, Copy, ExternalLink, FileText, BarChart3,
  TrendingUp, Calendar, Zap, ChevronDown, ChevronUp,
  CheckCircle2, ArrowRight, Star, AlertTriangle, ThumbsUp
} from "lucide-react";

const TABS = [
  { id: "audit", label: "Profile Audit", icon: BarChart3 },
  { id: "competitors", label: "Competitor Analysis", icon: BarChart3 },
  { id: "trends", label: "Trend Report", icon: TrendingUp },
  { id: "pipeline", label: "Content Pipeline", icon: FileText },
  { id: "schedule", label: "Posting Schedule", icon: Calendar },
];

const MOCK_AUDIT = {
  er: "3.2%",
  benchmark: "Theek hai (1–3% normal hai, 3–6% zabardast)",
  strengths: [
    "Consistent posting — har 2–3 din mein ek post",
    "Trending audio ka achha use",
    "Relatable content style — audience connect karti hai",
  ],
  weaknesses: [
    "Hooks weak hain — first 3 seconds bore karte hain",
    "70% posts mein koi CTA nahi",
    "Hashtags too generic — #fitness jaise broad tags kaam nahi karte",
    "Caption shallow hai — sirf 1–2 lines, no story",
  ],
  diagnosis: {
    hookQuality: "⚠️ Weak — First 3 seconds mein koi hook nahi. Viewer scroll kar deta hai.",
    ctaPresence: "❌ Missing — 70% posts mein clear CTA nahi hai",
    consistency: "✓ Good — Har 2–3 din mein post, gaps minimal hain",
    contentVariety: "⚠️ Same format baar baar — kabhi-kabhi carousel try karo",
    hashtagStrategy: "❌ Too broad — #fitness se specific audience nahi milti",
    captionDepth: "❌ Too short — 1–2 lines se algorithm boost nahi milta",
    engagementLoop: "⚠️ Comments ka reply rate low hai — 40% tak chhod dete ho",
  },
};

const MOCK_SCRIPTS = [
  {
    day: "Din 1 (Monday)",
    format: "Reel",
    topic: "Yeh ek galti karti hai 90% log — aur phir puchte hain 'results kyun nahi aate'",
    hook: "\"Yaar, 3 mahine meine bhi yahi kiya tha jab tak kisi ne rokke nahi bataya ki main wrong kar raha hoon...\"",
    trigger: "Relatability + Curiosity Gap",
    script: `[HOOK - 0:00-0:03]\nCamera pe direct dekho: "Yaar, 3 mahine meine bhi yahi kiya tha..."\n\n[PROBLEM - 0:03-0:15]\nScreen pe text: "Yeh mistake jo 90% log karte hain"\nVoiceover: "Agar tum bhi aise karte ho, toh yeh video tumhare liye hai"\n\n[SOLUTION - 0:15-0:45]\n3 quick points, text on screen + demo\n\n[CTA - 0:45-0:60]\n"Comment karo 'TIPS' — main tumhe poora breakdown dunga DM mein"`,
    caption: `3 mahine pehle main bhi exactly yahi kar raha tha. Zero results.\n\nPhir ek senior creator ne mujhe yeh ek cheez batai — aur sab kuch badal gaya 👇\n\n[1] Galti kya thi\n[2] Maine kya change kiya\n[3] Result kya mila\n\nComment karo 'TIPS' aur main full breakdown dunga.\n\n#FitnessIndia #IndianFitness #ContentCreator #ReelsViral #FitnessMotivation`,
  },
  {
    day: "Din 2 (Tuesday)",
    format: "Carousel",
    topic: "5 foods jo Indian gym-goers galat time pe khate hain",
    hook: "\"Bhai, pre-workout mein banana? Nahi yaar, yeh galti mat karo...\"",
    trigger: "Fear + Authority",
    script: `Slide 1: Bold claim\nSlide 2-6: Each food with explanation\nSlide 7: CTA`,
    caption: `Pre-workout, post-workout, breakfast — sab ka timing matter karta hai.\n\nYeh 5 foods hain jo Indian fitness creators galat time pe khate hain (main bhi karta tha)\n\nSave karo baad ke liye 👆\n\n#NutritionIndia #FitnessFood #HealthyEating #IndianFitness`,
  },
];

function ScriptCard({ script, idx }: { script: typeof MOCK_SCRIPTS[0]; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    navigator.clipboard.writeText(`${script.hook}\n\n${script.script}\n\n${script.caption}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-5 cursor-pointer hover:bg-muted/30 transition" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-400">{script.day}</span>
              <span className="text-xs text-muted-foreground">{script.format}</span>
            </div>
            <p className="font-semibold text-sm leading-snug">{script.topic}</p>
            <p className="text-xs text-muted-foreground mt-1 italic">Hook: {script.hook.substring(0, 60)}...</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{script.trigger.split(" + ")[0]}</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">HOOK (First 3 seconds)</p>
            <blockquote className="text-sm italic border-l-4 border-amber-400 pl-3 py-1">{script.hook}</blockquote>
            <p className="text-xs text-muted-foreground mt-1">Trigger: {script.trigger}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2">FULL SCRIPT</p>
            <pre className="text-xs bg-muted/40 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">{script.script}</pre>
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2">CAPTION + HASHTAGS</p>
            <pre className="text-xs bg-muted/40 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{script.caption}</pre>
          </div>
          <button onClick={copyAll} className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition">
            {copied ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy all</>}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState("audit");
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-card">
        <div>
          <h1 className="font-heading text-xl font-bold">Analysis Results</h1>
          <p className="text-xs text-muted-foreground">Instagram · Fitness · Hinglish</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> 7 Aur Generate karo
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border bg-card px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`result-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-amber-400 text-amber-600 dark:text-amber-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">

        {/* Profile Audit Tab */}
        {activeTab === "audit" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 p-5 rounded-2xl border border-amber-400/30 bg-amber-400/5">
                <p className="text-xs text-muted-foreground mb-1">Engagement Rate</p>
                <p className="text-4xl font-heading font-extrabold text-gradient">{MOCK_AUDIT.er}</p>
                <p className="text-xs text-muted-foreground mt-2">{MOCK_AUDIT.benchmark}</p>
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                {[
                  { label: "Followers", value: "12.4K" },
                  { label: "Avg Likes", value: "348" },
                  { label: "Avg Comments", value: "52" },
                  { label: "Posts Analyzed", value: "20" },
                ].map((stat) => (
                  <div key={stat.label} className="p-3 rounded-xl border border-border bg-card text-center">
                    <p className="font-heading font-bold text-xl">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-green-400/20 bg-green-400/5">
                <div className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400 mb-3">
                  <ThumbsUp className="w-4 h-4" /> Kya sahi chal raha hai
                </div>
                <div className="space-y-2">
                  {MOCK_AUDIT.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 rounded-2xl border border-red-400/20 bg-red-400/5">
                <div className="flex items-center gap-2 text-sm font-bold text-red-500 mb-3">
                  <AlertTriangle className="w-4 h-4" /> Kya galat ho raha hai
                </div>
                <div className="space-y-2">
                  {MOCK_AUDIT.weaknesses.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 font-bold">✗</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card">
              <p className="text-sm font-bold mb-4">Seedha Diagnosis</p>
              <div className="space-y-3">
                {Object.entries(MOCK_AUDIT.diagnosis).map(([key, val]) => (
                  <div key={key} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground capitalize w-36 flex-shrink-0 mt-0.5">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span className="text-sm">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Competitor Analysis Tab */}
        {activeTab === "competitors" && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl border border-border bg-card">
              <p className="text-sm font-bold mb-4">Comparison Matrix</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Metric</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">You</th>
                      <th className="text-center py-2 text-amber-600 dark:text-amber-400 font-medium">Comp. A</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">Comp. B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: "Engagement Rate", you: "3.2%", a: "6.8%", b: "5.1%" },
                      { metric: "Avg Views", you: "4.2K", a: "28K", b: "15K" },
                      { metric: "Hook Quality", you: "⚠️ Weak", a: "✓ Strong", b: "✓ Good" },
                      { metric: "CTA in Posts", you: "30%", a: "95%", b: "88%" },
                      { metric: "Posting Freq", you: "3/week", a: "7/week", b: "5/week" },
                      { metric: "Caption Depth", you: "Short", a: "Story-based", b: "Value-focused" },
                    ].map((row) => (
                      <tr key={row.metric} className="border-b border-border last:border-0">
                        <td className="py-2.5 text-muted-foreground">{row.metric}</td>
                        <td className="py-2.5 text-center font-medium">{row.you}</td>
                        <td className="py-2.5 text-center font-bold text-amber-600 dark:text-amber-400">{row.a}</td>
                        <td className="py-2.5 text-center text-muted-foreground">{row.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-red-400/20 bg-red-400/5 space-y-3">
                <p className="text-xs font-bold text-red-500">TUMHARA ACCOUNT — KYA GALAT HAI</p>
                {["Hooks bore karte hain", "CTA missing 70% posts mein", "Hashtags too generic"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-red-500/15 text-red-500 text-xs flex items-center justify-center font-bold flex-shrink-0">✗</span>
                    {item}
                  </div>
                ))}
              </div>
              <div className="p-5 rounded-2xl border border-green-400/20 bg-green-400/5 space-y-3">
                <p className="text-xs font-bold text-green-600 dark:text-green-400">COMPETITORS — KYA SAHI KAR RAHE HAIN</p>
                {["Curiosity gap hooks use karte hain", "Har post mein comment CTA", "Niche hashtags target karti hain"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 text-xs flex items-center justify-center font-bold flex-shrink-0">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Trend Report Tab */}
        {activeTab === "trends" && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl border border-border bg-card">
              <p className="text-sm font-bold mb-4">Trending Formats — Fitness India (This Month)</p>
              <div className="space-y-3">
                {[
                  { format: "Before/After transformation", growth: "+240%", type: "Reel" },
                  { format: "Day in my life — Indian gym", growth: "+180%", type: "Reel" },
                  { format: "Myth vs Fact — protein/diet", growth: "+150%", type: "Carousel" },
                  { format: "5 mistakes beginners make", growth: "+120%", type: "Reel" },
                ].map((trend, i) => (
                  <div key={i} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                    <span className="w-6 h-6 rounded-full bg-muted text-xs font-bold flex items-center justify-center text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium">{trend.format}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{trend.type}</span>
                    <span className="text-xs font-bold text-green-600 dark:text-green-400">{trend.growth}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card">
              <p className="text-sm font-bold mb-4">Trending Hashtags (Fitness India)</p>
              <div className="flex flex-wrap gap-2">
                {["#FitnessIndia", "#IndianFitness", "#GymIndia", "#WeightLoss", "#FitnessMotivation", "#HealthyIndia", "#DesiGym", "#IndianBodybuilding", "#FitIndia", "#HomeWorkout", "#YogaIndia", "#NutritionIndia", "#ContentCreator", "#ReelsViral", "#IndianYouTuber"].map((tag) => (
                  <span key={tag} className="px-3 py-1.5 rounded-full bg-muted text-sm font-medium hover:bg-amber-400/10 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content Pipeline Tab */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">7 Ready-to-Post Scripts</p>
              <button className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1">
                Sab copy karo <Copy className="w-3 h-3" />
              </button>
            </div>
            {MOCK_SCRIPTS.map((script, i) => (
              <ScriptCard key={i} script={script} idx={i} />
            ))}
            <div className="p-4 rounded-xl border border-border bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground mb-3">Aur 5 scripts ready hain (days 3–7)</p>
              <div className="flex items-center justify-center gap-2">
                {[3, 4, 5, 6, 7].map(d => (
                  <div key={d} className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-xs text-muted-foreground font-medium">
                    D{d}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Posting Schedule Tab */}
        {activeTab === "schedule" && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl border border-border bg-card">
              <p className="text-sm font-bold mb-4">Optimal Posting Schedule — India</p>
              <div className="space-y-3">
                {[
                  { day: "Monday", time: "7:00 PM – 9:00 PM IST", score: "🔥 Prime time" },
                  { day: "Wednesday", time: "7:00 PM – 9:00 PM IST", score: "🔥 Prime time" },
                  { day: "Friday", time: "8:00 PM – 10:00 PM IST", score: "🔥 Best day" },
                  { day: "Saturday", time: "11:00 AM – 1:00 PM IST", score: "✓ Good" },
                  { day: "Sunday", time: "7:00 PM – 9:00 PM IST", score: "✓ Good" },
                ].map((slot) => (
                  <div key={slot.day} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                    <span className="w-24 text-sm font-medium">{slot.day}</span>
                    <span className="flex-1 text-sm text-muted-foreground">{slot.time}</span>
                    <span className="text-sm">{slot.score}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 rounded-2xl border border-amber-400/20 bg-amber-400/5">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">💡 Tip</p>
              <p className="text-sm">Indian creators ke liye 7–9 PM IST sabse effective time hai. Yahi woh time hai jab India scroll karta hai — office se ghar aa ke, dinner se pehle.</p>
            </div>
          </div>
        )}
      </div>

      {/* Export bar */}
      <div className="sticky bottom-0 border-t border-border bg-card/95 backdrop-blur-sm px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium mr-1">Export:</span>
          {[
            { label: "Google Doc", icon: ExternalLink },
            { label: "Notion", icon: ExternalLink },
            { label: "PDF", icon: Download },
          ].map((exp) => (
            <button key={exp.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition">
              <exp.icon className="w-3.5 h-3.5" /> {exp.label}
            </button>
          ))}
          <button onClick={copyAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition ml-auto">
            {copied ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Sab copy karo</>}
          </button>
        </div>
      </div>
    </div>
  );
}
