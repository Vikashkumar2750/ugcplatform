import { Loader2 } from "lucide-react";

export default function AutomationLoading() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  );
}
