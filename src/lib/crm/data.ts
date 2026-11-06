import { listTable, mutateTable } from "@/lib/crm/gateway.functions";
import { tableById, type JsonValue, type Row, type TableDef } from "@/lib/crm/schema";
import { BUILTIN_CRMS, type CrmDef } from "@/lib/crm/registry";
import { blankActivity, useAidyl, type CustomCrm } from "@/lib/store";
import { nowIso, uid } from "@/lib/utils";

const cache = new Map<string, { at: number; rows: Row[] }>();
const TTL = 15_000;

export function bustCache(table?: string) {
  if (!table) cache.clear();
  else cache.delete(table);
}

export function allCrms(): (CrmDef | (CustomCrm & { live: false; agent: "randolph"; accent: "brass" }))[] {
  const custom = useAidyl.getState().customCrms.map((c) => ({
    ...c,
    live: false as const,
    agent: "randolph" as const,
    accent: "brass" as const,
  }));
  return [...BUILTIN_CRMS, ...custom];
}

export function crmBySlug(slug: string) {
  return allCrms().find((c) => c.slug === slug);
}

export function isLive(slug: string) {
  return slug === "carshipy";
}

export async function readTable(slug: string, table: string): Promise<Row[]> {
  if (!isLive(slug)) {
    const ws = useAidyl.getState().ensureWorkspace(slug);
    return (ws[table] ?? []).map((row) => ({ ...row }));
  }
  const hit = cache.get(table);
  if (hit && Date.now() - hit.at < TTL) return hit.rows.map((row) => ({ ...row }));
  const res = await listTable({ data: { table } });
  cache.set(table, { at: Date.now(), rows: res.items });
  return res.items.map((row) => ({ ...row }));
}

export async function readAcross(table: string) {
  const crms = allCrms();
  const groups = await Promise.all(
    crms.map(async (crm) => {
      try {
        const rows = await readTable(crm.slug, table);
        return rows.map((row) => ({ crm: crm.slug, crmName: crm.name, row }));
      } catch {
        return [];
      }
    }),
  );
  return groups.flat();
}

