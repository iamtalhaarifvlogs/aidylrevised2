import { createServerFn } from "@tanstack/react-start";
import type { JsonValue, Row } from "@/lib/crm/schema";

const API = "https://mbz2lmd7ud.execute-api.us-east-2.amazonaws.com/default/crm_data";

const ALLOWED = new Set([
  "tbl_leads",
  "tbl_financing",
  "tbl_logistics",
  "tbl_ports",
  "tbl_shipment",
  "tbl_workflow_logs",
  "tbl_calls",
  "tbl_maya",
  "tbl_campaigns",
]);

function assertTable(table: string) {
  if (!ALLOWED.has(table)) throw new Error(`Unknown table: ${table}`);
}

export const listTable = createServerFn({ method: "GET" })
  .validator((data: { table: string }) => {
    if (!data?.table) throw new Error("Table is required");
    assertTable(data.table);
    return { table: data.table };
  })
  .handler(async ({ data }) => {
    const res = await fetch(`${API}?TableName=${encodeURIComponent(data.table)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text.slice(0, 400) || `Gateway ${res.status}`);
    const json = JSON.parse(text) as { Items?: Row[] };
    const items = Array.isArray(json.Items) ? json.Items : [];
    return { items, count: items.length };
  });

type MutateInput = {
  op: "create" | "update" | "delete";
  payload: { [key: string]: JsonValue };
};

export const mutateTable = createServerFn({ method: "POST" })
  .validator((data: MutateInput) => {
    if (!data || (data.op !== "create" && data.op !== "update" && data.op !== "delete")) {
      throw new Error("Unknown operation");
    }
    const table = String(data.payload?.TableName ?? "");
    assertTable(table);
    return data;
  })
  .handler(async ({ data }) => {
    const method = data.op === "create" ? "POST" : data.op === "update" ? "PUT" : "DELETE";
    const res = await fetch(API, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data.payload),
    });
    const text = await res.text();
    let parsed: JsonValue = text;
    try {
      parsed = JSON.parse(text) as JsonValue;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const msg = typeof parsed === "string" ? parsed : text;
      throw new Error(msg.slice(0, 500) || `Gateway ${res.status}`);
    }
    return { ok: true as const, result: parsed };
  });
