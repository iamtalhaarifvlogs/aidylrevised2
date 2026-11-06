import { createFileRoute } from "@tanstack/react-router";
import { ReportArchive } from "@/components/report-archive";
import { ReportPanel } from "@/components/report-panel";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  return (
    <main className="px-4 py-6 md:px-8">
      <p className="text-xs tracking-[0.18em] text-brass uppercase">Randolph</p>
      <h1 className="font-display text-4xl">Reports</h1>
      <p className="mt-2 mb-6 max-w-2xl text-sm text-muted">
        Every report stays on this desk after it downloads. Open an older one again, or cut a new section. You can also ask Randolph from the chat.
      </p>
      <ReportArchive />
      <ReportPanel />
    </main>
  );
}
