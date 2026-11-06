import { useQueries } from "@tanstack/react-query";
import { listTable } from "@/lib/crm/gateway.functions";
import { isLive } from "@/lib/crm/data";
import type { Row } from "@/lib/crm/schema";
import { useAidyl } from "@/lib/store";

export const BUNDLE_TABLES = [
  "tbl_leads",
  "tbl_financing",
  "tbl_logistics",
  "tbl_ports",
  "tbl_shipment",
  "tbl_calls",
  "tbl_workflow_logs",
] as const;

export function useBundle(slug: string) {
  const workspace = useAidyl((s) => s.workspaces[slug]);
  const live = isLive(slug);
  const queries = useQueries({
    queries: BUNDLE_TABLES.map((table) => ({
      queryKey: ["crm", table],
      queryFn: () => listTable({ data: { table } }),
      enabled: live,
      staleTime: 20_000,
    })),
  });
  const rows: Record<string, Row[]> = {};
  BUNDLE_TABLES.forEach((id, index) => {
    rows[id] = live ? (queries[index]?.data?.items ?? []) : (workspace?.[id] ?? []);
  });
  const failed = queries.find((q) => q.error);
  return {
    rows,
    loading: live && queries.some((q) => q.isLoading),
    error: failed?.error instanceof Error ? failed.error.message : failed?.error ? "Could not reach the gateway" : "",
    live,
  };
}
