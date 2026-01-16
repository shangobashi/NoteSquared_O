import React, { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
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
    <View style={{ padding: 16 }}>
      <Text style={{ color: "#fff", fontSize: 22, marginBottom: 12 }}>Review</Text>
      <Button title="Refresh status" onPress={refresh} />
      <Text style={{ color: "#888", marginTop: 12 }}>
        {JSON.stringify(status, null, 2)}
      </Text>
      <Button title="Back" onPress={props.onBack} />
    </View>
  );
}
