import { useState } from "react";
import { mediaPublicSection } from "@/lib/media-report";
import { publishReport } from "@/lib/reports";
import { allCrms, readAcross, readTable } from "@/lib/crm/data";
import { DATA_TABLES, tableById } from "@/lib/crm/schema";
import { useAidyl } from "@/lib/store";
import { cellText } from "@/lib/utils";

export function ReportPanel({ lockedSlug }: { lockedSlug?: string }) {
  const operator = useAidyl((s) => s.operatorName);
  const crms = allCrms();
  const [slug, setSlug] = useState(lockedSlug ?? "all");
  const [tableId, setTableId] = useState("tbl_leads");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const scope = lockedSlug ?? slug;
  const media = scope === "betterdealtv";
  const tables = media ? DATA_TABLES.filter((table) => table.id === "tbl_leads") : DATA_TABLES;

  async function run(whole: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const ids = media ? ["tbl_leads"] : whole ? DATA_TABLES.map((t) => t.id) : [tableId];
      const sections = [];
      for (const id of ids) {
        const table = tableById(id);
        if (!table) continue;
        const data =
          scope === "all"
            ? await readAcross(id)
            : (await readTable(scope, id)).map((row) => ({
                crm: scope,
                crmName: crms.find((c) => c.slug === scope)?.name ?? scope,
                row,
              }));
        sections.push({
          heading: table.label,
          columns: ["Company", ...table.fields.slice(0, 6).map((f) => f.label)],
          rows: data.slice(0, 40).map((item) => [item.crmName, ...table.fields.slice(0, 6).map((f) => cellText(item.row[f.key]))]),
        });
      }
      if (media || (whole && scope === "all")) sections.push(mediaPublicSection());
      const title = media ? "Media brief" : whole ? "Whole business" : tableById(tableId)?.label ?? "Report";
      const company = scope === "all" ? "Aidyl Systems" : crms.find((c) => c.slug === scope)?.name ?? scope;
      await publishReport(
        {
          title: `${company} · ${title}`,
          subtitle: media
            ? "BetterDealTV public accounts, plus any media leads in this workspace. Operational books are not included."
            : lockedSlug
              ? "Prepared inside a module. Maya’s reports stay on Carshipy."
              : "Prepared from command. Carshipy is live. Other modules are workspace records.",
          preparedBy: operator || "Admin",
          agent: lockedSlug === "carshipy" ? "Maya" : "Randolph",
          sections,
          notes: media
            ? "Public counts only. Private reach and impressions are not in this file."
            : "Generated on the desk without a third-party model.",
        },
        scope === "all" ? "all" : scope,
      );
      setMessage("Saved on this desk. The download has started.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Report failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="aidyl-panel max-w-xl space-y-4 rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl">{media ? "Media brief" : "PDF reports"}</h2>
      <p className="text-sm text-muted">
        {media
          ? "Randolph files the public accounts and any BetterDealTV leads. Carshipy shipments, financing, and logistics stay off this report."
          : "Randolph can cut one module or the whole group. On Carshipy, Maya’s report stays on the live book. The PDF lists measured rows. It does not invent analytics."}
      </p>
      {lockedSlug ? null : (
        <label className="block text-sm">
          Company
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2">
            <option value="all">All companies</option>
            {crms.map((crm) => (
              <option key={crm.slug} value={crm.slug}>
                {crm.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {media ? null : (
        <label className="block text-sm">
          Section
          <select value={tableId} onChange={(e) => setTableId(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2">
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {media ? null : (
          <button disabled={busy} onClick={() => run(false)} className="rounded-md bg-brass px-4 py-2 text-sm text-paper disabled:opacity-60">
            {busy ? "Building…" : "Download section"}
          </button>
        )}
        <button disabled={busy} onClick={() => run(true)} className="rounded-md bg-ink px-4 py-2 text-sm text-paper disabled:opacity-60">
          {busy ? "Building…" : media ? "Download media brief" : "Download whole desk"}
        </button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
