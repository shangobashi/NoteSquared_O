import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { apiPost } from "../lib/api";

export default function RecordScreen(props: { onCreated: (lessonId: string) => void }) {
  const [status, setStatus] = useState<string>("idle");

  async function createLessonStub() {
    setStatus("creating");

    if (!supabaseConfigured) {
      setStatus("supabase not configured");
      return;
    }

    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      setStatus("auth required");
      return;
    }

    // MVP stub: audio upload wiring comes next.
    const resp = await apiPost("/v1/lessons", session.access_token, {
      studentId: "REPLACE_ME",
      title: "Lesson",
      audioStoragePath: "REPLACE_ME"
    });

    if (!resp.success) {
      setStatus(resp.error?.message || "error");
      return;
    }

    props.onCreated(resp.data.lessonId);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record</Text>
      <Text style={styles.helper}>
        Start a stubbed lesson run. This will require Supabase auth to be configured.
      </Text>
      <Pressable style={styles.primaryButton} onPress={createLessonStub}>
        <Text style={styles.primaryButtonText}>Create lesson (stub)</Text>
      </Pressable>
      <Text style={styles.status}>{status}</Text>
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
  primaryButton: {
    backgroundColor: "#5870ff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: "flex-start"
  },
  primaryButtonText: {
    color: "#f7f9ff",
    fontFamily: "Plus Jakarta Sans",
    fontWeight: "600"
  },
  status: {
    color: "#ffb347",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    marginTop: 12
  }
});



