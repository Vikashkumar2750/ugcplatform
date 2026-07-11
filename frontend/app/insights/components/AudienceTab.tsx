export default function AudienceTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900 min-h-[300px] flex items-center justify-center">
          <p className="text-zinc-500 text-sm">Age & Gender Chart</p>
        </div>
        <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900 min-h-[300px] flex items-center justify-center">
          <p className="text-zinc-500 text-sm">Top Cities/Countries</p>
        </div>
      </div>
    </div>
  );
}
