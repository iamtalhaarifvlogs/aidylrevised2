import { useEffect, useState } from "react";
import { useAidyl } from "@/lib/store";

export function DeskSignals() {
  const latest = useAidyl((s) => s.notices[0]);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!latest) return;
    setShown(latest.id);
    const timer = setTimeout(() => setShown((id) => (id === latest.id ? null : id)), 7000);
    return () => clearTimeout(timer);
  }, [latest]);

  if (!latest || shown !== latest.id) return null;
  const card = (
    <div className="rounded-2xl bg-ink px-4 py-3 text-paper shadow-lg">
      <p className="text-xs tracking-[0.14em] text-brass uppercase">{latest.title}</p>
      <p className="mt-1 text-sm text-paper/90">{latest.body}</p>
    </div>
  );
  return (
    <div className="fixed right-4 bottom-24 left-4 z-40 max-w-sm md:left-auto">
      {latest.href ? <a href={latest.href}>{card}</a> : card}
    </div>
  );
}
