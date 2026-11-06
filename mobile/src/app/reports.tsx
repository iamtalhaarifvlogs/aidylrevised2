import { ScrollView, StyleSheet, Text } from "react-native";
import { Reports } from "../components/Reports";
import { colors, fonts } from "../theme";

export default function ReportsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.h}>Master reports</Text>
      <Reports />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 120, gap: 12 },
  h: { fontFamily: fonts.display, fontSize: 34, color: colors.ink },
});
