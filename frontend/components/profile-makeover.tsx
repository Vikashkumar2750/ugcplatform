import { X, Check, XCircle, CheckCircle2, UserCircle2 } from "lucide-react";

export interface ProfileMakeoverProps {
  makeover?: {
    before?: {
      name?: string;
      bio?: string;
      flaws?: string[];
    };
    after?: {
      name?: string;
      bio?: string;
      benefits?: string[];
    };
  };
}

export function ProfileMakeover({ makeover }: ProfileMakeoverProps) {
  if (!makeover || (!makeover.before && !makeover.after)) {
    return null;
  }

  const { before, after } = makeover;

  return (
    <div className="flex flex-col space-y-8 py-8 border-t border-border mt-8">
      <div className="text-center space-y-2">
        <h3 className="font-heading text-2xl font-bold">Bio padhke hi log decide karte hain</h3>
        <p className="text-muted-foreground text-sm">See how a small change in your profile setup can drastically increase your follower conversion rate.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start relative">
        {/* VS Badge for Desktop */}
        <div className="hidden md:flex absolute top-[120px] left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background border border-border items-center justify-center font-bold text-sm z-10 shadow-sm">
          VS
        </div>

        {/* Before */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <X className="w-6 h-6 text-red-600" strokeWidth={3} />
          </div>
          
          <div className="w-full rounded-2xl border border-red-400/20 bg-card shadow-sm overflow-hidden">
            {/* Fake Profile Header */}
            <div className="p-6 pb-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shrink-0 border-2 border-red-400/20">
                <UserCircle2 className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <div className="flex justify-between w-full">
                <div className="text-center">
                  <p className="font-bold text-lg">32</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Posts</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">342</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Followers</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">258</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Following</p>
                </div>
              </div>
            </div>

            {/* Fake Profile Bio */}
            <div className="px-6 pb-6 space-y-2 relative">
              <div className="font-bold">{before?.name || "Karan"}</div>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground p-3 border border-red-400/30 border-dashed rounded-lg bg-red-400/5 relative">
                {before?.bio || "Foodie 🍔 | Dreamer ✨ | Traveller ✈️\nLiving my best life ❤️\nBlessed 😇"}
                <XCircle className="w-5 h-5 text-red-500 absolute top-4 right-4 bg-background rounded-full" />
              </div>
              
              <div className="flex gap-2 pt-2">
                <div className="flex-1 py-1.5 bg-blue-600 rounded-lg text-white text-xs font-bold text-center opacity-70">Follow</div>
                <div className="flex-1 py-1.5 bg-muted rounded-lg text-foreground text-xs font-bold text-center">Message</div>
              </div>
            </div>

            {/* Flaws List */}
            <div className="bg-red-50/50 dark:bg-red-950/10 p-4 border-t border-red-400/20 space-y-2">
              {(before?.flaws || ["Generic", "No Value", "No Reason To Follow"]).map((flaw, i) => (
                <div key={i} className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-md">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {flaw}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* After */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-green-600" strokeWidth={3} />
          </div>
          
          <div className="w-full rounded-2xl border border-green-400/30 bg-card shadow-lg overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-500"></div>
            
            {/* Fake Profile Header */}
            <div className="p-6 pb-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px] shrink-0">
                <div className="w-full h-full bg-card rounded-full flex items-center justify-center border-2 border-background">
                  <UserCircle2 className="w-8 h-8 text-muted-foreground/50" />
                </div>
              </div>
              <div className="flex justify-between w-full">
                <div className="text-center">
                  <p className="font-bold text-lg">250</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Posts</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">12.4K</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Followers</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">210</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Following</p>
                </div>
              </div>
            </div>

            {/* Fake Profile Bio */}
            <div className="px-6 pb-6 space-y-2 relative">
              <div className="font-bold text-green-600 dark:text-green-400">{after?.name || "Aditya | Instagram Growth Coach"}</div>
              <div className="text-sm whitespace-pre-wrap p-3 border border-green-400/40 border-dashed rounded-lg bg-green-400/5 relative">
                {after?.bio || "Helping Creators Grow On Instagram\n✅ Growth Tips\n🎯 Content Strategy\n🚀 Daily Creator Advice"}
                <CheckCircle2 className="w-5 h-5 text-green-500 absolute top-4 right-4 bg-background rounded-full" />
              </div>
              
              <div className="flex gap-2 pt-2">
                <div className="flex-1 py-1.5 bg-blue-600 rounded-lg text-white text-xs font-bold text-center hover:bg-blue-700 transition cursor-pointer">Follow</div>
                <div className="flex-1 py-1.5 bg-muted rounded-lg text-foreground text-xs font-bold text-center hover:bg-muted/80 transition cursor-pointer">Message</div>
              </div>
            </div>

            {/* Benefits List */}
            <div className="bg-green-50/50 dark:bg-green-950/10 p-4 border-t border-green-400/20 space-y-2">
              {(after?.benefits || ["Clear", "Valuable", "Follow-Worthy"]).map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium bg-green-100 dark:bg-green-900/20 px-3 py-1.5 rounded-md">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
