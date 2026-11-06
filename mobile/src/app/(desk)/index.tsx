import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { allCrms, readTable } from "../../lib/data";
import { alertsGranted, askNotificationPermission } from "../../lib/notify";
import { slugify } from "../../lib/registry";
import { addCrm, patch, removeCrm, useDesk } from "../../lib/store";
import { asNumber, money } from "../../lib/utils";
import { colors, fonts } from "../../theme";

export default function Command() {
  const desk = useDesk();
  const [leads, setLeads] = useState<number | null>(null);
  const [ships, setShips] = useState<number | null>(null);
  const [pipeline, setPipeline] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [error, setError] = useState("");
  const [alertsOn, setAlertsOn] = useState(true);
  const companies = allCrms();

  useEffect(() => {
    void alertsGranted().then(setAlertsOn);
  }, [desk.notifyAsked]);

  useEffect(() => {
    void readTable("carshipy", "tbl_leads")
      .then((rows) => {
        setLeads(rows.length);
        setPipeline(rows.reduce((sum, row) => sum + (asNumber(row.budget) ?? 0), 0));
      })
      .catch(() => setLeads(null));
    void readTable("carshipy", "tbl_shipment")
      .then((rows) => setShips(rows.length))
      .catch(() => setShips(null));
  }, []);

  function onAdd() {
    const slug = slugify(name);
    if (!slug || !focus.trim()) {
      setError("Name and a one-line focus are required.");
      return;
    }
    if (companies.some((crm) => crm.slug === slug)) {
      setError("That company already exists.");
      return;
    }
    addCrm({ slug, name: name.trim(), focus: focus.trim() });
    setName("");
    setFocus("");
    setError("");
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.kicker}>AIDYL SYSTEMS</Text>
      <Text style={styles.h1}>The book is being watched.</Text>
      <Text style={styles.p}>The bar under the clock opens every desk. Scroll it for Carshipy, BetterDealTV, Logistics, Reports, and Campaigns.</Text>
      {!alertsOn && !desk.notifyAsked ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Allow alerts on this phone</Text>
          <Text style={styles.p}>Reminders, new BetterDealTV posts, and approved writes should tap you. The list still keeps them if you say not now.</Text>
          <Pressable
            onPress={() => {
              void askNotificationPermission(true).then((ok) => {
                setAlertsOn(ok);
                if (ok) patch({ notifyAsked: true });
              });
            }}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Allow notifications</Text>
          </Pressable>
          <Pressable onPress={() => patch({ notifyAsked: true })}>
            <Text style={styles.remove}>Not now</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.stats}>
        <Stat label="Carshipy leads" value={leads == null ? "—" : String(leads)} dark />
        <Stat label="Shipments" value={ships == null ? "—" : String(ships)} />
        <Stat label="Pipeline" value={pipeline == null ? "—" : money(pipeline)} />
      </View>
      <Text style={styles.h2}>On duty</Text>
      <View style={styles.agents}>
        <Agent name="Randolph" role="Master desk, every company, the reports." dark />
        <Agent name="Maya" role="Carshipy only. She hands media and the other companies to Randolph." />
        <Agent name="Aether" role="Writes a row only after you approve, then pings you." brass />
      </View>
      <View style={styles.rowHead}>
        <Text style={styles.h2}>Companies</Text>
        <Link href="/reports" style={styles.link}>
          Reports
        </Link>
      </View>
      {companies.map((crm) => (
        <View key={crm.slug} style={styles.card}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.cardTitle}>{crm.name}</Text>
            <Text style={styles.p}>{crm.focus}</Text>
            {crm.slug === "betterdealtv" && desk.igWatch?.snapshot ? (
              <Text style={styles.p}>{desk.igWatch.snapshot.followers.toLocaleString()} followers · {desk.igWatch.snapshot.posts.toLocaleString()} posts · watching</Text>
            ) : null}
            <Text style={styles.kickerSmall}>{crm.live ? "Live Dynamo" : "On this phone"} · {crm.agent === "maya" ? "Maya" : "Randolph"}</Text>
          </View>
          <Link href={`/crm/${crm.slug}`} style={styles.open}>
            Open
          </Link>
          {desk.customCrms.some((item) => item.slug === crm.slug) ? (
            <Pressable onPress={() => removeCrm(crm.slug)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <View style={styles.card}>
        <Text style={styles.h2}>Add a company</Text>
        <Text style={styles.p}>Same books as the others, kept on this phone until it has its own gateway.</Text>
        <Text style={styles.label}>Signing as</Text>
        <TextInput value={desk.operatorName} onChangeText={(operatorName) => patch({ operatorName })} style={styles.input} />
        <Text style={styles.label}>Company name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} />
        <Text style={styles.label}>Focus</Text>
        <TextInput value={focus} onChangeText={setFocus} style={[styles.input, { minHeight: 72 }]} multiline />
        {error ? <Text style={styles.remove}>{error}</Text> : null}
        <Pressable onPress={onAdd} style={styles.primary}>
          <Text style={styles.primaryText}>Add company</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <View style={[styles.stat, dark && styles.statDark]}>
      <Text style={[styles.kickerSmall, dark && { color: "rgba(247,241,230,0.65)" }]}>{label}</Text>
      <Text style={[styles.statValue, dark && { color: colors.cream }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Agent({ name, role, dark, brass }: { name: string; role: string; dark?: boolean; brass?: boolean }) {
  return (
    <View style={[styles.agent, dark && styles.statDark, brass && { backgroundColor: colors.brassSoft }]}>
      <Text style={[styles.cardTitle, dark && { color: colors.cream }]}>{name}</Text>
      <Text style={[styles.p, dark && { color: "rgba(247,241,230,0.75)" }, brass && { color: colors.ink }]}>{role}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 200, gap: 12 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 2, fontSize: 12 },
  kickerSmall: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 11, letterSpacing: 0.4 },
  h1: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  p: { fontFamily: fonts.body, color: colors.muted, fontSize: 15, lineHeight: 21 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line, gap: 6 },
  statDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  statValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  agents: { gap: 8 },
  agent: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.line, gap: 4 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  link: { fontFamily: fonts.bodyMedium, color: colors.brass, fontSize: 15 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  cardTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  open: { alignSelf: "flex-start", backgroundColor: colors.ink, color: colors.cream, overflow: "hidden", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, fontFamily: fonts.bodyMedium },
  remove: { fontFamily: fonts.bodyMedium, color: colors.clay },
  label: { fontFamily: fonts.bodyMedium, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, borderRadius: 14, padding: 12, fontFamily: fonts.body, color: colors.ink },
  primary: { backgroundColor: colors.brass, borderRadius: 999, alignItems: "center", paddingVertical: 14 },
  primaryText: { fontFamily: fonts.bodyMedium, color: colors.cream },
});
