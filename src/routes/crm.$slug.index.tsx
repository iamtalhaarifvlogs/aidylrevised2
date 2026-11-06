import { createFileRoute } from "@tanstack/react-router";
import { Analytics } from "@/components/analytics";
import { MediaHome } from "@/components/media-desk";
import { stageBucket } from "@/components/command-center";
import { useBundle } from "@/lib/crm/use-bundle";
import { cellText } from "@/lib/utils";

export const Route = createFileRoute("/crm/$slug/")({ component: Overview });

function Overview() {
  const { slug } = Route.useParams();
  const bundle = useBundle(slug);
  const leads = bundle.rows.tbl_leads ?? [];
  if (slug === "betterdealtv") {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-line bg-brass-soft px-4 py-3 text-sm">
          This is the media desk. Randolph reads the public YouTube, Instagram, TikTok, and website accounts. Leads here are audience contacts, not Carshipy shipments.
        </p>
        {bundle.error ? <p className="rounded-md bg-clay-soft px-3 py-2 text-sm text-clay">{bundle.error}</p> : null}
        <MediaHome leads={leads.map((row) => ({ id: cellText(row.lead_id), name: cellText(row.name) }))} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {!bundle.live ? (
        <p className="rounded-xl border border-line bg-brass-soft px-4 py-3 text-sm">
          These rows live in this browser workspace. They are not written to the Carshipy tables. Randolph can still report on them.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Carshipy is the live book. Aether reads it in the background. Maya recommends. Aether writes only after you approve.
        </p>
      )}
      {slug === "carshipy" ? (
        <ol className="flex gap-2 overflow-x-auto text-xs">
          {["Lead", "Qualification", "Vehicle", "Pricing", "Financing", "Transaction", "Shipping", "Tracking", "Complete"].map((label) => {
            const count = leads.filter((row) => stageBucket(String(row.stage ?? "")) === label).length;
            return (
              <li key={label} className="shrink-0 rounded-full border border-line bg-surface px-3 py-2">
                {label} <span className="tabular-nums text-muted">{count}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {bundle.error ? <p className="rounded-md bg-clay-soft px-3 py-2 text-sm text-clay">{bundle.error}</p> : null}
      <Analytics
        leads={leads}
        shipments={bundle.rows.tbl_shipment ?? []}
        financing={bundle.rows.tbl_financing ?? []}
        logistics={bundle.rows.tbl_logistics ?? []}
      />
    </div>
  );
}
