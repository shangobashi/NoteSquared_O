import React, { useState } from "react";
import { SafeAreaView, View, Button, Text } from "react-native";
import RecordScreen from "./screens/RecordScreen";
import ReviewScreen from "./screens/ReviewScreen";

export default function App() {
  const [screen, setScreen] = useState<"record" | "review">("record");
  const [lessonId, setLessonId] = useState<string | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      {screen === "record" && (
        <RecordScreen
          onCreated={(id) => {
            setLessonId(id);
            setScreen("review");
          }}
        />
      )}
      {screen === "review" && lessonId && (
        <ReviewScreen
          lessonId={lessonId}
          onBack={() => setScreen("record")}
        />
      )}
      <View style={{ padding: 12 }}>
        <Text style={{ color: "#888" }}>MVP navigation placeholder</Text>
      </View>
    </SafeAreaView>
  );
}
