import React, { useState } from "react";
import { View, Button, Text } from "react-native";
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
    <View style={{ padding: 16 }}>
      <Text style={{ color: "#fff", fontSize: 22, marginBottom: 12 }}>Record</Text>
      <Button title="Create lesson and process (stub)" onPress={createLessonStub} />
      <Text style={{ color: "#888", marginTop: 12 }}>{status}</Text>
    </View>
  );
}
