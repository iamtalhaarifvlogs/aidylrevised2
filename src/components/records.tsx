import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tableById, type Row, type TableDef } from "@/lib/crm/schema";
import { createRecord, deleteRecord, updateRecord } from "@/lib/crm/data";
import { cellText, cn } from "@/lib/utils";

export function Records({
  slug,
  tableId,
  rows,
  loading,
  error,
}: {
  slug: string;
  tableId: string;
  rows: Row[];
  loading?: boolean;
  error?: string;
}) {
  const table = tableById(tableId);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Row | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const client = useQueryClient();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => cellText(row).toLowerCase().includes(needle));
  }, [rows, q]);

  if (!table) return <p>Unknown table.</p>;
  const spec = table;
  const columns = spec.fields.filter((f) => f.kind !== "textarea").slice(0, 6);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setFormError("");
    try {
      if (mode === "create") {
        await createRecord({ slug, table: spec.id, values: draft });
      } else {
        const key: Row = { [spec.pk]: draft[spec.pk] };
        if (spec.sk) key[spec.sk] = draft[spec.sk];
        const patch: Row = { ...draft };
        delete patch[spec.pk];
        if (spec.sk) delete patch[spec.sk];
        await updateRecord({ slug, table: spec.id, key, patch });
      }
      await client.invalidateQueries({ queryKey: ["crm"] });
      setDraft(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft || mode !== "edit") return;
    if (!window.confirm(`Delete ${spec.singular} ${String(draft[spec.pk])}?`)) return;
    setBusy(true);
    setFormError("");
    try {
      const key: Row = { [spec.pk]: draft[spec.pk] };
      if (spec.sk) key[spec.sk] = draft[spec.sk];
      await deleteRecord({ slug, table: spec.id, key });
      await client.invalidateQueries({ queryKey: ["crm"] });
      setDraft(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl">{spec.label}</h2>
          <p className="text-sm text-muted">{spec.description}</p>
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search this table"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm sm:w-56"
          />
          <button
            className="rounded-md bg-brass px-3 py-2 text-sm text-paper"
            onClick={() => {
              setMode("create");
              setDraft({});
              setFormError("");
            }}
          >
            New
          </button>
        </div>
      </div>
      {error ? <p className="mb-3 rounded-md bg-clay-soft px-3 py-2 text-sm text-clay">{error}</p> : null}
      {loading ? <p className="text-sm text-muted">Loading live rows…</p> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-3 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-muted">
                  No rows yet. Add one yourself, or ask the desk agent to interview you for it.
                </td>
              </tr>
            ) : (
              shown.map((row, index) => (
                <tr
                  key={`${String(row[spec.pk])}-${index}`}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-brass-soft/60"
                  onClick={() => {
                    setMode("edit");
                    setDraft({ ...row });
                    setFormError("");
                  }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="max-w-56 truncate px-3 py-3 tabular-nums">
                      {cellText(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">{shown.length} shown</p>
      {draft ? (
        <Editor
          table={spec}
          draft={draft}
          mode={mode}
          busy={busy}
          error={formError}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={save}
          onDelete={remove}
        />
      ) : null}
    </div>
  );
}

function Editor({
  table,
  draft,
  mode,
  busy,
  error,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  table: TableDef;
  draft: Row;
  mode: "create" | "edit";
  busy: boolean;
  error: string;
  onChange: (row: Row) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <div className="flex h-full w-full max-w-lg flex-col bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h3 className="font-display text-xl">{mode === "create" ? `New ${table.singular}` : `Edit ${table.singular}`}</h3>
            <p className="text-xs text-muted">Ids and timestamps fill themselves when you save.</p>
          </div>
          <button className="rounded-md px-3 py-2 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {table.fields.map((field) => {
            const locked = field.kind === "auto-id" || field.kind === "auto-now";
            const value = draft[field.key];
            const shown = Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);
            return (
              <label key={field.key} className="block text-sm">
                <span className="text-muted">
                  {field.label}
                  {field.required ? " · required" : ""}
                  {locked ? " · automatic" : ""}
                </span>
                {field.kind === "textarea" ? (
                  <textarea
                    value={shown}
                    disabled={locked && mode === "edit"}
                    onChange={(e) => onChange({ ...draft, [field.key]: e.target.value })}
                    className="mt-1 min-h-24 w-full rounded-md border border-line bg-bg px-3 py-2"
                  />
                ) : (
                  <input
                    value={shown}
                    disabled={locked && mode === "edit"}
                    placeholder={field.hint}
                    onChange={(e) => onChange({ ...draft, [field.key]: e.target.value })}
                    className={cn("mt-1 w-full rounded-md border border-line bg-bg px-3 py-2", locked && "text-muted")}
                  />
                )}
              </label>
            );
          })}
          {error ? <p className="rounded-md bg-clay-soft px-3 py-2 text-sm text-clay">{error}</p> : null}
        </div>
        <div className="flex gap-2 border-t border-line px-5 py-4">
          <button disabled={busy} onClick={onSave} className="rounded-md bg-forest px-4 py-2 text-sm text-paper disabled:opacity-60">
            {busy ? "Saving…" : "Save"}
          </button>
          {mode === "edit" ? (
            <button disabled={busy} onClick={onDelete} className="rounded-md bg-clay-soft px-4 py-2 text-sm text-clay">
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
