import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { BUILTIN_CRMS } from "@/lib/crm/registry";
import { sectionsFor } from "@/lib/crm/schema";
import { useAidyl } from "@/lib/store";

export const Route = createFileRoute("/crm/$slug")({ component: CrmLayout });

function CrmLayout() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const custom = useAidyl((s) => s.customCrms);
  const ensure = useAidyl((s) => s.ensureWorkspace);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (slug === "ogamoto") {
      void navigate({ to: "/crm/$slug", params: { slug: "carshipy" }, replace: true });
    }
  }, [slug, navigate]);

  const builtin = BUILTIN_CRMS.find((c) => c.slug === slug);
  const extra = custom.find((c) => c.slug === slug);
  const crm = builtin ?? (extra ? { ...extra, live: false, agent: "randolph" as const } : null);

  useEffect(() => {
    if (slug === "ogamoto") return;
    if (crm && !crm.live) ensure(slug);
  }, [crm, ensure, slug]);

  if (slug === "ogamoto") {
    return (
      <main className="px-4 py-10 md:px-8">
        <h1 className="font-display text-3xl">Ogamoto is now Carshipy.</h1>
        <p className="mt-2 text-sm text-muted">The live book moved. The old booking desk is not a separate module.</p>
      </main>
    );
  }

  if (!crm) {
    return (
      <main className="px-4 py-10 md:px-8">
        <h1 className="font-display text-3xl">No company named {slug}</h1>
        <Link to="/" className="mt-4 inline-block text-sm text-brass">
          Back to command
        </Link>
      </main>
    );
  }

  const agent = crm.agent === "maya" ? "Maya" : "Randolph";

  return (
    <div>
      <header className="border-b border-line bg-surface px-4 py-5 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink font-display text-xl text-paper">{agent.slice(0, 1)}</span>
            <div>
              <p className="text-xs tracking-[0.18em] text-brass uppercase">{crm.live ? "Live Dynamo" : "Workspace"} · {agent} on duty</p>
              <h1 className="font-display text-4xl">{crm.name}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted">{crm.focus}</p>
            </div>
          </div>
          <Link
            to="/crm/$slug/$section"
            params={{ slug, section: "training" }}
            className="rounded-full bg-brass px-4 py-2 text-sm text-paper"
          >
            Train {agent}
          </Link>
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1">
          <Tab slug={slug} label="Overview" active={path === `/crm/${slug}`} />
          {sectionsFor(slug).map((section) => (
            <Tab
              key={section.id}
              slug={slug}
              section={section.id}
              label={section.label}
              active={path === `/crm/${slug}/${section.id}`}
            />
          ))}
        </nav>
      </header>
      <div className="px-4 py-6 md:px-8">
        <Outlet />
      </div>
    </div>
  );
}

function Tab({ slug, section, label, active }: { slug: string; section?: string; label: string; active: boolean }) {
  const className = `aidyl-shell shrink-0 rounded-md px-3 py-2 text-sm ${active ? "bg-ink text-paper" : "text-ink hover:bg-brass-soft"}`;
  if (!section) {
    return (
      <Link to="/crm/$slug" params={{ slug }} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <Link to="/crm/$slug/$section" params={{ slug, section }} className={className}>
      {label}
    </Link>
  );
}
