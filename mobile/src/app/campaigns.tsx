import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { upsertCampaign, useDesk } from "../lib/store";
import type { PhoneCampaign } from "../lib/types";
import { colors, fonts } from "../theme";

function statusLabel(status: PhoneCampaign["status"]) {
  if (status === "approved") return "Approved, not launched";
  if (status === "rejected") return "Refused";
  if (status === "deferred") return "Saved for later";
  return "Awaiting you";
}

export default function CampaignsScreen() {
  const desk = useDesk();
  const campaigns = desk.campaigns;

  function decide(campaign: PhoneCampaign, status: PhoneCampaign["status"]) {
    upsertCampaign({
      ...campaign,
      status,
      decision_note: status === "approved" ? "Approved on the phone. Nothing was published." : campaign.decision_note,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.kicker}>CAMPAIGN INTELLIGENCE</Text>
      <Text style={styles.h}>Proposals, not ads.</Text>
      <Text style={styles.p}>
        Tell Maya or Randolph who it is for and what the line should say. Approving a proposal does not publish it, contact anyone, or spend money.
      </Text>
      {campaigns.length === 0 ? (
        <Text style={styles.p}>Nothing filed on this phone yet. Open Randolph and describe the campaign in a sentence.</Text>
      ) : null}
      {campaigns.map((campaign) => (
        <View key={campaign.cp_id} style={styles.card}>
          <Text style={styles.kicker}>
            {campaign.analyst === "maya" ? "Maya" : "Randolph"} · {statusLabel(campaign.status)}
          </Text>
          <Text style={styles.title}>{campaign.title}</Text>
          <Text style={styles.p}>{campaign.message}</Text>
          <Text style={styles.meta}>Audience: {campaign.audience}</Text>
          {campaign.evidence.map((line) => (
            <Text key={line} style={styles.meta}>
              {line}
            </Text>
          ))}
          <Text style={styles.meta}>{campaign.cp_id}{campaign.synced ? " · on the live book" : " · kept on this phone"}</Text>
          {campaign.status === "proposed" || campaign.status === "deferred" ? (
            <View style={styles.row}>
              <Pressable onPress={() => decide(campaign, "approved")} style={styles.primary}>
                <Text style={styles.primaryText}>Approve</Text>
              </Pressable>
              <Pressable onPress={() => decide(campaign, "deferred")} style={styles.ghost}>
                <Text style={styles.ghostText}>Later</Text>
              </Pressable>
              <Pressable onPress={() => decide(campaign, "rejected")} style={styles.ghost}>
                <Text style={styles.ghostText}>Refuse</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.meta}>This decision does not launch the campaign.</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 140, gap: 12 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 1.2, fontSize: 11 },
  h: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, lineHeight: 38 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  p: { fontFamily: fonts.body, color: colors.muted, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: fonts.body, color: colors.ink, fontSize: 13, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primary: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  primaryText: { fontFamily: fonts.bodyMedium, color: colors.cream },
  ghost: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 10 },
  ghostText: { fontFamily: fonts.bodyMedium, color: colors.ink },
});