function asJson(value: unknown): JsonValue | undefined {
  if (value == null) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((entry) => asJson(entry) ?? null);
  if (typeof value === "object") {
    const out: { [key: string]: JsonValue } = {};
    for (const [key, entry] of Object.entries(value)) {
      const next = asJson(entry);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return undefined;
}

function cleanItem(table: TableDef, values: Record<string, unknown>, mode: "create" | "patch") {
  const item: Row = {};
  for (const field of table.fields) {
    if (mode === "patch" && (field.key === table.pk || field.key === table.sk)) continue;
    let value = values[field.key];
    if (field.kind === "auto-id" && mode === "create") {
      if (value == null || value === "") value = uid(field.idPrefix ?? "id");
    }
    if (field.kind === "auto-now" && (mode === "create" || value == null || value === "")) {
      if (mode === "create" || field.key === "lastActivity" || field.key === "last_updated") {
        value = nowIso();
      }
    }
    if (value == null || value === "") continue;
    if (field.list && typeof value === "string") {
      item[field.key] = value
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      continue;
    }
    if (field.kind === "number" && typeof value === "string" && value.trim() !== "") {
      const n = Number(value.replace(/[$,]/g, ""));
      item[field.key] = Number.isFinite(n) ? n : value;
      continue;
    }
    item[field.key] = asJson(value) ?? String(value);
  }
  return item;
}

function keyOf(table: TableDef, row: Row) {
  const key: Row = { [table.pk]: row[table.pk] };
  if (table.sk) key[table.sk] = row[table.sk];
  return key;
}

async function audit(input: {
  crm: string;
  table: string;
  action: string;
  message: string;
  leadId?: string;
  agent?: string;
  status?: "success" | "error";
}) {
  const operator = useAidyl.getState().operatorName || "Admin";
  useAidyl.getState().pushActivity(
    blankActivity({
      crm: input.crm,
      table: input.table,
      action: input.action,
      message: input.message,
      performedBy: operator,
      status: input.status ?? "success",
      agent: input.agent,
    }),
  );
  if (!isLive(input.crm) || input.table === "tbl_workflow_logs") return;
  try {
    await mutateTable({
      data: {
        op: "create",
        payload: {
          TableName: "tbl_workflow_logs",
          Item: {
            lead_id: input.leadId || "aidyl-system",
            timestamp: nowIso(),
            action: input.action,
            message: input.message,
            details: input.table,
            performed_by: input.agent ? `${operator} via ${input.agent}` : operator,
            status: input.status ?? "success",
            workflowName: input.agent ?? "Aidyl Console",
          },
        },
      },
    });
    bustCache("tbl_workflow_logs");
  } catch {
    /* local activity still stands */
  }
}

export async function createRecord(opts: {
  slug: string;
  table: string;
  values: Record<string, unknown>;
  agent?: string;
}) {
  const table = tableById(opts.table);
  if (!table) throw new Error("Unknown table");
  const item = cleanItem(table, opts.values, "create");
  if (item[table.pk] == null) throw new Error(`${table.pk} is missing`);
  if (isLive(opts.slug)) {
    await mutateTable({ data: { op: "create", payload: { TableName: table.id, Item: item } } });
    bustCache(table.id);
  } else {
    const rows = await readTable(opts.slug, table.id);
    useAidyl.getState().setRows(opts.slug, table.id, [item, ...rows.filter((r) => r[table.pk] !== item[table.pk])]);
  }
  const leadId = String(item.lead_id ?? (table.pk === "lead_id" ? item.lead_id : "") ?? "");
  await audit({
    crm: opts.slug,
    table: table.id,
    action: `create ${table.singular}`,
    message: `Created ${table.singular} ${String(item[table.pk])}`,
    leadId: leadId || undefined,
    agent: opts.agent,
  });
  return item;
}

export async function updateRecord(opts: {
  slug: string;
  table: string;
  key: Row;
  patch: Record<string, unknown>;
  agent?: string;
}) {
  const table = tableById(opts.table);
  if (!table) throw new Error("Unknown table");
  const patch = cleanItem(table, opts.patch, "patch");
  if (table.id === "tbl_leads") patch.lastActivity = nowIso();
  if (table.id === "tbl_logistics") patch.last_updated = nowIso();
  if (isLive(opts.slug)) {
    const names: { [key: string]: JsonValue } = {};
    const values: { [key: string]: JsonValue } = {};
    const parts: string[] = [];
    let i = 0;
    for (const [k, v] of Object.entries(patch)) {
      const nk = `#f${i}`;
      const vk = `:v${i}`;
      names[nk] = k;
      values[vk] = v;
      parts.push(`${nk} = ${vk}`);
      i += 1;
    }
    if (!parts.length) return;
    await mutateTable({
      data: {
        op: "update",
        payload: {
          TableName: table.id,
          Key: keyOf(table, opts.key),
          UpdateExpression: `SET ${parts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        },
      },
    });
    bustCache(table.id);
  } else {
    const rows = await readTable(opts.slug, table.id);
    useAidyl.getState().setRows(
      opts.slug,
      table.id,
      rows.map((row) => {
        const samePk = row[table.pk] === opts.key[table.pk];
        const sameSk = !table.sk || row[table.sk] === opts.key[table.sk];
        return samePk && sameSk ? { ...row, ...patch } : row;
      }),
    );
  }
  await audit({
    crm: opts.slug,
    table: table.id,
    action: `update ${table.singular}`,
    message: `Updated ${table.singular} ${String(opts.key[table.pk])}`,
    leadId: String(opts.key.lead_id ?? (table.pk === "lead_id" ? opts.key.lead_id : "") ?? "") || undefined,
    agent: opts.agent,
  });
}

export async function deleteRecord(opts: { slug: string; table: string; key: Row; agent?: string }) {
  const table = tableById(opts.table);
  if (!table) throw new Error("Unknown table");
  if (isLive(opts.slug)) {
    await mutateTable({
      data: { op: "delete", payload: { TableName: table.id, Key: keyOf(table, opts.key) } },
    });
    bustCache(table.id);
  } else {
    const rows = await readTable(opts.slug, table.id);
    useAidyl.getState().setRows(
      opts.slug,
      table.id,
      rows.filter((row) => {
        const samePk = row[table.pk] === opts.key[table.pk];
        const sameSk = !table.sk || row[table.sk] === opts.key[table.sk];
        return !(samePk && sameSk);
      }),
    );
  }
  await audit({
    crm: opts.slug,
    table: table.id,
    action: `delete ${table.singular}`,
    message: `Deleted ${table.singular} ${String(opts.key[table.pk])}`,
    leadId: String(opts.key.lead_id ?? (table.pk === "lead_id" ? opts.key.lead_id : "") ?? "") || undefined,
    agent: opts.agent,
  });
}

export async function saveTraining(doc: {
  agent: "randolph" | "maya" | "both";
  title: string;
  body: string;
}) {
  const createdAt = nowIso();
  const lead_id = doc.agent === "maya" ? "agent-maya" : doc.agent === "randolph" ? "agent-randolph" : "agent-both";
  const context_type = `train-${Date.now()}`;
  const full = {
    id: context_type,
    lead_id,
    context_type,
    agent: doc.agent,
    title: doc.title,
    body: doc.body,
    createdAt,
  };
  useAidyl.getState().upsertTraining(full);
  try {
    await mutateTable({
      data: {
        op: "create",
        payload: {
          TableName: "tbl_maya",
          Item: { lead_id, context_type, title: doc.title, body: doc.body, agent: doc.agent, createdAt },
        },
      },
    });
    bustCache("tbl_maya");
  } catch {
    /* kept locally */
  }
  await audit({
    crm: "carshipy",
    table: "tbl_maya",
    action: "train",
    message: `Training note for ${doc.agent}: ${doc.title}`,
    agent: doc.agent,
  });
  return full;
}

export async function deleteTraining(doc: { id: string; lead_id: string; context_type: string }) {
  useAidyl.getState().removeTraining(doc.id);
  try {
    await mutateTable({
      data: {
        op: "delete",
        payload: { TableName: "tbl_maya", Key: { lead_id: doc.lead_id, context_type: doc.context_type } },
      },
    });
    bustCache("tbl_maya");
  } catch {
    /* local removal stands */
  }
}

export async function syncTraining() {
  try {
    const res = await listTable({ data: { table: "tbl_maya" } });
    const remote = res.items
      .filter((row) => String(row.context_type ?? "").startsWith("train"))
      .map((row) => ({
        id: String(row.context_type),
        lead_id: String(row.lead_id ?? ""),
        context_type: String(row.context_type),
        agent: (String(row.agent ?? "both") as "randolph" | "maya" | "both") || "both",
        title: String(row.title ?? "Note"),
        body: String(row.body ?? ""),
        createdAt: String(row.createdAt ?? ""),
      }));
    const local = useAidyl.getState().training;
    const map = new Map<string, (typeof local)[number]>();
    for (const doc of remote) map.set(doc.id, doc);
    for (const doc of local) if (!map.has(doc.id)) map.set(doc.id, doc);
    const merged = [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    useAidyl.getState().replaceTraining(merged);
  } catch {
    /* offline to gateway */
  }
}
