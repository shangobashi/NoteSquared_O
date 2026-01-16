import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { apiGet } from "../lib/api";

export default function ReviewScreen(props: { lessonId: string; onBack: () => void }) {
  const [status, setStatus] = useState<any>(null);

  async function refresh() {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    const resp = await apiGet(`/v1/lessons/${props.lessonId}/status`, session.access_token);
    setStatus(resp);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review</Text>
      <Text style={styles.helper}>Check the latest pipeline status for this lesson.</Text>
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={refresh}>
          <Text style={styles.secondaryButtonText}>Refresh status</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={props.onBack}>
          <Text style={styles.ghostButtonText}>Back</Text>
        </Pressable>
      </View>
      <View style={styles.statusPanel}>
        <Text style={styles.statusText}>
          {status ? JSON.stringify(status, null, 2) : "No status yet"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8
  },
  title: {
    color: "#fefdf8",
    fontSize: 20,
    fontFamily: "Plus Jakarta Sans",
    fontWeight: "600",
    marginBottom: 8
  },
  helper: {
    color: "#9ca3af",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 13,
    marginBottom: 16
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap"
  },
  secondaryButton: {
    backgroundColor: "#5870ff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10
  },
  secondaryButtonText: {
    color: "#f7f9ff",
    fontFamily: "Plus Jakarta Sans",
    fontWeight: "600"
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "rgba(160,178,255,0.35)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10
  },
  ghostButtonText: {
    color: "#e7edff",
    fontFamily: "Plus Jakarta Sans",
    fontWeight: "600"
  },
  statusPanel: {
    marginTop: 16,
    backgroundColor: "rgba(88,112,255,0.14)",
    borderRadius: 12,
    padding: 12
  },
  statusText: {
    color: "#cbd6ef",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    lineHeight: 18
  }
});



