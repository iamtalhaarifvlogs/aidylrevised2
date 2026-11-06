import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TrainPanel } from "../../components/TrainPanel";
import { colors, fonts } from "../../theme";

export default function Train() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>TRAINING STUDIO</Text>
        <Text style={styles.h}>Teach them something they will actually use.</Text>
        <Text style={styles.p}>Write a rule in plain language. Randolph learns the group. Maya learns Carshipy. Both keep the note, and they quote it the next time you ask.</Text>
      </View>
      <TrainPanel defaultAgent="randolph" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 200, gap: 16 },
  hero: { backgroundColor: colors.ink, borderRadius: 24, padding: 18, gap: 8 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brassSoft, letterSpacing: 2, fontSize: 11 },
  h: { fontFamily: fonts.display, color: colors.cream, fontSize: 34, lineHeight: 38 },
  p: { fontFamily: fonts.body, color: "rgba(247,241,230,0.78)", lineHeight: 21 },
});
