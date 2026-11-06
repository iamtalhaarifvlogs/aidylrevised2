import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createRecord, deleteRecord, readTable, updateRecord } from "../lib/data";
import { tableById, type Row, type TableDef } from "../lib/schema";
import { cellText } from "../lib/utils";
import { colors, fonts } from "../theme";

export function Records({ slug, tableId }: { slug: string; tableId: string }) {
  const spec = tableById(tableId);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null | undefined>(undefined);

  async function load() {
    if (!spec) return;
    setLoading(true);
    try {
      setRows(await readTable(slug, spec.id));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [slug, tableId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !spec) return rows;
    return rows.filter((row) => spec.fields.some((field) => cellText(row[field.key]).toLowerCase().includes(q)));
  }, [query, rows, spec]);

  if (!spec) return <Text style={styles.muted}>Unknown book.</Text>;

  return (
    <View style={{ gap: 10, flex: 1 }}>
      <View style={styles.bar}>
        <TextInput value={query} onChangeText={setQuery} placeholder={`Search ${spec.label.toLowerCase()}`} placeholderTextColor={colors.muted} style={styles.search} />
        <Pressable onPress={() => setEditing(null)} style={styles.add}>
          <Text style={styles.addText}>New</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.brass} /> : null}
      <View style={{ gap: 8, paddingBottom: 24 }}>
        {shown.length === 0 && !loading ? <Text style={styles.muted}>Nothing here yet.</Text> : null}
        {shown.map((item, index) => (
          <Pressable key={String(item[spec.pk] ?? index)} onPress={() => setEditing(item)} style={styles.card}>
            <Text style={styles.title}>{cellText(item.name || item.partner_name || item.port_name || item.shipment_number || item.Caller || item[spec.pk])}</Text>
            <Text style={styles.muted}>
              {spec.fields
                .filter((field) => field.key !== spec.pk)
                .slice(0, 3)
                .map((field) => cellText(item[field.key]))
                .join(" · ")}
            </Text>
          </Pressable>
        ))}
      </View>
      <Editor
        visible={editing !== undefined}
        spec={spec}
        slug={slug}
        row={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          void load();
        }}
      />
    </View>
  );
}

function Editor({
  visible,
  spec,
  slug,
  row,
  onClose,
  onSaved,
}: {
  visible: boolean;
  spec: TableDef;
  slug: string;
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const next: Record<string, string> = {};
    for (const field of spec.fields) {
      if (!field.ask) continue;
      next[field.key] = row ? cellText(row[field.key]).replace(/^—$/, "") : "";
    }
    setValues(next);
    setError("");
  }, [visible, row, spec]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (row) {
        const key: Row = { [spec.pk]: row[spec.pk] };
        if (spec.sk) key[spec.sk] = row[spec.sk];
        await updateRecord({ slug, table: spec.id, key, patch: values, agent: "Admin" });
      } else {
        await createRecord({ slug, table: spec.id, values, agent: "Admin" });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not write");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!row) return;
    setBusy(true);
    try {
      const key: Row = { [spec.pk]: row[spec.pk] };
      if (spec.sk) key[spec.sk] = row[spec.sk];
      await deleteRecord({ slug, table: spec.id, key, agent: "Admin" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  const fields = spec.fields.filter((field) => field.ask);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>{row ? "Edit" : "New"} {spec.singular}</Text>
        <Text style={styles.muted}>Dates and ids are stamped. You do not type them.</Text>
        <FlatList
          data={fields}
          keyExtractor={(field) => field.key}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View>
              <Text style={styles.label}>{item.label}</Text>
              <TextInput
                value={values[item.key] ?? ""}
                onChangeText={(value) => setValues((prev) => ({ ...prev, [item.key]: value }))}
                placeholder={item.hint}
                placeholderTextColor={colors.muted}
                style={[styles.search, item.kind === "textarea" && { minHeight: 80 }]}
                multiline={item.kind === "textarea"}
              />
            </View>
          )}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={onClose} style={styles.ghost}>
            <Text style={styles.ghostText}>Close</Text>
          </Pressable>
          {row ? (
            <Pressable onPress={() => void remove()} style={styles.ghost}>
              <Text style={styles.remove}>Delete</Text>
            </Pressable>
          ) : null}
          <Pressable disabled={busy} onPress={() => void save()} style={styles.add}>
            <Text style={styles.addText}>{busy ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", gap: 8 },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  add: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 16, justifyContent: "center" },
  addText: { fontFamily: fonts.bodyMedium, color: colors.cream },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: 13 },
  error: { fontFamily: fonts.body, color: colors.clay },
  modal: { flex: 1, backgroundColor: colors.bg, padding: 18, paddingTop: 48, gap: 8 },
  modalTitle: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  label: { fontFamily: fonts.bodyMedium, color: colors.ink, marginBottom: 4 },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  ghost: { paddingHorizontal: 12, paddingVertical: 12 },
  ghostText: { fontFamily: fonts.bodyMedium, color: colors.ink },
  remove: { fontFamily: fonts.bodyMedium, color: colors.clay },
});
