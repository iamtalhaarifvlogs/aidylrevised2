import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { shareReport, type ReportSpec } from "../lib/pdf";
import { crmBySlug, isLive, readAcross, readTable } from "../lib/data";
import { getState } from "../lib/store";
import { tableById } from "../lib/schema";
import { cellText } from "../lib/utils";
import { colors, fonts } from "../theme";

const KINDS = [
  { id: "business", label: "Whole desk" },
  { id: "tbl_leads", label: "Leads" },
  { id: "tbl_shipment", label: "Shipments" },
  { id: "tbl_logistics", label: "Logistics" },
  { id: "tbl_financing", label: "Financing" },
  { id: "tbl_ports", label: "Ports" },
];

export function Reports({ lockedSlug }: { lockedSlug?: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(kind: string) {
    setBusy(true);
    setNote("");
    try {
      const media = lockedSlug === "betterdealtv";
      const ids = media ? ["tbl_leads"] : kind === "business" ? ["tbl_leads", "tbl_shipment", "tbl_logistics", "tbl_financing", "tbl_ports"] : [kind];
      const sections: ReportSpec["sections"] = [];
      for (const id of ids) {
        const table = tableById(id);
        if (!table) continue;
        const data = lockedSlug ? (await readTable(lockedSlug, id)).map((row) => ({ crmName: crmBySlug(lockedSlug)?.name ?? lockedSlug, row })) : await readAcross(id);
        sections.push({
          heading: table.label,
          columns: ["Company", ...table.fields.slice(0, 6).map((field) => field.label)],
          rows: data.slice(0, 40).map(({ crmName, row }) => [crmName, ...table.fields.slice(0, 6).map((field) => cellText(row[field.key]))]),
        });
      }
      const scopeName = lockedSlug ? crmBySlug(lockedSlug)?.name ?? lockedSlug : "Aidyl Systems";
      await shareReport({
        title: `${scopeName} report`,
        subtitle: isLive(lockedSlug ?? "carshipy") || !lockedSlug ? "Carshipy figures are live. Other companies are this phone's workspace." : "Workspace figures stay on this phone.",
        preparedBy: getState().operatorName || "Admin",
        agent: lockedSlug === "carshipy" ? "Maya" : "Randolph",
        notes: "Aether did not change any rows to produce this file.",
        sections,
      });
      setNote("The report is ready to share or print.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not build the report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.p}>{lockedSlug === "betterdealtv" ? "A letter-sized PDF of BetterDealTV leads. Shipments, finance, and ports are not this desk." : "A letter-sized PDF. Randolph can cut the whole group. Maya's copy stays on Carshipy."}</Text>
      {(lockedSlug === "betterdealtv" ? KINDS.filter((kind) => kind.id === "tbl_leads" || kind.id === "business") : KINDS).map((kind) => (
        <Pressable key={kind.id} disabled={busy} onPress={() => void run(kind.id)} style={styles.row}>
          <Text style={styles.label}>{kind.label}</Text>
          <Text style={styles.go}>{busy ? "…" : "PDF"}</Text>
        </Pressable>
      ))}
      {note ? <Text style={styles.p}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  p: { fontFamily: fonts.body, color: colors.muted, lineHeight: 20 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  go: { fontFamily: fonts.bodyMedium, color: colors.brass },
});
