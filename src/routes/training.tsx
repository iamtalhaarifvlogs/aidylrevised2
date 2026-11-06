import { createFileRoute, Link } from "@tanstack/react-router";
import { TrainingPanel } from "@/components/training-panel";

export const Route = createFileRoute("/training")({ component: TrainingPage });

function TrainingPage() {
  return (
    <main>
      <header className="border-b border-line bg-ink px-4 py-8 text-paper md:px-8 md:py-10">
        <p className="text-xs tracking-[0.18em] text-brass uppercase">Training studio</p>
        <h1 className="mt-2 max-w-3xl font-display text-4xl leading-tight md:text-5xl">Teach them something they will actually use.</h1>
        <p className="mt-3 max-w-2xl text-sm text-paper/75">
          Write a rule in ordinary language. Randolph learns the whole group. Maya learns Carshipy. Both keep the note, and the next time you ask, they answer from it — not from a model.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-brass px-3 py-1 text-paper">Randolph · every company</span>
          <span className="rounded-full bg-paper/10 px-3 py-1">Maya · Carshipy only</span>
          <Link to="/crm/$slug/$section" params={{ slug: "carshipy", section: "training" }} className="rounded-full border border-paper/25 px-3 py-1">
            Maya’s own desk
          </Link>
        </div>
      </header>
      <div className="px-4 py-6 md:px-8">
        <TrainingPanel defaultAgent="randolph" />
      </div>
    </main>
  );
}
